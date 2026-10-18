"use client";

import type { GameState, Tile, TileType } from "../game/types";
import { GoodsArt, terrainPaint, TileArt } from "./tile-art";

const centers = [[310,193],[493,313],[493,465],[310,559],[127,465],[127,313]];
const offsets = [[-66,-32],[66,-32],[-66,34],[66,34]];
const twoPlayerCenters = [[310,220],[465,300],[465,465],[310,545],[145,465],[145,300]];
const twoPlayerOffsets = [
  [[-30,-70],[30,-70]], [[76,-33],[76,33]], [[76,-33],[76,33]],
  [[-30,70],[30,70]], [[-76,-33],[-76,33]], [[-76,-33],[-76,33]],
];
const colors = { blue:"#287fba",red:"#bd4838",green:"#608d43",yellow:"#d0a536" };
const terrainNames: Record<TileType,string> = {castle:"성",ship:"선박",mine:"광산",livestock:"가축",building:"건물",monastery:"수도원"};

function Die({x,y,value}: {x:number;y:number;value:number|null}) {
  const pips: Record<number,number[][]> = {1:[[0,0]],2:[[-6,-6],[6,6]],3:[[-6,-6],[0,0],[6,6]],4:[[-6,-6],[6,-6],[-6,6],[6,6]],5:[[-6,-6],[6,-6],[0,0],[-6,6],[6,6]],6:[[-6,-8],[6,-8],[-6,0],[6,0],[-6,8],[6,8]]};
  return <g aria-hidden="true"><rect x={x-14} y={y-14} width="28" height="28" rx="5" fill="#fffbea" stroke="#a99c78"/>{value ? pips[value].map(([dx,dy],i)=><circle key={i} cx={x+dx} cy={y+dy} r="2.5" fill="#494735"/>) : <text x={x} y={y+4} textAnchor="middle">—</text>}</g>;
}

export function CommonBoard({game,selectedTileId,onSelect,titleFor,zoom,onZoom,canRoll,onRoll,acquisition}: {
  game:GameState;selectedTileId:string|null;onSelect:(id:string)=>void;titleFor:(id:string)=>string;
  zoom:number;onZoom:(zoom:number)=>void;canRoll:boolean;onRoll:()=>void;
  acquisition:null|{tile:Tile;title:string;enabled:boolean;replacesTile:boolean;onAcquire:()=>void};
}) {
  const selected = (id:string,x:number,y:number,width=53,label=titleFor(id)) => <g key={id} role="button" tabIndex={0} aria-label={label} aria-pressed={selectedTileId===id} className="supply-art-tile" onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(id);}}}>
    <title>{`${label}${game.tiles[id].back==="black" ? " · 검은 뒷면" : ""}`}</title>
    <TileArt tile={game.tiles[id]} x={x-width/2} y={y-width*.55} width={width} height={width*1.1}/>
    <polygon className="supply-selection" points={`${x},${y-width*.52} ${x+width*.45},${y-width*.26} ${x+width*.45},${y+width*.26} ${x},${y+width*.52} ${x-width*.45},${y+width*.26} ${x-width*.45},${y-width*.26}`} fill="none"/>
  </g>;
  const blackCount = game.market.blackDepot.length;
  const twoPlayer = game.config.marketRecipeId === "se:main:2";
  const trackPositions = Array.from({length: Math.max(6,...game.turn.orderTrack.map(s=>s.position))+1},(_,i)=>i);
  return <section className="common-board-panel" aria-label="공용 공급처 보드">
    <div className="common-board-toolbar"><div><h2>공용 공급처</h2><span>{twoPlayer ? "2인 · 사진 기준 슬롯 · 사용자 지정 공급" : game.config.marketRecipeId ? "3·4인 검증 슬롯 · 연습 타일" : "연습 슬롯"}</span></div><div><button aria-label="공용 보드 축소" disabled={zoom<=.75} onClick={()=>onZoom(Math.max(.75,+(zoom-.25).toFixed(2)))}>−</button><button aria-label="공용 보드 배율 복원" onClick={()=>onZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="공용 보드 확대" disabled={zoom>=2} onClick={()=>onZoom(Math.min(2,zoom+.25))}>+</button></div></div>
    <div className="common-board-actions"><button className="outline-button" disabled={!canRoll} onClick={onRoll}>공용 보드 주사위 굴리기</button><span>{game.turn.phase}단계 · {game.turn.round}라운드{game.turn.activePlayerId ? ` · ${game.players.find(p=>p.id===game.turn.activePlayerId)?.name}의 차례` : ""}</span></div>
    {acquisition && <div className="common-board-acquisition" aria-label="공용 보드 선택 타일"><TileArt tile={acquisition.tile}/><div aria-live="polite"><strong>{acquisition.title}</strong><small>{acquisition.replacesTile ? "보관함이 가득 찼습니다. 아래에서 선택한 보관 칸의 타일을 폐기하고 교체합니다." : acquisition.enabled ? "주사위 또는 은화로 개인 보관함에 가져옵니다." : "차례·선택한 주사위 눈·일꾼·은화를 아래 행동 영역에서 확인하세요."}</small></div><button className="primary-button" disabled={!acquisition.enabled} onClick={acquisition.onAcquire}>{acquisition.replacesTile ? "선택 보관 타일 폐기 후 획득" : "선택 타일 보관으로 획득"}</button></div>}
    <div className="common-board-scroll"><svg className="common-board-svg" viewBox="0 0 640 690" style={{width:`${zoom*100}%`}} role="group" aria-label="단계 상품 공급처 순서 및 보너스">
      <rect x="2" y="2" width="636" height="686" rx="4" fill="#f0edc9" stroke="#b5a171" strokeWidth="3"/>
      <path d="M6 122H634M6 636H634M218 6V122M365 6V122" stroke="#c6ba8f" strokeWidth="1.5"/>
      <path d="M24 130Q70 105 98 143T182 138M542 135Q575 112 615 149M18 542Q55 525 78 550M555 536Q590 520 622 545" fill="none" stroke="#c6c49a" strokeWidth="2" opacity=".45"/>
      <text x="22" y="24" className="common-small">단계 · 지역 완성 추가 점수</text>
      {(["A","B","C","D","E"] as const).map((phase,i)=><g key={phase}>
        <rect x={19+i*38} y="32" width="32" height="54" rx="13" fill={game.turn.phase===phase ? "#fff8dd" : "#e0d9b0"} stroke={game.turn.phase===phase ? "#826b3d" : "#c0b68d"}/>
        <text x={35+i*38} y="51" className="common-phase">{phase}</text><path d={`M${24+i*38} 58h22v17l-11 7-11-7z`} fill="#a64736"/><text x={35+i*38} y="73" textAnchor="middle" fontSize="14" fill="#fff1c7">{10-i*2}</text>
        <text x={35+i*38} y="105" textAnchor="middle" className="common-small">{phase===game.turn.phase ? "현재" : `${game.market.phaseGoods[phase].length}개`}</text>
      </g>)}
      <text x="235" y="24" className="common-small">라운드 상품 · 왼쪽부터</text>
      {Array.from({length:5},(_,i)=>{const goods=game.market.roundGoods[i];return <g key={i}>{goods ? <GoodsArt value={goods.type} x={230+(i%3)*41} y={32+Math.floor(i/3)*40} width="35" height="35"/> : <rect x={230+(i%3)*41} y={32+Math.floor(i/3)*40} width="35" height="35" rx="2" fill="#e3dec0" stroke="#c6bb93" strokeDasharray="3 3"/>}</g>;})}
      <text x="382" y="24" className="common-small">선박 순서 트랙 · 앞 →</text>
      {trackPositions.map(position=>{const x=389+position*215/(trackPositions.length-1);const space=game.turn.orderTrack.find(s=>s.position===position);return <g key={position}><circle cx={x} cy="49" r="12" fill="#fff9df" stroke="#b7ab83"/><text x={x} y="53" textAnchor="middle" fontSize="9" fill="#918465">{position}</text>{space && [...space.players].reverse().map(id=>{const player=game.players.find(p=>p.id===id)!;const j=space.players.indexOf(id);return <circle key={id} cx={x} cy={49-(space.players.length-1-j)*4} r="9" fill={colors[player.color??(["blue","red","green","yellow"] as const)[player.seat]]} stroke="#f4e5b5"><title>{`${player.name} · 위치 ${position} · 위에서 ${j+1}번째`}</title></circle>;})}</g>;})}
      {game.players.map((p,i)=><g key={p.id}><circle cx={382+(i%2)*122} cy={79+Math.floor(i/2)*23} r="5" fill={colors[p.color??(["blue","red","green","yellow"] as const)[p.seat]]}/><text x={393+(i%2)*122} y={83+Math.floor(i/2)*23} fontSize="11" fill={p.id===game.turn.activePlayerId ? "#a53f30" : "#575742"}>{p.name.slice(0,8)}{p.id===game.turn.activePlayerId ? " ◀" : ""}</text></g>)}
      <g><Die x={42} y={158} value={game.dice.whiteDie}/><text x="65" y="162" className="common-small">흰 주사위</text></g>
      {game.market.numberedDepots.map(depot=>{const [x,y]=(twoPlayer ? twoPlayerCenters : centers)[depot.number-1];return <g key={depot.number} aria-label={`${depot.number}번 공급처 상품 ${depot.goods.length}개`}>
        <rect x={x-35} y={y-42} width="70" height="84" rx="4" fill="#fcf6df" stroke="#bbad7f" strokeWidth="2"/>
        <path d={`M${x-29} ${y+31}V${y-26}L${x} ${y-36} ${x+29} ${y-26}V${y+31}`} stroke="#d4c79f" fill="none"/>
        <Die x={x} y={y-41} value={depot.number}/>
        {depot.goods.slice(0,4).map((g,i)=><GoodsArt key={g.id} value={g.type} x={x-29+(i%2)*30} y={y-19+Math.floor(i/2)*29} width="27" height="27"/>)}
        {depot.goods.length>4 && <text x={x+27} y={y+38} textAnchor="end" fontSize="9" fill="#775b3b">{`+${depot.goods.length-4}`}</text>}
        {depot.goods.length===0 && <text x={x} y={y+6} textAnchor="middle" className="common-small" fill="#a29876">상품</text>}
        <text x={x} y={y+(twoPlayer && depot.number===4 ? 34 : 57)} textAnchor="middle" className="common-small">상품 {depot.goods.length}개</text>
        {depot.slots.map((slot,i)=>{const [dx,dy]=twoPlayer ? twoPlayerOffsets[depot.number-1][i] : offsets[i];return slot.tileId ? selected(slot.tileId,x+dx,y+dy,55,`${depot.number}번 공급처 ${titleFor(slot.tileId)}`) : <g key={slot.id}><polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" transform={`translate(${x+dx} ${y+dy})`} fill={terrainPaint[slot.requiredType]} fillOpacity=".45" stroke="#b4ac85" strokeDasharray="3 3"/><title>{`${terrainNames[slot.requiredType]} 빈 공급 칸`}</title></g>;})}
      </g>;})}
      <rect x="232" y="290" width="156" height="181" rx="40" fill="#514d38" stroke="#bfae76" strokeWidth="2"/>
      <text x="310" y="313" textAnchor="middle" fill="#f6e9ba" fontSize="12">검은 공급처 · 은화 2</text>
      {game.market.blackDepot.map((id,i)=>{const columns=Math.min(blackCount,blackCount>6 ? 3 : 2);const [x,y]=twoPlayer ? [[310,345],[283,392],[337,392],[310,439]][i] : [310+(i%columns-(columns-1)/2)*44,343+Math.floor(i/columns)*45];return id ? selected(id,x,y,42,`검은 공급처 ${titleFor(id)}`) : <circle key={`empty-${i}`} cx={x} cy={y} r="15" fill="none" stroke="#898168" strokeDasharray="3 3"/>;})}
      <g><rect x="16" y="573" width="190" height="96" rx="22" fill="#514636" stroke="#c2ab74"/><text x="111" y="592" textAnchor="middle" fill="#f9edbd" fontSize="12">지역 완성 · 칸 수 / 점수</text>{[1,3,6,10,15,21,28,36].map((v,i)=><g key={v}><text x={40+(i%4)*47} y={610+Math.floor(i/4)*32} textAnchor="middle" fontSize="9" fill="#e9dcb4">{i+1}칸</text><path d={`M${28+(i%4)*47} ${614+Math.floor(i/4)*32}h24v12l-12 5-12-5z`} fill="#a54431"/><text x={40+(i%4)*47} y={624+Math.floor(i/4)*32} textAnchor="middle" fontSize="11" fill="#fff1cb">{v}</text></g>)}</g>
      <text x="529" y="574" textAnchor="middle" className="common-small">지형 전체 완성 · 1위 / 2위</text>
      {(["castle","mine","ship","livestock","building","monastery"] as const).map((type,i)=><g key={type}>
        <rect x={435+(i%2)*94} y={583+Math.floor(i/2)*29} width="86" height="25" rx="9" fill={terrainPaint[type]} stroke="#877c4f"/>
        <text x={478+(i%2)*94} y={593+Math.floor(i/2)*29} textAnchor="middle" fontSize="9" fill="#fff6d6">{terrainNames[type]}</text>
        <text x={478+(i%2)*94} y={603+Math.floor(i/2)*29} textAnchor="middle" fontSize="10" fill="#fff6d6">{["first","second"].map(rank=>{const b=game.market.bonusTiles.find(b=>b.color===type&&b.rank===rank);return b ? b.points : "완료";}).join(" / ")}</text>
      </g>)}
      <text x="310" y="659" textAnchor="middle" className="common-small">{game.turn.phase}단계 · {game.turn.round}라운드</text>
    </svg></div><p className="common-board-note">타일 선택 → 보드 위 ‘선택 타일 보관으로 획득’. 검은 마름모는 검은 뒷면 타일입니다.</p>
  </section>;
}
