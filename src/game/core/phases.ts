import { startShieldPhase } from "./shield-effects";
import { hasShield, shieldLayout, setShieldLayout, rewardShieldWorkerGain } from "../shields";
import type { EngineResult, GameEndResult, Transition } from "../interfaces";
import type { GameState, Phase, PlayerState, ScoreBreakdown, ScoreEntry, Tile } from "../types";
import { drawSupplyTile } from "./supply";
import { monasteryNumbers, orderedPlayers, validateCoreState } from "./state";
import { MONASTERY_BUILDINGS } from "./monasteries";
import { officialMarketRecipe } from "../market-recipes";

type Mutable<T, D extends unknown[] = []> = D["length"] extends 8 ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K], [...D, 0]> } : T;
const fail = (message: string): EngineResult<never> => ({ ok: false, issues: [{ code: "incomplete-catalog", message }] });
const source = { document: "special-edition-rulebook" as const, pages: [10, 11, 12], section: "Phase income and final scoring" };

/** End-game queries never apply points twice. Unknown building icons block scoring. */
export function finalScore(state: GameState, player: PlayerState): EngineResult<ScoreBreakdown> {
  const cached = state.status === "finished" && state.finalScores?.find(s => s.playerId === player.id);
  if (cached) return { ok: true, value: cached };
  const monks = monasteryNumbers(state, player);
  const placed = player.duchy.cells.flatMap(c => c.tileId ? [state.tiles[c.tileId]] : []);
  const additions: ScoreEntry[] = [];
  const add = (category: ScoreEntry["category"], points: number, suffix: string) => additions.push({ id: `final:${player.id}:${suffix}`, category, points, source: suffix.startsWith("shield-")?{document:"special-edition-rulebook",pages:[18],section:"Shield final scoring"}:source,...(suffix.startsWith("shield-")?{extensionId:"shields" as const}:{}) });
  add("remaining-goods", player.goods.reduce((n, g) => n + g.tiles.length, 0), "goods");
  add("remaining-silver", player.silver, "silver");
  add("remaining-workers", Math.floor(player.workers / 2), "workers");
  for (const n of monks) {
    let points = 0;
    if (n === 15) points = new Set(player.soldGoods.map(g => g.type)).size * 2;
    if (MONASTERY_BUILDINGS[n]) points = placed.filter(t => t.type === "building" && t.building === MONASTERY_BUILDINGS[n]).length * 4;
    if (n === 24) points = new Set(placed.flatMap(t => t.type === "livestock" ? [t.species] : [])).size * 4;
    if (n === 25) points = player.soldGoods.length;
    if (n === 26) points = (player.bonuses.length + state.scoreLedger[player.id].filter(e => e.id === `border:${player.id}:all`).length) * 3;
    if (n >= 15) add("monastery", points*(hasShield(state,player.id,10)?2:1), `monastery-${n}`);
  }
  // A crane may count as ONE chosen building for16~23. All these bonuses are4 points.
  // Monk29 is outside the enabled catalog, so no unsupported29 interpretation is applied.
  if(monks.some(n=>n>=16&&n<=23))add("monastery",placed.filter(t=>t.type==="building"&&t.building==="crane").length*4*(hasShield(state,player.id,10)?2:1),"crane-building");
  if(shieldLayout(state)?.effectsActive)for(const m of shieldLayout(state)!.mounted.filter(m=>m.playerId===player.id))add("extension",(m.shieldNumber<=6?12:m.shieldNumber<=12?8:4)*(hasShield(state,player.id,13)?2:1),`shield-${m.shieldNumber}`);
  const earned = state.scoreLedger[player.id];
  const finalAdditionsTotal = additions.reduce((n, e) => n + e.points, 0);
  return { ok: true, value: { playerId: player.id, earned, earnedTotal: player.victoryPoints, finalAdditions: additions, finalAdditionsTotal, total: player.victoryPoints + finalAdditionsTotal } };
}

export function checkCoreGameEnd(state: GameState): EngineResult<GameEndResult> {
  const valid = validateCoreState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.status !== "finished" || !state.finalScores) return { ok: true, value: { ended: false } };
  const order = orderedPlayers(state);
  const ranked = [...state.finalScores].sort((a,b) => b.total - a.total ||
    state.players.find(p => p.id === a.playerId)!.duchy.cells.filter(c => c.tileId === null).length - state.players.find(p => p.id === b.playerId)!.duchy.cells.filter(c => c.tileId === null).length ||
    order.indexOf(b.playerId) - order.indexOf(a.playerId));
  return { ok: true, value: { ended: true, scores: state.finalScores, winnerIds: [ranked[0].playerId] } };
}

/** Layout and pool contents are injected. This does not certify their official accuracy. */
export function advancePhase(state: GameState, playerId: string): EngineResult<Transition> {
  const valid = validateCoreState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.status !== "playing" || state.turn.stage !== "phase-end" || state.turn.round !== 5 ||
    state.turn.activePlayerId !== null || state.market.roundGoods.length || state.turn.pendingChoice || state.turn.pendingEffects.length || playerId !== orderedPlayers(state)[0]) {
    return { ok: false, issues: [{ code: "illegal-action", message: "Only a completed phase may advance, once, by the track leader" }] };
  }
  if(shieldLayout(state)?.effectsActive){
    const boundary=startShieldPhase(state);
    if(shieldLayout(boundary)!.rules!.phase!.stage!=="ready")return {ok:true,value:{state:{...boundary,revision:state.revision+1},events:[{type:"shield:phase-choices",playerId,source:{...source,pages:[17,18]},payload:null}]}};
    state=boundary;
  }
  let draft = structuredClone(state) as Mutable<GameState>;
  const income = draft.players.map(p => {
    const mines = p.duchy.cells.filter(c => c.tileId && draft.tiles[c.tileId].type === "mine").length;
    const workers = monasteryNumbers(draft, p).includes(2) ? mines : 0;
    p.silver += mines*(hasShield(draft,p.id,8)?2:1); p.workers += workers;
    return { playerId: p.id, silver: mines*(hasShield(draft,p.id,8)?2:1), workers };
  });
  for(const gain of income)draft=structuredClone(rewardShieldWorkerGain(draft,gain.playerId,gain.workers)) as Mutable<GameState>;
  if (state.turn.phase === "E") {
    const scores: ScoreBreakdown[] = [];
    for (const player of draft.players) {
      const result = finalScore(draft, player);
      if (!result.ok) return result;
      scores.push(result.value);
    }
    draft.finalScores = structuredClone(scores) as Mutable<ScoreBreakdown[]>;
    for (const p of draft.players) {
      const score = scores.find(s => s.playerId === p.id)!;
      p.victoryPoints = score.total;
      draft.scoreLedger[p.id].push(...structuredClone(score.finalAdditions) as Mutable<ScoreEntry[]>);
    }
    draft.status = "finished"; draft.turn.stage = "finished";
  } else {
    const phase = String.fromCharCode(state.turn.phase.charCodeAt(0) + 1) as Phase;
    if (draft.market.phaseGoods[phase].length !== 5) return fail("Next phase requires five injected goods");
    if (draft.config.marketRecipeId) {
      if (draft.config.playerCount !== 2 && draft.config.playerCount !== 3 && draft.config.playerCount !== 4) return fail("Market recipe requires 2 to 4 players");
      const recipe = officialMarketRecipe(draft.config.playerCount,phase);
      if (recipe.id !== draft.config.marketRecipeId) return fail("Market recipe player count mismatch");
      if (recipe.blackSlots !== draft.market.blackDepot.length) return fail("Recipe black slot count mismatch");
      for (const depot of draft.market.numberedDepots) {
        const expected = recipe.depots.find(d=>d.number===depot.number)!;
        if (depot.slots.length !== expected.slots.length) return fail("Recipe numbered slot count mismatch");
        for (const slot of depot.slots) { const match=expected.slots.find(s=>s.id===slot.id); if(!match)return fail("Unknown recipe slot"); slot.requiredType=match.requiredType; }
      }
    }
    for (const type of ["castle", "ship", "mine", "livestock", "building", "monastery"]) {
      const needed = draft.market.numberedDepots.flatMap(d => d.slots).filter(s => s.requiredType === type).length;
      const available = draft.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => draft.tiles[id].back === "matching-color" && draft.tiles[id].type === type).length;
      if (available < needed) return fail(`Insufficient injected supply: ${type}`);
    }
    if (draft.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => draft.tiles[id].back === "black").length < draft.market.blackDepot.length) return fail("Insufficient injected black supply");
    // Remaining goods stay in their depots; only unclaimed hex tiles go to the box.
    for (const depot of draft.market.numberedDepots) for (const slot of depot.slots) {
      if (slot.tileId !== null) draft.market.removedTileIds.push(slot.tileId);
      slot.tileId = null;
    }
    for (const id of draft.market.blackDepot) if (id !== null) draft.market.removedTileIds.push(id);
    draft.market.blackDepot = draft.market.blackDepot.map(() => null);
    const draw = (back: Tile["back"], type?: Tile["type"]): string => {
      const result = drawSupplyTile(draft, back, type);
      draft.random = result.random;
      draft.market.supplyPools = structuredClone(result.market.supplyPools) as Mutable<GameState["market"]["supplyPools"]>;
      return result.tileId;
    };
    // No slot identity is guessed from its current color; the official alternating slot needs its recipe.
    if (!draft.config.marketRecipeId && !draft.config.catalogId.startsWith("practice:") && draft.config.playerCount === 3) {
      return fail("Official 3-player phase-specific depot-six recipe is required");
    }
    for (const depot of draft.market.numberedDepots) for (const slot of depot.slots) slot.tileId = draw("matching-color", slot.requiredType);
    draft.market.blackDepot = draft.market.blackDepot.map(() => draw("black"));
    draft.market.roundGoods = draft.market.phaseGoods[phase]; draft.market.phaseGoods[phase] = [];
    draft.turn.phase = phase; draft.turn.round = 1; draft.turn.stage = "round-setup";
    draft.turn.actedPlayerIds = []; draft.turn.blackPurchaseUsed = false; draft.turn.monasterySixUsed = false;
    draft.dice.rolledForRound = false; draft.dice.roundGoodsDistributed = false; draft.dice.whiteDie = null;
  }
  if(shieldLayout(draft)?.effectsActive){const layout=shieldLayout(draft)!;draft=structuredClone(setShieldLayout(draft,{...layout,rules:{...layout.rules!,phase:null}})) as Mutable<GameState>;}
  draft.revision++;
  const result = validateCoreState(draft);
  if (!result.valid) return { ok: false, issues: result.issues };
  return { ok: true, value: { state: draft, events: [{ type: "core:advance-phase", playerId, source, payload: { income, phase: draft.turn.phase, finished: draft.status === "finished" } }] } };
}
