export const BOARD_ZOOM_STEPS=[.25,.35,.5,.6,.75,1,1.25,1.6,2] as const;
export const clampBoardZoom=(zoom:number)=>Math.max(.25,Math.min(2,zoom));
export function nextBoardZoom(zoom:number,direction:1|-1){return direction===1?BOARD_ZOOM_STEPS.find(z=>z>zoom+.001)??2:[...BOARD_ZOOM_STEPS].reverse().find(z=>z<zoom-.001)??.25;}
export interface BoardDisplay {commonZoom:number;supplyZoom:number;fit:boolean}
export function readBoardDisplay(text:string,fallback=1):BoardDisplay{
 try{const p=JSON.parse(text);if([p.commonZoom,p.supplyZoom].every(z=>typeof z==='number'&&Number.isFinite(z)&&z>=.25&&z<=2)&&typeof p.fit==='boolean')return p;}catch{}
 return {commonZoom:clampBoardZoom(fallback),supplyZoom:1,fit:false};
}
export function fitBoardZooms(width:number,commonWidth:number,supplyWidth:number,gap:number,inset:number,below:boolean){
 if(below)return {commonZoom:clampBoardZoom(Math.min(1,(width-inset)/commonWidth)),supplyZoom:clampBoardZoom(Math.min(1,width/supplyWidth))};
 const zoom=clampBoardZoom(Math.min(1,(width-gap-inset)/(commonWidth+supplyWidth)));
 return {commonZoom:zoom,supplyZoom:zoom};
}
