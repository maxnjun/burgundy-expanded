import { respond, rooms, token } from "../../../../server/room-http";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return respond(async()=>rooms.view((await context.params).id,token(request)));}
