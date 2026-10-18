import { test } from "node:test";
import assert from "node:assert/strict";
import { AXIAL_DIRECTIONS, areAxialNeighbors, coordinateKey, getAxialNeighbors } from "../../src/game/boards/axial";
import { deriveRegions } from "../../src/game/boards/regions";
import { validateBoardDefinition } from "../../src/game/boards/validation";
import { BOARD_INVENTORY, VERIFIED_BOARD_DEFINITIONS, getBoardPreview, getSelectableBoards } from "../../src/game/boards/catalog";
import type { BoardDefinition, BoardCellDefinition } from "../../src/game/boards/types";

/** Deliberately artificial tiny graph; never an official board or runtime catalog entry. */
function fixture(): BoardDefinition {
  const cells: readonly BoardCellDefinition[] = [
    { id: "c", coord: { q: 0, r: 0 }, terrain: "castle", number: 6, regionId: "castle" },
    { id: "a", coord: { q: 1, r: 0 }, terrain: "building", number: 2, regionId: "town" },
    { id: "b", coord: { q: 1, r: -1 }, terrain: "building", number: 3, regionId: "town" },
    { id: "s", coord: { q: 0, r: -1 }, terrain: "ship", number: 4, regionId: "river" },
  ];
  return { id: "test:tiny", officialNumber: null, family: "synthetic-test", format: "individual-hex", expectedCellCount: 4,
    cells, regions: [
      { id: "castle", terrain: "castle", cellIds: ["c"], adjacentRegionIds: ["town", "river"] },
      { id: "town", terrain: "building", cellIds: ["a", "b"], adjacentRegionIds: ["castle", "river"] },
      { id: "river", terrain: "ship", cellIds: ["s"], adjacentRegionIds: ["castle", "town"] },
    ], startingCastle: { policy: "any-castle", allowedCellIds: ["c"], recommendedCellId: "c" }, verification: { status: "synthetic-test" } };
}
const codes = (board: BoardDefinition) => validateBoardDefinition(board).issues.map(i => i.code);
test("axial origin has exactly the six specified neighbors", () => {
  assert.deepEqual(getAxialNeighbors({q:0,r:0}), AXIAL_DIRECTIONS);
  assert.equal(new Set(getAxialNeighbors({q:0,r:0}).map(coordinateKey)).size, 6);
  assert.equal(areAxialNeighbors({q:0,r:0},{q:1,r:1}), false);
  assert.equal(areAxialNeighbors({q:0,r:0},{q:0,r:0}), false);
});
test("adjacency is symmetric and translation invariant across negative and positive coordinates", () => {
  for (let q=-5;q<=5;q++) for(let r=-5;r<=5;r++) for (const n of getAxialNeighbors({q,r})) {
    assert.ok(areAxialNeighbors({q,r}, n)); assert.ok(areAxialNeighbors(n, {q,r}));
  }
});
test("fractional, infinite and unsafe coordinates are rejected", () => {
  for (const q of [.5, NaN, Infinity, Number.MAX_SAFE_INTEGER+1]) assert.throws(() => coordinateKey({q,r:0}), RangeError);
  assert.throws(() => getAxialNeighbors({q:Number.MAX_SAFE_INTEGER,r:0}), RangeError);
});
test("synthetic board passes structural validation without claiming authenticity", () => {
  assert.deepEqual(validateBoardDefinition(fixture()), {valid:true, issues:[]});
});
test("regions follow maximal same-color components and symmetric boundary edges", () => {
  const regions = deriveRegions(fixture().cells);
  assert.deepEqual(regions.find(r=>r.id==="town")?.cellIds, ["a","b"]);
  assert.deepEqual(regions.find(r=>r.id==="river")?.adjacentRegionIds, ["castle","town"]);
  assert.deepEqual(deriveRegions([...fixture().cells].reverse()), regions);
});
test("duplicate coordinates and IDs fail", () => {
  const b=fixture();
  assert.ok(codes({...b,cells:b.cells.map((c,i)=>i===1?{...c,coord:b.cells[0].coord}:c)}).includes("duplicate-coordinate"));
  assert.ok(codes({...b,cells:b.cells.map((c,i)=>i===1?{...c,id:"c"}:c)}).includes("cell-id"));
  assert.throws(()=>deriveRegions([...b.cells,b.cells[0]]), /Duplicate/);
});
test("invalid die, terrain, count and coordinate fail", () => {
  const b=fixture();
  assert.ok(codes({...b,expectedCellCount:37}).includes("cell-count"));
  assert.ok(codes({...b,cells:b.cells.map((c,i)=>i===0?{...c,number:7 as never,terrain:"unknown" as never,coord:{q:.2,r:0}}:c)}).includes("die-number"));
  const result=codes({...b,cells:b.cells.map((c,i)=>i===0?{...c,terrain:"unknown" as never,coord:{q:.2,r:0}}:c)});
  assert.ok(result.includes("terrain"));assert.ok(result.includes("coordinate"));
});
test("missing, split, unused and incorrectly listed regions fail", () => {
  const b=fixture();
  assert.ok(codes({...b,regions:b.regions.filter(r=>r.id!=="town")}).includes("region-reference"));
  assert.ok(codes({...b,cells:b.cells.map(c=>c.id==="b"?{...c,regionId:"other"}:c)}).includes("split-region"));
  assert.ok(codes({...b,regions:[...b.regions,{id:"unused",terrain:"mine",cellIds:[],adjacentRegionIds:[]}]}).includes("unused-region"));
  assert.ok(codes({...b,regions:b.regions.map(r=>r.id==="town"?{...r,cellIds:["a"]}:r)}).includes("region-membership"));
});
test("disconnected board and disconnected region sharing one ID fail", () => {
  const b=fixture();
  const c={...b.cells[1],id:"far",coord:{q:20,r:20}};
  const result=codes({...b,expectedCellCount:5,cells:[...b.cells,c]});
  assert.ok(result.includes("disconnected-board"));assert.ok(result.includes("disconnected-region"));
});
test("wrong region adjacency and duplicate region IDs fail", () => {
  const b=fixture();
  assert.ok(codes({...b,regions:b.regions.map(r=>({...r,adjacentRegionIds:[]}))}).includes("region-adjacency"));
  assert.ok(codes({...b,regions:[...b.regions,b.regions[0]]}).includes("region-id"));
});
test("start candidates must be castle cells and recommended start must be allowed", () => {
  const b=fixture();
  assert.ok(codes({...b,startingCastle:{policy:"listed-castles",allowedCellIds:["a"],recommendedCellId:null}}).includes("starting-castle"));
  assert.ok(codes({...b,startingCastle:{...b.startingCastle,allowedCellIds:[]}}).includes("starting-policy"));
  assert.ok(codes({...b,startingCastle:{...b.startingCastle,recommendedCellId:"missing"}}).includes("starting-recommendation"));
});
test("synthetic data cannot claim official verified identity", () => {
  const b=fixture();assert.ok(codes({...b,verification:{status:"verified",reviewedBy:"",reviewedOn:"",evidence:[]}}).includes("verification-evidence"));
});
test("inventory has 38 unique official face identifiers and source pages", () => {
  assert.equal(BOARD_INVENTORY.length,38);
  assert.equal(new Set(BOARD_INVENTORY.map(b=>b.id)).size,38);
  assert.equal(BOARD_INVENTORY.filter(b=>b.family==="base").length,10);
  assert.equal(BOARD_INVENTORY.filter(b=>b.family==="team").length,4);
  assert.deepEqual(BOARD_INVENTORY.filter(b=>b.family==="chateauma").map(b=>b.officialNumber),["35","36"]);
  assert.ok(BOARD_INVENTORY.every(b=>b.sources.length && b.sources.every(s=>s.pages.length && s.pages.every(p=>p>=1&&p<=28))));
});
test("unverified official inventory never becomes playable or gains invented previews", () => {
  assert.deepEqual(getSelectableBoards().map(b => b.officialNumber), Array.from({ length: 30 }, (_, i) => String(i + 1)));
  for (const b of BOARD_INVENTORY.filter(b => b.geometryStatus === "missing")) assert.deepEqual(getBoardPreview(b.id), {status:"unavailable",boardId:b.id,reason:"unverified-geometry"});
  assert.equal(getBoardPreview("test:tiny").status,"unavailable");
  assert.deepEqual(getBoardPreview("missing"),{status:"unavailable",boardId:"missing",reason:"unknown-board"});
});

test("official SE duchy 2 has 37 unique connected valid cells and sourced identity", () => {
  const board = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === "se:base:2")!;
  assert.equal(board.officialNumber, "2");
  assert.deepEqual(validateBoardDefinition(board), { valid: true, issues: [] });
  assert.equal(board.cells.length, 37);
  assert.equal(board.regions.length, 19);
  assert.equal(getBoardPreview(board.id).status, "ready");
  assert.equal(board.verification.status, "verified");
  if (board.verification.status === "verified") assert.match(board.verification.evidence[0].locator, /p\.2 \/Im23/);
});

test("SE2 region sizes and castle choices match the manually audited printed diagram", () => {
  const board = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === "se:base:2")!;
  const sizes = (terrain: BoardCellDefinition["terrain"]) => board.regions.filter(r => r.terrain === terrain).map(r => r.cellIds.length).sort((a,b) => a-b);
  assert.deepEqual(sizes("building"), [2,2,3,5]);
  assert.deepEqual(sizes("ship"), [2,2,2]);
  assert.deepEqual(sizes("livestock"), [2,4]);
  assert.deepEqual(sizes("monastery"), [1,2,3]);
  assert.deepEqual(sizes("mine"), [1,1,1]);
  assert.deepEqual([...board.startingCastle.allowedCellIds].sort(), ["-3,3","0,-3","0,0","3,0"]);
  assert.equal(board.startingCastle.recommendedCellId, "0,0");
  assert.equal(board.cells.find(c => c.id === "0,0")?.number, 6);
});

test("SE2 seven printed die rows survive coordinate orientation and transcription", () => {
  const board = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === "se:base:2")!;
  const rows = Array.from({ length: 7 }, (_,i) => board.cells.filter(c => c.coord.r === i-3).sort((a,b) => a.coord.q-b.coord.q).map(c => c.number).join(""));
  // Independently recorded visual audit in docs/boards/se-base-2.md, not a rule inferred from balance.
  assert.deepEqual(rows, ["3431","45242","561516","6136353","242421","51514","6263"]);
});

