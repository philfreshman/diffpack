export type Declaration = {
	line: number;
	property: string;
	value: string;
};

const COMMENT = /\/\*[\s\S]*?\*\//g;
const PROPERTY_NAME = /^(--[\w-]+|-?[a-zA-Z][\w-]*)$/;
const DECLARATION_ENDS = new Set([";", "}"]);
const SEGMENT_ENDS = new Set(["{", ";", "}"]);

export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function parseDeclarations(css: string): Declaration[] {
	const source = blankComments(css);
	const declarations: Declaration[] = [];
	let segmentStart = 0;

	for (const end of segmentEnds(source)) {
		const declaration = DECLARATION_ENDS.has(source[end] ?? "")
			? declarationIn(source, segmentStart, end)
			: undefined;
		if (declaration) declarations.push(declaration);
		segmentStart = end + 1;
	}

	return declarations;
}

function blankComments(css: string): string {
	return css.replace(COMMENT, (comment) => comment.replace(/[^\n]/g, " "));
}

function* segmentEnds(source: string): Generator<number> {
	let quote: string | undefined;
	let parenDepth = 0;

	for (let index = 0; index < source.length; index++) {
		const char = source[index] ?? "";
		if (quote) {
			if (char === "\\") index++;
			else if (char === quote) quote = undefined;
		} else if (char === '"' || char === "'") quote = char;
		else if (char === "(") parenDepth++;
		else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
		else if (parenDepth === 0 && SEGMENT_ENDS.has(char)) yield index;
	}
}

function declarationIn(
	source: string,
	start: number,
	end: number,
): Declaration | undefined {
	const segment = source.slice(start, end);
	const colon = segment.indexOf(":");
	if (colon < 0) return undefined;

	const name = segment.slice(0, colon).trim();
	if (!PROPERTY_NAME.test(name)) return undefined;

	const leadingWhitespace = segment.length - segment.trimStart().length;
	return {
		line: lineAt(source, start + leadingWhitespace),
		property: name.startsWith("--") ? name : name.toLowerCase(),
		value: normalizeWhitespace(segment.slice(colon + 1)),
	};
}

function lineAt(source: string, index: number): number {
	return source.slice(0, index).split("\n").length;
}
