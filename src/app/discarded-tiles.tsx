import type {PhaseDiscardedTiles,Tile} from '../game/types';
import {getTileHelp,tileHelpId} from '../game/tile-help';
import {FRUIT_NAMES} from './vineyard-art';
import {VINE_TILES} from '../game/vineyards';
import {TileArt} from './tile-art';
import {VineTile} from './vineyard-board';

export function DiscardedTiles({history=[],tiles}:{history?:readonly PhaseDiscardedTiles[];tiles:Readonly<Record<string,Tile>>}){
 const total=history.reduce((n,p)=>n+p.tileIds.length+p.vineyardTileIds.length,0);
 return <details className="panel compact-log discarded-tiles" aria-label="버려진 타일">
  <summary>버려진 타일 · 총 {total}개</summary>
  <div className="discarded-history">
   {total===0&&<p className="discarded-empty">아직 버려진 타일이 없습니다.</p>}
   {history.map(p=><section data-discard-phase={p.phase} key={p.phase} aria-label={`${p.phase} 페이즈 버려진 타일`}>
    <h3>{p.phase} 페이즈 — {p.tileIds.length+p.vineyardTileIds.length}개</h3>
    <div className="discarded-tile-list">
     {p.tileIds.map(id=>{const tile=tiles[id];if(!tile)return null;const label=getTileHelp(tileHelpId(tile))?.name??tile.type;return <figure className="discarded-tile" data-discarded-tile={id} key={id} title={label} draggable={false}><TileArt tile={tile} aria-label={label}/></figure>;})}
     {p.vineyardTileIds.map(id=><figure className="discarded-tile discarded-vine" data-discarded-vine={id} key={id} title={VINE_TILES[id]?.map(g=>FRUIT_NAMES[g]).join(' · ')} draggable={false}><VineTile id={id} connected/></figure>)}
    </div>
   </section>)}
  </div>
 </details>;
}
