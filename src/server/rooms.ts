import {boardTarget,type BoardTarget} from "../game/direct-actions";
import {isCastleAction} from "../game/castle-actions";
import {automaticVineReward} from "../game/core/vineyard-effects";
import {actionGuidance} from "../game/action-guidance";
import { LIVESTOCK_NAMES } from "../game/tile-help";
import {GRAPES,type Grape} from "../game/vineyards";
import { createBoardDraft, redrawBoardSeat, selectDraftBoard, validBoardDraft, draftReady, type BoardDraft, type PublicBoardDraft, type BoardRange } from "../game/board-draft";
import type { ScoreEntry } from "../game/types";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { replaceRoomFile } from "./atomic-write";
import { join } from "node:path";
import { createPracticeSession } from "../game/practice";
import { applyCoreAction, checkCoreGameEnd, listCoreActionOptions } from "../game/core";
import { shieldLayout, type ShieldLayout } from "../game/shields";
import { directCost } from "../game/direct-actions";
import { parseSavedGame } from "../game/save";
import type { GameAction, GameState, PlayerState, Tile } from "../game/types";

export class RoomError extends Error {
  constructor(public status:number,message:string){super(message);this.name="RoomError";}
}
interface StoredRoom { draft?:BoardDraft;version:1;id:string;createdAt:number;updatedAt:number;tokens:(string|null)[];game:GameState;logs:string[] }
export interface RoomView {
  automaticChoice?:GameAction|null;
  boardDraft:PublicBoardDraft|null;fortressScores:Record<string,readonly ScoreEntry[]>;
  shields:Pick<ShieldLayout,"format"|"effectsActive"|"slots"|"mounted"|"removed"|"rules">|null;
  vineyards?:GameState["vineyards"];finalScores:GameState["finalScores"];tradeRoutes?:GameState["tradeRoutes"];
  guidance:string;id:string;revision:number;seat:string;stage:GameState["turn"]["stage"];phase:string;round:number;status:string;activePlayerId:string|null;
  players:readonly PlayerState[];tiles:Record<string,Tile>;
  depots:GameState["market"]["numberedDepots"];blackDepot:GameState["market"]["blackDepot"];inns?:GameState["market"]["inns"];dice:GameState["dice"];
  castleAction:boolean;actions:readonly {action:GameAction;label:string;group:string;target:BoardTarget}[];logs:readonly string[];joined:boolean;winnerIds:readonly string[];
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
    if(room.draft&&!validBoardDraft(room.draft,["seat-1","seat-2"]))throw new RoomError(500,"영지 후보 검증 실패");
    room.game=parseSavedGame(JSON.stringify({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:room.game,logs:room.logs,view:{zoom:1,focus:false,boardZooms:{}}})).game;
    if(room.draft&&draftReady(room.draft)&&room.draft.seats.some((s,i)=>s.selected!==room.game.players[i].duchy.boardId))throw new RoomError(500,"선택 영지와 게임 상태가 일치하지 않습니다.");
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
  async create(ownerName:unknown,shieldRules:unknown=false,whiteCastles:unknown=false,boardRange:unknown=null,inns:unknown=false,tradeRoutes:unknown=false,vineyards:unknown=false,excludedGrapes:unknown=[],chooseStartingCastles:unknown=false){return this.serial("create",async()=>{
    if(boardRange!==null&&!["base","fortress","all"].includes(boardRange as string))throw new RoomError(400,"영지 범위를 확인하세요.");
    if(!Array.isArray(excludedGrapes)||excludedGrapes.length>2||new Set(excludedGrapes).size!==excludedGrapes.length||excludedGrapes.some(g=>!GRAPES.includes(g))||(!vineyards&&excludedGrapes.length))throw new RoomError(400,"포도 품종 축소 설정을 확인하세요.");
    if(typeof chooseStartingCastles!=="boolean")throw new RoomError(400,"시작 성 선택 설정을 확인하세요.");
    if(typeof vineyards!=="boolean")throw new RoomError(400,"포도밭 설정은 참/거짓이어야 합니다.");
    if(typeof tradeRoutes!=="boolean")throw new RoomError(400,"무역로 설정은 참/거짓이어야 합니다.");
    if(typeof inns!=="boolean")throw new RoomError(400,"여관 설정은 참/거짓이어야 합니다.");
    if(typeof whiteCastles!=="boolean")throw new RoomError(400,"흰 성 설정은 참/거짓이어야 합니다.");

    if(typeof shieldRules!=="boolean")throw new RoomError(400,"방패 설정은 참/거짓이어야 합니다.");
    await mkdir(this.directory,{recursive:true});
    if((await readdir(this.directory)).filter(f=>f.endsWith(".json")).length>=50)throw new RoomError(503,"개발 서버 방 저장 한도에 도달했습니다.");
    const id=randomBytes(12).toString("hex"),token=randomBytes(32).toString("base64url"),now=Date.now();
    const game=createPracticeSession({names:[name(ownerName),"참가 대기"],seed:randomBytes(16).toString("hex"),chooseStartingCastles,shieldRules,whiteCastles,inns,tradeRoutes,vineyards,excludedGrapes:excludedGrapes as Grape[],officialSlots:true,boardIds:["se:base:1","se:base:2"]});
    const room:StoredRoom={...(boardRange!==null?{draft:createBoardDraft(["seat-1","seat-2"],boardRange as BoardRange,randomBytes(16).toString("hex"))}:{}),version:1,id,createdAt:now,updatedAt:now,tokens:[digest(token),null],game,logs:["2인 방을 준비했습니다. 참가자를 기다립니다."]};
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
    if(room.draft&&!draftReady(room.draft))throw new RoomError(409,"양쪽 영지를 선택해야 게임을 시작합니다.");
    if(!room.tokens[1])throw new RoomError(409,"다른 플레이어의 참가를 기다리세요.");
    if(!Number.isSafeInteger(revision)||revision!==room.game.revision)throw new RoomError(409,"다른 행동이 먼저 반영되었습니다. 최신 상태에서 다시 선택하세요.");
    if(!action||typeof action!=="object"||!("playerId" in action)||action.playerId!==player.id)throw new RoomError(403,"다른 좌석의 행동은 실행할 수 없습니다.");
    if("type" in action&&["undo","undo-turn","undo-action","restore-state"].includes(String(action.type)))throw new RoomError(400,"온라인 되돌리기는 공개 정보와 무작위 결과 보호를 위해 지원하지 않습니다.");
    const next=applyCoreAction(room.game,action as GameAction);
    if(!next.ok)throw new RoomError(400,"차례·주사위·자원·선택 조건을 확인하세요.");
    const after=next.value.state.players[seat],label=actionLabel(room.game,action as GameAction);
    const fortress=next.value.state.scoreLedger[player.id].filter(e=>e.id.startsWith("fortress:")&&!room.game.scoreLedger[player.id].some(old=>old.id===e.id)).map(e=>`${e.source.section} +${e.points}점`).join(" · ");
    room.logs=[`${fortress?fortress+" · ":""}${player.name} · ${label} · 승점 ${after.victoryPoints-player.victoryPoints>=0?"+":""}${after.victoryPoints-player.victoryPoints}`,...room.logs].slice(0,60);
    room.game=next.value.state;room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  async chooseBoard(id:string,token:string,revision:unknown,command:unknown){return this.serial(id,async()=>{
    const room=await this.read(id),seat=this.seat(room,token),playerId=room.game.players[seat].id;
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
      room.game=createPracticeSession({names:g.players.map(p=>p.name),seed:g.config.seed,chooseStartingCastles:g.status==="setup",boardIds:room.draft.seats.map(s=>s.selected!),officialSlots:true,shieldRules:!!shieldLayout(g)?.effectsActive,excludedGrapes:g.vineyards?.excluded,vineyards:g.config.extensions.some(e=>e.id==="vineyards"),tradeRoutes:g.config.extensions.some(e=>e.id==="trade-routes"),inns:g.config.extensions.some(e=>e.id==="inns"),whiteCastles:g.config.extensions.some(e=>e.id==="white-castles")});
      room.logs=["양쪽 영지 선택 완료 · 게임 준비 완료",...room.logs].slice(0,60);
    }
    room.game={...room.game,revision:nextRevision};room.updatedAt=Date.now();await this.write(room);return this.publicView(room,seat);
  });}
  private publicView(room:StoredRoom,seat:number):RoomView{
    const s=room.game,visible=new Set<string>();
    for(const p of s.players){for(const c of p.duchy.cells)if(c.tileId)visible.add(c.tileId);for(const id of p.storage)if(id)visible.add(id);}
    for(const d of s.market.numberedDepots)for(const slot of d.slots)if(slot.tileId)visible.add(slot.tileId);
    for(const id of [...s.market.blackDepot,...(s.market.inns?.stack??[])])if(id)visible.add(id);
    const ending=checkCoreGameEnd(s);
    const legal=room.tokens[1]&&(!room.draft||draftReady(room.draft)) ? listCoreActionOptions(s,s.players[seat].id) : null;
    const actions=legal?.ok ? legal.value.actions.map(action=>({action,label:actionLabel(s,action),group:action.type==="use-die"?action.intent.kind:action.type,target:boardTarget(s,action)})) : [];
    const layout=shieldLayout(s);
    const shields=layout?{format:layout.format,effectsActive:layout.effectsActive,slots:layout.slots,mounted:layout.mounted,removed:layout.removed,rules:layout.rules}:null;
    const automatic=automaticVineReward(s);
    return {automaticChoice:automatic&&actions.some(x=>JSON.stringify(x.action)===JSON.stringify(automatic))?automatic:null,castleAction:isCastleAction(s),guidance:actionGuidance(s,actions.map(a=>a.action)),boardDraft:room.draft?{version:1,seats:room.draft.seats}:null,fortressScores:Object.fromEntries(s.players.map(p=>[p.id,s.scoreLedger[p.id].filter(e=>e.id.startsWith("fortress:"))])),shields,vineyards:s.vineyards?{...s.vineyards,bag:[]}:undefined,tradeRoutes:s.tradeRoutes,finalScores:s.finalScores,id:room.id,revision:s.revision,seat:s.players[seat].id,stage:s.turn.stage,phase:s.turn.phase,round:s.turn.round,status:s.status,activePlayerId:s.turn.activePlayerId,players:s.players,tiles:Object.fromEntries([...visible].map(id=>[id,s.tiles[id]])),depots:s.market.numberedDepots,blackDepot:s.market.blackDepot,inns:s.market.inns,dice:s.dice,actions,logs:room.logs,joined:!!room.tokens[1],winnerIds:ending.ok&&ending.value.ended?ending.value.winnerIds:[]};
  }
}

const tileName=(s:GameState,id:string)=>{const t=s.tiles[id];return t.type==="building"?({"white-castle":"흰 성",crane:"기중기",market:"시장",bank:"은행",church:"교회",warehouse:"창고","boarding-house":"숙소","carpenters-workshop":"목공소","town-hall":"시청",watchtower:"감시탑"})[t.building]:t.type==="monastery"?`수도원${t.number}`:t.type==="livestock"?`${LIVESTOCK_NAMES[t.species]}${t.count}`:({inn:"여관",castle:"성",mine:"광산",ship:"선박"})[t.type];};
export function actionLabel(s:GameState,a:GameAction):string{
  if(a.type==="place-starting-castle")return `시작 성 배치 · ${a.cellId}`;
  if(a.type==="roll-round")return "라운드 주사위 굴리기";
  if(a.type==="end-turn")return "차례 종료";
  if(a.type==="advance-phase")return s.turn.phase==="E"?"최종 정산":"단계 수입·보충";
  if(a.type==="resolve-choice")return s.turn.pendingChoice?.options.find(o=>o.id===a.optionId)?.label??"효과 선택";
  if(a.type==="buy-black-tile"||a.type==="use-monastery-six")return `${tileName(s,a.tileId)} 획득 · ${a.type==="buy-black-tile"?"은화2":"일꾼2"} · 보관${a.storageSlot+1}${a.discardTileId?" 교체":""}`;
  if(a.type==="extension"&&a.extensionId==="shields"){
    const payload=a.payload as Record<string,unknown>;
    if(a.command==="choose-monastery-target")return `방패6 · ${s.players.find(p=>p.id===payload.targetPlayerId)?.name} 수도원 공유`;
    if(a.command==="change-die")return `방패16 · 주사위${s.dice.players[a.playerId].findIndex(d=>d.id===payload.dieId)+1} → ${payload.value}`;
    const number=shieldLayout(s)?.slots.find(slot=>slot.id===payload.slotId)?.shieldNumber;
    return `방패${number} 획득 · 성 ${payload.castleCellId} · 두 주사위 · 일꾼${directCost(s,a)}${payload.replaceShieldNumber?` · 기존 방패${payload.replaceShieldNumber} 반환·교체`:""}`;
  }
  if(a.type==="extension"&&a.extensionId==="vineyards")return "포도 상점 구매 · 은화2";
  if(a.type==="use-die"&&a.intent.kind==="vineyard")return `포도 ${a.intent.command==="take"?"획득":"배치"} ${a.intent.slotId??a.intent.tileId}${a.intent.command==="place"?(a.intent.flipped?" · 뒤집은 방향":" · 기본 방향"):a.intent.discardIds?.length?` · 폐기 ${a.intent.discardIds.join(", ")}`:""} · 일꾼${a.adjustment.workersSpent}`;
  if(a.type!=="use-die")return "확장 행동";
  const i=a.intent,label=i.kind==="take-workers"?"일꾼2 획득":i.kind==="sell-goods"?`${i.goodsType}번 상품 판매`:i.kind==="take-tile"?`${i.depot}번 ${tileName(s,i.tileId)} 획득 · 보관${i.storageSlot+1}${i.discardTileId?" 교체":""}`:`${tileName(s,i.tileId)} → (${i.kind==="place-tile"?i.cellId:""}) 배치`;
  return `${label} · 주사위${s.dice.players[a.playerId].findIndex(d=>d.id===a.dieId)+1} · 일꾼${a.adjustment.workersSpent}`;
}
