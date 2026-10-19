export const SITE_NAME = "diffpack";

const SITE_ORIGIN = "https://diffpack.io";

export function siteUrl(path: string): string {
	return `${SITE_ORIGIN}${path}`;
}
