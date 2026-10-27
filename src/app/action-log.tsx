import type {Tile} from "../game/types";
import {readActionLog} from "../game/action-log";
import {VINE_TILES} from "../game/vineyards";
import {TileArt} from "./tile-art";
import {VineTile} from "./vineyard-board";
import {WhiteDie} from "./white-die";
import {PLAYER_PALETTE} from '../game/player-colors';

export function ActionLog({record,tiles}:{record:string;tiles:Readonly<Record<string,Tile>>}){
 const log=readActionLog(record),tile=log.tileId?tiles[log.tileId]:undefined;
 return <span className="action-log-entry">{tile?<span className="action-log-tile"><TileArt tile={tile}/></span>:log.tileId&&VINE_TILES[log.tileId]?<VineTile id={log.tileId}/>:null}<span>{log.text}</span>{log.dice.map((d,i)=><span className="action-log-die" data-die-source={d.source??'player'} data-player-color={d.color} key={i}>{d.source==='white'?'흰 주사위':d.source==='bonus'?'추가 행동':`주사위 ${d.index}`}<svg width="24" height="24" viewBox="0 0 28 28" aria-label={`눈금 ${d.value??'자유'}`}><WhiteDie x={14} y={14} value={d.value} color={d.color?PLAYER_PALETTE[d.color].fill:undefined}/></svg></span>)}</span>;
}
