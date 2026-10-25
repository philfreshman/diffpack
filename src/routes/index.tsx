import { createFileRoute } from "@tanstack/react-router";
import { RegistryGrid } from "#/components/landing/RegistryGrid/RegistryGrid.tsx";
import { SiteAbout } from "#/components/landing/SiteAbout/SiteAbout.tsx";
import { StarField } from "#/components/landing/StarField/StarField.tsx";
import { ThemeToggle } from "#/components/theme/ThemeToggle/ThemeToggle.tsx";
import { GithubIcon } from "#/components/ui/icons.tsx";
import { PageTitle } from "#/components/ui/PageTitle/PageTitle.tsx";
import { homeHead } from "#/lib/url/homeHead.ts";
import styles from "./index.module.css";

export const Route = createFileRoute("/")({
	head: homeHead,
	component: Home,
});

function Home() {
	return (
		<>
			<div className={styles.cosmos} aria-hidden="true" data-testid="cosmos" />
			<StarField />
			<ThemeToggle />
			<main className={styles.page}>
				<header className={styles.intro}>
					<PageTitle size="hero">diffpack</PageTitle>
					<p className={styles.tagline}>
						Compare package versions across ecosystems.
						<br />
						Clean. Fast. Source-aware.
					</p>
				</header>

				<RegistryGrid />

				<SiteAbout />

				<footer className={styles.footer}>
					<p className={styles.footerText}>
						<a
							className={styles.repoLink}
							href="https://github.com/philfreshman/diffpack"
							target="_blank"
							rel="noopener noreferrer"
						>
							<GithubIcon width="14" height="14" />
							<span className={styles.linkLabel}>diffpack on GitHub</span>
						</a>
					</p>
				</footer>
			</main>
		</>
	);
}
