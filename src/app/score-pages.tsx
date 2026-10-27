"use client";
import {useState} from "react";
import type {PlayerState} from "../game/types";
import {PHASE_COMPLETION_POINTS} from "../game/core/fortress-lines";
import {regionSizePoints} from "../game/inns";
import {vineScoreBreakdown,type VineyardState} from "../game/vineyards";
import {CandyGlyph,FRUIT_NAMES} from './vineyard-art';
import "./score-pages.css";

type Props={player?:Pick<PlayerState,"id"|"name"|"victoryPoints">;vineyards?:VineyardState;label:string};

// Page selection is local UI state; neither room revisions nor saved games change.
export function ScorePages({player,vineyards,label}:Props){
 const [page,setPage]=useState(1);
 const rows=player&&vineyards?.players[player.id]?vineScoreBreakdown(vineyards,player.id):null;
 const total=rows?.reduce((n,row)=>n+row.points,0);
 return <g className="score-pages" role="group" aria-label={label} data-score-page={page} data-score-owner={player?.id}>
  <text x="12" y="25" className="score-page-title">{page===1?"영지 점수":"포도밭 점수"}</text>
  <text x="258" y="25" textAnchor="end" className="score-page-number">{page}/2</text>
  {([-1,1] as const).map((delta,i)=>{const disabled=page+delta<1||page+delta>2;const change=()=>{if(!disabled)setPage(page+delta);};return <g key={delta} role="button" tabIndex={disabled?-1:0} aria-label={`${label} ${delta<0?"이전":"다음"} 페이지`} aria-disabled={disabled} className="score-page-nav" transform={`translate(${278+i*54} 3)`} onClick={e=>{e.stopPropagation();change();}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();change();}}}>
   <rect width="48" height="42" rx="4"/><text x="24" y="27" textAnchor="middle">{delta<0?"▲":"▼"}</text>
  </g>;})}
  {page===1?<>
   <text x="12" y="50" className="score-page-note">지역 완성 · 연결 칸 수 → 기본 점수</text>
   {Array.from({length:10},(_,i)=>i+1).map((size,i)=><g key={size} transform={`translate(${39+i%5*78} ${70+Math.floor(i/5)*27})`}>
    <text textAnchor="middle" className="score-page-note">{size}칸</text><text y="17" textAnchor="middle" className="score-page-points">{regionSizePoints(size)}</text>
   </g>)}
   <text x="195" y="128" textAnchor="middle" className="score-page-note">추가 점수 {Object.entries(PHASE_COMPLETION_POINTS).map(([phase,points])=>`${phase} ${points}`).join(" · ")}</text>
   <text x="195" y="148" textAnchor="middle" className="score-page-total">{player?`${player.name} · 현재 누적 ${player.victoryPoints}점`:"플레이어 준비 중"}</text>
  </>:rows?<>
   <text x="12" y="50" className="score-page-note">토큰 수 · 채점 연결 영역(칸) · 점수</text>
   {rows.map((row,i)=><g key={row.grape} data-grape-score={row.grape} transform={`translate(${14+i%2*190} ${70+Math.floor(i/2)*25})`}>
    <CandyGlyph grape={row.grape} x={7} y={-4} size={22}/>
    <text x="23" className="score-page-grape">{FRUIT_NAMES[row.grape]} ×{row.tokens} · {row.counted.join("+")||"—"}칸</text>
    <text x="168" textAnchor="end" className="score-page-points">{row.points}</text>
   </g>)}
   <text x="195" y="146" textAnchor="middle" className="score-page-total" data-vine-score={total}>{player!.name} · 종료 예상 {total}점</text>
  </>:<text x="195" y="92" textAnchor="middle" className="score-page-note">포도밭 확장이 활성화되지 않았습니다.</text>}
 </g>;
}

export function PersonalScorePages({player,vineyards}:Omit<Props,"label">&{player:NonNullable<Props["player"]>}){
 return <svg className="personal-score-pages" viewBox="0 0 390 155" role="group" aria-label={`${player.name} 개인 점수판`}>
  <rect x="1" y="1" width="388" height="153" rx="3" fill="#fff5d8" fillOpacity=".8" stroke="#b49a68"/>
  <ScorePages player={player} vineyards={vineyards} label={`${player.name} 점수판`}/>
 </svg>;
}
