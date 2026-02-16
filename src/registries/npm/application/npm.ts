import type { PackageRegistry } from "../../types.ts";
import { npmService } from "../service/npm.ts";

export const npmRegistry: PackageRegistry = {
	async search(query) {
		return npmService.search(query);
	},

	async getVersions(name) {
		return npmService.getVersions(name);
	},

	async getVersion(name, version) {
		return npmService.getVersion(name, version);
	},

	async getPackage(name, version) {
		return npmService.getTarball(name, version);
	},
	getDownloadUrl(name, version) {
		return npmService.getDownloadUrl(name, version);
	},
};
