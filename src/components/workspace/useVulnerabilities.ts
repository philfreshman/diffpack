import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RegistryId } from "#/lib/registries/types.ts";
import { type DiffSlug, namesComparison } from "#/lib/url/slug.ts";
import { osvClient } from "#/lib/vulnerabilities/osvClient.ts";
import { compareAdvisories } from "#/lib/vulnerabilities/report.ts";
import type {
	Advisory,
	AffectedFile,
	VulnerabilityReport,
} from "#/lib/vulnerabilities/types.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import { useAffectedFiles } from "./useAffectedFiles.ts";

export type ScanStatus = "idle" | "loading" | "ready" | "error";

export interface VulnerabilityScan {
	status: ScanStatus;
	report: VulnerabilityReport | null;
	error: Error | null;
}

export interface VulnerabilityFindings {
	scan: VulnerabilityScan;
	affected: AffectedFile[];
}

function useAdvisories(
	registry: RegistryId,
	packageName: string,
	version: string,
	enabled: boolean,
) {
	return useQuery({
		queryKey: ["osv", registry, packageName, version],
		queryFn: ({ signal }): Promise<Advisory[]> =>
			osvClient.query(registry, packageName, version, signal),
		enabled,
	});
}

function statusOf(
	enabled: boolean,
	error: Error | null,
	report: VulnerabilityReport | null,
): ScanStatus {
	if (!enabled) return "idle";
	if (error) return "error";
	return report ? "ready" : "loading";
}

function useVulnerabilities(slug: DiffSlug): VulnerabilityScan {
	const enabled = namesComparison(slug);
	const from = useAdvisories(slug.registry, slug.package, slug.from, enabled);
	const to = useAdvisories(slug.registry, slug.package, slug.to, enabled);

	const report = useMemo(
		() => (from.data && to.data ? compareAdvisories(from.data, to.data) : null),
		[from.data, to.data],
	);
	const error = from.error ?? to.error;

	return {
		status: statusOf(enabled, error, report),
		report: enabled ? report : null,
		error,
	};
}

export function useVulnerabilityFindings(
	slug: DiffSlug,
	tree: DiffFileEntry | null,
): VulnerabilityFindings {
	const scan = useVulnerabilities(slug);
	const affected = useAffectedFiles(slug.package, scan.report, tree);

	return { scan, affected };
}
