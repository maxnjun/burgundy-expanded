"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject} from "react";
import {usePathname} from "next/navigation";
import {getTileHelp,type TileHelp} from "../game/tile-help";
import {TileHelpContent} from "./tile-help-content";

type Popup={help:TileHelp;mode:"mouse"|"touch";terrain?:string};
function sourceFor(target:EventTarget|null):Element|null {
 if(!(target instanceof Element)||target.closest("[data-tile-help-inline]"))return null;
 return target.closest('[data-estate-cell][data-tile-help^="shield:"]')??target.closest("[data-tile-help]")??target.closest('button,[role="button"]')?.querySelector("[data-tile-help]")??null;
}
export function useTileEffectTooltip(ref:RefObject<HTMLDivElement|null>){
 const [popup,setPopup]=useState<Popup|null>(null),current=useRef<Popup|null>(null);
 const anchor=useRef<{source:Element;x:number;y:number}|null>(null);
 const tap=useRef<{source:Element;pointer:number;x:number;y:number;down:PointerEvent}|null>(null);
 const suppressed=useRef<{owner:Element;expires:number}|null>(null);
 const described=useRef<{element:Element;previous:string|null}|null>(null);
 const cancelTap=useCallback(()=>{tap.current=null;},[]);
 const restoreDescription=useCallback(()=>{const d=described.current;if(d){if(d.previous===null)d.element.removeAttribute("aria-describedby");else d.element.setAttribute("aria-describedby",d.previous);described.current=null;}},[]);
 const close=useCallback(()=>{cancelTap();restoreDescription();if(current.current){current.current=null;setPopup(null);}anchor.current=null;},[cancelTap,restoreDescription]);
 const position=useCallback(()=>{
  const box=ref.current,a=anchor.current,p=current.current;if(!box||!a||!p)return;
  const width=window.innerWidth,height=window.innerHeight;
  box.style.maxWidth=`${Math.max(1,Math.min(390,width-16))}px`;
  box.style.maxHeight=`${Math.max(1,p.mode==="touch"?Math.min(440,height-16):height-16)}px`;
  const rect=a.source.getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight;
  let left=p.mode==="touch"?a.x-w/2:Math.max(a.x+16,rect.right+8);
  let top=p.mode==="touch"?rect.bottom+14:a.y+16;
  if(left+w>width-8)left=p.mode==="touch"?width-w-8:Math.min(a.x-w-16,rect.left-w-8);
  if(top+h>height-8)top=p.mode==="touch"?rect.top-h-14:a.y-h-16;
  box.style.left=`${Math.max(8,Math.min(left,width-w-8))}px`;
  box.style.top=`${Math.max(8,Math.min(top,height-h-8))}px`;
 },[ref]);
 useLayoutEffect(()=>{
  if(!popup||!ref.current)return;
  position();const observer=new ResizeObserver(position);observer.observe(ref.current);
  return()=>observer.disconnect();
 },[popup,position,ref]);
 useEffect(()=>{
  const touches=new Set<number>();let lastPointer="mouse";
  const inside=(target:EventTarget|null)=>target instanceof Node&&!!ref.current?.contains(target);
  const browsing=(source:Element)=>source.closest("[data-tile-help-touch-browse]")?.getAttribute("data-tile-help-touch-browse")!=="false";
  const show=(source:Element,x:number,y:number,mode:Popup["mode"])=>{
   const help=getTileHelp(source.getAttribute("data-tile-help")??"");if(!help)return;
   const terrain=help.kind==="inn"?source.closest("[data-tile-help-terrain]")?.getAttribute("data-tile-help-terrain")??undefined:undefined;
   anchor.current={source,x,y};
   const owner=source.closest('button,[role="button"]')??source;
   if(described.current?.element!==owner){restoreDescription();const previous=owner.getAttribute("aria-describedby");described.current={element:owner,previous};owner.setAttribute("aria-describedby",[previous,"tile-effect-tooltip"].filter(Boolean).join(" "));}
   if(current.current?.help.id!==help.id||current.current.mode!==mode||current.current.terrain!==terrain){current.current={help,mode,terrain};setPopup(current.current);}
   position();
  };
  const over=(e:PointerEvent)=>{if(e.pointerType!=="mouse"||e.buttons)return;const source=sourceFor(e.target);if(source)show(source,e.clientX,e.clientY,"mouse");else if(current.current?.mode==="mouse")close();};
  const out=(e:PointerEvent)=>{if(e.pointerType==="mouse"&&current.current?.mode==="mouse"&&sourceFor(e.relatedTarget)?.getAttribute("data-tile-help")!==current.current.help.id)close();};
  const down=(e:PointerEvent)=>{
   lastPointer=e.pointerType;
   suppressed.current=null;
   if(e.pointerType==="touch"||e.pointerType==="pen")touches.add(e.pointerId);
   if(touches.size>1)cancelTap();
   if(inside(e.target))return;
   close();
   if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
   if(touches.size!==1)return;
   const source=sourceFor(e.target);if(source&&browsing(source))tap.current={source,pointer:e.pointerId,x:e.clientX,y:e.clientY,down:e};
  };
  const move=(e:PointerEvent)=>{
   if(tap.current&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>10)cancelTap();
   if(e.pointerType==="mouse"&&!e.buttons){const source=sourceFor(e.target);if(source)show(source,e.clientX,e.clientY,"mouse");else if(current.current?.mode==="mouse")close();}
  };
  const up=(e:PointerEvent)=>{
   const pending=tap.current;touches.delete(e.pointerId);cancelTap();
   if(!pending||pending.pointer!==e.pointerId||pending.down.defaultPrevented||!pending.source.isConnected||!browsing(pending.source))return;
   // The down event retains cancellation by the viewport's bubbling pan handler.
   const source=sourceFor(document.elementFromPoint(e.clientX,e.clientY));if(source!==pending.source)return;
   suppressed.current={owner:source.closest('button,[role="button"]')??source,expires:Date.now()+800};
   show(source,e.clientX,e.clientY,"touch");
  };
  const cancel=(e:PointerEvent)=>{touches.delete(e.pointerId);cancelTap();};
  const click=(e:MouseEvent)=>{
   const blocked=suppressed.current;
   if(blocked&&Date.now()<=blocked.expires&&e.target instanceof Node&&blocked.owner.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();suppressed.current=null;}
  };
  const context=(e:MouseEvent)=>{if(sourceFor(e.target)&&(lastPointer==="touch"||lastPointer==="pen"||matchMedia("(pointer:coarse)").matches))e.preventDefault();};
  const scroll=(e:Event)=>{
   if(inside(e.target))return;
   cancelTap();const a=anchor.current;
   if(current.current?.mode==="mouse"&&a){const source=sourceFor(document.elementFromPoint(a.x,a.y));if(source)show(source,a.x,a.y,"mouse");else close();}
   else close();
  };
  const resize=()=>{cancelTap();position();};
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")close();if(e.key==="Tab")lastPointer="keyboard";};
  const focus=(e:FocusEvent)=>{if(lastPointer==="touch"||lastPointer==="pen")return;const source=sourceFor(e.target);if(source){const b=source.getBoundingClientRect();show(source,b.right,b.top,"mouse");}else if(current.current?.mode==="mouse")close();};
  const blur=(e:FocusEvent)=>{if(current.current?.mode==="mouse"&&sourceFor(e.relatedTarget)?.getAttribute("data-tile-help")!==current.current.help.id)close();};
  const listeners:readonly [string,EventListener][]=[["pointerover",over as EventListener],["pointerout",out as EventListener],["pointerdown",down as EventListener],["pointermove",move as EventListener],["pointerup",up as EventListener],["pointercancel",cancel as EventListener],["click",click as EventListener],["contextmenu",context as EventListener],["scroll",scroll],["wheel",scroll],["keydown",key as EventListener],["focusin",focus as EventListener],["focusout",blur as EventListener]];
  for(const [type,listener] of listeners)document.addEventListener(type,listener,true);
  window.addEventListener("resize",resize);
  const observer=new MutationObserver(()=>{const a=anchor.current;if(a&&(!a.source.isConnected||a.source.getAttribute("data-tile-help")!==current.current?.help.id||current.current?.mode==="touch"&&!browsing(a.source)))close();else if(a&&current.current)show(a.source,a.x,a.y,current.current.mode);});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-tile-help","data-tile-help-touch-browse","data-tile-help-terrain"]});
  return()=>{for(const [type,listener] of listeners)document.removeEventListener(type,listener,true);window.removeEventListener("resize",resize);observer.disconnect();cancelTap();restoreDescription();};
 },[ref,position,close,cancelTap,restoreDescription]);
 return {popup,close};
}
function Tooltip(){
 const ref=useRef<HTMLDivElement>(null),{popup,close}=useTileEffectTooltip(ref);
 if(!popup)return null;
 return <div ref={ref} id="tile-effect-tooltip" data-tile-help-inline data-help-mode={popup.mode} role={popup.mode==="touch"?"dialog":"tooltip"} aria-label={popup.mode==="touch"?"타일 효과 설명":undefined} aria-labelledby={popup.mode==="mouse"?"tile-effect-title":undefined} className={`tile-effect-tooltip ${popup.mode}`}>
  {popup.mode==="touch"&&<button type="button" className="tile-help-close" onClick={close} aria-label="타일 설명 닫기">×</button>}
  <TileHelpContent terrain={popup.terrain} help={popup.help} headingId="tile-effect-title"/>
 </div>;
}
export function TileEffectTooltip(){const pathname=usePathname();return <Tooltip key={pathname}/>;}
