"use client";
import {useState} from 'react';
import type {GameAction,GoodsTile} from '../game/types';
import {GoodsArt} from './tile-art';

export interface GoodsOption {action:GameAction;goodsIds:readonly string[]}
/** A depot click resolves one canonical bundle; overflow selects types, never individual cards. */
export function GoodsSpace({number,goods,x=0,y=0,options=[],onAction,onSelecting}:{number:number;goods:readonly GoodsTile[];x?:number;y?:number;options?:readonly GoodsOption[];onAction?:(a:GameAction)=>void;onSelecting?:()=>void}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<number[]>([]);
 const types=[...new Set(goods.map(g=>g.type))].sort();
 const contains=(o:GoodsOption,type:number)=>goods.filter(g=>g.type===type).every(g=>o.goodsIds.includes(g.id));
 const candidates=options.filter(o=>selected.every(t=>contains(o,t)));
 const key=(e:React.KeyboardEvent,run:()=>void)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();run();}};
 function chooseDepot(){if(options.length===1)onAction?.(options[0].action);else if(options.length){setOpen(true);onSelecting?.();}}
 function chooseType(type:number){if(selected.includes(type)){setSelected(selected.filter(t=>t!==type));return;}const next=candidates.filter(o=>contains(o,type));if(next.length===1)onAction?.(next[0].action);else if(next.length)setSelected([...selected,type]);}
 return <g className={`goods-space${options.length?' direct-legal':''}`} data-goods-selecting={open}>
  <rect data-goods-space={number} x={x-46} y={y-46} width="92" height="92" rx="2" fill="#fcf6df" stroke={options.length?'#ab782b':'#bbad7f'} strokeWidth={options.length?2:1} role="button" tabIndex={options.length?0:-1} aria-label={`${number}번 상품 보관함 선택`} aria-disabled={!options.length} onClick={chooseDepot} onKeyDown={e=>key(e,chooseDepot)}><title>{options.length?'이 공급처의 상품을 획득합니다.':'현재 상품 획득 대상으로 선택할 수 없습니다.'}</title></rect>
  {types.map((type,i)=>{const enabled=open&&(selected.includes(type)||candidates.some(o=>contains(o,type))&&!candidates.every(o=>contains(o,type)));const tx=x-36+(i%3)*25,ty=y-25+Math.floor(i/3)*31;return <g key={type} pointerEvents={open?undefined:'none'} role={open?'button':undefined} tabIndex={enabled?0:-1} aria-label={`${number}번 공급처 상품 ${type}번 종류 선택`} aria-pressed={open?selected.includes(type):undefined} aria-disabled={open?!enabled:undefined} onClick={()=>open?enabled&&chooseType(type):chooseDepot()} onKeyDown={e=>key(e,()=>open?enabled&&chooseType(type):chooseDepot())} className={enabled?'goods-type-selectable':''} style={{cursor:enabled||!open&&options.length?'pointer':undefined}}>
   {open&&<rect x={tx-1} y={ty-2} width="25" height="31" rx="3" fill={selected.includes(type)?'#d0e2aa':enabled?'#fff1b4':'#e5dfc9'} stroke={enabled?'#a37831':'#c4b998'}/>}
   <GoodsArt value={type} x={tx} y={ty} width="23" height="23"/><text x={tx+12} y={ty+29} textAnchor="middle" fontSize="8" fill="#59422b">×{goods.filter(g=>g.type===type).length}</text>
  </g>;})}
  {!goods.length&&<text x={x} y={y+6} textAnchor="middle" fontSize="10" pointerEvents="none" fill="#84795f">상품</text>}
  <text x={x} y={y+40} textAnchor="middle" fontSize="9" pointerEvents="none" fill="#665035">{open?'가져올 종류 선택':`상품 ${goods.length}개`}</text>
 </g>;
}
