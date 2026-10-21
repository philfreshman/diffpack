import { CodedError, failureFrom } from "#/lib/failure/failure.ts";
import type { Fetcher } from "./types.ts";

const PROXY_ERROR_HEADER = "Diffpack-Proxy-Error";

function originOf(url: string): string | null {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

function isProxyUrl(url: string, proxyOrigin: string | undefined): boolean {
	if (proxyOrigin === undefined) return false;
	const proxy = originOf(proxyOrigin);
	return proxy !== null && originOf(url) === proxy;
}

async function answerTo(
	fetcher: Fetcher,
	url: string,
	init: RequestInit,
	whatFailed: string,
	proxyOrigin: string | undefined,
): Promise<Response> {
	try {
		return await fetcher(url, init);
	} catch (error) {
		if (init.signal?.aborted || !isProxyUrl(url, proxyOrigin)) throw error;
		throw new CodedError({
			message: `${whatFailed} (proxy unreachable)`,
			code: "proxy_unreachable",
		});
	}
}

async function proxyFailure(
	res: Response,
	whatFailed: string,
): Promise<CodedError> {
	const body = (await res.json().catch(() => null)) ?? {};
	const message =
		typeof body.message === "string"
			? body.message
			: `${whatFailed} (${res.status})`;
	return new CodedError(
		failureFrom(message, {
			code: body.error ?? res.headers.get(PROXY_ERROR_HEADER),
			resetsAt: body.resetsAt,
			status: res.status,
		}),
	);
}

async function request(
	fetcher: Fetcher,
	url: string,
	init: RequestInit,
	whatFailed: string,
	proxyOrigin: string | undefined,
): Promise<Response> {
	const res = await answerTo(fetcher, url, init, whatFailed, proxyOrigin);
	if (res.ok) return res;
	if (res.headers.has(PROXY_ERROR_HEADER))
		throw await proxyFailure(res, whatFailed);
	throw new Error(`${whatFailed} (${res.status})`);
}

export async function getJson<T>(
	fetcher: Fetcher,
	url: string,
	signal: AbortSignal | undefined,
	whatFailed: string,
	proxyOrigin?: string,
): Promise<T> {
	const res = await request(fetcher, url, { signal }, whatFailed, proxyOrigin);
	return res.json() as Promise<T>;
}

export async function getText(
	fetcher: Fetcher,
	url: string,
	signal: AbortSignal | undefined,
	whatFailed: string,
	proxyOrigin?: string,
): Promise<string> {
	const res = await request(fetcher, url, { signal }, whatFailed, proxyOrigin);
	return res.text();
}

export async function postJson<T>(
	fetcher: Fetcher,
	url: string,
	body: unknown,
	signal: AbortSignal | undefined,
	whatFailed: string,
): Promise<T> {
	const init = { method: "POST", body: JSON.stringify(body), signal };
	const res = await request(fetcher, url, init, whatFailed, undefined);
	return res.json() as Promise<T>;
}
