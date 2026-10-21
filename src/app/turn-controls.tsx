"use client";
import {useRef} from 'react';
export function TurnControls({undoReason,stepReason,endReason,onUndo,onStep,onEnd,state}:{undoReason:string;stepReason:string;endReason:string;onUndo:()=>void|Promise<void>;onStep:()=>void|Promise<void>;onEnd:()=>void|Promise<void>;state:object}){
 const submitted=useRef<object|null>(null);
 async function execute(reason:string,action:()=>void|Promise<void>){if(reason||submitted.current===state)return;submitted.current=state;try{await action();}finally{if(submitted.current===state)submitted.current=null;}}
 return <div className="turn-controls" aria-label="차례 제어">
  <button type="button" title={undoReason||'되돌리기'} disabled={!!undoReason} onClick={()=>execute(undoReason,onUndo)}>되돌리기</button>
  <button type="button" title={stepReason||'이전 행동으로'} disabled={!!stepReason} onClick={()=>execute(stepReason,onStep)}>이전 행동으로</button>
  <button type="button" title={endReason||'턴 종료'} disabled={!!endReason} onClick={()=>execute(endReason,onEnd)}>턴 종료</button>
 </div>;
}
