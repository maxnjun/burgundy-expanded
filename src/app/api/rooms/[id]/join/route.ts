import { body, respond, rooms } from "../../../../../server/room-http";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return respond(async()=>rooms.joinRoom((await context.params).id,(await body(request)).name));}
