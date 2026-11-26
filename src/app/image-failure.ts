import {useEffect,useState} from "react";

const probes=new Map<string,Promise<boolean>>();

function checkImage(source:string){
 let probe=probes.get(source);
 if(!probe){
  probe=new Promise(resolve=>{
   const image=new Image();
   image.onload=()=>resolve(true);
   image.onerror=()=>{probes.delete(source);resolve(false);};
   image.src=source;
  });
  probes.set(source,probe);
 }
 return probe;
}

export function useImageFailure(source:string|null){
 const [failed,setFailed]=useState<string|null>(null);
 useEffect(()=>{
  if(!source)return;
  // A failed SSR SVG image may have fired its error before hydration; share a single check per URL.
  let active=true;
  void checkImage(source).then(ok=>{if(active&&!ok)setFailed(source);});
  return ()=>{active=false;};
 },[source]);
 return {failed:source!==null&&source===failed,onError:()=>setFailed(source)};
}
