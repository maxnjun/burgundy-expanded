"use client";
import {useEffect,useRef,useState} from 'react';
import type {GameAction} from '../game/types';

export function purchaseMethod(action:GameAction){return action.type==='use-monastery-six'?'수도원 6번 · 일꾼 2개로 구매':action.type==='buy-black-tile'?'은화 2개로 구매':action.type==='use-die'?`일반 주사위 · 일꾼 ${action.adjustment.workersSpent}개로 획득`:'추가 행동으로 획득';}
/** A first tap selects; a quick second tap submits only an unambiguous legal method. */
export function useSupplyPurchase(version:object,onPurchase:(action:GameAction)=>void,onUnavailable:()=>void){
 const [pending,setPending]=useState<{version:object;id:string;actions:readonly GameAction[];show:boolean}|null>(null);
 const last=useRef<{version:object;id:string;at:number}|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[version]);
 useEffect(()=>{const reset=()=>{last.current=null;};const multi=(e:PointerEvent)=>{if(!e.isPrimary)reset();};for(const type of ['scroll','wheel','pointercancel'])window.addEventListener(type,reset,true);window.addEventListener('pointerdown',multi,true);return()=>{for(const type of ['scroll','wheel','pointercancel'])window.removeEventListener(type,reset,true);window.removeEventListener('pointerdown',multi,true);};},[]);
 const current=pending?.version===version?pending:null;
 function choose(action:GameAction){if(current?.actions.includes(action)){clearTimeout(timer.current);last.current=null;setPending(null);onPurchase(action);}}
 function tap(id:string,actions:readonly GameAction[]){
  if(!actions.length){onUnavailable();return;}
  clearTimeout(timer.current);const previous=last.current,now=Date.now();
  if(previous?.version===version&&previous.id===id&&now-previous.at<=400){last.current=null;if(actions.length===1){setPending(null);onPurchase(actions[0]);}else setPending({version,id,actions,show:true});return;}
  last.current={version,id,at:now};setPending({version,id,actions,show:false});timer.current=setTimeout(()=>setPending({version,id,actions,show:true}),410);
 }
 const dialog=current?.show?<section role="dialog" aria-label="구매 방법 선택" className="supply-purchase"><strong>구매 방법 선택</strong>{current.actions.map((a,i)=><button key={i} onClick={()=>choose(a)}>{purchaseMethod(a)}</button>)}<button onClick={()=>{last.current=null;setPending(null);}}>취소</button></section>:null;
 return {tap,selected:current?.id??null,dialog};
}
