import { TREE_COLLAPSED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import { COLLAPSED_ATTRIBUTE, WIDTH_PROPERTY } from "./sidebar.ts";

/**
 * Runs in `<head>` before the first paint, so the tree panel is already the
 * width the visitor left it at, and already shut if they shut it. Like
 * `THEME_SCRIPT`, it cannot import the module it belongs to — nothing is loaded
 * yet — so both stored values are read by the source `readInHead` writes from
 * their declarations, and where each one lands on `<html>` is interpolated
 * from `sidebar.ts`, which moves them from there on.
 */
export const TREE_WIDTH_SCRIPT = `(()=>{try{
document.documentElement.style.setProperty(${JSON.stringify(WIDTH_PROPERTY)},${readInHead(TREE_WIDTH)}+"px");
if(${readInHead(TREE_COLLAPSED)})document.documentElement.setAttribute(${JSON.stringify(COLLAPSED_ATTRIBUTE)},"");
}catch(e){}})();`;
