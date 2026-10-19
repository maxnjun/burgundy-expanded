import { VERIFIED_BOARD_DEFINITIONS } from "./boards/catalog";
import { drawDie } from "./core/random";
import type { GameState } from "./types";
export type BoardRange = "base" | "fortress" | "all";
export interface BoardDraftSeat { readonly playerId:string;readonly range:BoardRange;readonly candidates:readonly string[];readonly selected:string|null }
export interface BoardDraft { readonly version:1;readonly random:GameState["random"];readonly seats:readonly BoardDraftSeat[] }
export type PublicBoardDraft = Pick<BoardDraft,"version"|"seats">;
export function boardPool(range:BoardRange){
  if(!["base","fortress","all"].includes(range))throw new Error("영지 범위를 확인하세요.");
  return VERIFIED_BOARD_DEFINITIONS.filter(b=>b.verification.status==="verified"&&Number(b.officialNumber)>= (range==="fortress"?23:1)&&Number(b.officialNumber)<=(range==="base"?22:30));
}
export function redrawBoardSeat(draft:BoardDraft,playerId:string,range:BoardRange):BoardDraft{
  if(!draft.seats.some(s=>s.playerId===playerId))throw new Error("알 수 없는 좌석입니다.");
  const pool=boardPool(range).map(b=>b.id),candidates:string[]=[];let random=draft.random;
  if(pool.length<2)throw new Error("등록된 영지가 두 개 이상 필요합니다.");
  for(let n=0;n<2;n++){
    for(;;){let size=1,value=0;while(size<pool.length){const d=drawDie(random);random=d.random;size*=6;value=value*6+d.value-1;}
      if(value>=size-size%pool.length)continue;candidates.push(pool.splice(value%pool.length,1)[0]);break;}
  }
  return {...draft,random,seats:draft.seats.map(s=>s.playerId===playerId?{playerId,range,candidates,selected:null}:s)};
}
export function createBoardDraft(playerIds:readonly string[],range:BoardRange,seed:string):BoardDraft{
  let draft:BoardDraft={version:1,random:{seed,cursor:0},seats:playerIds.map(playerId=>({playerId,range,candidates:[],selected:null}))};
  for(const id of playerIds)draft=redrawBoardSeat(draft,id,range);return draft;
}
export function selectDraftBoard(draft:BoardDraft,playerId:string,boardId:string):BoardDraft{
  if(!draft.seats.some(s=>s.playerId===playerId&&s.candidates.includes(boardId)))throw new Error("추첨된 본인 영지만 선택할 수 있습니다.");
  return {...draft,seats:draft.seats.map(s=>s.playerId===playerId?{...s,selected:boardId}:s)};
}
export const draftReady = (draft:PublicBoardDraft) => draft.seats.every(s=>s.selected!==null);
export function validBoardDraft(draft:BoardDraft,ids:readonly string[]):boolean{
  try{return draft.version===1&&typeof draft.random.seed==="string"&&draft.random.seed.length>0&&draft.random.seed.length<=128&&Number.isSafeInteger(draft.random.cursor)&&draft.random.cursor>=0&&draft.seats.length===ids.length&&new Set(draft.seats.map(s=>s.playerId)).size===ids.length&&draft.seats.every((s,i)=>s.playerId===ids[i]&&s.candidates.length===2&&new Set(s.candidates).size===2&&s.candidates.every(id=>boardPool(s.range).some(b=>b.id===id))&&(s.selected===null||s.candidates.includes(s.selected)));}catch{return false;}
}
export function chooseAIBoard(seat:BoardDraftSeat):string{
  return [...seat.candidates].sort((a,b)=>{const score=(id:string)=>VERIFIED_BOARD_DEFINITIONS.find(d=>d.id===id)!.regions.length;return score(b)-score(a);})[0];
}
