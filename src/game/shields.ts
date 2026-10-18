import type { DieValue, GameAction, GameState, JsonValue } from "./types";
import { drawDie } from "./core/random";

/** PDF pp.17–18. Placement/acquisition preview only; abilities and tribute are NOT active. */
export const SHIELD_ABILITIES = [
  "모든 목초지 연결", "다른 플레이어의 일꾼 획득 시 일꾼", "일꾼으로 유지비 지불", "보관 공간 무제한",
  "선박 배치 시 같은 종류 상품 추가", "선택한 상대 수도원 공유", "새 보너스 타일 점수 두 배", "광산 은화 두 배",
  "판매 상품마다 은화", "종료 수도원 점수 두 배", "성 추가 행동으로 방패 획득", "상품 판매 점수 두 배",
  "종료 방패 점수 두 배", "단계 말 번호 공급 타일 직접 배치", "단계 말 검은 공급 타일 직접 배치",
  "차례에 주사위 하나 자유 변경", "지역을 한 칸 크게 계산", "인접 조건 없이 배치",
] as const;
export interface ShieldSlot { readonly id: string; readonly depot: DieValue; readonly index: number; readonly shieldNumber: number | null }
export interface ShieldLayout {
  readonly format: "shield-layout-preview-v1";
  readonly effectsActive: false;
  readonly slots: readonly ShieldSlot[];
  readonly mounted: readonly { readonly shieldNumber: number; readonly playerId: string; readonly cellId: string }[];
  readonly removed: readonly number[];
  readonly boxed: readonly number[];
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function shieldSlotCount(players: number, depot: number): number { return players === 4 || (players === 3 && depot % 2 === 0) ? 2 : 1; }
export function shieldLayout(game: Pick<GameState,"extensionStates">): ShieldLayout | null {
  return (game.extensionStates.shields as unknown as ShieldLayout) ?? null;
}
/** Finite uniform sampling of the 18 unique shields, not a replacement pool. */
export function createShieldLayout(players: 2 | 3 | 4, input: GameState["random"]): { layout: ShieldLayout; random: GameState["random"] } {
  let random = input;
  const remaining = Array.from({length:18},(_,i)=>i+1);
  const slots: ShieldSlot[] = [];
  for (let depot=1;depot<=6;depot++) for(let index=0;index<shieldSlotCount(players,depot);index++) {
    let pick: number;
    do { const a=drawDie(random); const b=drawDie(a.random); random=b.random; pick=(a.value-1)*6+b.value-1; } while(pick>=Math.floor(36/remaining.length)*remaining.length);
    const [shieldNumber]=remaining.splice(pick%remaining.length,1);
    slots.push({id:`shield:depot:${depot}:${index}`,depot:depot as DieValue,index,shieldNumber});
  }
  return {layout:{format:"shield-layout-preview-v1",effectsActive:false,slots,mounted:[],removed:[],boxed:remaining},random};
}
/** Untrusted saves must preserve fixed IDs, capacities and all 18 physical identities. */
export function validShieldLayout(game: GameState): boolean {
  try {
    const extension=game.config.extensions.find(e=>e.id==="shields");
    const raw: unknown=game.extensionStates.shields;
    if(!extension)return raw===undefined;
    if(Object.keys(extension.options).length!==1 || extension.options.uiPreview!==true || !record(raw) || raw.format!=="shield-layout-preview-v1" || raw.effectsActive!==false ||
      Object.keys(raw).sort().join(",")!=="boxed,effectsActive,format,mounted,removed,slots" || !Array.isArray(raw.slots)||!Array.isArray(raw.mounted)||!Array.isArray(raw.removed)||!Array.isArray(raw.boxed))return false;
    const expected=Array.from({length:6},(_,i)=>Array.from({length:shieldSlotCount(game.config.playerCount,i+1)},(_,index)=>({id:`shield:depot:${i+1}:${index}`,depot:i+1,index}))).flat();
    if(raw.slots.length!==expected.length || new Set(raw.slots.map(s=>s?.id)).size!==expected.length)return false;
    const numbers: unknown[]=[];
    for(const e of expected){const slot=raw.slots.find(s=>s?.id===e.id);if(!record(slot)||Object.keys(slot).sort().join(",")!=="depot,id,index,shieldNumber"||slot.depot!==e.depot||slot.index!==e.index)return false;if(slot.shieldNumber!==null)numbers.push(slot.shieldNumber);}
    const mounts=new Set<string>();
    for(const m of raw.mounted){if(!record(m)||Object.keys(m).sort().join(",")!=="cellId,playerId,shieldNumber")return false;const p=game.players.find(p=>p.id===m.playerId);const c=p?.duchy.cells.find(c=>c.id===m.cellId);const key=`${m.playerId}:${m.cellId}`;if(!c?.tileId||game.tiles[c.tileId]?.type!=="castle"||mounts.has(key))return false;mounts.add(key);numbers.push(m.shieldNumber);}
    numbers.push(...raw.removed,...raw.boxed);
    return numbers.length===18&&new Set(numbers).size===18&&numbers.every(n=>typeof n==="number"&&Number.isInteger(n)&&n>=1&&n<=18)&&raw.boxed.length===18-expected.length;
  }catch{return false;}
}
export type ShieldAcquireAction = Omit<Extract<GameAction,{type:"extension"}>,"payload"> & { readonly payload: { readonly slotId: string; readonly castleCellId: string; readonly steps: readonly [readonly (1|-1)[],readonly (1|-1)[]]; readonly replaceShieldNumber: number|null } };
export function shieldAcquireIssue(game: GameState, action: Extract<GameAction,{type:"extension"}>): string | null {
  if(action.extensionId!=="shields"||action.command!=="acquire-preview"||!validShieldLayout(game))return "Unsupported shield action";
  const layout=shieldLayout(game), payload=action.payload;
  if(!layout||!record(payload)||Object.keys(payload).sort().join(",")!=="castleCellId,replaceShieldNumber,slotId,steps"||!Array.isArray(payload.steps)||payload.steps.length!==2)return "Malformed shield acquisition";
  const slot=layout.slots.find(s=>s.id===payload.slotId),player=game.players.find(p=>p.id===action.playerId);
  const cell=player?.duchy.cells.find(c=>c.id===payload.castleCellId);
  if(!slot?.shieldNumber||!player||!cell?.tileId||game.tiles[cell.tileId]?.type!=="castle")return "Select an occupied shield and your placed castle";
  const mounted=layout.mounted.find(m=>m.playerId===player.id&&m.cellId===cell.id);
  if((mounted?.shieldNumber??null)!==payload.replaceShieldNumber)return "Explicit replacement confirmation required";
  const dice=game.dice.players[player.id];let cost=0;
  for(let i=0;i<2;i++){
    const steps=payload.steps[i];if(!Array.isArray(steps)||steps.length>5||steps.some(s=>s!==1&&s!==-1)||dice[i].used)return "Two unused dice required";
    const value=steps.reduce((n,s)=>(n-1+s+6)%6+1,dice[i].value);if(value!==slot.depot)return "Both adjusted dice must match the depot";cost+=steps.length;
  }
  return player.workers>=cost?null:"Not enough workers";
}
/** Called by core only after the full state, turn, pending effects and action are validated. */
export function acquireShieldPreview(game: GameState, action: ShieldAcquireAction): GameState {
  const layout=shieldLayout(game)!;const slot=layout.slots.find(s=>s.id===action.payload.slotId)!;
  const cost=action.payload.steps.reduce((n,s)=>n+s.length,0);
  return {...game,extensionStates:{...game.extensionStates,shields:{...layout,
    slots:layout.slots.map(s=>s.id===slot.id?{...s,shieldNumber:null}:s),
    mounted:[...layout.mounted.filter(m=>!(m.playerId===action.playerId&&m.cellId===action.payload.castleCellId)),{shieldNumber:slot.shieldNumber!,playerId:action.playerId,cellId:action.payload.castleCellId}],
    removed:action.payload.replaceShieldNumber===null?layout.removed:[...layout.removed,action.payload.replaceShieldNumber],
  } as unknown as JsonValue}, players:game.players.map(p=>p.id===action.playerId?{...p,workers:p.workers-cost}:p),
    dice:{...game.dice,players:{...game.dice.players,[action.playerId]:game.dice.players[action.playerId].map((d,i)=>({...d,used:true,value:slot.depot, id:game.dice.players[action.playerId][i].id})) as unknown as GameState["dice"]["players"][string]}}};
}
export function shieldWorkerSteps(value: DieValue, target: DieValue): readonly (1|-1)[] {
  const n=(target-value+6)%6;return n<=3?Array(n).fill(1):Array(6-n).fill(-1);
}
