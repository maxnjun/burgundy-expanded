import { fortressLinesFor, type FortressLine } from "../boards/fortress-lines";
import type { GameState, PlayerState, ScoreEntry } from "../types";

export const PHASE_COMPLETION_POINTS = { A:10,B:8,C:6,D:4,E:2 } as const;
export const fortressScoreId = (p:PlayerState,line:FortressLine) => `fortress:${p.id}:${p.duchy.boardId}:${line.id}`;
export const lineFilled = (p:PlayerState,line:FortressLine) => line.cellIds.every(id=>p.duchy.cells.some(c=>c.id===id&&c.tileId!==null));
/** Only a newly completed line pays; immutable ledger IDs also prevent replay/phase double awards. */
export function fortressLineScore(state:GameState,before:PlayerState,after:PlayerState,lines=fortressLinesFor(after.duchy.boardId)):ScoreEntry[]{
  return lines.filter(line=>!lineFilled(before,line)&&lineFilled(after,line)&&!state.scoreLedger[after.id].some(e=>e.id===fortressScoreId(after,line))).map(line=>({
    id:fortressScoreId(after,line),category:"extension",extensionId:"border-posts",points:PHASE_COMPLETION_POINTS[state.turn.phase],
    source:{document:"project-user-rule",pages:[],section:`사용자 확정 요새 줄 · ${line.direction}`},
  }));
}
export function validFortressScores(state:GameState):boolean{
  return state.players.every(p=>{
    const entries=state.scoreLedger[p.id].filter(e=>e.id.startsWith("fortress:")),lines=fortressLinesFor(p.duchy.boardId);
    return new Set(entries.map(e=>e.id)).size===entries.length&&entries.every(e=>{
      const line=lines.find(l=>e.id===fortressScoreId(p,l));
      return !!line&&lineFilled(p,line)&&e.category==="extension"&&e.extensionId==="border-posts"&&Object.values(PHASE_COMPLETION_POINTS).includes(e.points as 10)&&e.source.document==="project-user-rule";
    });
  });
}
