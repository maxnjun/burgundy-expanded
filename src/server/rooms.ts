import {purchaseUsed} from '../game/purchases';
import {monasteryNumbers} from '../game/core/state';
import {PLAYER_COLORS,isPlayerColor,playerColorKey} from "../game/player-colors";
import {roomChanged} from "./room-events";
import {serverRelease} from "./release";
import {boardTarget,type BoardTarget} from "../game/direct-actions";
import {isCastleAction} from "../game/castle-actions";
import {automaticVineReward} from "../game/core/vineyard-effects";
import {actionGuidance} from "../game/action-guidance";
import {actionLabel,createActionLog} from "../game/action-log";
import {GRAPES,type Grape} from "../game/vineyards";
import { createBoardDraft, redrawBoardSeat, selectDraftBoard, validBoardDraft, draftReady, type BoardDraft, type PublicBoardDraft, type BoardRange } from "../game/board-draft";
import type { ScoreEntry } from "../game/types";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, open, unlink, statfs } from "node:fs/promises";
import {gzip,gunzip} from "node:zlib";
import {promisify} from "node:util";
import { replaceRoomFile } from "./atomic-write";
import { join } from "node:path";
import { createPracticeSession,publicPhaseGoods } from "../game/practice";
import { applyCoreAction, checkCoreGameEnd, listCoreActionOptions } from "../game/core";
import { shieldLayout, type ShieldLayout } from "../game/shields";
import { directCost } from "../game/direct-actions";
import { parseSavedGame } from "../game/save";
import type { GameAction, GameState, PlayerState, Tile } from "../game/types";
import {beginHistory,recordTurnAction,undoTurn,canUndoTurn,turnKey,type TurnHistory} from "../game/turn-history";
import {restoreTurnHistory} from "../game/turn-history-cache";
import {startingCastleCells} from "../game/starting-castles";

import {RoomError} from "./room-error";
import type {UpstashRooms} from "./upstash-rooms";
export {RoomError} from "./room-error";
const compress=promisify(gzip),decompress=promisify(gunzip);
const ROOM_BYTES=2_100_000,WRITE_RESERVE=ROOM_BYTES*4,ARCHIVE_AGE=24*60*60*1000;
const REQUEST_LIMIT=128,REQUEST_ID=/^[A-Za-z0-9_-]{16,80}$/;
const GAME_SCHEMA:GameState["schemaVersion"]="0.2.1";
interface Receipt {id:string;seat:number;hash:string}
export function requireRoomSpace(available:number){
  if(available<WRITE_RESERVE)throw new RoomError(503,"서버 디스크의 남은 저장 공간이 부족하여 새 방을 만들 수 없습니다. 기존 방은 보존됩니다. 관리자에게 저장 공간 점검을 요청하세요.","ROOM_STORAGE_FULL");
}
interface StoredRoom { requests?:Receipt[];history?:TurnHistory;undoBarrier?:string;startingPreview?:{playerId:string;cellId:string};lobby?:{ready:[boolean,boolean];started:boolean};draft?:BoardDraft;version:1;id:string;createdAt:number;updatedAt:number;tokens:(string|null)[];game:GameState;logs:string[] }
export type OnlineUndoAction={type:"undo-turn"|"undo-action";playerId:string};
export interface RoomView {
  purchase?:{used:boolean;monasterySix:boolean};
  discardedTiles?:GameState["discardedTiles"];
  commonBoard:{marketRecipeId:GameState["config"]["marketRecipeId"];orderTrack:GameState["turn"]["orderTrack"];phaseGoodsCounts:Record<GameState["turn"]["phase"],number>;roundGoodsCount:number;revealedGoods?:readonly (import("../game/types").GoodsTile|null)[];bonusTiles:GameState["market"]["bonusTiles"]};
  undo?:{turnReason:string;actionReason:string};startingPreview?:{playerId:string;cellId:string};
  release?:ReturnType<typeof serverRelease>;lobby?:{ready:readonly boolean[];started:boolean;capacity:number};
  automaticChoice?:GameAction|null;
  boardDraft:PublicBoardDraft|null;fortressScores:Record<string,readonly ScoreEntry[]>;
  shields:Pick<ShieldLayout,"format"|"effectsActive"|"slots"|"mounted"|"removed"|"rules">|null;
  vineyards?:GameState["vineyards"];finalScores:GameState["finalScores"];tradeRoutes?:GameState["tradeRoutes"];
  guidance:string;id:string;revision:number;seat:string;stage:GameState["turn"]["stage"];phase:GameState["turn"]["phase"];round:GameState["turn"]["round"];status:string;activePlayerId:string|null;
  players:readonly PlayerState[];tiles:Record<string,Tile>;
  depots:GameState["market"]["numberedDepots"];blackDepot:GameState["market"]["blackDepot"];inns?:GameState["market"]["inns"];dice:GameState["dice"];
  castleAction:boolean;actions:readonly {action:GameAction;label:string;group:string;target:BoardTarget;cost?:number}[];logs:readonly string[];joined:boolean;winnerIds:readonly string[];
}
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
const name=(value:unknown)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=30 ? value.trim() : (()=>{throw new RoomError(400,"이름은1~30자로 입력하세요.");})();

/** File storage requires one process; external storage uses cross-process CAS.
 * Only hashed seat tokens are persisted; full engine state never leaves the server.
 */
export class RoomStore {
  private locks=new Map<string,Promise<unknown>>();
  private revisions=new WeakMap<StoredRoom,number>();
  constructor(private directory:string,private remote?:UpstashRooms){}
  private replay(room:StoredRoom,seat:number,revision:unknown,action:unknown,requestId:unknown,record=false){
    if(requestId===undefined)return false; // Existing v1 clients remain revision-validated.
    if(typeof requestId!=="string"||!REQUEST_ID.test(requestId))throw new RoomError(400,"행동 요청 ID를 확인하세요.");
    const hash=digest(JSON.stringify({revision,action})),previous=room.requests?.find(r=>r.id===requestId&&r.seat===seat);
    if(previous){if(previous.hash!==hash)throw new RoomError(409,"이미 사용한 요청 ID로 다른 행동을 실행할 수 없습니다.");return true;}
    if(record)room.requests=[...(room.requests??[]).slice(1-REQUEST_LIMIT),{id:requestId,seat,hash}];
    return false;
  }
  private async mutate(id:string,token:string,revision:unknown,action:unknown,requestId:unknown,apply:(room:StoredRoom,seat:number)=>Promise<RoomView>){
    return this.serial(id,async()=>{
      const room=await this.read(id),seat=this.seat(room,token);
      if(this.replay(room,seat,revision,action,requestId,true))return this.publicView(room,seat);
      try{return await apply(room,seat);}catch(error){
        // Another process or a lost Redis response may have committed this exact request.
        if(requestId!==undefined&&error instanceof RoomError&&[409,503].includes(error.status)){
          try{const saved=await this.read(id),owner=this.seat(saved,token);if(this.replay(saved,owner,revision,action,requestId)){roomChanged(id);return this.publicView(saved,owner);}}catch{}
        }
        throw error;
      }
    });
  }
  private async serial<T>(key:string,task:()=>Promise<T>):Promise<T>{
    const previous=this.locks.get(key)??Promise.resolve();
    const current=previous.catch(()=>{}).then(task);this.locks.set(key,current);
    try{return await current;}finally{if(this.locks.get(key)===current)this.locks.delete(key);}
  }
  private path(id:string){if(!/^[a-f0-9]{24}$/.test(id))throw new RoomError(404,"방을 찾을 수 없습니다.");return join(this.directory,`${id}.json`);}
  private archivePath(id:string){this.path(id);return join(this.directory,"archive",`${id}.json.gz`);}
  private async raw(id:string):Promise<string>{
    if(this.remote){const raw=await this.remote.read(id);if(raw===null)throw new RoomError(404,"방을 찾을 수 없습니다.");return raw;}
    try{return await readFile(this.path(id),"utf8");}catch(error){
      if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;
      try{return (await decompress(await readFile(this.archivePath(id)),{maxOutputLength:ROOM_BYTES})).toString("utf8");}catch(archivedError){
        if((archivedError as NodeJS.ErrnoException).code!=="ENOENT")throw archivedError;
        return readFile(this.path(id),"utf8");
      }
    }
  }
  private async read(id:string):Promise<StoredRoom>{
    let raw:string;try{raw=await this.raw(id);}catch(error){if(error instanceof RoomError)throw error;throw new RoomError((error as NodeJS.ErrnoException).code==="ENOENT"?404:500,"방을 읽을 수 없습니다. 기존 저장은 변경하지 않습니다.");}
    if(Buffer.byteLength(raw)>ROOM_BYTES)throw new RoomError(500,"방 데이터 검증 실패");
    let room:StoredRoom;try{room=JSON.parse(raw) as StoredRoom;}catch{throw new RoomError(500,"방 데이터 검증 실패 · 원본은 보존됩니다.");}
    if(!room||room.version!==1||room.game?.schemaVersion!==GAME_SCHEMA)throw new RoomError(409,"이 서버가 지원하지 않는 방 또는 게임 저장 형식입니다. 원본은 보존됩니다. 호환 버전으로 접속하세요.","ROOM_SCHEMA_UNSUPPORTED");
    if(room.id!==id||!Array.isArray(room.tokens)||room.tokens.length!==2||room.tokens.some(t=>t!==null&&!/^[a-f0-9]{64}$/.test(t)))throw new RoomError(500,"방 데이터 검증 실패");
    if(room.requests!==undefined&&(!Array.isArray(room.requests)||room.requests.length>REQUEST_LIMIT||room.requests.some(r=>!r||typeof r.id!=="string"||!REQUEST_ID.test(r.id)||![0,1].includes(r.seat)||typeof r.hash!=="string"||!/^[a-f0-9]{64}$/.test(r.hash))||new Set(room.requests.map(r=>`${r.seat}:${r.id}`)).size!==room.requests.length))throw new RoomError(500,"행동 복구 기록 검증 실패 · 원본은 보존됩니다.");
    room.requests??=[]; // Additive v1 migration in memory; a read never rewrites legacy Redis data.
    if(room.lobby&&(!Array.isArray(room.lobby.ready)||room.lobby.ready.length!==2||room.lobby.ready.some(r=>typeof r!=="boolean")||typeof room.lobby.started!=="boolean"))throw new RoomError(500,"방 준비 데이터 검증 실패");
    if(room.draft&&!validBoardDraft(room.draft,["seat-1","seat-2"]))throw new RoomError(500,"영지 후보 검증 실패");
    room.game=parseSavedGame(JSON.stringify({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:room.game,logs:room.logs,view:{zoom:1,focus:false,boardZooms:{}}})).game;
    if(room.draft&&draftReady(room.draft)&&room.draft.seats.some((s,i)=>s.selected!==room.game.players[i].duchy.boardId))throw new RoomError(500,"선택 영지와 게임 상태가 일치하지 않습니다.");
    if(room.startingPreview&&(room.startingPreview.playerId!==room.game.turn.activePlayerId||!startingCastleCells(room.game,room.startingPreview.playerId).includes(room.startingPreview.cellId)))throw new RoomError(500,"시작 성 미리보기 검증 실패");
    if(room.history)room.history=restoreTurnHistory(JSON.stringify({game:room.game,logs:room.logs,history:room.history}),room.game,room.logs);
    this.revisions.set(room,room.game.revision);return room;
  }
  private async write(room:StoredRoom){
    if(Buffer.byteLength(JSON.stringify(room))>ROOM_BYTES&&room.history){room.history=beginHistory(room.game,room.logs);room.undoBarrier="되돌리기 기록 한도에 도달했습니다. 현재 진행은 보존됩니다.";}
    if(Buffer.byteLength(JSON.stringify(room))>ROOM_BYTES)throw new RoomError(503,"방 데이터의 저장 한도를 초과했습니다. 이전 저장은 유지됩니다.","ROOM_STORAGE_FULL");
    if(this.remote){await this.remote.write(room.id,JSON.stringify(room),this.revisions.get(room)??null);roomChanged(room.id);return;}
    await mkdir(this.directory,{recursive:true});
    const destination=this.path(room.id),temporary=destination+`.${randomBytes(6).toString("hex")}.tmp`;
    try{
      const previous=await this.raw(room.id),revision=JSON.parse(previous).game.revision;
      const archive=join(this.directory,"backups",room.id);await mkdir(archive,{recursive:true});
      try{await writeFile(join(archive,`${revision}.json`),previous,{mode:0o600,flag:"wx"});}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;}
      const old=(await readdir(archive)).filter(n=>/^\d+\.json$/.test(n)).sort((a,b)=>Number(b.split('.')[0])-Number(a.split('.')[0]));
      for(const file of old.slice(8))await unlink(join(archive,file));
    }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
    const file=await open(temporary,"wx",0o600);try{await file.writeFile(JSON.stringify(room));await file.sync();}finally{await file.close();}
    await replaceRoomFile(temporary,destination);
    try{await unlink(this.archivePath(room.id));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
    roomChanged(room.id);
  }
  async maintain(){return this.serial("maintenance",async()=>{
    if(this.remote)return 0;
    await mkdir(this.directory,{recursive:true});let archived=0;
    for(const file of await readdir(this.directory))if(/^[a-f0-9]{24}\.json$/.test(file))await this.serial(file.slice(0,-5),async()=>{
      const id=file.slice(0,-5),raw=await this.raw(id),room=JSON.parse(raw) as StoredRoom;
      // Keep every ongoing game; only cold finished games and untouched one-seat lobbies qualify.
      if(!Number.isFinite(room.updatedAt)||Date.now()-room.updatedAt<ARCHIVE_AGE||!(room.game.status==="finished"||!room.tokens[1]&&!room.lobby?.started&&room.game.revision===0))return;
      await this.read(id);
      const destination=this.archivePath(id),temporary=destination+`.${randomBytes(6).toString("hex")}.tmp`;
      await mkdir(join(this.directory,"archive"),{recursive:true});
      const compressed=await compress(raw),handle=await open(temporary,"wx",0o600);
      try{await handle.writeFile(compressed);await handle.sync();}finally{await handle.close();}
      await replaceRoomFile(temporary,destination);
      if((await decompress(await readFile(destination),{maxOutputLength:ROOM_BYTES})).toString("utf8")!==raw)throw new RoomError(500,"방 보관 검증에 실패했습니다. 원본 방은 유지됩니다.");
      await unlink(this.path(id));archived++;
    });
    return archived;
  });}
  private seat(room:StoredRoom,token:string){
    if(typeof token!=="string"||token.length<32||token.length>128)throw new RoomError(401,"좌석 인증이 필요합니다.");
    const hash=Buffer.from(digest(token),"hex");
    const index=room.tokens.findIndex(t=>t!==null&&timingSafeEqual(Buffer.from(t,"hex"),hash));
    if(index<0)throw new RoomError(401,"좌석 인증이 필요합니다.");return index;
  }
  async create(ownerName:unknown,shieldRules:unknown=false,whiteCastles:unknown=false,boardRange:unknown=null,inns:unknown=false,tradeRoutes:unknown=false,vineyards:unknown=false,excludedGrapes:unknown=[],chooseStartingCastles:unknown=false,connection:unknown={},geese:unknown=true){return this.serial("create",async()=>{
    if(boardRange!==null&&!["base","fortress","all"].includes(boardRange as string))throw new RoomError(400,"영지 범위를 확인하세요.");
    if(!Array.isArray(excludedGrapes)||excludedGrapes.length>2||new Set(excludedGrapes).size!==excludedGrapes.length||excludedGrapes.some(g=>!GRAPES.includes(g))||(!vineyards&&excludedGrapes.length))throw new RoomError(400,"포도 품종 축소 설정을 확인하세요.");
    if(typeof chooseStartingCastles!=="boolean")throw new RoomError(400,"시작 성 선택 설정을 확인하세요.");
    if(typeof vineyards!=="boolean")throw new RoomError(400,"포도밭 설정은 참/거짓이어야 합니다.");
    if(typeof tradeRoutes!=="boolean")throw new RoomError(400,"무역로 설정은 참/거짓이어야 합니다.");
    if(typeof inns!=="boolean")throw new RoomError(400,"여관 설정은 참/거짓이어야 합니다.");
    if(typeof whiteCastles!=="boolean")throw new RoomError(400,"흰 성 설정은 참/거짓이어야 합니다.");

    if(typeof geese!=="boolean")throw new RoomError(400,"하프물범 설정은 참/거짓이어야 합니다.");
    if(typeof shieldRules!=="boolean")throw new RoomError(400,"방패 설정은 참/거짓이어야 합니다.");
    if(!connection||typeof connection!=="object"||Array.isArray(connection))throw new RoomError(400,"연결 정보를 확인하세요.");
    const c=connection as {id?:unknown;token?:unknown;lobby?:unknown;color?:unknown};
    if(c.lobby!==undefined&&typeof c.lobby!=="boolean"||((c.id===undefined)!==(c.token===undefined))||c.id!==undefined&&(typeof c.id!=="string"||!/^[a-f0-9]{24}$/.test(c.id)||typeof c.token!=="string"||!/^[A-Za-z0-9_-]{43,128}$/.test(c.token)))throw new RoomError(400,"연결 정보를 확인하세요.");
    const id=c.id as string|undefined??randomBytes(12).toString("hex"),token=c.token as string|undefined??randomBytes(32).toString("base64url"),now=Date.now();
    if(c.id){try{const old=await this.read(id);if(old.tokens[0]!==digest(token))throw new RoomError(409,"이미 사용 중인 방 코드입니다.");return {id,token};}catch(e){if(!(e instanceof RoomError)||e.status!==404)throw e;}}
    name(ownerName);
    if(c.color!==undefined&&!isPlayerColor(c.color))throw new RoomError(400,"플레이어 색상을 확인하세요.");
    const ownerColor=isPlayerColor(c.color)?c.color:"blue",guestColor=PLAYER_COLORS.find(color=>color!==ownerColor)!;
    if(!this.remote){await mkdir(this.directory,{recursive:true});await this.maintain();const disk=await statfs(this.directory);requireRoomSpace(disk.bavail*disk.bsize);}
    const game=createPracticeSession({names:[name(ownerName),"영주 2"],colors:[ownerColor,guestColor],seed:randomBytes(16).toString("hex"),chooseStartingCastles,shieldRules,whiteCastles,inns,tradeRoutes,vineyards,geese,excludedGrapes:excludedGrapes as Grape[],officialSlots:true,boardIds:["se:base:1","se:base:2"]});
    const room:StoredRoom={...(c.lobby?{lobby:{ready:[false,false],started:false}}:{}),...(boardRange!==null?{draft:createBoardDraft(["seat-1","seat-2"],boardRange as BoardRange,randomBytes(16).toString("hex"))}:{}),version:1,id,createdAt:now,updatedAt:now,tokens:[digest(token),null],game,logs:["2인 방을 준비했습니다. 참가자를 기다립니다."]};
    await this.write(room);return {id,token};
  });}
  async joinRoom(id:string,guestName:unknown,reconnectToken:unknown=undefined,color:unknown=undefined){return this.serial(id,async()=>{
    if(reconnectToken!==undefined&&(typeof reconnectToken!=="string"||!/^[A-Za-z0-9_-]{43,128}$/.test(reconnectToken)))throw new RoomError(400,"재접속 정보를 확인하세요.");
    const room=await this.read(id);if(room.tokens[1]){if(typeof reconnectToken==="string"&&room.tokens[1]===digest(reconnectToken))return {id,token:reconnectToken};throw new RoomError(409,"이미 두 좌석이 사용 중입니다.");}
    if(typeof reconnectToken==="string"&&room.tokens[0]===digest(reconnectToken))throw new RoomError(409,"다른 자리와 같은 인증 정보는 사용할 수 없습니다.");
    const guest=name(guestName),token=typeof reconnectToken==="string"?reconnectToken:randomBytes(32).toString("base64url");
    if(color!==undefined&&!isPlayerColor(color))throw new RoomError(400,"플레이어 색상을 확인하세요.");
    const hostColor=playerColorKey(room.game.players[0]),guestColor=isPlayerColor(color)?color:PLAYER_COLORS.find(c=>c!==hostColor)!;
    if(guestColor===hostColor)throw new RoomError(409,"이미 사용 중인 색상입니다. 다른 색상을 선택하세요.");
    room.tokens[1]=digest(token);room.game={...room.game,revision:room.game.revision+1,players:room.game.players.map((p,i)=>i===1?{...p,name:guest,color:guestColor}:p),config:{...room.game.config,players:room.game.config.players.map((p,i)=>i===1?{...p,name:guest,color:guestColor}:p)}};
    room.logs=["두 플레이어가 참가했습니다.",...room.logs];room.updatedAt=Date.now();await this.write(room);return {id,token};
  });}
  async view(id:string,token:string){const room=await this.read(id);return this.publicView(room,this.seat(room,token));}
  async act(id:string,token:string,revision:unknown,action:unknown,requestId?:unknown){return this.mutate(id,token,revision,action,requestId,async(room,seat)=>{
    const player=room.game.players[seat];
    if(room.lobby&&!room.lobby.started)throw new RoomError(409,"모두 준비한 뒤 방장이 게임을 시작해야 합니다.");
    if(room.draft&&!draftReady(room.draft))throw new RoomError(409,"양쪽 영지를 선택해야 게임을 시작합니다.");
    if(!room.tokens[1])throw new RoomError(409,"다른 플레이어의 참가를 기다리세요.");
    if(!Number.isSafeInteger(revision)||revision!==room.game.revision)throw new RoomError(409,"다른 행동이 먼저 반영되었습니다. 최신 상태에서 다시 선택하세요.");
    if(!action||typeof action!=="object"||!("playerId" in action)||action.playerId!==player.id)throw new RoomError(403,"다른 좌석의 행동은 실행할 수 없습니다.");
    const type=(action as {type?:unknown}).type;
    if(type==="undo-turn"||type==="undo-action"){
      const reason=this.undoReason(room,player.id,type==="undo-turn"?"turn":"action");if(reason)throw new RoomError(400,reason);
      if(room.game.status==="setup")delete room.startingPreview;
      else {const restored=undoTurn(room.history!,room.game,type==="undo-turn"?"turn":"action")!;room.game={...restored.snapshot.game,revision:room.game.revision};room.logs=[...restored.snapshot.logs];room.history=restored.history;}
      room.game={...room.game,revision:room.game.revision+1};room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
    }
    if(type==="undo"||type==="restore-state")throw new RoomError(400,"서버에 저장된 현재 차례 기록만 복원할 수 있습니다.");
    if(room.game.status==="setup"){
      if(player.id!==room.game.turn.activePlayerId)throw new RoomError(403,"현재 시작 성 배치 차례가 아닙니다.");
      if(type==="place-starting-castle"){
        const cellId=(action as {cellId?:unknown}).cellId;if(typeof cellId!=="string"||!startingCastleCells(room.game,player.id).includes(cellId))throw new RoomError(400,"유효한 시작 성 칸을 선택하세요.");
        room.startingPreview={playerId:player.id,cellId};room.game={...room.game,revision:room.game.revision+1};room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
      }
      if(type!=="end-turn"||!room.startingPreview)throw new RoomError(400,"시작 성 위치를 선택한 뒤 턴 종료로 확정하세요.");
      action={type:"place-starting-castle",playerId:player.id,cellId:room.startingPreview.cellId};delete room.startingPreview;
    }
    const before=room.game,previousLogs=room.logs;
    const next=applyCoreAction(room.game,action as GameAction);
    if(!next.ok)throw new RoomError(400,"차례·주사위·자원·선택 조건을 확인하세요.");
    const fortress=next.value.state.scoreLedger[player.id].filter(e=>e.id.startsWith("fortress:")&&!room.game.scoreLedger[player.id].some(old=>old.id===e.id)).map(e=>`${e.source.section} +${e.points}점`).join(" · ");
    room.logs=[createActionLog(before,next.value.state,action as GameAction,fortress),...room.logs].slice(0,60);
    room.game=next.value.state;
    if(before.random.cursor!==room.game.random.cursor){room.history=beginHistory(room.game,room.logs);room.undoBarrier="새 무작위 결과가 공개된 행동 이전으로는 되돌릴 수 없습니다.";}
    else {room.history=recordTurnAction(room.history??beginHistory(before,previousLogs),before,room.game,action as GameAction,previousLogs,room.logs);if(room.history.start)delete room.undoBarrier;}
    // Dice become public before the first player's undo checkpoint is established.
    if(turnKey(before)!==turnKey(room.game)){room.history=beginHistory(room.game,room.logs,true);delete room.undoBarrier;}
    room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  private undoReason(room:StoredRoom,playerId:string,kind:"turn"|"action"){
    if(room.game.turn.activePlayerId!==playerId)return "현재 내 차례의 행동만 되돌릴 수 있습니다.";
    if(room.game.status==="setup")return room.startingPreview?"":"취소할 시작 성 임시 배치가 없습니다.";
    if(room.history&&canUndoTurn(room.history,room.game,kind))return "";
    return room.undoBarrier||(kind==="turn"&&!room.history?.start?"이 차례의 시작 기록이 없습니다. 새 행동의 이전 행동으로만 복원할 수 있습니다.":"되돌릴 확정 행동이 없습니다. 종료된 차례는 복원할 수 없습니다.");
  }
  async control(id:string,token:string,revision:unknown,command:unknown,requestId?:unknown){return this.mutate(id,token,revision,command,requestId,async(room,seat)=>{
    const c=command as {command?:string;ready?:unknown;playerId?:string;name?:unknown;color?:unknown};
    if(!room.lobby||room.lobby.started)throw new RoomError(409,"이미 시작된 방입니다.");
    if(c?.playerId!==room.game.players[seat].id)throw new RoomError(403,"본인의 준비와 이름·색상만 변경할 수 있습니다.");
    if(revision!==room.game.revision)throw new RoomError(409,"최신 준비 상태에서 다시 선택하세요.");
    if(c.command==="ready"&&typeof c.ready==="boolean")room.lobby.ready[seat]=c.ready;
    else if(c.command==="profile"){
      const nextName=name(c.name);
      if(!isPlayerColor(c.color))throw new RoomError(400,"플레이어 색상을 확인하세요.");
      const nextColor=c.color;
      if(room.game.players.some((p,i)=>i!==seat&&room.tokens[i]!==null&&playerColorKey(p)===nextColor))throw new RoomError(409,"이미 사용 중인 색상입니다. 다른 색상을 선택하세요.");
      const profiles=room.game.players.map((p,i)=>i===seat?{...p,name:nextName,color:nextColor}:p);
      // Keep the unoccupied seat distinct so existing save validation still applies.
      const vacant=room.tokens.findIndex(t=>t===null);
      if(vacant>=0&&playerColorKey(profiles[vacant])===nextColor)profiles[vacant]={...profiles[vacant],color:PLAYER_COLORS.find(color=>color!==nextColor)!};
      room.game={...room.game,players:profiles,config:{...room.game.config,players:room.game.config.players.map((p,i)=>({...p,name:profiles[i].name,color:profiles[i].color}))}};
      room.lobby.ready[seat]=false;
    }
    else if(c.command==="start"){
      if(seat!==0)throw new RoomError(403,"방장만 시작할 수 있습니다.");
      if(!room.tokens[1]||!room.lobby.ready.every(Boolean)||room.draft&&!draftReady(room.draft))throw new RoomError(409,"두 플레이어의 준비와 영지 선택을 완료하세요.");room.lobby.started=true;
    }else throw new RoomError(400,"준비 명령을 확인하세요.");
    room.game={...room.game,revision:room.game.revision+1};room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  async checkStorage(){
    if(this.remote){await this.remote.check();return;}
    await mkdir(this.directory,{recursive:true});
    for(const file of await readdir(this.directory))if(/^[a-f0-9]{24}\.json$/.test(file))await this.read(file.slice(0,-5));
    const archived=await readdir(join(this.directory,"archive")).catch((e:NodeJS.ErrnoException)=>{if(e.code!=="ENOENT")throw e;return [];});
    for(const file of archived)if(/^[a-f0-9]{24}\.json\.gz$/.test(file))await this.read(file.slice(0,24));
  }
  async chooseBoard(id:string,token:string,revision:unknown,command:unknown,requestId?:unknown){return this.mutate(id,token,revision,command,requestId,async(room,seat)=>{
    const playerId=room.game.players[seat].id;
    if(!room.draft||draftReady(room.draft))throw new RoomError(409,"영지 선택이 이미 종료되었습니다.");
    if(revision!==room.game.revision)throw new RoomError(409,"최신 후보 상태에서 다시 선택하세요.");
    const c=command as {playerId?:unknown;range?:unknown;boardId?:unknown};
    if(!c||c.playerId!==playerId)throw new RoomError(403,"본인 영지만 확정할 수 있습니다.");
    try{
      if(c.range!==undefined){if(c.boardId!==undefined)throw Error();room.draft=redrawBoardSeat(room.draft,playerId,c.range as BoardRange);}
      else {if(typeof c.boardId!=="string")throw Error();room.draft=selectDraftBoard(room.draft,playerId,c.boardId);}
    }catch{throw new RoomError(400,"본인 범위와 추첨 후보를 확인하세요.");}
    const nextRevision=room.game.revision+1;
    if(draftReady(room.draft)){
      const g=room.game;
      room.game=createPracticeSession({names:g.players.map(p=>p.name),seed:g.config.seed,chooseStartingCastles:g.status==="setup",boardIds:room.draft.seats.map(s=>s.selected!),officialSlots:true,geese:g.config.extensions.some(e=>e.id==="geese"),shieldRules:!!shieldLayout(g)?.effectsActive,excludedGrapes:g.vineyards?.excluded,vineyards:g.config.extensions.some(e=>e.id==="vineyards"),tradeRoutes:g.config.extensions.some(e=>e.id==="trade-routes"),inns:g.config.extensions.some(e=>e.id==="inns"),whiteCastles:g.config.extensions.some(e=>e.id==="white-castles")});
      room.logs=["양쪽 영지 선택 완료 · 게임 준비 완료",...room.logs].slice(0,60);
    }
    room.game={...room.game,revision:nextRevision};room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  private publicView(room:StoredRoom,seat:number):RoomView{
    const s=room.game,visible=new Set<string>();
    for(const p of s.players){for(const c of p.duchy.cells)if(c.tileId)visible.add(c.tileId);for(const id of p.storage)if(id)visible.add(id);}
    for(const phase of s.discardedTiles??[])for(const id of phase.tileIds)visible.add(id);
    for(const d of s.market.numberedDepots)for(const slot of d.slots)if(slot.tileId)visible.add(slot.tileId);
    for(const id of [...s.market.blackDepot,...(s.market.inns?.stack??[])])if(id)visible.add(id);
    const ending=checkCoreGameEnd(s);
    const legal=room.tokens[1]&&(!room.lobby||room.lobby.started)&&(!room.draft||draftReady(room.draft)) ? listCoreActionOptions(s,s.players[seat].id) : null;
    const engineActions=legal?.ok?legal.value.actions.filter(()=>s.status!=="setup"||s.turn.activePlayerId===s.players[seat].id):[];
    if(s.status==="setup"&&room.startingPreview&&room.startingPreview.playerId===s.players[seat].id)engineActions.push({type:"end-turn",playerId:s.players[seat].id});
    const actions=engineActions.map(action=>({action,label:actionLabel(s,action),group:action.type==="use-die"?action.intent.kind:action.type,target:boardTarget(s,action),cost:directCost(s,action)}));
    const layout=shieldLayout(s);
    const shields=layout?{format:layout.format,effectsActive:layout.effectsActive,slots:layout.slots,mounted:layout.mounted,removed:layout.removed,rules:layout.rules}:null;
    const automatic=automaticVineReward(s,actions.map(a=>a.action));
    return {purchase:{used:purchaseUsed(s.turn),monasterySix:monasteryNumbers(s,s.players[seat]).includes(6)},discardedTiles:s.discardedTiles??[],commonBoard:{marketRecipeId:s.config.marketRecipeId,orderTrack:s.turn.orderTrack,phaseGoodsCounts:{A:s.market.phaseGoods.A.length,B:s.market.phaseGoods.B.length,C:s.market.phaseGoods.C.length,D:s.market.phaseGoods.D.length,E:s.market.phaseGoods.E.length},roundGoodsCount:s.market.roundGoods.length,revealedGoods:publicPhaseGoods(s),bonusTiles:s.market.bonusTiles},undo:{turnReason:this.undoReason(room,s.players[seat].id,"turn"),actionReason:this.undoReason(room,s.players[seat].id,"action")},...(room.startingPreview?{startingPreview:room.startingPreview}:{}),release:serverRelease(),...(room.lobby?{lobby:{...room.lobby,capacity:2}}:{}),automaticChoice:automatic&&actions.some(x=>JSON.stringify(x.action)===JSON.stringify(automatic))?automatic:null,castleAction:isCastleAction(s),guidance:actionGuidance(s,actions.map(a=>a.action)),boardDraft:room.draft?{version:1,seats:room.draft.seats}:null,fortressScores:Object.fromEntries(s.players.map(p=>[p.id,s.scoreLedger[p.id].filter(e=>e.id.startsWith("fortress:"))])),shields,vineyards:s.vineyards?{...s.vineyards,bag:[]}:undefined,tradeRoutes:s.tradeRoutes,finalScores:s.finalScores,id:room.id,revision:s.revision,seat:s.players[seat].id,stage:s.turn.stage,phase:s.turn.phase,round:s.turn.round,status:s.status,activePlayerId:s.turn.activePlayerId,players:s.players,tiles:Object.fromEntries([...visible].map(id=>[id,s.tiles[id]])),depots:s.market.numberedDepots,blackDepot:s.market.blackDepot,inns:s.market.inns,dice:s.dice,actions,logs:room.logs,joined:!!room.tokens[1],winnerIds:ending.ok&&ending.value.ended?ending.value.winnerIds:[]};
  }
}
