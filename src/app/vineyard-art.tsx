import {assetUrl} from "./runtime-assets";
import manifest from '../../public/assets/vineyards/manifest.json';
import masks from '../../public/assets/vineyards/illustration-masks/manifest.json';
import {useId} from 'react';
import type {Grape} from '../game/vineyards';

export const FRUIT_ASSETS=Object.fromEntries(manifest.assets.map(a=>[a.grape,a])) as Record<Grape,typeof manifest.assets[number]>;
export const FRUIT_NAMES=Object.fromEntries(manifest.assets.map(a=>[a.grape,a.name])) as Record<Grape,string>;
const visibleWidth=Math.max(...manifest.assets.map(a=>a.fruit.alphaBounds[2]-a.fruit.alphaBounds[0]))/manifest.fruitCanvas;
export const vineyardAsset=(g:Grape,kind:'fruit'|'candy')=>assetUrl(`/assets/vineyards/${FRUIT_ASSETS[g][kind].file}`);

/** All six approved silhouettes use one fit; the original baked rim is the only rim. */
export function FruitGlyph({grape,x,y,width,illustrationOnly=false,rotation=0}:{grape:Grape;x:number;y:number;width:number;illustrationOnly?:boolean;rotation?:number}){
 const size=width/visibleWidth;
 const id=useId(),mask=masks.assets.find(a=>a.grape===grape)!;
 const box={x:x-size/2,y:y-size/2,width:size,height:size};
 return <g data-fruit={grape} aria-label={FRUIT_NAMES[grape]} transform={rotation?`rotate(${rotation} ${x} ${y})`:undefined}>{illustrationOnly&&<defs><mask id={id} maskUnits="userSpaceOnUse" {...box} style={{maskType:'alpha'}}><image href={assetUrl(`/assets/vineyards/illustration-masks/${mask.file}`)} {...box}/></mask></defs>}<image data-vineyard-fruit={grape} data-fruit-illustration={illustrationOnly||undefined} pointerEvents="none" href={vineyardAsset(grape,'fruit')} {...box} mask={illustrationOnly?`url(#${id})`:undefined} preserveAspectRatio="xMidYMid meet"/></g>;
}
export function CandyGlyph({grape,x,y,size=22}:{grape:Grape;x:number;y:number;size?:number}){
 const box=size/(manifest.candyArtWidth/manifest.candyCanvas);
 return <image data-candy-token={grape} href={vineyardAsset(grape,'candy')} x={x-box/2} y={y-box/2} width={box} height={box} preserveAspectRatio="xMidYMid meet" aria-label={`${FRUIT_NAMES[grape]} 사탕 토큰`}/>;
}
