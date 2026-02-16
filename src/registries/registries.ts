import { cratesRegistry } from "./crates/application/crates.ts";
import { npmRegistry } from "./npm/application/npm.ts";
import { zigRegistry } from "./zig/application/zig.ts";
import type { PackageRegistry } from "./types.ts";

const registries: Record<string, PackageRegistry> = {
	npm: npmRegistry,
	crates: cratesRegistry,
	zig: zigRegistry,
};

export { registries };
