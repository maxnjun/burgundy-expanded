import { body, respond, rooms } from "../../../server/room-http";
export async function POST(request:Request){return respond(async()=>rooms.create((await body(request)).name));}
