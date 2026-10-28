import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// Static SVG brushwork is rasterized once; no live SVG noise filters on the boards.
const directory=new URL('../public/assets/textures/',import.meta.url);
let seed=31;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const n=(max=256)=>+(random()*max).toFixed(2);
const pick=a=>a[Math.floor(random()*a.length)];
const leaf=(x,y,size,color,angle)=>`<path d="M0 0Q${-size} ${-size} 0 ${-size*2}Q${size} ${-size} 0 0M0 0V${-size*1.8}" fill="${color}" stroke="#536337" stroke-opacity=".28" stroke-width=".6" transform="translate(${x} ${y}) rotate(${angle})"/>`;
const wrap=(base,body,wash=true)=>`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".11" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".17"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter><radialGradient id="wash"><stop stop-color="#fff5c5" stop-opacity=".13"/><stop offset=".8" stop-color="#fff5c5" stop-opacity="0"/><stop offset="1" stop-color="#362b15" stop-opacity=".14"/></radialGradient></defs><rect width="256" height="256" fill="${base}"/><g filter="url(#grain)"><rect width="256" height="256" fill="${base}"/>${body}</g>${wash?'<rect width="256" height="256" fill="url(#wash)"/>':''}</svg>`;
const palettes={
 livestock:['#91b94a','#b4d565','#6b993f','#d1dc79'],castle:['#21664c','#2b7e59','#174e43','#65a875'],
 building:['#c3a067','#dfc085','#a98752','#ead4a5'],monastery:['#e3bf4c','#f4d56c','#c79e35','#fce8a1'],
 mine:['#aaa69b','#c6c4b7','#8f918a','#dfdacf'],ship:['#2789ad','#4ca4bd','#17729b','#9bd4dc'],
};
function terrain(type,colors){
 let body='';
 for(let i=0;i<85;i++)body+=`<ellipse cx="${n()}" cy="${n()}" rx="${6+n(24)}" ry="${3+n(12)}" fill="${pick(colors)}" opacity=".3"/>`;
 for(let i=0;i<85;i++){
  const x=n(),y=n(),s=2+n(5);
  if(type==='ship')body+=`<path d="M${x-16} ${y}q8 -4 16 0t18 0" fill="none" stroke="${pick(['#bee4e9','#e0f5e9','#126c96'])}" stroke-width="${.5+n(1.5)}" opacity=".25"/>`;
  else if(type==='mine'||type==='building')body+=`<path d="M${x} ${y}l${s} ${-s*.45} ${s*.7} ${s*.7} ${-s*.4} ${s*.7} ${-s*1.3} ${-.1*s}Z" fill="${pick(colors)}" stroke="#685b43" stroke-opacity=".22" stroke-width=".6"/><path d="M${x+.6} ${y}l${s-1} ${-s*.3}" stroke="#fff4d3" opacity=".5" stroke-width=".8"/>`;
  else if(type==='castle')body+=leaf(x,y,s,pick(colors),n(360));
  else body+=`<path d="M${x} ${y}q-4 -7 -5 -9m5 9q1 -10 4 -12m-4 12v-10" fill="none" stroke="${pick(colors)}" stroke-width="1.1" opacity=".7"/>${i%11===0?`<circle cx="${x+3}" cy="${y-5}" r="1.4" fill="${type==='livestock'?'#fff2b4':'#fff0a3'}"/>`:''}`;
 }
 if(type==='mine')for(let i=0;i<12;i++){const x=n(),y=n();body+=`<path d="M${x} ${y}l5 -2 3 4 7 1m-10 -5 2 -5" fill="none" stroke="#63665f" stroke-width=".7" opacity=".3"/>`;}
 return wrap(colors[0],body);
}
const layerColors=['#27664A','#79A64C','#C1C99A','#E9C66C'];
function vineyard(layer,variant){
 let body='';
 for(let i=0;i<60;i++)body+=`<ellipse cx="${n()}" cy="${n()}" rx="${3+n(15)}" ry="${2+n(8)}" fill="${i%2?'#fff4c2':'#405c31'}" opacity=".065"/>`;
 body+=`<path d="M45 60Q100 8 184 45T218 145Q233 208 170 221T42 176Q20 100 45 60" fill="none" stroke="${layer===4?'#8c813e':'#55713c'}" stroke-width="2" opacity=".55"/>`;
 for(const [x,y,a] of [[65,49,55],[168,42,-20],[218,117,120],[190,206,200],[61,205,250],[36,127,-60]]){
  body+=leaf(x+variant*3,y,8,layer===1?'#6f9b53':'#829d53',a);
  body+=leaf(x+9,y+5,6,'#a6b66b',a+70);
 }
 for(const [x,y] of [[49,159],[197,76]])for(let i=0;i<5;i++)body+=`<circle cx="${x+i%2*5}" cy="${y+Math.floor(i/2)*5}" r="3.2" fill="${layer===4?'#a6975b':'#7c7690'}" opacity=".48"/>`;
 // Leave dice and action labels on quiet paper, particularly on the dark first floor.
 body+=`<defs><radialGradient id="label"><stop stop-color="#f8f0cc" stop-opacity="${layer===1?.96:.8}"/><stop offset=".65" stop-color="#f8f0cc" stop-opacity="${layer===1?.9:.68}"/><stop offset="1" stop-color="#f8f0cc" stop-opacity="0"/></radialGradient></defs><ellipse cx="128" cy="145" rx="102" ry="61" fill="url(#label)"/>`;
 return wrap(layerColors[layer-1],body);
}
function paper(){let body='';for(let i=0;i<600;i++)body+=`<path d="M${n()} ${n()}l${1+n(5)} ${n(2)-1}" stroke="${i%2?'#fff7db':'#96754b'}" stroke-width=".4" opacity=".16"/>`;return wrap('#f4e5bf',body,false);}
function wood(){let body='';for(let i=0;i<90;i++)body+=`<path d="M0 ${n()}q60 ${n(8)-4} 128 0t128 0" fill="none" stroke="${i%2?'#b0824e':'#352214'}" stroke-width="${.4+n(1.5)}" opacity=".45"/>`;return wrap('#6b472c',body,false);}
await mkdir(directory,{recursive:true});
const textures={};
for(const [type,colors] of Object.entries(palettes))textures[`terrain-${type}`]=terrain(type,colors);
for(let layer=1;layer<=4;layer++)for(let variant=0;variant<2;variant++)textures[`vineyard-${layer}-${variant}`]=vineyard(layer,variant);
textures.parchment=paper();textures.wood=wood();
const manifest={version:1,size:256,layerColors,assets:[]};
for(const [name,svg] of Object.entries(textures)){
 const bytes=await sharp(Buffer.from(svg)).webp({quality:88}).toBuffer(),file=`${name}.webp`;
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,256);assert.equal(metadata.height,256);
 manifest.assets.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 if(process.argv.includes('--check'))assert.deepEqual(await readFile(new URL(file,directory)),bytes,file);
 else await writeFile(new URL(file,directory),bytes);
}
const json=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(await readFile(new URL('manifest.json',directory),'utf8'),json);
else await writeFile(new URL('manifest.json',directory),json);
console.log(`${process.argv.includes('--check')?'Verified':'Prepared'} ${manifest.assets.length} static textures (${manifest.assets.reduce((s,a)=>s+a.bytes,0)} bytes); no tile artwork modified.`);
