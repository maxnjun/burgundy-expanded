import { roomHandlers } from "../../../../../server/room-http";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return roomHandlers().act(request,(await context.params).id);}
