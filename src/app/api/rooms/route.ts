import { roomHandlers } from "../../../server/room-http";
export async function POST(request:Request){return roomHandlers().create(request);}
