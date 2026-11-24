import {purchaseBlocked} from '../purchases';
import {hasShield} from '../shields';
import type {GameAction,GameState,JsonValue,PlayerState} from '../types';
import {discardStored,keyOccupant} from '../vineyards';
import {destinationIssue} from './intents';

type CustomAction=Extract<GameAction,{type:'extension'}>;
type Target={tileId:string;ownerId?:string;storageSlot?:number;discardTileId?:string};
export const customShieldCommands=['reserve-tile','cancel-reservation','buy-rival-tile','discard-storage'];
export const sharedSupplyIds=(game:Pick<GameState,'market'>)=>[
 ...game.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])),
 ...game.market.blackDepot.filter((id):id is string=>id!==null),
];
export function mayTakeSupply(game:GameState,playerId:string,tileId:string){
 return !Object.entries(game.tileReservations??{}).some(([id,r])=>id!==playerId&&r.phase===game.turn.phase&&r.tileId===tileId);
}
export function validTileReservations(game:GameState){
 if(game.tileReservations===undefined)return true;
 if(!game.config.customRules||!game.tileReservations||Array.isArray(game.tileReservations)||typeof game.tileReservations!=='object')return false;
 const marked=new Set<string>(),supply=sharedSupplyIds(game);
 return Object.entries(game.tileReservations).every(([id,r])=>{
  if(!game.players.some(p=>p.id===id)||!r||r.phase!==game.turn.phase)return false;
  if(r.tileId===null)return true;
  if(!hasShield(game,id,20)||!supply.includes(r.tileId)||marked.has(r.tileId))return false;
  marked.add(r.tileId);
  return true;
 });
}
export function settleTileReservations(game:GameState):GameState{
 if(!game.tileReservations)return game;
 const supply=sharedSupplyIds(game);
 return {...game,tileReservations:Object.fromEntries(Object.entries(game.tileReservations).map(([id,r])=>[id,
  r.tileId&&(!supply.includes(r.tileId)||!hasShield(game,id,20))?{...r,tileId:null}:r]))};
}

export function customShieldIssue(game:GameState,player:PlayerState,action:CustomAction){
 if(!game.config.customRules)return 'Custom actions require a new game';
 const p=action.payload as Target|null,id=player.id,reservation=game.tileReservations?.[id];
 if(action.command==='cancel-reservation')return hasShield(game,id,20)&&reservation?.tileId?null:'No reserved tile';
 if(!p||typeof p.tileId!=='string')return 'Choose a tile';
 if(action.command==='reserve-tile')return hasShield(game,id,20)&&!reservation&&sharedSupplyIds(game).includes(p.tileId)&&mayTakeSupply(game,id,p.tileId)?null:'Tile unavailable for reservation';
 if(action.command==='discard-storage')return player.storage.includes(p.tileId)||player.vineyardReserve?.some(r=>r.tileId===p.tileId)?null:'Choose a stored tile';
 const owner=game.players.find(o=>o.id!==id&&o.id===p.ownerId);
 if(!hasShield(game,id,21)||purchaseBlocked(game,id)||player.silver<2||!owner?.storage.includes(p.tileId))return 'Rival tile purchase unavailable';
 return destinationIssue(player,{storageSlot:p.storageSlot??-1,discardTileId:p.discardTileId});
}

export function customShieldActions(game:GameState,player:PlayerState,destinations:readonly {storageSlot:number;discardTileId?:string}[]):GameAction[]{
 if(!game.config.customRules||game.turn.stage!=='player-turn'||game.turn.activePlayerId!==player.id||game.turn.pendingChoice||game.turn.pendingEffects.length)return [];
 const action=(command:string,payload:JsonValue):CustomAction=>({type:'extension',extensionId:'shields',command,playerId:player.id,payload});
 const r=game.tileReservations?.[player.id];
 const reserved=hasShield(game,player.id,20)?r?.tileId?[action('cancel-reservation',null)]:r?[]:
  sharedSupplyIds(game).filter(id=>mayTakeSupply(game,player.id,id)).map(tileId=>action('reserve-tile',{tileId})):[];
 const transfers=hasShield(game,player.id,21)&&!purchaseBlocked(game,player.id)&&player.silver>=2
  ?game.players.filter(p=>p.id!==player.id).flatMap(p=>p.storage.flatMap(tileId=>tileId?destinations.map(to=>action('buy-rival-tile',{ownerId:p.id,tileId,...to})):[])):[];
 const discards=player.storage.filter((id):id is string=>!!id).concat((player.vineyardReserve??[]).map(r=>r.tileId));
 return [...reserved,...transfers,...discards.map(tileId=>action('discard-storage',{tileId}))];
}

export function applyCustomShieldAction(game:GameState,player:PlayerState,action:CustomAction):GameState{
 const p=action.payload as Target,id=player.id;
 if(action.command==='reserve-tile'||action.command==='cancel-reservation')return {...game,tileReservations:{...game.tileReservations,[id]:{phase:game.turn.phase,tileId:action.command==='reserve-tile'?p.tileId:null}}};
 if(action.command==='discard-storage')return discardStored(game,id,[p.tileId]);
 const n=p.discardTileId?discardStored(game,id,[p.discardTileId]):game;
 return {...n,players:n.players.map(x=>x.id===id?{...x,silver:x.silver-2,storage:x.storage.map((tile,i)=>i===p.storageSlot?p.tileId:tile)}:
  x.id===p.ownerId?{...x,silver:x.silver+2,storage:x.storage.map(tile=>tile===p.tileId?null:tile)}:x),
  turn:{...n.turn,blackPurchaseUsed:true}};
}

export function storageDestinations(player:PlayerState){
 const empty=player.storage.some((_,i)=>!keyOccupant(player,i));
 return player.storage.map((_,storageSlot)=>({storageSlot,...(keyOccupant(player,storageSlot)&&!empty?{discardTileId:keyOccupant(player,storageSlot)!}:{})}));
}
