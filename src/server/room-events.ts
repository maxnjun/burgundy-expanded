/** The production WebSocket server installs this bus in the same Node process. */
export function roomChanged(id:string){
 (globalThis as typeof globalThis & {burgundyRoomEvents?:{emit:(event:string,id:string)=>void}}).burgundyRoomEvents?.emit("room",id);
}
