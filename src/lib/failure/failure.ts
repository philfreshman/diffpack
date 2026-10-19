const FAILURE_CODES = [
	"quota_exhausted",
	"proxy_unreachable",
	"proxy_not_configured",
	"not_found",
	"rate_limited",
	"upstream_failed",
	"network",
	"no_such_version",
	"no_archive",
	"unsupported_archive_host",
	"archive_not_listed",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

const PROXY_LIMIT_CODES = ["quota_exhausted", "proxy_unreachable"] as const;

export type ProxyLimitCode = (typeof PROXY_LIMIT_CODES)[number];

export function isProxyLimit(
	code: FailureCode | null | undefined,
): code is ProxyLimitCode {
	return PROXY_LIMIT_CODES.includes(code as ProxyLimitCode);
}

export interface Failure {
	message: string;
	code?: FailureCode;
	resetsAt?: string;
	status?: number;
}

export class CodedError extends Error {
	readonly code?: FailureCode;
	readonly resetsAt?: string;
	readonly status?: number;

	constructor({ message, code, resetsAt, status }: Failure) {
		super(message);
		this.code = code;
		this.resetsAt = resetsAt;
		this.status = status;
	}
}

function isFailureCode(value: unknown): value is FailureCode {
	return FAILURE_CODES.includes(value as FailureCode);
}

export function failureFrom(
	message: string,
	{ code, resetsAt, status }: Record<string, unknown>,
): Failure {
	return {
		message,
		...(isFailureCode(code) && { code }),
		...(typeof resetsAt === "string" && { resetsAt }),
		...(typeof status === "number" && { status }),
	};
}

export function failureOf(error: unknown): Failure {
	if (!(error instanceof Error)) return { message: String(error) };
	return failureFrom(error.message, { ...error });
}
