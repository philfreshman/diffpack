import type { TextRange } from "#/lib/diff/inlineChange.ts";

const TAG_START = "<";
const TAG_END = ">";
const ENTITY_START = "&";
const ENTITY_END = ";";
const MARK_OPEN = "<mark>";
const MARK_CLOSE = "</mark>";

export function markRange(html: string, range: TextRange): string {
	let marked = "";
	let copiedUpTo = 0;
	let markOpen = false;
	let textOffset = 0;
	let index = 0;

	const insertAt = (position: number, tag: string) => {
		marked += html.slice(copiedUpTo, position) + tag;
		copiedUpTo = position;
	};

	while (index < html.length) {
		const isTag = html[index] === TAG_START;
		const markWanted = !isTag && covers(range, textOffset);
		if (markWanted !== markOpen) {
			insertAt(index, markOpen ? MARK_CLOSE : MARK_OPEN);
			markOpen = markWanted;
		}
		if (isTag) {
			index = after(html, index, TAG_END);
		} else {
			index = endOfCharacter(html, index);
			textOffset += 1;
		}
	}
	if (markOpen) insertAt(html.length, MARK_CLOSE);

	return marked + html.slice(copiedUpTo);
}

function covers(range: TextRange, offset: number): boolean {
	return offset >= range.start && offset < range.end;
}

function endOfCharacter(html: string, index: number): number {
	if (html[index] !== ENTITY_START) return index + 1;
	return after(html, index, ENTITY_END);
}

function after(html: string, index: number, terminator: string): number {
	const found = html.indexOf(terminator, index);
	return found === -1 ? index + 1 : found + 1;
}
