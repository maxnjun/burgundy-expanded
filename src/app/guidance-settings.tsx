"use client";
import {startTransition,useEffect,useState} from "react";
const key="burgundy-expanded:pinned-guidance-v1";
export function usePinnedGuidance(){
 const [pinned,setPinned]=useState(true);
 useEffect(()=>{try{const value=localStorage.getItem(key);startTransition(()=>setPinned(value!=="off"));}catch{}},[]);
 const change=(value:boolean)=>{setPinned(value);try{localStorage.setItem(key,value?"on":"off");}catch{}};
 return [pinned,change] as const;
}
export function GuidanceSetting({pinned,onChange}:{pinned:boolean;onChange:(value:boolean)=>void}){
 return <label className="guidance-setting"><input type="checkbox" checked={pinned} onChange={e=>onChange(e.target.checked)}/>합법 행동 및 안내 문구 상단 고정</label>;
}
