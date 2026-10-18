import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveRegions } from "../../src/game/boards/regions";
import { validateBoardDefinition } from "../../src/game/boards/validation";
import { getSelectableBoards } from "../../src/game/boards/catalog";
import { modeBoardNeighbors, modePlacementFrontier, validateModeBoardDefinition, type ModeBoardDefinition } from "../../src/game/boards/mode-topology";

/** TEST FIXTURE: arbitrary four-cell islands, no official numbers or inferred map. */
function fixture(): ModeBoardDefinition {
  const cells: ModeBoardDefinition["cells"] = [
    { id: "start", coord: { q: 0, r: 0 }, terrain: "castle", number: 1, regionId: "castle" },
    { id: "town-a", coord: { q: 3, r: 0 }, terrain: "building", number: 2, regionId: "town" },
    { id: "town-b", coord: { q: 4, r: 0 }, terrain: "building", number: 3, regionId: "town" },
    { id: "mine", coord: { q: 4, r: 1 }, terrain: "mine", number: 4, regionId: "mine" },
  ];
  return { id: "test:mode-islands", officialNumber: null, family: "synthetic-test", mode: "solo", format: "mode-graph",
    expectedCellCount: 4, cells, regions: deriveRegions(cells), verification: { status: "synthetic-test" },
    areas: [{ id: "west", cellIds: ["start"] }, { id: "middle", cellIds: ["town-a", "town-b"] }, { id: "east", cellIds: ["mine"] }],
    startingCastle: { policy: "any-castle", allowedCellIds: ["start"], recommendedCellId: "start" },
    riverLinks: [{ from: "start", to: "town-a" }, { from: "town-b", to: "mine" }] };
}
const codes = (board: ModeBoardDefinition) => validateModeBoardDefinition(board).issues.map(i => i.code);

test("mode graph permits source-injected river connections without relaxing individual boards", () => {
  const b = fixture();
  assert.deepEqual(validateModeBoardDefinition(b), { valid: true, issues: [] });
  assert.ok(validateBoardDefinition({ ...b, format: "individual-hex" }).issues.some(i => i.code === "disconnected-board"));
  assert.ok(!getSelectableBoards().some(x => x.id === b.id));
});
test("solo cross-area contact requires a declared river even for adjacent hexes", () => {
  const b = fixture();
  assert.deepEqual(modeBoardNeighbors(b, "start"), ["town-a"]);
  assert.deepEqual(modeBoardNeighbors(b, "town-a"), ["start", "town-b"]);
  assert.deepEqual(modeBoardNeighbors({ ...b, riverLinks: b.riverLinks.slice(0, 1) }, "mine"), []);
  assert.ok(codes({ ...b, riverLinks: b.riverLinks.slice(0, 1) }).includes("disconnected-mode-board"));
});
test("river edges are undirected and input order does not affect contact or validation", () => {
  const b = fixture();
  const reversed = { ...b, cells: [...b.cells].reverse(), riverLinks: [...b.riverLinks].reverse().map(l => ({ from: l.to, to: l.from })) };
  assert.deepEqual(validateModeBoardDefinition(reversed), { valid: true, issues: [] });
  for (const c of b.cells) assert.deepEqual(modeBoardNeighbors(b, c.id), modeBoardNeighbors(reversed, c.id));
});
test("frontier is one step from occupied cells, not across empty river chains", () => {
  const b = fixture(), snapshot = structuredClone(b);
  assert.deepEqual(modePlacementFrontier(b, []), []);
  assert.deepEqual(modePlacementFrontier(b, ["start"]), ["town-a"]);
  assert.deepEqual(modePlacementFrontier(b, ["start", "town-a"]), ["town-b"]);
  assert.deepEqual(modePlacementFrontier(b, ["start", "town-a", "town-b"]), ["mine"]);
  assert.deepEqual(modePlacementFrontier(b, b.cells.map(c => c.id)), []);
  assert.deepEqual(b, snapshot);
});
test("dangling, self, reversed duplicate and intra-area rivers are rejected", () => {
  const b = fixture();
  for (const link of [{ from: "missing", to: "start" }, { from: "start", to: "start" }])
    assert.ok(codes({ ...b, riverLinks: [...b.riverLinks, link] }).includes("river-endpoint"));
  assert.ok(codes({ ...b, riverLinks: [...b.riverLinks, { from: "town-a", to: "start" }] }).includes("duplicate-river"));
  assert.ok(codes({ ...b, riverLinks: [...b.riverLinks, { from: "town-a", to: "town-b" }] }).includes("river-area"));
});
test("unconnected islands fail instead of silently deriving missing rivers", () => {
  assert.ok(codes({ ...fixture(), riverLinks: [] }).includes("disconnected-mode-board"));
});
test("mode validation preserves number, coordinate, region, start and evidence checks", () => {
  const b = fixture();
  assert.ok(codes({ ...b, cells: b.cells.map((c, i) => i === 0 ? { ...c, number: 7 as never } : c) }).includes("die-number"));
  assert.ok(codes({ ...b, cells: b.cells.map((c, i) => i === 1 ? { ...c, coord: b.cells[0].coord } : c) }).includes("duplicate-coordinate"));
  assert.ok(codes({ ...b, regions: [] }).includes("region-reference"));
  assert.ok(codes({ ...b, startingCastle: { ...b.startingCastle, allowedCellIds: ["mine"] } }).includes("starting-castle"));
  assert.ok(codes({ ...b, verification: { status: "verified", reviewedBy: "test", reviewedOn: "2026-10-18", evidence: [] } }).includes("verification-evidence"));
});
test("team mode uses physical contact across regions and rejects solo rivers", () => {
  const source = fixture();
  const cells = source.cells.map(c => c.id === "start" ? { ...c, coord: { q: 2, r: 0 } } : c);
  const b: ModeBoardDefinition = { ...source, mode: "team", cells, regions: deriveRegions(cells), riverLinks: [] };
  assert.ok(validateModeBoardDefinition(b).valid);
  assert.deepEqual(modePlacementFrontier(b, ["town-b"]), ["mine", "town-a"]);
  assert.ok(codes({ ...b, riverLinks: source.riverLinks }).includes("team-river"));
});
test("mismatched mode identity and invalid frontier occupancy fail closed", () => {
  const b = fixture();
  assert.ok(codes({ ...b, family: "team" }).includes("mode-family"));
  assert.ok(codes({ ...b, mode: "unknown" as never }).includes("board-mode"));
  assert.throws(() => modeBoardNeighbors(b, "unknown"), /Unknown/);
  assert.throws(() => modePlacementFrontier(b, ["unknown"]), /occupied/);
  assert.throws(() => modePlacementFrontier(b, ["start", "start"]), /occupied/);
  assert.throws(() => modePlacementFrontier({ ...b, riverLinks: [] }, ["start"]), /Invalid mode board/);
});
test("land areas are separate from coloured scoring regions", () => {
  const b = fixture();
  const areas = [{ id: "west", cellIds: ["start"] }, { id: "east", cellIds: ["town-a", "town-b", "mine"] }];
  const merged = { ...b, areas, riverLinks: b.riverLinks.slice(0, 1) };
  assert.ok(validateModeBoardDefinition(merged).valid);
  assert.ok(modeBoardNeighbors(merged, "town-b").includes("mine"));
  assert.equal(merged.cells.find(c => c.id === "town-b")?.regionId === merged.cells.find(c => c.id === "mine")?.regionId, false);
});
test("area membership is a complete unique partition and each area is connected", () => {
  const b = fixture();
  for (const areas of [[], [{ id: "", cellIds: ["start"] }], [b.areas[0], b.areas[0]]]) {
    assert.ok(codes({ ...b, areas }).includes("area-id"));
  }
  assert.ok(codes({ ...b, areas: b.areas.slice(0, 1) }).includes("area-membership"));
  assert.ok(codes({ ...b, areas: [...b.areas, { id: "extra", cellIds: ["unknown"] }] }).includes("area-membership"));
  assert.ok(codes({ ...b, areas: [{ id: "one", cellIds: b.cells.map(c => c.id) }] }).includes("disconnected-area"));
});
