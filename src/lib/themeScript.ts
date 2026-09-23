import { THEME_SELECTION } from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import { themeColor } from "./theme.ts";

/**
 * Runs in `<head>` before the first paint, so the page never renders in one
 * theme and then flips to another. It cannot import `theme.ts` — nothing is
 * loaded yet at that point — so the stored selection is read by the source
 * `readInHead` writes from the setting's own declaration, and only resolving
 * and applying it is restated inline, over values interpolated from the module.
 */
export const THEME_SCRIPT = `(()=>{try{
var s=${readInHead(THEME_SELECTION)};
var t=s==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):s;
document.documentElement.setAttribute("data-theme",t);
document.documentElement.setAttribute("data-theme-selection",s);
var m=document.createElement("meta");
m.setAttribute("name","theme-color");
m.setAttribute("content",t==="light"?${JSON.stringify(themeColor("light"))}:${JSON.stringify(themeColor("dark"))});
document.head.appendChild(m);
}catch(e){}})();`;
