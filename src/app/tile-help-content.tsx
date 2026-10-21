"use client";
import {getTileHelp,SHIELD_MAINTENANCE,type TileHelp} from "../game/tile-help";
import {TileArt,GoodsArt} from "./tile-art";
import {ShieldArt} from "./shield-art";
import {VineTile} from "./vineyard-board";
import {VINE_TILES} from "../game/vineyards";

export function TileHelpArt({help,question=false}:{help:TileHelp;question?:boolean}){
 if(help.tile)return <TileArt tile={help.tile}/>;
 if(help.kind==="shield")return <svg viewBox="-30 -38 60 74" aria-hidden="true"><ShieldArt number={question?null:help.number!} placeholder="?"/></svg>;
 if(help.kind==="vineyard")return <VineTile id={Object.keys(VINE_TILES)[0]}/>;
 return <svg viewBox="0 0 110 80" aria-hidden="true"><GoodsArt value={1} x={0} y={20} width={40} height={40}/><path d="M44 40H62M55 34 62 40 55 46" fill="none" stroke="#735123" strokeWidth={3}/><TileArt tile={getTileHelp("building","bank")!.tile!} x={65} y={13} width={42} height={49}/></svg>;
}
export function TileHelpContent({help,headingId,terrain}:{help:TileHelp;headingId?:string;terrain?:string}){
 return <div className="tile-help-content" data-help-content={help.id}>
  <div className="tile-help-picture"><TileHelpArt help={help}/></div>
  <div><h3 id={headingId}>{help.name}</h3><p className="tile-help-summary">{help.summary}</p>
   {help.kind==="inn"&&terrain&&<p className="tile-help-context">현재 {({castle:"성",mine:"광산",ship:"선박",building:"건물",livestock:"동물",monastery:"수도원"} as Record<string,string>)[terrain]} 타일로 적용 중</p>}
   <p>{help.details}</p><dl><dt>발동</dt><dd>{help.timing}</dd><dt>조건</dt><dd>{help.conditions}</dd></dl>
   {help.notes&&<p className="tile-help-note">{help.notes}</p>}
   {help.kind==="shield"&&<details><summary>방패 공통 유지 규칙</summary><p>{SHIELD_MAINTENANCE}</p></details>}
  </div>
 </div>;
}
