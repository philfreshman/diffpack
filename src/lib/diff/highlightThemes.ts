import type { ResolvedTheme } from "#/lib/theme.ts";

export interface HighlightTheme {
	/** Persisted in the old app's spelling (inconsistent `base16/` prefix): do not change. */
	value: string;
	label: string;
	/** A path under `highlight.js/styles/`, or an absolute URL under `public/`. */
	asset: string;
	/** The `.hljs` background's ground; a unit test checks it against the stylesheet. */
	appearance: HighlightAppearance;
}

export type HighlightAppearance = ResolvedTheme;

export const HIGHLIGHT_THEMES: readonly HighlightTheme[] = [
	{
		value: "base16/3024",
		label: "3024",
		asset: "base16/3024.css",
		appearance: "dark",
	},
	{
		value: "atom-one-dark",
		label: "Atom One Dark",
		asset: "atom-one-dark.css",
		appearance: "dark",
	},
	{
		value: "atom-one-light",
		label: "Atom One Light",
		asset: "atom-one-light.css",
		appearance: "light",
	},
	{
		value: "default",
		label: "Default",
		asset: "default.css",
		appearance: "light",
	},
	{
		value: "base16/dracula",
		label: "Dracula",
		asset: "base16/dracula.css",
		appearance: "dark",
	},
	{
		value: "base16/github",
		label: "GitHub",
		asset: "base16/github.css",
		appearance: "light",
	},
	{
		value: "github-dark",
		label: "GitHub Dark",
		asset: "github-dark.css",
		appearance: "dark",
	},
	{
		value: "github-dark-dimmed",
		label: "GitHub Dark Dimmed",
		asset: "github-dark-dimmed.css",
		appearance: "dark",
	},
	{
		value: "material",
		label: "Material",
		asset: "base16/material.css",
		appearance: "dark",
	},
	{
		value: "monokai",
		label: "Monokai",
		asset: "monokai.css",
		appearance: "dark",
	},
	{
		value: "monokai-sublime",
		label: "Monokai Sublime",
		asset: "monokai-sublime.css",
		appearance: "dark",
	},
	{
		value: "night-owl",
		label: "Night Owl",
		asset: "night-owl.css",
		appearance: "dark",
	},
	{
		value: "nightfall",
		label: "Nightfall",
		asset: "/nightfall.css",
		appearance: "dark",
	},
	{ value: "nord", label: "Nord", asset: "nord.css", appearance: "dark" },
	{
		value: "onedark",
		label: "One Dark",
		asset: "base16/onedark.css",
		appearance: "dark",
	},
	{
		value: "stackoverflow-dark",
		label: "Stack Overflow Dark",
		asset: "stackoverflow-dark.css",
		appearance: "dark",
	},
	{
		value: "stackoverflow-light",
		label: "Stack Overflow Light",
		asset: "stackoverflow-light.css",
		appearance: "light",
	},
	{
		value: "solarized-light",
		label: "Solarized Light",
		asset: "base16/solarized-light.css",
		appearance: "light",
	},
	{
		value: "solarized-dark",
		label: "Solarized Dark",
		asset: "base16/solarized-dark.css",
		appearance: "dark",
	},
	{
		value: "tokyo-night-dark",
		label: "Tokyo Night Dark",
		asset: "tokyo-night-dark.css",
		appearance: "dark",
	},
	{ value: "vs", label: "VS", asset: "vs.css", appearance: "light" },
	{
		value: "vs2015",
		label: "VS 2015",
		asset: "vs2015.css",
		appearance: "dark",
	},
	// Named for the era, not the ground: its `.hljs` background is black.
	{
		value: "windows-95",
		label: "Windows 95",
		asset: "base16/windows-95.css",
		appearance: "dark",
	},
];

export function defaultHighlightTheme(theme: ResolvedTheme): string {
	return theme === "dark" ? "github-dark" : "base16/github";
}

// The viewer's surfaces follow this, not the page theme: a light theme on a
// dark page otherwise left syntax colours illegible on half the lines (#139).
export function highlightAppearance(
	value: string | null,
): HighlightAppearance | null {
	return HIGHLIGHT_THEMES.find((it) => it.value === value)?.appearance ?? null;
}

export function stylesheetFile({ asset }: HighlightTheme): string {
	return asset.startsWith("/")
		? `public${asset}`
		: `node_modules/highlight.js/styles/${asset}`;
}
