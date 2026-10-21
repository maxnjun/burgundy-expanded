import {connection} from "next/server";
import {serverRelease} from "../../../server/release";
export async function GET(){await connection();return Response.json(serverRelease(),{headers:{"Cache-Control":"no-store"}});}
