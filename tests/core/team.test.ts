import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession, practiceBoard } from "../../src/game/practice";
import { createTeamGame, accessibleTeamStorage, teamTurnOrder, validateTeamState } from "../../src/game/modes/team-state";
import { applyTeamAction, checkTeamGameEnd, listTeamActions, teamShipTrack, validateTeamAction } from "../../src/game/modes/team-engine";
import { rankTeamScores } from "../../src/game/modes/team-scoring";
import type { TeamGameSetup, TeamGameState, TeamId } from "../../src/game/modes/team-types";
import type { GameAction, MonasteryNumber, Tile } from "../../src/game/types";
import type { ModeBoardDefinition } from "../../src/game/boards/mode-topology";
import { deriveRegions } from "../../src/game/boards/regions";
import { teamRuleView } from "../../src/game/modes/team-rule-view";
import { validateCoreState } from "../../src/game/core/state";
import { parseTeamSave, serializeTeamSave } from "../../src/game/modes/team-save";

/** TEST FIXTURE. The existing practice pool/islands are NOT official team boards or supply. */
function setup(slotted = false): TeamGameSetup {
  const base = createPracticeSession({ names: ["A1", "A2", "B1", "B2"], seed: "team-fixture", officialSlots: slotted });
  const board = (n: number): ModeBoardDefinition => {
    const b = practiceBoard(n);
    return { ...b, id: `test:team:${n}`, family: "synthetic-test", format: "mode-graph", mode: "team", areas: [{ id: "test-land", cellIds: b.cells.map(c => c.id) }], riverLinks: [] };
  };
  return { ...(slotted ? { marketRecipeId: "se:main:3-4" as const } : {}), players: [{ id: "A1", name: "A1", color: "blue" }, { id: "A2", name: "A2", color: "green" }, { id: "B1", name: "B1", color: "red" }, { id: "B2", name: "B2", color: "yellow" }],
    boards: [board(0), board(1)], startingCastleCellIds: ["0,0", "0,0"], startingCastleTileIds: ["practice-start:0", "practice-start:2"],
    initialGoods: [base.players[0].goods.flatMap(g => g.tiles), base.players[2].goods.flatMap(g => g.tiles)],
    tiles: Object.fromEntries(Object.entries(base.tiles).filter(([id]) => !["practice-start:1", "practice-start:3"].includes(id))), market: base.market, random: base.random };
}
function initial() {
  const created = createTeamGame(setup());
  assert.ok(created.ok, JSON.stringify(created));
  return created.value;
}
function step(state: TeamGameState, action: GameAction): TeamGameState {
  const snapshot = structuredClone(state), result = applyTeamAction(state, action);
  assert.deepEqual(state, snapshot);
  assert.ok(result.ok, JSON.stringify(result));
  assert.ok(validateTeamState(result.value.state).valid);
  assert.equal(result.value.state.revision, state.revision + 1);
  assert.equal(result.value.events.length, 1);
  return result.value.state;
}
const roll = () => step(initial(), { type: "roll-round", playerId: "A1" });
function dieValue(state: TeamGameState, id: string, value: number): TeamGameState {
  return { ...state, dice: { ...state.dice, players: { ...state.dice.players, [id]: state.dice.players[id].map(d => ({ ...d, value })) as never } } };
}
function action(state: TeamGameState, intent: Extract<GameAction, { type: "use-die" }>["intent"], playerId = state.turn.activePlayerId!): GameAction {
  return { type: "use-die", playerId, dieId: state.dice.players[playerId].find(d => !d.used)!.id, adjustment: { workersSpent: 0, steps: [] }, intent };
}
function reject(state: TeamGameState, command: GameAction) {
  const before = structuredClone(state), result = applyTeamAction(state, command);
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
  return result;
}
function finishMember(state: TeamGameState): TeamGameState {
  const id = state.turn.activePlayerId!;
  for (const die of state.dice.players[id]) if (!die.used) state = step(state, action(state, { kind: "take-workers" }, id));
  return step(state, { type: "end-turn", playerId: id });
}
function monk(state: TeamGameState, teamId: TeamId, number: MonasteryNumber): TeamGameState {
  const team = state.teams.find(t => t.id === teamId)!, cell = team.duchy.cells.find(c => c.terrain === "monastery" && c.tileId === null)!;
  const id = `test:monk:${teamId}:${number}`;
  return { ...state, tiles: { ...state.tiles, [id]: { id, type: "monastery", number, back: "matching-color" } },
    teams: state.teams.map(t => t.id === teamId ? { ...t, duchy: { ...t.duchy, cells: t.duchy.cells.map(c => c.id === cell.id ? { ...c, tileId: id } : c) } } : t) };
}

test("team setup has one estate per team, 3/5 workers, 2 silver, 3 goods and A1 B1 A2 B2 order", () => {
  const config = setup(), snapshot = structuredClone(config), result = createTeamGame(config);
  assert.ok(result.ok);
  assert.deepEqual(config, snapshot);
  const state = result.value;
  assert.equal(state.teams.length, 2);
  assert.deepEqual(state.teams.map(t => [t.workers, t.silver, t.goods.flatMap(g => g.tiles).length]), [[3, 2, 3], [5, 2, 3]]);
  assert.deepEqual(teamTurnOrder(state), ["A1", "B1", "A2", "B2"]);
  assert.ok(state.players.every(p => p.privateStorage.length === 2 && !("duchy" in p) && !("workers" in p)));
  assert.ok(state.teams.every(t => t.sharedStorage.length === 2));
});
test("invalid setup, duplicate members, solo geometry and missing starting castle fail", () => {
  const s = setup();
  for (const config of [{ ...s, players: s.players.slice(0, 3) }, { ...s, players: s.players.map(p => ({ ...p, id: "duplicate" })) }, { ...s, initialGoods: [[], []] as never }, { ...s, startingCastleCellIds: ["unknown", "0,0"] as never }, { ...s, boards: s.boards.map(b => ({ ...b, mode: "solo" })) as never }]) assert.equal(createTeamGame(config).ok, false);
});
test("rolling uses four individual pairs and one white die exactly once, deterministic and immutable", () => {
  const state = initial(), rolled = step(state, { type: "roll-round", playerId: "A1" });
  assert.deepEqual(rolled, roll());
  assert.ok(rolled.random.cursor >= state.random.cursor + 9);
  assert.equal(rolled.market.roundGoods.length, 4);
  assert.equal(rolled.turn.activePlayerId, "A1");
  const good = state.market.roundGoods[0];
  assert.ok(rolled.market.numberedDepots.find(d => d.number === rolled.dice.whiteDie)!.goods.some(g => g.id === good.id));
  reject(state, { type: "roll-round", playerId: "A2" });
  reject(rolled, { type: "roll-round", playerId: "A1" });
});
test("workers and adjustment cost are shared but teammate dice can never be spent", () => {
  let state = roll();
  const first = action(state, { kind: "take-workers" });
  state = step(state, { ...first, adjustment: { workersSpent: 1, steps: [1] } } as GameAction);
  assert.equal(state.teams[0].workers, 4);
  assert.equal(state.teams[1].workers, 5);
  assert.equal(state.dice.players.A2.some(d => d.used), false);
  reject(state, { ...first, dieId: state.dice.players.A2[0].id } as GameAction);
  reject(state, { ...first, playerId: "A2" } as GameAction);
  reject(state, first);
  reject(state, { ...action(state, { kind: "take-workers" }), adjustment: { workersSpent: 20, steps: [1] } } as GameAction);
});
test("a sale consumes shared goods once and awards four points per tile to the acting member", () => {
  let state = roll();
  const stack = state.teams[0].goods[0];
  state = dieValue(state, "A1", stack.type);
  const after = step(state, action(state, { kind: "sell-goods", goodsType: stack.type }));
  assert.equal(after.players.find(p => p.id === "A1")!.victoryPoints, stack.tiles.length * 4);
  assert.equal(after.players.find(p => p.id === "A2")!.victoryPoints, 0);
  assert.equal(after.teams[0].silver, 3);
  assert.equal(after.teams[0].soldGoods.length, stack.tiles.length);
  assert.ok(!after.teams[0].goods.some(g => g.type === stack.type));
  reject(after, action(after, { kind: "sell-goods", goodsType: stack.type }));
});
test("a teammate can sell the same shared team's remaining goods on their own turn", () => {
  let state = finishMember(finishMember(roll()));
  assert.equal(state.turn.activePlayerId, "A2");
  const stack = state.teams[0].goods[0]; state = dieValue(state, "A2", stack.type);
  state = step(state, action(state, { kind: "sell-goods", goodsType: stack.type }));
  assert.equal(state.players.find(p => p.id === "A2")!.victoryPoints, stack.tiles.length * 4);
  assert.equal(state.players.find(p => p.id === "A1")!.victoryPoints, 0);
});
test("shared monastery worker/sale modifiers apply once without duplicating team resources", () => {
  let state = monk(monk(monk(monk(roll(), "A", 13), "A", 14), "A", 3), "A", 4);
  state = step(state, action(state, { kind: "take-workers" }));
  assert.equal(state.teams[0].workers, 7); assert.equal(state.teams[0].silver, 3);
  const stack = state.teams[0].goods[0]; state = dieValue(state, "A1", stack.type);
  state = step(state, action(state, { kind: "sell-goods", goodsType: stack.type }));
  assert.equal(state.teams[0].workers, 8); assert.equal(state.teams[0].silver, 5);
});
test("numbered tile acquisition targets own or shared storage and is visible to the correct member", () => {
  for (const storageSlot of [0, 1, 2, 3]) {
    let state = dieValue(roll(), "A1", 1);
    const tileId = state.market.numberedDepots[0].slots[0].tileId!;
    state = step(state, action(state, { kind: "take-tile", depot: 1, tileId, storageSlot }));
    assert.equal(accessibleTeamStorage(state, "A1")[storageSlot], tileId);
    assert.equal(accessibleTeamStorage(state, "A2").includes(tileId), storageSlot >= 2);
    assert.equal(accessibleTeamStorage(state, "B1").includes(tileId), false);
    assert.equal(state.market.numberedDepots[0].slots[0].tileId, null);
  }
});
test("black purchase spends shared silver once per member turn, not once per team round", () => {
  let state = roll(), id = state.market.blackDepot.find((id): id is string => id !== null)!;
  state = step(state, { type: "buy-black-tile", playerId: "A1", tileId: id, storageSlot: 2 });
  assert.equal(state.teams[0].silver, 0); assert.ok(state.dice.players.A1.every(d => !d.used));
  reject(state, { type: "buy-black-tile", playerId: "A1", tileId: id, storageSlot: 3 });
  // Replenishing catalog in a TEST FIXTURE does not grant free silver: earn one via monk13 per action.
  state = monk(state, "A", 13); state = finishMember(finishMember(state));
  assert.equal(state.turn.activePlayerId, "A2"); assert.equal(state.turn.blackPurchaseUsed, false);
  assert.equal(state.teams[0].silver, 2);
  assert.ok(accessibleTeamStorage(state, "A2").includes(id));
  id = state.market.numberedDepots[0].slots[0].tileId!;
  reject(state, { type: "buy-black-tile", playerId: "A2", tileId: id, storageSlot: 0 });
});
test("storage bounds, unnecessary discard, teammate transfer and unsupported placement reject atomically", () => {
  const state = dieValue(roll(), "A1", 1), tileId = state.market.numberedDepots[0].slots[0].tileId!;
  for (const storageSlot of [-1, 4, 1.5]) reject(state, action(state, { kind: "take-tile", depot: 1, tileId, storageSlot }));
  reject(state, action(state, { kind: "take-tile", depot: 1, tileId, storageSlot: 0, discardTileId: "foreign" }));
  reject(state, { type: "extension", playerId: "A1", extensionId: "team-game", command: "transfer-private-tile", payload: { playerId: "A2" } });
  const placement = reject(state, action(state, { kind: "place-tile", tileId, cellId: "0,0" }));
  assert.ok(!placement.ok && placement.issues.some(i => i.code === "illegal-action"));
});
test("20 member turns use 40 personal dice and stop at the first phase boundary without skipping income", () => {
  let state = initial();
  for (let round = 1; round <= 5; round++) {
    assert.equal(state.turn.round, round);
    state = step(state, { type: "roll-round", playerId: teamTurnOrder(state)[0] });
    for (const id of ["A1", "B1", "A2", "B2"]) {
      assert.equal(state.turn.activePlayerId, id);
      reject(state, { type: "end-turn", playerId: id });
      state = finishMember(state);
    }
  }
  assert.equal(state.turn.stage, "phase-end"); assert.equal(state.turn.phase, "A");
  assert.equal(state.teams[0].workers, 43); assert.equal(state.teams[1].workers, 45);
  state = step(state, { type: "advance-phase", playerId: "A1" });
  assert.equal(state.turn.phase, "B"); assert.equal(state.turn.round, 1);
});
test("ship track caps at six, puts the moving member on top and never creates space seven", () => {
  let state = roll();
  for (let n = 0; n < 9; n++) state = { ...state, turn: { ...state.turn, orderTrack: teamShipTrack(state, "A2") } };
  state = { ...state, turn: { ...state.turn, orderTrack: teamShipTrack(state, "B2") } };
  // B2 initially moves to1; give the fixture the legal last-space stack to exercise passive occupants.
  state = { ...state, turn: { ...state.turn, orderTrack: [{ position: 6, players: ["B2", "A2"] }, { position: 0, players: ["A1", "B1"] }] } };
  const track = teamShipTrack(state, "A2");
  assert.deepEqual(track.find(s => s.position === 6)!.players, ["A2", "B2"]);
  assert.ok(track.every(s => s.position <= 6));
  assert.deepEqual(teamShipTrack({ ...state, turn: { ...state.turn, orderTrack: track } }, "A2"), track);
});
test("typed state validation rejects resource, tile location, geometry, die and score tampering", () => {
  const state = initial();
  const variants: TeamGameState[] = [
    { ...state, teams: state.teams.map((t, i) => i === 0 ? { ...t, silver: -1 } : t) },
    { ...state, players: state.players.map((p, i) => i === 0 ? { ...p, privateStorage: [state.teams[0].duchy.cells.find(c => c.tileId)!.tileId, null] } : p) },
    { ...state, teams: state.teams.map((t, i) => i === 0 ? { ...t, duchy: { ...t.duchy, cells: t.duchy.cells.map((c, j) => j === 0 ? { ...c, number: 7 as never } : c) } } : t) },
    { ...state, players: state.players.map((p, i) => i === 0 ? { ...p, victoryPoints: 100 } : p) },
    { ...state, dice: { ...state.dice, players: { ...state.dice.players, A1: state.dice.players.A2 } } },
  ];
  for (const invalid of variants) { assert.equal(validateTeamState(invalid).valid, false); reject(invalid, { type: "roll-round", playerId: "A1" }); }
});
test("every enumerated team action validates; other members cannot act during A1 turn", () => {
  const state = roll(), result = listTeamActions(state, "A1");
  assert.ok(result.ok && result.value.length > 4);
  for (const a of result.value) assert.ok(validateTeamAction(state, a).valid);
  const other = listTeamActions(state, "A2"); assert.ok(other.ok); assert.deepEqual(other.value, []);
  assert.equal(listTeamActions(state, "unknown").ok, false);
});

/** TEST FIXTURE with adjoining castles and a town; never registered as an official map. */
function effectState(ship = false): TeamGameState {
  const state = roll(), team = state.teams[0], startId = team.duchy.cells.find(c => c.tileId)!.tileId!;
  const cells: ModeBoardDefinition["cells"] = [
    { id: "start", coord: { q: 0, r: 0 }, terrain: "castle", number: 1, regionId: "castles" },
    { id: "next", coord: { q: 1, r: 0 }, terrain: ship ? "ship" : "castle", number: 2, regionId: ship ? "river" : "castles" },
    { id: "hall", coord: { q: 2, r: 0 }, terrain: "building", number: 3, regionId: "town" },
    { id: "bank", coord: { q: 2, r: -1 }, terrain: "building", number: 4, regionId: "town" },
    { id: "monastery", coord: { q: 0, r: 1 }, terrain: "monastery", number: 5, regionId: "monastery" },
  ];
  const definition: ModeBoardDefinition = { id: "test:team-chain", officialNumber: null, family: "synthetic-test", mode: "team", format: "mode-graph", expectedCellCount: cells.length,
    cells, regions: deriveRegions(cells), startingCastle: { policy: "any-castle", allowedCellIds: cells.filter(c => c.terrain === "castle").map(c => c.id), recommendedCellId: "start" },
    verification: { status: "synthetic-test" }, areas: [{ id: "land", cellIds: cells.map(c => c.id) }], riverLinks: [] };
  return { ...state, teams: state.teams.map(t => t.id === "A" ? { ...t, definition, duchy: { boardId: definition.id,
    startingCastleCellId: "start", completedColors: [], completedRegionIds: [], cells: cells.map(c => ({ ...c, tileId: c.id === "start" ? startId : null })) } } : t) };
}
function withStored(state: TeamGameState, slot: number, tile: Tile): TeamGameState {
  return { ...state, tiles: { ...state.tiles, [tile.id]: tile },
    players: state.players.map(p => p.id === "A1" && slot < 2 ? { ...p, privateStorage: p.privateStorage.map((id, i) => i === slot ? tile.id : id) as never } : p),
    teams: state.teams.map(t => t.id === "A" && slot >= 2 ? { ...t, sharedStorage: t.sharedStorage.map((id, i) => i === slot - 2 ? tile.id : id) as never } : t) };
}
function choosePlacement(state: TeamGameState, tileId: string): TeamGameState {
  const choice = state.turn.pendingChoice!, option = choice.options.find(o => {
    const payload = o.payload as { intent?: { kind: string; tileId?: string } } | null;
    return payload?.intent?.kind === "place-tile" && payload.intent.tileId === tileId;
  });
  assert.ok(option, `Missing placement for ${tileId}`);
  return step(state, { type: "resolve-choice", playerId: state.turn.activePlayerId!, choiceId: choice.id, optionId: option.id });
}
test("castle to shared town hall to fourth-slot bank resolves once, scores the actor and updates one estate", () => {
  let state = effectState();
  state = withStored(state, 0, { id: "test:castle", type: "castle", back: "matching-color" });
  state = withStored(state, 2, { id: "test:hall", type: "building", building: "town-hall", back: "matching-color" });
  state = withStored(state, 3, { id: "test:bank", type: "building", building: "bank", back: "matching-color" });
  state = dieValue(state, "A1", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:castle", cellId: "next" }));
  const firstChoice = state.turn.pendingChoice!;
  reject(state, { type: "end-turn", playerId: "A1" });
  reject(state, { type: "resolve-choice", playerId: "A2", choiceId: firstChoice.id, optionId: firstChoice.options[0].id });
  state = choosePlacement(state, "test:hall");
  reject(state, { type: "resolve-choice", playerId: "A1", choiceId: firstChoice.id, optionId: firstChoice.options[0].id });
  state = choosePlacement(state, "test:bank");
  assert.equal(state.turn.pendingChoice, null);
  assert.equal(state.teams[0].silver, 4);
  assert.equal(state.teams[0].workers, 3);
  assert.equal(state.players[0].victoryPoints, 40);
  assert.equal(state.players[1].victoryPoints, 0);
  assert.deepEqual(state.teams[0].sharedStorage, [null, null]);
  assert.equal(state.teams[0].bonuses.length, 2);
  assert.equal(state.dice.players.A1.filter(d => d.used).length, 1);
  assert.equal(state.teams[0].duchy.cells.filter(c => c.tileId).length, 4);
});
test("a pending team effect lists all four destinations and refreshes after a fourth-slot black purchase", () => {
  let state = effectState();
  state = withStored(state, 0, { id: "test:castle", type: "castle", back: "matching-color" });
  state = withStored(state, 2, { id: "test:hall", type: "building", building: "town-hall", back: "matching-color" });
  const black = state.market.blackDepot[0]!;
  state = { ...state, tiles: { ...state.tiles, [black]: { id: black, type: "building", building: "bank", back: "black" } } };
  state = dieValue(state, "A1", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:castle", cellId: "next" }));
  assert.ok(state.turn.pendingChoice!.options.some(o => (o.payload as { intent?: { storageSlot?: number } } | null)?.intent?.storageSlot === 3));
  state = choosePlacement(state, "test:hall");
  state = step(state, { type: "buy-black-tile", playerId: "A1", tileId: black, storageSlot: 3 });
  assert.equal(state.teams[0].silver, 0);
  state = choosePlacement(state, black);
  assert.equal(state.teams[0].silver, 2);
  assert.equal(state.turn.pendingChoice, null);
});
test("forged team choice options fail canonical validation and never gain access to teammate inventory", () => {
  let state = withStored(effectState(), 0, { id: "test:castle", type: "castle", back: "matching-color" });
  state = dieValue(state, "A1", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:castle", cellId: "next" }));
  const forged: TeamGameState = { ...state, turn: { ...state.turn, pendingChoice: { ...state.turn.pendingChoice!, options: [{ id: "steal", label: "steal", payload: { intent: { kind: "take-tile", storageSlot: 4 } } }] } } };
  assert.equal(validateTeamState(forged).valid, false);
  reject(forged, { type: "resolve-choice", playerId: "A1", choiceId: forged.turn.pendingChoice!.id, optionId: "steal" });
  // Temporary actor views must never be accepted as canonical competitive states.
  assert.equal(validateCoreState(teamRuleView(state)).valid, false);
});
test("shared monastery6 purchases non-buildings into slot four and shares the silver limit", () => {
  let state = monk(roll(), "A", 6);
  const depot = state.market.numberedDepots.find(d => d.slots.some(s => s.tileId && state.tiles[s.tileId].type !== "building"))!, tileId = depot.slots.find(s => s.tileId && state.tiles[s.tileId].type !== "building")!.tileId!;
  const command: GameAction = { type: "use-monastery-six", playerId: "A1", depot: depot.number, tileId, storageSlot: 3 };
  state = step(state, command);
  assert.equal(state.teams[0].workers, 1); assert.equal(state.teams[0].sharedStorage[1], tileId);
  assert.ok(state.dice.players.A1.every(d => !d.used));
  reject(state, command);
  assert.equal(state.turn.blackPurchaseUsed,true);assert.equal(listTeamActions(state,"A1").ok,true);
  state = finishMember(finishMember(state));
  assert.equal(state.turn.activePlayerId, "A2"); assert.equal(state.turn.monasterySixUsed, false);
});
test("team ship with monastery5 resolves both goods windows before a single capped track move", () => {
  let state = withStored(monk(effectState(true), "A", 5), 0, { id: "test:ship", type: "ship", back: "matching-color" });
  state = { ...state, turn: { ...state.turn, orderTrack: [{ position: 6, players: ["A2", "A1"] }, { position: 0, players: ["B1", "B2"] }] } };
  state = dieValue(state, "A1", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:ship", cellId: "next" }));
  const first = state.turn.pendingChoice!;
  state = step(state, { type: "resolve-choice", playerId: "A1", choiceId: first.id, optionId: first.options[0].id });
  assert.ok(state.turn.pendingChoice); assert.equal(state.turn.orderTrack.find(s => s.position === 6)!.players[0], "A2");
  state = step(state, { type: "resolve-choice", playerId: "A1", choiceId: state.turn.pendingChoice!.id, optionId: "decline-adjacent" });
  assert.equal(state.turn.pendingChoice, null);
  assert.deepEqual(state.turn.orderTrack.find(s => s.position === 6)!.players, ["A1", "A2"]);
  assert.ok(state.turn.orderTrack.every(s => s.position <= 6));
});
test("shared tiles placed by the teammate remove the shared tile once and score only that teammate", () => {
  let state = withStored(effectState(true), 3, { id: "test:ship", type: "ship", back: "matching-color" });
  state = finishMember(finishMember(state));
  state = dieValue(state, "A2", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:ship", cellId: "next" }));
  assert.equal(state.teams[0].sharedStorage[1], null);
  assert.equal(state.players[0].victoryPoints, 0);
  assert.ok(state.players[1].victoryPoints > 0);
  assert.equal(state.teams[0].duchy.cells.find(c => c.id === "next")!.tileId, "test:ship");
  assert.ok(state.turn.pendingChoice);
});

function finishPhase(state: TeamGameState): TeamGameState {
  while (state.turn.stage !== "phase-end") {
    if (state.turn.stage === "round-setup") state = step(state, { type: "roll-round", playerId: teamTurnOrder(state)[0] });
    else state = finishMember(state);
  }
  return state;
}
test("team phase income is paid once per shared mine, with shared monastery2 workers", () => {
  let state = monk(roll(), "A", 2);
  const mineCell = state.teams[0].duchy.cells.find(c => c.terrain === "mine")!, id = "test:placed-mine";
  state = { ...state, tiles: { ...state.tiles, [id]: { id, type: "mine", back: "matching-color" } },
    teams: state.teams.map(t => t.id === "A" ? { ...t, duchy: { ...t.duchy, cells: t.duchy.cells.map(c => c.id === mineCell.id ? { ...c, tileId: id } : c) } } : t) };
  state = finishPhase(state);
  const before = state.teams[0];
  state = step(state, { type: "advance-phase", playerId: teamTurnOrder(state)[0] });
  assert.equal(state.teams[0].silver, before.silver + 1);
  assert.equal(state.teams[0].workers, before.workers + 1);
  assert.equal(state.teams[1].silver, 2);
  reject(state, { type: "advance-phase", playerId: teamTurnOrder(state)[0] });
});
test("phase refill preserves depot goods, removes old hexes and rejects incomplete supply without charging income", () => {
  let state = finishPhase(roll());
  const goods = state.market.numberedDepots.flatMap(d => d.goods).map(g => g.id), oldHexes = state.market.numberedDepots.flatMap(d => d.slots).map(s => s.tileId!).concat(state.market.blackDepot as string[]);
  const moved = state.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => state.tiles[id].type === "ship");
  const invalidSupply: TeamGameState = { ...state, market: { ...state.market, supplyPools: state.market.supplyPools.map(p => ({ ...p, remainingTileIds: p.remainingTileIds.filter(id => !moved.includes(id)) })), removedTileIds: [...state.market.removedTileIds, ...moved] } };
  assert.ok(validateTeamState(invalidSupply).valid);
  const bad = reject(invalidSupply, { type: "advance-phase", playerId: "A1" });
  assert.ok(!bad.ok && bad.issues.some(i => i.code === "incomplete-catalog"));
  state = step(state, { type: "advance-phase", playerId: "A1" });
  assert.deepEqual(state.market.numberedDepots.flatMap(d => d.goods).map(g => g.id), goods);
  assert.ok(oldHexes.every(id => state.market.removedTileIds.includes(id)));
  assert.ok(state.market.numberedDepots.every(d => d.slots.every(s => s.tileId !== null)));
});
test("25 team rounds end at E with shared remaining resources scored once and repeated queries are pure", () => {
  let state = initial();
  assert.deepEqual(checkTeamGameEnd(state), { ok: true, value: { ended: false } });
  for (const phase of ["A", "B", "C", "D", "E"]) {
    assert.equal(state.turn.phase, phase); state = finishPhase(state);
    state = step(state, { type: "advance-phase", playerId: teamTurnOrder(state)[0] });
  }
  assert.equal(state.status, "finished"); assert.equal(state.turn.stage, "finished");
  assert.deepEqual(state.finalScores!.map(s => s.total), [106, 107]);
  const snapshot = structuredClone(state), result = checkTeamGameEnd(state);
  assert.ok(result.ok && result.value.ended);
  assert.deepEqual(result.value.leadingTeamIds, ["B"]);
  assert.deepEqual(checkTeamGameEnd(state), result); assert.deepEqual(state, snapshot);
  reject(state, { type: "advance-phase", playerId: "A1" });
  assert.equal(listTeamActions(state, "A1").ok && (listTeamActions(state, "A1") as { ok: true; value: GameAction[] }).value.length, 0);
  const corrupted = { ...state, finalScores: state.finalScores!.map(s => ({ ...s, total: s.total + 1 })) };
  assert.equal(validateTeamState(corrupted).valid, false);
});
test("team final tie uses MORE empty spaces and preserves a remaining exact tie", () => {
  const scores = [{ teamId: "A", total: 100, emptySpaces: 3 }, { teamId: "B", total: 100, emptySpaces: 7 }] as const;
  const winner = rankTeamScores(scores);
  assert.deepEqual(winner, { ok: true, value: { leadingTeamIds: ["B"], tied: false } });
  assert.deepEqual(rankTeamScores(scores.map(s => ({ ...s, emptySpaces: 3 }))), { ok: true, value: { leadingTeamIds: ["A", "B"], tied: true } });
  assert.deepEqual(rankTeamScores(scores.map(s => ({ ...s, total: s.teamId === "A" ? 101 : 100 }))), { ok: true, value: { leadingTeamIds: ["A"], tied: false } });
  assert.equal(rankTeamScores([]).ok, false);
});
test("mixed team acquisition, placement and effects finish 25 rounds using the 4-player slot recipe", () => {
  const created = createTeamGame(setup(true)); assert.ok(created.ok);
  const catalog = { boards: created.value.teams.map(t => t.definition), tiles: created.value.tiles };
  let state = created.value, placements = 0, restored = false;
  for (let stepNumber = 0; stepNumber < 900 && state.status !== "finished"; stepNumber++) {
    const id = state.turn.activePlayerId ?? teamTurnOrder(state)[0], options = listTeamActions(state, id);
    assert.ok(options.ok && options.value.length > 0);
    const candidates = options.value;
    const selected = candidates.find(a => a.type === "resolve-choice" && a.optionId.includes('"kind":"place-tile"')) ?? candidates.find(a => a.type === "resolve-choice") ??
      candidates.find(a => a.type === "use-die" && a.intent.kind === "place-tile") ?? candidates.find(a => a.type === "use-die" && a.intent.kind === "take-tile") ??
      candidates.find(a => a.type === "use-die" && a.intent.kind === "sell-goods") ?? candidates[0];
    state = step(state, selected);
    if (selected.type === "use-die" && selected.intent.kind === "place-tile") placements++;
    if (!restored && stepNumber > 50 && state.turn.pendingChoice) { state = parseTeamSave(serializeTeamSave(state, catalog), catalog).game; assert.ok(validateTeamState(state).valid); restored = true; }
  }
  assert.equal(state.status, "finished"); assert.ok(placements > 5); assert.equal(restored, true);
  assert.equal(state.finalScores!.length, 2);
  assert.ok(checkTeamGameEnd(state).ok);
  assert.deepEqual(parseTeamSave(serializeTeamSave(state, catalog), catalog).game, state);
});

test("team save restores pending choices, member storage, shared ownership and randomness separately from base v1", () => {
  let state = withStored(effectState(), 0, { id: "test:castle", type: "castle", back: "matching-color" });
  state = dieValue(state, "A1", 2);
  state = step(state, action(state, { kind: "place-tile", tileId: "test:castle", cellId: "next" }));
  const catalog = { boards: state.teams.map(t => t.definition), tiles: state.tiles }, text = serializeTeamSave(state, catalog);
  assert.deepEqual(parseTeamSave(text, catalog).game, state);
  const saved = JSON.parse(text); saved.game.tiles = Object.fromEntries(Object.entries(saved.game.tiles).reverse());
  assert.deepEqual(parseTeamSave(JSON.stringify(saved), catalog).game.tiles, state.tiles);
});
test("team save rejects untrusted board/canonical tile changes even when typed state checks pass", () => {
  const state = initial(), catalog = { boards: state.teams.map(t => t.definition), tiles: state.tiles };
  const text = serializeTeamSave(state, catalog), changed = JSON.parse(text);
  const id = Object.keys(changed.game.tiles).find(id => changed.game.tiles[id].type === "building")!;
  changed.game.tiles[id].building = changed.game.tiles[id].building === "bank" ? "watchtower" : "bank";
  assert.ok(validateTeamState(changed.game).valid);
  assert.throws(() => parseTeamSave(JSON.stringify(changed), catalog), /팀 저장/);
  assert.throws(() => parseTeamSave(text, { ...catalog, boards: [] }), /팀 저장/);
  const boardChange = JSON.parse(text), original = boardChange.game.teams[0];
  const cellId = original.duchy.cells[0].id;
  original.definition.cells.find((c: { id: string }) => c.id === cellId).number = 2;
  original.duchy.cells[0].number = 2;
  assert.ok(validateTeamState(boardChange.game).valid);
  assert.throws(() => parseTeamSave(JSON.stringify(boardChange), catalog), /팀 저장/);
});
test("team save rejects wrong formats, prototype keys, excessive structures and future-goods corruption", () => {
  const state = initial(), catalog = { boards: state.teams.map(t => t.definition), tiles: state.tiles }, text = serializeTeamSave(state, catalog);
  for (const invalid of ["{", text.replace("burgundy-team-save-v1", "burgundy-local-v1"), text.replace("counter-v1", "unknown"), '{"__proto__":{}}', " ".repeat(2_000_001), "[".repeat(32) + "0" + "]".repeat(32)]) assert.throws(() => parseTeamSave(invalid, catalog));
  const changed = JSON.parse(text); changed.game.market.phaseGoods.B.pop();
  assert.throws(() => parseTeamSave(JSON.stringify(changed), catalog));
});
test("full accessible storage can replace only its explicitly named occupant and never a teammate private tile", () => {
  let state = roll();
  const ids = state.market.numberedDepots.slice(0, 2).flatMap(d => d.slots.map(s => s.tileId!));
  state = { ...state, market: { ...state.market, numberedDepots: state.market.numberedDepots.map((d, i) => i < 2 ? { ...d, slots: d.slots.map(s => ({ ...s, tileId: null })) } : d) },
    players: state.players.map(p => p.id === "A1" ? { ...p, privateStorage: [ids[0], ids[1]] } : p),
    teams: state.teams.map(t => t.id === "A" ? { ...t, sharedStorage: [ids[2], ids[3]] } : t) };
  state = dieValue(state, "A1", 3);
  const tileId = state.market.numberedDepots[2].slots[0].tileId!;
  const intent = { kind: "take-tile" as const, depot: 3 as const, tileId, storageSlot: 3 };
  reject(state, action(state, intent));
  reject(state, action(state, { ...intent, discardTileId: ids[0] }));
  state = step(state, action(state, { ...intent, discardTileId: ids[3] }));
  assert.equal(state.teams[0].sharedStorage[1], tileId);
  assert.ok(state.market.removedTileIds.includes(ids[3]));
  assert.deepEqual(state.players.find(p => p.id === "A2")!.privateStorage, [null, null]);
});
test("team resource/revision overflow rolls back without consuming a die or random state", () => {
  const state = roll();
  const invalidAfter: TeamGameState = { ...state, teams: state.teams.map(t => t.id === "A" ? { ...t, workers: Number.MAX_SAFE_INTEGER } : t) };
  assert.ok(validateTeamState(invalidAfter).valid);
  reject(invalidAfter, action(invalidAfter, { kind: "take-workers" }));
  reject({ ...state, revision: Number.MAX_SAFE_INTEGER }, action(state, { kind: "take-workers" }));
});
