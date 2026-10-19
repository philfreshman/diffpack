# Security candidates

`bunx fallow security` reports **candidates for verification, not vulnerabilities**. It matches
syntactic sink sites against a CWE catalogue and asks a human whether attacker-controlled input can
reach one. It is an opt-in surface: its findings never appear under bare `fallow` or in the `audit`
gate, so nothing on this page has ever blocked a commit.

That property cuts both ways — a backlog nobody gates on is a backlog nobody rereads. So the
arrangement here is:

- **The nine candidates standing on `development` are triaged below, once, with the evidence.**
  A tenth row records a candidate that has since been closed.
- **CI fails a pull request that makes a *new* one runtime-reachable**
  (`fallow security --gate newly-reachable`, in the `fallow audit (PR gate)` job). There is
  deliberately no `--gate all` mode in fallow; gating on the whole backlog is the anti-feature it
  avoids.

The gate is `newly-reachable` rather than `new`, and the reason is on this page. `--gate new` fires
on any candidate appearing on a changed line, **including an existing sink whose ranking moved** —
which is exactly what adding the origin-confinement test below did to rows 1 and 2. It went red on
the file that closed the finding. `newly-reachable` asks whether a candidate became reachable from
an entry point in head that was not reachable in base: a genuinely new sink does, and a re-ranked
existing one does not. Verified both ways with a probe `dangerouslySetInnerHTML` in `NotFound.tsx`,
which fails the gate.

So this page is the record of what was decided, and the gate is what keeps the page complete. When
a PR fails the security gate, either fix the sink or add a row here.

Re-run the review with:

```bash
bunx fallow security
```

## Triage, as of fallow 3.21.0 on 2026-10-19

| # | Site | Category | Verdict |
| :--- | :--- | :--- | :--- |
| 1 | `src/lib/registries/http.ts:77` | SSRF (CWE-918) | **guarded — asserted by test** |
| 2 | `src/lib/registries/http.ts:88` | SSRF (CWE-918) | **guarded — asserted by test** |
| 3 | `src/components/diff/DiffRow/DiffRow.tsx:39` | XSS (CWE-79) | **guarded — asserted by test** |
| 4 | `src/components/diff/SplitDiffRow/SplitDiffRow.tsx:57` | XSS (CWE-79) | **guarded — asserted by test** |
| 5 | `src/routes/__root.tsx:87` | XSS (CWE-79) | **not attacker-reachable** |
| 6 | `src/routes/__root.tsx:89` | XSS (CWE-79) | **not attacker-reachable** |
| 7 | `src/routes/__root.tsx:91` | XSS (CWE-79) | **not attacker-reachable** |
| 8 | `src/routes/__root.tsx:94` | XSS (CWE-79) | **not attacker-reachable** |
| 9 | `scripts/check-cache-key-vectors.ts:10` | SSRF (CWE-918) | **not attacker-reachable — CI script** |
| 10 | `scripts/check-wasm-types.mjs:35` | Path traversal (CWE-22) | **closed — file deleted** |

### 1–2 · Non-literal URL passed to `request()`

`getJson` and `getText` both hand `request()` a URL string they did not build. Blast radius 45 —
the widest in the report — because every registry adapter goes through them.

The question is whether a package name can steer the destination **host**. It cannot, and the
reason is structural rather than incidental: every URL in this layer is a constant absolute origin
with the name appended to its path.

```ts
`${REGISTRY_URL}/${encodeURIComponent(name)}`     // npm, crates, pypi
`${PROXY_URL}/${escapeModulePath(name)}/@v/list`  // go
`${proxyOrigin}/v1/composer/p2/${encodedName(name)}.json`  // composer
```

A relative path cannot introduce a new authority, however hostile it is. `../../evil.example`
normalizes away inside the same origin; `//evil.example` becomes a path beginning with two slashes,
not a host; `https://evil.example/pkg` becomes a path segment that happens to contain a colon.
Three of the five adapters additionally `encodeURIComponent` the name, so it cannot even leave its
segment. Composer encodes the vendor and the package separately, and refuses any name that is not
`vendor/package` before building a URL. Go does not encode, because a module path legitimately
contains slashes.

Composer has two origins, both constant. `https://packagist.org` answers search and is the link
shown beside a version. The proxy origin, `PROXY_ORIGIN` in
`src/lib/proxy/origin.ts`, answers the version list: it is
`https://diffpack-proxy.philipswiezak.workers.dev` unless `VITE_DIFFPACK_PROXY_ORIGIN` names another
at build time, so no request data can choose it. The version list is the only Composer URL that
puts the name in its path, and it is safe for the same reason as the others: the name must
first match Packagist's own `vendor/package` pattern (lower-case letters, digits, `.`, `_`, `-`,
and one slash), and then each of its two segments is encoded on its own. A second slash, a `..` or a
`%` never reaches the URL.

**What would break it** is assembling one of these URLs differently — `new URL(name, BASE)` reads
almost the same and *does* let a name replace the base outright. So the property is asserted rather
than argued: `tests/unit/registries/outboundOrigins.test.ts` drives every adapter's `search`,
`versions` and `downloadUrl` with names crafted to escape, and fails unless every recorded request
lands on that registry's own origin. It also fails unless the hostile names reach every origin a
registry allows, so the Composer version list is checked with a hostile name that passes the
`vendor/package` check (`evil.example/x`), rather than skipped because every name was refused first.

One consequence worth knowing before it confuses somebody: **adding that test raised fallow's own
severity for these two rows from `low` to `medium`.** Its taint model reads the spec as a module
that receives untrusted input — it is full of strings shaped like hostile URLs — and traces it two
import hops into the sink. The finding did not get worse; the file that proves it is safe got
counted as evidence that something hostile can reach it. Rank accordingly.

That escalation is also why the CI gate is `newly-reachable` and not `new`: it tripped `--gate new`
on the pull request that added the test.

Note that this covers the TypeScript layer only — search, version lists and download links. Package
*content* is fetched by the Rust module ([`src/package.rs`](https://github.com/philfreshman/diffpack-engine/blob/main/src/package.rs) in diffpack-engine), which builds its URLs the
same way and is outside every JavaScript analysis. For Composer it fetches through the same proxy
origin, and the proxy serves only archives that Packagist lists for the named package
([diffpack-proxy](https://github.com/philfreshman/diffpack-proxy)), so a name cannot steer it to any
archive Packagist does not list.

### 3–4 · `dangerouslySetInnerHTML` in the diff rows

The input here is genuinely attacker-controlled in the strongest sense available: it is arbitrary
source text out of an npm, PyPI, crates.io, Go or Composer archive, so anyone who can publish a package can
choose it. A diff viewer that renders `<img onerror=…>` from a package's own source would be
trivially exploitable.

`highlightLine` (`src/lib/diff/highlight.ts`) is the only thing between that text and the DOM.
highlight.js escapes its own output, and the fallback path escapes what it does not mark up. That
guarantee is a dependency's promise, so it is pinned by test rather than assumed —
`tests/unit/diff/highlight.test.ts` asserts escaping on the fallback path, on the path where
highlight.js really does mark the line up, and on a line too long to highlight (#137).

### 5 · The diff boot script in the document head

`DIFF_BOOT_SCRIPT` is `buildDiffBootScript(diffWorkerUrl)` (`src/lib/worker/bootScript.ts`), built
once when the module loads, not per request. Everything it interpolates is fixed at build time:
the registry ids, the Go version pattern's source, the worker's fingerprinted asset URL, the
installed engine version, the cache schema and similarity threshold, the 1.5 s timeout, the cache
origin (`VITE_DIFFPACK_CACHE_ORIGIN` at build time, else `https://mcp.diffpack.io`), the names of
the two `window` globals it leaves its result on, and the `ignore-whitespace-preference` parser,
which `readInHead` emits as source and which only ever yields `true` or `false`. Strings go in
through `JSON.stringify`, except the two global names, which are constant identifiers; numbers go
in as they are. None of them contains `<`, so none can close the `<script>` element early.

The script does read untrusted input, but only after it is in the page and only as data. It splits
`location.pathname` into a registry, a package and two versions, then uses them three ways: it
compares them against constants, posts them to the worker as a `build-tree` message, and hashes
them with SHA-256 into the `diff_id` it asks the cache for. It never writes them into the DOM and
never evaluates them. The cache request goes to the constant origin with only the hex digest in its
path, `credentials: "omit"` and no referrer, so the URL cannot steer it to another host either.

A cache hit carries text from the server, but the script only hands it on. The app renders a cached
patch through the same diff rows as the worker's, so it gets the escaping that rows 3–4 assert.

It is inline for the same reason as the next three: it has to start the engine before hydration.

### 6–8 · Inline `<script>` for theme, tree width and analytics

`THEME_SCRIPT`, `TREE_WIDTH_SCRIPT` and `GA_SCRIPT` are module-level template literals built from
two kinds of constant. One is `JSON.stringify` of other module constants: two theme colors, the
tree width's custom property and the collapsed attribute's name, a measurement ID. The other is the
parser `readInHead` emits as source for a stored setting (theme, tree width, tree collapsed), with
its storage key passed through `JSON.stringify`. No request data, route param or user input reaches
any of them, and they are fully determined at build time.

At run time the first two read `localStorage`, which is the visitor's own and not attacker input,
and even so the parsers only let through one of the offered themes, an integer clamped to
220–640, or `true` or `false`. The result goes into the page through `setAttribute` and
`style.setProperty`, never as markup.

They are inline because they have to be: the first two run before the first paint to set
`data-theme` and the tree width, which is what stops the page rendering in one theme and flipping;
the third is gtag.js's bootstrap queue, which must exist before the async library lands.

### 9 · `fetch()` in `check-cache-key-vectors.ts`

The script backs `bun run check:vectors`: it downloads diffpack-server's
`fixtures/cache-key-vectors.json` and fails unless ours is byte-identical. The URL is
`https://raw.githubusercontent.com/philfreshman/diffpack-server/${serverRef}/${VECTORS_PATH}`,
non-literal only because `serverRef` is the first command-line argument, or the pinned commit
without one.

The host is fixed before the argument appears: the authority ends at the first `/`, so a ref can
change only the path on `raw.githubusercontent.com`. And the argument is not untrusted: CI runs the
two `package.json` scripts, which pass nothing or the literal `development`, and anyone else who
passes a ref is the person running the script on their own machine. The script is not part of the
app, so fallow puts its blast radius at 0. What it downloads is compared byte for byte and then
dropped. It is never written, parsed or run.

### 10 · `path.join()` in `check-wasm-types.mjs` — closed

The script is gone. It guarded a hand-written TypeScript declaration against the one wasm-pack
generates, and both went away when the engine moved to
[its own repository](https://github.com/philfreshman/diffpack-engine) and started shipping its real
declarations in the published package. The row is kept so a reader of an older report can see what
became of the candidate rather than wondering whether it was ever triaged.

It was never reachable in any case: `file` was one of two module-level string constants, the script
took no arguments and read no environment, and fallow put its blast radius at 0.

## Blind spots

The report ends with a note that ~1600 call sites use patterns it could not resolve (dynamic
dispatch, computed members, aliased bindings). Almost all are dynamic dispatch, and the ten files
with the most are all tests: eight Playwright specs in `tests/e2e/`, led by `file-tree.spec.ts`,
and two unit tests. That is expected for test code and is not a finding. `bunx fallow security
--format json` lists those files under `unresolved_callee_diagnostics.top_files`;
`bunx fallow security blind-spots` groups only a small sample of sites, so it is not the way to
see where they are.
