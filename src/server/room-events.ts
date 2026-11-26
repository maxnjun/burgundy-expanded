import type {RoomView} from "./rooms";

type ReadCommittedView=(token:string)=>RoomView;
/** The production WebSocket server installs this bus in the same Node process. */
export function roomChanged(id:string,readView?:ReadCommittedView){
 (globalThis as typeof globalThis & {burgundyRoomEvents?:{emit:(event:string,id:string,readView?:ReadCommittedView)=>void}}).burgundyRoomEvents?.emit("room",id,readView);
}
