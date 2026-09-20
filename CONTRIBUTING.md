# Contributing to diffpack

Thank you for your interest in contributing to diffpack! This document provides guidelines and instructions for contributing to this project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.x or later)

That is the whole list. The diffing engine is Rust, but it arrives prebuilt from npm as
[`@philfreshman/diffpack-engine`](https://www.npmjs.com/package/@philfreshman/diffpack-engine) —
a Rust toolchain is needed only to work on
[the engine itself](https://github.com/philfreshman/diffpack-engine), in its own repository.

### Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the development server:
   ```bash
   bun run dev
   ```

There is no build step in front of that, and no toolchain to install for it. `bun install` brings
the compiled engine down with everything else.

### The engine

The extraction and diffing logic — everything that downloads an archive, unpacks it and compares
two versions — is Rust compiled to WebAssembly. It lives in
**[philfreshman/diffpack-engine](https://github.com/philfreshman/diffpack-engine)** and is consumed
here as an ordinary dependency, `@philfreshman/diffpack-engine`, pinned in `package.json`. It is a
`wasm-pack --target web` module: `src/lib/worker/diff.worker.ts` imports its three entry points and
initialises it against the `.wasm` URL Vite fingerprints.

Two consequences worth knowing:

- It is excluded from Vite's dependency pre-bundler (`optimizeDeps.exclude` in `vite.config.ts`).
  The pre-bundler rewrites the relationship between the JS glue and its `.wasm`, which is exactly
  what `init({ module_or_path: wasmUrl })` depends on.
- Its TypeScript declarations are wasm-pack's own, shipped in the package. There is nothing
  hand-written to keep in sync — the stand-in declaration and the `check:wasm-types` script that
  guarded it were both deleted when the engine moved out.

**Changing the engine** means a PR there, a release, and a version bump here. To try a change
before publishing it, point the build at a local `wasm-pack` output:

```bash
cd ../diffpack-engine && wasm-pack build --release --target web --scope philfreshman
cd ../diffpack && DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg bun run dev
```

`DIFFPACK_ENGINE_LOCAL` aliases the package to that directory for the run. Unset — every CI run,
every deploy, and every command you have not deliberately prefixed — it does nothing. Note that
`dev` does not rebuild the crate either way: re-run `wasm-pack build` and restart.

The cost of the split is that a change over there is not proved against the app until the version
moves here. That is why the engine's own CI runs `wasm-pack test --headless --chrome` over its
`#[wasm_bindgen]` boundary, and why the Renovate PR that bumps
`@philfreshman/diffpack-engine` — which runs the full end-to-end suite — is one to read rather
than rubber-stamp.

### Tests

```bash
bun run test        # unit — pure functions, fast, no network
bun run test:e2e    # Playwright — drives the real app against the real registries
```

The e2e suite downloads real archives, so it is slow and needs a network. It is the only place the
WebAssembly actually runs, which is why the coverage lives there rather than in mocked unit tests.

`test:e2e` builds and serves the app itself — a **production** build, never `vite dev`. Three
defects have reached `development` past a green dev-only run (`7bd9d90`), so the build is part of
the command rather than a prerequisite you might forget. Each run pays for that build; since the
engine moved out it is a Vite build and nothing more.

It also serves with `--strictPort`, and that is not a detail. Left to itself `vite preview` shrugs
at a busy port and moves to the next one while Playwright goes on polling the original — so the
suite runs green or red against **whatever else is answering there**, which in a repo worked on in
several worktrees at once is somebody else's build. It has to die instead.

Two ways to keep out of another worktree's way:

```bash
PORT=4399 bun run test:e2e                            # serve somewhere else entirely

bun run preview                                       # or point at a server you are already
BASE_URL=http://localhost:4321 bunx playwright test    # running, and skip the rebuild
```

The engine's own tests — the host-side suite over extraction, rename detection and the tree, and the
browser suite over its `#[wasm_bindgen]` boundary — live with the engine, in
[philfreshman/diffpack-engine](https://github.com/philfreshman/diffpack-engine), and run in its CI.
Nothing here builds or tests Rust.

### The pre-commit hook

`.husky/pre-commit` runs, in order: `typecheck`, `lint`, `format`, `test`, then
[`fallow audit`](https://fallow.tools) scoped to what your branch changed against its upstream (or
`development` if it has none). Measured on this repo: typecheck ~2.1s, lint ~1.4s, format ~0.1s,
test ~0.3s, `fallow audit` ~1.4s warm — about 5.3s total.

`fallow audit --gate new-only` (the default, and what the hook passes) only blocks findings **your
change introduces** — unused exports, new complexity, duplication, and the rest of what
`.fallowrc.jsonc` enables. Findings already on `development` in files you did not touch do not
block you.

**`fallow audit` analyzes the working tree, not the index.** If you `git add` part of a file and
leave the rest unstaged, the hook can still fail on the unstaged code, because it looks at what is
on disk, not what `git commit` is about to record. This is inherent to how `--base` diffing works
and is not configurable — stage the whole file, or `git stash --keep-index` before committing if
you need to test the staged-only state.

`git commit --no-verify` skips the entire hook, tests included. It is a legitimate escape hatch
when you know the hook is wrong for your situation — e.g. a WIP commit on a scratch branch you will
squash, or a `fallow` false positive you are about to fix in the next commit anyway — but it is not
a way around a finding you disagree with; open an issue or adjust `.fallowrc.jsonc` instead. Claude
Code commits are gated separately (`.claude/hooks/fallow-gate.sh`, installed via
`fallow hooks install --target agent`) and cannot reach for `--no-verify` to bypass it.

### CI

`.github/workflows/ci.yml` runs on every pull request to `development` and on every push to it, in
four jobs — none of which needs a Rust toolchain, since the engine arrives prebuilt:

| Job | Runs | Needs |
| :--- | :--- | :--- |
| `typecheck, lint, unit tests` | `typecheck`, `lint`, `format`, `test`, `check:badge` | bun only |
| `end-to-end` | `test:e2e` | bun + Chromium |
| `fallow audit (PR gate)` | `fallow audit --gate new-only`, `fallow security --gate newly-reachable`, SARIF upload | bun, PRs only |
| `fallow (full repo)` | full-repo `fallow`, the type-aware pass, the health grade, SARIF upload, baseline artifact | bun, pushes to `development` only |

The first two are split so a broken type or a failing unit test goes red in under a minute rather
than behind a Chromium download and a production build. On an e2e failure the Playwright HTML
report and traces are uploaded as a `playwright-report` artifact on the run.

Rust — `cargo fmt --all --check`, `cargo test`, and `wasm-pack test --headless --chrome` — runs in
[the engine's CI](https://github.com/philfreshman/diffpack-engine/blob/main/.github/workflows/ci.yml),
not here.

The two `fallow` jobs mirror the pre-commit hook's `--gate new-only` behavior on PRs and add a
full-repo run on `development` itself, which catches drift on files no PR touched — something
`--gate new-only` will never do, by design. That job also re-saves the per-analysis baseline files
(`dead-code-baseline.json`, `health-baseline.json`, `dupes-baseline.json`) and publishes them as a
`fallow-baselines` artifact on the run. It does not commit them back: `development` has required
status checks, so a push from the job is rejected outright, and a `GITHUB_TOKEN` push would not
trigger the checks that would clear it either. To refresh the checked-in baselines, download the
artifact from the latest `development` run (or regenerate them locally with the same three
`--save-baseline` commands) and open a normal PR. These jobs exist to catch a PR opened with
`--no-verify`, which skips the local hook entirely.

### What `fallow` enforces here

`.fallowrc.jsonc` is commented line by line — every exception it holds says why it exists, and a new
one is expected to do the same. Four things in it are worth knowing before you hit them.

**Architecture boundaries.** `src/` is three zones, and imports only run downhill:

```
routes  →  components  →  lib
```

`src/lib/**` may import from neither of the other two. That is the rule with teeth: `lib` is the
part of this codebase that is pure and unit-tested — URL parsing, the registry adapters, the diff
parser, the worker client, the storage prefs — and one import of a component from there is every
one of those tests needing a DOM. Nothing had to be refactored to turn this on; it was already true,
and now it cannot quietly stop being.

Every file under `src/` must belong to a zone, so a new top-level directory there is a finding
rather than a silent exemption — decide which layer it is, or add it to `coverage.allowUnmatched`
with a reason. Before editing:

```bash
bunx fallow guard src/lib/registries/npm.ts   # which rules apply to this file
bunx fallow list --boundaries                 # the zones, and how many files each holds
```

**House rules.** `rule-packs/diffpack-policy.jsonc` holds two, both currently at zero:

- `localStorage` is reachable only from the module that owns the key. The six key names are a
  compatibility contract with returning visitors (see CLAUDE.md); they survive only while every read
  and write goes through the module the e2e suite imports the constant from. The rule is scoped to
  `src/**` — `tests/e2e/` and `scripts/` drive the *browser's* storage through `page.evaluate`,
  which is a fixture, not a preference read.
- Registry adapters take the injected `Fetcher` rather than calling the global `fetch`, which is
  what keeps `tests/unit/registries/` able to run without a network.

```bash
bunx fallow rule-pack test rule-packs/diffpack-policy.jsonc
```

**Security candidates.** `bunx fallow security` is a separate, opt-in surface — its findings never
appear under bare `fallow` or in the audit gate. The candidates standing on `development` are
triaged once, with evidence, in [docs/security-candidates.md](docs/security-candidates.md); CI fails
a PR that makes a *new* one reachable from an entry point (`--gate newly-reachable`, not
`--gate new` — the latter also fires when an existing sink's ranking moves, which the triage test
itself caused). If that step goes red, either fix the sink or add a row to that file.

**The type-aware pass** (`--type-aware`) runs in CI only, on pushes to `development`. It is the
semantic answer to a question the syntactic pass can only guess at — whether an export really has no
consumers — so it has work to do exactly when something is not clean, and reports `executed: false`
otherwise. It is deliberately not in the pre-commit hook: the hook's whole argument is that it stays
around five seconds. Locally:

```bash
bunx fallow dead-code --type-aware --symbol-impact src/lib/theme.ts:THEME_STORAGE_KEY
```

**The health grade** is the badge at the top of the README, and it is a committed SVG rather than a
service call — `fallow health --format badge` emits the image itself, not a shields.io URL. So it
can go stale, and something has to notice: `bun run check:badge` regenerates the badge and diffs it
against the committed one, and it runs in the `typecheck, lint, unit tests` job.

It cannot be refreshed by CI on your behalf — pushes from a workflow to `development` are rejected
by its own required checks, which is the wall the baselines above already hit. So when a change
moves the score, the fix is one command:

```bash
bun run badge   # then commit .github/badges/fallow-health.svg
```

The same grade, with the per-threshold detail behind it, is also written to the job summary of every
`fallow (full repo)` run. Locally: `bunx fallow health --format github-summary`.

## Development Workflow

- **Branching**: Create a feature branch for your changes.
- **Code Style**: We use [Biome](https://biomejs.dev) for linting and formatting — tabs, double
  quotes. Run it with:
  ```bash
  bun run format
  ```
- **Styling**: CSS Modules, no Tailwind. A component that has a stylesheet lives in its own folder
  with it (`components/ui/Button/{Button.tsx,Button.module.css}`), so the pair moves as a unit.
  Shared values are custom properties in `src/styles/globals.css`; components read
  `var(--color-foreground)` rather than branching on the theme themselves.
- **Commits**: We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Conventional Commits

Commit messages must follow this format:
`<type>[optional scope]: <description>`

### Commit Types

| Type | Description |
| :--- | :--- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc) |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding missing tests or correcting existing tests |
| `build` | Changes that affect the build system or external dependencies (example scopes: bun, npm) |
| `ci` | Changes to our CI configuration files and scripts |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

## Pull Request Process

1. Ensure your code follows the existing style and passes formatting checks.
2. Update the README.md or other documentation if your changes introduce new features or change existing ones.
3. Submit a Pull Request with a clear description of your changes.
4. CI must be green before it can merge. It runs the same commands the hook does, plus the tests —
   so anything that passes locally should pass there.
