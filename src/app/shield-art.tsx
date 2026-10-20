import { SHIELD_ABILITIES } from "../game/shields";
import { ResourceGlyph } from "./resource-icon";
export function ShieldArt({number,x=0,y=0,numberSize=17}: {number:number|null;x?:number;y?:number;numberSize?:number}) {
  const resource=number===2||number===3?"worker":number===8||number===9?"silver":null;
  return <g data-resource-shield={resource??undefined} transform={`translate(${x} ${y})`} fontFamily="Arial, sans-serif" aria-hidden="true">
    <path className="shield-outline" d="M-24-29 Q0-36 24-29 V1 Q24 19 0 31 Q-24 19-24 1Z" fill={number===null?"#c5c7c4":"#f8edcb"} stroke={number===null?"#91968e":"#a17b3e"} strokeWidth="2"/>
    <path d="M-18-24 Q0-29 18-24 V0 Q18 13 0 23 Q-18 13-18 0Z" fill={number===null?"#d8dad5":"#283e4c"} stroke={number===null?"#a8ada4":"#d3b776"}/>
    <text y={number===null?5:resource?0:-3} textAnchor="middle" fontSize={resource?Math.min(numberSize,18):numberSize} fontWeight="bold" fill={number===null?"#6c746b":"#fff3d0"}>{number??"—"}</text>
    {resource&&<ResourceGlyph type={resource} x={-6} y={-32} size={12}/>}
    {number!==null&&<text y={resource?15:13} textAnchor="middle" fontSize="9" fill="#e1c888">{number<=6?"◆":number<=12?"✦":"✧"} {number<=6?12:number<=12?8:4}</text>}
  </g>;
}
export function shieldLabel(number:number) { return `방패 ${number} · ${SHIELD_ABILITIES[number-1]}`; }

/** Same board coordinates as the underlying castle; the parent hex owns the touch target. */
export function MountedShield({number,tileId,x,y}:{number:number;tileId:string;x:number;y:number}) {
  return <g data-mounted-shield={number} data-castle-tile={tileId} transform={`translate(${x} ${y})`} pointerEvents="none"><title>{shieldLabel(number)}</title><ShieldArt number={number} numberSize={23}/></g>;
}
export function ShieldDetails({number,onClose,active=true}:{number:number;onClose:()=>void;active?:boolean}) {
  return <section role="dialog" aria-label="방패 상세" className="direct-confirm"><strong>{shieldLabel(number)}</strong><p>{active?"성에 장착된 동안 능력이 적용됩니다. 유지비와 종료 점수에는 현재 보유 효과가 반영됩니다.":"방패 UI 검증 모드입니다. 능력·유지비·종료 점수는 적용되지 않습니다."}</p><button onClick={onClose}>방패 상세 닫기</button></section>;
}
