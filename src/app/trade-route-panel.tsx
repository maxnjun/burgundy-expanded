"use client";
import {useState} from "react";
import {CUSTOM_TRADE_CATALOG,TRADE_REWARD_NAMES,customTradeSpaces,type CustomTradeRoute,type TradeReward} from "../game/custom-trade-routes";
import {GoodsArt,TileArt} from "./tile-art";

export function TradeRoutePanel({route,name}:{route:CustomTradeRoute|undefined;name:string}){
 const [expanded,setExpanded]=useState(false);if(!route)return null;
 const done=route.sales.length,total=customTradeSpaces(route).length,current=Math.min(Math.floor(done/3),route.tileIds.length-1);
 return <section className="trade-route-panel" aria-label={`${name} 커스텀 무역로`}>
  <header><strong>무역로 {current+1}/{route.tileIds.length} · {done}/{total}칸 완료{done===total?" · 전체 완료":""}</strong><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"무역로 접기":"전체 무역로 펼치기"}</button></header>
  <div className="trade-route-cards">{route.tileIds.map((id,cardIndex)=>{if(!expanded&&cardIndex!==current)return null;const card=CUSTOM_TRADE_CATALOG.find(t=>t.id===id)!;return <div className="trade-route-card" data-trade-card={id} key={id}><small>카드 {id}{cardIndex<current?" · 완료":""}</small><div>{card.spaces.map((space,i)=>{const index=cardIndex*3+i,sale=route.sales[index],reward=space.bonusId as TradeReward,matched=!!sale&&sale.status!=="mismatch";return <div key={i} data-trade-cell={index} data-trade-next={index===done} data-trade-status={sale?.status??"empty"} className={`trade-route-cell${index===done?" next":""}`}><GoodsArt value={space.goodsType} width="30" height="30"/><TileArt tile={{id:`trade-icon:${id}:${i}`,type:"building",building:reward,back:"matching-color"}} width="35" height="40"/><span>{TRADE_REWARD_NAMES[reward]}</span>{sale&&<span className="trade-route-result">{matched?(sale.status==="pending"?"선택 대기":sale.status==="skipped"?"사용 안함":"보상 완료"):<svg data-goods-back="true" width="30" height="30" viewBox="0 0 30 30" aria-label="상품 뒷면 · 색상 불일치"><rect x="1" y="1" width="28" height="28" rx="3" fill="#84643c" stroke="#cfb77e"/><path d="M5 15 15 5 25 15 15 25Z" fill="none" stroke="#ead49a"/><path d="M9 15H21M15 9V21" stroke="#ead49a"/></svg>}</span>}</div>;})}</div></div>;})}</div>
  <small role="status">{done===total?"경로 완료 · 이후에도 상품 판매는 계속할 수 있습니다.":"주사위로 직접 판매한 행동 1회 → 1칸. 보상에서 파생된 판매는 진행하지 않습니다."}</small>
 </section>;
}
