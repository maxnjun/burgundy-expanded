import type {DieValue,GameState,TurnState} from './types';
import {hasShield} from './shields';

// Legacy saves may record a worker purchase only in monasterySixUsed.
export const purchaseUsed=(turn:Pick<TurnState,'blackPurchaseUsed'|'monasterySixUsed'>)=>turn.blackPurchaseUsed||turn.monasterySixUsed;
export const purchaseBlocked=(state:Pick<GameState,'turn'|'extensionStates'>,playerId:string)=>purchaseUsed(state.turn)&&!hasShield(state,playerId,24);
export const numberedPurchaseTile=(state:Pick<GameState,'tiles'|'market'>,depot:DieValue,tileId:string)=>!!state.tiles[tileId]&&!!state.market.numberedDepots.find(d=>d.number===depot)?.slots.some(s=>s.tileId===tileId);
