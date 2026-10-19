export function formatResetTime(
	resetsAt: string,
	locale?: string,
	timeZone?: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	}).format(new Date(resetsAt));
}

export function nextUtcMidnight(now: Date): string {
	const tomorrow = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1,
	);
	return new Date(tomorrow).toISOString();
}
