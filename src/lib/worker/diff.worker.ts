import init, {
	build_diff_tree_for_package,
	get_diff_for_path,
	prefetch_package,
	set_proxy_origin,
} from "@philfreshman/diffpack-engine";
import wasmUrl from "@philfreshman/diffpack-engine/diffpack_engine_bg.wasm?url";
import { failureOf } from "#/lib/failure/failure.ts";
import { PROXY_ORIGIN } from "#/lib/proxy/origin.ts";
import { createEngineReady } from "./engineReady.ts";
import {
	type ArchiveSide,
	type Comparison,
	failedReply,
	SIMILARITY_THRESHOLD,
	type WorkerMessage,
	type WorkerRequest,
} from "./protocol.ts";

const engineReady = createEngineReady(
	() => init({ module_or_path: wasmUrl }),
	() => set_proxy_origin(PROXY_ORIGIN),
);

function reply(message: WorkerMessage) {
	self.postMessage(message);
}

type BuildRequest = Comparison & { id: number };

async function fetchArchive(request: BuildRequest, side: ArchiveSide) {
	try {
		await prefetch_package(request.registry, request.pkg, request[side]);
		reply({ id: request.id, fetched: { side, failure: null } });
	} catch (error) {
		reply({ id: request.id, fetched: { side, failure: failureOf(error) } });
		throw error;
	}
}

async function fetchBothArchives(request: BuildRequest) {
	const fetches = await Promise.allSettled([
		fetchArchive(request, "from"),
		fetchArchive(request, "to"),
	]);
	const failed = fetches.find((fetch) => fetch.status === "rejected");
	if (failed) throw failed.reason;
}

async function handle(request: WorkerRequest): Promise<unknown> {
	switch (request.type) {
		case "build-tree":
			await fetchBothArchives(request);
			return await build_diff_tree_for_package(
				request.registry,
				request.pkg,
				request.from,
				request.to,
				SIMILARITY_THRESHOLD,
				request.ignoreWhitespace,
			);
		case "prefetch":
			await Promise.all([
				prefetch_package(request.registry, request.pkg, request.from),
				prefetch_package(request.registry, request.pkg, request.to),
			]);
			return undefined;
		case "get-file":
			return get_diff_for_path(
				request.path,
				request.oldPath,
				request.ignoreWhitespace,
			);
	}
}

// Messages run concurrently; the client's lane keeps builds and reads apart.
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	try {
		await engineReady();
		reply({ id: request.id, ok: true, data: await handle(request) });
	} catch (error) {
		reply(failedReply(request.id, error));
	}
};
