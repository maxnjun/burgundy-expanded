import {useState} from 'react';
import type {GameAction,GameState,PlayerState} from '../game/types';
import {playerPaint} from '../game/player-colors';
import {WhiteDie} from './white-die';

type Dice=GameState['dice']['players'][string];
export function ShieldDieChange({dice,player,actions,disabled=false,onAction}:{dice:Dice;player:PlayerState;actions:readonly GameAction[];disabled?:boolean;onAction:(a:GameAction)=>void}){
 const [chosen,setChosen]=useState<string|null>(null);
 const changes=actions.filter((a):a is Extract<GameAction,{type:'extension'}>=>a.type==='extension'&&a.extensionId==='shields'&&a.command==='change-die');
 if(!changes.length)return null;
 const selected=dice.find(d=>d.id===chosen&&!d.used)?.id??dice.find(d=>!d.used)?.id;
 return <fieldset className="shield-dice-change" disabled={disabled} aria-label="방패16 주사위 변경"><legend>방패16 · 변경할 주사위 → 새 눈금</legend><div>{dice.map((d,i)=><button key={d.id} aria-label={`방패16 변경 대상 주사위 ${i+1}`} aria-pressed={selected===d.id} disabled={d.used} onClick={()=>setChosen(d.id)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={d.value} color={playerPaint(player).fill}/></svg></button>)}</div><div>{changes.filter(a=>(a.payload as {dieId:string}).dieId===selected).map(a=>{const value=(a.payload as {value:number}).value;return <button key={value} aria-label={`방패16 눈금 ${value}로 변경`} onClick={()=>onAction(a)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={value}/></svg></button>;})}</div></fieldset>;
}
export function ShieldPairDice({dice,player,ids,selected,onSelect}:{dice:Dice;player:PlayerState;ids:readonly string[];selected:string;onSelect:(id:string)=>void}){
 return <fieldset className="shield-pair-dice" aria-label="방패 결합 주사위"><legend>보상 주사위 + 결합할 내 주사위 1개</legend>{dice.map((d,i)=><button key={d.id} disabled={!ids.includes(d.id)} aria-label={`방패 결합 주사위 ${i+1}`} aria-pressed={selected===d.id} onClick={()=>onSelect(d.id)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={d.value} color={playerPaint(player).fill}/></svg><span>{d.used?'사용 완료':`주사위 ${i+1}`}</span></button>)}</fieldset>;
}
