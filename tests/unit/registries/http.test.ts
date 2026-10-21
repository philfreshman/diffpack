import { describe, expect, test } from "bun:test";
import { failureOf } from "#/lib/failure/failure.ts";
import { getJson, postJson } from "#/lib/registries/http.ts";
import { json, stubFetch, text } from "./fetchStub.ts";

const PROXY_ORIGIN = "https://diffpack-proxy.example.workers.dev";
const PROXY_URL = `${PROXY_ORIGIN}/v1/composer/p2/monolog/monolog.json`;
const REGISTRY_URL = "https://repo.packagist.org/packages/list.json";

const QUOTA_BODY = {
	error: "quota_exhausted",
	message: "diffpack's package proxy has used today's free allowance.",
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
	proxyOrigin = PROXY_ORIGIN,
) {
	const { fetcher } = stubFetch(answer);
	return getJson(fetcher, url, signal, "Couldn't load versions", proxyOrigin)
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
	const offline = () => Promise.reject(new TypeError("Failed to fetch"));

	test("from the proxy means the proxy is unreachable", async () => {
		expect(await failureOfFetch(offline)).toEqual({
			message: "Couldn't load versions (proxy unreachable)",
			code: "proxy_unreachable",
		});
	});

	test("from the proxy is recognised when its origin is configured with a trailing slash", async () => {
		expect(
			await failureOfFetch(offline, PROXY_URL, undefined, `${PROXY_ORIGIN}/`),
		).toMatchObject({ code: "proxy_unreachable" });
	});

	test("from a host that only begins like the proxy's is not the proxy", async () => {
		const lookalike = `${PROXY_ORIGIN}.example.com/v1/status`;

		expect(await failureOfFetch(offline, lookalike)).toEqual({
			message: "Failed to fetch",
		});
	});

	test("with a proxy origin that is not a URL is the network error itself", async () => {
		expect(
			await failureOfFetch(offline, PROXY_URL, undefined, "not a url"),
		).toEqual({ message: "Failed to fetch" });
	});

	test("from another host is the network error itself", async () => {
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

describe("postJson", () => {
	const QUERY_URL = "https://api.osv.dev/v1/query";

	test("posts the body as JSON without a content type, so no preflight is needed", async () => {
		const { fetcher, calls } = stubFetch(() => json({ ok: true }));

		const answer = await postJson(
			fetcher,
			QUERY_URL,
			{ a: 1 },
			undefined,
			"Lookup failed",
		);

		expect(answer).toEqual({ ok: true });
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.body).toBe('{"a":1}');
		expect(calls[0]?.init?.headers).toBeUndefined();
	});

	test("passes a network failure on unchanged", async () => {
		const offline = new TypeError("Failed to fetch");
		const fetcher = async (): Promise<Response> => {
			throw offline;
		};

		await expect(
			postJson(fetcher, QUERY_URL, {}, undefined, "Lookup failed"),
		).rejects.toBe(offline);
	});
});
