import { rename } from "node:fs/promises";
/** Bounded retry for temporary Windows sharing/access failures; original save stays intact. */
export async function replaceRoomFile(source:string,destination:string,move:typeof rename=rename,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<void>{
 for(let attempt=0;;attempt++){
  try{await move(source,destination);return;}catch(error){
   const code=(error as NodeJS.ErrnoException).code;
   if(attempt>=3||!code||!["EPERM","EBUSY","EACCES"].includes(code))throw error;
   await pause(25*2**attempt);
  }
 }
}
