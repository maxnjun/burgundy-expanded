"use client";
import {useState,useSyncExternalStore} from 'react';

const layoutKey='burgundy-expanded:vineyard-layout-v1';
const layoutEvent='burgundy-vineyard-layout';
function subscribeNative(callback:()=>void){window.addEventListener('burgundy-native-ready',callback);return()=>window.removeEventListener('burgundy-native-ready',callback);}
export function useAndroid(){return useSyncExternalStore(subscribeNative,()=>document.documentElement.dataset.nativeApp==='android',()=>false);}
function subscribeLayout(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener(layoutEvent,callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener(layoutEvent,callback);};}
export function useVineyardLayout(){return useSyncExternalStore(subscribeLayout,()=>{try{return localStorage.getItem(layoutKey)==='below'?'below':'right';}catch{return 'right';}},()=>'right');}
export function AndroidVineyardSetting({enabled}:{enabled:boolean}){
 const native=useAndroid(),layout=useVineyardLayout(),[error,setError]=useState('');
 if(!native||!enabled)return null;
 return <label className="android-vineyard-setting">포도밭 공급처 위치 <select aria-label="포도밭 공급처 위치" value={layout} onChange={e=>{try{localStorage.setItem(layoutKey,e.target.value);window.dispatchEvent(new Event(layoutEvent));setError('');}catch{setError('위치 설정을 저장하지 못했습니다.');}}}><option value="right">오른쪽 — 가로 스크롤</option><option value="below">아래쪽 — 세로 스크롤</option></select>{error&&<small role="alert">{error}</small>}</label>;
}
