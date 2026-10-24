# CLAUDE.md

The agent guide for this repo. [AGENTS.md](AGENTS.md) covers how to ask fallow a question and the
sibling repositories; [CONTRIBUTING.md](CONTRIBUTING.md) has the long form of the hook, CI and
fallow configuration. This page is the map: where things are, how they fit together, and the rules
that are easy to break without knowing they exist.

diffpack compares two versions of a package in the browser. The URL names the comparison, a Web
Worker running a Rust/WebAssembly engine downloads and diffs both archives, and the server renders
the shell and nothing else — package contents never reach it. Composer is the one exception to
"straight from the registry": Packagist's metadata and archives send no CORS header, so the browser
fetches them through `diffpack-proxy`, a Cloudflare Worker that streams the bytes without storing
them. The diff is still computed in the browser.

## Commands

Bun only. No Rust toolchain: the engine arrives prebuilt as `@philfreshman/diffpack-engine`.

```bash
bun install
bun run dev              # Vite on :4321
bun run typecheck        # tsc --noEmit
bun run lint             # biome lint .
bun run format           # biome format . (tabs, double quotes)
bun run test             # unit: bun test tests/unit, no network, ~1s
bun run test:e2e         # Playwright: production build + real registries, slow and online
bun run generate-routes  # tsr generate, after adding or renaming a file in src/routes/
bun run generate-emphasis # rewrite themeEmphasis.gen.ts, after a highlight.js upgrade or a theme change
bun run badge            # regenerate .github/badges/fallow-health.svg when the score moves
```

- One unit test: `bun test tests/unit/session/diffSession.test.ts` (add `-t "<name>"` to narrow).
- One e2e spec: `bunx playwright test tests/e2e/file-tree.spec.ts`. It builds and serves the app
  itself with `--strictPort`; use `PORT=4399` to stay out of another worktree's way, or
  `BASE_URL=http://localhost:4321` to point at a server already running and skip the rebuild.
- `VITE_DIFFPACK_PROXY_ORIGIN` points the Composer and Go adapters and the engine at another proxy, such as
  `http://localhost:8787` for `bun run dev` in `../diffpack-proxy`. Unset, both use the deployed
  `https://diffpack-proxy.philipswiezak.workers.dev`, and so does every e2e run.
- The pre-commit hook runs typecheck, lint, format, test, then `fallow audit` against the branch's
  upstream. Run those before committing rather than finding out from the hook.
- `src/routeTree.gen.ts` and `src/lib/diff/themeEmphasis.gen.ts` are generated and committed. Do
  not edit them by hand; `themeEmphasis.test.ts` fails when the second is out of date.

## Layout and boundaries

```
fixtures/        diffpack-server's cache-key vectors, byte for byte (see "The server's cache")
src/routes/      TanStack Start file routes: parse the URL, hand it to a component
src/components/  React. One folder per component that has a stylesheet: Foo/{Foo.tsx,Foo.module.css}
src/lib/         Pure TypeScript: no React, no DOM rendering, unit-tested
src/styles/      globals.css: the token layer, the reset, view transitions
tests/unit/      bun:test, mirrors src/lib/
tests/e2e/       Playwright, the only place the wasm, the worker and the DOM run
```

Imports run downhill only, `routes → components → lib`, and `src/lib/**` imports neither of the
others. fallow enforces it, and every file under `src/` must be in a zone. Import through the
`#/` alias (`#/lib/registries/index.ts`), with the file extension.

Most modules in `lib` are a factory over their one side effect, plus a module-level singleton for
the app: `createDiffClient(spawn, boot)` / `diffClient`, `createDiffSession(client)` /
`diffSession`, `createNpmAdapter(fetcher)` / `npmAdapter`. Tests call the factory with a stub —
`tests/unit/registries/fetchStub.ts`, `tests/unit/storage/storeStub.ts` — so none of them need a
network, a worker or `localStorage`. Keep new code in that shape.

## Routing: a diff is a URL

```
/<registry>/<package…>/<from>/<to>/<file…>
```

- `src/routes/$registry/route.tsx` rejects an unknown registry with a 404 in `beforeLoad`. It does
  not put the adapter in route context: context is serialized into the SSR payload, and an
  adapter has methods. Children look it up again with `requireAdapter(params.registry)`.
- `$registry/index.tsx` (`/npm`) and `$registry/$.tsx` (everything deeper) both load
  `parseSlug(adapter, splat)` from `src/lib/url/slug.ts` and render `DiffWorkspace`.
- How many segments a package name spans is the adapter's business, through `packagePath`: npm
  takes two for a scoped name, Go takes everything up to the first segment matching
  `MODULE_VERSION`, Composer takes two (`vendor/package`, lowercased), crates and PyPI take one
  (`singleSegmentPath`).
- `buildPath` is the inverse of `parseSlug`, and it keeps `@` unescaped because `/npm/@types/node`
  is the URL that is live and indexed. Build links with `buildPath`, never by concatenating strings.
- A package plus two versions in the URL *is* the request for a comparison. Nothing else starts
  the engine: a deep link, a Compare click and the back button are the same event, and
  `useDiffSession` only passes the slug on. Change what happens by changing the URL.
- Only a navigation between the landing page and a workspace gets a view transition
  (`src/router.tsx`, `::view-transition-*` in `globals.css`).

## Registry adapters

`src/lib/registries/`. Each adapter implements `RegistryAdapter` (`types.ts`): `search`,
`versions` (newest first), `downloadUrl`, `packagePath` and `capabilities`. `index.ts` lists them in
landing-page order and exposes `getAdapter` / `requireAdapter` / `isRegistryId`.

- Adapters take an injected `Fetcher` (default `fetch`) and call it through `getJson` / `getText`
  in `http.ts`. Calling the global `fetch` is a rule-pack violation.
- Every URL is a constant origin with the name appended to its path, encoded:
  `` `${REGISTRY_URL}/${encodeURIComponent(name)}` ``. Never `new URL(name, BASE)`, which lets a
  name replace the host. `tests/unit/registries/outboundOrigins.test.ts` asserts it with hostile
  names, and `docs/security-candidates.md` explains why.
- Go search looks a full module path up at `proxy.golang.org` (case-escaped: `!masterminds`). Any
  other text, or a path that does not resolve, is a keyword search at
  `${PROXY_ORIGIN}/v1/go/search`, which relays pkg.go.dev's search API (no CORS header of its
  own). pkg.go.dev lists packages, so the adapter groups them by module. Enter still takes a typed
  path, for modules pkg.go.dev does not list.
- Composer search goes straight to `packagist.org`, but its version list comes through the proxy
  at `PROXY_ORIGIN` (`src/lib/proxy/origin.ts`), and the engine downloads its archives through the
  same origin. A call to the proxy passes that origin to `getJson` / `getText` as the last
  argument, which turns a failed `fetch` into `proxy_unreachable` and an answer with a
  `Diffpack-Proxy-Error` header into a `CodedError` with the proxy's code.
- The engine does its own downloads, keyed by registry id and package name. `downloadUrl` is only
  the link shown beside a version.

Adding a registry touches more than the adapter:

1. The engine has to support it: a release of `diffpack-engine` and a version bump here.
2. If the registry's metadata or archives send no CORS header, the browser cannot read them: add
   routes for them to `diffpack-proxy` (its `docs/contract.md`), have the engine download through
   the origin `set_proxy_origin` gives it, and fetch the adapter's calls from `PROXY_ORIGIN`. Add
   the proxy origin to the registry's `ALLOWED_ORIGINS` in `outboundOrigins.test.ts`, any new
   failure code to `src/lib/failure/failure.ts`, and say in the README's "It runs in your browser"
   that the registry is proxied.
3. The adapter, and its entry in `index.ts`.
4. `buildDiffBootScript` in `src/lib/worker/bootScript.ts`, which restates each registry's
   `packagePath` rule inline (see below).
5. `RegistryId` in `types.ts`, the `--registry-<id>-rgb` accent in `globals.css`, the tile rule in
   `RegistryTile.module.css`, and the README table.
6. Unit tests beside the others in `tests/unit/registries/`, including `outboundOrigins`.

### Failure codes

`src/lib/failure/`. A failure carries a `FailureCode` (`failure.ts`) beside its message: the
engine's codes, the proxy's, and `proxy_unreachable`. `CodedError` is how it is thrown, `failureOf`
reads one back from anything thrown, and an error crosses the worker boundary as its message plus
`code`, `resetsAt` and `status` (`protocol.ts`, `diffWorkerClient.ts`). `isProxyLimit` picks out
`quota_exhausted` and `proxy_unreachable`, for which `DiffWorkspace` shows `ProxyLimitNotice` with
the time Composer comes back (`resetTime.ts`: the proxy's `resetsAt`, or the next 00:00 UTC).
`FAILURE_CODES` restates the codes in the engine's README and the proxy's `docs/contract.md`. A code
missing from it is dropped, and the failure arrives as a bare message.

## The engine and the worker protocol

`src/lib/worker/`. The engine is a `wasm-pack --target web` module that
`diff.worker.ts` initializes once against the `.wasm` URL Vite fingerprints, then calls
`set_proxy_origin(PROXY_ORIGIN)` (`src/lib/proxy/origin.ts`), without which every Composer request
fails with `proxy_not_configured` (`engineReady.ts`: a refused origin leaves the other registries
working, and a failed start is retried on the next message). The engine is excluded from
`optimizeDeps`, and has to stay excluded. Changing how a diff is *computed* is a PR in
`philfreshman/diffpack-engine`, not here; `DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg bun run dev`
tries an unreleased build.

`protocol.ts` holds the wire types. Requests carry an `id`, replies are
`{ id, ok: true, data } | { id, ok: false, error }`:

| Request | Engine call | Notes |
| :--- | :--- | :--- |
| `build-tree` | `prefetch_package` ×2, then `build_diff_tree_for_package` | Downloads both versions, sending `{ id, fetched: { side, failure } }` as each one lands (the viewer's progress box), then returns the `DiffFileEntry` tree and makes this the engine's *active diff*. |
| `get-file` | `get_diff_for_path` | Reads one file out of the active diff. Takes `oldPath` for a rename. |
| `prefetch` | `prefetch_package` ×2 | Warms the download cache. Never touches the active diff. |

A **`Comparison`** is registry, package, from, to *and* `ignoreWhitespace`: whitespace changes which
lines differ, so it is part of the question. `comparisonKey()` is the single definition of "the
same comparison". The session, the client and the boot script all compare through it.

Rules in `diffWorkerClient.ts` that look optional and are not:

- **One worker per document.** The wasm keeps its extraction cache and active-diff pointer in
  module state, so a second worker starts empty and fails every read.
- **Builds and reads go one at a time, through the `lane`.** The worker handles messages
  concurrently and a build replaces the active diff only when it *finishes*, so two builds in
  flight would leave whichever downloaded faster. A build overtaken before it starts is refused
  rather than sent. `prefetch` is outside the lane.
- **A read is refused unless its comparison is the active one** (`active`, cleared when a build
  fails). The engine would otherwise answer from whatever diff it holds.
- **The boot script gets there first.** `buildDiffBootScript` runs inline in `<head>` and parses
  the URL before hydration. It first asks the server's cache (below) and leaves the answer on
  `window.__diffpackEntryBoot`; on a miss, a failure or a timeout it spawns the worker, posts
  `build-tree` and leaves that on `window.__diffpackDiffBoot`, unless the client has marked the
  lookup `abandoned` by asking for another comparison. The clients adopt either only when the
  `comparisonKey` matches, and nothing reaches the worker client before the boot lookup settles. Since the script cannot import
  anything, it restates the registry path rules, the `Comparison` fields and the cache key inline.
  `tests/unit/worker/bootScript.test.ts` runs its output against the real client and against the
  cache-key vectors, so update it together with any change to any of them.

`src/lib/session/diffSession.ts` is the store above the client (TanStack Store). It is told two
things, in either order: what the URL says (`follow`) and the whitespace answer
(`answerWhitespace`). It builds nothing until it has both, drops replies whose `comparisonKey` is no
longer current, and opens the URL's file once the tree is ready.

## The server's cache

`src/lib/cache/`. diffpack-server caches the diffs it computes for AI agents under a `diff_id`,
and the app reuses them. `diffKey.ts` is the key from the server's `docs/cache-key.md`;
`entryLookup.ts` asks `GET https://mcp.diffpack.io/diffs/v1/{diff_id}` (the store is private, so
the server reads it); `cachedDiffClient.ts` sits in front of the worker client with the same
interface and is what the session talks to.

- **A miss must be invisible.** Every way a lookup can go wrong (404, network error, a body that is
  not an entry, an entry for another comparison, 1.5 s without response headers) is a miss, and a miss is
  the worker, which stays the source of truth. A file a cached entry has no patch for is worked out
  by the worker too.
- **Only the `diff_id` leaves the page.** No cookies, no referrer: the page URL names the package.
- **The key only matches when the engines do.** The engine version is part of the key, read from the
  installed `@philfreshman/diffpack-engine`. The app and the server pin it independently, so while
  their pins differ every lookup misses, harmlessly, and an engine bump here moves every key.
- **`fixtures/cache-key-vectors.json` is the server's file, not a copy to edit.** It is byte-identical
  to diffpack-server's at the commit pinned in `scripts/check-cache-key-vectors.ts`, which
  `bun run check:vectors` enforces in CI. To take new vectors, move the pin and re-download.
  `check:vectors:development` compares with the server's development tip as a non-blocking CI step,
  so new vectors there show up as a warning.
  `bun run test:networked` compares keys with the live server's directly.
- The e2e build points the cache at a closed port, so specs other than `cached-diff.spec.ts` always
  miss and keep testing the worker.

## Vulnerabilities (OSV.dev)

`src/lib/vulnerabilities/`. The workspace asks OSV.dev about both versions while the engine builds,
and a failure there never fails the diff. Shared types are in `types.ts`.

- **`osvClient`** (`createOsvClient(fetcher)`): `POST https://api.osv.dev/v1/query` through
  `postJson` in `src/lib/registries/http.ts`, following `next_page_token`. The name and version
  travel only in the JSON body; the URL is a constant. `osvEcosystemOf` (`ecosystem.ts`) maps a
  `RegistryId` to OSV's ecosystem name.
- **`advisoryFrom`** (`advisory.ts`) turns an untrusted record into an `Advisory`. It reads every
  field defensively (`json.ts`), takes `fixedIn` and the hints only from the `affected` entry for
  this package (PyPI names compared normalized), and reads severity from
  `database_specific.severity`. OSV answers one vulnerability under several ids (a `PYSEC-` and
  its `GHSA-`), so `collapseAliases` (`aliases.ts`) folds records that share an id or alias into
  the most severe one.
- **`compareAdvisories`** (`report.ts`) matches the two sides by id and aliases: only in `to` is
  `introduced`, in both `remaining`, only in `from` `fixed`. Entries are ordered by that, then
  severity, then id.
- **Fix commits.** `fixCommitOf` (`fixCommitReference.ts`) accepts only
  `https://github.com/<owner>/<repo>/commit/<sha>` and `…/pull/<n>/commits/<sha>`, with
  `[A-Za-z0-9_.-]+` names that are not all dots and a lowercase hex sha. `fixCommitClient` checks a
  commit again with `isFixCommit` before `GET https://api.github.com/repos/<o>/<r>/commits/<sha>`
  (segments encoded), and splits each file's `patch` into removed and added lines. GitHub allows 60
  unauthenticated requests an hour, so `fixCommitsToLookUp` caps a report at `MAX_FIX_COMMITS`.
  `outboundOrigins.test.ts`'s rule holds here too: a name never builds a URL by resolution.
- **`affectedFiles`** points advisories at tree paths: a Go import's package directory (its `.go`
  files, not `_test.go`), a crate function's module file (`src/<mod>.rs`, `src/<mod>/mod.rs`, or
  the files in `src/<mod>/`, trying shorter module paths), and fix-commit files matched on whole
  trailing path segments. Commit files arrive in a map keyed by `commitKey`; manifests, lockfiles,
  docs and tests are skipped (`isIncidentalFile`). `markLines` (`lineMarks.ts`) finds the lines in a
  file's `DiffLine[]`: definitions of the hinted symbols, and lines equal, whitespace collapsed, to
  a fix commit's removed (old side) or added (new side) lines, as `LineAnchor`s. A snippet only
  counts when it matches at most two lines on its side, and a changed line wins over context.

## The diff pipeline

From the engine's text to rows on screen, all pure functions in `src/lib/diff/`:

1. **`parseUnifiedDiff`**: engine output (`FileDiff { data, isDiff }`) → `DiffLine[]`. The engine
   emits every line, marked, with no `@@` hunks, so line numbers are counted here. The
   `--- from/` / `+++ to/` headers are dropped.
2. **`parseFile`** (`fileModel.ts`): lines plus the language, decided once per file, from the
   extension first and a sampled `highlightAuto` otherwise.
3. **`computeVisibility`**: lines plus the reader's `DiffView` (lines opened by hand,
   expand-all) → `DiffRow[]`: changes, 3 lines of context, and a `collapsed` fold for every
   other run. Each fold carries its `Expander`s and their ranges, so the button does no arithmetic.
4. **`pairSplitRows`**: in split view, the same rows as `SplitRow[]`, with a run of removals set
   opposite the additions that replaced it.
5. **`fileModel`**: all of the above for one view, plus `differences`, the stops the toolbar
   arrows walk.
6. **`rowChange`** (`changes.ts`) is the only rule for whether a row is a change. The arrows and
   the scrollbar minimap both use it, so they cannot disagree.

Supporting modules: `highlight.ts` (cached per line, and a line over 10 000 characters is left
plain), `inlineChange.ts` (the part of a changed line that differs from its partner: the line
minus the start and end the two share, for the pairs `pairSplitRows` sets opposite each other,
worked out once per file in `parseFile`), `markRange.ts` (wraps that part in `<mark>` inside
highlighted HTML, closing and reopening it around highlight.js's `<span>`s), `themeEmphasis.ts`
(each syntax theme's `<mark>` colours: its `.hljs-addition` / `.hljs-deletion` colour read by
`themeColours.ts`, mixed over the row by `emphasis.ts` only as far as no token ends up less readable
than on the default mark, set on the viewer as `--color-*-emphasis`), `highlightThemes.ts` (the offered themes; their stylesheets are resolved in
`highlightStylesheet.ts` from `highlight.js/styles/`, or `public/` for `nightfall.css`),
`viewMemory.ts` (per-file folds and scroll position within a comparison), `scrollbar.ts`
(thumb geometry) and `gutter.ts`. The tree panel's logic is in `src/lib/tree/`. Rows are keyed by
`rowKey` (`type:path`), because one path can be a file in one version and a folder in the other.
Folders opened or shut by hand belong to one comparison (`folders.ts`) and reset on the next.

## Stored settings are a contract

Every preference is declared once in `src/lib/storage/settings.ts` with its key, its parser and
its fallback, built from `flag` / `oneOf` / `clampedInteger` in `storedSetting.ts`. That module is
the only one allowed to touch `localStorage` (a rule-pack rule). Components use `useSetting`;
`<head>` scripts use `readInHead`, which emits the setting's own parser as source.

**The key names and the stored spellings are a compatibility contract with returning visitors.**
Most of them are the old app's (`theme`, `split-view-preference`, `highlight_theme`,
`search_history_<registry>`, …). Renaming a key, changing what it stores or changing the history
cap of 10 silently drops people's choices. `tests/e2e/parity.spec.ts` holds the contract from
outside the page. Add new keys freely; do not change existing ones.

Three scripts run inline in `<head>` before first paint, each for a reason: the diff boot script,
`THEME_SCRIPT` (so there is no theme flash) and `TREE_WIDTH_SCRIPT` (so the sidebar never flashes at
its default width). The theme lands as `data-theme` on `<html>`, which is why `<html>` has
`suppressHydrationWarning`. The sidebar width is the `--tree-panel-width` custom property and shut
is `data-tree-collapsed`, both on `<html>` and moved without a render (`src/lib/tree/sidebar.ts`).

## Code style

- Write self-explaining code in Clean Code style: intention-revealing names, small functions that
  do one thing, named constants and types instead of magic values, and a well-named helper instead
  of a block that needs explaining.
- Add no new comments, doc comments included. If code seems to need one, rename or restructure it
  until it does not. The why behind a change goes in the commit message or the PR description.
- Existing comments, the doc comments in `src/lib/` among them: keep them true when you change the
  code they describe, and delete them once the code makes them redundant.
- The one exception is a reason a tool requires: the explanation after a `biome-ignore` or
  `fallow-ignore`, and the comment beside an entry in `.fallowrc.jsonc` (see `AGENTS.md`).

## CSS conventions

- CSS Modules and custom properties. No Tailwind, no CSS-in-JS.
- A component with styles lives in its own folder with its `.module.css`, so the two move together.
- Name semantic tokens only: `var(--color-foreground)`, `--color-border`, `--space-4`,
  `--control-height`, `--radius-md`, `--duration-fast`, `--z-overlay`. Raw gray ramps and hex
  values belong in `globals.css`. A component never branches on the theme; `:root[data-theme="dark"]`
  redefines the tokens instead. fallow's `css-token-drift`, `css-dead-surface` and
  `css-broken-reference` rules are errors here.
- The diff viewer also switches on `data-syntax` (`light` / `dark`): the chosen highlight.js theme
  brings its own ground, and inside the viewer it wins over the page theme.
- `@media` cannot read custom properties, so breakpoints repeat the literals recorded as
  `--breakpoint-sm/md/lg` (53rem / 63rem / 75rem).
- UI primitives are Base UI, wrapped once in `src/components/ui/` (`Button`, `IconButton`,
  `Combobox`, `Menu`, `Kbd`, `Spinner`, `icons.tsx`). Use the wrappers. `Combobox` is the one
  behind package search and both version selectors.
- Honor `prefers-reduced-motion`, as `globals.css` already does.

## Deployment

Vercel, through the Nitro Vite plugin: `vite build` writes `.vercel/output/` (static assets plus one
server function).

- **Headers, redirects and routing go in `nitro({ routeRules })` in `vite.config.ts`, not
  `vercel.json`.** The build writes its own `.vercel/output/config.json`, so rules in `vercel.json`
  are never read. Check a change with `VERCEL=1 bun run build` and read that file. A route rule
  that matches ends matching, which is why `/assets/**.wasm` repeats the immutable cache header.
- **Only `main` deploys.** Work goes to `development` through PRs, and CI runs there. `main` is
  released by merging `development` into it. There are no preview deployments.
- The `www` → apex redirect is a Vercel domain setting, not repo config.

## Working here

- Picking up a GitHub issue: set it to In Progress.
- Pull the latest `development`, branch from it, and open PRs against it. Keep branch names short
  and named for the change: `feat/…`, `fix/…`.
- Split work into small, independent commits. Conventional Commits, with a scope where one fits:
  `fix(tree): …`, `test(worker): …`, `chore(deps): …`. A commit message is a short imperative
  header, a blank line, and a brief body saying why; the longer explanation goes in the PR
  description.
- Commits and PRs carry no AI attribution: no `Co-Authored-By` trailer, no "Generated with" line.
- After a PR merges: switch to `development`, pull, then delete the merged local branch and its
  worktree.
- Write commit messages, PR descriptions and docs in plain, direct language. When a technical term
  is needed, explain it briefly.
- A behavior fix comes with a test that fails without it: a unit test for anything in `lib`, and
  Playwright for anything that needs the DOM, the worker or the wasm.
- E2e tests use real registries. Only a tree shape no real package has may be stubbed with
  `page.route` (see `tests/e2e/file-tree.spec.ts`), and the real wasm still does the diffing.
- If a change moves the fallow health score, `bun run check:badge` fails in CI. Run `bun run badge`
  and commit the SVG.
