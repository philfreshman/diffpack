---
name: ui-component
description: diffpack's design system. Load before creating or restyling any React component, stylesheet or page in src/components or src/routes, so new UI matches the app's spacing, type, radius, colour and motion. Holds the role tokens, the primitives to build from, the rules `tests/unit/styles` enforces, and the screenshot check to run before you are done.
---

# Building UI in diffpack

New UI looks right when it is made of the same decisions as the rest of the app. Those decisions
are already made, once, as **role tokens** in `src/styles/globals.css` and as **primitives** in
`src/components/ui/`. Your job is to pick roles and compose primitives, not to choose numbers.

Work in this order:

1. Find the closest existing component and read it (`src/components/**`). Copy its structure.
2. Build from primitives (below) before writing any CSS.
3. Style what is left with role tokens only. The table says which one.
4. Run `bun test tests/unit/styles` — it fails on any raw value.
5. Look at it: screenshot the gallery and your page in both themes (last section).

## Role tokens

Pick by what the thing *is*, never by how big it should look.

### Type

| Token | Value | Use for |
| :--- | :--- | :--- |
| `--text-body` | 0.875rem | Default for all UI text: labels, inputs, menu items, notices, the diff |
| `--text-caption` | 0.75rem | Secondary metadata: counts, ids, badges, hints, `Kbd` |
| `--text-title` | 1.5rem | A big number or name inside a card (summary stats, registry tile) |
| `--text-display` / `--text-display-hero` | 2.25rem / 3rem | Page titles, through `PageTitle` only |
| `--weight-regular` | 400 | Body |
| `--weight-medium` | 500 | Button labels, links that act like buttons |
| `--weight-strong` | 600 | Field labels, notice titles, section headings, emphasised names, `+`/`−` counts |
| `--weight-display` | 700 | `--font-display` (Miriam Libre) only; it has no 600 |
| `--leading-tight` | 1.2 | Large numbers, ASCII art, anything stacked tightly |
| `--leading-normal` | 1.5 | Wrapped prose |
| `--leading-code` | 23px | A diff line |
| `--tracking-caps` | 0.06em | Uppercase overline labels (with `--text-caption`, `--weight-strong`) |
| `--tracking-display` | -0.025em | Display titles |
| `--font-sans` / `--font-mono` / `--font-display` | | UI / paths, versions, code, ids / landing titles |

There is no heading scale inside the app: a section heading is `--text-body` + `--weight-strong`
in `--color-foreground`; its supporting text is `--text-body` or `--text-caption` in
`--color-muted`.

### Spacing

Use the `--space-*` scale (0.25rem steps), or the role tokens, which say which step to pick:

| Token | Value | Use for |
| :--- | :--- | :--- |
| `--gap-tight` | space-1 | Label above its field, title above its detail, icons in a cluster |
| `--gap-inline` | space-2 | Icon beside its text; items inside one control or row |
| `--gap-stack` | space-3 | Blocks stacked inside one surface; toolbar to viewer |
| `--gap-group` | space-4 | Independent controls in a bar; cards in a list; sections in a panel |
| `--gap-section` | space-8 | Page-level regions; big stats side by side; landing tiles |
| `--padding-control-x` | space-3 | Horizontal padding of inputs, combobox fields, popover items |
| `--padding-button-x` | space-6 | Horizontal padding of a text `Button` |
| `--padding-surface-y` / `-x` | space-3 / space-4 | Inside a panel, notice, card section |
| `--padding-popover` | space-1 | Inside a popover, around its items |
| `--control-height` | 2.25rem | Every input, button, select and toolbar row. Icon buttons are square at this size |

Margins are rare: space siblings with the parent's `gap`. `margin: 0` on `p`, `h*`, `ul` is fine.

### Shape, borders, depth

| Token | Use for |
| :--- | :--- |
| `--radius-control` | Buttons, inputs, tree rows, popover items, toolbar |
| `--radius-surface` | Panels, notices, cards, the diff viewer |
| `--radius-popover` | Floating layers: menus, combobox lists |
| `--radius-tag` | Badges, `<mark>`, the scrollbar thumb |
| `--radius-pill` | Dots, pills, round buttons |
| `--radius-tile` | Landing registry tiles only |
| `--border-width` | Every hairline: `var(--border-width) solid var(--color-border)` |
| `--border-width-accent` | A coloured stripe on one side (severity, notice tone, selected line) |
| `--border-width-strong` | Landing tile outline only |
| `--focus-ring-width` / `--focus-ring-offset` | Every focus ring (below) |
| `--shadow-popover` | Floating layers only. Nothing else in the app has a shadow |
| `--underline-offset` / `--underline-thickness-hover` | Text links |

Nested corners: an item inside a padded popover or segmented group uses the next role down
(`--radius-control` inside `--radius-popover`, `--radius-tag` inside `--radius-control`).

### Colour

Only semantic colour tokens: `--color-foreground`, `--color-muted`, `--color-canvas` (page and
chrome), `--color-background` (fields, toolbar, diff, popovers), `--color-surface` (panels),
`--color-surface-hover`, `--color-selected-surface`, `--color-border`, `--color-input`,
`--color-accent` / `-hover` / `-foreground`, `--color-focus-ring`, `--color-danger`,
`--color-added` / `--color-removed` / `--color-renamed`, `--color-severity-*`, `--registry-*`.

- Text is `--color-foreground` or `--color-muted`. Nothing else, unless it means added, removed,
  renamed, danger or a severity.
- Hover on anything clickable is `background-color: var(--color-surface-hover)`.
- Selected is `--color-selected-surface`; pressed/active toggles are `--color-accent` with
  `--color-accent-foreground`.
- Mixing is fine when both inputs are tokens: `color-mix(in srgb, var(--color-added) 12%, var(--color-background))`.
- Never branch on the theme. `:root[data-theme="dark"]` redefines the tokens. Inside the diff viewer
  `data-syntax` redefines them again, so check both.

### Motion and layers

- `transition: <prop> var(--duration-fast) ease` for hover and state; `--duration-slow` for
  entrances and the landing page; `--duration-instant` for a stagger step.
- Every transition or animation has a `@media (prefers-reduced-motion: reduce)` override.
- `z-index` is `--z-raised` (sticky inside a card), `--z-toolbar`, `--z-overlay` (popovers), or
  `--z-background` / `--z-backdrop`.

## Patterns

Focus ring, on everything focusable:

```css
.thing:focus-visible {
	outline: var(--focus-ring-width) solid var(--color-focus-ring);
	outline-offset: var(--focus-ring-offset);
}
```

Inside a list or a clipped box, inset it: `outline-offset: calc(-1 * var(--focus-ring-width));`.

A field label: `--text-body`, `--weight-strong`, `--color-foreground`, then the control
`--gap-tight` below it. Overline label: `--text-caption`, `--weight-strong`,
`--tracking-caps`, `text-transform: uppercase`.

Disabled: `opacity: 0.4; cursor: default;` for icon buttons; `Button` has its own.

Breakpoints: `@media (min-width: 53rem)` / `63rem` / `75rem` with a `/* --breakpoint-sm */` comment;
`@media` cannot read custom properties.

Inline `style` is for values only known at runtime, passed as a custom property
(`style={{ "--depth": depth }}`) and turned into a length in CSS with tokens.

## Primitives (`src/components/ui/`)

Reach for these first. A wrapper's `className` is for placement (margins, flex), never restyling.

| Primitive | For |
| :--- | :--- |
| `Button` | A text action. `variant="primary"` for the one main action in a view |
| `IconButton` | An icon-only action, with an `aria-label` |
| `Combobox` | Any searchable or selectable list in a field |
| `Menu` | A dropdown of actions |
| `OptionsMenu` | A settings menu with fold-out option lists |
| `Popover/Popover.module.css` | Any floating layer: put `popoverStyles.surface` on the popup and `popoverStyles.item` on each row, joined with the component's own class for what is its own (see `Menu.tsx`) |
| `Panel` | A bordered surface box, for anything that is not a message |
| `Notice` | A message in a panel: `tone="neutral" \| "danger"` (danger adds the stripe), optional `title`, detail as children |
| `NoticeText` | The same title and detail without the panel, for a message inside a surface that already exists |
| `PageTitle` | The one `h1` of a page |
| `Kbd` | A keyboard shortcut hint |
| `Spinner` | Indeterminate loading |
| `RiseIn` | Staggered entrance of list items |
| `icons.tsx` | Every icon. Add new ones here, 16px, `currentColor` |

## The check

`tests/unit/styles/styleTokens.test.ts` reads every `*.module.css` under `src/` and fails on:

- a length other than `0` in spacing, borders, outlines, radius, shadows, type, or a custom
  property;
- a colour literal (hex, `rgb()` with literal channels, a named colour) anywhere;
- a scale token where a role exists: `--text-xs`, `--radius-md`, a raw weight;
- a time literal in a transition or animation; a literal `z-index`;
- a raw `--gray-*` ramp.

A real exception goes in its `ALLOWED` list with a reason. A stale entry fails too. Prefer adding a
role token to `globals.css` over an exception, and only when an existing role does not fit.

## Look at it before you finish

Rules cannot catch "a bit off". A picture beside existing UI can.

```bash
bun run dev &                                  # :4321
bun run screenshot /design --out /tmp/shots    # gallery, light and dark
bun run screenshot /npm/react/18.3.1/19.0.0 --selector "[data-testid='workspace']" --out /tmp/shots
```

`/design` is a dev-only gallery of every primitive and token (`src/routes/design.tsx`). Put your
component there if it is reusable. Open the PNGs with Read and compare yours to its neighbours:
the same text sizes, the same control height, the same gaps, the same border and radius. Fix what
differs, then check again.
