"use client";
import { startTransition, useEffect, useState } from "react";
import { VERIFIED_BOARD_DEFINITIONS } from "../game/boards/catalog";
import { createBoardDraft, redrawBoardSeat, selectDraftBoard, validBoardDraft, chooseAIBoard, type BoardDraft, type BoardDraftSeat, type BoardRange } from "../game/board-draft";
import { estatePoints, estateCenter } from "./estate-geometry";
import { terrainPaint } from "./tile-art";
import { fortressLinesFor } from "../game/boards/fortress-lines";
export function RangeOptions(){return <><option value="base">기본 영지 랜덤 · 1~22</option><option value="fortress">요새 영지 랜덤 · 23~30</option><option value="all">전체 영지 랜덤 · 1~30</option></>;}
export function BoardChoices({seat,onSelect,onRange,disabled=false,selectionDisabled=false}:{seat:BoardDraftSeat;onSelect:(id:string)=>void;onRange:(range:BoardRange)=>void;disabled?:boolean;selectionDisabled?:boolean}){
 return <section className="board-choices" aria-label={`${seat.playerId} 영지 후보`}><label>보드 범위 <select aria-label={`${seat.playerId} 보드 범위`} value={seat.range} disabled={disabled} onChange={e=>onRange(e.target.value as BoardRange)}><RangeOptions/></select></label><div className="board-candidate-grid">{seat.candidates.map(id=>{const board=VERIFIED_BOARD_DEFINITIONS.find(b=>b.id===id)!;return <button type="button" key={id} disabled={disabled||selectionDisabled} aria-pressed={seat.selected===id} aria-label={`${seat.playerId} 영지 ${board.officialNumber} 선택`} onClick={()=>onSelect(id)}><strong>영지 {board.officialNumber}{seat.selected===id?" · 선택됨":""}</strong><svg viewBox="0 0 620 640" role="img" aria-label={`영지 ${board.officialNumber} 실제 칸 미리보기`}>{board.cells.map(c=>{const {x,y}=estateCenter(c.coord);return <g key={c.id}><polygon points={estatePoints(c.coord)} fill={terrainPaint[c.terrain]} stroke="#f7edcb"/><text x={x} y={y+7} textAnchor="middle" fontSize="22" fill="#fff8d8">{c.number}</text></g>;})}{fortressLinesFor(id).map(l=><text key={l.id} x={l.icon.x} y={l.icon.y} textAnchor="middle" fill="#9a6c31" fontSize="32">♜</text>)}</svg></button>;})}</div><small>{seat.selected?"선택을 변경할 수 있습니다. 두 플레이어가 준비되면 온라인 게임이 시작됩니다.":"후보 두 개 중 하나를 선택하세요."}</small></section>;
}
const key="burgundy-expanded:board-draft-v1";
const ids=["seat-1","seat-2","seat-3","seat-4"];
export function LocalBoardDraft({count,ai,onBoards}:{count:number;ai:string;onBoards:(ids:(string|null)[])=>void}){
 const [draft,setDraft]=useState<BoardDraft|null>(null),[error,setError]=useState("");
 useEffect(()=>{try{const raw=localStorage.getItem(key),d=raw?JSON.parse(raw) as BoardDraft:createBoardDraft(ids,"base",crypto.randomUUID());if(!validBoardDraft(d,ids))throw Error("저장된 영지 후보가 올바르지 않습니다. 원본을 보존했습니다.");localStorage.setItem(key,JSON.stringify(d));startTransition(()=>setDraft(d));}catch(e){startTransition(()=>setError(e instanceof Error?e.message:"후보 복원 실패"));}},[]);
 useEffect(()=>{if(!draft)return;let next=draft;for(let i=0;i<count;i++)if((ai==="demo"||(ai==="computer"&&i>0))&&!next.seats[i].selected)next=selectDraftBoard(next,ids[i],chooseAIBoard(next.seats[i]));if(next!==draft){try{localStorage.setItem(key,JSON.stringify(next));startTransition(()=>setDraft(next));}catch{startTransition(()=>setError("후보 저장 실패"));}return;}onBoards(next.seats.slice(0,count).map(s=>s.selected));},[draft,count,ai,onBoards]);
 function update(next:BoardDraft){try{localStorage.setItem(key,JSON.stringify(next));setDraft(next);}catch{setError("후보 저장 실패. 선택을 확정하지 않았습니다.");}}
 return <div>{error&&<p role="alert">{error}</p>}{draft&&draft.seats.slice(0,count).map((seat,i)=><div key={seat.playerId}><h3>좌석{i+1}{ai==="demo"||(ai==="computer"&&i>0)?" · AI 자동 선택":""}</h3><BoardChoices seat={seat} selectionDisabled={ai==="demo"||(ai==="computer"&&i>0)} onSelect={id=>update(selectDraftBoard(draft,seat.playerId,id))} onRange={range=>update(redrawBoardSeat(draft,seat.playerId,range))}/></div>)}</div>;
}
