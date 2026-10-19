import { whiteCastleTiles } from "./white-castles";
import { createShieldLayout } from "./shields";
import { officialMarketRecipe } from "./market-recipes";
import { createProjectBaseTiles } from "./tile-catalog";
import type { BoardDefinition } from "./boards/types";
import { VERIFIED_BOARD_DEFINITIONS } from "./boards/catalog";
import { deriveRegions } from "./boards/regions";
import { validateBoardDefinition } from "./boards/validation";
import type { DieValue, GameState, GoodsTile, Tile, TileType } from "./types";
import { drawDie } from "./core/random";
import { validateCoreState } from "./core/state";

/** Authored exercise geometry. Never an official board and never registered in the official catalog. */
export function practiceBoard(variant = 0): BoardDefinition {
  const terrains: TileType[] = ["mine", "building", "livestock", "ship", "monastery", "castle"];
  const cells = Array.from({ length: 7 }, (_, row) => {
    const r = row - 3;
    return Array.from({ length: 7 - Math.abs(r) }, (_, col) => {
      const q = Math.max(-3, -r - 3) + col;
      return { id: `${q},${r}`, coord: { q, r }, terrain: q === 0 && r === 0 ? "castle" as const : terrains[(row * 2 + col + variant) % 6],
        number: (q === 0 && r === 0 ? 6 : (row + col * 2 + variant) % 6 + 1) as DieValue, regionId: "" };
    });
  }).flat();
  // One initial region ID per cell, then replace with maximal connected component IDs.
  cells.forEach(c => { c.regionId = c.id; });
  const components = deriveRegions(cells);
  for (const component of components) for (const id of component.cellIds) cells.find(c => c.id === id)!.regionId = `practice-region:${component.id}`;
  const board: BoardDefinition = { id: `practice:generated:${variant}`, officialNumber: null, family: "synthetic-test", format: "individual-hex",
    expectedCellCount: 37, cells, regions: deriveRegions(cells), verification: { status: "synthetic-test" },
    startingCastle: { policy: "any-castle", allowedCellIds: cells.filter(c => c.terrain === "castle").map(c => c.id), recommendedCellId: "0,0" } };
  if (!validateBoardDefinition(board).valid) throw new Error("Invalid authored practice geometry");
  return board;
}

export interface PracticeConfig { readonly names: readonly string[]; readonly seed: string; readonly boardIds?: readonly string[]; readonly startingCastleIds?: readonly string[]; readonly firstSeat?: number; readonly fullEffects?: boolean; readonly officialSlots?: boolean; readonly colors?: readonly import("./types").PlayerColor[]; readonly additionalHexes?: boolean; readonly whiteCastles?: boolean; readonly shieldPreview?: boolean; readonly shieldRules?: boolean; readonly geese?: boolean; readonly borderPosts?: boolean }

/** Explicit partial exercise setup; its supply/first seat are NOT an official createGame implementation. */
export function createPracticeSession(config: PracticeConfig): GameState {
  if (config.names.length < 2 || config.names.length > 4 || !config.seed.trim()) throw new Error("연습은 2~4명과 시드가 필요합니다.");
  const geese = !!(config.geese || config.additionalHexes);
  const count = config.names.length as 2 | 3 | 4;
  const firstSeat = config.firstSeat ?? 0;
  if (!Number.isInteger(firstSeat) || firstSeat < 0 || firstSeat >= count) throw new Error("시작 플레이어가 올바르지 않습니다.");
  const colors = config.colors ?? (["blue","red","green","yellow"] as const).slice(0,count);
  if (colors.length !== count || new Set(colors).size !== count || colors.some(c=>!["blue","red","green","yellow"].includes(c))) throw new Error("플레이어 색상은 서로 달라야 합니다.");
  let random = { seed: config.seed, cursor: 0 };
  const nextDie = () => { const result = drawDie(random); random = result.random; return result.value; };
  const tiles: Record<string, Tile> = {};
  const goodsPool: GoodsTile[] = Array.from({ length: 42 }, (_, i) => ({ id: `practice-good:${i}`, type: (Math.floor(i / 7) + 1) as DieValue }));
  // Uniform sampling without replacement using base-six digits and rejection.
  const randomIndex = (bound: number) => {
    for (;;) {
      let range = 1, number = 0;
      while (range < bound) { number = number * 6 + nextDie() - 1; range *= 6; }
      if (number < range - range % bound) return number % bound;
    }
  };
  const takeGood = () => goodsPool.splice(randomIndex(goodsPool.length), 1)[0];
  const phaseGoods = Object.fromEntries((["A", "B", "C", "D", "E"] as const).map(p => [p, Array.from({ length: 5 }, takeGood)])) as unknown as GameState["market"]["phaseGoods"];
  const players = config.names.map((name, i) => {
    const requested = config.boardIds?.[i];
    // All registered individual geometries can exercise the base rules.
    // Optional connection and border-post effects are not enabled by choosing a map.
    const official = requested ? VERIFIED_BOARD_DEFINITIONS.find(b => b.id === requested && b.verification.status === "verified" && validateBoardDefinition(b).valid) : undefined;
    if (requested && !official) throw new Error("검증되지 않은 공식 보드는 선택할 수 없습니다.");
    const board = official ?? practiceBoard(i % 2);
    const start = config.startingCastleIds?.[i] || board.startingCastle.recommendedCellId || board.startingCastle.allowedCellIds[0];
    if (!board.startingCastle.allowedCellIds.includes(start)) throw new Error("시작 성은 선택한 영지의 성 칸이어야 합니다.");
    const castleId = `practice-start:${i}`;
    tiles[castleId] = { id: castleId, type: "castle", back: "matching-color" };
    const initialGoods = Array.from({ length: 3 }, takeGood);
    const cells = board.cells.map(c => ({ ...c, tileId: c.id === start ? castleId : null }));
    return { id: `seat-${i + 1}`, color: colors[i], name: name.trim().slice(0, 30) || `영주 ${i + 1}`, seat: i, controller: "human" as const,
      duchy: { boardId: board.id, cells, startingCastleCellId: start,
        completedRegionIds: board.regions.filter(r => r.cellIds.every(id => id === start)).map(r => r.id), completedColors: [] },
      storage: [null, null, null], goods: [...new Set(initialGoods.map(g => g.type))].map(type => ({ type, tiles: initialGoods.filter(g => g.type === type) })),
      soldGoods: [], silver: 1, workers: (i - firstSeat + count) % count + 1, victoryPoints: 0, bonuses: [] };
  });
  const numberedDepots = Array.from({ length: 6 }, (_, i) => ({ number: (i + 1) as DieValue,
    slots: Array.from({ length: 2 }, (_, j) => {
      const id = `practice-supply:${i}:${j}`;
      const tile: Tile = j === 0 ? { id, type: i === 0 || i === 4 ? "ship" : "mine", back: "matching-color" } : i % 2 === 0
        ? { id, type: "livestock", species: "sheep", count: 3, back: "matching-color" }
        : { id, type: "building", building: i === 1 ? "bank" : i === 3 ? "boarding-house" : "watchtower", back: "matching-color" };
      tiles[id] = tile;
      return { id: `practice-slot:${i}:${j}`, requiredType: tile.type as TileType, tileId: id };
    }), goods: [] }));
  const blackId = "practice-black";
  tiles[blackId] = { id: blackId, type: "mine", back: "black" };
  // Four further authored practice batches. These are NOT the official 164-tile catalog.
  const remainingTileIds: string[] = [];
  for (const phase of ["B", "C", "D", "E"]) for (const tile of Object.values({ ...tiles }).filter(t => t.id.startsWith("practice-supply:") || t.id === blackId)) {
    const id = `${phase}:${tile.id}`;
    tiles[id] = { ...tile, id }; remainingTileIds.push(id);
  }
  if (config.fullEffects) {
    const prototypes: Tile[] = [
      ...(["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower"] as const).map(building => ({id: `practice-extra:${building}`,type:"building" as const,building,back:"matching-color" as const})),
      {id:"practice-extra:castle",type:"castle",back:"matching-color"},
      ...Array.from({length:26},(_,i)=>({id:`practice-extra:monk:${i+1}`,type:"monastery" as const,number:(i+1) as import("./types").MonasteryNumber,back:"matching-color" as const})),
    ];
    for (const tile of prototypes) { tiles[tile.id]=tile; remainingTileIds.push(tile.id); }
    // Extra slots deliberately authored for exercising every benefit, never marked as official supply.
    for (const [i,depot] of numberedDepots.entries()) {
      const tile = prototypes[i]; remainingTileIds.splice(remainingTileIds.indexOf(tile.id),1);
      depot.slots.push({id:`practice-extra-slot:${i}`,requiredType:tile.type,tileId:tile.id});
      for (const phase of ["B","C","D","E"]) {const id=`${phase}:extra:${i}`; tiles[id]={...tile,id}; remainingTileIds.push(id);}
    }
    for (const [i,depot] of numberedDepots.entries()) {
      const tile:Tile=i%2===0?{id:`practice-special:${i}`,type:"castle",back:"matching-color"}:{id:`practice-special:${i}`,type:"monastery",number:(i===1?6:i===3?8:12),back:"matching-color"};
      tiles[tile.id]=tile;depot.slots.push({id:`practice-special-slot:${i}`,requiredType:tile.type,tileId:tile.id});
      for(const phase of ["B","C","D","E"]){const id=`${phase}:special:${i}`;tiles[id]={...tile,id};remainingTileIds.push(id);}
    }
  }
  let blackDepot = [blackId];
  const removedTileIds: string[] = [];
  const useOfficialSlots = !!config.officialSlots;
  if (useOfficialSlots && count === 2) {
    // Replace authored exercise batches with one finite, user-approved project set.
    for (const id of Object.keys(tiles)) delete tiles[id];
    const catalog = createProjectBaseTiles();
    if (config.whiteCastles) catalog.push(...whiteCastleTiles());
    if (config.additionalHexes) catalog.push(
      {id:"project-extra:27",type:"monastery",number:27,back:"matching-color"},
      {id:"project-extra:28",type:"monastery",number:28,back:"matching-color"},
      {id:"project-extra:crane",type:"building",building:"crane",back:"black"});
    if (geese) catalog.push({ id: "project-geese", type: "livestock", species: "geese", count: 2, back: "black" });
    for (let i = 0; i < count; i++) {
      const start = catalog.findIndex(t => t.type === "castle" && t.back === "matching-color");
      const tile = catalog.splice(start, 1)[0];
      tiles[`practice-start:${i}`] = { ...tile, id: `practice-start:${i}` };
    }
    for (const tile of catalog) tiles[tile.id] = tile;
    remainingTileIds.splice(0, remainingTileIds.length, ...catalog.map(t => t.id));
    const draw = (back: Tile["back"], type?: TileType) => {
      const eligible = remainingTileIds.filter(id => tiles[id].back === back && (!type || tiles[id].type === type));
      if (!eligible.length) throw new Error("프로젝트 타일 공급이 부족합니다.");
      const id = eligible[randomIndex(eligible.length)];
      remainingTileIds.splice(remainingTileIds.indexOf(id), 1);
      return id;
    };
    const recipe = officialMarketRecipe(count, "A");
    numberedDepots.splice(0, numberedDepots.length, ...recipe.depots.map(d => ({ number: d.number, goods: [], slots: d.slots.map(slot => ({ ...slot, tileId: draw("matching-color", slot.requiredType) })) })));
    blackDepot = Array.from({ length: recipe.blackSlots }, () => draw("black"));
  } else if (useOfficialSlots) {
    // Keep the old authored assets in the removed zone; only this explicitly authored catalog is supplied.
    removedTileIds.push(...Object.keys(tiles).filter(id=>!id.startsWith("practice-start:")));
    remainingTileIds.length=0;
    const buildings = ["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower"] as const;
    let counter=0,monastery=0;
    const authoredTile=(id:string,type:TileType,black=false):Tile=>{
      const back=black?"black" as const:"matching-color" as const;
      const index=counter++;
      if(type==="building")return {id,type,building:buildings[index%8],back};
      if(type==="livestock")return {id,type,species:(["cattle","sheep","pigs","chickens"] as const)[index%4],count:([2,3,4] as const)[index%3],back};
      if(type==="monastery")return {id,type,number:(monastery++%26+1) as import("./types").MonasteryNumber,back};
      return {id,type,back};
    };
    for(const phase of ["A","B","C","D","E"] as const){
      const recipe=officialMarketRecipe(count as 3|4,phase);
      const depots=recipe.depots.map(d=>({number:d.number,goods:[],slots:d.slots.map(slot=>{
        const id=`practice-slotted:${phase}:${slot.id}`;tiles[id]=authoredTile(id,slot.requiredType);
        if(phase!=="A")remainingTileIds.push(id);
        return {...slot,tileId:id};
      })}));
      const black=Array.from({length:recipe.blackSlots},(_,i)=>{
        const id=`practice-slotted:${phase}:black:${i}`;tiles[id]=authoredTile(id,(["building","ship","livestock","castle","mine","monastery"] as const)[i%6],true);
        if(phase!=="A")remainingTileIds.push(id);return id;
      });
      if(phase==="A"){numberedDepots.splice(0,numberedDepots.length,...depots);blackDepot=black;}
    }
  }
  if (geese && !(useOfficialSlots && count === 2)) {
    tiles["project-geese"] = { id: "project-geese", type: "livestock", species: "geese", count: 2, back: "black" };
    remainingTileIds.push("project-geese");
  }
  if (config.additionalHexes && !(useOfficialSlots && count===2)) {
    for (const tile of [
      {id:"project-extra:27",type:"monastery",number:27,back:"matching-color"},
      {id:"project-extra:28",type:"monastery",number:28,back:"matching-color"},
      {id:"project-extra:crane",type:"building",building:"crane",back:"black"},
    ] as const) {tiles[tile.id]=tile;remainingTileIds.push(tile.id);}
  }
  if (config.whiteCastles && !(useOfficialSlots && count === 2)) {
    for (const tile of whiteCastleTiles()) { tiles[tile.id] = tile; remainingTileIds.push(tile.id); }
    // Mix into the respective supplies BEFORE phase A, including authored 3–4 seat setups.
    remainingTileIds.push(...numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])), ...blackDepot);
    const draw = (back: Tile["back"], type?: TileType) => {
      const eligible = remainingTileIds.filter(id=>tiles[id].back===back&&(!type||tiles[id].type===type));
      if (!eligible.length) throw new Error("흰 성 확장의 초기 공급이 부족합니다.");
      const id = eligible[randomIndex(eligible.length)];
      remainingTileIds.splice(remainingTileIds.indexOf(id),1);
      return id;
    };
    for (const depot of numberedDepots) for (const slot of depot.slots) slot.tileId=draw("matching-color",slot.requiredType);
    blackDepot=blackDepot.map(()=>draw("black"));
  }
  const roundGoods = phaseGoods.A;
  const state: GameState = { schemaVersion: "0.2.1", revision: 0, status: "playing",
    config: { ruleset: "special-edition-base", mode: "competitive", playerCount: count,
      players: players.map(p => ({ id: p.id, name: p.name, color: p.color, seat: p.seat, boardId: p.duchy.boardId, startingCastleCellId: p.duchy.startingCastleCellId, controller: "human" })),
      startingPlayerId: players[firstSeat].id, seed: config.seed, catalogId: useOfficialSlots && count === 2 ? "project:base-160-v1" : "practice:non-official-supply", ...(useOfficialSlots?{marketRecipeId:count === 2 ? "se:main:2" as const : "se:main:3-4" as const}:{}), extensions: [...(config.whiteCastles ? [{id:"white-castles" as const,options:{}}] : []), ...(config.additionalHexes ? [{id:"additional-hexes" as const,options:{}}] : []), ...(geese ? [{ id: "geese" as const, options: {} }] : []), ...(config.borderPosts ? [{ id: "border-posts" as const, options: {} }] : [])] },
    players, tiles, market: { numberedDepots, blackDepot, supplyPools: [{ id: "practice:authored-reserve", remainingTileIds }], removedTileIds,
      bonusTiles: (["castle", "ship", "mine", "livestock", "building", "monastery"] as const).flatMap(color => (["first", "second"] as const).map(rank => ({ id: `bonus:${color}:${rank}`, color, rank, points: count + (rank === "first" ? 3 : 0) }))),
      phaseGoods: { ...phaseGoods, A: [] }, roundGoods },
    dice: { players: Object.fromEntries(players.map(p => [p.id, [{ id: `${p.id}:a`, value: 1, used: false }, { id: `${p.id}:b`, value: 1, used: false }]])),
      whiteDie: null, rolledForRound: false, roundGoodsDistributed: false },
    turn: { phase: "A", round: 1, stage: "round-setup", activePlayerId: null, orderTrack: [{ position: 0, players: [...players.slice(firstSeat), ...players.slice(0, firstSeat)].map(p => p.id) }], actedPlayerIds: [], blackPurchaseUsed: false, monasterySixUsed: false, pendingEffects: [], pendingChoice: null },
    scoreLedger: Object.fromEntries(players.map(p => [p.id, []])), random, extensionStates: {}, finalScores: null };
  if(config.shieldPreview||config.shieldRules){
    const shields=createShieldLayout(count as 2|3|4,state.random,!!config.shieldRules);
    Object.assign(state,{config:{...state.config,extensions:[...state.config.extensions,{id:"shields",options:config.shieldRules?{rules:true}:{uiPreview:true}}]},random:shields.random,extensionStates:{shields:shields.layout}});
  }
  const valid = validateCoreState(state);
  if (!valid.valid) throw new Error(valid.issues.map(i => i.message).join(", "));
  return state;
}
