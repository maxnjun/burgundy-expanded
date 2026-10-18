import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { replaceRoomFile } from "./atomic-write";
import { join } from "node:path";
import { createPracticeSession } from "../game/practice";
import { applyCoreAction, checkCoreGameEnd, listCoreActionOptions } from "../game/core";
import { parseSavedGame } from "../game/save";
import type { GameAction, GameState, PlayerState, Tile } from "../game/types";

export class RoomError extends Error {
  constructor(public status:number,message:string){super(message);this.name="RoomError";}
}
interface StoredRoom { version:1;id:string;createdAt:number;updatedAt:number;tokens:(string|null)[];game:GameState;logs:string[] }
export interface RoomView {
  id:string;revision:number;seat:string;stage:GameState["turn"]["stage"];phase:string;round:number;status:string;activePlayerId:string|null;
  players:readonly PlayerState[];tiles:Record<string,Tile>;
  depots:GameState["market"]["numberedDepots"];blackDepot:GameState["market"]["blackDepot"];dice:GameState["dice"];
  actions:readonly {action:GameAction;label:string;group:string}[];logs:readonly string[];joined:boolean;winnerIds:readonly string[];
}
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
const name=(value:unknown)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=30 ? value.trim() : (()=>{throw new RoomError(400,"이름은1~30자로 입력하세요.");})();

/** Single-process, file-backed development rooms. No third-party service or public deployment.
 * Only hashed seat tokens are persisted; full engine state never leaves the server.
 */
export class RoomStore {
  private locks=new Map<string,Promise<unknown>>();
  constructor(private directory:string){}
  private async serial<T>(key:string,task:()=>Promise<T>):Promise<T>{
    const previous=this.locks.get(key)??Promise.resolve();
    const current=previous.catch(()=>{}).then(task);this.locks.set(key,current);
    try{return await current;}finally{if(this.locks.get(key)===current)this.locks.delete(key);}
  }
  private path(id:string){if(!/^[a-f0-9]{24}$/.test(id))throw new RoomError(404,"방을 찾을 수 없습니다.");return join(this.directory,`${id}.json`);}
  private async read(id:string):Promise<StoredRoom>{
    let raw:string;try{raw=await readFile(this.path(id),"utf8");}catch(error){if(error instanceof RoomError)throw error;throw new RoomError(404,"방을 찾을 수 없습니다.");}
    if(raw.length>2_100_000)throw new RoomError(500,"방 데이터 검증 실패");
    const room=JSON.parse(raw) as StoredRoom;
    if(room.version!==1||room.id!==id||room.tokens.length!==2||room.tokens.some(t=>t!==null&&!/^[a-f0-9]{64}$/.test(t)))throw new RoomError(500,"방 데이터 검증 실패");
    parseSavedGame(JSON.stringify({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:room.game,logs:room.logs,view:{zoom:1,focus:false,boardZooms:{}}}));
    return room;
  }
  private async write(room:StoredRoom){
    await mkdir(this.directory,{recursive:true});
    const destination=this.path(room.id),temporary=destination+`.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporary,JSON.stringify(room),{encoding:"utf8",mode:0o600,flag:"wx"});
    await replaceRoomFile(temporary,destination);
  }
  private seat(room:StoredRoom,token:string){
    if(typeof token!=="string"||token.length<32||token.length>128)throw new RoomError(401,"좌석 인증이 필요합니다.");
    const hash=Buffer.from(digest(token),"hex");
    const index=room.tokens.findIndex(t=>t!==null&&timingSafeEqual(Buffer.from(t,"hex"),hash));
    if(index<0)throw new RoomError(401,"좌석 인증이 필요합니다.");return index;
  }
  async create(ownerName:unknown){return this.serial("create",async()=>{
    await mkdir(this.directory,{recursive:true});
    if((await readdir(this.directory)).filter(f=>f.endsWith(".json")).length>=50)throw new RoomError(503,"개발 서버 방 저장 한도에 도달했습니다.");
    const id=randomBytes(12).toString("hex"),token=randomBytes(32).toString("base64url"),now=Date.now();
    const game=createPracticeSession({names:[name(ownerName),"참가 대기"],seed:randomBytes(16).toString("hex"),officialSlots:true,boardIds:["se:base:1","se:base:2"]});
    const room:StoredRoom={version:1,id,createdAt:now,updatedAt:now,tokens:[digest(token),null],game,logs:["2인 방을 준비했습니다. 참가자를 기다립니다."]};
    await this.write(room);return {id,token};
  });}
  async joinRoom(id:string,guestName:unknown){return this.serial(id,async()=>{
    const room=await this.read(id);if(room.tokens[1])throw new RoomError(409,"이미 두 좌석이 사용 중입니다.");
    const guest=name(guestName),token=randomBytes(32).toString("base64url");
    room.tokens[1]=digest(token);room.game={...room.game,revision:room.game.revision+1,players:room.game.players.map((p,i)=>i===1?{...p,name:guest}:p),config:{...room.game.config,players:room.game.config.players.map((p,i)=>i===1?{...p,name:guest}:p)}};
    room.logs=["두 플레이어가 참가했습니다.",...room.logs];room.updatedAt=Date.now();await this.write(room);return {id,token};
  });}
  async view(id:string,token:string){const room=await this.read(id);return this.publicView(room,this.seat(room,token));}
  async act(id:string,token:string,revision:unknown,action:unknown){return this.serial(id,async()=>{
    const room=await this.read(id),seat=this.seat(room,token),player=room.game.players[seat];
    if(!room.tokens[1])throw new RoomError(409,"다른 플레이어의 참가를 기다리세요.");
    if(!Number.isSafeInteger(revision)||revision!==room.game.revision)throw new RoomError(409,"다른 행동이 먼저 반영되었습니다. 최신 상태에서 다시 선택하세요.");
    if(!action||typeof action!=="object"||!("playerId" in action)||action.playerId!==player.id)throw new RoomError(403,"다른 좌석의 행동은 실행할 수 없습니다.");
    const next=applyCoreAction(room.game,action as GameAction);
    if(!next.ok)throw new RoomError(400,"차례·주사위·자원·선택 조건을 확인하세요.");
    const after=next.value.state.players[seat],label=actionLabel(room.game,action as GameAction);
    room.logs=[`${player.name} · ${label} · 승점 ${after.victoryPoints-player.victoryPoints>=0?"+":""}${after.victoryPoints-player.victoryPoints}`,...room.logs].slice(0,60);
    room.game=next.value.state;room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  private publicView(room:StoredRoom,seat:number):RoomView{
    const s=room.game,visible=new Set<string>();
    for(const p of s.players){for(const c of p.duchy.cells)if(c.tileId)visible.add(c.tileId);for(const id of p.storage)if(id)visible.add(id);}
    for(const d of s.market.numberedDepots)for(const slot of d.slots)if(slot.tileId)visible.add(slot.tileId);
    for(const id of s.market.blackDepot)if(id)visible.add(id);
    const ending=checkCoreGameEnd(s);
    const legal=room.tokens[1] ? listCoreActionOptions(s,s.players[seat].id) : null;
    const actions=legal?.ok ? legal.value.actions.map(action=>({action,label:actionLabel(s,action),group:action.type==="use-die"?action.intent.kind:action.type})) : [];
    return {id:room.id,revision:s.revision,seat:s.players[seat].id,stage:s.turn.stage,phase:s.turn.phase,round:s.turn.round,status:s.status,activePlayerId:s.turn.activePlayerId,players:s.players,tiles:Object.fromEntries([...visible].map(id=>[id,s.tiles[id]])),depots:s.market.numberedDepots,blackDepot:s.market.blackDepot,dice:s.dice,actions,logs:room.logs,joined:!!room.tokens[1],winnerIds:ending.ok&&ending.value.ended?ending.value.winnerIds:[]};
  }
}

const tileName=(s:GameState,id:string)=>{const t=s.tiles[id];return t.type==="building"?({crane:"기중기",market:"시장",bank:"은행",church:"교회",warehouse:"창고","boarding-house":"숙소","carpenters-workshop":"목공소","town-hall":"시청",watchtower:"감시탑"})[t.building]:t.type==="monastery"?`수도원${t.number}`:t.type==="livestock"?`${({cattle:"소",sheep:"양",pigs:"돼지",chickens:"닭",geese:"거위"})[t.species]}${t.count}`:({castle:"성",mine:"광산",ship:"선박"})[t.type];};
export function actionLabel(s:GameState,a:GameAction):string{
  if(a.type==="roll-round")return "라운드 주사위 굴리기";
  if(a.type==="end-turn")return "차례 종료";
  if(a.type==="advance-phase")return s.turn.phase==="E"?"최종 정산":"단계 수입·보충";
  if(a.type==="resolve-choice")return s.turn.pendingChoice?.options.find(o=>o.id===a.optionId)?.label??"효과 선택";
  if(a.type==="buy-black-tile"||a.type==="use-monastery-six")return `${tileName(s,a.tileId)} 획득 · ${a.type==="buy-black-tile"?"은화2":"일꾼2"} · 보관${a.storageSlot+1}${a.discardTileId?" 교체":""}`;
  if(a.type!=="use-die")return "확장 행동";
  const i=a.intent,label=i.kind==="take-workers"?"일꾼2 획득":i.kind==="sell-goods"?`${i.goodsType}번 상품 판매`:i.kind==="take-tile"?`${i.depot}번 ${tileName(s,i.tileId)} 획득 · 보관${i.storageSlot+1}${i.discardTileId?" 교체":""}`:`${tileName(s,i.tileId)} → (${i.cellId}) 배치`;
  return `${label} · 주사위${s.dice.players[a.playerId].findIndex(d=>d.id===a.dieId)+1} · 일꾼${a.adjustment.workersSpent}`;
}
