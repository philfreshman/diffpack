import styles from "./SiteAbout.module.css";

export function SiteAbout() {
	return (
		<p className={styles.about}>
			Pick a registry, search for a package and choose two versions. diffpack
			lists every file that was added, removed, renamed or changed between them,
			and shows what changed in each. Nothing to install.
		</p>
	);
}
