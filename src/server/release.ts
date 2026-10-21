import {GAME_VERSION,GAME_PROTOCOL,ROOM_FORMAT} from "../game/release";
export function serverRelease(){return {version:process.env.GAME_VERSION||process.env.RENDER_GIT_COMMIT||GAME_VERSION,protocol:GAME_PROTOCOL,roomFormat:ROOM_FORMAT};}
