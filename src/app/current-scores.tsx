import {playerPaint} from '../game/player-colors';
import type {PlayerState,ScoreEntry} from '../game/types';
export function CurrentScores({players,current,online=false,ledger}:{players:readonly PlayerState[];current:string;online?:boolean;ledger?:Readonly<Record<string,readonly ScoreEntry[]>>}){
 const refunds=players.flatMap(p=>(ledger?.[p.id]??[]).filter(e=>e.category==='region-refund').map(e=>({p,e})));
 return <div className="current-scores" role="region" aria-label="현재 누적 점수">{players.map(p=><span key={p.id} data-score-player={p.id} style={{borderColor:playerPaint(p).fill}}>{online?(p.id===current?'내 점수':'상대 점수'):p.id===current?'현재':''} {p.name} <strong>{p.victoryPoints}점</strong></span>)}
  {!!refunds.length&&<details><summary>수도원 31번 지역 점수 반납 내역</summary><ul>{refunds.map(({p,e})=><li key={`${p.id}:${e.id}`}>{p.name} · {e.regionId} · {e.points}점</li>)}</ul></details>}
 </div>;
}
