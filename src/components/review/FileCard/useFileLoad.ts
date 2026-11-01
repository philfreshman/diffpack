import { useEffect, useEffectEvent, useRef, useState } from "react";
import { type ParsedFile, parseFile } from "#/lib/diff/fileModel.ts";
import { failureOf } from "#/lib/failure/failure.ts";
import type { DiffFileEntry, FileDiff } from "#/lib/worker/protocol.ts";

export type FileLoad =
	| { state: "idle" }
	| { state: "loading" }
	| { state: "ready"; file: ParsedFile }
	| { state: "error"; message: string };

const IDLE: FileLoad = { state: "idle" };
const LOADING: FileLoad = { state: "loading" };

const SETTLE_MS = 120;

export function useFileLoad(
	entry: DiffFileEntry,
	readFile: (entry: DiffFileEntry) => Promise<FileDiff>,
	wanted: boolean,
): { load: FileLoad; retry(): void } {
	const [load, setLoad] = useState<FileLoad>(IDLE);
	const mountedRef = useRef(true);
	const idle = load.state === "idle";

	const start = useEffectEvent(() => {
		setLoad(LOADING);
		readFile(entry).then(
			(diff) => {
				if (mountedRef.current) {
					setLoad({ state: "ready", file: parseFile(entry.path, diff) });
				}
			},
			(error: unknown) => {
				if (mountedRef.current) {
					setLoad({ state: "error", message: failureOf(error).message });
				}
			},
		);
	});

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!wanted || !idle) return;
		const timer = setTimeout(start, SETTLE_MS);

		return () => clearTimeout(timer);
	}, [wanted, idle]);

	return { load, retry: () => setLoad(IDLE) };
}
