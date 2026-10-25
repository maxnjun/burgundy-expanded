import type {PlayerState} from "../game/types";
import {GRAPES,GRAPE_NAMES,type Grape} from "../game/vineyards";

// Replace these placeholder SVG paths when approved token illustrations arrive.
export const REWARD_ASSETS={grape:(g:Grape)=>`/assets/tokens/grape/${g.toLowerCase()}.svg`,estate:(color:string)=>`/assets/tokens/estate/${color}.svg`};
export function GrapeToken({grape,size=32}:{grape:Grape;size?:number}){
 // eslint-disable-next-line @next/next/no-img-element
 return <img data-grape-token={grape} src={REWARD_ASSETS.grape(grape)} alt={`${GRAPE_NAMES[grape]} 포도 점수 토큰`} width={size} height={size}/>;
}
export function RewardChoiceLabel({id,label}:{id:string;label:string}){
 const grape=id.startsWith("vine-token:")?id.slice(11) as Grape:null;
 return grape&&GRAPES.includes(grape)?<GrapeToken grape={grape} size={48}/>:label;
}
export function EarnedBonusTiles({player}:{player:PlayerState}){
 if(!player.bonuses.length)return null;
 return <div className="earned-bonuses" aria-label={`${player.name} 획득 영지 완성 보너스`}>{player.bonuses.map(b=><span key={b.id} data-earned-bonus={b.id} title={`${b.color} · ${b.rank==="first"?"1위":"2위"} · ${b.points}점`}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={REWARD_ASSETS.estate(b.color)} alt="영지 완성 보너스" width={34} height={34}/><b>{b.points}점</b></span>)}</div>;
}
