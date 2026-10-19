import { SITE_NAME, siteUrl } from "./site.ts";

const HOME_TITLE = `${SITE_NAME}: compare npm, crates.io, Go, PyPI and Packagist versions`;

const HOME_DESCRIPTION =
	"Compare package versions across ecosystems. Source-aware dependency review for npm, crates.io, Go, PyPI and Packagist.";

const HOME_URL = siteUrl("/");

const WEBSITE = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: SITE_NAME,
	alternateName: "diffpack.io",
	url: HOME_URL,
};

export function homeHead() {
	return {
		meta: [
			{ title: HOME_TITLE },
			{ name: "description", content: HOME_DESCRIPTION },
			{ property: "og:url", content: HOME_URL },
			{ property: "og:title", content: HOME_TITLE },
			{ property: "twitter:url", content: HOME_URL },
			{ property: "twitter:title", content: HOME_TITLE },
			{ "script:ld+json": WEBSITE },
		],
		links: [{ rel: "canonical", href: HOME_URL }],
	};
}
