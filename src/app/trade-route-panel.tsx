"use client";
import {useState} from "react";
import {CUSTOM_TRADE_CATALOG,TRADE_REWARD_NAMES,customTradeSpaces,type CustomTradeRoute,type TradeReward} from "../game/custom-trade-routes";
import {GoodsArt,GoodsBackArt} from "./tile-art";
import {RewardEffectArt} from "./reward-effect-art";

export function TradeRoutePanel({route,name}:{route:CustomTradeRoute|undefined;name:string}){
 const [expanded,setExpanded]=useState(false);if(!route)return null;
 const done=route.sales.length,total=customTradeSpaces(route).length,current=Math.min(Math.floor(done/3),route.tileIds.length-1);
 return <section className="trade-route-panel" aria-label={`${name} 커스텀 무역로`}>
  <header><strong>무역로 {current+1}/{route.tileIds.length} · {done}/{total}칸 완료{done===total?" · 전체 완료":""}</strong><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"무역로 접기":"전체 무역로 펼치기"}</button></header>
  <div className="trade-route-cards">{route.tileIds.map((id,cardIndex)=>{if(!expanded&&cardIndex!==current)return null;const card=CUSTOM_TRADE_CATALOG.find(t=>t.id===id)!;return <div className="trade-route-card" data-trade-card={id} key={id}><small>카드 {id}{cardIndex<current?" · 완료":""}</small><div>{card.spaces.map((space,i)=>{const index=cardIndex*3+i,sale=route.sales[index],reward=space.bonusId as TradeReward,matched=!!sale&&sale.status!=="mismatch";return <div key={i} data-trade-cell={index} data-trade-next={index===done} data-trade-status={sale?.status??"empty"} data-tile-help="trade-route" className={`trade-route-cell${index===done?" next":""}`}><GoodsArt value={space.goodsType} width="50" height="50"/><div className="trade-route-reward"><RewardEffectArt effect={reward} label={TRADE_REWARD_NAMES[reward]} width="94" height="76"/></div>{sale&&<span className="trade-route-result">{matched?(sale.status==="pending"?"선택 대기":sale.status==="skipped"?"사용 안함":"보상 완료"):<GoodsBackArt width="42" height="42" aria-label="상품 뒷면 · 색상 불일치"/>}</span>}</div>;})}</div></div>;})}</div>
  <small role="status">{done===total?"경로 완료 · 이후에도 상품 판매는 계속할 수 있습니다.":"상품 종류별 판매 1회 → 1칸. 성·흰 성·창고 등 보너스 판매도 포함합니다."}</small>
 </section>;
}
