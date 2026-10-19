"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
/** Ordinary wheel scrolls the page; Ctrl+wheel zooms only this estate. Alt/middle drag pans. */
export function BoardViewport({ children, onZoom, label = "영지" }: {
    children: ReactNode;
    label?: string;
    onZoom: (delta: number) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [panMode, setPanMode] = useState(false);
    const moved = useRef(false);
    const touches = useRef(new Map<number, {x:number;y:number}>());
    const distance = useRef<number | null>(null);
    const drag = useRef<{
        x: number;
        y: number;
        left: number;
        top: number;
    } | null>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element)
            return;
        const wheel = (event: WheelEvent) => { if (!event.ctrlKey)
            return; event.preventDefault(); onZoom(event.deltaY < 0 ? .1 : -.1); };
        element.addEventListener("wheel", wheel, { passive: false });
        return () => element.removeEventListener("wheel", wheel);
    }, [onZoom]);
    return <><div className="board-touch-tools"><button type="button" aria-label={`${label} 드래그 이동`} aria-pressed={panMode} onClick={()=>setPanMode(p=>!p)}>{panMode ? "이동 모드 끄기" : "드래그 이동 켜기"}</button><span>{panMode ? "한 손가락 이동 · 두 손가락 확대/축소" : "타일을 탭해서 선택 · 일반 스크롤 유지"}</span></div><div ref={ref} className="live-board-scroll" style={{touchAction:panMode ? "none" : "pan-y pinch-zoom"}} aria-label={`${label} 이동 영역`} onPointerDown={e => {
            moved.current = false;
            if (!panMode && !e.altKey && e.button !== 1)
                return;
            e.preventDefault();
            const element = e.currentTarget;
            touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
            if(touches.current.size===2){const [a,b]=[...touches.current.values()];distance.current=Math.hypot(a.x-b.x,a.y-b.y);drag.current=null;}
            else
            drag.current = { x: e.clientX, y: e.clientY, left: element.scrollLeft, top: element.scrollTop };
            element.setPointerCapture(e.pointerId);
        }} onPointerMove={e => {
        if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(touches.current.size===2){
            const [a,b]=[...touches.current.values()], next=Math.hypot(a.x-b.x,a.y-b.y);
            if(distance.current!==null&&Math.abs(next-distance.current)>10){onZoom(next > distance.current ? .1 : -.1);distance.current=next;moved.current=true;}
            return;
        }
        if (!drag.current)
        return; const start = drag.current; e.currentTarget.scrollLeft = start.left + start.x - e.clientX; e.currentTarget.scrollTop = start.top + start.y - e.clientY; }} onPointerUp={e => { if (!drag.current)
        {touches.current.delete(e.pointerId);distance.current=null;return;} drag.current = null; touches.current.delete(e.pointerId);distance.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = null;touches.current.clear();distance.current=null; }} onClickCapture={e => { if (e.altKey || panMode || moved.current) {
        e.preventDefault();
        e.stopPropagation();
    } }}>{children}</div></>;
}
