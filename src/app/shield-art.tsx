import { SHIELD_ABILITIES } from "../game/shields";
export function ShieldArt({number,x=0,y=0}: {number:number|null;x?:number;y?:number}) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <path className="shield-outline" d="M-24-29 Q0-36 24-29 V1 Q24 19 0 31 Q-24 19-24 1Z" fill={number===null?"#c5c7c4":"#f8edcb"} stroke={number===null?"#91968e":"#a17b3e"} strokeWidth="2"/>
    <path d="M-18-24 Q0-29 18-24 V0 Q18 13 0 23 Q-18 13-18 0Z" fill={number===null?"#d8dad5":"#283e4c"} stroke={number===null?"#a8ada4":"#d3b776"}/>
    <text y={number===null?5:-3} textAnchor="middle" fontSize="17" fontWeight="bold" fill={number===null?"#6c746b":"#fff3d0"}>{number??"—"}</text>
    {number!==null&&<text y="13" textAnchor="middle" fontSize="9" fill="#e1c888">{number<=6?"◆":number<=12?"✦":"✧"} {number<=6?12:number<=12?8:4}</text>}
  </g>;
}
export function shieldLabel(number:number) { return `방패 ${number} · ${SHIELD_ABILITIES[number-1]}`; }
