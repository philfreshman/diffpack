import {
	HIGHLIGHT_THEMES,
	stylesheetFile,
} from "#/lib/diff/highlightThemes.ts";
import { themeEmphasis } from "#/lib/diff/themeEmphasis.ts";

const OUTPUT = "src/lib/diff/themeEmphasis.gen.ts";

const entries = await Promise.all(
	HIGHLIGHT_THEMES.map(async (theme) => {
		const css = await Bun.file(stylesheetFile(theme)).text();
		return [theme.value, themeEmphasis(css, theme.appearance)] as const;
	}),
);

await Bun.write(
	OUTPUT,
	`export const THEME_EMPHASIS: Readonly<
	Record<string, { added: string; removed: string }>
> = ${JSON.stringify(Object.fromEntries(entries))};
`,
);
await Bun.spawn(["bunx", "oxfmt", OUTPUT]).exited;
