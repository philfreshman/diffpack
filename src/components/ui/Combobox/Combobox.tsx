import { Combobox as Base } from "@base-ui/react/combobox";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import { useHydrated } from "#/components/lifecycle/useHydrated.ts";
import styles from "./Combobox.module.css";
import { useComboboxRoot } from "./useComboboxRoot.ts";

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
	const { rootProps, openList, submitTypedText } = useComboboxRoot({
		inputValue,
		onInputValueChange,
		onSelect,
		itemToText,
		onSubmitText,
		onOpenChange,
	});

	return (
		<Base.Root
			{...rootProps}
			items={items as T[]}
			inputValue={inputValue}
			filter={resolveFilter(filter, itemToText)}
			openOnInputClick
			loopFocus
			disabled={disabled}
		>
			<ComboboxField
				label={label}
				placeholder={placeholder}
				leading={leading}
				trailing={trailing}
				inputRef={inputRef}
				keyShortcut={keyShortcut}
				onFocus={openList}
				onKeyDown={submitTypedText}
			/>
			<ComboboxPopup
				loading={loading}
				loadingMessage={loadingMessage}
				emptyMessage={emptyMessage}
				itemToText={itemToText}
				renderItem={renderItem}
			/>
		</Base.Root>
	);
}

interface ComboboxFieldProps {
	label: string;
	placeholder: string | undefined;
	leading: ReactNode;
	trailing: ReactNode;
	inputRef: Ref<HTMLInputElement> | undefined;
	keyShortcut: string | undefined;
	onFocus(): void;
	onKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
}

function ComboboxField({
	label,
	placeholder,
	leading,
	trailing,
	inputRef,
	keyShortcut,
	onFocus,
	onKeyDown,
}: ComboboxFieldProps) {
	// `data-ready` marks hydration; input before it hits a dead field, so tests wait on it.
	const ready = useHydrated();

	return (
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
				onFocus={onFocus}
				onKeyDown={onKeyDown}
			/>
			{trailing ? <span className={styles.trailing}>{trailing}</span> : null}
		</div>
	);
}

interface ComboboxPopupProps<T> {
	loading: boolean;
	loadingMessage: string;
	emptyMessage: string;
	itemToText(item: T): string;
	renderItem: ((item: T) => ReactNode) | undefined;
}

function ComboboxPopup<T>({
	loading,
	loadingMessage,
	emptyMessage,
	itemToText,
	renderItem,
}: ComboboxPopupProps<T>) {
	return (
		<Base.Portal>
			<Base.Positioner className={styles.positioner} sideOffset={4}>
				<Base.Popup className={styles.popup}>
					{loading ? (
						<p className={styles.status} role="status">
							{loadingMessage}
						</p>
					) : (
						<>
							<Base.Empty className={styles.status}>{emptyMessage}</Base.Empty>
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
	);
}
