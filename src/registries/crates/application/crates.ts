import type { PackageRegistry } from "../../types.ts";
import { cratesService } from "../service/crates.ts";

export const cratesRegistry: PackageRegistry = {
	async search(query) {
		return cratesService.search(query);
	},

	async getVersions(name) {
		return cratesService.getVersions(name);
	},

	async getVersion(name, version) {
		return cratesService.getVersion(name, version);
	},

	async getPackage(name, version) {
		return cratesService.getTarball(name, version);
	},
	getDownloadUrl(name, version) {
		return cratesService.getDownloadUrl(name, version);
	},
};
