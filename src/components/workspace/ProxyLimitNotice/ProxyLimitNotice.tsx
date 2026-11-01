import { NoticeText } from "#/components/ui/Notice/Notice.tsx";
import type { ProxyLimitCode } from "#/lib/failure/failure.ts";
import { formatResetTime } from "#/lib/failure/resetTime.ts";

interface ProxyLimitText {
	title: string;
	detail(resetTime: string): string;
}

const NOTICES: Record<ProxyLimitCode, ProxyLimitText> = {
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
		<NoticeText
			title={notice.title}
			role="status"
			data-testid="proxy-limit-notice"
			data-code={code}
		>
			{notice.detail(resetTime)}
		</NoticeText>
	);
}
