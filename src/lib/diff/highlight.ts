import hljs from "highlight.js";
import type { TextRange } from "#/lib/diff/inlineChange.ts";
import { markRange } from "#/lib/diff/markRange.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

const SAMPLE_LINES = 200;
const SAMPLE_CHARS = 20_000;
// `highlightAuto` cost climbs steeply with line length: a minified file
// sampled whole froze the page for ~20s.
const SAMPLE_LINE_CHARS = 400;

// Extension first: guessing from a diff, with both versions interleaved,
// misreads files (express's `package.json` comes out as Perl).
export function detectLanguage(path: string, lines: DiffLine[]): string | null {
	const named = languageFromPath(path);
	if (named) return named;

	const sample = detectionSample(lines);
	if (!sample) return null;

	return hljs.highlightAuto(sample).language ?? null;
}

function languageFromPath(path: string): string | null {
	const name = path.split("/").at(-1) ?? path;
	const dot = name.lastIndexOf(".");
	// A leading dot is a name, not an extension: `.gitignore`.
	if (dot < 1) return null;

	const extension = name.slice(dot + 1).toLowerCase();

	return hljs.getLanguage(extension) ? extension : null;
}

function detectionSample(lines: DiffLine[]): string {
	const sampled: string[] = [];
	let budget = SAMPLE_CHARS;

	for (const [index, line] of lines.entries()) {
		if (index >= SAMPLE_LINES || budget <= 0) break;
		if (!line.content) continue;
		// Cut before adding: a file with no newlines is one huge line.
		const head = line.content.slice(0, Math.min(SAMPLE_LINE_CHARS, budget));
		sampled.push(head);
		budget -= head.length;
	}

	return sampled.join("\n");
}

// Dropped whole when full; an eviction order would cost more than it saves.
const CACHE_LIMIT = 20_000;
const cache = new Map<string, string>();

// Longer lines stay plain: their markup is megabytes of DOM the browser cannot lay out.
const MAX_HIGHLIGHT_CHARS = 10_000;

// Always escaped: the result is inserted as HTML, so archive content must not survive unescaped.
export function highlightLine(
	content: string,
	language: string | null,
	change?: TextRange,
): string {
	if (content.length > MAX_HIGHLIGHT_CHARS) return escapeHtml(content);

	const known = language && hljs.getLanguage(language) ? language : null;
	if (!known && !change) return escapeHtml(content);

	const key = cacheKey(content, known, change);
	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	const markup = highlightOrEscape(content, known);
	const html = change ? markRange(markup, change) : markup;
	if (cache.size >= CACHE_LIMIT) cache.clear();
	cache.set(key, html);

	return html;
}

function cacheKey(
	content: string,
	language: string | null,
	change: TextRange | undefined,
): string {
	const range = change ? `${change.start}-${change.end}` : "";

	return `${language ?? ""} ${range} ${content}`;
}

function highlightOrEscape(content: string, language: string | null): string {
	if (!language) return escapeHtml(content);

	return hljs.highlight(content, { language, ignoreIllegals: true }).value;
}

function escapeHtml(content: string): string {
	return content
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
