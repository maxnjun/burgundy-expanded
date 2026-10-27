import manifest from '../../public/assets/vineyards/manifest.json';
import type {Grape} from '../game/vineyards';

export const FRUIT_ASSETS=Object.fromEntries(manifest.assets.map(a=>[a.grape,a])) as Record<Grape,typeof manifest.assets[number]>;
export const FRUIT_NAMES=Object.fromEntries(manifest.assets.map(a=>[a.grape,a.name])) as Record<Grape,string>;
const visibleWidth=Math.max(...manifest.assets.map(a=>a.fruit.alphaBounds[2]-a.fruit.alphaBounds[0]))/manifest.fruitCanvas;
export const vineyardAsset=(g:Grape,kind:'fruit'|'candy')=>`/assets/vineyards/${FRUIT_ASSETS[g][kind].file}?v=${FRUIT_ASSETS[g][kind].sha256.slice(0,12)}`;

/** All six approved silhouettes use one fit; the original baked rim is the only rim. */
export function FruitGlyph({grape,x,y,width}:{grape:Grape;x:number;y:number;width:number}){
 const size=width/visibleWidth;
 return <g data-fruit={grape} aria-label={FRUIT_NAMES[grape]}><image data-vineyard-fruit={grape} pointerEvents="none" href={vineyardAsset(grape,'fruit')} x={x-size/2} y={y-size/2} width={size} height={size} preserveAspectRatio="xMidYMid meet"/></g>;
}
export function CandyGlyph({grape,x,y,size=22}:{grape:Grape;x:number;y:number;size?:number}){
 const box=size/(manifest.candyArtWidth/manifest.candyCanvas);
 return <image data-candy-token={grape} href={vineyardAsset(grape,'candy')} x={x-box/2} y={y-box/2} width={box} height={box} preserveAspectRatio="xMidYMid meet" aria-label={`${FRUIT_NAMES[grape]} 사탕 토큰`}/>;
}
