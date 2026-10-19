import { file } from "bun";

const SERVER_COMMIT = "74b042d0068ea496b3b1472e4891cbc1ea2812dc";
const VECTORS_PATH = "fixtures/cache-key-vectors.json";
const SERVER_VECTORS_URL = `https://raw.githubusercontent.com/philfreshman/diffpack-server/${SERVER_COMMIT}/${VECTORS_PATH}`;

async function serverVectors(): Promise<Buffer> {
	const response = await fetch(SERVER_VECTORS_URL);
	if (!response.ok)
		throw new Error(
			`Could not read ${SERVER_VECTORS_URL}: HTTP ${response.status}`,
		);

	return Buffer.from(await response.arrayBuffer());
}

async function vendoredVectors(): Promise<Buffer> {
	return Buffer.from(await file(VECTORS_PATH).arrayBuffer());
}

if ((await serverVectors()).equals(await vendoredVectors())) {
	console.log(`${VECTORS_PATH} matches diffpack-server at ${SERVER_COMMIT}.`);
} else {
	console.error(
		`${VECTORS_PATH} is not byte-identical to diffpack-server's at ${SERVER_COMMIT}.`,
	);
	console.error(
		`Restore it with: curl -sSfo ${VECTORS_PATH} ${SERVER_VECTORS_URL}`,
	);
	process.exit(1);
}
