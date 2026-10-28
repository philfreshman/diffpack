import {
	TREE_COLLAPSED,
	TREE_POSITION,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import { readInHead } from "#/lib/storage/storedSetting.ts";
import {
	COLLAPSED_ATTRIBUTE,
	POSITION_ATTRIBUTE,
	WIDTH_PROPERTY,
} from "./sidebar.ts";

export const TREE_WIDTH_SCRIPT = `(()=>{try{
document.documentElement.style.setProperty(${JSON.stringify(WIDTH_PROPERTY)},${readInHead(TREE_WIDTH)}+"px");
if(${readInHead(TREE_COLLAPSED)})document.documentElement.setAttribute(${JSON.stringify(COLLAPSED_ATTRIBUTE)},"");
var position=${readInHead(TREE_POSITION)};
if(position!==${JSON.stringify(TREE_POSITION.fallback)})document.documentElement.setAttribute(${JSON.stringify(POSITION_ATTRIBUTE)},position);
}catch(e){}})();`;
