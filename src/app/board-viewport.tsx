"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** Ordinary wheel scrolls the page; Ctrl+wheel zooms only this estate. Alt/middle drag pans. */
export function BoardViewport({ children, onZoom }: {
    children: ReactNode;
    onZoom: (delta: number) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
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
    return <div ref={ref} className="live-board-scroll" aria-label="영지 이동 영역" onPointerDown={e => {
            if (!e.altKey && e.button !== 1)
                return;
            e.preventDefault();
            const element = e.currentTarget;
            drag.current = { x: e.clientX, y: e.clientY, left: element.scrollLeft, top: element.scrollTop };
            element.setPointerCapture(e.pointerId);
        }} onPointerMove={e => { if (!drag.current)
        return; const start = drag.current; e.currentTarget.scrollLeft = start.left + start.x - e.clientX; e.currentTarget.scrollTop = start.top + start.y - e.clientY; }} onPointerUp={e => { if (!drag.current)
        return; drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = null; }} onClickCapture={e => { if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
    } }}>{children}</div>;
}
