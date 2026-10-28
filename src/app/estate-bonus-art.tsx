import type {BonusTile} from '../game/types';
import manifest from '../../public/assets/tokens/estate/manifest.json';

export const BONUS_NAMES={castle:'성',mine:'광산',ship:'선박',livestock:'동물',building:'도시',monastery:'수도원'};
export function EstateBonusArt({bonus,size=60,x=0,y=0}:{bonus:BonusTile;size?:number;x?:number;y?:number}){
 const asset=manifest.assets.find(a=>a.color===bonus.color&&a.points===bonus.points);
 const label=`${BONUS_NAMES[bonus.color]} ${bonus.points}점 · ${bonus.rank==='first'?'1위':'2위'} 영지 완성 보상`;
 return <svg x={x} y={y} width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-label={label} data-estate-bonus-art={`${bonus.color}:${bonus.points}`} data-bonus-rank={bonus.rank}>
  <title>{label}</title>
  {asset?<image href={`/assets/tokens/estate/${asset.file}?v=${asset.sha256.slice(0,12)}`} width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>:<text x="512" y="540" textAnchor="middle" fontSize="180" fill="#49361c">{bonus.points}점</text>}
 </svg>;
}
