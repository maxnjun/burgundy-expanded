import type { DuchyBoard, GameAction, GameConfig, GameState, PlayerId, RuleSource, ScoreBreakdown, Tile } from "./types";

/** A catalog must contain verified physical layouts and supply recipes before createGame can run. */
export interface RuleCatalog {
  readonly id: string;
  readonly sources: readonly RuleSource[];
  readonly tiles: readonly Tile[];
  readonly duchies: readonly DuchyBoard[];
  readonly marketRecipes: readonly { readonly playerCount: 2 | 3 | 4; readonly phase: "A" | "B" | "C" | "D" | "E"; readonly data: import("./types").JsonValue }[];
}
export interface EngineIssue { readonly code: "invalid-config" | "illegal-action" | "unresolved-rule" | "incomplete-catalog" | "unsupported-extension"; readonly message: string; readonly source?: RuleSource }
export type EngineResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly EngineIssue[] };
export type ValidationResult = { readonly valid: true } | { readonly valid: false; readonly issues: readonly EngineIssue[] };
export interface EngineContext {
  readonly catalog: RuleCatalog;
  readonly extensions: readonly import("./extensions").ExtensionModule[];
}
export interface Transition {
  readonly state: GameState;
  readonly events: readonly { readonly type: string; readonly playerId?: PlayerId; readonly source: RuleSource; readonly payload: import("./types").JsonValue }[];
}
export type GameEndResult =
  | { readonly ended: false }
  | { readonly ended: true; readonly scores: readonly ScoreBreakdown[]; readonly winnerIds: readonly PlayerId[] };

/** Adapter contracts: the tested core runtime is separate; official catalog-backed setup remains pending. */
export type CreateGame = (config: GameConfig, context: EngineContext) => EngineResult<GameState>;
/** Includes pending-choice resolutions and non-die actions; unresolved rules return issues, not a false empty list. */
export type GetLegalActions = (state: GameState, playerId: PlayerId, context: EngineContext) => EngineResult<readonly GameAction[]>;
export type ValidateAction = (state: GameState, action: GameAction, context: EngineContext) => ValidationResult;
/** Future implementation: validate first; reject atomically; never mutate the input state. */
export type ApplyAction = (state: GameState, action: GameAction, context: EngineContext) => EngineResult<Transition>;
export type CalculateScore = (state: GameState, playerId: PlayerId, timing: "current" | "final", context: EngineContext) => EngineResult<ScoreBreakdown>;
/** No automatic progression across unresolved choices/effects; deterministic RNG is state-owned. */
export type AdvanceTurn = (state: GameState, context: EngineContext) => EngineResult<Transition>;
/** A query, not a second application of final-scoring points. */
export type CheckGameEnd = (state: GameState, context: EngineContext) => EngineResult<GameEndResult>;
export interface GameEngine {
  readonly createGame: CreateGame;
  readonly getLegalActions: GetLegalActions;
  readonly validateAction: ValidateAction;
  readonly applyAction: ApplyAction;
  readonly calculateScore: CalculateScore;
  readonly advanceTurn: AdvanceTurn;
  readonly checkGameEnd: CheckGameEnd;
}
