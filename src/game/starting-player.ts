import type {DieValue,GameState} from "./types";

export type StarterMethod = "roll" | "manual";
export interface StarterRolls {
  readonly round:number;
  readonly eligible:readonly number[];
  readonly faces:readonly (DieValue|null)[];
  readonly pending:readonly number[];
  readonly winner:number|null;
}

export function prepareStarterRolls(count:number):StarterRolls {
  const seats=Array.from({length:count},(_,i)=>i);
  return {round:1,eligible:seats,faces:seats.map(()=>null),pending:seats,winner:null};
}

export function applyStarterRoll(state:StarterRolls,seat:number,face:DieValue):StarterRolls {
  if(!state.pending.includes(seat))return state;
  const faces=state.faces.map((previous,i)=>i===seat?face:previous);
  const pending=state.pending.filter(i=>i!==seat);
  if(pending.length)return {...state,faces,pending};
  const highest=Math.max(...state.eligible.map(i=>faces[i]!));
  const tied=state.eligible.filter(i=>faces[i]===highest);
  return tied.length===1?{...state,faces,pending,winner:tied[0]}:{round:state.round+1,eligible:tied,faces,pending:tied,winner:null};
}

export function validStarterRolls(value:StarterRolls,count:number):boolean {
  if(!value||!Array.isArray(value.eligible)||!Array.isArray(value.pending)||!Array.isArray(value.faces))return false;
  const {round,eligible,faces,pending,winner}=value;
  const validSeats=(seats:readonly number[])=>new Set(seats).size===seats.length&&seats.every(seat=>Number.isInteger(seat)&&seat>=0&&seat<count);
  return Number.isSafeInteger(round)&&round>=1&&faces.length===count&&faces.every(face=>face===null||Number.isInteger(face)&&face>=1&&face<=6)&&
    validSeats(eligible)&&eligible.length>=2&&validSeats(pending)&&pending.every(seat=>eligible.includes(seat))&&
    eligible.every(seat=>pending.includes(seat)||faces[seat]!==null)&&
    (winner===null?pending.length>0:pending.length===0&&eligible.includes(winner)&&eligible.every(seat=>seat===winner||faces[seat]!<faces[winner]!));
}

// Select the starting player before the first castle or round, without touching game RNG.
export function setStartingPlayer(game:GameState,firstSeat:number):GameState {
  const order=[...game.players.slice(firstSeat),...game.players.slice(0,firstSeat)].map(p=>p.id);
  const starter=order[0];
  return {
    ...game,
    config:{...game.config,startingPlayerId:starter},
    players:game.players.map(p=>({...p,workers:order.indexOf(p.id)+1})),
    turn:{...game.turn,orderTrack:[{position:0,players:order}],activePlayerId:game.status==="setup"?starter:null},
  };
}
