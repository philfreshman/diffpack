// The old Astro site's property, kept so the traffic history stays continuous.
export const GA_MEASUREMENT_ID = "G-JH9PM7WWGG";

export const GA_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

// Inline in `<head>`: the queue must exist before the async library lands.
// Client-side navigations send no further page_view, as in the Astro app.
export const GA_SCRIPT = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag("js",new Date());
gtag("config",${JSON.stringify(GA_MEASUREMENT_ID)});`;
