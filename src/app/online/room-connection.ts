import type {RoomView} from "../../server/rooms";
import {GAME_VERSION,GAME_PROTOCOL} from "../../game/release";
export type Seat={id:string;token:string};
export type ConnectionStatus="connecting"|"live"|"polling"|"offline"|"retrying"|"expired"|"incompatible";
export function roomFetch(url:string,options:RequestInit={}){
 const headers=new Headers(options.headers);headers.set("X-Game-Version",GAME_VERSION);headers.set("X-Game-Protocol",String(GAME_PROTOCOL));
 return fetch(url,{...options,headers,signal:options.signal??AbortSignal.timeout(15_000)}).then(response=>{if(response.status===426)window.dispatchEvent(new CustomEvent("burgundy-update",{detail:response.headers.get("x-game-version")??"new"}));return response;});
}
/** POSTs stay canonical HTTP actions. WS pushes and reconnects only replace the public view. */
export function connectRoom(seat:Seat,receive:(view:RoomView)=>void,status:(s:ConnectionStatus)=>void,error:(s:string)=>void,update:(version:string)=>void){
 let stopped=false,live=false,synced=false,socket:WebSocket|null=null,poll:ReturnType<typeof setTimeout>|undefined,retry:ReturnType<typeof setTimeout>|undefined,controller:AbortController|null=null,attempt=0,wsAttempt=0,connecting=false,expired=false;
 const accept=(view:RoomView)=>{if(stopped)return false;if(view.release&&(view.release.protocol!==GAME_PROTOCOL||view.release.version!==GAME_VERSION&&GAME_VERSION!=="development")){expired=true;status("incompatible");update(view.release.version);return false;}synced=true;receive(view);error("");return true;};
 const refresh=async()=>{
  if(stopped||expired||controller)return;if(!navigator.onLine){synced=false;status("offline");return;}
  controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12_000);
  try{const response=await roomFetch(`/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`},signal:controller.signal,cache:"no-store"});const data=await response.json();
   if(stopped)return;if(response.status===401||response.status===404){expired=true;status("expired");socket?.close();error(data.error??"저장된 좌석을 확인할 수 없습니다. 다른 좌석으로 덮어쓰지 않습니다.");return;}if(data.code==="ROOM_SCHEMA_UNSUPPORTED"){expired=true;status("incompatible");socket?.close();error(data.error);return;}if(response.status===426){expired=true;status("incompatible");socket?.close();update(response.headers.get("x-game-version")??"new");return;}if(!response.ok)throw Error(data.error??"연결 실패");if(accept(data)){status(live?"live":"polling");attempt=0;}
  }catch(e){if(!stopped){synced=false;status(navigator.onLine?"retrying":"offline");error(e instanceof Error&&e.name!=="AbortError"?e.message:"연결이 지연됩니다. 진행은 서버에 보존됩니다.");}}
  finally{clearTimeout(timeout);controller=null;if(!stopped&&!expired)poll=setTimeout(()=>void refresh(),live?15_000:Math.min(15_000,1200*2**Math.min(attempt++,4)));}
 };
 const open=()=>{
  if(stopped||expired||connecting||!navigator.onLine||socket?.readyState===WebSocket.OPEN)return;
  connecting=true;const url=new URL(`/api/rooms/${seat.id}/live`,location.origin);url.protocol=location.protocol==="https:"?"wss:":"ws:";
  const ws=new WebSocket(url);socket=ws;
  ws.onopen=()=>{if(stopped||socket!==ws){ws.close();return;}connecting=false;ws.send(JSON.stringify({type:"authenticate",token:seat.token,version:GAME_VERSION,protocol:GAME_PROTOCOL}));};
  ws.onmessage=e=>{if(stopped||socket!==ws)return;try{const data=JSON.parse(e.data);if(data.type==="state"&&accept(data.view)){live=true;wsAttempt=0;status("live");}else if(data.type==="update")update(data.version);else if(data.type==="error")error(data.message);}catch{ws.close(1002);}};
  ws.onerror=()=>ws.close();ws.onclose=()=>{if(socket!==ws)return;const wasLive=live;live=false;if(wasLive)synced=false;connecting=false;socket=null;clearTimeout(retry);if(!stopped&&!expired){if(!synced)status(navigator.onLine?"retrying":"offline");clearTimeout(poll);poll=setTimeout(()=>void refresh(),0);retry=setTimeout(open,Math.min(15_000,1000*2**Math.min(wsAttempt++,4)));}};
 };
 const wake=()=>{if(stopped||document.visibilityState==="hidden")return;status("connecting");clearTimeout(poll);void refresh();open();};
 const offline=()=>{synced=false;status("offline");socket?.close();controller?.abort();};
 const retryNow=()=>{expired=false;clearTimeout(retry);status("connecting");wake();};
 status("connecting");void refresh();open();window.addEventListener("online",wake);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",wake);window.addEventListener("pageshow",wake);window.addEventListener("burgundy-room-retry",retryNow);
 return()=>{stopped=true;clearTimeout(poll);clearTimeout(retry);controller?.abort();socket?.close();window.removeEventListener("online",wake);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",wake);window.removeEventListener("pageshow",wake);window.removeEventListener("burgundy-room-retry",retryNow);};
}
