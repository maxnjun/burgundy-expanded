import type {Tile,PlayerState} from "../game/types";
import {readActionLog} from "../game/action-log";
import {VINE_TILES} from "../game/vineyards";
import {TileArt} from "./tile-art";
import {VineTile} from "./vineyard-board";
import {WhiteDie} from "./white-die";
import {PLAYER_PALETTE,playerPaint} from '../game/player-colors';

const separator=" · ";
function nameOffset(text:string,name:string,structured:boolean){
 if(text.startsWith(name+separator)||(!structured&&text.startsWith(name+": ")))return 0;
 if(structured){
  const offset=text.indexOf(separator+name+separator);
  return offset<0?-1:offset+separator.length;
 }
 for(const start of ["첫 차례는 ","새 게임을 시작했습니다. 첫 차례는 "]){
  if(text===start+name+"입니다.")return start.length;
 }
 return -1;
}

export function ActionLog({record,tiles,players,showPlayerMarker=false}:{record:string;tiles:Readonly<Record<string,Tile>>;players:readonly PlayerState[];showPlayerMarker?:boolean}){
 const log=readActionLog(record),tile=log.tileId?tiles[log.tileId]:undefined;
 const actor=log.playerId?players.find(p=>p.id===log.playerId):
  players.filter(p=>nameOffset(log.text,p.name,false)>=0).sort((a,b)=>b.name.length-a.name.length)[0];
 const offset=actor?nameOffset(log.text,actor.name,!!log.playerId):-1;
 const color=log.playerColor?PLAYER_PALETTE[log.playerColor]:actor?playerPaint(actor):undefined;
 return <span className="action-log-entry">
  {showPlayerMarker&&color&&(log.playerId||log.playerColor)&&<span className="log-player-color" style={{background:color.fill}} title={actor?.name??"행동 플레이어"}/>}
  {tile?<span className="action-log-tile"><TileArt tile={tile}/></span>:log.tileId&&VINE_TILES[log.tileId]?<VineTile id={log.tileId}/>:null}
  <span className="action-log-text">{actor&&offset>=0?<>
   {log.text.slice(0,offset)}
   <strong className="action-log-player" style={{color:color?.ink}}>{actor.name}</strong>
   {log.text.slice(offset+actor.name.length)}
  </>:log.text}</span>
  {log.dice.map((d,i)=><span className="action-log-die" data-die-source={d.source??'player'} data-player-color={d.color} key={i}>{d.source==='white'?'흰 주사위':d.source==='bonus'?'추가 행동':`주사위 ${d.index}`}<svg width="24" height="24" viewBox="0 0 28 28" aria-label={`눈금 ${d.value??'자유'}`}><WhiteDie x={14} y={14} value={d.value} color={d.color?PLAYER_PALETTE[d.color].fill:undefined}/></svg></span>)}
 </span>;
}
