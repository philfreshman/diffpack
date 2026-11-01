import type { ComponentProps, ReactNode } from "react";
import { Panel } from "#/components/ui/Panel/Panel.tsx";
import styles from "./Notice.module.css";

type NoticeTone = "neutral" | "danger";

interface NoticeTextProps extends Omit<ComponentProps<"div">, "title"> {
	title?: ReactNode;
}

interface NoticeProps extends NoticeTextProps {
	tone?: NoticeTone;
}

export function Notice({
	tone = "neutral",
	title,
	children,
	className,
	...divProps
}: NoticeProps) {
	return (
		<Panel
			{...divProps}
			className={joinClassNames(styles.notice, styles.text, className)}
			data-tone={tone}
		>
			<NoticeTitle title={title} />
			{children}
		</Panel>
	);
}

export function NoticeText({
	title,
	children,
	className,
	...divProps
}: NoticeTextProps) {
	return (
		<div {...divProps} className={joinClassNames(styles.text, className)}>
			<NoticeTitle title={title} />
			{children}
		</div>
	);
}

function NoticeTitle({ title }: { title: ReactNode }) {
	if (title === undefined || title === null) return null;

	return <p className={styles.title}>{title}</p>;
}

function joinClassNames(...classNames: (string | undefined)[]): string {
	return classNames.filter(Boolean).join(" ");
}
