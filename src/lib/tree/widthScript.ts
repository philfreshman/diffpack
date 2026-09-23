import { TREE_COLLAPSED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import { TREE_COLLAPSED_ATTRIBUTE, TREE_WIDTH_PROPERTY } from "./prefs.ts";

/**
 * Runs in `<head>` before the first paint, so the tree panel is already the
 * width the visitor left it at, and already shut if they shut it. Like
 * `THEME_SCRIPT`, it cannot import the module it belongs to — nothing is loaded
 * yet — so both stored values are read by the source `readInHead` writes from
 * their declarations, and only where each one lands on `<html>` is spelled out
 * here.
 */
export const TREE_WIDTH_SCRIPT = `(()=>{try{
document.documentElement.style.setProperty(${JSON.stringify(TREE_WIDTH_PROPERTY)},${readInHead(TREE_WIDTH)}+"px");
if(${readInHead(TREE_COLLAPSED)})document.documentElement.setAttribute(${JSON.stringify(TREE_COLLAPSED_ATTRIBUTE)},"");
}catch(e){}})();`;
