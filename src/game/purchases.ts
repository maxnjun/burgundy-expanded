import type {DieValue,GameState,TurnState} from './types';

// Legacy saves may record a worker purchase only in monasterySixUsed.
export const purchaseUsed=(turn:Pick<TurnState,'blackPurchaseUsed'|'monasterySixUsed'>)=>turn.blackPurchaseUsed||turn.monasterySixUsed;
export const numberedPurchaseTile=(state:Pick<GameState,'tiles'|'market'>,depot:DieValue,tileId:string)=>!!state.tiles[tileId]&&!!state.market.numberedDepots.find(d=>d.number===depot)?.slots.some(s=>s.tileId===tileId);
