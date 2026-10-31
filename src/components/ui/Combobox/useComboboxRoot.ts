import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";

interface RootOptions<T> {
	inputValue: string;
	onInputValueChange(value: string): void;
	onSelect(item: T): void;
	itemToText(item: T): string;
	onSubmitText?(text: string): void;
	onOpenChange?(open: boolean): void;
}

interface InputValueChangeDetails {
	reason: string;
}

export function useComboboxRoot<T>({
	inputValue,
	onInputValueChange,
	onSelect,
	itemToText,
	onSubmitText,
	onOpenChange,
}: RootOptions<T>) {
	// Base UI handles Enter on a highlighted row; with none, Enter submits the raw text.
	const highlighted = useRef<T | undefined>(undefined);
	// Controlled so focus opens the list: Base UI ignores the click that focuses an input.
	const [open, setOpen] = useState(false);

	const rootProps = {
		open,
		onOpenChange(next: boolean) {
			setOpen(next);
			onOpenChange?.(next);
		},
		onInputValueChange(value: string, details: InputValueChangeDetails) {
			// Base UI's Escape reverts the input; here it only closes the list.
			if (details.reason === "input-clear") return;
			onInputValueChange(value);
		},
		onValueChange(value: unknown) {
			if (value !== null) onSelect(value as T);
		},
		onItemHighlighted(item: unknown) {
			highlighted.current = item as T | undefined;
		},
		itemToStringLabel: (item: unknown) => itemToText(item as T),
		itemToStringValue: (item: unknown) => itemToText(item as T),
	};

	function openList() {
		setOpen(true);
	}

	function submitTypedText(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key !== "Enter" || highlighted.current !== undefined) return;
		const text = inputValue.trim();
		if (text) onSubmitText?.(text);
	}

	return { rootProps, openList, submitTypedText };
}
