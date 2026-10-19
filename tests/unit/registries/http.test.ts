import { describe, expect, test } from "bun:test";
import { failureOf } from "#/lib/failure/failure.ts";
import { getJson } from "#/lib/registries/http.ts";
import { json, stubFetch, text } from "./fetchStub.ts";

const PROXY_ORIGIN = "https://diffpack-proxy.example.workers.dev";
const PROXY_URL = `${PROXY_ORIGIN}/v1/composer/p2/monolog/monolog.json`;
const REGISTRY_URL = "https://repo.packagist.org/packages/list.json";

const QUOTA_BODY = {
	error: "quota_exhausted",
	message: "diffpack's Composer proxy has used today's free allowance.",
	resetsAt: "2026-10-20T00:00:00Z",
};

function proxyError(body: unknown, status: number): Response {
	const response = json(body, status);
	response.headers.set("Diffpack-Proxy-Error", "quota_exhausted");
	return response;
}

function failureOfFetch(
	answer: (url: string) => Response | Promise<Response>,
	url = PROXY_URL,
	signal?: AbortSignal,
) {
	const { fetcher } = stubFetch(answer);
	return getJson(fetcher, url, signal, "Couldn't load versions", PROXY_ORIGIN)
		.then(() => null)
		.catch(failureOf);
}

describe("a failed answer", () => {
	test("from the proxy carries the proxy's code, message and reset time", async () => {
		expect(await failureOfFetch(() => proxyError(QUOTA_BODY, 503))).toEqual({
			message: QUOTA_BODY.message,
			code: "quota_exhausted",
			resetsAt: "2026-10-20T00:00:00Z",
			status: 503,
		});
	});

	test("from the proxy with an unreadable body keeps the header's code", async () => {
		const unreadable = () => {
			const response = text("<html>", 503);
			response.headers.set("Diffpack-Proxy-Error", "quota_exhausted");
			return response;
		};

		expect(await failureOfFetch(unreadable)).toEqual({
			message: "Couldn't load versions (503)",
			code: "quota_exhausted",
			status: 503,
		});
	});

	test("without the proxy's header is read as today, body ignored", async () => {
		expect(await failureOfFetch(() => json(QUOTA_BODY, 503))).toEqual({
			message: "Couldn't load versions (503)",
		});
	});
});

describe("no answer at all", () => {
	test("from the proxy means the proxy is unreachable", async () => {
		const offline = () => Promise.reject(new TypeError("Failed to fetch"));

		expect(await failureOfFetch(offline)).toEqual({
			message: "Couldn't load versions (proxy unreachable)",
			code: "proxy_unreachable",
		});
	});

	test("from another host is the network error itself", async () => {
		const offline = () => Promise.reject(new TypeError("Failed to fetch"));

		expect(await failureOfFetch(offline, REGISTRY_URL)).toEqual({
			message: "Failed to fetch",
		});
	});

	test("because the request was cancelled is not the proxy's fault", async () => {
		const controller = new AbortController();
		controller.abort();
		const cancelled = () =>
			Promise.reject(new DOMException("Aborted", "AbortError"));

		expect(
			await failureOfFetch(cancelled, PROXY_URL, controller.signal),
		).toEqual({ message: "Aborted" });
	});
});
