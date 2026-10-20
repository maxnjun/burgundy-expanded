import type { CSSProperties } from "react";
import standard from "./tile-standard.json";
import manifest from "../../public/assets/icons/manifest.json";

export type ResourceType="silver"|"worker";
export const resourceAssets={silver:`/assets/icons/silver-coin.png?v=${manifest.assets["silver-coin"].sha256.slice(0,12)}`,worker:`/assets/icons/worker.png?v=${manifest.assets.worker.sha256.slice(0,12)}`} as const;
/** The same em square in HTML and SVG; transparent derivatives preserve aspect ratio. */
export function ResourceIcon({type,size=24,style}:{type:ResourceType;size?:number;style?:CSSProperties}){
 // Native img is intentional: the exact same immutable PNG is also used by SVG image.
 // eslint-disable-next-line @next/next/no-img-element
 return <img data-resource-icon={type} src={resourceAssets[type]} alt={type==="silver"?"은화":"일꾼"} width={size} height={size} style={{display:"inline-block",objectFit:"contain",verticalAlign:"middle",...style}}/>;
}
export function ResourceGlyph({type,x,y,size=standard.effect.iconSize}:{type:ResourceType;x:number;y:number;size?:number}){
 return <image data-resource-icon={type} href={resourceAssets[type]} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet"/>;
}
