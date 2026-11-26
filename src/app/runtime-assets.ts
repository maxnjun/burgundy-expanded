import assets from "./runtime-assets.generated.json";

export function assetUrl(source:string){
  return (assets as Readonly<Record<string,string>>)[source]??source;
}
