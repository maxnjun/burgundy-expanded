"use client";
import {useEffect,useState} from "react";
import { SHIELD_ABILITIES,SHIELD_POINTS,type DiceShieldStatus } from "../game/shields";
import { ResourceGlyph } from "./resource-icon";
import {getTileHelp} from "../game/tile-help";
import approved from "../../public/shields/manifest.json";
export const SHIELD_ART_SIZE={width:52,height:52*1480/1200};
export const MOUNTED_SHIELD_SCALE=1.18;
const customEmblems:Readonly<Record<number,string>>={20:"◆",22:"⚂",23:"×6",24:"∞"};
export function ShieldArt({number,x=0,y=0,numberSize=17,placeholder="—"}: {number:number|null;x?:number;y?:number;numberSize?:number;placeholder?:string}) {
  const asset=approved.assets.find(a=>a.number===number),src=asset?`/shields/${asset.file}?v=${asset.outputSha256.slice(0,12)}`:null;
  const [failed,setFailed]=useState<string|null>(null);
  useEffect(()=>{if(!src)return;let active=true;const probe=new Image();probe.onerror=()=>{if(active)setFailed(src);};probe.src=src;return()=>{active=false;probe.onerror=null;};},[src]);
  const image=src&&failed!==src;
  const resource=number===2||number===3?"worker":number===8||number===9||number===19||number===21?"silver":null;
  return <g data-tile-help={number===null?undefined:`shield:${number}`} data-approved-shield={image?number:undefined} data-resource-shield={!image?resource??undefined:undefined} transform={`translate(${x} ${y})`} fontFamily="Arial, sans-serif" aria-hidden="true">
    {image?<><image data-shield-image={number} href={src} x={-SHIELD_ART_SIZE.width/2} y={-SHIELD_ART_SIZE.height/2} width={SHIELD_ART_SIZE.width} height={SHIELD_ART_SIZE.height} preserveAspectRatio="xMidYMid meet" pointerEvents="none" onError={()=>setFailed(src)}/><rect className="shield-outline" x={-SHIELD_ART_SIZE.width/2} y={-SHIELD_ART_SIZE.height/2} width={SHIELD_ART_SIZE.width} height={SHIELD_ART_SIZE.height} fill="transparent" stroke="transparent" strokeWidth="2"/></>:<>
    <path className="shield-outline" d="M-24-29 Q0-36 24-29 V1 Q24 19 0 31 Q-24 19-24 1Z" fill={number===null?"#c5c7c4":"#f8edcb"} stroke={number===null?"#91968e":"#a17b3e"} strokeWidth="2"/>
    <path d="M-18-24 Q0-29 18-24 V0 Q18 13 0 23 Q-18 13-18 0Z" fill={number===null?"#d8dad5":"#283e4c"} stroke={number===null?"#a8ada4":"#d3b776"}/>
    <text y={number===null?5:resource?0:-3} textAnchor="middle" fontSize={resource?Math.min(numberSize,18):numberSize} fontWeight="bold" fill={number===null?"#6c746b":"#fff3d0"}>{number??placeholder}</text>
    {resource&&<ResourceGlyph type={resource} x={-6} y={-32} size={12}/>}
    {number!==null&&customEmblems[number]&&<text y="-15" textAnchor="middle" fontSize="10" fill="#e1c888">{customEmblems[number]}</text>}
    {number!==null&&<text y={resource?15:13} textAnchor="middle" fontSize="9" fill="#e1c888">{number<=6?"◆":number<=12?"✦":"✧"} {SHIELD_POINTS[number-1]}</text>}</>}
  </g>;
}
export function shieldLabel(number:number) { return `방패 ${number} · ${SHIELD_ABILITIES[number-1]}`; }

export function diceShieldStatusText(number:number,status:DiceShieldStatus):string {
  if(number===22)return status==="pending"?"다음 자신의 턴에 행동 주사위 3개":status==="ready"?"이번 턴 행동 주사위 3개":"이번 턴 행동 주사위 2개";
  return status==="used"?"이번 턴에 사용함 · 다음 자신의 턴은 재사용 대기":status==="cooldown"?"이번 턴은 재사용 대기 · 다음 자신의 턴부터 사용 가능":"이번 턴 사용 가능";
}

export function ShieldThumbnail({number}:{number:number}) {
  return <svg className="inline-tile-art" width={24} height={28} viewBox="-30 -38 60 74" aria-hidden="true"><ShieldArt number={number}/></svg>;
}

/** Same board coordinates as the underlying castle; the parent hex owns the touch target. */
export function MountedShield({number,tileId,x,y,status}:{number:number;tileId:string;x:number;y:number;status?:DiceShieldStatus}) {
  return <g data-mounted-shield={number} data-castle-tile={tileId} data-shield-dice-status={status} data-shield-dice-inactive={status&&status!=="ready"||undefined} transform={`translate(${x} ${y})`} pointerEvents="none"><title>{shieldLabel(number)}{status&&` · ${diceShieldStatusText(number,status)}`}</title><g data-mounted-shield-scale={MOUNTED_SHIELD_SCALE} transform={`scale(${MOUNTED_SHIELD_SCALE})`}><ShieldArt number={number} numberSize={23}/></g></g>;
}
export function ShieldDetails({number,onClose,active=true,status}:{number:number;onClose:()=>void;active?:boolean;status?:DiceShieldStatus}) {
  const help=getTileHelp("shield",number)!;
  return <section role="dialog" aria-label="방패 상세" className="direct-confirm shield-detail" data-tile-help-inline><div className="shield-detail-heading"><svg viewBox="-30 -38 60 74" role="img" aria-label={`방패 ${number} 확대 이미지`} data-shield-dice-inactive={status&&status!=="ready"||undefined}><ShieldArt number={number}/></svg><strong>{shieldLabel(number)}</strong></div><p>기본 종료 승점 {SHIELD_POINTS[number-1]}점</p><p>{help.summary}</p><p>{help.details}</p><p>{help.timing}</p>{status&&<p data-shield-dice-status={status}>{diceShieldStatusText(number,status)}</p>}<p>{active?"성에 장착된 동안 능력이 적용됩니다. 유지비와 종료 점수에는 현재 보유 효과가 반영됩니다.":"방패 UI 검증 모드입니다. 능력·유지비·종료 점수는 적용되지 않습니다."}</p><button onClick={onClose}>방패 상세 닫기</button></section>;
}
