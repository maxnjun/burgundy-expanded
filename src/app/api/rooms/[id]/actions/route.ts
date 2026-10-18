import { body, respond, rooms, token } from "../../../../../server/room-http";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return respond(async()=>{const data=await body(request);return rooms.act((await context.params).id,token(request),data.revision,data.action);});}
