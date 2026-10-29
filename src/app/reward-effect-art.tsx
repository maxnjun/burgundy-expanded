import type {SVGProps} from 'react';
import manifest from '../../public/assets/effects/manifest.json';

export type RewardEffect = keyof typeof manifest.rewardMap;

/** Approved complete effect illustrations; both boards use the same files. */
export function RewardEffectArt({effect,label,compact=false,fullCanvas=false,...props}:SVGProps<SVGSVGElement>&{effect:RewardEffect;label:string;compact?:boolean;fullCanvas?:boolean}){
 const key=manifest.rewardMap[effect] as keyof typeof manifest.assets;
 const asset=compact&&(key==='market'||key==='building')?manifest.assets[`${key}-compact`]:manifest.assets[key];
 const [left,top,right,bottom]=asset.alphaBounds;
 return <svg {...props} className={`reward-effect-art ${props.className??''}`} data-reward-effect={effect} data-effect-asset={asset.file} role="img" aria-label={label} pointerEvents="none" viewBox={fullCanvas?`0 0 ${asset.canvas.join(' ')}`:`${left} ${top} ${right-left} ${bottom-top}`} preserveAspectRatio="xMidYMid meet"><title>{label}</title><image href={`/assets/effects/${asset.file}?v=${asset.sha256.slice(0,12)}`} width={asset.canvas[0]} height={asset.canvas[1]} preserveAspectRatio="xMidYMid meet"/></svg>;
}

/** Match the approved radius-91 review at the existing board's radius. */
export function VineyardRewardArt({effect,label,x,y,radius,compact}:{effect:RewardEffect;label:string;x:number;y:number;radius:number;compact:boolean}){
 const fullCanvas=['church','market','carpenters-workshop','black-get','vine-get','town-hall'].includes(effect);
 const [w,h]=fullCanvas?[160,100]:effect==='warehouse'?[94,98]:effect==='boarding-house'?[55.5,76]:effect==='bank'?[80,40]:[110,110];
 const width=w*radius/91,height=h*radius/91;
 return <RewardEffectArt effect={effect} label={label} compact={compact} fullCanvas={fullCanvas} x={x-width/2} y={y-height/2} width={width} height={height}/>;
}
