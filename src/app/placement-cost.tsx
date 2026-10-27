import {ResourceGlyph} from './resource-icon';

/** The number is the engine option's exact cost, including monasteries/shields. */
export function PlacementCost({x,y,count}:{x:number;y:number;count:number}){
 return <g data-placement-workers={count} pointerEvents="none" aria-label={count?`배치 일꾼 ${count}개`:'무료 배치'}><rect x={x-22} y={y+18} width={44} height={16} rx={5} fill="#fff6db" stroke="#a78c54"/>{count>0?<><ResourceGlyph type="worker" x={x-19} y={y+19} size={14}/><text x={x+6} y={y+30} textAnchor="middle" fontSize={12} fill="#493318">×{count}</text></>:<text x={x} y={y+30} textAnchor="middle" fontSize={11} fill="#493318">무료</text>}</g>;
}
