import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEET_BOARD_DEFINITIONS } from "../../src/game/boards/se-duchy-sheet";
import { VERIFIED_BOARD_DEFINITIONS, getBoardPreview } from "../../src/game/boards/catalog";
import { validateBoardDefinition } from "../../src/game/boards/validation";
import { SE_BASE_2 } from "../../src/game/boards/se-base-2";

test("thirty sourced individual layouts contain 1110 valid cells and retain their families", () => {
  assert.equal(VERIFIED_BOARD_DEFINITIONS.length, 30);
  assert.equal(VERIFIED_BOARD_DEFINITIONS.reduce((n, b) => n + b.cells.length, 0), 1110);
  for (const b of VERIFIED_BOARD_DEFINITIONS) {
    assert.deepEqual(validateBoardDefinition(b), { valid: true, issues: [] }, b.id);
    assert.equal(getBoardPreview(b.id).status, "ready");
    const count = (terrain: string) => b.cells.filter(c => c.terrain === terrain).length;
    assert.deepEqual([count("castle"), count("mine"), count("ship"), count("livestock"), count("building"), count("monastery")], [4,3,6,6,12,6], b.id);
  }
  assert.deepEqual(["base", "additional-duchies", "championship", "special-edition", "border-posts"].map(f => VERIFIED_BOARD_DEFINITIONS.filter(b => b.family === f).length), [10,8,2,2,8]);
});

test("sheet SE2 matches the independently transcribed rulebook in all 37 terrain/die cells after rotation", () => {
  const sheet = SHEET_BOARD_DEFINITIONS.find(b => b.officialNumber === "2")!;
  const rotated = new Map(sheet.cells.map(c => {
    let { q, r } = c.coord;
    for (let i = 0; i < 5; i++) [q, r] = [-r, q + r];
    return [`${q},${r}`, [c.terrain, c.number]];
  }));
  for (const c of SE_BASE_2.cells) assert.deepEqual(rotated.get(c.id), [c.terrain, c.number], c.id);
  assert.equal(VERIFIED_BOARD_DEFINITIONS.find(b => b.id === SE_BASE_2.id), SE_BASE_2);
});
