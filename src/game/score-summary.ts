import type {ScoreBreakdown,ScoreEntry} from "./types";
export interface ScoreRow {id:string;label:string;points:number;}
const labels:Record<string,string>={livestock:"가축 점수",building:"건물 효과","region-size":"지역 크기","phase-bonus":"지역 완성 단계 보너스","color-bonus":"색상 전체 완성","goods-sale":"상품 판매","remaining-goods":"남은 상품","remaining-silver":"남은 은화","remaining-workers":"남은 일꾼",monastery:"수도원",extension:"기타 확장"};
function label(e:ScoreEntry){
 const monk=e.id.match(/monastery-(\d+)$/),shield=e.id.match(/shield-(\d+)$/);
 if(monk)return `수도원${monk[1]}${monk[1]==="29"?" 흰 성":""}`;
 if(shield)return `방패 ${shield[1]}`;
 if(e.id.endsWith("crane-building"))return "기중기 건물 보너스";
 if(e.extensionId==="vineyards")return e.id.endsWith("vineyards")?"포도밭 토큰 점수":"포도밭 배치 보상";
 if(e.category==="extension")return e.source.section;
 return labels[e.category]??e.source.section;
}
/** Engine totals stay authoritative; historical points without a ledger are explicitly unclassified. */
export function scoreRows(score:ScoreBreakdown):{earned:ScoreRow[];final:ScoreRow[]}{
 const groups=new Map<string,ScoreRow>();for(const entry of score.earned){const key=entry.category==="extension"?`extension:${entry.extensionId??entry.source.section}`:entry.category;const old=groups.get(key);groups.set(key,{id:key,label:old?.label??label(entry),points:(old?.points??0)+entry.points});}
 const earned=[...groups.values()],recorded=earned.reduce((n,r)=>n+r.points,0);
 if(recorded!==score.earnedTotal)earned.push({id:"unclassified",label:"기록 없는 누적 점수 / 기록 차이",points:score.earnedTotal-recorded});
 const final=score.finalAdditions.map(e=>({id:e.id,label:label(e),points:e.points}));
 const delta=score.total-score.earnedTotal-final.reduce((n,r)=>n+r.points,0);if(delta)final.push({id:"unclassified-final",label:"종료 기록 차이 (미분류)",points:delta});
 return {earned,final};
}
