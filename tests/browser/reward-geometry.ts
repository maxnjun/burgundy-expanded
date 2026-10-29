import type {Locator} from '@playwright/test';
import manifest from '../../public/assets/effects/manifest.json';

/** Ignore transparent PNG padding when measuring the visible illustration. */
export async function rewardDieOverlaps(vine:Locator){
 return vine.locator('[data-vine-slot]').evaluateAll(async(slots,assets)=>{
 const pixels=new Map<string,ImageData>();
 for(const asset of Object.values(assets)){
  const image=new Image();image.src=`/assets/effects/${asset.file}`;await image.decode();
  const canvas=document.createElement('canvas');[canvas.width,canvas.height]=asset.canvas;
  const context=canvas.getContext('2d')!;context.drawImage(image,0,0);pixels.set(asset.file,context.getImageData(0,0,canvas.width,canvas.height));
 }
 return slots.flatMap(slot=>{
  const die=slot.querySelector('[data-white-die]')?.getBoundingClientRect();if(!die)return [];
  return [...slot.querySelectorAll('[data-reward-effect]')].filter(el=>{
   const a=Object.values(assets).find(a=>a.file===el.getAttribute('data-effect-asset'))!,image=el.querySelector('image') as SVGGraphicsElement,m=image.getScreenCTM()!,[l,t,r,b]=a.alphaBounds;
   const data=pixels.get(a.file)!;
   for(let y=t;y<b;y++)for(let x=l;x<r;x++){
    if(data.data[(y*data.width+x)*4+3]<32)continue;
    const p=new DOMPoint(x+.5,y+.5).matrixTransform(m);
    if(p.x>die.left+.5&&p.x<die.right-.5&&p.y>die.top+.5&&p.y<die.bottom-.5)return true;
   }
   return false;
  }).map(el=>el.getAttribute('data-reward-effect'));
 });},manifest.assets);
}
