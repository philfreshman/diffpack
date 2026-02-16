const API_URL = import.meta.env.PUBLIC_API_URL;

export const backend = {
	ping: async () => {
		const response = await fetch(`${API_URL}/api/ping`);
		return response.text();
	},

	search: async (query: string): Promise<{ name: string }[]> => {
		const response = await fetch(
			`${API_URL}/api/search?query=${encodeURIComponent(query)}`,
		);
		return response.json();
	},

	baseURL: API_URL,
};
