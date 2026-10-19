import type { ProxyLimitCode } from "#/lib/failure/failure.ts";
import { formatResetTime } from "#/lib/failure/resetTime.ts";
import styles from "./ProxyLimitNotice.module.css";

interface NoticeText {
	title: string;
	detail(resetTime: string): string;
}

const NOTICES: Record<ProxyLimitCode, NoticeText> = {
	quota_exhausted: {
		title: "Composer diffs are paused for today.",
		detail: (resetTime) =>
			`diffpack's download proxy runs on Cloudflare's free plan and has used today's allowance. It comes back at ${resetTime}.`,
	},
	proxy_unreachable: {
		title: "diffpack couldn't reach its Composer download proxy.",
		detail: (resetTime) =>
			`It may have hit Cloudflare's daily free limit, which resets at ${resetTime}. Try again later.`,
	},
};

interface ProxyLimitNoticeProps {
	code: ProxyLimitCode;
	resetsAt: string | null | undefined;
}

export function ProxyLimitNotice({ code, resetsAt }: ProxyLimitNoticeProps) {
	const notice = NOTICES[code];
	const resetTime = formatResetTime(resetsAt);

	return (
		<div
			className={styles.notice}
			role="status"
			data-testid="proxy-limit-notice"
			data-code={code}
		>
			<p className={styles.title}>{notice.title}</p>
			<p className={styles.detail}>{notice.detail(resetTime)}</p>
		</div>
	);
}
