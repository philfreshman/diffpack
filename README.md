<div align="center">

<img src="public/web-app-manifest-192x192.png" alt="" width="72" height="72">

### diffpack

**Compare package versions across ecosystems.**<br>
Clean. Fast. Source-aware.

[**diffpack.io**](https://diffpack.io) · [Contributing](CONTRIBUTING.md) · [Agent guide](AGENTS.md)

[![Codebase health](.github/badges/fallow-health.svg)](CONTRIBUTING.md#what-fallow-enforces-here)

</div>

<br>

Paste two versions of a package and read what actually changed — the files, the lines, the
renames — without cloning anything or trusting a changelog.

<br>

### A diff is a URL

```
diffpack.io / npm / zod / 3.25.76 / 4.0.0 / src/types.ts
              │     │     │         │       │
              │     │     │         │       └── file to open   (optional)
              │     │     │         └────────── to
              │     │     └──────────────────── from
              │     └────────────────────────── package
              └──────────────────────────────── registry
```

Every state of the app is addressable, so whatever you are looking at is a link you can send to
someone.

<br>

### It runs in your browser

```
   registry ──────── tarballs ───────▶ your browser
                                            │
                                       wasm worker
                                            │
                                          diff ──▶ you
```

Both archives travel straight from the registry to your machine, where a Rust/WebAssembly module
unpacks and diffs them inside a Web Worker. diffpack's server renders the page shell and nothing
else — package contents never reach it.

<br>

### Registries

| | Registry | Language | Search |
| :-- | :-- | :-- | :-- |
| ⬢ | **npm** | JavaScript & TypeScript | yes |
| ⬢ | **crates.io** | Rust | yes |
| ⬢ | **PyPI** | Python | yes |
| ⬡ | **Go** | Go modules | type a full module path |

> Go has no discovery search — `proxy.golang.org` exposes no CORS-enabled search-by-name API — so
> the field takes a complete module path (`github.com/go-chi/chi/v5`) rather than a name.

More registries are on the way.

<br>

### Quick start

Needs [Bun](https://bun.sh). Nothing else — no Rust toolchain, no build step in front of `dev`.

```bash
bun install
bun run dev          # http://localhost:4321
```

That is the whole setup. `bun install` brings the compiled diff engine down with everything else.

<br>

### The engine is a separate repo

Extraction and diffing — everything that fetches a tarball, unpacks it and compares two versions —
is Rust compiled to WebAssembly, and it lives in
**[philfreshman/diffpack-engine](https://github.com/philfreshman/diffpack-engine)**. This repo
consumes it and never builds it:

```
  diffpack-engine  ──▶  @philfreshman/diffpack-engine  ──▶  diffpack
   Rust crate            npm · wasm-pack                    a dependency
   its own CI            provenance-signed                  pinned in package.json
```

| To | |
| :-- | :-- |
| change what you see | a PR here |
| change how a diff is computed | a PR in **diffpack-engine** |
| try an engine change before releasing it | `DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg bun run dev` |
| ship an engine change | tag `v*` there, then bump the version here |

Nothing here compiles Rust — not `dev`, not `build`, not CI, not the Vercel deploy. The cost of
that is a seam: an engine change is not proved against the app until its version moves in
`package.json`. The engine's own CI runs its `#[wasm_bindgen]` boundary in a real browser to cover
the gap, and the bump PR here runs the full end-to-end suite, which makes it one to read rather
than wave through.

See [CONTRIBUTING.md](CONTRIBUTING.md#the-engine) for the detail.

<br>

### The three repositories

diffpack is split across three repositories that are meant to be cloned as siblings under one
parent directory — which is what `DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg` and every relative
path below assumes:

```
<parent>/
├── diffpack/          github.com/philfreshman/diffpack
├── diffpack-engine/   github.com/philfreshman/diffpack-engine
└── diffpack-server/   github.com/philfreshman/diffpack-server
```

| Repo | What lives there |
| :-- | :-- |
| **diffpack** | The web app — TanStack Start, the UI, the registry adapters, the worker that drives the engine. Deployed to [diffpack.io](https://diffpack.io). |
| **diffpack-engine** | The Rust crate compiled to WebAssembly: fetching archives, extraction, the diff and the file tree. Published to npm as `@philfreshman/diffpack-engine` and consumed by the app as a pinned dependency; the app never builds it. |
| **diffpack-server** | Initialised and still empty — one commit, a one-line README, nothing depending on it yet. |

Nothing links the three at build time except that npm package, so a change that crosses a boundary
crosses a release: see [the engine section](#the-engine-is-a-separate-repo) for how an engine change
reaches the app.

<br>

### Scripts

| | |
| :-- | :-- |
| `bun run dev` | Vite dev server on `:4321` |
| `bun run build` | `vite build` (Nitro writes `.vercel/output/`) |
| `bun run preview` | serve the production build |
| `bun run test` | unit tests (`bun test tests/unit`) |
| `bun run test:e2e` | Playwright — hits the real registries, so slow and online |
| `bun run screenshots` | recapture the reference set (`scripts/capture-screenshots.mjs`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` · `format` | Biome |

<br>

### Stack

| | |
| :-- | :-- |
| **App** | [TanStack Start](https://tanstack.com/start) + [Router](https://tanstack.com/router) on Vite — the shell is SSR'd whole, the diff engine stays strictly client-side |
| **State** | [Query](https://tanstack.com/query) for registry calls, [Store](https://tanstack.com/store) for the diff session |
| **UI** | [Base UI](https://base-ui.com) primitives wrapped in `src/components/ui`, CSS Modules over a custom-property token layer — no Tailwind |
| **Engine** | Rust → WebAssembly for extraction and diffing, in its own repo: [diffpack-engine](https://github.com/philfreshman/diffpack-engine) |
| **Tooling** | [Biome](https://biomejs.dev), [fallow](https://fallow.tools) |

<br>

<details>
<summary><b>Deployment</b> — Vercel, and three things to know before editing deploy config</summary>

<br>

Vercel via the [Nitro](https://nitro.build) Vite plugin: `vite build` writes a Build Output API v3
tree to `.vercel/output/` — static assets plus one server function — which Vercel serves as-is.

**Routing and headers belong in `nitro({ routeRules })` in `vite.config.ts`, not `vercel.json`.**
A build that writes `.vercel/output/config.json` brings its own routing table, so rules left in
`vercel.json` are read by nobody. What `vercel.json` still carries is the build command — the
install command it used to need, which installed a Rust target and compiled the engine before
`bun install` could run, went away when the engine became a published package — and the rule
below. Confirm a change landed by reading `.vercel/output/config.json` after
`VERCEL=1 bun run build`.

**Only `main` deploys.** `git.deploymentEnabled` turns every other branch off, so pushing to
`development` or opening a PR no longer builds a preview. Previews were not being used and each
one was a full production build, so the cost was real and the output was read by nobody. The
pattern is `"**": false` with `"main": true` on top of it: Vercel matches branch names with
minimatch and deploys when *any* matching rule is true, so the specific entry wins over the
wildcard. A branch that needs a URL gets one from `vercel deploy` rather than from a push.

**The `www.diffpack.io` → `diffpack.io` redirect is a domain setting in the Vercel project**, not
something this repo configures — `routeRules` match on path, not host.

</details>

<br>

<div align="center">
<sub>Contributions welcome — start at <a href="CONTRIBUTING.md">CONTRIBUTING.md</a>.</sub>
</div>
