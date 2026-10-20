import { ResourceGlyph, type ResourceType } from "./resource-icon";
import standard from "./tile-standard.json";

/** Optional effect layer for new/vector art; never paints over reviewed PNG art. */
export function TileResourceEffect({resource,from,to}:{resource:ResourceType;from:number;to:number}){
 const {leftX,y,iconSize}=standard.effect;
 return <g data-tile-effect="resource" pointerEvents="none"><rect x="18" y={y-3} width="64" height={iconSize+6} rx="4" fill="#fff0c4" stroke="#94733d" strokeWidth=".6"/><ResourceGlyph type={resource} x={leftX} y={y}/><text x={leftX+iconSize+3} y={y+14} fontSize="10" fill="#493b27">{from}→{to}</text></g>;
}
