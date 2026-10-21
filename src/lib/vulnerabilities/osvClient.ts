import { postJson } from "#/lib/registries/http.ts";
import type { Fetcher, RegistryId } from "#/lib/registries/types.ts";
import { advisoryFrom } from "./advisory.ts";
import { collapseAliases } from "./aliases.ts";
import { osvEcosystemOf } from "./ecosystem.ts";
import { arrayOf, objectOf, stringOf } from "./json.ts";
import type { Advisory } from "./types.ts";

const OSV_API_ORIGIN = "https://api.osv.dev";
const QUERY_URL = `${OSV_API_ORIGIN}/v1/query`;
const MAX_PAGES = 20;

export interface OsvClient {
	query(
		registry: RegistryId,
		name: string,
		version: string,
		signal?: AbortSignal,
	): Promise<Advisory[]>;
}

interface QueryPage {
	records: unknown[];
	nextPageToken: string;
}

export function createOsvClient(fetcher: Fetcher = fetch): OsvClient {
	async function page(
		body: Record<string, unknown>,
		signal: AbortSignal | undefined,
	): Promise<QueryPage> {
		const answer = objectOf(
			await postJson<unknown>(
				fetcher,
				QUERY_URL,
				body,
				signal,
				"OSV.dev: vulnerability lookup failed",
			),
		);
		return {
			records: arrayOf(answer.vulns),
			nextPageToken: stringOf(answer.next_page_token),
		};
	}

	return {
		async query(registry, name, version, signal) {
			const question = {
				package: { name, ecosystem: osvEcosystemOf(registry) },
				version,
			};
			const records: unknown[] = [];
			let pageToken = "";
			for (let pages = 0; pages < MAX_PAGES; pages++) {
				const body = pageToken
					? { ...question, page_token: pageToken }
					: question;
				const answer = await page(body, signal);
				records.push(...answer.records);
				pageToken = answer.nextPageToken;
				if (!pageToken) break;
			}
			return collapseAliases(
				records.map((record) => advisoryFrom(record, question.package)),
			);
		},
	};
}

export const osvClient = createOsvClient();
