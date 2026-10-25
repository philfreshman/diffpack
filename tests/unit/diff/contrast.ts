import type { Rgb } from "#/lib/diff/colour.ts";

function channelLuminance(channel: number): number {
	const fraction = channel / 255;

	return fraction <= 0.04045
		? fraction / 12.92
		: ((fraction + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgb): number {
	return (
		0.2126 * channelLuminance(r) +
		0.7152 * channelLuminance(g) +
		0.0722 * channelLuminance(b)
	);
}

export function contrast(first: Rgb, second: Rgb): number {
	const [lighter, darker] = [luminance(first), luminance(second)].sort(
		(a, b) => b - a,
	);

	return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
