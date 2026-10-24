import type {RoomView} from "../../server/rooms";
import {roomFetch,type Seat} from "./room-connection";

export interface PendingRoomAction {version:1;requestId:string;revision:number;action:unknown}
const key=(seat:Seat)=>`burgundy-online-action:${seat.id}`;
export function loadRoomAction(seat:Seat,playerId:string):PendingRoomAction|null{
 const raw=localStorage.getItem(key(seat));if(!raw)return null;
 const p=JSON.parse(raw) as PendingRoomAction,action=p?.action as {playerId?:unknown;type?:unknown}|null;
 if(p?.version!==1||typeof p.requestId!=="string"||!/^[A-Za-z0-9_-]{16,80}$/.test(p.requestId)||!Number.isSafeInteger(p.revision)||p.revision<0||!action||action.playerId!==playerId||typeof action.type!=="string")throw Error("브라우저의 미확인 행동 기록을 읽지 못했습니다. 서버의 게임과 좌석은 보존됩니다.");
 return p;
}
export function queueRoomAction(seat:Seat,revision:number,action:unknown):PendingRoomAction{
 const pending:PendingRoomAction={version:1,requestId:crypto.randomUUID(),revision,action};
 localStorage.setItem(key(seat),JSON.stringify(pending));return pending;
}
export function clearRoomAction(seat:Seat,requestId:string){
 const raw=localStorage.getItem(key(seat));if(raw&&JSON.parse(raw).requestId===requestId)localStorage.removeItem(key(seat));
}
export class RoomActionError extends Error {constructor(message:string,readonly retryable:boolean){super(message);}}
export async function postRoomAction(seat:Seat,pending:PendingRoomAction):Promise<RoomView>{
 const response=await roomFetch(`/api/rooms/${seat.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${seat.token}`},body:JSON.stringify(pending)});
 const data=await response.json();if(!response.ok)throw new RoomActionError(data.error??"행동 저장 확인에 실패했습니다.",response.status>=500||response.status===429);
 return data;
}
