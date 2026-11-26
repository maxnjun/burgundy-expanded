import {assetUrl} from "./runtime-assets";
import {useId} from 'react';
import type {TileType} from '../game/types';
import {estateCenter,estatePoints,ESTATE_RADIUS,ESTATE_HALF_WIDTH} from './estate-geometry';
import {WhiteDie} from './white-die';
import {useDesign1,useEstateTheme} from './design-settings';

export function EstateDecoration(){
 const theme=useEstateTheme(),dialId=`estate-dial-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
 if(theme==='estate-theme-1')return null;
 const assets='/assets/textures/estate-themes/';
 return <g data-estate-decoration={theme} pointerEvents="none" aria-hidden="true">
  <path className="estate-corner-line" d="M116 12H14V92 M504 12H606V92 M14 472V553H116 M606 472V553H504" fill="none" strokeWidth="1.25" vectorEffect="non-scaling-stroke"/>
  {theme==='estate-theme-2'&&<image data-estate-ornament="crest" href={assetUrl(assets+'royal-crest.webp')} x="37" y="20" width="57" height="61" preserveAspectRatio="xMidYMid meet"/>}
  {theme==='estate-theme-3'&&<>
   <image data-estate-ornament="abbey" href={assetUrl(assets+'alpine-landscape.webp')} x="33" y="18" width="45" height="66" preserveAspectRatio="xMidYMid meet"/>
   <image data-estate-ornament="glass" href={assetUrl(assets+'alpine-glass.webp')} x="85" y="18" width="13" height="66" preserveAspectRatio="xMidYMid meet"/>
  </>}
  {theme==='estate-theme-4'&&<svg data-estate-ornament="compass" x="31" y="17" width="69" height="68" viewBox="0 0 100 96">
   <defs><clipPath id={dialId}><circle cx="50" cy="45" r="41"/></clipPath></defs>
   <circle cx="50" cy="45" r="44" fill="#5c391e" stroke="#604423" strokeWidth="2"/>
   <image href={assetUrl(assets+'map-compass.webp')} width="100" height="96" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${dialId})`}/>
   <circle cx="50" cy="45" r="42.5" fill="none" stroke="#c5954c" strokeWidth="3"/>
   <circle cx="50" cy="45" r="44.5" fill="none" stroke="#f1d391" strokeWidth="1"/>
  </svg>}
 </g>;
}

const terrainDice:Record<string,{face:string;pips:string}>={
 livestock:{face:'#dbebaa',pips:'#344b27'},castle:{face:'#25644f',pips:'#fff6dc'},
 building:{face:'#e8ce9d',pips:'#513a20'},monastery:{face:'#f9df82',pips:'#594416'},
 mine:{face:'#e0ded4',pips:'#454842'},ship:{face:'#b5e2ef',pips:'#254552'},
};
export function EmptyEstateCell({coord,terrain,value}:{coord:{q:number;r:number};terrain:TileType;value:number}){
 const id=`terrain-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`,{x,y}=estateCenter(coord),die=terrainDice[terrain]??terrainDice.building;
 const enabled=useDesign1(),legacy=useEstateTheme()==='estate-theme-1';
 if(legacy&&!enabled)return <WhiteDie x={x} y={y} value={value} size={36}/>;
 return <g data-terrain-surface={terrain} pointerEvents="none" aria-hidden="true">
  <defs><clipPath id={id}><polygon points={estatePoints(coord)}/></clipPath></defs>
  <image href={assetUrl(`/assets/textures/terrain-${terrain in terrainDice?terrain:'building'}.webp`)} x={x-ESTATE_HALF_WIDTH} y={y-ESTATE_RADIUS} width={2*ESTATE_HALF_WIDTH} height={2*ESTATE_RADIUS} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>
  {legacy&&<polygon points={estatePoints(coord,1.5)} fill="none" stroke="#fff1b8" strokeOpacity=".3" strokeWidth=".7"/>}
  <WhiteDie x={x} y={y} value={value} size={36} color={legacy?die.face:undefined} pipColor={legacy?die.pips:undefined} raised/>
 </g>;
}

export function VineyardCellSurface({points,x,y,radius,layer,variant}:{points:string;x:number;y:number;radius:number;layer:number;variant:number}){
 const id=`vine-surface-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
 const enabled=useDesign1();
 if(!enabled)return null;
 return <g data-vine-surface={layer} pointerEvents="none" aria-hidden="true">
  <defs><clipPath id={id}><polygon points={points}/></clipPath></defs>
  <image href={assetUrl(`/assets/textures/vineyard-${layer}-${variant%2}.webp`)} x={x-radius} y={y-radius} width={radius*2} height={radius*2} clipPath={`url(#${id})`}/>
 </g>;
}
