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

Needs [Bun](https://bun.sh), plus a Rust toolchain with the `wasm32-unknown-unknown` target if you
intend to touch the engine.

```bash
bun install
bun run build:wasm   # required once — the app will not start without it
bun run dev          # http://localhost:4321
```

`build:wasm` compiles `wasm/diff-wasm` into `wasm/diff-wasm/pkg/`, which is generated, gitignored
and **not** a package.json dependency: the `diff-wasm` specifier resolves through `tsconfig.json`
paths and a Vite alias. `bun run dev` never rebuilds it — after editing `wasm/diff-wasm/src`,
re-run `build:wasm` and restart the dev server.

<br>

### Scripts

| | |
| :-- | :-- |
| `bun run dev` | Vite dev server on `:4321` |
| `bun run build` | `build:wasm` + `vite build` |
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
| **Engine** | Rust → WebAssembly (`wasm-pack --target web`) for extraction and diffing |
| **Tooling** | [Biome](https://biomejs.dev), [fallow](https://fallow.tools) |

<br>

<details>
<summary><b>Deployment</b> — Vercel, and two things to know before editing deploy config</summary>

<br>

Vercel via the [Nitro](https://nitro.build) Vite plugin: `vite build` writes a Build Output API v3
tree to `.vercel/output/` — static assets plus one server function — which Vercel serves as-is.

**Routing and headers belong in `nitro({ routeRules })` in `vite.config.ts`, not `vercel.json`.**
A build that writes `.vercel/output/config.json` brings its own routing table, so rules left in
`vercel.json` are read by nobody. What `vercel.json` still carries is the build itself: the install
command (which adds the Rust wasm target and compiles the module) and the build command. Confirm a
change landed by reading `.vercel/output/config.json` after `VERCEL=1 bun run build`.

**The `www.diffpack.io` → `diffpack.io` redirect is a domain setting in the Vercel project**, not
something this repo configures — `routeRules` match on path, not host.

</details>

<br>

<div align="center">
<sub>Contributions welcome — start at <a href="CONTRIBUTING.md">CONTRIBUTING.md</a>.</sub>
</div>
