"use client";
import {createContext,startTransition,useContext,useEffect,useId,useState,type ReactNode} from 'react';

const key='burgundy-expanded:design-1-v1';
const themeKey='burgundy-expanded:estate-theme-v1';
const themes=[
 ['estate-theme-1','디자인 1 — 기존'],
 ['estate-theme-2','디자인 2 — 버건디 왕실'],
 ['estate-theme-3','디자인 3 — 알프스 수도원'],
 ['estate-theme-4','디자인 4 — 르네상스 지도실'],
] as const;
type EstateTheme=(typeof themes)[number][0];
const defaultTheme=themes[0][0];
const DesignContext=createContext<{
 enabled:boolean;
 change:(enabled:boolean)=>void;
 theme:EstateTheme;
 changeTheme:(theme:EstateTheme)=>void;
}>({enabled:false,change:()=>{},theme:defaultTheme,changeTheme:()=>{}});
export const useDesign1=()=>useContext(DesignContext).enabled;
export const useEstateTheme=()=>useContext(DesignContext).theme;

export function DesignProvider({children}:{children:ReactNode}){
 const [enabled,setEnabled]=useState(false);
 const [theme,setTheme]=useState<EstateTheme>(defaultTheme);
 useEffect(()=>{
  try{
   const legacy=localStorage.getItem(key),saved=localStorage.getItem(themeKey);
   startTransition(()=>{
    setEnabled(legacy==='on');
    setTheme(themes.find(([id])=>id===saved)?.[0]??defaultTheme);
   });
  }catch{}
 },[]);
 useEffect(()=>{document.documentElement.setAttribute('data-design-1',enabled?'on':'off');},[enabled]);
 useEffect(()=>{document.documentElement.setAttribute('data-estate-theme',theme);},[theme]);
 const change=(next:boolean)=>{setEnabled(next);try{localStorage.setItem(key,next?'on':'off');}catch{}};
 const changeTheme=(next:EstateTheme)=>{setTheme(next);try{localStorage.setItem(themeKey,next);}catch{}};
 return <DesignContext.Provider value={{enabled,change,theme,changeTheme}}>{children}</DesignContext.Provider>;
}

export function DesignSetting({label="디자인 1"}:{label?:string}){
 const {enabled,change,theme,changeTheme}=useContext(DesignContext);
 const group=useId();
 return <fieldset className="estate-theme-setting">
  <legend>영지보드 디자인</legend>
  <div className="estate-theme-options">{themes.map(([id,name])=>
   <label key={id} data-theme-preview={id}>
    <input type="radio" name={group} checked={theme===id} onChange={()=>changeTheme(id)}/>
    <span className="estate-theme-preview" aria-hidden="true"/>
    <span>{name}</span>
   </label>
  )}</div>
  {theme===defaultTheme&&<label className="design-setting"><input type="checkbox" role="switch" aria-label="디자인 1" checked={enabled} onChange={e=>change(e.target.checked)}/><span className="design-switch" aria-hidden="true"/><span>{label}</span><small aria-hidden="true">{enabled?'ON':'OFF'}</small></label>}
 </fieldset>;
}
