"use client";
import { startTransition, useEffect, useState } from "react";
import { fortressLinesFor } from "../game/boards/fortress-lines";
import { fortressScoreId, lineFilled } from "../game/core/fortress-lines";
import type { PlayerState, ScoreEntry } from "../game/types";
import { estateCenter, estatePoints } from "./estate-geometry";

/** Reserved optional PNG path: missing files fall back to the temporary icon. */
export const FORTRESS_ICON = { imagePath:"/tiles/fortress.png" as string|null,size:40,offsetX:0,offsetY:0 };
export function FortressMarkers({player,entries,imagePath=FORTRESS_ICON.imagePath}:{player:PlayerState;entries:readonly ScoreEntry[];imagePath?:string|null}){
 const [active,setActive]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null),[loaded,setLoaded]=useState<string|null>(null);
 const lines=fortressLinesFor(player.duchy.boardId);
 useEffect(()=>{
  if(!imagePath||!lines.length)return;
  let live=true;const image=new Image();
  image.onload=()=>{if(live)startTransition(()=>setLoaded(imagePath));};
  image.onerror=()=>{if(live)startTransition(()=>setFailed(imagePath));};
  image.src=imagePath;
  return ()=>{live=false;image.onload=null;image.onerror=null;};
 },[imagePath,lines.length]);
 return <g data-fortress-overlay={player.duchy.boardId}>
  {lines.filter(l=>l.id===active).map(l=><g key={l.id} pointerEvents="none" data-fortress-highlight={l.id}>{l.cellIds.map(id=>{const c=player.duchy.cells.find(c=>c.id===id)!;return <polygon key={id} points={estatePoints(c.coord,3)} fill="#eab84b44" stroke="#a35b28" strokeWidth="3"/>;})}</g>)}
  {lines.map(line=>{const award=entries.find(e=>e.id===fortressScoreId(player,line)),complete=lineFilled(player,line),status=award?`획득 ${award.points}점`:complete?"완성 · 기존 상태":"미완성";
   const first=estateCenter(player.duchy.cells.find(c=>c.id===line.cellIds[0])!.coord),x=line.icon.x+FORTRESS_ICON.offsetX,y=line.icon.y+FORTRESS_ICON.offsetY,size=FORTRESS_ICON.size;
   return <g key={line.id} data-fortress-line={line.id} data-status={award?"awarded":complete?"complete":"incomplete"} role="button" tabIndex={0} aria-label={`요새 ${line.direction} ${status}`} aria-pressed={active===line.id} onClick={e=>{e.stopPropagation();setActive(active===line.id?null:line.id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();setActive(active===line.id?null:line.id);}}} onMouseEnter={()=>setActive(line.id)} onMouseLeave={()=>setActive(null)}>
    <title>{`${line.direction} · ${line.cellIds.join(" / ")} · ${status}`}</title>
    {active===line.id&&<path d={`M${x} ${y}L${first.x} ${first.y}`} stroke="#b18e52" strokeDasharray="4 4" pointerEvents="none"/>}
    <rect data-fortress-hit="true" x={x-size/2} y={y-size/2} width={size} height={size} rx="5" fill={award?"#d8b663":"#fff5d8"} stroke={award?"#866322":"#b8a071"} strokeWidth="2"/>
    {(!imagePath||failed===imagePath||loaded!==imagePath)&&<g data-fortress-placeholder="true" pointerEvents="none"><path d={`M${x-12} ${y+11}V${y-10}h6v5h4v-5h5v5h4v-5h6v21Z`} fill="#987747"/><text x={x} y={y+7} textAnchor="middle" fontSize="15" fill="#fff4cb">{award?"✓":"♜"}</text></g>}
    {imagePath&&loaded===imagePath&&failed!==imagePath&&<image href={imagePath} x={x-size/2} y={y-size/2} width={size} height={size} preserveAspectRatio="xMidYMid meet" onError={()=>setFailed(imagePath)}/>}

    <text x={x} y={y-size/2-8} textAnchor="middle" fontSize="9" fill="#70572c" pointerEvents="none">{line.direction}</text>
    <text x={x} y={y+size/2+13} textAnchor="middle" fontSize="9" fill="#70572c" pointerEvents="none">{award?`+${award.points}점`:complete?"기존 완성":"미완성"}</text>
   </g>;
  })}
 </g>;
}
