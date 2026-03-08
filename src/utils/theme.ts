export function applyTheme(doc?: Document) {
	if (typeof document === "undefined") return;
	const activeDoc = doc || document;
	const localStorageTheme = localStorage.getItem("theme") || "dark";
	const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
	const theme =
		localStorageTheme !== "system" ? localStorageTheme : systemTheme;

	activeDoc.documentElement.setAttribute("data-theme", theme);
	activeDoc.documentElement.setAttribute(
		"data-theme-selection",
		localStorageTheme,
	);
}

export function toggleTheme() {
	if (typeof window === "undefined") return;
	const themes = ["light", "dark", "system"];
	const currentTheme = localStorage.getItem("theme") || "dark";
	const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
	localStorage.setItem("theme", nextTheme);
	applyTheme();
}

if (typeof window !== "undefined") {
	applyTheme();

	// Apply theme to the incoming document BEFORE it's swapped in — prevents white flash
	document.addEventListener("astro:before-swap", (e: any) => {
		applyTheme(e.newDocument);
	});

	// Listen for system changes
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", (e) => {
			const localStorageTheme = localStorage.getItem("theme") || "dark";
			if (localStorageTheme === "system") {
				document.documentElement.setAttribute(
					"data-theme",
					e.matches ? "dark" : "light",
				);
			}
		});
}
