import {useId} from 'react';
import type {TileType} from '../game/types';
import {estateCenter,estatePoints,ESTATE_RADIUS,ESTATE_HALF_WIDTH} from './estate-geometry';
import {WhiteDie} from './white-die';
import {useDesign1} from './design-settings';

const terrainDice:Record<string,{face:string;pips:string}>={
 livestock:{face:'#dbebaa',pips:'#344b27'},castle:{face:'#25644f',pips:'#fff6dc'},
 building:{face:'#e8ce9d',pips:'#513a20'},monastery:{face:'#f9df82',pips:'#594416'},
 mine:{face:'#e0ded4',pips:'#454842'},ship:{face:'#b5e2ef',pips:'#254552'},
};
export function EmptyEstateCell({coord,terrain,value}:{coord:{q:number;r:number};terrain:TileType;value:number}){
 const id=`terrain-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`,{x,y}=estateCenter(coord),die=terrainDice[terrain]??terrainDice.building;
 const enabled=useDesign1();
 if(!enabled)return <WhiteDie x={x} y={y} value={value} size={36}/>;
 return <g data-terrain-surface={terrain} pointerEvents="none" aria-hidden="true">
  <defs><clipPath id={id}><polygon points={estatePoints(coord)}/></clipPath></defs>
  <image href={`/assets/textures/terrain-${terrain in terrainDice?terrain:'building'}.webp`} x={x-ESTATE_HALF_WIDTH} y={y-ESTATE_RADIUS} width={2*ESTATE_HALF_WIDTH} height={2*ESTATE_RADIUS} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>
  <polygon points={estatePoints(coord,1.5)} fill="none" stroke="#fff1b8" strokeOpacity=".3" strokeWidth=".7"/>
  <WhiteDie x={x} y={y} value={value} size={36} color={die.face} pipColor={die.pips} raised/>
 </g>;
}

export function VineyardCellSurface({points,x,y,radius,layer,variant}:{points:string;x:number;y:number;radius:number;layer:number;variant:number}){
 const id=`vine-surface-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
 const enabled=useDesign1();
 if(!enabled)return null;
 return <g data-vine-surface={layer} pointerEvents="none" aria-hidden="true">
  <defs><clipPath id={id}><polygon points={points}/></clipPath></defs>
  <image href={`/assets/textures/vineyard-${layer}-${variant%2}.webp`} x={x-radius} y={y-radius} width={radius*2} height={radius*2} clipPath={`url(#${id})`}/>
 </g>;
}
