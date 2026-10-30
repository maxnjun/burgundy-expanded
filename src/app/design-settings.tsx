"use client";
import {createContext,startTransition,useContext,useEffect,useState,type ReactNode} from 'react';

const key='burgundy-expanded:design-1-v1';
const DesignContext=createContext<{enabled:boolean;change:(enabled:boolean)=>void}>({enabled:false,change:()=>{}});
export const useDesign1=()=>useContext(DesignContext).enabled;

export function DesignProvider({children}:{children:ReactNode}){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{try{const value=localStorage.getItem(key);startTransition(()=>setEnabled(value==='on'));}catch{}},[]);
 useEffect(()=>{document.documentElement.setAttribute('data-design-1',enabled?'on':'off');},[enabled]);
 const change=(next:boolean)=>{setEnabled(next);try{localStorage.setItem(key,next?'on':'off');}catch{}};
 return <DesignContext.Provider value={{enabled,change}}>{children}</DesignContext.Provider>;
}

export function DesignSetting({label="디자인 1"}:{label?:string}){
 const {enabled,change}=useContext(DesignContext);
 return <label className="design-setting"><input type="checkbox" role="switch" aria-label="디자인 1" checked={enabled} onChange={e=>change(e.target.checked)}/><span className="design-switch" aria-hidden="true"/><span>{label}</span><small aria-hidden="true">{enabled?'ON':'OFF'}</small></label>;
}
