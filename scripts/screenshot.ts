#!/usr/bin/env bun
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "@playwright/test";
import { THEME_SELECTION } from "#/lib/storage/settings.ts";

const USAGE =
	"Usage: bun run screenshot <path> [--selector <css>] [--theme light|dark|both] [--out <dir>] [--width 1440] [--height 900] [--full-page]";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const SETTLE_MS = 300;
const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

interface ShotOptions {
	url: string;
	selector: string | undefined;
	width: number;
	height: number;
	fullPage: boolean;
	outDir: string;
	baseName: string;
}

function readOptions() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			selector: { type: "string" },
			theme: { type: "string", default: "both" },
			out: { type: "string" },
			width: { type: "string", default: "1440" },
			height: { type: "string", default: "900" },
			"full-page": { type: "boolean", default: false },
		},
	});
	const [path] = positionals;
	if (!path) throw new Error(USAGE);

	return {
		path,
		themes: themesFrom(values.theme),
		selector: values.selector,
		outDir: values.out,
		width: Number(values.width),
		height: Number(values.height),
		fullPage: values["full-page"],
	};
}

function themesFrom(choice: string): readonly Theme[] {
	if (choice === "both") return THEMES;
	if (THEMES.includes(choice as Theme)) return [choice as Theme];
	throw new Error(`--theme takes light, dark or both, not "${choice}"`);
}

function fileNameFor(path: string, selector: string | undefined): string {
	const name = [path, selector]
		.filter(Boolean)
		.join("-")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "");
	return name || "home";
}

function launchBrowser(): Promise<Browser> {
	const proxyServer = process.env.HTTPS_PROXY;
	return chromium.launch(
		proxyServer
			? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } }
			: {},
	);
}

async function shoot(
	browser: Browser,
	theme: Theme,
	shot: ShotOptions,
): Promise<string> {
	const context = await browser.newContext({
		viewport: { width: shot.width, height: shot.height },
		deviceScaleFactor: 2,
		colorScheme: theme,
	});
	await context.addInitScript(
		({ key, value }) => localStorage.setItem(key, value),
		{ key: THEME_SELECTION.key, value: theme },
	);
	const page = await context.newPage();
	const file = join(shot.outDir, `${shot.baseName}-${theme}.png`);

	try {
		await page.goto(shot.url, { waitUntil: "load" });
		await page.waitForLoadState("networkidle");
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await page.waitForTimeout(SETTLE_MS);
		await capture(page, shot, file);
	} finally {
		await context.close();
	}

	return file;
}

async function capture(page: Page, shot: ShotOptions, file: string) {
	if (!shot.selector) {
		await page.screenshot({ path: file, fullPage: shot.fullPage });
		return;
	}
	const element = page.locator(shot.selector).first();
	await element.waitFor();
	await element.screenshot({ path: file });
}

async function main() {
	const options = readOptions();
	const outDir =
		options.outDir ?? (await mkdtemp(join(tmpdir(), "diffpack-screenshot-")));
	await mkdir(outDir, { recursive: true });

	const shot: ShotOptions = {
		url: new URL(options.path, BASE_URL).href,
		selector: options.selector,
		width: options.width,
		height: options.height,
		fullPage: options.fullPage,
		outDir,
		baseName: fileNameFor(options.path, options.selector),
	};

	const browser = await launchBrowser();
	try {
		for (const theme of options.themes) {
			console.log(await shoot(browser, theme, shot));
		}
	} finally {
		await browser.close();
	}
}

await main();
