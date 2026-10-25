/** Rebuild only the two approved replacements; RGB always comes from the approved originals. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const read=path=>readFile(path),digest=b=>createHash('sha256').update(b).digest('hex');
const standard=JSON.parse(await read('src/app/tile-standard.json')),review=JSON.parse(await read('asset-inbox/castle-mine-approved/manifest.json'));
const manifestPath='public/tiles/illustrations/manifest.json',manifest=JSON.parse(await read(manifestPath)),size=standard.rasterCanvas;
const check=process.argv.includes('--check'),report={},outputs=new Map();
for(const[name,s]of Object.entries(review.assets)){
 assert.ok(['castle','mine'].includes(name));const original=await read(s.source),matte=await read(s.matte);assert.equal(digest(original),s.sourceSha256,'Changed source: review new contours first');assert.equal(digest(matte),s.matteSha256);
 const {data:rgb,info}=await sharp(original).removeAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info;assert.equal(w,review.canvas);assert.equal(h,review.canvas);
 const aiAlpha=await sharp(matte).greyscale().raw().toBuffer(),outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let end=0;
 const background=i=>{const r=rgb[3*i],g=rgb[3*i+1],b=rgb[3*i+2];return Math.max(r,g,b)-Math.min(r,g,b)<36&&Math.max(r,g,b)>54;};
 function visit(i){if(!outside[i]&&background(i)){outside[i]=1;queue[end++]=i;}}
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 for(let start=0;start<end;start++){const i=queue[start],x=i%w;if(x)visit(i-1);if(x<w-1)visit(i+1);if(i>=w)visit(i-w);if(i<w*(h-1))visit(i+w);}
 const mask=await sharp(Buffer.from(`<svg width="${w}" height="${h}"><polygon points="${s.innerContour.map(p=>p.join(',')).join(' ')}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
 const full=Buffer.alloc(w*h*4);let visible=0;
 for(let i=0;i<w*h;i++){if(mask[4*i+3])assert.equal(outside[i],0,'Exterior extraction entered the approved interior');const a=outside[i]?0:mask[4*i+3]?255:aiAlpha[i]>250?255:aiAlpha[i];if(a){rgb.copy(full,i*4,i*3,i*3+3);full[i*4+3]=a;visible++;}}
 assert.ok(visible>w*h*.4&&visible<w*h*.75,'Inspect changed outer silhouette');
 const raw=await sharp(full,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 const decoded=await sharp(raw).raw().toBuffer();let mismatches=0;for(let i=0;i<w*h;i++)if(decoded[4*i+3])for(let c=0;c<3;c++)if(decoded[4*i+c]!==rgb[3*i+c])mismatches++;assert.equal(mismatches,0,'Approved source RGB changed');
 const art=Buffer.alloc(full.length);let support=0,retained=0;
 const cx=s.innerContour.reduce((n,p)=>n+p[0],0)/6,cy=s.innerContour.reduce((n,p)=>n+p[1],0)/6;
 const normals=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3),Math.sin(i*Math.PI/3)]);
 for(let i=0;i<w*h;i++)if(mask[4*i+3]){assert.equal(full[4*i+3],255,'Background mask must not cut the approved interior');full.copy(art,4*i,4*i,4*i+3);art[4*i+3]=mask[4*i+3];retained++;const x=i%w+.5-cx,y=Math.floor(i/w)+.5-cy;for(const[nx,ny]of normals)support=Math.max(support,nx*x+ny*y);}
 const scale=(Math.sqrt(3)*size/4*(1-2*standard.frameInset/100)-3)/support;
 const isolated=await sharp(art,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 const output=await sharp(Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:image/png;base64,${isolated.toString('base64')}" width="${w}" height="${h}" transform="translate(${size/2-cx*scale} ${size/2-cy*scale}) scale(${scale})"/></svg>`)).png().toBuffer();
 const luminance=c=>.2126*c[0]+.7152*c[1]+.0722*c[2],hex=c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join(''),colors=[];
 for(let i=0;i<w*h;i++)if(full[i*4+3]===255&&!mask[i*4+3]){const c=[rgb[i*3],rgb[i*3+1],rgb[i*3+2]];if(name==='castle'?c[1]>c[0]*1.1&&c[1]>c[2]*1.1:Math.max(...c)-Math.min(...c)<40)colors.push(c);}
 colors.sort((a,b)=>luminance(a)-luminance(b));assert.ok(colors.length>1000);const palette={dark:hex(colors[Math.floor(colors.length*.05)]),base:hex(colors[Math.floor(colors.length*.5)]),light:hex(colors[Math.floor(colors.length*.995)])};
 const surface=s.surfacePoints.map(([x,y])=>{const samples=[];for(let j=y-7;j<=y+7;j++)for(let i=x-7;i<=x+7;i++)samples.push([...rgb.subarray((j*w+i)*3,(j*w+i)*3+3)]);samples.sort((a,b)=>luminance(a)-luminance(b));return hex(samples[Math.floor(samples.length/2)]);});
 manifest.assets[name]={sourceSha256:digest(raw),outputSha256:digest(output),palette,surface,innerContour:s.innerContour,isotropicFitScale:scale,measuredContourCenter:[cx,cy]};
 outputs.set(`public/tiles/${name}.png`,raw);outputs.set(`public/tiles/illustrations/${name}.png`,output);
 report[name]={input:w+'x'+h,rawTransparentPixels:w*h-visible,retainedPixels:retained,sourceRGBMismatches:mismatches,output:size+'x'+size,scale,palette};
}
outputs.set(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
for(const[path,bytes]of outputs)if(check)assert.deepEqual(await read(path),bytes,`Rebuild required: ${path}`);else await writeFile(path,bytes);
console.log(JSON.stringify({check,...report},null,2));
