import type { GameState } from "../../src/game/types";

type Mutable<T, D extends unknown[] = []> = D["length"] extends 8 ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K], [...D, 0]> } : T;
export type TestState = Mutable<GameState>;

/** TEST FIXTURE ONLY: tiny synthetic boards/supply; never exported from src or an official catalog. */
export function coreFixture(count: 2 | 3 | 4 = 2): TestState {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`, name: `TEST PLAYER ${i + 1}`, seat: i, controller: "human" as const,
    duchy: { boardId: `TEST-FIXTURE-${i}`, startingCastleCellId: "start", completedRegionIds: [], completedColors: [],
      cells: [{ id: "start", coord: { q: 0, r: 0 }, terrain: "castle" as const, number: 6 as const, regionId: "test-castle", tileId: `castle-${i}` }] },
    storage: [null, null, null], goods: i === 0 ? [
      { type: 1 as const, tiles: [{ id: "owned-1", type: 1 as const }, { id: "owned-2", type: 1 as const }] },
      { type: 2 as const, tiles: [{ id: "owned-3", type: 2 as const }] },
    ] : [], soldGoods: [], silver: 3, workers: i + 1, victoryPoints: 0, bonuses: [],
  }));
  return {
    schemaVersion: "0.2.1", revision: 0, status: "playing",
    config: { ruleset: "special-edition-base", mode: "competitive", playerCount: count,
      players: players.map(p => ({ id: p.id, name: p.name, seat: p.seat, boardId: p.duchy.boardId, startingCastleCellId: "start", controller: "human" })),
      seed: "TEST-SEED", catalogId: "TEST-FIXTURE-NOT-OFFICIAL", extensions: [] },
    players, tiles: {
      ...Object.fromEntries(players.map((_, i) => [`castle-${i}`, { id: `castle-${i}`, type: "castle" as const, back: "matching-color" as const }])),
      mine: { id: "mine", type: "mine", back: "matching-color" },
      black: { id: "black", type: "building", building: "bank", back: "black" },
    },
    market: { numberedDepots: Array.from({ length: 6 }, (_, i) => ({ number: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      slots: i === 0 ? [{ id: "TEST-SLOT", requiredType: "mine" as const, tileId: "mine" }] : [], goods: [] })),
      blackDepot: ["black"], supplyPools: [], removedTileIds: [], bonusTiles: [],
      phaseGoods: { A: [], B: [], C: [], D: [], E: [] },
      roundGoods: Array.from({ length: 4 }, (_, i) => ({ id: `round-${i}`, type: (i + 1) as 1 | 2 | 3 | 4 })) },
    dice: { players: Object.fromEntries(players.map(p => [p.id, [
      { id: `${p.id}:a`, value: 1, used: false }, { id: `${p.id}:b`, value: 2, used: false },
    ]])), whiteDie: 3, rolledForRound: true, roundGoodsDistributed: true },
    turn: { phase: "A", round: 1, stage: "player-turn", activePlayerId: "p1", orderTrack: [{ position: 0, players: players.map(p => p.id) }],
      actedPlayerIds: [], blackPurchaseUsed: false, monasterySixUsed: false, pendingEffects: [], pendingChoice: null },
    scoreLedger: Object.fromEntries(players.map(p => [p.id, []])), random: { seed: "TEST-SEED", cursor: 0 }, extensionStates: {}, finalScores: null,
  };
}

export function addMonastery(state: TestState, number: 3 | 4 | 8 | 13 | 14) {
  const id = `monastery-${number}`;
  state.tiles[id] = { id, type: "monastery", number, back: "matching-color" };
  state.players[0].duchy.cells.push({ id, coord: { q: number, r: 0 }, terrain: "monastery", number: 1, regionId: id, tileId: id });
}
