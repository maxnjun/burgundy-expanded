import {playerPaint} from '../game/player-colors';
import type {PlayerState} from '../game/types';
export function CurrentScores({players,current,online=false}:{players:readonly PlayerState[];current:string;online?:boolean}){
 return <div className="current-scores" role="region" aria-label="현재 누적 점수">{players.map(p=><span key={p.id} data-score-player={p.id} style={{borderColor:playerPaint(p).fill}}>{online?(p.id===current?'내 점수':'상대 점수'):p.id===current?'현재':''} {p.name} <strong>{p.victoryPoints}점</strong></span>)}</div>;
}
