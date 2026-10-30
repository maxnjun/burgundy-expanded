"use client";
import {useState} from 'react';
import {DesignSetting} from './design-settings';
import {GuidanceSetting} from './guidance-settings';
import {AndroidVineyardSetting} from './android-settings';

export function GameSettings({pinned,onPinned,vineyards,onOpen}:{pinned:boolean;onPinned:(value:boolean)=>void;vineyards:boolean;onOpen?:()=>void}){
 const [open,setOpen]=useState(false);
 return <details className="online-game-settings in-game-settings" onToggle={e=>{const next=e.currentTarget.open;setOpen(next);if(next)onOpen?.();}}><summary>⚙ 게임 설정</summary>{open&&<div className="online-settings-options"><GuidanceSetting pinned={pinned} onChange={onPinned} label="상단 턴 안내 따라오기"/><DesignSetting label="디자인 1 적용"/><AndroidVineyardSetting enabled={vineyards}/></div>}</details>;
}
