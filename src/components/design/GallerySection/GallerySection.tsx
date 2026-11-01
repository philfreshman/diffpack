import type { ReactNode } from "react";
import {
	type GallerySectionId,
	sectionTitle,
} from "#/components/design/gallerySections.ts";
import styles from "./GallerySection.module.css";

export function GallerySection({
	id,
	source,
	children,
}: {
	id: GallerySectionId;
	source: string;
	children: ReactNode;
}) {
	const headingId = `${id}-heading`;

	return (
		<section id={id} className={styles.section} aria-labelledby={headingId}>
			<header className={styles.header}>
				<h2 id={headingId} className={styles.heading}>
					{sectionTitle(id)}
				</h2>
				<TokenLabel>{source}</TokenLabel>
			</header>
			{children}
		</section>
	);
}

export function TokenLabel({ children }: { children: ReactNode }) {
	return <code className={styles.tokenLabel}>{children}</code>;
}

export function SpecimenGroup({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<div className={styles.group}>
			<h3 className={styles.groupTitle}>{title}</h3>
			{children}
		</div>
	);
}

export function SpecimenRows({ children }: { children: ReactNode }) {
	return <dl className={styles.rows}>{children}</dl>;
}

export function SpecimenRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className={styles.row}>
			<dt>
				<TokenLabel>{label}</TokenLabel>
			</dt>
			<dd className={styles.rowSample}>{children}</dd>
		</div>
	);
}

type CellWidth = "narrow" | "wide";

export function SpecimenGrid({
	cellWidth = "narrow",
	children,
}: {
	cellWidth?: CellWidth;
	children: ReactNode;
}) {
	return (
		<div className={styles.grid} data-cell-width={cellWidth}>
			{children}
		</div>
	);
}

export function SpecimenCell({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<figure className={styles.cell}>
			<div className={styles.cellSample}>{children}</div>
			<figcaption>
				<TokenLabel>{label}</TokenLabel>
			</figcaption>
		</figure>
	);
}
