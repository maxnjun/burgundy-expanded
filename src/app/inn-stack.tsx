import type { GameState } from "../game/types";
import { TileArt } from "./tile-art";

export const INN_STACK = { x:215, y:398, width:40, stepX:1.4, stepY:1.8 } as const;
/** One hit target; all lower artwork is decorative. No changes to market coordinates. */
export function InnStack({game,onSelect,canBuy}:{game:Pick<GameState,"tiles">&{market:Pick<GameState["market"],"inns">};onSelect:(id:string)=>void;canBuy:(id:string)=>boolean}){
 const supply=game.market.inns;
 if(!supply)return null;
 const top=supply.stack.at(-1),{x,y,width,stepX,stepY}=INN_STACK,h=width*2/Math.sqrt(3);
 const outline=(cx:number,cy:number)=>`M${cx},${cy-h/2}L${cx+width/2},${cy-h/4}L${cx+width/2},${cy+h/4}L${cx},${cy+h/2}L${cx-width/2},${cy+h/4}L${cx-width/2},${cy-h/4}Z`;
 return <g data-inn-stack="true" role={top?"button":"img"} tabIndex={top?0:undefined} aria-label={`여관 ${supply.stack.length}개 · 은화 2 · 검은 구매와 턴당 1회 공유`} aria-disabled={top?!canBuy(top):undefined} onClick={()=>{if(top&&canBuy(top))onSelect(top);}} onKeyDown={e=>{if(top&&canBuy(top)&&["Enter"," "].includes(e.key)){e.preventDefault();onSelect(top);}}} className="inn-stack">
   <title>여관 · 모든 색상 배치 · 구역당 1개 · 완성 크기 +1</title>
   <g pointerEvents="none">{supply.stack.map((id,i)=>{const depth=supply.stack.length-1-i;return <g key={id} data-inn-layer={i}><ellipse cx={x-depth*stepX} cy={y+h/2+depth*stepY} rx={width*.43} ry="2" fill="#51341e" opacity=".2"/><TileArt tile={game.tiles[id]} x={x-width/2-depth*stepX} y={y-h/2+depth*stepY} width={width} height={h}/></g>;})}
   {!top&&<path d={`M${x} ${y-h/2}l${width/2} ${h/4}v${h/2}l${-width/2} ${h/4}l${-width/2} ${-h/4}v${-h/2}Z`} fill="none" stroke="#9b875e" strokeDasharray="3 3"/>}
   <text x={x-36} y={y-17} fontSize="8" fill="#65451f">銀2</text>
   <circle cx={x-34} cy={y+2} r="7" fill="#fff1c0" stroke="#9e7133" strokeWidth=".8"/>
   <text x={x-34} y={y+5} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#65451f">{supply.stack.length}</text></g>
   {top&&<path data-inn-hit="true" d={supply.stack.map((_,i)=>{const depth=supply.stack.length-1-i;return outline(x-depth*stepX,y+depth*stepY);}).join(" ")} fill="transparent"/>}
 </g>;
}
