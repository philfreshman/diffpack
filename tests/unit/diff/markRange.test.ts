import { describe, expect, test } from "bun:test";
import { highlightLine } from "#/lib/diff/highlight.ts";
import { markRange } from "#/lib/diff/markRange.ts";

describe("markRange inside a line", () => {
	test("marks the changed characters of a plain escaped line", () => {
		expect(markRange("a &lt; b", { start: 2, end: 3 })).toBe(
			"a <mark>&lt;</mark> b",
		);
	});

	test("counts each entity as one character and wraps the range in a single mark", () => {
		expect(markRange("&quot;x&quot; &amp; &#x27;y", { start: 1, end: 3 })).toBe(
			"&quot;<mark>x&quot;</mark> &amp; &#x27;y",
		);
		expect(markRange("&quot;x&quot; &amp; &#x27;y", { start: 7, end: 8 })).toBe(
			"&quot;x&quot; &amp; &#x27;<mark>y</mark>",
		);
	});

	test("closes the mark around span tags inside the range so nesting stays valid", () => {
		const marked = markRange('<span class="a">ab</span>cd', {
			start: 1,
			end: 3,
		});

		expect(marked).toBe(
			'<span class="a">a<mark>b</mark></span><mark>c</mark>d',
		);
		expect(isWellNested(marked)).toBe(true);
	});

	test("marks a range spanning several highlight.js tokens", () => {
		const html = highlightLine('"version": "4.18.2",', "json");

		const marked = markRange(html, { start: 5, end: 14 });

		expect(marked).toBe(
			'<span class="hljs-attr">&quot;vers<mark>ion&quot;</mark></span>' +
				'<span class="hljs-punctuation"><mark>:</mark></span><mark> </mark>' +
				'<span class="hljs-string"><mark>&quot;4.</mark>18.2&quot;</span>' +
				'<span class="hljs-punctuation">,</span>',
		);
		expect(isWellNested(marked)).toBe(true);
	});
});

describe("markRange at the edges of a line", () => {
	test("leaves the line untouched when the range is empty", () => {
		const html = '<span class="a">a &amp; b</span>';

		expect(markRange(html, { start: 2, end: 2 })).toBe(html);
	});

	test("marks a range at the very start of the line", () => {
		expect(markRange('<span class="a">ab</span>c', { start: 0, end: 1 })).toBe(
			'<span class="a"><mark>a</mark>b</span>c',
		);
	});

	test("marks a range at the very end of the line", () => {
		expect(
			markRange('a<span class="b">b&gt;</span>', { start: 1, end: 3 }),
		).toBe('a<span class="b"><mark>b&gt;</mark></span>');
		expect(markRange("ab&amp;", { start: 1, end: 3 })).toBe(
			"a<mark>b&amp;</mark>",
		);
	});

	test("finishes on an unterminated entity or tag", () => {
		expect(markRange("a & b", { start: 2, end: 3 })).toBe("a <mark>&</mark> b");
		expect(markRange("a <b", { start: 0, end: 1 })).toBe("<mark>a</mark> <b");
	});
});

function isWellNested(html: string): boolean {
	const open: string[] = [];
	for (const [, closing, name] of html.matchAll(/<(\/?)(\w+)[^>]*>/g)) {
		if (!closing) open.push(name ?? "");
		else if (open.pop() !== name) return false;
	}
	return open.length === 0;
}
