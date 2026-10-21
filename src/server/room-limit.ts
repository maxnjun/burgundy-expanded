import {RoomError} from "./rooms";
const root=globalThis as typeof globalThis & {burgundyLimits?:Map<string,{count:number;until:number}>};
const limits=root.burgundyLimits??=new Map();
export function roomLimit(request:Request,kind:string,max:number){
 if(process.env.NODE_ENV!=="production")return;
 const ip=process.env.TRUST_PROXY==="1"?request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim():"direct";
 const key=`${kind}:${ip?.slice(0,80)??"unknown"}`,now=Date.now(),old=limits.get(key);
 if(!old||old.until<now){for(const [k,v] of limits)if(v.until<now)limits.delete(k);if(limits.size>=4096)throw new RoomError(429,"잠시 후 다시 시도하세요.");limits.set(key,{count:1,until:now+60_000});}
 else if(++old.count>max)throw new RoomError(429,"요청이 많습니다. 잠시 후 다시 시도하세요.");
}
