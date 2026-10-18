import { roomHandlers } from "../../../../server/room-http";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return roomHandlers().view(request,(await context.params).id);}
