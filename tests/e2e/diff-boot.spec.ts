import { expect, type Page, test } from "@playwright/test";

// A two-file package, which keeps the downloads small.
const NODE = "/npm/node/26.6.0/26.7.0";

const ENGINE = { timeout: 90_000 };

const status = (page: Page) => page.getByTestId("workspace");

// Installed before the head script runs, so the boot's own request is recorded too.
async function recordWorkerRequests(page: Page) {
	await page.addInitScript(() => {
		const posted: unknown[] = [];
		(window as unknown as Record<string, unknown>).__posted = posted;

		const original = Worker.prototype.postMessage;
		Worker.prototype.postMessage = function patched(
			this: Worker,
			// The overloads differ only past the message, which is all this reads.
			...args: [message: unknown, ...rest: unknown[]]
		) {
			posted.push(args[0]);
			return (original as (...args: unknown[]) => void).apply(this, args);
		};
	});
}

function buildTreeRequests(page: Page) {
	return page.evaluate(() => {
		const posted =
			((window as unknown as Record<string, unknown>).__posted as {
				type?: string;
			}[]) ?? [];
		return posted.filter((request) => request.type === "build-tree");
	});
}

test("builds the comparison without waiting for React", async ({ page }) => {
	// Every bundle but the worker's is blocked, so nothing hydrates and any result is the boot script's.
	await page.route(/\/assets\/[^/]+\.js(\?.*)?$/, (route) =>
		route.request().url().includes("diff.worker")
			? route.continue()
			: route.abort(),
	);

	await page.goto(NODE);

	const outcome = await page.evaluate(async () => {
		type Reply = { id?: number; ok?: boolean; error?: string };
		const holder = window as unknown as Record<string, unknown>;
		await (holder.__diffpackEntryBoot as { served: Promise<unknown> }).served;
		const boot = (window as unknown as Record<string, unknown>)
			.__diffpackDiffBoot as
			| { worker: Worker; id: number; replies: Reply[] }
			| undefined;
		if (!boot) return "nothing was booted";

		// By id, and with an outcome: the worker's other messages and the
		// build's download progress share the channel.
		const answer = (reply: Reply) => reply.id === boot.id && "ok" in reply;
		const reply =
			boot.replies.find(answer) ??
			(await new Promise<Reply>((resolve) => {
				const earlier = boot.worker.onmessage;
				boot.worker.onmessage = (event) => {
					earlier?.call(boot.worker, event);
					if (answer(event.data)) resolve(event.data);
				};
			}));

		return reply.ok ? "built" : (reply.error ?? "failed with no reason");
	});

	expect(outcome).toBe("built");
	// React never ran: the store is still the one the page was served with.
	await expect(status(page)).toHaveAttribute("data-state", "idle");
});

test("hydration adopts the boot's request rather than repeating it", async ({
	page,
}) => {
	await recordWorkerRequests(page);

	await page.goto(NODE);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);

	// Two would be two sets of archive downloads for one comparison.
	expect(await buildTreeRequests(page)).toHaveLength(1);
});

test("a deep link opened with ignore-whitespace on is built that way once", async ({
	page,
}) => {
	await recordWorkerRequests(page);
	await page.addInitScript(() =>
		localStorage.setItem("ignore-whitespace-preference", "true"),
	);

	await page.goto(NODE);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);

	// Why the session waits for the whitespace answer: starting on the wrong one would build twice.
	expect(await buildTreeRequests(page)).toEqual([
		expect.objectContaining({ ignoreWhitespace: true }),
	]);
});

test("a store that refuses to be read still builds the comparison once", async ({
	page,
}) => {
	// Chrome with site data blocked: touching `localStorage` throws. Head script and session must
	// fall back alike, or the session would not adopt the boot's request.
	await page.addInitScript(() =>
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new DOMException("The operation is insecure.", "SecurityError");
			},
		}),
	);
	await recordWorkerRequests(page);
	const errors: Error[] = [];
	page.on("pageerror", (error) => errors.push(error));

	await page.goto(NODE);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);

	expect(await page.evaluate(() => "__diffpackDiffBoot" in window)).toBe(true);
	expect(await buildTreeRequests(page)).toEqual([
		expect.objectContaining({ ignoreWhitespace: false }),
	]);
	expect(errors).toEqual([]);
});
