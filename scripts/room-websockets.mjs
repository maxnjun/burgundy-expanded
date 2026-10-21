import {WebSocketServer,WebSocket} from "ws";
import {EventEmitter} from "node:events";

/** Only public, seat-authorized HTTP views cross this bridge; credentials never enter URLs. */
export function attachRoomSockets(server,{port,origin,version="development",protocol=1}){
 origin=origin?new URL(origin).origin:undefined;
 const bus=globalThis.burgundyRoomEvents??=new EventEmitter();bus.setMaxListeners(1100);
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on("upgrade",(request,socket,head)=>{
  const match=/^\/api\/rooms\/([a-f0-9]{24})\/live$/.exec(request.url??"");
  if(!match||wss.clients.size>=100||request.headers.origin!==(origin||`http://${request.headers.host}`)){socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");return;}
  wss.handleUpgrade(request,socket,head,ws=>wss.emit("connection",ws,match[1]));
 });
 wss.on("connection",(ws,id)=>{
  let token=null,pending=false,again=false,revision=-1,alive=true;
  const authTimeout=setTimeout(()=>ws.close(1008,"Authentication required"),5000);
  const send=value=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1_000_000)ws.close(1013);else ws.send(JSON.stringify(value));}};
  const refresh=async()=>{
   if(!token||ws.readyState!==WebSocket.OPEN)return;if(pending){again=true;return;}pending=true;
   try{const response=globalThis.burgundyReadRoom?null:await fetch(`http://127.0.0.1:${port}/api/rooms/${id}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10_000)});const view=response?await response.json():await globalThis.burgundyReadRoom(id,token);
    if(response&&!response.ok){send({type:"error",message:response.status===401?"좌석 인증을 확인하세요.":"최신 방 상태를 확인하지 못했습니다."});ws.close(1008);}
    else if(view.revision>revision){revision=view.revision;send({type:"state",view});}
   }catch(error){ws.close(error?.status===401?1008:1012);}finally{pending=false;if(again){again=false;void refresh();}}
  };
  const changed=changedId=>{if(id===changedId)void refresh();};
  ws.on("message",raw=>{
   if(token){ws.close(1008);return;}try{const data=JSON.parse(raw.toString());if(data.type!=="authenticate"||typeof data.token!=="string"||data.token.length<32||data.token.length>128)throw Error();
    if(data.protocol!==protocol||version!=="development"&&data.version!==version){send({type:"update",version});ws.close(1008);return;}
    token=data.token;clearTimeout(authTimeout);bus.on("room",changed);void refresh();
   }catch{ws.close(1008);}
  });
  ws.on("pong",()=>{alive=true;});const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},30_000);
  ws.on("error",()=>{});ws.on("close",()=>{token=null;clearTimeout(authTimeout);clearInterval(heartbeat);bus.off("room",changed);});
 });
 return()=>{for(const client of wss.clients)client.close(1012,"Server updating");wss.close();};
}
