import { useId } from "react";
import {useDesign1} from './design-settings';

/** Decorative layer only: no market coordinates, hit targets or game state. */
export function CommonBoardBackdrop({ width: boardWidth, height }: { width: number; height: number }) {
  const id = useId().replace(/:/g, "");
  const design1=useDesign1();
  const left = 2, width = boardWidth - 4;
  const right = left + width;
  const paper = `${id}-paper`, grain = `${id}-grain`, gold = `${id}-gold`;
  const corner = "M0 48V0H48M5 39V5H39M9 29C22 31 29 18 22 12C15 7 9 15 15 20C22 25 34 12 34 6M9 40C11 32 22 35 25 28M28 25C35 22 32 11 40 9M5 5L14 14";
  return <g data-board-decoration="true" aria-hidden="true" pointerEvents="none">
    <defs>
      <radialGradient id={paper} cx="49%" cy="43%" r="75%">
        <stop stopColor="#fff7dc"/><stop offset=".65" stopColor="#efe0b3"/><stop offset="1" stopColor="#c8a56a"/>
      </radialGradient>
      <linearGradient id={gold} x2=".25" y2="1">
        <stop stopColor="#74512d"/><stop offset=".25" stopColor="#d9bd7b"/><stop offset=".55" stopColor="#a47c42"/><stop offset=".8" stopColor="#ead49a"/><stop offset="1" stopColor="#76532f"/>
      </linearGradient>
      <pattern id={grain} data-common-paper-grain={design1?'design-1':'default'} width={design1?83:23} height={design1?71:19} patternUnits="userSpaceOnUse">
        {design1?<><path d="M2 4l5 .4M26 13l7-.7M55 5l6 .5M15 37l8-.6M44 49l5 .3M69 28l7-.4M4 64l7 .5M61 65l9-.7" stroke="#856132" strokeWidth=".4" opacity=".16"/>
        <path d="M9 19l8-.5M39 32l6 .4M70 54l5-.3M28 61l7 .6" stroke="#fffbee" strokeWidth=".8" opacity=".4"/></>:<>
        <path d="M2 3l4 .3M13 12l6-.4M7 17l3 .2" stroke="#856132" strokeWidth=".45" opacity=".11"/>
        <path d="M17 4l3-.3M1 10l4 .4" stroke="#fffbee" strokeWidth=".8" opacity=".35"/></>}
      </pattern>
    </defs>
    <rect x={left} y="2" width={width} height={height-4} rx="4" fill={`url(#${paper})`} stroke="#80613b" strokeWidth="3"/>
    <rect x={left+2} y="4" width={width-4} height={height-8} rx="3" fill={`url(#${grain})`}/>
    <rect x={left+5} y="7" width={width-10} height={height-14} rx="3" fill="none" stroke={`url(#${gold})`} strokeWidth="3"/>
    <rect x={left+10} y="12" width={width-20} height={height-24} rx="2" fill="none" stroke="#94713f" strokeOpacity=".48" strokeWidth=".7"/>
    {[[left+10,12,1,1],[right-10,12,-1,1],[left+10,height-12,1,-1],[right-10,height-12,-1,-1]].map(([x,y,sx,sy],i)=><path key={i} d={corner} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke="#826035" strokeWidth="1.25" opacity=".65"/>)}
    <g fill="none" stroke="#aa8346" strokeWidth="1.1" opacity=".2">
      <path d="M22 185C-8 126 93 131 134 151S223 177 254 143M386 143C431 183 487 129 550 142S619 161 616 185M22 550C-5 612 88 601 135 579M506 568C569 585 634 601 618 537"/>
      {[left+25,right-25].map(x=><g key={x} transform={`translate(${x} 422)`}><path d="M0 19V-19M0 6C-22-5-12-20-3-7L0-20 3-7C12-20 22-5 0 6M-9 10H9M-6 15H6"/></g>)}
    </g>
  </g>;
}
