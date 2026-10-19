function isDate(value: string | null | undefined): value is string {
	return value != null && Number.isFinite(Date.parse(value));
}

export function formatResetTime(
	resetsAt: string | null | undefined,
	locale?: string,
	timeZone?: string,
	now = new Date(),
): string {
	const reset = isDate(resetsAt) ? resetsAt : nextUtcMidnight(now);
	return new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	}).format(new Date(reset));
}

export function nextUtcMidnight(now: Date): string {
	const tomorrow = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1,
	);
	return new Date(tomorrow).toISOString();
}
