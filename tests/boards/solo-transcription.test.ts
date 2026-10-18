import { test } from "node:test";
import assert from "node:assert/strict";
import { SOLO_33_TRANSCRIPTION as draft } from "../../src/game/boards/drafts/solo-33";
import { deriveRegions } from "../../src/game/boards/regions";
import { getSelectableBoards, getBoardPreview } from "../../src/game/boards/catalog";
import { validateBoardDefinition } from "../../src/game/boards/validation";

test("solo source worksheet has 37 cells in four separately transcribed islands", () => {
  // Recounted directly in the PDF photograph: 2+3+2, 4+4+3, 2+2+2, 4+5+4.
  assert.deepEqual(draft.areas.map(a => a.cells.length), [7, 11, 6, 13]);
  const cells = draft.areas.flatMap(a => a.cells);
  assert.equal(cells.length, 37);
  assert.equal(new Set(cells.map(c => c.id)).size, 37);
  assert.deepEqual(cells.filter(c => c.terrain === "castle").map(c => c.number).sort(), [1, 3, 3, 5]);
});
test("each island has consistent local axial regions and valid dice without asserting global geometry", () => {
  for (const a of draft.areas) {
    // Check the real terrain/number/region data without adding a synthetic castle;
    // only the absence of an initial castle is exempt for islands that contain no castle.
    const starts = a.cells.filter(c => c.terrain === "castle").map(c => c.id);
    const result = validateBoardDefinition({ id: `test:${a.id}`, officialNumber: null, family: "synthetic-test", format: "individual-hex",
      expectedCellCount: a.cells.length, cells: a.cells, regions: deriveRegions(a.cells), verification: { status: "synthetic-test" },
      startingCastle: { policy: "any-castle", allowedCellIds: starts, recommendedCellId: null } });
    assert.deepEqual(result.issues.filter(i => !(starts.length === 0 && i.code === "starting-castle")), []);
  }
});
test("incomplete solo transcription stays out of the official playable catalog", () => {
  assert.equal(draft.status, "draft");
  assert.ok(draft.unresolved.length >= 3);
  assert.equal(getSelectableBoards().some(b => b.id === draft.id), false);
  assert.equal(getBoardPreview(draft.id).status, "unavailable");
  assert.ok(draft.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sha256)));
});
