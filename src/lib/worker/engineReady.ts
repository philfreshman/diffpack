function pointAtProxyIfAccepted(pointAtProxy: () => void): void {
	try {
		pointAtProxy();
	} catch {
		return;
	}
}

export function createEngineReady(
	start: () => Promise<unknown>,
	pointAtProxy: () => void,
): () => Promise<void> {
	let ready: Promise<void> | null = null;

	function forgetFailedStart(error: unknown): never {
		ready = null;
		throw error;
	}

	return function engineReady() {
		ready ??= start().then(
			() => pointAtProxyIfAccepted(pointAtProxy),
			forgetFailedStart,
		);
		return ready;
	};
}
