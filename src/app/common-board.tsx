"use client";

import { InnStack } from "./inn-stack";
import { shieldLayout } from "../game/shields";
import { ShieldArt, shieldLabel } from "./shield-art";
import { BoardViewport } from "./board-viewport";
import { CommonBoardBackdrop } from "./common-board-backdrop";
import { directCost } from "../game/direct-actions";
import type { GameAction, GameState, TileType } from "../game/types";
import { GoodsArt, terrainPaint, TileArt } from "./tile-art";

// Shared layout in native SVG units. Tile size never depends on player count.
const depotCenters = [[650,340],[650,480],[650,700],[650,830],[300,700],[300,480]];
const tileWidth = 60, tileHeight = tileWidth * 2 / Math.sqrt(3);
const hex = (x:number,y:number,w=tileWidth) => {const r=w/Math.sqrt(3);return [[x,y-r],[x+w/2,y-r/2],[x+w/2,y+r/2],[x,y+r],[x-w/2,y+r/2],[x-w/2,y-r/2]].map(p=>p.join(",")).join(" ");};
function slotCenter(depot:number,index:number,count:number):number[]{
 const [,y]=depotCenters[depot-1];
 if(depot===1||depot===4)return [462-(count>2?index%2*72:0),(depot===1?320:900)+(count>2?Math.floor(index/2)-.5:index-.5)*80];
 const right=depot===2||depot===3;
 return [right?748+(count>2?index%2*72:0):202-(count>2?index%2*72:0),y+(count>2?Math.floor(index/2)-.5:index-.5)*80];
}
function blackCenter(index:number,count:number):number[]{
 if(count===4)return [[475,480],[445,480+tileHeight*.75],[505,480+tileHeight*.75],[475,480+tileHeight*1.5]][index];
 const columns=count>6?3:2,q=index%columns,r=Math.floor(index/columns);
 return [475+(q-(columns-1)/2)*tileWidth+(r%2?tileWidth/2:0)-tileWidth/4,480+r*tileHeight*.75];
}
const colors = { blue:"#287fba",red:"#bd4838",green:"#608d43",yellow:"#d0a536" };
const terrainNames: Record<TileType,string> = {castle:"성",ship:"선박",mine:"광산",livestock:"가축",building:"건물",monastery:"수도원"};

function Die({x,y,value}: {x:number;y:number;value:number|null}) {
  const pips: Record<number,number[][]> = {1:[[0,0]],2:[[-6,-6],[6,6]],3:[[-6,-6],[0,0],[6,6]],4:[[-6,-6],[6,-6],[-6,6],[6,6]],5:[[-6,-6],[6,-6],[0,0],[-6,6],[6,6]],6:[[-6,-8],[6,-8],[-6,0],[6,0],[-6,8],[6,8]]};
  return <g aria-hidden="true"><rect x={x-14} y={y-14} width="28" height="28" rx="5" fill="#fffbea" stroke="#a99c78"/>{value ? pips[value].map(([dx,dy],i)=><circle key={i} cx={x+dx} cy={y+dy} r="2.5" fill="#494735"/>) : <text x={x} y={y+4} textAnchor="middle">—</text>}</g>;
}

export function CommonBoard({game,selectedTileId,onSelect,titleFor,zoom,onZoom,actionFor,shieldSelection,showCosts}: {
  game:GameState;selectedTileId:string|null;onSelect:(id:string)=>void;titleFor:(id:string)=>string;
  zoom:number;onZoom:(zoom:number)=>void;showCosts:boolean;actionFor:(id:string)=>GameAction|null;
  shieldSelection?: {slotId:string|null;onSelect:(id:string)=>void;cost:(id:string)=>GameAction|null};

}) {
  const selected = (id:string,x:number,y:number,width=53,label=titleFor(id)) => <g key={id} role="button" tabIndex={0} aria-label={label} aria-disabled={!actionFor(id)} aria-pressed={selectedTileId===id} className={`supply-art-tile ${actionFor(id)?"direct-legal":"direct-unavailable"}`} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(id);}}}>
    <title>{`${label}${game.tiles[id].back==="black" ? " · 검은 뒷면" : ""}`}</title>
    <polygon data-tile-shadow="true" points={hex(x,y+2,width)} fill="#53351e" fillOpacity=".18" pointerEvents="none" aria-hidden="true"/>
    <TileArt tile={game.tiles[id]} x={x-width/2} y={y-width/Math.sqrt(3)} width={width} height={width*2/Math.sqrt(3)}/>
    <polygon data-supply-hit="true" points={hex(x,y,width)} fill="transparent"/>
    {showCosts&&<g className="direct-cost" aria-hidden="true"><rect x={x-width*.48} y={y+width*.52} width={width*.96} height="14" rx="5"/><text x={x} y={y+width*.52+10} textAnchor="middle">{actionFor(id)?game.market.blackDepot.includes(id)?"銀 2":`일꾼 ${directCost(game,actionFor(id)!)}`:"불가"}</text></g>}
    <polygon className="supply-selection" points={hex(x,y,width)} fill="none"/>
  </g>;
  const shields=shieldLayout(game);
  const twoPlayer = game.config.marketRecipeId === "se:main:2";
  const shieldCenters=[[540,320],[900,480],[900,700],[540,900],[50,700],[50,480]];
  const shieldDepotCenters=depotCenters;
  const blackCount = game.market.blackDepot.length;
  const trackPositions = Array.from({length: Math.max(6,...game.turn.orderTrack.map(s=>s.position))+1},(_,i)=>i);
  return <section className={`common-board-panel${shields ? " with-shields" : ""}`} aria-label="공용 공급처 보드">
    <div className="common-board-toolbar"><div><h2>공용 공급처</h2><span>{twoPlayer ? "2인 · 사진 기준 슬롯 · 사용자 지정 공급" : game.config.marketRecipeId ? "3·4인 검증 슬롯 · 연습 타일" : "연습 슬롯"}</span></div><div><button aria-label="공용 보드 축소" disabled={zoom<=.75} onClick={()=>onZoom(Math.max(.75,+(zoom-.25).toFixed(2)))}>−</button><button aria-label="공용 보드 배율 복원" onClick={()=>onZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="공용 보드 확대" disabled={zoom>=2} onClick={()=>onZoom(Math.min(2,zoom+.25))}>+</button></div></div>
    <div className="common-board-actions"><span>{game.turn.phase}단계 · {game.turn.round}라운드 · 주사위 선택 후 대상을 누르세요</span></div>
    <BoardViewport label="공용 보드" onZoom={delta=>onZoom(Math.max(.75,Math.min(2,zoom+delta)))}><div className="common-board-scroll"><svg className="common-board-svg" viewBox="0 0 950 1030" style={{width:`${950*zoom}px`}} role="group" aria-label="단계 상품 공급처 순서 및 보너스">
      <CommonBoardBackdrop width={950} height={1030}/>
      <rect data-info-panel="phase-goods" x="18" y="18" width="390" height="205" rx="3" fill="#fff5d8" fillOpacity=".55" stroke="#b49a68"/>
      <rect data-info-panel="turn-order" x="542" y="18" width="390" height="205" rx="3" fill="#fff5d8" fillOpacity=".55" stroke="#b49a68"/>
      <path d="M19 118H407" stroke="#c6ba8f" strokeWidth="1"/>

      <text x="60" y="44" className="common-small">단계 · 지역 완성 추가 점수</text>
      {(["A","B","C","D","E"] as const).map((phase,i)=><g key={phase} data-phase-score={phase}>
        <rect x={59+i*66} y="52" width="32" height="54" rx="13" fill={game.turn.phase===phase ? "#fff8dd" : "#e0d9b0"} stroke={game.turn.phase===phase ? "#826b3d" : "#c0b68d"}/>
        <text x={75+i*66} y="71" className="common-phase">{phase}</text><path d={`M${64+i*66} 78h22v17l-11 7-11-7z`} fill="#a64736"/><text x={75+i*66} y="93" textAnchor="middle" fontSize="14" fill="#fff1c7">{10-i*2}</text>
        <text x={75+i*66} y="113" textAnchor="middle" className="common-small">{phase===game.turn.phase ? "현재" : `${game.market.phaseGoods[phase].length}개`}</text>
      </g>)}
      <g data-round-goods="true"><text x="60" y="143" className="common-small">라운드 상품 · 공급 완료 / 다음 공급</text>
      {Array.from({length:5},(_,i)=>{const goods=game.market.roundGoods[i-(5-game.market.roundGoods.length)];return <g key={i} data-round-supply={i+1}><rect x={55+i*66} y="149" width="54" height="68" rx="5" fill={game.turn.round===i+1?"#f4dda1":"none"} stroke={game.turn.round===i+1?"#9b7135":"none"}/><text x={82+i*66} y="211" textAnchor="middle" fontSize="9" fill="#665035">{i+1}R{goods?" 대기":" 공급완료"}</text>{goods ? <GoodsArt value={goods.type} x={60+i*66} y={154} width="44" height="44"/> : <rect x={60+i*66} y={154} width="44" height="44" rx="2" fill="#e3dec0" stroke="#c6bb93" strokeDasharray="3 3"/>}</g>;})}
      </g><text x="565" y="44" className="common-small">선박 순서 트랙 · 앞 →</text>
      {trackPositions.map(position=>{const x=570+position*330/(trackPositions.length-1);const space=game.turn.orderTrack.find(s=>s.position===position);return <g key={position}><circle cx={x} cy="82" r="12" fill="#fff9df" stroke="#b7ab83"/><text x={x} y="86" textAnchor="middle" fontSize="9" fill="#918465">{position}</text>{space && [...space.players].reverse().map(id=>{const player=game.players.find(p=>p.id===id)!;const j=space.players.indexOf(id);return <circle key={id} cx={x} cy={82-(space.players.length-1-j)*4} r="9" fill={colors[player.color??(["blue","red","green","yellow"] as const)[player.seat]]} stroke="#f4e5b5"><title>{`${player.name} · 위치 ${position} · 위에서 ${j+1}번째`}</title></circle>;})}</g>;})}
      {game.players.map((p,i)=><g key={p.id}><circle cx={570+(i%2)*165} cy={137+Math.floor(i/2)*35} r="5" fill={colors[p.color??(["blue","red","green","yellow"] as const)[p.seat]]}/><text x={585+(i%2)*165} y={141+Math.floor(i/2)*35} fontSize="11" fill={p.id===game.turn.activePlayerId ? "#a53f30" : "#575742"}>{p.name.slice(0,8)}{p.id===game.turn.activePlayerId ? " ◀" : ""}</text></g>)}
      <g><Die x={60} y={265} value={game.dice.whiteDie}/><text x="83" y="269" className="common-small">흰 주사위</text></g>
      {game.market.numberedDepots.map(depot=>{const [baseX,y]=depotCenters[depot.number-1];const x=baseX;return <g key={depot.number} data-depot={depot.number} aria-label={`${depot.number}번 공급처 상품 ${depot.goods.length}개`}>
        <rect data-goods-space={depot.number} x={x-46} y={y-46} width="92" height="92" rx="2" fill="#fcf6df" stroke="#bbad7f" strokeWidth="1"/>

        <Die x={x+(depot.number===2||depot.number===3?46:depot.number===5||depot.number===6?-46:0)} y={y+(depot.number===1||depot.number===4?-46:0)} value={depot.number}/>
        {depot.goods.slice(0,4).map((g,i)=><GoodsArt key={g.id} value={g.type} x={x-29+(i%2)*30} y={y-19+Math.floor(i/2)*29} width="27" height="27"/>)}
        {depot.goods.length>4 && <text x={x+27} y={y+38} textAnchor="end" fontSize="9" fill="#775b3b">{`+${depot.goods.length-4}`}</text>}
        {depot.goods.length===0 && <text x={x} y={y+6} textAnchor="middle" className="common-small" fill="#a29876">상품</text>}
        <text x={x} y={y+39} textAnchor="middle" className="common-small">상품 {depot.goods.length}개</text>
        {depot.slots.map((slot,i)=>{const [tx,ty]=slotCenter(depot.number,i,depot.slots.length);return slot.tileId ? selected(slot.tileId,tx,ty,tileWidth,`${depot.number}번 공급처 ${titleFor(slot.tileId)}`) : <g key={slot.id}><polygon points={hex(tx,ty,tileWidth)} fill={terrainPaint[slot.requiredType]} fillOpacity=".45" stroke="#b4ac85" strokeDasharray="3 3"/><title>{`${terrainNames[slot.requiredType]} 빈 공급 칸`}</title></g>;})}
      </g>;})}
      <g transform="translate(135 222)"><InnStack game={game} onSelect={onSelect} canBuy={id=>!!actionFor(id)}/></g>
      <g data-black-depot="true">
        <text x="475" y="430" textAnchor="middle" fill="#514636" fontSize="12">검은 공급처 · 은화 2</text>
        {game.market.blackDepot.map((id,i)=>{const [x,y]=blackCenter(i,blackCount);return <g key={`black-${i}`}><polygon data-black-space={i} points={hex(x,y)} fill="#393b30" stroke="none"/>{id ? selected(id,x,y,tileWidth,`검은 공급처 ${titleFor(id)}`) : <polygon points={hex(x,y,50)} fill="none" stroke="#898168" strokeDasharray="3 3"/>}</g>;})}
      </g>
      <g transform="translate(14 327)"><g data-region-score-panel="true"><rect x="16" y="573" width="190" height="96" rx="22" fill="#514636" stroke="#c2ab74"/><text x="111" y="592" textAnchor="middle" fill="#f9edbd" fontSize="12">지역 완성 · 칸 수 / 점수</text>{[1,3,6,10,15,21,28,36].map((v,i)=><g key={v}><text x={40+(i%4)*47} y={610+Math.floor(i/4)*32} textAnchor="middle" fontSize="9" fill="#e9dcb4">{i+1}칸</text><path d={`M${28+(i%4)*47} ${614+Math.floor(i/4)*32}h24v12l-12 5-12-5z`} fill="#a54431"/><text x={40+(i%4)*47} y={624+Math.floor(i/4)*32} textAnchor="middle" fontSize="11" fill="#fff1cb">{v}</text></g>)}</g>
      <g data-color-bonuses="true" transform="translate(285 0)"><text x="529" y="574" textAnchor="middle" className="common-small">지형 전체 완성 · 1위 / 2위</text>
      {(["castle","mine","ship","livestock","building","monastery"] as const).map((type,i)=><g key={type}>
        <rect x={435+(i%2)*94} y={583+Math.floor(i/2)*29} width="86" height="25" rx="9" fill={terrainPaint[type]} stroke="#877c4f"/>
        <text x={478+(i%2)*94} y={593+Math.floor(i/2)*29} textAnchor="middle" fontSize="9" fill="#fff6d6">{terrainNames[type]}</text>
        <text x={478+(i%2)*94} y={603+Math.floor(i/2)*29} textAnchor="middle" fontSize="10" fill="#fff6d6">{["first","second"].map(rank=>{const b=game.market.bonusTiles.find(b=>b.color===type&&b.rank===rank);return b ? b.points : "완료";}).join(" / ")}</text>
      </g>)}
      </g></g>
      {shields && game.market.numberedDepots.map(depot=>{
        const slots=shields.slots.filter(s=>s.depot===depot.number);const [cx,cy]=shieldCenters[depot.number-1];
        const [dx]=shieldDepotCenters[depot.number-1];
        const zoneHeight=slots.length===2?172:104;
        const linkDirection=Math.sign(([1,4].includes(depot.number)?426:dx)-cx);
        return <g key={`shields-${depot.number}`} data-shield-depot={depot.number} aria-label={`${depot.number}번 공급처 방패 그룹`}>
          <path d={`M${cx+linkDirection*36} ${cy}h${linkDirection*16}`} className="shield-depot-link"/>
          <rect data-shield-zone={depot.number} x={cx-36} y={cy-zoneHeight/2} width="72" height={zoneHeight} rx="28" fill="#b9bcb0" fillOpacity=".38" stroke="#929689" pointerEvents="none"/>
          {slots.map((slot,i)=>{const offset=slots.length===2?(i===0?-35:35):0;const x=cx,y=cy+offset;const label=slot.shieldNumber===null?`${depot.number}번 공급처 빈 방패 슬롯`:`${depot.number}번 공급처 ${shieldLabel(slot.shieldNumber)}`;
            return <g key={slot.id} data-shield-slot={slot.id} data-empty={slot.shieldNumber===null} transform={`translate(${x} ${y})`} role={slot.shieldNumber===null?"img":"button"} tabIndex={slot.shieldNumber===null?undefined:0} aria-label={label} aria-pressed={slot.shieldNumber===null?undefined:shieldSelection?.slotId===slot.id} aria-disabled={slot.shieldNumber!==null&&!shieldSelection?.cost(slot.id)} className={slot.shieldNumber===null?"shield-slot empty":`shield-slot occupied ${shieldSelection?.cost(slot.id)?"direct-legal":"direct-unavailable"}`} onClick={slot.shieldNumber===null?undefined:()=>shieldSelection?.onSelect(slot.id)} onKeyDown={slot.shieldNumber===null?undefined:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();shieldSelection?.onSelect(slot.id);}}}>
              <title>{label}{slot.shieldNumber===null?" · 보충 없음":(shields.effectsActive?" · 장착 시 능력 활성":" · 능력은 검증 모드에서 미적용")}</title><ShieldArt number={slot.shieldNumber}/>{showCosts&&slot.shieldNumber!==null&&<g className="direct-cost"><rect x="-29" y="23" width="58" height="16" rx="5"/><text y="35" textAnchor="middle">{shieldSelection?.cost(slot.id)?`일꾼 ${directCost(game,shieldSelection.cost(slot.id)!)}`:"불가"}</text></g>}{(i===0)&&<text y={-40} textAnchor="middle" className="shield-depot-number">{depot.number}번</text>}
            </g>;})}
        </g>;})}
      <text x={475} y={1020} textAnchor="middle" className="common-small">{game.turn.phase}단계 · {game.turn.round}라운드</text>
    </svg></div></BoardViewport><p className="common-board-note">주사위 선택 → 비용 확인 → 타일 터치. 검은 마름모는 검은 뒷면 타일입니다.{shields && " 방패 선택 → 강조된 성을 누르면 장착합니다. 작은 화면에서는 보드를 좌우로 스크롤하세요."}</p>
  </section>;
}
