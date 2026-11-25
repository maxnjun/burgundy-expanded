"use client";
import {useState} from 'react';
import type {BoardTarget} from '../game/direct-actions';
import type {GameAction,PlayerState,Tile} from '../game/types';
import {TERRAIN_NAMES} from '../game/core/territory';
import {customShieldCommands} from '../game/core/custom-actions';
import {TileArt,GoodsArt} from './tile-art';
import {VineTile} from './vineyard-board';

type Option={action:GameAction;target:BoardTarget;label?:string};
type Extension=Extract<GameAction,{type:'extension'}>;
type TileOption={tileId:string;ownerId?:string;storageSlot?:number;discardTileId?:string};
const command=(a:GameAction)=>a.type==='extension'?a.command:'';
const sizes=(items:readonly number[])=>items.length?items.map(n=>`${n}칸`).join(' + '):'0칸';
export const isCustomBoardAction=({action,target}:Option)=>!!(target.recolor||target.goodsDiscardType||target.storageDiscardId||
 action.type==='extension'&&action.extensionId==='shields'&&customShieldCommands.includes(action.command));
export const extensionPair=(a:GameAction)=>a.type==='extension'&&(a.payload as {dieIds?:[string,string]}|null)?.dieIds?.join('|')||'';
export function ShieldDicePair({actions,dice,selected,onSelect}:{actions:readonly GameAction[];dice:readonly {id:string;value:number}[];selected:string;onSelect:(value:string)=>void}){
 const pairs=[...new Set(actions.map(extensionPair).filter(Boolean))];
 if(pairs.length<2)return null;
 return <label>방패 획득 주사위 두 개 <select aria-label="방패 획득 주사위 두 개" value={pairs.includes(selected)?selected:pairs[0]} onChange={e=>onSelect(e.target.value)}>
  {pairs.map(pair=><option key={pair} value={pair}>{pair.split('|').map(id=>{const i=dice.findIndex(d=>d.id===id);return `${i+1}번 (눈 ${dice[i].value})`;}).join(' + ')}</option>)}
 </select></label>;
}
function optionTile(option:Option):TileOption{
 const a=option.action;
 return a.type==='extension'?(a as Extension).payload as TileOption:{tileId:option.target.storageDiscardId??''};
}
export function CustomBoardActions({options,players,tiles,actor,revision,onAction,reserveMode,onReserve,tileName,cellId,onCell,recolorMode,onRecolor}:{
 options:readonly Option[];players:readonly PlayerState[];tiles:Readonly<Record<string,Tile>>;actor:PlayerState;revision:number;
 onAction:(a:GameAction)=>void;reserveMode:boolean;onReserve:(open:boolean)=>void;tileName:(id:string)=>string;cellId:string;onCell:(id:string)=>void;
 recolorMode:boolean;onRecolor:(open:boolean)=>void;
}){
 const [terrain,setTerrain]=useState(''),[pick,setPick]=useState<{revision:number;kind:string;id:string}|null>(null);
 const recolors=options.filter(o=>o.target.recolor);
 const reservable=options.some(o=>command(o.action)==='reserve-tile'),cancel=options.find(o=>command(o.action)==='cancel-reservation');
 const rivals=options.filter(o=>command(o.action)==='buy-rival-tile');
 const discard=options.filter(o=>command(o.action)==='discard-storage'||o.target.storageDiscardId);
 const forced=discard.some(o=>o.target.storageDiscardId);
 const goods=options.filter(o=>o.target.goodsDiscardType);
 if(!recolors.length&&!reservable&&!cancel&&!rivals.length&&!discard.length&&!goods.length)return null;
 const selected=pick?.revision===revision?pick:null;
 const activeRecolors=recolors.filter(o=>o.target.recolor?.cellId===cellId);
 const recolor=activeRecolors.find(o=>o.target.recolor?.terrain===terrain);
 const preview=recolor?.target.recolor;
 const art=(id:string)=>tiles[id]?<span className="tile illustrated-tile"><TileArt tile={tiles[id]}/></span>:<VineTile id={id}/>;
 const ownName=(id:string)=>tiles[id]?tileName(id):`포도 ${id}`;
 const choose=(kind:string,id:string)=>setPick({revision,kind,id});
 const currentRivals=selected?.kind==='rival'?rivals.filter(o=>optionTile(o).tileId===selected.id):[];
 const selectedDiscard=selected?.kind==='discard'?discard.find(o=>optionTile(o).tileId===selected.id):undefined;
 const selectedGoods=selected?.kind==='goods'?goods.find(o=>String(o.target.goodsDiscardType)===selected.id):undefined;
 const finish=(option:Option)=>{onAction(option.action);setPick(null);setTerrain('');onCell('');onRecolor(false);};
 return <section className="panel custom-board-actions" aria-label="신규 방패와 수도원 행동" data-tile-help-touch-browse={false}>
  {reservable&&<button aria-pressed={reserveMode} onClick={()=>onReserve(!reserveMode)}>{reserveMode?'찜 선택 취소':'방패 20번 · 공용 타일 찜'}</button>}
  {reserveMode&&reservable&&<p role="status">공용보드에서 찜할 번호 타일 또는 검은 타일을 선택하세요.</p>}
  {cancel&&<button onClick={()=>finish(cancel)}>방패 20번 · 찜 취소</button>}
  {!!recolors.length&&<details open={cellId?true:undefined}><summary>수도원 31번 · 빈 영지 칸 색상 변경</summary>
   <button aria-pressed={recolorMode} onClick={()=>onRecolor(!recolorMode)}>{recolorMode?'보드 선택 닫기':'영지에서 빈 칸 선택'}</button>
   <label>변경할 빈 칸 <select aria-label="변경할 빈 영지 칸" value={cellId} onChange={e=>{onCell(e.target.value);setTerrain('');}}>
    <option value="">칸 선택</option>{[...new Set(recolors.map(o=>o.target.recolor!.cellId))].map(id=><option key={id} value={id}>{id} · {TERRAIN_NAMES[actor.duchy.cells.find(c=>c.id===id)!.terrain]} · 눈 {actor.duchy.cells.find(c=>c.id===id)!.number}</option>)}
   </select></label>
   <label>새 지형 <select aria-label="새 영지 색상" disabled={!cellId} value={preview?terrain:''} onChange={e=>setTerrain(e.target.value)}>
    <option value="">색상 선택</option>{activeRecolors.map(({target})=><option key={target.recolor!.terrain} value={target.recolor!.terrain}>{TERRAIN_NAMES[target.recolor!.terrain]}</option>)}
   </select></label>
   {recolor&&preview&&<div className="recolor-preview" role="status"><p>{preview.cellId}칸 · {TERRAIN_NAMES[preview.from]} → {TERRAIN_NAMES[preview.terrain]}</p>
    <p>{TERRAIN_NAMES[preview.from]} {preview.sourceSize}칸 → {sizes(preview.sourceAfter)} · {TERRAIN_NAMES[preview.terrain]} {sizes(preview.previousSizes)} → {preview.size}칸</p>
    <p>미완성으로 전환되는 지역 {preview.reopenedSizes.length}개{preview.reopenedSizes.length>0&&` (${sizes(preview.reopenedSizes)})`} · 기존 지역 완성 점수 {preview.refund}점 반납</p>
    <button onClick={()=>finish(recolor)}>색상 변경 확정</button><button onClick={()=>{onCell('');setTerrain('');onRecolor(false);}}>색상 변경 취소</button>
   </div>}
  </details>}
  {!!rivals.length&&<details><summary>방패 21번 · 상대 저장고 구매</summary>
   {players.filter(p=>p.id!==actor.id).map(p=>{
    const ids=[...new Set(rivals.filter(o=>optionTile(o).ownerId===p.id).map(o=>optionTile(o).tileId))];
    return ids.length>0&&<fieldset key={p.id}><legend>{p.name}의 저장고</legend><div className="custom-tile-options">
     {ids.map(id=><button key={id} aria-label={`${p.name}의 ${ownName(id)} 선택`} aria-pressed={selected?.kind==='rival'&&selected.id===id} onClick={()=>choose('rival',id)}>{art(id)}</button>)}
    </div></fieldset>;
   })}
   {!!currentRivals.length&&<div><p>은화 2개를 공용 은행에 지불합니다. 판매자 보상은 없습니다.</p>
    <div className="custom-tile-options">{currentRivals.filter((o,i)=>optionTile(o).discardTileId||i===0).map(o=>{
     const id=optionTile(o).discardTileId;
     return <button key={optionTile(o).storageSlot} onClick={()=>finish(o)}>{id&&art(id)}{id?`${ownName(id)} 폐기 후 구매`:'구매 확정'}</button>;
    })}<button onClick={()=>setPick(null)}>취소</button></div>
   </div>}
  </details>}
  {!!discard.length&&<details open={forced||undefined}><summary>{forced?'보관 한도 초과 · 폐기할 타일 선택':'보관 타일 폐기'}</summary>
   <div className="custom-tile-options">{discard.map(o=>{const id=optionTile(o).tileId;return <button key={id} aria-label={`${ownName(id)} 폐기 후보`} aria-pressed={selectedDiscard===o} onClick={()=>choose('discard',id)}>{art(id)}</button>;})}</div>
   {selectedDiscard&&<div><button onClick={()=>finish(selectedDiscard)}>타일 폐기 확정</button><button onClick={()=>setPick(null)}>취소</button></div>}
  </details>}
  {!!goods.length&&<fieldset><legend>방패 23번 해제 · 폐기할 상품 종류 선택</legend>
   <div className="custom-tile-options">{goods.map(o=>{const type=o.target.goodsDiscardType!;return <button key={type} aria-label={`${type}번 상품 폐기 후보`} aria-pressed={selectedGoods===o} onClick={()=>choose('goods',String(type))}><GoodsArt value={type}/>{actor.goods.find(g=>g.type===type)?.tiles.length}개</button>;})}</div>
   {selectedGoods&&<div><button onClick={()=>finish(selectedGoods)}>상품 폐기 확정</button><button onClick={()=>setPick(null)}>취소</button></div>}
  </fieldset>}
 </section>;
}
