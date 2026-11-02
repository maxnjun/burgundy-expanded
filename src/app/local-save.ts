const gameKey='burgundy-expanded:local-v1',historyKey='burgundy-expanded:turn-history-v1';
export type LocalSave={text:string|null;history:string|null};
let native: {read:()=>Promise<LocalSave>;write:(save:LocalSave)=>Promise<void>}|undefined;
let writes=Promise.resolve();
export function configureNativeSave(store:typeof native){native=store;}
export async function readLocalSave(){
  await writes.catch(()=>{});
  const committed=await native?.read();
  if(committed?.text!=null)return committed;
  return {text:localStorage.getItem(gameKey),history:localStorage.getItem(historyKey)};
}
/** One committed save contains its matching Undo; browser keys remain compatible caches. */
export function writeLocalSave(text:string,history:string):Promise<void>{
  writes=writes.catch(()=>{}).then(async()=>{
    if(native)await native.write({text,history});
    try{localStorage.setItem(historyKey,history);localStorage.setItem(gameKey,text);}
    catch(error){if(!native)throw error;}
  });
  return writes;
}
