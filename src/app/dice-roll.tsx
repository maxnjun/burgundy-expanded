import {useEffect,useRef,useState,type CSSProperties} from "react";
import type {DieValue,GameAction,PlayerDie} from "../game/types";

type RollKind="round"|"extra";
type Roll={kind:RollKind;playerId:string};
const faces=["","⚀","⚁","⚂","⚃","⚄","⚅"];
export const diceRollingText="주사위를 굴리고 있습니다.";

export function rollForAction(action:GameAction):Roll|null{
  if(action.type==="roll-round")return {kind:"round",playerId:action.playerId};
  if(action.type==="extension"&&action.extensionId==="shields"&&action.command==="use-extra-die")return {kind:"extra",playerId:action.playerId};
  return null;
}

export function useDiceRoll(){
  const [roll,setRoll]=useState<Roll|null>(null);
  const current=useRef<Roll|null>(null);
  useEffect(()=>()=>{current.current=null;},[]);

  function start(next:Roll,submit?:()=>void|Promise<void>){
    if(current.current)return;
    current.current=next;
    setRoll(next);
    const finish=()=>{if(current.current===next){current.current=null;setRoll(null);}};
    const elapsed=new Promise<void>(resolve=>setTimeout(resolve,700));
    void Promise.allSettled([elapsed,submit?.()]).then(finish);
  }
  return {roll,start,active:()=>current.current!==null};
}

export function shownDice(dice:readonly PlayerDie[],roll:Roll|null):readonly PlayerDie[]{
  if(roll?.kind==="extra"&&dice.length===2)return [...dice,{id:`${roll.playerId}:c`,value:1,used:false}];
  return dice;
}

export function DieFace({value,index,rolling,confirmed=true}:{value:DieValue;index:number;rolling?:boolean;confirmed?:boolean}){
  return rolling?<TumblingFace value={value} index={index} confirmed={confirmed}/>:faces[value];
}

function TumblingFace({value,index,confirmed}:{value:DieValue;index:number;confirmed:boolean}){
  const [frame,setFrame]=useState(1+index*2);
  const [landed,setLanded]=useState(false);
  const stop=560+index*60;
  useEffect(()=>{
    const timer=setTimeout(()=>setLanded(true),stop);
    return ()=>clearTimeout(timer);
  },[stop]);
  const cycling=!landed||!confirmed;
  useEffect(()=>{
    if(!cycling||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const timer=setInterval(()=>setFrame(face=>face%6+1),68+index*5);
    return ()=>clearInterval(timer);
  },[cycling,index]);
  const motion={"--dice-motion-time":`${stop-index*22}ms`,"--dice-motion-delay":`${index*22}ms`} as CSSProperties;
  return <span className="starter-tumbling game-die-tumbling" style={motion} aria-hidden="true" data-die-rolling={cycling||undefined}>
    {cycling?faces[frame]:faces[value]}
  </span>;
}
