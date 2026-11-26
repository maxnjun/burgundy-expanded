import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDir="public", output=path.join(publicDir,"_art");
const generated="src/app/runtime-assets.generated";
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const cacheDir=".next/cache/runtime-assets";
const families=["assets/audio","assets/effects","assets/goods","assets/icons","assets/textures",
 "assets/tiles/animals/final","assets/tiles/beige/final","assets/tiles/monastery/final",
 "assets/tokens/estate","assets/vineyards","shields","tiles/illustrations"];
const files=(await Promise.all(families.map(async family=>(await readdir(`${publicDir}/${family}`,{withFileTypes:true,recursive:true}))
 .filter(entry=>entry.isFile()&&/\.(png|svg|wav|webp)$/.test(entry.name)&&!/^_/.test(entry.name))
 .map(entry=>path.relative(publicDir,path.join(entry.parentPath,entry.name)).replaceAll("\\","/"))))).flat()
 .filter(file=>!file.startsWith("assets/icons/source/")&&!file.startsWith("assets/tokens/estate/numerals/")).sort();
await mkdir(output,{recursive:true});
await mkdir(cacheDir,{recursive:true});

// Only encode files once per build cache. Every candidate is verified, including invisible RGB under alpha=0.
const urls={}, sizes={};
const unique=new Map();
let next=0;
await Promise.all(Array.from({length:4},async()=>{
 for(let index;(index=next++)<files.length;){
  const file=files[index],source=await readFile(`${publicDir}/${file}`),original=hash(source);
  let conversion=unique.get(original);
  if(!conversion){
   conversion=optimize(file,source,original);
   unique.set(original,conversion);
  }
  const {url,bytes}=await conversion;
  urls["/"+file]=url;
  sizes[file]={source:source.length,served:bytes,format:path.extname(url).slice(1)};
 }
}));
const ordered=Object.fromEntries(files.map(file=>["/"+file,urls["/"+file]]));
await writeFile(generated+".json",JSON.stringify(ordered,null,2)+"\n");
const cssTextures=["alpine-landscape","map-landscape","royal-landscape","terrain-castle","terrain-mine","cartography","parchment","wood"];
const textureRules=cssTextures.map(name=>{
 const entry=Object.keys(ordered).find(file=>file.startsWith("/assets/textures/")&&path.basename(file,path.extname(file))===name);
 assert(entry,`Missing texture ${name}`);
 return `  --art-${name}: url('${ordered[entry]}');`;
});
await writeFile(generated+".css",`:root {\n${textureRules.join("\n")}\n}\n`);
const totals=Object.entries(sizes).reduce((total,[file,m])=>({
 original:total.original+m.source,served:total.served+m.served,
 converted:total.converted+Number(file.endsWith(".png")&&m.format==="webp"),
}),{original:0,served:0,converted:0});
console.log(JSON.stringify({runtimeAssets:files.length,...totals}));
if(process.argv.includes("--report"))await writeFile(".local-data/traffic/assets.json",JSON.stringify({totals,files:sizes},null,2));

function hasUnmappedColor(source){
 // PNG may attach color coordinates to otherwise untagged pixels. Keep those PNGs if WebP cannot carry the same metadata.
 const tags=new Set();
 for(let index=8;index+12<=source.length;){
  const tag=source.toString("ascii",index+4,index+8);
  if(tag==="IDAT")break;
  tags.add(tag);index+=12+source.readUInt32BE(index);
 }
 return (tags.has("gAMA")||tags.has("cHRM"))&&!tags.has("sRGB")&&!tags.has("iCCP");
}

async function optimize(file,source,original){
 let ext=path.extname(file),bytes=source;
 if(ext===".png"&&!hasUnmappedColor(source)){
  const image=sharp(source),meta=await image.metadata();
  if(meta.depth==="uchar"&&(!meta.pages||meta.pages===1)&&(!meta.orientation||meta.orientation===1)){
   const cached=path.join(cacheDir,`exact-3-${sharp.versions.webp}-${original}`);
   let webp=await readFile(cached).catch(error=>{if(error.code!=="ENOENT")throw error;return null;});
   if(webp===null){
    const candidate=await image.clone().keepIccProfile().webp({lossless:true,exact:true,effort:3}).toBuffer();
    if(candidate.length<source.length){
     const before=await image.ensureAlpha().raw().toBuffer();
     const after=await sharp(candidate).ensureAlpha().raw().toBuffer({resolveWithObject:true});
     if(after.info.width===meta.width&&after.info.height===meta.height&&before.equals(after.data))webp=candidate;
    }
    await writeFile(cached,webp??Buffer.alloc(0));
   }
   if(webp?.length>0&&webp.length<source.length){ext=".webp";bytes=webp;}
  }
 }
 const url=`/_art/${hash(bytes)}${ext}`,destination=publicDir+url;
 const existing=await stat(destination).catch(error=>{if(error.code!=="ENOENT")throw error;return null;});
 if(existing?.size!==bytes.length)await writeFile(destination,bytes);
 return {url,bytes:bytes.length};
}
