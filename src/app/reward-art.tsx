import type {PlayerState,GameState} from "../game/types";
import {GoodsArt} from "./tile-art";
import {GRAPES,type Grape} from "../game/vineyards";
import {FRUIT_NAMES,vineyardAsset} from './vineyard-art';

// Estate illustrations remain placeholders; vineyard candy uses the approved source extraction.
export const REWARD_ASSETS={grape:(g:Grape)=>vineyardAsset(g,'candy'),estate:(color:string)=>`/assets/tokens/estate/${color}.svg`};
export function GrapeToken({grape,size=32}:{grape:Grape;size?:number}){
 // eslint-disable-next-line @next/next/no-img-element
 return <img data-grape-token={grape} data-candy-token={grape} src={REWARD_ASSETS.grape(grape)} alt={`${FRUIT_NAMES[grape]} 사탕 토큰`} width={size} height={size} style={{objectFit:'contain'}}/>;
}
export function RewardChoiceLabel({id,label,depots=[]}:{id:string;label:string;depots?:GameState['market']['numberedDepots']}){
 const type=/^shield5:([1-6])$/.exec(id)?.[1];
 if(type){const count=depots.reduce((n,d)=>n+d.goods.filter(g=>g.type===Number(type)).length,0);return <span className="shield-goods-choice" aria-label={`${type}번 상품 ${count}개 획득`}><GoodsArt value={Number(type)} width={52} height={52}/><b>×{count}</b></span>;}
 if(id==='shield5:skip'&&!depots.some(d=>d.goods.length))return '획득할 상품 없음 · 건너뛰기';
 const grape=id.startsWith("vine-token:")?id.slice(11) as Grape:null;
 return grape&&GRAPES.includes(grape)?<GrapeToken grape={grape} size={36}/>:label;
}
export function EarnedBonusTiles({player}:{player:PlayerState}){
 if(!player.bonuses.length)return null;
 return <div className="earned-bonuses" aria-label={`${player.name} 획득 영지 완성 보너스`}>{player.bonuses.map(b=><span key={b.id} data-earned-bonus={b.id} title={`${b.color} · ${b.rank==="first"?"1위":"2위"} · ${b.points}점`}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={REWARD_ASSETS.estate(b.color)} alt="영지 완성 보너스" width={34} height={34}/><b>{b.points}점</b></span>)}</div>;
}
