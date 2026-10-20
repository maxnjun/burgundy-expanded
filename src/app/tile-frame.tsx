"use client";
import type { Tile } from "../game/types";
import { useId } from "react";
import { ESTATE_ART_HEIGHT } from "./estate-geometry";
import standard from "./tile-standard.json";

export const TILE_FRAME_INSET=standard.frameInset;
export function hasTileFrame(tile:Tile){return !!tile;}
export function tileHexPoints(inset=0){const half=50-inset,radius=2*half/Math.sqrt(3),cy=ESTATE_ART_HEIGHT/2;return [[50+half,cy-radius/2],[50+half,cy+radius/2],[50,cy+radius],[50-half,cy+radius/2],[50-half,cy-radius/2],[50,cy-radius]].map(p=>p.join(",")).join(" ");}
function ring(outer:number,inner:number){return `M${tileHexPoints(outer).replaceAll(" ","L")}ZM${tileHexPoints(inner).replaceAll(" ","L")}Z`;}
export type TilePalette={dark:string;base:string;light:string};

/** Every layer lies INSIDE the exact same hex. No centred SVG strokes. */
export function TileFrame({palette,surface,layer}:{palette:TilePalette;surface?:readonly string[];layer:"backdrop"|"rim"}){
 const id=`tile-rim-${useId().replace(/[^a-zA-Z0-9_-]/g,"")}`;
 if(layer==="backdrop")return <g><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={surface?.[0]??palette.base}/><stop offset=".5" stopColor={surface?.[1]??palette.base}/><stop offset="1" stopColor={surface?.[2]??palette.base}/></linearGradient></defs><polygon data-tile-backdrop="true" points={tileHexPoints()} fill={`url(#${id})`} stroke="none"/></g>;
 return <g data-tile-frame="common" data-frame-inset={TILE_FRAME_INSET} pointerEvents="none"><defs><linearGradient id={id} x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stopColor={palette.light}/><stop offset=".32" stopColor={palette.base}/><stop offset="1" stopColor={palette.dark}/></linearGradient></defs><path data-rim-band="outer" d={ring(0,.5)} fill={palette.dark} fillRule="evenodd"/><path data-rim-band="bevel" d={ring(.5,1.85)} fill={`url(#${id})`} fillRule="evenodd"/><path data-rim-band="inner" d={ring(1.85,TILE_FRAME_INSET)} fill={palette.dark} fillRule="evenodd"/></g>;
}
