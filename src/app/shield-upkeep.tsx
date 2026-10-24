"use client";
import {useState} from "react";
import type {PendingChoice} from "../game/types";

type Option=PendingChoice["options"][number];
export const isShieldUpkeep=(options:readonly Option[])=>options.length>0&&options.every(o=>/^(pay|remove):\d+/.test(o.id));

/** Payment and legacy return destinations are follow-up choices, never a removal fee. */
export function ShieldUpkeep({options,disabled,onChoose}:{options:readonly Option[];disabled:boolean;onChoose:(id:string)=>void}){
 const [open,setOpen]=useState("");
 const numbers=[...new Set(options.map(o=>Number(o.id.split(":")[1])))];
 function choose(list:readonly Option[],key:string){if(list.length===1){setOpen("");onChoose(list[0].id);}else setOpen(open===key?"":key);}
 return <div className="shield-upkeep" aria-label="방패 유지 또는 제거">{numbers.map(n=>{
  const keep=options.filter(o=>o.id.startsWith(`pay:${n}:`)),remove=options.filter(o=>o.id===`remove:${n}`||o.id.startsWith(`remove:${n}:`));
  const detail=open===`keep:${n}`?keep:open===`remove:${n}`?remove:[];
  return <div className="shield-upkeep-item" key={n}><strong>방패 {n}</strong><button disabled={disabled||!keep.length} title={keep.length?"은화 1개 또는 방패3의 일꾼 1개로 유지":"유지 비용이 부족합니다."} onClick={()=>choose(keep,`keep:${n}`)}>방패 유지</button><button disabled={disabled||!remove.length} onClick={()=>choose(remove,`remove:${n}`)}>방패 제거</button>{!keep.length&&<small>유지 비용 부족</small>}{detail.length>0&&<div><small>{open.startsWith("keep")?"유지비 지불 방법":"기존 방패의 반환 공급처 선택"}</small>{detail.map(o=><button key={o.id} disabled={disabled} onClick={()=>{setOpen("");onChoose(o.id);}}>{o.id.startsWith("pay:")?o.id.endsWith(":worker")?"일꾼 1개 (방패3)":"은화 1개":`${o.id.split(":").at(-1)}번 공급처로 반환`}</button>)}</div>}</div>;
 })}</div>;
}
