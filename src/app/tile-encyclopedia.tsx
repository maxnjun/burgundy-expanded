"use client";
import {useState} from "react";
import {getTileHelp,TILE_HELP_CATEGORIES,TILE_HELP_ENTRIES,SHIELD_MAINTENANCE,type TileHelpKind} from "../game/tile-help";
import {TileHelpArt,TileHelpContent} from "./tile-help-content";

export function TileEncyclopedia(){
 const [category,setCategory]=useState<TileHelpKind|null>(null),[selected,setSelected]=useState<string|null>(null);
 const help=selected?getTileHelp(selected):undefined;
 const entries=TILE_HELP_ENTRIES.filter(h=>h.kind===category);
 return <details open className="tile-encyclopedia panel" data-tile-help-inline aria-label="타일 설명 도감">
  <summary>타일 설명</summary><p>카테고리를 누르면 설명이 표시됩니다. 여러 종류가 있으면 타일을 선택하세요.</p>
  <div className="tile-help-categories" role="group" aria-label="타일 카테고리">{TILE_HELP_CATEGORIES.map(c=><button key={c.kind} type="button" aria-label={`${c.name} 카테고리`} aria-pressed={category===c.kind} onClick={()=>{const next=TILE_HELP_ENTRIES.filter(h=>h.kind===c.kind);setCategory(c.kind);setSelected(next.length===1?next[0].id:null);}}>
   <span className="tile-help-icon"><TileHelpArt help={getTileHelp(c.icon)!} question={c.kind==="shield"}/></span><span>{c.name}</span>
  </button>)}</div>
  {entries.length>1&&<div className="tile-help-list" role="group" aria-label={`${TILE_HELP_CATEGORIES.find(c=>c.kind===category)!.name} 목록`}>{entries.map(h=><button type="button" key={h.id} data-help-entry={h.id} aria-label={h.name} aria-pressed={selected===h.id} onClick={()=>setSelected(selected===h.id?null:h.id)}>
   <span className="tile-help-icon"><TileHelpArt help={h}/></span><span>{h.number??h.name}</span>
  </button>)}</div>}
  {category==="shield"&&<details className="tile-help-maintenance"><summary>방패 공통 유지 규칙</summary><p>{SHIELD_MAINTENANCE}</p><p>현재 방패 18종은 PNG 대신 기존 번호·능력이 연결된 공통 SVG 그림을 재사용합니다.</p></details>}
  {help&&<section className="tile-help-selected" aria-label="선택한 타일 설명" aria-live="polite"><TileHelpContent help={help}/></section>}
 </details>;
}
