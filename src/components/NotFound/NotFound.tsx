import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "#/components/theme/ThemeToggle/ThemeToggle.tsx";
import { PageTitle } from "#/components/ui/PageTitle/PageTitle.tsx";
import styles from "./NotFound.module.css";

export function NotFound() {
	return (
		<main className={styles.notFound} data-testid="not-found">
			<ThemeToggle />
			<PageTitle>Nothing here</PageTitle>
			<p className={styles.message}>
				diffpack compares packages on npm, crates.io, Go, PyPI and Packagist.
			</p>
			<Link to="/">Back to the registries</Link>
		</main>
	);
}
