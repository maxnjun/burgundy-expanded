import type { EngineResult, Transition, ValidationResult } from "./interfaces";
import type { ExtensionConfig, ExtensionId, GameAction, GameConfig, GameState, JsonValue, PlayerId, RuleSource, ScoreEntry } from "./types";

export type ExtensionHook = "setup" | "before-action" | "after-action" | "phase-start" | "round-start" | "turn-end" | "phase-end" | "final-scoring";
export interface ExtensionCompatibility {
  readonly requires: readonly ExtensionId[];
  /** Empty lists are not approval: unverified combinations must be rejected by validateConfig. */
  readonly incompatibleWith: readonly ExtensionId[];
  readonly verifiedCombinations: readonly (readonly ExtensionId[])[];
}
export interface ExtensionContext<TState extends JsonValue = JsonValue> {
  readonly game: GameState;
  readonly moduleState: TState;
  readonly action: GameAction | null;
  readonly playerId: PlayerId | null;
}
/** Extension results are proposals; a future coordinator owns ordering, validation and atomic commits. */
export interface ExtensionProposal<TState extends JsonValue = JsonValue> {
  readonly moduleState: TState;
  readonly transition: Transition;
}
export interface ExtensionModule<TState extends JsonValue = JsonValue> {
  readonly id: ExtensionId;
  readonly version: string;
  readonly sources: readonly RuleSource[];
  readonly compatibility: ExtensionCompatibility;
  readonly hooks: readonly ExtensionHook[];
  readonly validateConfig: (config: GameConfig, ownConfig: ExtensionConfig) => ValidationResult;
  readonly initialize: (game: GameState, config: ExtensionConfig) => EngineResult<TState>;
  readonly getLegalActions: (context: ExtensionContext<TState>) => EngineResult<readonly GameAction[]>;
  readonly validateAction: (context: ExtensionContext<TState>, action: GameAction) => ValidationResult;
  readonly resolveHook: (hook: ExtensionHook, context: ExtensionContext<TState>) => EngineResult<ExtensionProposal<TState>>;
  readonly calculateScore: (context: ExtensionContext<TState>) => EngineResult<readonly ScoreEntry[]>;
}
/** Capability declarations describe future integration seams, not enabled rules or implementations. */
export interface ExtensionCapabilities {
  readonly shields: { readonly domain: "player-abilities"; readonly sourcePages: readonly [17, 18] };
  readonly "trade-routes": { readonly domain: "goods-sale-route"; readonly sourcePages: readonly [14] };
  readonly vineyards: { readonly domain: "additional-board-and-double-hex-tiles"; readonly sourcePages: readonly [19, 20, 21] };
  readonly "team-game": { readonly domain: "shared-team-ownership"; readonly sourcePages: readonly [15] };
  readonly "solo-game": { readonly domain: "solo-setup-progression-and-victory"; readonly sourcePages: readonly [15, 16] };
  readonly chateauma: { readonly domain: "automated-opponent"; readonly sourcePages: readonly [22, 23, 24, 25, 26, 27, 28] };
}
export type ExtensionRegistry = Readonly<Partial<Record<ExtensionId, ExtensionModule>>>;
