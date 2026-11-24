import {useEffect,useEffectEvent,useId,useRef,useState} from "react";
import {PLAYER_PALETTE} from "../game/player-colors";
import type {StarterMethod,StarterRolls} from "../game/starting-player";
import type {PlayerColor} from "../game/types";
import {WhiteDie} from "./white-die";

export function StarterMethodSetting({method,onChange}:{method:StarterMethod;onChange:(value:StarterMethod)=>void}){
  return <label>시작 플레이어 결정 방식 <select aria-label="시작 플레이어 결정 방식" value={method} onChange={event=>onChange(event.target.value as StarterMethod)}>
    <option value="roll">주사위 굴림으로 결정</option>
    <option value="manual">시작 플레이어 수동 지정</option>
  </select></label>;
}

export function StarterDialog({players,rolls,seat,disabled,error,onRoll,onStart,onClose}:{
  players:readonly {name:string;color:PlayerColor;computer?:boolean}[];
  rolls:StarterRolls;seat?:number;disabled?:boolean;error?:string;
  onRoll:(seat:number)=>void;onStart?:()=>void;onClose:()=>void;
}){
  const ref=useRef<HTMLDialogElement>(null);
  const title=useId();
  const [rolling,setRolling]=useState<number|null>(null);
  const [frame,setFrame]=useState(1);
  const roll=useEffectEvent(onRoll);
  const computer=rolls.pending.find(i=>players[i].computer);
  useEffect(()=>{
    const dialog=ref.current!;
    dialog.showModal();
    return ()=>dialog.close();
  },[]);
  useEffect(()=>{
    if(rolling===null){
      if(computer===undefined||disabled)return;
      const timer=setTimeout(()=>setRolling(computer),250);
      return ()=>clearTimeout(timer);
    }
    const frames=setInterval(()=>setFrame(value=>value%6+1),75);
    const end=setTimeout(()=>{roll(rolling);setRolling(null);},450);
    return ()=>{clearInterval(frames);clearTimeout(end);};
  },[computer,disabled,rolling]);
  const winner=rolls.winner;
  return <dialog className="starter-dialog" ref={ref} aria-labelledby={title} onCancel={event=>{event.preventDefault();onClose();}}>
    <h2 id={title}>시작 플레이어 결정</h2>
    <p role="status">
      {winner!==null?<strong><span aria-hidden="true">♛ </span>{players[winner].name} 님이 시작합니다.</strong>:rolls.round>1
        ?`최고 눈이 같아 재굴림합니다 · ${rolls.eligible.map(i=>players[i].name).join(", ")}`
        :"각자 주사위를 누르세요. 가장 높은 눈을 굴린 플레이어가 시작합니다."}
    </p>
    <ul className="starter-seats">
      {players.map((player,i)=>{
        const pending=rolls.pending.includes(i),paint=PLAYER_PALETTE[player.color],face=rolls.faces[i];
        return <li key={i} data-starter-seat={i} data-starter-winner={winner===i||undefined} data-starter-tied={rolls.round>1&&winner===null&&rolls.eligible.includes(i)||undefined}>
          <span className="starter-name"><span className="seat-color-preview" style={{background:paint.fill}} aria-hidden="true"/><strong>{player.name}</strong>{player.computer&&<small>AI</small>}</span>
          <button type="button" className="starter-roll" aria-label={`좌석 ${i+1} ${player.name} ${rolls.round===1?"주사위 굴리기":"주사위 다시 굴리기"}`} disabled={disabled||rolling!==null||!pending||player.computer||seat!==undefined&&seat!==i} onClick={()=>setRolling(i)}>
            <svg viewBox="-20 -20 40 40" className={rolling===i?"starter-tumbling":undefined} aria-hidden="true"><WhiteDie raised value={rolling===i?frame:face}/></svg>
          </button>
          <span className="starter-result">
            {rolling===i?"굴리는 중":pending?rolls.round===1?"굴림 대기":`직전 ${face} · 재굴림 대기`:face===null?"—":`눈 ${face}`}{winner===i&&<span aria-label="시작 플레이어"> ♛</span>}
          </span>
        </li>;
      })}
    </ul>
    {error&&<p role="alert">{error}</p>}
    <div className="starter-controls">
      <button type="button" className="outline-button" onClick={onClose}>닫기</button>
      {onStart?<button type="button" className="primary-button" disabled={disabled||winner===null||rolling!==null} onClick={onStart}>게임 시작</button>:winner!==null&&<span>방장이 게임을 시작할 때까지 기다려 주세요.</span>}
    </div>
  </dialog>;
}
