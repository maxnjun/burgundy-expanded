"use client";
import {useEffect,useId,useState,type SVGProps} from "react";
import type {Tile} from "../game/types";
import {ESTATE_ART_HEIGHT as height} from "./estate-geometry";
import {tileHexPoints,TileFrame,TILE_FRAME_INSET} from "./tile-frame";
import illustrations from "../../public/tiles/illustrations/manifest.json";

export function InnArt({tile,estate=false,...props}:{tile:Tile;estate?:boolean}&SVGProps<SVGSVGElement>){
 const id=`inn-${useId().replace(/[^a-zA-Z0-9_-]/g,"")}`,[failed,setFailed]=useState(false),url=`/tiles/illustrations/inn.png?v=${illustrations.assets.inn.outputSha256.slice(0,12)}`;
 useEffect(()=>{let live=true;const image=new Image();image.onerror=()=>{if(live)setFailed(true);};image.src=url;return()=>{live=false;image.onerror=null;};},[url]);
 const points=tileHexPoints(TILE_FRAME_INSET),palette=illustrations.assets.inn.palette;
 return <svg data-tile-art={tile.id} data-estate-art={estate||undefined} data-inn-art="true" viewBox={`0 0 100 ${height}`} aria-hidden="true" focusable="false" {...props}>
   <defs><clipPath id={id}><polygon points={points}/></clipPath></defs><TileFrame palette={palette} layer="backdrop"/>
   {failed?<g data-inn-fallback="true" clipPath={`url(#${id})`}><path d="M20 49 50 26 80 49V88H20Z" fill="#f6dfac" stroke="#725233"/><path d="M14 49 50 22 86 49" fill="none" stroke="#aa482d" strokeWidth="8"/><path d="M43 65H57V88H43Z" fill="#69482d"/><text x="50" y="59" textAnchor="middle" fontSize="11" fill="#604325">여관</text></g>:<image data-inn-image="true" href={url} x={(100-height)/2} y={0} width={height} height={height} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id})`} onError={()=>setFailed(true)}/>}
 <TileFrame palette={palette} layer="rim"/></svg>;
}
