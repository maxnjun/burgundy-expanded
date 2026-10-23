"use client";
import {WhiteDie} from "./white-die";
import {playerPaint} from "../game/player-colors";
import {tileHelpId} from "../game/tile-help";

import {GoodsSpace,type GoodsOption} from "./goods-space";
import { ResourceGlyph } from "./resource-icon";
import { InnStack } from "./inn-stack";
import type { ShieldLayout } from "../game/shields";
import { ShieldArt, shieldLabel } from "./shield-art";
import { BoardViewport } from "./board-viewport";
import { CommonBoardBackdrop } from "./common-board-backdrop";
import type { GameAction, GameState, Phase, GoodsTile, TileType } from "../game/types";
import { GoodsArt, GoodsBackArt, terrainPaint, TileArt } from "./tile-art";

// Native SVG geometry; all market quantities and click handlers stay in the engine.
const layout = {
 width:950,height:1030,axis:475,frameWidth:5,
 panels:{left:18,right:542,width:390,top:18,topHeight:205,bottom:857,bottomHeight:155},
 top:{shield:160,tiles:290,goods:390},bottom:{goods:690,tiles:790,shield:920},
 side:{left:300,right:650,upper:390,lower:690},
 tileWidth:60,tileGap:72,shieldGap:70,
};
const playCenter={x:layout.axis,y:(layout.panels.top+layout.panels.topHeight+layout.panels.bottom)/2};
const depotCenters = [[layout.axis,layout.top.goods],[layout.side.right,layout.side.upper],[layout.side.right,layout.side.lower],[layout.axis,layout.bottom.goods],[layout.side.left,layout.side.lower],[layout.side.left,layout.side.upper]];
const tileWidth = layout.tileWidth, tileHeight = tileWidth * 2 / Math.sqrt(3);
const hex = (x:number,y:number,w=tileWidth) => {const r=w/Math.sqrt(3);return [[x,y-r],[x+w/2,y-r/2],[x+w/2,y+r/2],[x,y+r],[x-w/2,y+r/2],[x-w/2,y-r/2]].map(p=>p.join(",")).join(" ");};
function slotCenter(depot:number,index:number,count:number):number[]{
 const [,y]=depotCenters[depot-1];
 if(depot===1||depot===4)return [layout.axis+(index-(count-1)/2)*layout.tileGap,depot===1?layout.top.tiles:layout.bottom.tiles];
 const right=depot===2||depot===3;
 return [right?748+(count>2?index%2*72:0):202-(count>2?index%2*72:0),y+(count>2?Math.floor(index/2)-.5:index-.5)*80];
}
function blackCenters(count:number):number[][]{
 const raw=Array.from({length:count},(_,index)=>{
  if(count===4)return [[0,0],[-30,tileHeight*.75],[30,tileHeight*.75],[0,tileHeight*1.5]][index];
  const columns=count>6?3:2,q=index%columns,r=Math.floor(index/columns);
  return [q*tileWidth+(r%2?tileWidth/2:0),r*tileHeight*.75];
 });
 // Use every allocated slot, including purchased/null ones, to keep the center fixed.
 const cx=(Math.min(...raw.map(p=>p[0]))+Math.max(...raw.map(p=>p[0])))/2;
 const cy=(Math.min(...raw.map(p=>p[1]))+Math.max(...raw.map(p=>p[1])))/2;
 return raw.map(([x,y])=>[playCenter.x+x-cx,playCenter.y+y-cy]);
}
function CornerPanel({name,x,y,height}:{name:string;x:number;y:number;height:number}){
 return <rect data-info-panel={name} x={x} y={y} width={layout.panels.width} height={height} rx="3" fill="#fff5d8" fillOpacity=".55" stroke="#b49a68"/>;
}
const terrainNames: Record<TileType,string> = {castle:"성",ship:"선박",mine:"광산",livestock:"가축",building:"건물",monastery:"수도원"};


type CommonBoardState = Pick<GameState,"revision"|"tiles"|"players"|"dice"> & {
  config:Pick<GameState["config"],"marketRecipeId">;
  turn:Pick<GameState["turn"],"phase"|"round"|"orderTrack"|"activePlayerId"> & {pendingChoice?:{id:string}|null};
  market:Pick<GameState["market"],"numberedDepots"|"blackDepot"|"inns"|"bonusTiles"> & {
    phaseGoods:Readonly<Record<Phase,{readonly length:number}>>;
    roundGoods:readonly (GoodsTile|null)[];
  };
};

export function CommonBoard({game,selectedTileId,onSelect,titleFor,zoom,onZoom,actionFor,shieldSelection,showCosts,goodsOptions,onGoods,onGoodsSelecting,shields,costFor,fit=false}: {
  game:CommonBoardState;selectedTileId:string|null;onSelect:(id:string)=>void;titleFor:(id:string)=>string;
  zoom:number;onZoom:(zoom:number)=>void;showCosts:boolean;actionFor:(id:string)=>GameAction|null;
  goodsOptions?:(depot:number)=>readonly GoodsOption[];onGoods?:(a:GameAction)=>void;onGoodsSelecting?:()=>void;
  shields?:Pick<ShieldLayout,"slots"|"effectsActive">|null;costFor:(action:GameAction)=>number;
  fit?:boolean;
  shieldSelection?: {slotId:string|null;onSelect:(id:string)=>void;cost:(id:string)=>GameAction|null};

}) {
  const selected = (id:string,x:number,y:number,width=53,label=titleFor(id)) => <g key={id} data-tile-id={id} data-tile-help={tileHelpId(game.tiles[id])} role="button" tabIndex={0} aria-label={label} aria-disabled={!actionFor(id)} aria-pressed={selectedTileId===id} className={`supply-art-tile ${actionFor(id)?"direct-legal":"direct-unavailable"}`} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(id);}}}>
    <title>{`${label}${!actionFor(id)?game.turn.pendingChoice?" · 현재 효과에서 선택할 수 없는 타일입니다.":" · 주사위 선택, 일꾼 및 보관 공간을 확인하세요.":" · 클릭하면 획득합니다."}${game.tiles[id].back==="black" ? " · 검은 뒷면" : ""}`}</title>
    <polygon data-tile-shadow="true" points={hex(x,y+2,width)} fill="#53351e" fillOpacity=".18" pointerEvents="none" aria-hidden="true"/>
    <TileArt tile={game.tiles[id]} x={x-width/2} y={y-width/Math.sqrt(3)} width={width} height={width*2/Math.sqrt(3)}/>
    <polygon data-supply-hit="true" points={hex(x,y,width)} fill="transparent"/>
    {showCosts&&<g className="direct-cost" aria-hidden="true"><rect x={x-width*.48} y={y+width*.52} width={width*.96} height="14" rx="5"/><text x={x} y={y+width*.52+10} textAnchor="middle">{actionFor(id)?game.market.blackDepot.includes(id)?"2":`일꾼 ${costFor(actionFor(id)!)}`:"불가"}</text>{actionFor(id)&&game.market.blackDepot.includes(id)&&<ResourceGlyph type="silver" x={x-20} y={y+width*.52+1} size={12}/>}</g>}
    <polygon className="supply-selection" points={hex(x,y,width)} fill="none"/>
  </g>;
  const twoPlayer = game.config.marketRecipeId === "se:main:2";
  const shieldCenters=[[layout.axis,layout.top.shield],[900,layout.side.upper],[900,layout.side.lower],[layout.axis,layout.bottom.shield],[50,layout.side.lower],[50,layout.side.upper]];
  const shieldDepotCenters=depotCenters;
  const blackSlots = blackCenters(game.market.blackDepot.length);
  const trackPositions = Array.from({length: Math.max(6,...game.turn.orderTrack.map(s=>s.position))+1},(_,i)=>i);
  return <section className={`common-board-panel${shields ? " with-shields" : ""}`} aria-label="공용 공급처 보드">
    <div className="common-board-toolbar"><div><h2>공용 공급처</h2><span>{twoPlayer ? "2인 · 사진 기준 슬롯 · 사용자 지정 공급" : game.config.marketRecipeId ? "3·4인 검증 슬롯 · 연습 타일" : "연습 슬롯"}</span></div><div><button aria-label="공용 보드 축소" disabled={zoom<=.75} onClick={()=>onZoom(Math.max(.75,+(zoom-.25).toFixed(2)))}>−</button><button aria-label="공용 보드 배율 복원" onClick={()=>onZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="공용 보드 확대" disabled={zoom>=2} onClick={()=>onZoom(Math.min(2,zoom+.25))}>+</button></div></div>
    <div className="common-board-actions"><span>{game.turn.phase}단계 · {game.turn.round}라운드</span><details className="common-board-help"><summary>조작 도움말</summary><p>주사위 선택 → 비용 확인 → 타일 터치. 검은 마름모는 검은 뒷면 타일입니다.{shields && " 방패 선택 → 강조된 성을 누르면 장착합니다."} 확대하거나 화면이 좁을 때는 스크롤 또는 드래그 이동을 사용하세요.</p></details></div>
    <BoardViewport label="공용 보드" onZoom={delta=>onZoom(Math.max(.75,Math.min(2,zoom+delta)))}><div className="common-board-scroll"><svg className="common-board-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} style={{width:fit?`${zoom*100}%`:`${(layout.width-layout.frameWidth*2)*zoom}px`}} role="group" aria-label="단계 상품 공급처 순서 및 보너스">
      <CommonBoardBackdrop width={layout.width} height={layout.height}/>
      <CornerPanel name="phase-goods" x={layout.panels.left} y={layout.panels.top} height={layout.panels.topHeight}/>
      <CornerPanel name="turn-order" x={layout.panels.right} y={layout.panels.top} height={layout.panels.topHeight}/>
      <CornerPanel name="region-score" x={layout.panels.left} y={layout.panels.bottom} height={layout.panels.bottomHeight}/>
      <CornerPanel name="color-bonuses" x={layout.panels.right} y={layout.panels.bottom} height={layout.panels.bottomHeight}/>
      <path d="M19 118H407" stroke="#c6ba8f" strokeWidth="1"/>

      <text x="60" y="44" className="common-small">단계 · 지역 완성 추가 점수</text>
      {(["A","B","C","D","E"] as const).map((phase,i)=><g key={phase} data-phase-score={phase}>
        <rect x={59+i*66} y="52" width="32" height="54" rx="13" fill={game.turn.phase===phase ? "#fff8dd" : "#e0d9b0"} stroke={game.turn.phase===phase ? "#826b3d" : "#c0b68d"}/>
        <text x={75+i*66} y="71" className="common-phase">{phase}</text><path d={`M${64+i*66} 78h22v17l-11 7-11-7z`} fill="#a64736"/><text x={75+i*66} y="93" textAnchor="middle" fontSize="14" fill="#fff1c7">{10-i*2}</text>
        <text x={75+i*66} y="113" textAnchor="middle" className="common-small">{phase===game.turn.phase ? "현재" : `${game.market.phaseGoods[phase].length}개`}</text>
      </g>)}
      <g data-round-goods="true"><text x="60" y="143" className="common-small">라운드 상품 · 공급 완료 / 다음 공급</text>
      {Array.from({length:5},(_,i)=>{const goods=game.market.roundGoods[i-(5-game.market.roundGoods.length)];return <g key={i} data-round-supply={i+1}><rect x={55+i*66} y="149" width="54" height="68" rx="5" fill={game.turn.round===i+1?"#f4dda1":"none"} stroke={game.turn.round===i+1?"#9b7135":"none"}/><text x={82+i*66} y="211" textAnchor="middle" fontSize="9" fill="#665035">{i+1}R{i>=5-game.market.roundGoods.length?" 대기":" 공급완료"}</text>{goods ? <GoodsArt value={goods.type} x={56+i*66} y={150} width="52" height="52"/> : i>=5-game.market.roundGoods.length ? <GoodsBackArt x={56+i*66} y={150} width="52" height="52" aria-label="미공개 라운드 상품"/> : <rect x={56+i*66} y={150} width="52" height="52" rx="2" fill="#e3dec0" stroke="#c6bb93" strokeDasharray="3 3"/>}</g>;})}
      </g><text x="565" y="44" className="common-small">선박 순서 트랙 · 앞 →</text>
      {trackPositions.map(position=>{const x=570+position*330/(trackPositions.length-1);const space=game.turn.orderTrack.find(s=>s.position===position);return <g key={position}><circle cx={x} cy="82" r="12" fill="#fff9df" stroke="#b7ab83"/><text x={x} y="86" textAnchor="middle" fontSize="9" fill="#918465">{position}</text>{space && [...space.players].reverse().map(id=>{const player=game.players.find(p=>p.id===id)!;const j=space.players.indexOf(id);return <circle key={id} cx={x} cy={82-(space.players.length-1-j)*4} r="9" fill={playerPaint(player).fill} stroke="#f4e5b5"><title>{`${player.name} · 위치 ${position} · 위에서 ${j+1}번째`}</title></circle>;})}</g>;})}
      {game.players.map((p,i)=><g key={p.id}><circle cx={570+(i%2)*165} cy={137+Math.floor(i/2)*35} r="5" fill={playerPaint(p).fill}/><text x={585+(i%2)*165} y={141+Math.floor(i/2)*35} fontSize="11" fill={playerPaint(p).ink}>{p.name.slice(0,8)}{p.id===game.turn.activePlayerId ? " ◀" : ""}</text></g>)}
      <g><WhiteDie x={60} y={265} value={game.dice.whiteDie}/><text x="83" y="269" className="common-small">흰 주사위</text></g>
      {game.market.numberedDepots.map(depot=>{const [baseX,y]=depotCenters[depot.number-1];const x=baseX;return <g key={depot.number} data-depot={depot.number} aria-label={`${depot.number}번 공급처 상품 ${depot.goods.length}개`}>
        <GoodsSpace key={`${game.revision}:${game.turn.pendingChoice?.id}`} number={depot.number} goods={depot.goods} x={x} y={y} options={goodsOptions?.(depot.number)} onAction={onGoods} onSelecting={onGoodsSelecting}/>
        <WhiteDie x={x+(depot.number===2||depot.number===3?52:depot.number===5||depot.number===6?-52:0)} y={y+(depot.number===1||depot.number===4?-52:0)} value={depot.number}/>
        {depot.slots.map((slot,i)=>{const [tx,ty]=slotCenter(depot.number,i,depot.slots.length);return slot.tileId ? selected(slot.tileId,tx,ty,tileWidth,`${depot.number}번 공급처 ${titleFor(slot.tileId)}`) : <g key={slot.id}><polygon points={hex(tx,ty,tileWidth)} fill={terrainPaint[slot.requiredType]} fillOpacity=".45" stroke="#b4ac85" strokeDasharray="3 3"/><title>{`${terrainNames[slot.requiredType]} 빈 공급 칸`}</title></g>;})}
      </g>;})}
      <g transform={`translate(${325-215} ${playCenter.y-398})`}><InnStack width={tileWidth} game={game} onSelect={onSelect} canBuy={id=>!!actionFor(id)}/></g>
      <g data-black-depot="true">
        <text x={playCenter.x} y={playCenter.y-tileHeight*1.25-5} textAnchor="middle" fill="#514636" fontSize="12">검은 공급처 · 은화 2</text>
        {game.market.blackDepot.map((id,i)=>{const [x,y]=blackSlots[i];return <g key={`black-${i}`}><polygon data-black-space={i} points={hex(x,y)} fill="#393b30" stroke="none"/>{id ? selected(id,x,y,tileWidth,`검은 공급처 ${titleFor(id)}`) : <polygon points={hex(x,y,50)} fill="none" stroke="#898168" strokeDasharray="3 3"/>}</g>;})}
      </g>
      <g data-region-score-panel="true" transform={`translate(${layout.panels.left} ${layout.panels.bottom})`}>
        <text x="195" y="29" textAnchor="middle" className="common-small">지역 완성 · 칸 수 / 점수</text>
        {[1,3,6,10,15,21,28,36].map((v,i)=><g key={v} transform={`translate(${60+(i%4)*90} ${56+Math.floor(i/4)*45})`}>
          <text textAnchor="middle" fontSize="11" fill="#665035">{i+1}칸</text><path d="M-16 7h32v17l-16 7-16-7z" fill="#a54431"/><text y="24" textAnchor="middle" fontSize="13" fill="#fff1cb">{v}</text>
        </g>)}
      </g>
      <g data-color-bonuses="true" transform={`translate(${layout.panels.right} ${layout.panels.bottom})`}>
        <text x="195" y="29" textAnchor="middle" className="common-small">지형 전체 완성 · 1위 / 2위</text>
        {(["castle","mine","ship","livestock","building","monastery"] as const).map((type,i)=><g key={type} transform={`translate(${24+(i%2)*176} ${43+Math.floor(i/2)*33})`}>
          <rect width="166" height="28" rx="9" fill={terrainPaint[type]} stroke="#877c4f"/>
          <text x="83" y="11" textAnchor="middle" fontSize="10" fill="#fff6d6">{terrainNames[type]}</text>
          <text x="83" y="23" textAnchor="middle" fontSize="11" fill="#fff6d6">{["first","second"].map(rank=>{const b=game.market.bonusTiles.find(b=>b.color===type&&b.rank===rank);return b ? b.points : "완료";}).join(" / ")}</text>
        </g>)}
      </g>
      {shields && game.market.numberedDepots.map(depot=>{
        const slots=shields.slots.filter(s=>s.depot===depot.number);const [cx,cy]=shieldCenters[depot.number-1];
        const [dx]=shieldDepotCenters[depot.number-1];
        const zoneHeight=slots.length===2?172:104;
        const linkDirection=Math.sign(dx-cx);
        return <g key={`shields-${depot.number}`} data-shield-depot={depot.number} aria-label={`${depot.number}번 공급처 방패 그룹`}>
          {linkDirection!==0&&<path d={`M${cx+linkDirection*36} ${cy}h${linkDirection*16}`} className="shield-depot-link"/>}
          <rect data-shield-zone={depot.number} x={cx-36} y={cy-zoneHeight/2} width="72" height={zoneHeight} rx="28" fill="#b9bcb0" fillOpacity=".38" stroke="#929689" pointerEvents="none"/>
          {slots.map((slot,i)=>{const offset=slots.length===2?(i===0?-layout.shieldGap/2:layout.shieldGap/2):0;const x=cx,y=cy+offset;const label=slot.shieldNumber===null?`${depot.number}번 공급처 빈 방패 슬롯`:`${depot.number}번 공급처 ${shieldLabel(slot.shieldNumber)}`;
            return <g key={slot.id} data-shield-slot={slot.id} data-empty={slot.shieldNumber===null} transform={`translate(${x} ${y})`} role={slot.shieldNumber===null?"img":"button"} tabIndex={slot.shieldNumber===null?undefined:0} aria-label={label} aria-pressed={slot.shieldNumber===null?undefined:shieldSelection?.slotId===slot.id} aria-disabled={slot.shieldNumber!==null&&!shieldSelection?.cost(slot.id)} className={slot.shieldNumber===null?"shield-slot empty":`shield-slot occupied ${shieldSelection?.cost(slot.id)?"direct-legal":"direct-unavailable"}`} onClick={slot.shieldNumber===null?undefined:()=>shieldSelection?.onSelect(slot.id)} onKeyDown={slot.shieldNumber===null?undefined:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();shieldSelection?.onSelect(slot.id);}}}>
              <title>{label}{slot.shieldNumber===null?" · 보충 없음":(shields.effectsActive?" · 장착 시 능력 활성":" · 능력은 검증 모드에서 미적용")}</title><ShieldArt number={slot.shieldNumber}/>{showCosts&&slot.shieldNumber!==null&&<g className="direct-cost"><rect x="-29" y="23" width="58" height="16" rx="5"/><text y="35" textAnchor="middle">{shieldSelection?.cost(slot.id)?`일꾼 ${costFor(shieldSelection.cost(slot.id)!)}`:"불가"}</text></g>}{(i===0)&&<text y={-40} textAnchor="middle" className="shield-depot-number">{depot.number}번</text>}
            </g>;})}
        </g>;})}
      <text x={475} y={1020} textAnchor="middle" className="common-small">{game.turn.phase}단계 · {game.turn.round}라운드</text>
    </svg></div></BoardViewport>
  </section>;
}
