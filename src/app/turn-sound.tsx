"use client";

import {startTransition,useEffect,useRef,useState} from "react";
import type {TurnState} from "../game/types";

const storageKey="burgundy-expanded:turn-sound-v1";
const soundUrl="/assets/audio/04_wooden_ping.wav";
type SoundPreference={enabled:boolean;volume:number};
const defaults:SoundPreference={enabled:true,volume:50};
type SoundControls={value:SoundPreference;onChange:(value:SoundPreference)=>void};
type PlayerTurn=Pick<TurnState,"stage"|"phase"|"round"|"activePlayerId">;
type AudioState={context:AudioContext;gain:GainNode;buffer:AudioBuffer|null;loading:boolean};
type MediaFallback={element:HTMLAudioElement;ready:boolean;priming:boolean};

function readPreference():SoundPreference{
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)??"null");
    return {
      enabled:typeof saved?.enabled==="boolean"?saved.enabled:defaults.enabled,
      volume:Number.isInteger(saved?.volume)&&saved.volume>=0&&saved.volume<=100?saved.volume:defaults.volume,
    };
  }catch{return defaults;}
}

export function useTurnSound(scope:string|null,turn:PlayerTurn|null,eligible:boolean):SoundControls{
  const turnKey=turn?.stage==="player-turn"&&turn.activePlayerId?`${turn.phase}:${turn.round}:${turn.activePlayerId}`:null;
  const [value,setValue]=useState(defaults);
  const preference=useRef(defaults);
  const lastTurn=useRef<{scope:string;key:string|null}|null>(null);
  const pending=useRef(false);
  const audio=useRef<AudioState|null>(null);
  const media=useRef<MediaFallback|null>(null);

  function playPending(){
    if(!pending.current)return;
    if(media.current){
      const fallback=media.current;
      if(!fallback.ready)return;
      pending.current=false;
      fallback.element.currentTime=0;
      fallback.element.volume=preference.current.volume/100;
      fallback.element.muted=false;
      void fallback.element.play().catch(()=>{fallback.ready=false;});
      return;
    }
    const sound=audio.current;
    if(sound?.context.state!=="running"||!sound.buffer)return;
    pending.current=false;
    const source=sound.context.createBufferSource();
    source.buffer=sound.buffer;
    source.connect(sound.gain);
    source.start();
  }

  useEffect(()=>{
    const saved=readPreference();
    preference.current=saved;
    startTransition(()=>setValue(saved));

    function unlock(event:Event){
      if(!event.isTrusted)return;
      const {enabled,volume}=preference.current;
      const AudioContextClass=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!AudioContextClass){
        const fallback=media.current??={element:new Audio(soundUrl),ready:false,priming:false};
        if(fallback.ready||fallback.priming)return;
        fallback.priming=true;
        fallback.element.muted=true;
        void fallback.element.play().then(()=>{
          fallback.element.pause();
          fallback.ready=true;
          if(media.current===fallback)playPending();
        }).catch(()=>{}).finally(()=>{fallback.priming=false;});
        return;
      }
      if(!audio.current){
        const context=new AudioContextClass();
        const gain=context.createGain();
        gain.gain.value=enabled?volume/100:0;
        gain.connect(context.destination);
        audio.current={context,gain,buffer:null,loading:false};
      }
      const sound=audio.current;
      if(sound.context.state!=="running")void sound.context.resume().then(playPending,()=>{});
      if(sound.buffer||sound.loading)return;
      sound.loading=true;
      void fetch(soundUrl).then(response=>{
        if(!response.ok)throw new Error("Turn sound unavailable");
        return response.arrayBuffer();
      }).then(bytes=>sound.context.decodeAudioData(bytes)).then(buffer=>{
        sound.buffer=buffer;
        if(audio.current===sound)playPending();
      }).catch(()=>{}).finally(()=>{sound.loading=false;});
    }
    window.addEventListener("click",unlock,true);
    window.addEventListener("keydown",unlock,true);
    return ()=>{
      window.removeEventListener("click",unlock,true);
      window.removeEventListener("keydown",unlock,true);
      const sound=audio.current;
      audio.current=null;
      if(sound)void sound.context.close().catch(()=>{});
      media.current?.element.pause();
      media.current=null;
    };
  },[]);

  useEffect(()=>{
    if(!scope){pending.current=false;return;}
    const previous=lastTurn.current;
    // A saved game or room opened mid-turn is already in progress.
    if(previous?.scope!==scope){
      lastTurn.current={scope,key:turnKey};
      pending.current=false;
      return;
    }
    if(!turnKey){pending.current=false;return;}
    if(turnKey===previous.key)return;
    previous.key=turnKey;
    pending.current=eligible&&preference.current.enabled&&preference.current.volume>0;
    playPending();
  },[scope,turnKey,eligible]);

  function onChange(next:SoundPreference){
    preference.current=next;
    setValue(next);
    if(!next.enabled||next.volume===0)pending.current=false;
    if(audio.current)audio.current.gain.gain.value=next.enabled?next.volume/100:0;
    if(media.current){
      media.current.element.volume=next.volume/100;
      if(!next.enabled||next.volume===0)media.current.element.pause();
    }
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}
  }
  return {value,onChange};
}

export function TurnSoundSetting({value,onChange}:SoundControls){
  return <>
    <label className="guidance-setting"><input type="checkbox" checked={value.enabled} onChange={event=>onChange({...value,enabled:event.target.checked})}/>턴 알림음</label>
    <label className="guidance-setting">턴 알림음 음량 <input type="range" min={0} max={100} value={value.volume} disabled={!value.enabled} onChange={event=>onChange({...value,volume:event.target.valueAsNumber})}/><span aria-hidden="true">{value.volume}%</span></label>
  </>;
}
