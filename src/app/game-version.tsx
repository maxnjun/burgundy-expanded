"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {GAME_VERSION,GAME_PROTOCOL} from "../game/release";
export function GameVersion(){
 const [update,setUpdate]=useState("");const path=usePathname();
 useEffect(()=>{const abort=new AbortController();const check=async()=>{if(document.visibilityState==="hidden"||!navigator.onLine)return;try{const response=await fetch("/api/version",{cache:"no-store",signal:abort.signal});if(!response.ok)return;const release=await response.json();if(release.protocol!==GAME_PROTOCOL||GAME_VERSION!=="development"&&release.version!==GAME_VERSION){setUpdate(release.version);window.dispatchEvent(new CustomEvent("burgundy-update",{detail:release.version}));}}catch{}};void check();const timer=setInterval(()=>void check(),60_000);window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);return()=>{abort.abort();clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};},[]);
 return <footer className="game-version"><span>게임 버전 {GAME_VERSION.slice(0,12)}</span><Link href="/updates">업데이트 내역</Link>{update&&path!=="/online"&&<div className="release-update" role="alert">새 버전이 준비되었습니다. 현재 게임의 자동 저장을 유지합니다. <button onClick={()=>location.reload()}>업데이트 새로고침</button></div>}</footer>;
}
