"use client";
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type CSSProperties,type ReactNode} from 'react';
import {useAndroid,useVineyardLayout} from './android-settings';
import {COMMON_BOARD_ART_WIDTH} from './common-board';
import {clampBoardZoom,fitBoardZooms,nextBoardZoom,readBoardDisplay,type BoardDisplay} from './board-display';
const key='burgundy-expanded:board-display-v1',event='burgundy-board-display';
function subscribe(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener(event,callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener(event,callback);};}
function snapshot(){try{return localStorage.getItem(key)??'';}catch{return '';}}

export function BoardSupplyLayout({zoom,onZoom,supply,online=false,children}:{zoom:number;onZoom:(zoom:number)=>void;supply?:ReactNode;online?:boolean;children:(zoom:number,onZoom:(zoom:number)=>void,tools:ReactNode,native:boolean)=>ReactNode}){
 const native=useAndroid(),layout=useVineyardLayout(),stored=useSyncExternalStore(subscribe,snapshot,()=>''),prefs=useMemo(()=>readBoardDisplay(stored,zoom),[stored,zoom]);
 const row=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,inset:0,gap:18}),[error,setError]=useState('');
 useEffect(()=>{const e=row.current;if(!native||!e)return;const measure=()=>{const panel=e.querySelector('.common-board-panel'),s=panel&&getComputedStyle(panel),style=getComputedStyle(e);setSize({width:e.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0),inset:s?['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((n,k)=>n+(parseFloat(s[k as keyof CSSStyleDeclaration] as string)||0),0):0,gap:parseFloat(style.columnGap)||18});};const observer=new ResizeObserver(measure);observer.observe(e);return()=>observer.disconnect();},[native]);
 const supplyWidth=online?300:360;
 const fitted=prefs.fit&&size.width?fitBoardZooms(size.width,COMMON_BOARD_ART_WIDTH,supplyWidth,size.gap,size.inset,layout==='below'||!supply):prefs;
 const commonZoom=native?fitted.commonZoom:zoom,supplyZoom=native?fitted.supplyZoom:1;
 function save(next:BoardDisplay){try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event(event));setError('');}catch{setError('화면 배율 설정을 저장하지 못했습니다.');}}
 const changeCommon=(z:number)=>native?save({commonZoom:clampBoardZoom(z),supplyZoom,fit:false}):onZoom(clampBoardZoom(z));
 const changeSupply=(z:number)=>save({commonZoom,supplyZoom:clampBoardZoom(z),fit:false});
 const tools=native&&supply?<button className="board-fit-button" aria-pressed={prefs.fit} title={layout==='below'?'아래쪽 배치에서는 각 보드를 화면 폭에 맞춥니다.':'공용보드와 공급처를 함께 화면 폭에 맞춥니다.'} onClick={()=>save({...fitBoardZooms(size.width,COMMON_BOARD_ART_WIDTH,supplyWidth,size.gap,size.inset,layout==='below'),fit:true})}>공용보드 + 포도밭 한 화면 맞춤</button>:null;
 const style=native?{'--common-panel-width':`${Math.min(950,size.width||950,COMMON_BOARD_ART_WIDTH*commonZoom+size.inset)}px`,'--supply-panel-width':`${supplyWidth*supplyZoom}px`}:undefined;
 return <><div ref={row} className={`${online?'online-common-board-row':supply?'common-vineyard-row':'common-board-row'} board-supply-layout`} data-native-display={native} data-layout={layout} data-board-fit={native&&prefs.fit} style={style as CSSProperties}>
  {children(commonZoom,changeCommon,tools,native)}
  {supply&&(native?<div className="vineyard-supply-zoom"><div className="supply-zoom-tools" role="group" aria-label="포도 공급처 배율"><button aria-label="포도 공급처 축소" disabled={supplyZoom<=.25} onClick={()=>changeSupply(nextBoardZoom(supplyZoom,-1))}>−</button><button aria-label="포도 공급처 배율 복원" onClick={()=>changeSupply(1)}>{Math.round(supplyZoom*100)}%</button><button aria-label="포도 공급처 확대" disabled={supplyZoom>=2} onClick={()=>changeSupply(nextBoardZoom(supplyZoom,1))}>+</button></div><div className="vineyard-scale-content" style={{zoom:supplyZoom,width:supplyWidth}}>{supply}</div></div>:supply)}
 </div>{error&&<p role="alert">{error}</p>}</>;
}
