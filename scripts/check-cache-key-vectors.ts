import { argv, file } from "bun";

const PINNED_SERVER_COMMIT = "5c85a5eaa41af53dc1a246a068d12c41ab794889";
const VECTORS_PATH = "fixtures/cache-key-vectors.json";

const serverRef = argv[2] ?? PINNED_SERVER_COMMIT;
const serverVectorsUrl = `https://raw.githubusercontent.com/philfreshman/diffpack-server/${serverRef}/${VECTORS_PATH}`;

async function serverVectors(): Promise<Buffer> {
	const response = await fetch(serverVectorsUrl);
	if (!response.ok)
		throw new Error(
			`Could not read ${serverVectorsUrl}: HTTP ${response.status}`,
		);

	return Buffer.from(await response.arrayBuffer());
}

async function vendoredVectors(): Promise<Buffer> {
	return Buffer.from(await file(VECTORS_PATH).arrayBuffer());
}

if ((await serverVectors()).equals(await vendoredVectors())) {
	console.log(`${VECTORS_PATH} matches diffpack-server at ${serverRef}.`);
} else {
	console.error(
		`${VECTORS_PATH} is not byte-identical to diffpack-server's at ${serverRef}.`,
	);
	console.error(
		`Take that file with: curl -sSfo ${VECTORS_PATH} ${serverVectorsUrl}`,
	);
	console.error(
		`and pin its commit as PINNED_SERVER_COMMIT in scripts/check-cache-key-vectors.ts.`,
	);
	process.exit(1);
}
