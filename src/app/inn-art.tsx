"use client";
import {useEffect,useId,useState,type SVGProps} from "react";
import type {Tile} from "../game/types";
import {ESTATE_ART_HEIGHT as height} from "./estate-geometry";

// Alpha>128 bounds measured in the transparent derivative: (95,2)–(1208,1199).
const source={width:1312,height:1199,left:95,top:2,contentWidth:1113,contentHeight:1197};
export function InnArt({tile,estate=false,...props}:{tile:Tile;estate?:boolean}&SVGProps<SVGSVGElement>){
 const id=`inn-${useId().replace(/[^a-zA-Z0-9_-]/g,"")}`,[failed,setFailed]=useState(false),url="/tiles/inn.png?v=inn-cutout-1";
 useEffect(()=>{let live=true;const image=new Image();image.onerror=()=>{if(live)setFailed(true);};image.src=url;return()=>{live=false;image.onerror=null;};},[]);
 const points=`50,0 100,${height/4} 100,${height*3/4} 50,${height} 0,${height*3/4} 0,${height/4}`;
 return <svg data-tile-art={tile.id} data-estate-art={estate||undefined} data-inn-art="true" viewBox={`0 0 100 ${height}`} aria-hidden="true" focusable="false" {...props}>
   <defs><clipPath id={id}><polygon points={points}/></clipPath></defs>
   {failed?<g data-inn-fallback="true"><polygon points={points} fill="#dfb34c" stroke="#8b6129" strokeWidth="2"/><path d="M20 49 50 26 80 49V88H20Z" fill="#f6dfac" stroke="#725233"/><path d="M14 49 50 22 86 49" fill="none" stroke="#aa482d" strokeWidth="8"/><path d="M43 65H57V88H43Z" fill="#69482d"/><text x="50" y="59" textAnchor="middle" fontSize="11" fill="#604325">여관</text></g>:<image data-inn-image="true" href={url} x={-100*source.left/source.contentWidth} y={-height*source.top/source.contentHeight} width={100*source.width/source.contentWidth} height={height*source.height/source.contentHeight} preserveAspectRatio="none" clipPath={`url(#${id})`} onError={()=>setFailed(true)}/>}
 </svg>;
}
