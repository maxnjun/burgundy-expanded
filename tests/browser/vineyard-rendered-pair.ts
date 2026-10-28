import type {Locator} from '@playwright/test';

/** Verify rendered image centers against the actual cell polygons, including SVG rotation/zoom. */
export async function renderedVinePair(slot:Locator){
 return slot.evaluate(el=>{
  const images=[...el.querySelectorAll<SVGImageElement>('[data-vineyard-fruit]')].map(i=>{const m=i.getScreenCTM()!;if(m.a<=0||m.d<=0||Math.abs(m.b)>1e-5||Math.abs(m.c)>1e-5)throw Error('Fruit illustration is rotated on screen');return {grape:i.dataset.vineyardFruit,point:new DOMPoint(i.x.baseVal.value+i.width.baseVal.value/2,i.y.baseVal.value+i.height.baseVal.value/2).matrixTransform(m)};});
  return [...el.querySelectorAll<SVGPolygonElement>('[data-vine-cell] polygon')].map(cell=>{
   const box=cell.getBBox(),point=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(cell.getScreenCTM()!);
   const closest=images.map(i=>({...i,distance:Math.hypot(point.x-i.point.x,point.y-i.point.y)})).sort((a,b)=>a.distance-b.distance)[0];
   if(!closest||closest.distance>1)throw Error('Rendered fruit is not centered in its real cell');
   return closest.grape;
  });
 });
}
