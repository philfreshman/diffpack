import { CACHE_SCHEMA, ENGINE_VERSION } from "#/lib/cache/diffKey.ts";
import {
	CACHE_ORIGIN,
	CACHED_REGISTRIES,
	LOOKUP_TIMEOUT_MS,
} from "#/lib/cache/entryLookup.ts";
import { MODULE_VERSION } from "#/lib/registries/go.ts";
import { registryAdapters } from "#/lib/registries/index.ts";
import { IGNORE_WHITESPACE } from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import { type Comparison, SIMILARITY_THRESHOLD } from "./protocol.ts";

// A name, not a symbol: the head script and this module share no module graph.
const DIFF_BOOT_GLOBAL = "__diffpackDiffBoot";
const ENTRY_BOOT_GLOBAL = "__diffpackEntryBoot";

export interface DiffBoot {
	worker: Worker;
	id: number;
	comparison: Comparison;
	/** Replies that arrived before a client existed, oldest first. */
	replies: unknown[];
}

export interface EntryBoot {
	comparison: Comparison;
	/** The cache's answer, unchecked, or `null` once the worker has started. */
	served: Promise<unknown>;
}

function readGlobal<T>(name: string): T | null {
	const holder = globalThis as Record<string, unknown>;
	return (holder[name] as T | undefined) ?? null;
}

// Read lazily: this module is also evaluated on the server.
export function readDiffBoot(): DiffBoot | null {
	return readGlobal<DiffBoot>(DIFF_BOOT_GLOBAL);
}

export function readEntryBoot(): EntryBoot | null {
	return readGlobal<EntryBoot>(ENTRY_BOOT_GLOBAL);
}

interface BootCache {
	origin: string;
	engine: string;
	timeoutMs: number;
}

const SERVER_CACHE: BootCache = {
	origin: CACHE_ORIGIN,
	engine: ENGINE_VERSION,
	timeoutMs: LOOKUP_TIMEOUT_MS,
};

const REGISTRY_IDS = registryAdapters.map((adapter) => adapter.id);

// Restates each adapter's `packagePath` rule, the `Comparison` fields and the
// cache key inline, since it cannot import. Change them together;
// `bootScript.test.ts` checks it.
export function buildDiffBootScript(
	workerUrl: string,
	cache: BootCache = SERVER_CACHE,
): string {
	const text = JSON.stringify;
	return `(()=>{try{
var REGISTRIES=${text(REGISTRY_IDS)};
var GO_VERSION=new RegExp(${text(MODULE_VERSION.source)});
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
var start=function(){
var worker=new Worker(${text(workerUrl)},{type:"module"});
var boot={worker:worker,id:0,comparison:comparison,replies:[]};
worker.onmessage=function(event){boot.replies.push(event.data)};
worker.postMessage(Object.assign({id:boot.id,type:"build-tree"},comparison));
window.${DIFF_BOOT_GLOBAL}=boot;
return null};
if(${text(CACHED_REGISTRIES)}.indexOf(registry)<0){start();return}
var j=JSON.stringify;
var canonical='{"engine":'+j(${text(cache.engine)})+',"from":'+j(from)+',"ignore_whitespace":'+comparison.ignoreWhitespace+',"package":'+j(pkg)+',"registry":'+j(registry)+',"schema":${CACHE_SCHEMA},"similarity_threshold":'+j(${text(SIMILARITY_THRESHOLD.toFixed(4))})+',"to":'+j(to)+'}';
var served=Promise.resolve().then(function(){
return crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical))}).then(function(digest){
var id=Array.prototype.map.call(new Uint8Array(digest),function(b){return(b<16?"0":"")+b.toString(16)}).join("");
return fetch(${text(cache.origin)}+"/diffs/v${CACHE_SCHEMA}/"+id,{credentials:"omit",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(${cache.timeoutMs})})}).then(function(response){
return response.ok?response.json():null}).catch(function(){return null}).then(function(body){
return body||start()});
window.${ENTRY_BOOT_GLOBAL}={comparison:comparison,served:served};
}catch(e){}})();`;
}
