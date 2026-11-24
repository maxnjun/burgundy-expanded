import type { DieValue, GameAction, GameState, JsonValue } from "./types";
import { drawDie } from "./core/random";

/** PDF pp.17–18. Versioned legacy preview and active shield state; never silently upgrade previews. */
export const SHIELD_ABILITIES = [
  "모든 목초지 연결", "다른 플레이어의 일꾼 획득 시 일꾼", "일꾼으로 유지비 지불", "보관 공간 무제한",
  "선박 배치 시 같은 종류 상품 추가", "선택한 상대 수도원 공유", "새 보너스 타일 점수 두 배", "광산 은화 두 배",
  "판매 상품마다 은화", "종료 수도원 점수 두 배", "성 추가 행동으로 방패 획득", "상품 판매 점수 두 배",
  "종료 방패 점수 두 배", "단계 말 번호 공급 타일 직접 배치", "단계 말 검은 공급 타일 직접 배치",
  "차례에 주사위 하나 자유 변경", "지역을 한 칸 크게 계산", "인접 조건 없이 배치",
  "저장고 타일 폐기당 은화 1개", "페이즈당 공급 타일 하나 찜", "은화 2개로 상대 저장고 타일 구매",
  "다음 라운드부터 행동 주사위 3개", "상품 여섯 종류 보관", "턴당 구매 제한 해제",
] as const;
export const SHIELD_POINTS=[12,12,12,12,12,12,8,8,8,8,8,8,4,4,4,4,4,4,8,8,4,4,12,4] as const;
export interface ShieldSlot { readonly id: string; readonly depot: DieValue; readonly index: number; readonly shieldNumber: number | null }
export interface ShieldLayout {
  readonly format: "shield-layout-preview-v1" | "shield-rules-v1";
  readonly effectsActive: boolean;
  readonly rules?: {
    readonly monasteryTarget: string | null;
    readonly dieChangedTurn: string | null;
    readonly phase: null | { readonly phase: string; readonly stage: "free" | "tribute" | "ready"; readonly freeDone: readonly number[]; readonly paid: readonly number[] };
  };
  readonly slots: readonly ShieldSlot[];
  /** castleTileId is absent only in validated legacy saves. New acquisitions always bind it. */
  readonly mounted: readonly { readonly shieldNumber: number; readonly playerId: string; readonly cellId: string; readonly castleTileId?: string; readonly sourceDepot?: DieValue;readonly sourceSlotId?:string }[];
  readonly removed: readonly number[];
  readonly boxed: readonly number[];
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function shieldSlotCount(players: number, depot: number): number { return players === 4 || (players === 3 && depot % 2 === 0) ? 2 : 1; }
export function shieldLayout(game: Pick<GameState,"extensionStates">): ShieldLayout | null {
  return (game.extensionStates.shields as unknown as ShieldLayout) ?? null;
}
/** Finite uniform sampling of the 18 unique shields, not a replacement pool. */
export function createShieldLayout(players: 2 | 3 | 4, input: GameState["random"], active = false,custom=false): { layout: ShieldLayout; random: GameState["random"] } {
  let random = input;
  const remaining = Array.from({length:custom?24:18},(_,i)=>i+1);
  const slots: ShieldSlot[] = [];
  for (let depot=1;depot<=6;depot++) for(let index=0;index<shieldSlotCount(players,depot);index++) {
    let pick: number;
    do { const a=drawDie(random); const b=drawDie(a.random); random=b.random; pick=(a.value-1)*6+b.value-1; } while(pick>=Math.floor(36/remaining.length)*remaining.length);
    const [shieldNumber]=remaining.splice(pick%remaining.length,1);
    slots.push({id:`shield:depot:${depot}:${index}`,depot:depot as DieValue,index,shieldNumber});
  }
  return {layout:{format:active?"shield-rules-v1":"shield-layout-preview-v1",effectsActive:active,...(active?{rules:{monasteryTarget:null,dieChangedTurn:null,phase:null}}:{}),slots,mounted:[],removed:[],boxed:remaining},random};
}

export function supplyPhaseShield(game:GameState):GameState{
 const layout=shieldLayout(game);
 if(!game.config.customRules||!layout?.effectsActive)return game;
 const eligible=layout.slots.filter(s=>s.index===0&&!layout.slots.some(other=>other.depot===s.depot&&other.index===1));
 if(!eligible.length||!layout.boxed.length)return game;
 let random=game.random;
 function pick(size:number){
  let n:number;
  do{const a=drawDie(random),b=drawDie(a.random);random=b.random;n=(a.value-1)*6+b.value-1;}while(n>=Math.floor(36/size)*size);
  return n%size;
 }
 const {depot}=eligible[pick(eligible.length)],shieldNumber=layout.boxed[pick(layout.boxed.length)];
 return setShieldLayout({...game,random},{...layout,slots:[...layout.slots,{id:`shield:depot:${depot}:1`,depot,index:1,shieldNumber}],boxed:layout.boxed.filter(n=>n!==shieldNumber)});
}
/** Untrusted saves must preserve fixed IDs, capacities and all 18 physical identities. */
export function validShieldLayout(game: GameState): boolean {
  try {
    const custom=game.config.customRules===true&&game.config.extensions.some(e=>e.id==='shields'&&e.options.rules===true);
    const total=custom?24:18;
    const extension=game.config.extensions.find(e=>e.id==="shields");
    const raw: unknown=game.extensionStates.shields;
    if(!extension)return raw===undefined;
    const active=extension.options.rules===true && Object.keys(extension.options).length===1;
    const preview=extension.options.uiPreview===true && Object.keys(extension.options).length===1;
    if((!active&&!preview) || !record(raw) || raw.format!==(active?"shield-rules-v1":"shield-layout-preview-v1") || raw.effectsActive!==active ||
      Object.keys(raw).sort().join(",")!==(active?"boxed,effectsActive,format,mounted,removed,rules,slots":"boxed,effectsActive,format,mounted,removed,slots") || !Array.isArray(raw.slots)||!Array.isArray(raw.mounted)||!Array.isArray(raw.removed)||!Array.isArray(raw.boxed))return false;
    if(active){
      const r=raw.rules;
      if(!record(r)||Object.keys(r).sort().join(",")!=="dieChangedTurn,monasteryTarget,phase" || (r.monasteryTarget!==null&&!game.players.some(p=>p.id===r.monasteryTarget)) || (r.dieChangedTurn!==null&&(typeof r.dieChangedTurn!=="string"||!/^[A-E]:[1-5]:/.test(r.dieChangedTurn))))return false;
      if(r.phase!==null){const f=r.phase;if(!record(f)||Object.keys(f).sort().join(",")!=="freeDone,paid,phase,stage"||game.turn.stage!=="phase-end"||f.phase!==game.turn.phase||!["free","tribute","ready"].includes(f.stage as string)||!Array.isArray(f.freeDone)||!Array.isArray(f.paid)||new Set(f.freeDone).size!==f.freeDone.length||new Set(f.paid).size!==f.paid.length||f.freeDone.some(n=>n!==14&&n!==15)||f.paid.some(n=>!Number.isInteger(n)||n<1||n>total))return false;const freeDone=f.freeDone,paid=f.paid;if(f.stage==="free"&&paid.length)return false;
        if(f.stage!=="free"&&raw.mounted.some(m=>m&&(m.shieldNumber===14||m.shieldNumber===15)&&!freeDone.includes(m.shieldNumber)))return false;
        if(f.stage==="ready"&&raw.mounted.some(m=>m&&!paid.includes(m.shieldNumber)))return false;}
    }
    const expected=Array.from({length:6},(_,i)=>Array.from({length:shieldSlotCount(game.config.playerCount,i+1)},(_,index)=>({id:`shield:depot:${i+1}:${index}`,depot:i+1,index}))).flat();
    if(custom&&raw.slots.length!==Math.min(12,expected.length+'ABCDE'.indexOf(game.turn.phase)))return false;
    if(raw.slots.length<expected.length || raw.slots.length>expected.length+18 || new Set(raw.slots.map(s=>s?.id)).size!==raw.slots.length)return false;
    const numbers: unknown[]=[];
    for(const e of expected){const slot=raw.slots.find(s=>s?.id===e.id);if(!record(slot)||Object.keys(slot).sort().join(",")!=="depot,id,index,shieldNumber"||slot.depot!==e.depot||slot.index!==e.index)return false;if(slot.shieldNumber!==null)numbers.push(slot.shieldNumber);}
    for(const slot of raw.slots.filter(s=>!expected.some(e=>e.id===s?.id))){if(!record(slot)||Object.keys(slot).sort().join(',')!=='depot,id,index,shieldNumber'||typeof slot.depot!=='number'||!Number.isInteger(slot.depot)||slot.depot<1||slot.depot>6||typeof slot.index!=='number'||!Number.isInteger(slot.index)||slot.index<shieldSlotCount(game.config.playerCount,slot.depot)||slot.index>=(custom?2:20)||slot.id!==`shield:depot:${slot.depot}:${slot.index}`||(!custom&&slot.shieldNumber===null))return false;if(slot.shieldNumber!==null)numbers.push(slot.shieldNumber);}
    const mounts=new Set<string>();
    const castleTiles=new Set<string>();
    const sources=new Set<string>();
    for(const m of raw.mounted){
      if(!record(m)||!["cellId,playerId,shieldNumber","castleTileId,cellId,playerId,shieldNumber","cellId,playerId,shieldNumber,sourceDepot","castleTileId,cellId,playerId,shieldNumber,sourceDepot",...(custom?["castleTileId,cellId,playerId,shieldNumber,sourceDepot,sourceSlotId"]:[])].includes(Object.keys(m).sort().join(",")))return false;
      if(m.sourceDepot!==undefined&&(typeof m.sourceDepot!=='number'||!Number.isInteger(m.sourceDepot)||m.sourceDepot<1||m.sourceDepot>6))return false;
      if(custom){
        if(typeof m.sourceSlotId!=='string'||sources.has(m.sourceSlotId)||!raw.slots.some(s=>s.id===m.sourceSlotId&&s.depot===m.sourceDepot&&s.shieldNumber===null))return false;
        sources.add(m.sourceSlotId);
      }
      const p=game.players.find(p=>p.id===m.playerId),c=p?.duchy.cells.find(c=>c.id===m.cellId),key=`${m.playerId}:${m.cellId}`;
      if(!c?.tileId||game.tiles[c.tileId]?.type!=="castle"||("castleTileId" in m&&m.castleTileId!==c.tileId)||mounts.has(key)||castleTiles.has(c.tileId))return false;
      mounts.add(key);castleTiles.add(c.tileId);numbers.push(m.shieldNumber);
    }
    numbers.push(...raw.removed,...raw.boxed);
    return numbers.length===total&&new Set(numbers).size===total&&numbers.every(n=>typeof n==="number"&&Number.isInteger(n)&&n>=1&&n<=total)&&raw.boxed.length===total-(custom?raw.slots.length:expected.length);
  }catch{return false;}
}
export type ShieldAcquireAction = Omit<Extract<GameAction,{type:"extension"}>,"payload"> & { readonly payload: { readonly slotId: string; readonly castleCellId: string; readonly steps: readonly [readonly (1|-1)[],readonly (1|-1)[]]; readonly replaceShieldNumber: number|null; readonly dieIds?:readonly [string,string] } };
export function shieldAcquireIssue(game: GameState, action: Extract<GameAction,{type:"extension"}>): string | null {
  if(action.extensionId!=="shields"||!["acquire-preview","acquire"].includes(action.command)||!validShieldLayout(game))return "Unsupported shield action";
  const layout=shieldLayout(game), payload=action.payload;
  if((layout?.effectsActive && action.command!=="acquire")||(!layout?.effectsActive&&action.command!=="acquire-preview"))return "Shield mode mismatch";
  if(!layout||!record(payload)||!["castleCellId,replaceShieldNumber,slotId,steps","castleCellId,dieIds,replaceShieldNumber,slotId,steps"].includes(Object.keys(payload).sort().join(","))||!Array.isArray(payload.steps)||payload.steps.length!==2)return "Malformed shield acquisition";
  const slot=layout.slots.find(s=>s.id===payload.slotId),player=game.players.find(p=>p.id===action.playerId);
  const cell=player?.duchy.cells.find(c=>c.id===payload.castleCellId);
  if(!slot?.shieldNumber||!player||!cell?.tileId||game.tiles[cell.tileId]?.type!=="castle")return "Select an occupied shield and your placed castle";
  const mounted=layout.mounted.find(m=>m.playerId===player.id&&m.cellId===cell.id);
  if((mounted?.shieldNumber??null)!==payload.replaceShieldNumber)return "Replacement shield identity mismatch";
  const rolled=game.dice.players[player.id];
  if(payload.dieIds!==undefined&&(!Array.isArray(payload.dieIds)||payload.dieIds.length!==2||new Set(payload.dieIds).size!==2||payload.dieIds.some(id=>!rolled.some(d=>d.id===id))))return "Invalid shield die pair";
  const dice=Array.isArray(payload.dieIds)?payload.dieIds.map(id=>rolled.find(d=>d.id===id)!):rolled;
  let cost=0;
  for(let i=0;i<2;i++){
    const steps=payload.steps[i];if(!Array.isArray(steps)||steps.length>5||steps.some(s=>s!==1&&s!==-1)||dice[i].used)return "Two unused dice required";
    const value=steps.reduce((n,s)=>(n-1+s+6)%6+1,dice[i].value);if(value!==slot.depot)return "Both adjusted dice must match the depot";cost+=shieldWorkerCost(game,player.id,steps);
  }
  return player.workers>=cost?null:"Not enough workers";
}
/** Called by core only after the full state, turn, pending effects and action are validated. */
export function acquireShieldPreview(game: GameState, action: ShieldAcquireAction, free=false): GameState {
  const layout=shieldLayout(game)!;const slot=layout.slots.find(s=>s.id===action.payload.slotId)!;
  const cost=action.payload.steps.reduce((n,s)=>n+shieldWorkerCost(game,action.playerId,s),0);
  const dice=game.dice.players[action.playerId],selected=action.payload.dieIds??dice.slice(0,2).map(d=>d.id);
  const old=layout.mounted.find(m=>m.playerId===action.playerId&&m.cellId===action.payload.castleCellId);
  const custom=game.config.customRules&&layout.effectsActive;
  const slots=custom?layout.slots.map(s=>s.id===slot.id?{...s,shieldNumber:null}:s.id===old?.sourceSlotId?{...s,shieldNumber:old.shieldNumber}:s):
   layout.slots.filter(s=>s.id!==slot.id||action.payload.replaceShieldNumber!==null||s.index<shieldSlotCount(game.config.playerCount,s.depot)).map(s=>s.id===slot.id?{...s,shieldNumber:action.payload.replaceShieldNumber}:s);
  return {...game,extensionStates:{...game.extensionStates,shields:{...layout,
    slots,
    mounted:[...layout.mounted.filter(m=>m!==old),{shieldNumber:slot.shieldNumber!,sourceDepot:slot.depot,...(custom?{sourceSlotId:slot.id}:{}),playerId:action.playerId,cellId:action.payload.castleCellId,castleTileId:game.players.find(p=>p.id===action.playerId)!.duchy.cells.find(c=>c.id===action.payload.castleCellId)!.tileId!}],
    ...((layout.rules)?{rules:{...layout.rules,monasteryTarget:action.payload.replaceShieldNumber===6||slot.shieldNumber===6?null:layout.rules.monasteryTarget}}:{}),
  } as unknown as JsonValue}, players:game.players.map(p=>p.id===action.playerId?{...p,workers:p.workers-(free?0:cost)}:p),
    dice:free?game.dice:{...game.dice,players:{...game.dice.players,[action.playerId]:dice.map(d=>selected.includes(d.id)?{...d,used:true,value:slot.depot}:d) as unknown as GameState["dice"]["players"][string]}}};
}
export function shieldWorkerSteps(value: DieValue, target: DieValue): readonly (1|-1)[] {
  const n=(target-value+6)%6;return n<=3?Array(n).fill(1):Array(6-n).fill(-1);
}

/** Only the versioned active mode can alter rules; old previews remain inert. */
export function hasShield(game: Partial<Pick<GameState,"extensionStates">>, playerId: string | undefined, number: number): boolean {
  const layout=game.extensionStates?.shields as unknown as ShieldLayout | undefined;
  return !!playerId && layout?.effectsActive===true && layout.format==="shield-rules-v1" && layout.mounted.some(m=>m.playerId===playerId&&m.shieldNumber===number);
}
export const goodsCapacity=(game:Pick<GameState,'extensionStates'>,playerId:string)=>hasShield(game,playerId,23)?6:3;
export function shieldWorkerCost(game: GameState, playerId:string, steps:readonly (1|-1)[]):number {
  const p=game.players.find(p=>p.id===playerId)!;
  const own=p.duchy.cells.some(c=>c.tileId&&game.tiles[c.tileId].type==="monastery"&&(game.tiles[c.tileId] as {number:number}).number===8);
  const target=hasShield(game,playerId,6)?game.players.find(p=>p.id===shieldLayout(game)?.rules?.monasteryTarget):undefined;
  const copied=target?.duchy.cells.some(c=>c.tileId&&game.tiles[c.tileId].type==="monastery"&&(game.tiles[c.tileId] as {number:number}).number===8);
  if(!own&&!copied)return steps.length;
  let cost=0;for(let i=0;i<steps.length;){let end=i+1;while(end<steps.length&&steps[end]===steps[i])end++;cost+=Math.ceil((end-i)/2);i=end;}return cost;
}
/** A gain event, irrespective of amount, grants the unique shield2 owner one worker. */
export function rewardShieldWorkerGain(game:GameState, gainingId:string, amount:number):GameState {
  if(amount<=0)return game;
  return {...game,players:game.players.map(p=>p.id!==gainingId&&hasShield(game,p.id,2)?{...p,workers:p.workers+1}:p)};
}
export function setShieldLayout(game:GameState,layout:ShieldLayout):GameState{return {...game,extensionStates:{...game.extensionStates,shields:layout as unknown as JsonValue}};}
export function shieldTurnKey(game:GameState,playerId:string):string{return `${game.turn.phase}:${game.turn.round}:${playerId}`;}
