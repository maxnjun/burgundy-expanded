import { parseBoundedGameJson } from "../bounded-json";
import type { ModeBoardDefinition } from "../boards/mode-topology";
import type { TeamGameState } from "./team-types";
import { validateTeamState } from "./team-state";

export interface TeamSave {
  readonly format: "burgundy-team-save-v1";
  readonly randomAlgorithm: "counter-v1";
  readonly game: TeamGameState;
}
/** Trusted by the caller, never taken from the save file being imported. */
export interface TeamSaveCatalog {
  readonly boards: readonly ModeBoardDefinition[];
  readonly tiles: TeamGameState["tiles"];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (object(v)) return `{${Object.keys(v).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(v[key])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** Explicit separate format: never changes or relaxes the existing competitive v1 save.
 * This is offline structural validation, not authentication of a player's game history.
 */
export function parseTeamSave(text: string, catalog: TeamSaveCatalog): TeamSave {
  try {
    const parsed = parseBoundedGameJson(text);
    if (!object(parsed) || parsed.format !== "burgundy-team-save-v1" || parsed.randomAlgorithm !== "counter-v1" || !object(parsed.game)) throw new Error();
    const save = parsed as unknown as TeamSave, game = save.game;
    if (!validateTeamState(game).valid || canonicalJson(game.tiles) !== canonicalJson(catalog.tiles)) throw new Error();
    for (const team of game.teams) {
      const known = catalog.boards.find(b => b.id === team.definition.id);
      if (!known || canonicalJson(known) !== canonicalJson(team.definition)) throw new Error();
    }
    for (const phase of ["A", "B", "C", "D", "E"] as const) if (game.market.phaseGoods[phase].length !== (phase > game.turn.phase ? 5 : 0)) throw new Error();
    return save;
  } catch { throw new Error("팀 저장 파일의 형식·상태·신뢰된 보드/타일 구성이 올바르지 않습니다."); }
}
export function serializeTeamSave(game: TeamGameState, catalog: TeamSaveCatalog): string {
  const text = JSON.stringify({ format: "burgundy-team-save-v1", randomAlgorithm: "counter-v1", game } satisfies TeamSave);
  parseTeamSave(text, catalog);
  return text;
}
