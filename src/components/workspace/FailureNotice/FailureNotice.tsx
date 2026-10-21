import { Panel } from "#/components/ui/Panel/Panel.tsx";
import { type FailureCode, isProxyLimit } from "#/lib/failure/failure.ts";
import { ProxyLimitNotice } from "../ProxyLimitNotice/ProxyLimitNotice.tsx";
import { ViewportCenter } from "../ViewportCenter/ViewportCenter.tsx";
import styles from "./FailureNotice.module.css";

export interface ShownFailure {
	message: string | null;
	code?: FailureCode | null;
	resetsAt?: string | null;
	testId: string;
}

export function FailureMessage({
	message,
	code,
	resetsAt,
	testId,
}: ShownFailure) {
	if (isProxyLimit(code))
		return <ProxyLimitNotice code={code} resetsAt={resetsAt} />;

	return (
		<p className={styles.message} role="alert" data-testid={testId}>
			{message}
		</p>
	);
}

export function FailureNotice({
	centered = false,
	...failure
}: ShownFailure & { centered?: boolean }) {
	const notice = (
		<Panel>
			<FailureMessage {...failure} />
		</Panel>
	);

	return centered ? <ViewportCenter>{notice}</ViewportCenter> : notice;
}
