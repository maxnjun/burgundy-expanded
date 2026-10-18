import type { DiceState, DuchyBoard, GameAction, GameState, GoodsTile, MarketState, PlayerColor, PlayerState, ScoreEntry, TurnState } from "../types";
import type { Transition } from "../interfaces";
import type { ModeBoardDefinition } from "../boards/mode-topology";

export type TeamId = "A" | "B";
export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly seat: number;
  readonly teamId: TeamId;
  readonly member: 0 | 1;
  readonly privateStorage: readonly [string | null, string | null];
  readonly victoryPoints: number;
  readonly scoreLedger: readonly ScoreEntry[];
}
export interface SharedTeamEstate {
  readonly id: TeamId;
  readonly definition: ModeBoardDefinition;
  readonly duchy: DuchyBoard;
  readonly sharedStorage: readonly [string | null, string | null];
  readonly workers: number;
  readonly silver: number;
  readonly goods: PlayerState["goods"];
  readonly soldGoods: readonly GoodsTile[];
  readonly bonuses: PlayerState["bonuses"];
}
/** Board/resources have exactly ONE owner/location. Never serialize duplicated PlayerStates. */
export interface TeamGameState {
  readonly schemaVersion: "burgundy-team-v1";
  readonly mode: "team";
  readonly revision: number;
  readonly status: "playing" | "finished";
  readonly finalScores: readonly TeamFinalScore[] | null;
  readonly marketRecipeId: "se:main:3-4" | null;
  readonly teams: readonly SharedTeamEstate[];
  readonly players: readonly TeamMember[];
  readonly tiles: GameState["tiles"];
  readonly market: MarketState;
  readonly dice: DiceState;
  readonly turn: TurnState;
  readonly random: GameState["random"];
}
/** Input catalog/market/boards are injected. No official board or supply is fabricated.
 * Member array order A1,A2,B1,B2 gives initial turn order A1,B1,A2,B2 (PDF p.15).
 */
export interface TeamGameSetup {
  readonly marketRecipeId?: "se:main:3-4";
  readonly players: readonly { readonly id: string; readonly name: string; readonly color: PlayerColor }[];
  readonly boards: readonly [ModeBoardDefinition, ModeBoardDefinition];
  readonly startingCastleCellIds: readonly [string, string];
  readonly startingCastleTileIds: readonly [string, string];
  readonly initialGoods: readonly [readonly GoodsTile[], readonly GoodsTile[]];
  readonly tiles: GameState["tiles"];
  readonly market: MarketState;
  readonly random: GameState["random"];
}
/** Existing GameAction contract. Storage indices 0/1 = own, 2/3 = shared;
 * no index or command exposes the teammate's private inventory.
 */
export type TeamGameAction = GameAction;
export interface TeamTransition {
  readonly state: TeamGameState;
  readonly events: Transition["events"];
}
export interface TeamFinalScore {
  readonly teamId: TeamId;
  readonly members: readonly { readonly playerId: string; readonly earned: number }[];
  readonly earnedTotal: number;
  readonly sharedAdditions: readonly ScoreEntry[];
  readonly sharedTotal: number;
  readonly total: number;
  readonly emptySpaces: number;
}
