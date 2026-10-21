import { join } from "node:path";
import { RoomError, RoomStore } from "./rooms";
import {serverRelease} from "./release";
import {roomLimit} from "./room-limit";

const root=globalThis as typeof globalThis & {burgundyRooms?:RoomStore;burgundyReadRoom?:(id:string,token:string)=>Promise<unknown>};
export const rooms=root.burgundyRooms??=new RoomStore(process.env.BURGUNDY_DATA_DIR||join(process.cwd(),".local-data","rooms"));
root.burgundyReadRoom=(id,token)=>rooms.view(id,token);
export function token(request:Request){return request.headers.get("authorization")?.replace(/^Bearer /,"")??"";}
export async function body(request:Request):Promise<Record<string,unknown>>{
  const release=serverRelease();
  if(release.version!=="development"&&(request.headers.get("x-game-version")!==release.version||request.headers.get("x-game-protocol")!==String(release.protocol)))throw new RoomError(426,"게임이 업데이트되었습니다. 진행은 서버에 보존됩니다. 새로고침하세요.");
  const origin=request.headers.get("origin");
  if(origin){
    let originHost:string;try{originHost=new URL(origin).host;}catch{throw new RoomError(403,"요청 출처를 확인하세요.");}
    // Next's internal request URL may use localhost while the browser uses127.0.0.1.
    const host=request.headers.get("host")??new URL(request.url).host;
    if(originHost.toLowerCase()!==host.toLowerCase())throw new RoomError(403,"다른 사이트에서 보낸 요청은 허용하지 않습니다.");
  }
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new RoomError(415,"JSON 요청이 필요합니다.");
  const reader=request.body?.getReader();if(!reader)throw new RoomError(400,"요청 내용이 없습니다.");
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>32_000){await reader.cancel();throw new RoomError(413,"요청이 너무 큽니다.");}chunks.push(chunk.value);}
  let parsed:unknown;try{parsed=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new RoomError(400,"JSON 형식을 확인하세요.");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new RoomError(400,"요청 형식을 확인하세요.");
  return parsed as Record<string,unknown>;
}
function knownRoomError(error:unknown):error is RoomError{
  if(!(error instanceof Error))return false;
  // A development HMR can preserve the RoomStore while replacing this module's class.
  const candidate=error as Error & {status?:number};
  return (error.name==="RoomError"||error.constructor.name==="RoomError")&&[400,401,403,404,409,413,415,426,429,500,503].includes(candidate.status??0);
}
export async function respond(task:()=>Promise<unknown>){
  const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Game-Version":serverRelease().version};
  try{return Response.json(await task(),{headers});}
  catch(error){return Response.json({error:knownRoomError(error)?error.message:"서버 저장 또는 검증에 실패했습니다. 진행은 기존 저장에서 보존됩니다."},{status:knownRoomError(error)?error.status:500,headers});}
}

/** Shared handlers allow integration tests to inject an isolated store, never live rooms. */
export function roomHandlers(store:RoomStore=rooms){return {
 create:(request:Request)=>respond(async()=>{roomLimit(request,"create",10);const data=await body(request);return store.create(data.name,data.shieldRules===undefined?false:data.shieldRules,data.whiteCastles===undefined?false:data.whiteCastles,data.boardRange??null,data.inns===undefined?false:data.inns,data.tradeRoutes===undefined?false:data.tradeRoutes,data.vineyards===undefined?false:data.vineyards,data.excludedGrapes??[],data.chooseStartingCastles??false,{id:data.roomId,token:data.seatToken,lobby:data.lobby});}),
 view:(request:Request,id:string)=>respond(async()=>{roomLimit(request,"view",240);return store.view(id,token(request));}),
 join:(request:Request,id:string)=>respond(async()=>{roomLimit(request,"join",30);const data=await body(request);return store.joinRoom(id,data.name,data.seatToken);}),
 act:(request:Request,id:string)=>respond(async()=>{roomLimit(request,"act",180);const data=await body(request);return (data.action as {type?:string})?.type==="room-control"?store.control(id,token(request),data.revision,data.action):(data.action as {type?:string})?.type==="choose-board"?store.chooseBoard(id,token(request),data.revision,data.action):store.act(id,token(request),data.revision,data.action);}),
};}
