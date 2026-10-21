"use client";
import {startTransition,useEffect,useId,useRef,useState} from "react";
export function TurnControls({undoReason,stepReason,endReason,onUndo,onStep,onEnd,endState,endRequest=0,purchaseAvailable=false}:{undoReason:string;stepReason:string;endReason:string;onUndo:()=>void;onStep:()=>void;onEnd:()=>void;endState:object|null;endRequest?:number;purchaseAvailable?:boolean}){
 const [prompt,setPrompt]=useState<object|null>(null);
 const descriptionId=useId();
 const seen=useRef<object|null>(null),request=useRef(0),submitting=useRef(false),dialog=useRef<HTMLDialogElement>(null);
 // Object identity also detects Undo/import; polling the same online revision stays stable.
 useEffect(()=>{
  if(!endState||endReason||prompt&&prompt!==endState){
   if(prompt&&prompt!==endState){seen.current=endState;request.current=endRequest;}
   if(prompt)startTransition(()=>setPrompt(null));
   return;
  }
  if(seen.current!==endState||request.current!==endRequest){
   seen.current=endState;request.current=endRequest;submitting.current=false;
   startTransition(()=>setPrompt(endState));
  }
 },[endState,endReason,endRequest,prompt]);
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  if(prompt&&prompt===endState&&!endReason){if(!element.open)element.showModal();}
  else if(element.open)element.close();
 },[prompt,endState,endReason]);
 function ask(){if(!endState||endReason)return;seen.current=endState;request.current=endRequest;submitting.current=false;setPrompt(endState);}
 function finish(){if(!prompt||prompt!==endState||endReason||submitting.current)return;submitting.current=true;setPrompt(null);onEnd();}
 return <><div className="turn-controls" aria-label="차례 제어">
  <button type="button" title={undoReason||"되돌리기"} disabled={!!undoReason} onClick={onUndo}>되돌리기</button>
  <button type="button" title={stepReason||"이전 행동으로"} disabled={!!stepReason} onClick={onStep}>이전 행동으로</button>
  <button type="button" title={endReason||"턴 종료"} disabled={!!endReason} onClick={ask}>턴 종료</button>
 </div>
 <dialog ref={dialog} role="alertdialog" aria-label="턴 종료 확인" aria-describedby={descriptionId} className="turn-end-dialog" onCancel={e=>{e.preventDefault();setPrompt(null);}}>
  <p id={descriptionId}>{purchaseAvailable?"턴을 종료하시겠습니까? (은화 구매 가능)":"턴을 종료하시겠습니까?"}</p>
  <div className="turn-controls"><button type="button" disabled={!prompt||prompt!==endState||!!endReason} onClick={finish}>턴 종료</button><button type="button" autoFocus onClick={()=>setPrompt(null)}>취소</button></div>
 </dialog></>;
}
