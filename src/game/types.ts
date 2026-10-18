/** Shared v0.2.1 contracts; src/game/core implements an explicit partial runtime separately. */
export type PlayerId = string;
export type PlayerColor = "blue" | "red" | "green" | "yellow";
export type TileId = string;
export type CellId = string;
export type DieId = string;
export type Phase = "A" | "B" | "C" | "D" | "E";
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type RoundNumber = 1 | 2 | 3 | 4 | 5;
export type TileType = "castle" | "ship" | "mine" | "livestock" | "building" | "monastery";
export type BuildingType = "market" | "carpenters-workshop" | "church" | "warehouse" | "boarding-house" | "bank" | "town-hall" | "watchtower" | "crane";
export type MonasteryNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28;
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ExtensionId = "additional-hexes" | "geese" | "border-posts" | "shields" | "trade-routes" | "vineyards" | "team-game" | "solo-game" | "chateauma";
export interface RuleSource { readonly document: "special-edition-rulebook"; readonly pages: readonly number[]; readonly section: string }
export interface AxialCoord { readonly q: number; readonly r: number }
interface TileIdentity { readonly id: TileId; readonly back: "matching-color" | "black" }
/** Tile front type is independent of its back/supply pool. PDF pp.2,5. */
export type Tile = TileIdentity & (
  | { readonly type: "castle" | "ship" | "mine" }
  | { readonly type: "building"; readonly building: BuildingType }
  | { readonly type: "livestock"; readonly species: "cattle" | "sheep" | "pigs" | "chickens" | "geese"; readonly count: 2 | 3 | 4 }
  | { readonly type: "monastery"; readonly number: MonasteryNumber }
);
export interface GoodsTile { readonly id: string; readonly type: DieValue }
/** Coordinates and region IDs must be verified against the chosen board; no generated demo map. */
export interface HexCell {
  readonly id: CellId;
  readonly coord: AxialCoord;
  readonly terrain: TileType;
  readonly number: DieValue;
  readonly regionId: string;
  readonly tileId: TileId | null;
}
export interface DuchyBoard {
  readonly boardId: string;
  readonly cells: readonly HexCell[];
  readonly startingCastleCellId: CellId;
  readonly completedRegionIds: readonly string[];
  readonly completedColors: readonly TileType[];
}
export interface BonusTile { readonly id: string; readonly color: TileType; readonly rank: "first" | "second"; readonly points: number }
export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly color?: PlayerColor;
  readonly seat: number;
  readonly controller: "human" | "chateauma";
  readonly duchy: DuchyBoard;
  /** Base game has three slots; the core runtime validates capacity and ownership. */
  readonly storage: readonly (TileId | null)[];
  /** Base game allows at most three goods types. */
  readonly goods: readonly { readonly type: DieValue; readonly tiles: readonly GoodsTile[] }[];
  readonly soldGoods: readonly GoodsTile[];
  readonly silver: number;
  readonly workers: number;
  readonly victoryPoints: number;
  readonly bonuses: readonly BonusTile[];
}
export interface MarketSlot {
  readonly id: string;
  readonly requiredType: TileType;
  readonly tileId: TileId | null;
}
export interface MarketState {
  readonly numberedDepots: readonly { readonly number: DieValue; readonly slots: readonly MarketSlot[]; readonly goods: readonly GoodsTile[] }[];
  readonly blackDepot: readonly (TileId | null)[];
  readonly supplyPools: readonly { readonly id: string; readonly remainingTileIds: readonly TileId[] }[];
  readonly removedTileIds: readonly TileId[];
  readonly bonusTiles: readonly BonusTile[];
  readonly phaseGoods: Readonly<Record<Phase, readonly GoodsTile[]>>;
  readonly roundGoods: readonly GoodsTile[];
}
export interface PlayerDie { readonly id: DieId; readonly value: DieValue; readonly used: boolean }
export interface DiceState {
  readonly players: Readonly<Record<PlayerId, readonly [PlayerDie, PlayerDie]>>;
  readonly whiteDie: DieValue | null;
  readonly rolledForRound: boolean;
  readonly roundGoodsDistributed: boolean;
}
/** Stacks are ordered top to bottom; seats are not turn order. PDF pp.5-7. */
export interface TurnOrderSpace { readonly position: number; readonly players: readonly PlayerId[] }
export type ActionIntent =
  | { readonly kind: "take-tile"; readonly depot: DieValue; readonly tileId: TileId; readonly storageSlot: number; readonly discardTileId?: TileId }
  | { readonly kind: "place-tile"; readonly tileId: TileId; readonly cellId: CellId }
  | { readonly kind: "sell-goods"; readonly goodsType: DieValue }
  | { readonly kind: "take-workers" };
export interface DieAdjustment {
  readonly workersSpent: number;
  readonly steps: readonly (1 | -1)[];
  /** Monastery modifiers need separate validation; this identifier never grants permission by itself. */
  readonly monasteryNumber?: MonasteryNumber;
}
export type GameAction =
  | { readonly type: "buy-workers"; readonly playerId: PlayerId }
  | { readonly type: "advance-phase"; readonly playerId: PlayerId }
  | { readonly type: "roll-round"; readonly playerId: PlayerId }
  | { readonly type: "use-die"; readonly playerId: PlayerId; readonly dieId: DieId; readonly adjustment: DieAdjustment; readonly intent: ActionIntent }
  | { readonly type: "buy-black-tile"; readonly playerId: PlayerId; readonly tileId: TileId; readonly storageSlot: number; readonly discardTileId?: TileId }
  | { readonly type: "use-monastery-six"; readonly playerId: PlayerId; readonly depot: DieValue; readonly tileId: TileId; readonly storageSlot: number; readonly discardTileId?: TileId }
  | { readonly type: "resolve-choice"; readonly playerId: PlayerId; readonly choiceId: string; readonly optionId: string }
  | { readonly type: "end-turn"; readonly playerId: PlayerId }
  | { readonly type: "extension"; readonly extensionId: ExtensionId; readonly playerId: PlayerId; readonly command: string; readonly payload: JsonValue };
/** Options/effects will be produced by a future verified resolver, never by UI assertions. */
export interface PendingChoice {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly source: RuleSource;
  readonly options: readonly { readonly id: string; readonly label: string; readonly payload: JsonValue }[];
}
export interface PendingEffect {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly source: RuleSource;
  readonly kind: "tile-benefit" | "extra-action" | "region-scoring" | "color-bonus" | "phase-income" | "extension";
  readonly payload: JsonValue;
}
export interface TurnState {
  readonly phase: Phase;
  readonly round: RoundNumber;
  readonly stage: "setup" | "phase-setup" | "round-setup" | "player-turn" | "resolve-effect" | "phase-end" | "final-scoring" | "finished";
  readonly activePlayerId: PlayerId | null;
  readonly orderTrack: readonly TurnOrderSpace[];
  readonly actedPlayerIds: readonly PlayerId[];
  readonly blackPurchaseUsed: boolean;
  readonly monasterySixUsed: boolean;
  readonly pendingEffects: readonly PendingEffect[];
  readonly pendingChoice: PendingChoice | null;
}
export interface PlayerConfig { readonly id: PlayerId; readonly name: string; readonly color?: PlayerColor; readonly seat: number; readonly boardId: string; readonly startingCastleCellId: CellId; readonly controller: "human" | "chateauma" }
export interface ExtensionConfig { readonly id: ExtensionId; readonly options: Readonly<Record<string, JsonValue>> }
export interface GameConfig {
  readonly ruleset: "special-edition-base";
  readonly mode: "competitive" | "team" | "solo" | "chateauma";
  /** Base competitive mode is 2-4; future solo adapters must validate their own counts. */
  readonly playerCount: 1 | 2 | 3 | 4;
  readonly players: readonly PlayerConfig[];
  readonly seed: string;
  readonly catalogId: string;
  readonly startingPlayerId?: PlayerId;
  /** Slot geometry provenance only; does not certify the tile catalog. */
  readonly marketRecipeId?: "se:main:2" | "se:main:3-4";
  readonly extensions: readonly ExtensionConfig[];
}
export type ScoreCategory = "livestock" | "building" | "region-size" | "phase-bonus" | "color-bonus" | "goods-sale" | "remaining-goods" | "remaining-silver" | "remaining-workers" | "monastery" | "extension";
export interface ScoreEntry {
  readonly id: string;
  readonly category: ScoreCategory;
  readonly points: number;
  readonly source: RuleSource;
  readonly tileId?: TileId;
  readonly regionId?: string;
  readonly extensionId?: ExtensionId;
}
export interface ScoreBreakdown {
  readonly playerId: PlayerId;
  /** Already earned points vs projected end-game additions; calculateScore must not mutate either. */
  readonly earned: readonly ScoreEntry[];
  readonly finalAdditions: readonly ScoreEntry[];
  readonly earnedTotal: number;
  readonly finalAdditionsTotal: number;
  readonly total: number;
}
export interface GameState {
  readonly schemaVersion: "0.2.1";
  readonly revision: number;
  readonly config: GameConfig;
  readonly status: "setup" | "playing" | "finished";
  readonly players: readonly PlayerState[];
  readonly tiles: Readonly<Record<TileId, Tile>>;
  readonly market: MarketState;
  readonly dice: DiceState;
  readonly turn: TurnState;
  readonly scoreLedger: Readonly<Record<PlayerId, readonly ScoreEntry[]>>;
  /** Serializable randomness; optional core runtime uses counter-v1 (core/random.ts). */
  readonly random: { readonly seed: string; readonly cursor: number };
  readonly extensionStates: Readonly<Partial<Record<ExtensionId, JsonValue>>>;
  readonly finalScores: readonly ScoreBreakdown[] | null;
}
