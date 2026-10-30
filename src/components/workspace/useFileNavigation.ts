import { type RefObject, useEffect, useRef, useState } from "react";
import type { FileStreamHandle } from "#/components/review/FileStream/FileStream.tsx";
import type { SettingControls } from "#/components/storage/useSetting.ts";
import type { FileLayout } from "#/lib/review/fileStream.ts";
import type { DiffSessionState } from "#/lib/session/diffSession.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

interface FileNavigationOptions {
	changed: readonly DiffFileEntry[];
	session: Pick<DiffSessionState, "file">;
	urlPath: string;
	summaryShown: boolean;
	layout: SettingControls<FileLayout>;
	openFile(path: string): void;
	closeFile(): void;
}

export function useFileNavigation({
	changed,
	session,
	urlPath,
	summaryShown,
	layout,
	openFile,
	closeFile,
}: FileNavigationOptions) {
	const streaming = layout.value === "all" && summaryShown;
	const openPath = session.file?.path ?? "";
	const streamRef = useRef<FileStreamHandle>(null);
	const [streamPath, setStreamPath] = useState<string | null>(null);
	const scrollTargetRef = useScrollOnStreamStart(streamRef, streaming);
	const currentPath = streaming ? (streamPath ?? "") : openPath;
	const currentIndex = changed.findIndex((entry) => entry.path === currentPath);

	function stepFile(direction: 1 | -1) {
		if (streaming) {
			streamRef.current?.stepFile(direction);
			return;
		}
		const next = changed[currentIndex + direction];
		if (next) openFile(next.path);
	}

	function showFile(path: string) {
		if (streaming) streamRef.current?.scrollToFile(path);
		else openFile(path);
	}

	function changeLayout(next: FileLayout) {
		layout.set(next);
		if (next === "all" && openPath) {
			scrollTargetRef.current = openPath;
			closeFile();
		}
		if (next === "single" && streaming && streamPath) openFile(streamPath);
	}

	return {
		streaming,
		selectedPath: streaming ? currentPath : urlPath,
		shownLayout: openPath ? "single" : layout.value,
		streamRef,
		currentPath,
		currentIndex,
		onCurrentFileChange: setStreamPath,
		stepFile,
		showFile,
		changeLayout,
	};
}

function useScrollOnStreamStart(
	streamRef: RefObject<FileStreamHandle | null>,
	streaming: boolean,
): RefObject<string | null> {
	const scrollTargetRef = useRef<string | null>(null);

	useEffect(() => {
		const target = scrollTargetRef.current;
		if (!streaming || !target) return;
		scrollTargetRef.current = null;
		streamRef.current?.scrollToFile(target);
	}, [streaming, streamRef]);

	return scrollTargetRef;
}
