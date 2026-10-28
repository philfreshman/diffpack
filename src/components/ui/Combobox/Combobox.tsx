import { Combobox as Base } from "@base-ui/react/combobox";
import { type ReactNode, type Ref, useRef, useState } from "react";
import { useHydrated } from "#/components/lifecycle/useHydrated.ts";
import styles from "./Combobox.module.css";

export interface ComboboxProps<T> {
	label: string;
	items: readonly T[];
	inputValue: string;
	onInputValueChange(value: string): void;
	onSelect(item: T): void;
	itemToText(item: T): string;
	renderItem?(item: T): ReactNode;
	/** Enter with nothing highlighted; omit when only listed items are valid. */
	onSubmitText?(text: string): void;
	/** Substring match by default; `null` when the items arrive already filtered. */
	filter?: null | ((item: T, query: string) => boolean);
	loading?: boolean;
	loadingMessage?: string;
	emptyMessage?: string;
	placeholder?: string;
	disabled?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
	inputRef?: Ref<HTMLInputElement>;
	keyShortcut?: string;
	onOpenChange?(open: boolean): void;
}

function substringFilter(text: string, query: string): boolean {
	return text.toLowerCase().includes(query.toLowerCase());
}

function resolveFilter<T>(
	filter: ComboboxProps<T>["filter"],
	itemToText: (item: T) => string,
) {
	if (filter === null) return null;
	if (filter) return (item: unknown, query: string) => filter(item as T, query);

	return (item: unknown, query: string) =>
		substringFilter(itemToText(item as T), query);
}

export function Combobox<T>({
	label,
	items,
	inputValue,
	onInputValueChange,
	onSelect,
	itemToText,
	renderItem,
	onSubmitText,
	filter,
	loading = false,
	loadingMessage = "Loading…",
	emptyMessage = "No matches",
	placeholder,
	disabled = false,
	leading,
	trailing,
	inputRef,
	keyShortcut,
	onOpenChange,
}: ComboboxProps<T>) {
	// Base UI handles Enter on a highlighted row; with none, Enter submits the raw text.
	const highlighted = useRef<T | undefined>(undefined);
	// Controlled so focus opens the list: Base UI ignores the click that focuses an input.
	const [open, setOpen] = useState(false);
	// `data-ready` marks hydration; input before it hits a dead field, so tests wait on it.
	const ready = useHydrated();

	return (
		<Base.Root
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				onOpenChange?.(next);
			}}
			items={items as T[]}
			inputValue={inputValue}
			onInputValueChange={(value, details) => {
				// Base UI's Escape reverts the input; here it only closes the list.
				if (details.reason === "input-clear") return;
				onInputValueChange(value);
			}}
			onValueChange={(value) => {
				if (value !== null) onSelect(value as T);
			}}
			onItemHighlighted={(item) => {
				highlighted.current = item as T | undefined;
			}}
			itemToStringLabel={(item) => itemToText(item as T)}
			itemToStringValue={(item) => itemToText(item as T)}
			filter={resolveFilter(filter, itemToText)}
			openOnInputClick
			loopFocus
			disabled={disabled}
		>
			<div
				className={styles.field}
				data-ready={ready ? "" : undefined}
				data-leading={Boolean(leading)}
			>
				<span className={styles.leading}>{leading}</span>
				<Base.Input
					ref={inputRef}
					className={`${styles.surface} ${styles.input}`}
					aria-label={label}
					aria-keyshortcuts={keyShortcut}
					placeholder={placeholder}
					onFocus={() => setOpen(true)}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || highlighted.current !== undefined) {
							return;
						}
						const text = inputValue.trim();
						if (text) onSubmitText?.(text);
					}}
				/>
				{trailing ? <span className={styles.trailing}>{trailing}</span> : null}
			</div>

			<Base.Portal>
				<Base.Positioner className={styles.positioner} sideOffset={4}>
					<Base.Popup className={styles.popup}>
						{loading ? (
							<p className={styles.status} role="status">
								{loadingMessage}
							</p>
						) : (
							<>
								<Base.Empty className={styles.status}>
									{emptyMessage}
								</Base.Empty>
								<Base.List className={styles.list}>
									{(item: T) => (
										<Base.Item
											className={styles.item}
											key={itemToText(item)}
											value={item}
										>
											{renderItem ? renderItem(item) : itemToText(item)}
										</Base.Item>
									)}
								</Base.List>
							</>
						)}
					</Base.Popup>
				</Base.Positioner>
			</Base.Portal>
		</Base.Root>
	);
}
