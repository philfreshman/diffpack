import { MODULE_VERSION } from "#/lib/registries/go.ts";
import { registryAdapters } from "#/lib/registries/index.ts";
import { IGNORE_WHITESPACE } from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import type { Comparison } from "./protocol.ts";

// A name, not a symbol: the head script and this module share no module graph.
const DIFF_BOOT_GLOBAL = "__diffpackDiffBoot";

export interface DiffBoot {
	worker: Worker;
	id: number;
	comparison: Comparison;
	/** Replies that arrived before a client existed, oldest first. */
	replies: unknown[];
}

// Read lazily: this module is also evaluated on the server.
export function readDiffBoot(): DiffBoot | null {
	const holder = globalThis as Record<string, unknown>;
	return (holder[DIFF_BOOT_GLOBAL] as DiffBoot | undefined) ?? null;
}

const REGISTRY_IDS = registryAdapters.map((adapter) => adapter.id);

// Restates each adapter's `packagePath` rule and the `Comparison` fields inline,
// since it cannot import. Change them together; `bootScript.test.ts` checks it.
export function buildDiffBootScript(workerUrl: string): string {
	return `(()=>{try{
var REGISTRIES=${JSON.stringify(REGISTRY_IDS)};
var GO_VERSION=new RegExp(${JSON.stringify(MODULE_VERSION.source)});
var decode=function(s){try{return decodeURIComponent(s)}catch(e){return s}};
var parts=location.pathname.split("/").filter(Boolean).map(decode);
var registry=parts.shift();
if(REGISTRIES.indexOf(registry)<0)return;
var width=1;
if(registry==="npm"){if(parts[0]&&parts[0].charAt(0)==="@")width=2}
else if(registry==="go"){width=parts.length;
for(var i=0;i<parts.length;i++)if(GO_VERSION.test(parts[i])){width=i;break}}
var pkg=parts.slice(0,width).join("/"),from=parts[width],to=parts[width+1];
if(!pkg||!from||!to)return;
var comparison={registry:registry,pkg:pkg,from:from,to:to,ignoreWhitespace:${readInHead(IGNORE_WHITESPACE)}};
var worker=new Worker(${JSON.stringify(workerUrl)},{type:"module"});
var boot={worker:worker,id:0,comparison:comparison,replies:[]};
worker.onmessage=function(event){boot.replies.push(event.data)};
worker.postMessage(Object.assign({id:boot.id,type:"build-tree"},comparison));
window.${DIFF_BOOT_GLOBAL}=boot;
}catch(e){}})();`;
}
