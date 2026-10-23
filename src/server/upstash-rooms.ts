import {RoomError} from "./room-error";

// Atomic compare-and-set also protects against overlapping old/new Render processes.
export const SAVE_ROOM_SCRIPT=`local old = redis.call('GET', KEYS[1])
if ARGV[2] == 'new' then
  if old then return 0 end
elseif not old or cjson.decode(old).game.revision ~= tonumber(ARGV[2]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
return 1`;

const unavailable=()=>new RoomError(503,"무료 외부 방 저장소에 연결할 수 없거나 사용 한도에 도달했습니다. 잠시 후 다시 시도하세요. 완료 여부는 재연결 후 최신 상태에서 확인하세요.","ROOM_STORAGE_UNAVAILABLE");
export class UpstashRooms {
  constructor(private url:string,private token:string,private namespace:string,private request:typeof fetch=fetch){
    const endpoint=new URL(url);
    if(endpoint.protocol!=="https:"||!endpoint.hostname.endsWith(".upstash.io")||endpoint.port||endpoint.pathname!=="/"||endpoint.search||endpoint.hash||endpoint.username||endpoint.password||!token.trim()||!/^[-a-z0-9]{1,40}$/.test(namespace))throw Error("Invalid Upstash room storage configuration");
  }
  private key(id:string){if(!/^[a-f0-9]{24}$/.test(id))throw new RoomError(404,"방을 찾을 수 없습니다.");return `burgundy:${this.namespace}:room:${id}`;}
  private async command(args:(string|number)[]):Promise<unknown>{
    try{
      const response=await this.request(this.url,{method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},body:JSON.stringify(args),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10_000)});
      if(!response.ok)throw Error();
      const data=await response.json();if(!data||typeof data!=="object"||"error" in data||!("result" in data))throw Error();
      return data.result;
    }catch{throw unavailable();} // Never expose provider errors, credentials or full room data.
  }
  async read(id:string){const raw=await this.command(["GET",this.key(id)]);if(raw!==null&&typeof raw!=="string")throw unavailable();return raw as string|null;}
  async write(id:string,raw:string,revision:number|null){
    const result=await this.command(["EVAL",SAVE_ROOM_SCRIPT,1,this.key(id),raw,revision===null?"new":revision]);
    if(result===0)throw new RoomError(409,"다른 행동이 먼저 반영되었습니다. 최신 상태에서 다시 선택하세요.");
    if(result!==1)throw unavailable();
  }
  async check(){if(await this.command(["PING"])!=="PONG")throw unavailable();}
}

export function remoteRooms(env:Readonly<Record<string,string|undefined>>=process.env){
  if(!env.BURGUNDY_STORAGE||env.BURGUNDY_STORAGE==="file")return undefined;
  if(env.BURGUNDY_STORAGE!=="upstash")throw Error("Unknown room storage mode");
  return new UpstashRooms(env.UPSTASH_REDIS_REST_URL||"",env.UPSTASH_REDIS_REST_TOKEN||"",env.BURGUNDY_ROOM_NAMESPACE||"");
}
