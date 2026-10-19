export function bodyArrivingAfter(
	delayMs: number,
	text: string,
	signal: AbortSignal | null | undefined,
): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			signal?.addEventListener("abort", () => controller.error(signal.reason));
			setTimeout(() => {
				controller.enqueue(new TextEncoder().encode(text));
				controller.close();
			}, delayMs);
		},
	});
}
