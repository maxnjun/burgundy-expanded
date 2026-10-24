/** Approved RGB is preserved; only the connected exterior checkerboard is removed. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const check=process.argv.includes('--check'),sha=b=>createHash('sha256').update(b).digest('hex'),assets=[];
const reviewed=JSON.parse(await readFile('public/shields/manifest.json')).assets;
for(let number=1;number<=18;number++){
 const file=`shield-${String(number).padStart(2,'0')}.png`,source=await readFile(`asset-inbox/shield-approved/originals/${file}`),{data,info:{width:w,height:h}}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(sha(source),reviewed.find(a=>a.number===number)?.sourceSha256,`Changed source: review ${file} before extracting`);
 const outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let end=0;
 function visit(i){if(outside[i])return;const c=data.subarray(3*i,3*i+3);if(Math.max(...c)-Math.min(...c)<=16&&Math.max(...c)>45){outside[i]=1;queue[end++]=i;}}
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 for(let start=0;start<end;start++){const i=queue[start],x=i%w;if(x)visit(i-1);if(x<w-1)visit(i+1);if(i>=w)visit(i-w);if(i<w*(h-1))visit(i+w);}
 // The exterior cannot reach the enclosed artwork, including grey coins and cracks.
 for(let y=Math.ceil(h*.25);y<h*.7;y++)for(let x=Math.ceil(w*.3);x<w*.7;x++)assert.equal(outside[y*w+x],0,`Interior damaged: ${file}`);
 const seen=new Uint8Array(w*h);let largest=[];
 for(let i=0;i<w*h;i++)if(!outside[i]&&!seen[i]){let tail=1;queue[0]=i;seen[i]=1;for(let head=0;head<tail;head++){const p=queue[head],x=p%w;for(const n of [x?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<w*(h-1)?p+w:-1])if(n>=0&&!outside[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}if(tail>largest.length)largest=Array.from(queue.subarray(0,tail));}
 assert.ok(largest.length>w*h*.5&&largest.length<w*h*.95,`Inspect silhouette: ${file}`);
 const rgba=Buffer.alloc(w*h*4);let left=w,top=h,right=0,bottom=0;
 for(const i of largest){data.copy(rgba,4*i,3*i,3*i+3);rgba[4*i+3]=255;const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const cropped=await sharp(rgba,{raw:{width:w,height:h,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize({width:1180,height:1460,fit:'inside'}).png().toBuffer(),meta=await sharp(cropped).metadata();
 const x=Math.floor((1200-meta.width)/2),y=Math.floor((1480-meta.height)/2),output=await sharp({create:{width:1200,height:1480,channels:4,background:'#0000'}}).composite([{input:cropped,left:x,top:y}]).png().toBuffer();
 const path=`public/shields/${file}`;if(check)assert.deepEqual(await readFile(path),output,`Rebuild: ${file}`);else await writeFile(path,output);
 assets.push({number,file,sourceSha256:sha(source),outputSha256:sha(output),sourceSize:[w,h],sourceBounds:[left,top,right+1,bottom+1],artBounds:[x,y,x+meta.width,y+meta.height]});
 console.log(`${file}: ${w}x${h} → 1200x1480 RGBA, artwork ${meta.width}x${meta.height}`);
}
const path='public/shields/manifest.json',bytes=Buffer.from(JSON.stringify({canvas:[1200,1480],mapping:'approved-number-1-to-18',assets},null,2)+'\n');if(check)assert.deepEqual(await readFile(path),bytes);else await writeFile(path,bytes);
