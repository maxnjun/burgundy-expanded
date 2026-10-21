import {connection} from "next/server";
import {rooms} from "../../../server/room-http";
import {serverRelease} from "../../../server/release";
export async function GET(){await connection();try{await rooms.checkStorage();return Response.json({status:"ok",...serverRelease()},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({status:"storage-unavailable",...serverRelease()},{status:503,headers:{"Cache-Control":"no-store"}});}}
