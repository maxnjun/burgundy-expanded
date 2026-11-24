import {useState} from 'react';
import type {GameAction,GameState,PlayerState} from '../game/types';
import {playerPaint} from '../game/player-colors';
import {WhiteDie} from './white-die';
import {DIE_CHANGE_COMMANDS,type DiceShieldStatus} from '../game/shields';
import {diceShieldStatusText} from './shield-art';

type Dice=GameState['dice']['players'][string];
export function ShieldDieChange({number=16,dice,player,actions,disabled=false,status,onAction}:{number?:16|21;dice:Dice;player:PlayerState;actions:readonly GameAction[];disabled?:boolean;status?:DiceShieldStatus;onAction:(a:GameAction)=>void}){
 const [chosen,setChosen]=useState<string|null>(null);
 const name=`방패${number}`;
 if(status&&status!=="ready")return <fieldset className="shield-dice-change" disabled aria-label={`${name} 주사위 변경`} data-shield-dice-inactive data-shield-dice-status={status}><legend>{name} · 주사위 변경</legend><p>{diceShieldStatusText(number,status)}</p></fieldset>;
 const changes=actions.filter((a):a is Extract<GameAction,{type:'extension'}>=>a.type==='extension'&&a.extensionId==='shields'&&a.command===DIE_CHANGE_COMMANDS[number]);
 if(!changes.length)return null;
 const selected=dice.find(d=>d.id===chosen&&!d.used)?.id??dice.find(d=>!d.used)?.id;
 return <fieldset className="shield-dice-change" disabled={disabled} aria-label={`${name} 주사위 변경`}><legend>{name} · 변경할 주사위 → 새 눈금</legend><div>{dice.map((d,i)=><button key={d.id} aria-label={`${name} 변경 대상 주사위 ${i+1}`} aria-pressed={selected===d.id} disabled={d.used} onClick={()=>setChosen(d.id)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={d.value} color={playerPaint(player).fill}/></svg></button>)}</div><div>{changes.filter(a=>(a.payload as {dieId:string}).dieId===selected).map(a=>{const value=(a.payload as {value:number}).value;return <button key={value} aria-label={`${name} 눈금 ${value}로 변경`} onClick={()=>onAction(a)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={value}/></svg></button>;})}</div></fieldset>;
}
export function ShieldExtraDie({actions,status,disabled,onAction}:{actions:readonly GameAction[];status?:DiceShieldStatus;disabled?:boolean;onAction:(action:GameAction)=>void}){
 if(!status)return null;
 const action=actions.find(a=>a.type==='extension'&&a.extensionId==='shields'&&a.command==='use-extra-die');
 return <button className="shield-dice-change" disabled={disabled||!action} data-shield-dice-status={status} data-shield-dice-inactive={status==="used"||undefined} title={diceShieldStatusText(22,status)} onClick={()=>{if(action)onAction(action);}}>
  {status==="used"?"방패22 · 이번 페이즈 사용 완료":"방패22 · 세 번째 주사위 굴리기"}
 </button>;
}
export function ShieldPairDice({dice,player,ids,selected,onSelect}:{dice:Dice;player:PlayerState;ids:readonly string[];selected:string;onSelect:(id:string)=>void}){
 return <fieldset className="shield-pair-dice" aria-label="방패 결합 주사위"><legend>보상 주사위 + 결합할 내 주사위 1개</legend>{dice.map((d,i)=><button key={d.id} disabled={!ids.includes(d.id)} aria-label={`방패 결합 주사위 ${i+1}`} aria-pressed={selected===d.id} onClick={()=>onSelect(d.id)}><svg width="32" height="32" viewBox="0 0 28 28"><WhiteDie x={14} y={14} value={d.value} color={playerPaint(player).fill}/></svg><span>{d.used?'사용 완료':`주사위 ${i+1}`}</span></button>)}</fieldset>;
}
