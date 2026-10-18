"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { shieldLayout, hasShield, type ShieldAcquireAction } from "../game/shields";
import { shieldLabel, MountedShield, ShieldDetails } from "./shield-art";
import type { GameAction, GameState, PlayerState, PlayerColor, TileType } from "../game/types";
import { applyCoreAction, validateCoreAction, orderedPlayers, checkCoreGameEnd } from "../game/core";
import { goodsSaleReward } from "../game/core/intents";
import { monasteryNumbers } from "../game/core/state";
import { EstateTile, EstateGrid } from "./estate-tile";
import { estateCenter, estatePoints } from "./estate-geometry";
import { BoardViewport } from "./board-viewport";
import { CommonBoard } from "./common-board";
import { GoodsArt, TileArt } from "./tile-art";
import { createPracticeSession, practiceBoard } from "../game/practice";
import { getSelectableBoards, VERIFIED_BOARD_DEFINITIONS } from "../game/boards/catalog";
import { parseSavedGame, serializeSavedGame, type SavedGame } from "../game/save";
import { chooseComputerAction } from "../game/computer";
import { directActions, cheapestDieAction, directShieldActions, directCost, automaticAction } from "../game/direct-actions";
import { BORDER_POSTS, connectedPostPairs, hasExtension } from "../game/core/border-posts";

const tileInfo: Record<TileType, { name: string; icon: string; color: string }> = {
  castle: { name: "성", icon: "♜", color: "#6a896e" }, ship: { name: "선박", icon: "⚓", color: "#6c99aa" },
  livestock: { name: "가축", icon: "♧", color: "#a2ac76" }, building: { name: "건물", icon: "⌂", color: "#cbac82" },
  mine: { name: "광산", icon: "⚒", color: "#92929b" }, monastery: { name: "수도원", icon: "✦", color: "#d2bc70" },
};
const tableColors: Record<TileType, string> = { castle: "#247d62", ship: "#279db9", livestock: "#98bc45", building: "#c3a545", mine: "#a09f97", monastery: "#e2d337" };
const buildingNames = { crane: "기중기", bank: "은행", "boarding-house": "숙소", watchtower: "감시탑", market: "시장", "carpenters-workshop": "목공소", church: "교회", warehouse: "창고", "town-hall": "시청" };
const playerColor = (p: PlayerState) => ({blue:"#298dc7",red:"#d6624c",green:"#83ab65",yellow:"#dbbe52"})[p.color??(["blue","red","green","yellow"] as const)[p.seat]];
const initialNames = ["엘레오노르", "루이", "마리", "필리프"];
const actionNames: Record<string, string> = { "buy-workers": "수도원28 · 은화로 일꾼 구매", "use-monastery-six": "수도원6 건물 획득", "resolve-choice": "타일 추가 효과 선택", "advance-phase": "단계 수입·보충 / 최종 정산", "roll-round": "라운드 주사위 굴림·상품 배분", "end-turn": "차례 종료", "buy-black-tile": "검은 공급처 구매", "take-workers": "일꾼 획득", "sell-goods": "상품 판매", "take-tile": "타일 획득", "place-tile": "영지 배치" };

function BoardDie({ x, y, value }: { x: number; y: number; value: number }) {
  const positions: Record<number, readonly (readonly [number, number])[]> = {1:[[0,0]],2:[[-8,-8],[8,8]],3:[[-8,-8],[0,0],[8,8]],4:[[-8,-8],[8,-8],[-8,8],[8,8]],5:[[-8,-8],[8,-8],[0,0],[-8,8],[8,8]],6:[[-8,-10],[8,-10],[-8,0],[8,0],[-8,10],[8,10]]};
  return <g className="board-die" aria-hidden="true"><rect x={x-18} y={y-18} width={36} height={36} rx={6} fill="#fff6ca" stroke="#8f8665" strokeWidth={1.2}/>{positions[value].map(([dx,dy],i)=><circle key={i} cx={x+dx} cy={y+dy} r={3.2} fill="#394b36"/>)}</g>;
}

export default function GameScreen() {
  const [game, setGame] = useState<GameState>(() => createPracticeSession({ names: initialNames.slice(0, 2), seed: "burgundy-practice-1", fullEffects: true, officialSlots: true, boardIds: ["se:base:2", "se:base:2"] }));
  const [logs, setLogs] = useState(["연습을 준비했습니다. 주사위를 굴려 시작하세요."]);
  const [notice, setNotice] = useState("");
  const [saveIssue,setSaveIssue]=useState("");
  const [settings, setSettings] = useState(false);
  const [computerPlayerIds, setComputerPlayerIds] = useState<readonly string[]>([]);
  const [computerPaused, setComputerPaused] = useState(false);
  const [playMode, setPlayMode] = useState("local");
  const [shieldRules,setShieldRules]=useState(false);
  const [shieldTarget,setShieldTarget]=useState("");
  const [shieldDieValue,setShieldDieValue]=useState(1);
  const [shieldPreview,setShieldPreview]=useState(false);
  const [selectedShieldSlot,setSelectedShieldSlot]=useState<string|null>(null);
  const [detailShield,setDetailShield]=useState<number|null>(null);
  const [geese, setGeese] = useState(false);
  const [additionalHexes, setAdditionalHexes] = useState(false);
  const [borderPosts, setBorderPosts] = useState(false);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(initialNames);
  const [boardIds, setBoardIds] = useState(["se:base:2", "se:base:2", "se:base:2", "se:base:2"]);
  const [startingCastleIds, setStartingCastleIds] = useState(["", "", "", ""]);
  const [firstSeat, setFirstSeat] = useState(0);
  const [colors, setColors] = useState<PlayerColor[]>(["blue","red","green","yellow"]);
  const estateArea = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState("burgundy-practice-1");
  const [dieIndex, setDieIndex] = useState(-1);
  const [confirmation,setConfirmation]=useState<GameAction|null>(null);
  const [specialMode,setSpecialMode]=useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [commonZoom, setCommonZoom] = useState(1);
  const [boardZooms, setBoardZooms] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState(false);
  const [tableView, setTableView] = useState(true);
  const [saveReady, setSaveReady] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const storageKey = "burgundy-expanded:local-v1";
  function restore(saved: SavedGame) {
    setShieldPreview(!!shieldLayout(saved.game)&&!shieldLayout(saved.game)?.effectsActive);setShieldRules(!!shieldLayout(saved.game)?.effectsActive);
    setSaveBlocked(false); setGame(saved.game); setComputerPlayerIds(saved.view.computerPlayerIds ?? []); setComputerPaused(saved.view.computerPaused ?? false); setLogs([...saved.logs]); setGlobalZoom(saved.view.zoom); setCommonZoom(saved.view.commonZoom ?? 1); setFocus(saved.view.focus); setTableView(shieldLayout(saved.game) ? true : saved.view.table ?? true); setBoardZooms({ ...saved.view.boardZooms });
    setSelectedShieldSlot(null);
    setSelectedTileId(null);   setDieIndex(-1);  setSettings(false);
  }
  useEffect(() => {
    let saved: SavedGame | undefined;
    let message = "";
    try { const text = localStorage.getItem(storageKey); if (text) saved = parseSavedGame(text); }
    catch { message = "기존 자동 저장을 읽지 못했습니다. 저장 원본은 유지했습니다."; }
    startTransition(() => { if (saved) restore(saved); if (message) { setNotice(message); setSaveBlocked(true); } setSaveReady(true); });
  }, []);
  useEffect(() => {
    if (!saveReady || saveBlocked) return;
    try { localStorage.setItem(storageKey, serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs, view: { zoom: globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, table: tableView } }));startTransition(()=>setSaveIssue("")); }
    catch (error) { startTransition(() => setSaveIssue(error instanceof Error?error.message:"자동 저장 실패")); }
  }, [game, logs, globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, tableView, saveReady, saveBlocked]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),6000);return()=>clearTimeout(timer);},[notice]);
  function exportSave() {
    try {
      const text = serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs, view: { zoom: globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, table: tableView } });
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "burgundy-save.json"; link.click(); URL.revokeObjectURL(url);
    } catch { setNotice("현재 상태를 저장하지 못했습니다."); }
  }
  const actorId = game.turn.activePlayerId ?? orderedPlayers(game)[0];
  const active = game.players.find(p => p.id === actorId)!;
  const dice = game.dice.players[actorId];
  const die = dice[dieIndex];
  const officialOptions = getSelectableBoards();
  const actions=useMemo(()=>directActions(game,actorId),[game,actorId]);
  const dieAction=(match:Parameters<typeof cheapestDieAction>[2])=>!computerTurn?cheapestDieAction(actions,die?.id,match):null;
  const computerTurn = computerPlayerIds.includes(actorId) && !computerPaused;
  const permitted = (action: GameAction | null) => !computerTurn && action !== null && validateCoreAction(game, action).valid;
  const titleFor = (id: string) => { const t = game.tiles[id]; return t.type === "building" ? buildingNames[t.building] : t.type === "livestock" ? `${({cattle:"소",sheep:"양",pigs:"돼지",chickens:"닭",geese:"거위"})[t.species]} ${t.count}마리` : t.type === "monastery" ? `수도원 ${t.number}` : tileInfo[t.type].name; };
  const ending = checkCoreGameEnd(game);
  const shields=shieldLayout(game);
  const shieldOptions=useMemo(()=>new Map((shieldLayout(game)?.slots??[]).map(s=>[s.id,directShieldActions(game,actorId,s.id)])),[game,actorId]);
  const selectedShield=shields?.slots.find(s=>s.id===selectedShieldSlot&&s.shieldNumber!==null);
  const shieldCandidates=selectedShield&&!computerTurn?shieldOptions.get(selectedShield.id)??[]:[];
  function supplyAction(id:string){
    if(computerTurn)return null;
    if(game.market.blackDepot.includes(id))return actions.find(a=>a.type==="buy-black-tile"&&a.tileId===id)??null;
    if(specialMode)return actions.find(a=>a.type==="use-monastery-six"&&a.tileId===id)??null;
    return dieAction(i=>i.kind==="take-tile"&&i.tileId===id);
  }
  function activate(action:GameAction|null){if(!action)return;const choiceShield=action.type==="resolve-choice"?(game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {shield?:{replaceShieldNumber:number|null}}|null)?.shield:null;if(choiceShield?.replaceShieldNumber){setConfirmation(action);return;}if((action.type==="use-die"&&action.intent.kind==="take-tile"&&action.intent.discardTileId)||(action.type==="buy-black-tile"&&action.discardTileId)||(action.type==="use-monastery-six"&&action.discardTileId)||(action.type==="extension"&&(action as ShieldAcquireAction).payload?.replaceShieldNumber))setConfirmation(action);else run(action);}
  function selectSupply(id:string){const a=supplyAction(id);if(!a)return;setSelectedShieldSlot(null);if(active.storage.every(Boolean)){setSelectedTileId(id);setNotice("교체할 보관 타일을 누르세요. 폐기는 확인 후 실행됩니다.");}else activate(a);}
  function selectStorage(id:string|null,index:number){
    if(selectedTileId&&!active.storage.includes(selectedTileId)&&active.storage.every(Boolean)){
      const a=supplyAction(selectedTileId);if(a?.type==="use-die"&&a.intent.kind==="take-tile")activate({...a,intent:{...a.intent,storageSlot:index,discardTileId:id!}});
      else if(a&&(a.type==="buy-black-tile"||a.type==="use-monastery-six"))activate({...a,storageSlot:index,discardTileId:id!});return;
    }
    setSelectedShieldSlot(null);setSelectedTileId(selectedTileId===id?null:id);
  }
  function selectDie(i:number){setSpecialMode(false);setDieIndex(dieIndex===i?-1:i);setSelectedShieldSlot(null);setConfirmation(null);}
  const costLabel=(action:GameAction|null)=>action?`일꾼 ${directCost(game,action)}`:"불가";
  const workersAction=dieAction(i=>i.kind==="take-workers");
  function run(action: GameAction) {
    const result = applyCoreAction(game, action);
    if (!result.ok) { setNotice(result.issues.some(i => i.code === "unresolved-rule") ? "이 효과는 아직 지원하지 않습니다." : "차례, 주사위 눈, 일꾼과 보관 공간을 확인해 주세요."); return; }
    const before = game.players.find(p=>p.id===action.playerId)!, after = result.value.state.players.find(p => p.id === action.playerId)!;
    const delta = [`승점 ${after.victoryPoints - before.victoryPoints >= 0 ? "+" : ""}${after.victoryPoints - before.victoryPoints}`,
      `은화 ${after.silver - before.silver >= 0 ? "+" : ""}${after.silver - before.silver}`, `일꾼 ${after.workers - before.workers >= 0 ? "+" : ""}${after.workers - before.workers}`];
    const label = action.type==="extension"&&action.extensionId==="shields"?(action.command==="change-die"?"방패16 주사위 변경":action.command==="choose-monastery-target"?"방패6 수도원 공유 대상 선택":shields?.effectsActive?"방패 획득·능력 활성":"방패 획득 UI 검증 (능력 미적용)"):actionNames[action.type === "use-die" ? action.intent.kind : action.type];
    setLogs(old => [`${before.name} · ${label}${action.type === "use-die" || action.type === "buy-black-tile" || action.type === "resolve-choice" || action.type === "use-monastery-six" ? ` (${delta.join(" · ")})` : ""}`, ...old].slice(0, 60));
    setSelectedShieldSlot(null);setGame(result.value.state); setNotice(`${before.name} · ${label} (${delta.join(" · ")})`);setConfirmation(null);setSpecialMode(false);
    setDieIndex(-1);
    setSelectedTileId(null);

  }

  const runAutomatic=useEffectEvent((action:GameAction)=>run(action));
  useEffect(()=>{
    if(!saveReady||saveBlocked||settings||computerPlayerIds.includes(actorId)||confirmation)return;
    const action=automaticAction(game,actions);if(!action)return;
    const timer=setTimeout(()=>runAutomatic(action),350);return()=>clearTimeout(timer);
  },[game,actions,saveReady,saveBlocked,settings,actorId,computerPlayerIds,confirmation]);

  const runComputer = useEffectEvent((action: GameAction) => run(action));
  useEffect(() => {
    if (!computerPlayerIds.includes(actorId) || computerPaused || game.status !== "playing" || !saveReady || settings) return;
    const timer = setTimeout(() => {
      const decision = chooseComputerAction(game, actorId);
      if (decision.ok) runComputer(decision.value);
      else { setNotice("AI가 합법 행동을 찾지 못했습니다. 진행을 보존하고 일시정지했습니다."); setComputerPaused(true); }
    }, 450);
    return () => clearTimeout(timer);
  }, [game, actorId, computerPlayerIds, computerPaused, saveReady, settings]);

  function newSession() {
    try {
      const next = createPracticeSession({ names: names.slice(0, count), seed, boardIds: boardIds.slice(0, count), startingCastleIds: startingCastleIds.slice(0,count), firstSeat, colors: colors.slice(0,count), officialSlots: true, fullEffects: true, additionalHexes, geese, borderPosts, shieldPreview, shieldRules });
      if(shieldPreview||shieldRules)setTableView(true);
      setSelectedShieldSlot(null);
      setSaveBlocked(false); setGame(next); setComputerPlayerIds(shieldPreview?[]:playMode === "demo" ? next.players.map(p=>p.id) : playMode === "computer" ? next.players.slice(1).map(p=>p.id) : []); setComputerPaused(false);
      setLogs([`새 연습을 시작했습니다. 첫 차례는 ${next.players[firstSeat].name}입니다.`]); setNotice(""); setSettings(false);  setDieIndex(-1); setSelectedTileId(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "연습 준비에 실패했습니다."); }
  }

  function tileFace(id: string) { return <span className="tile illustrated-tile"><TileArt tile={game.tiles[id]}/></span>; }
  function renderBoard(player: PlayerState) {
    const zoom = (boardZooms[player.id] ?? 1) * globalZoom * (tableView ? .58 : 1);
    const cellActions=new Map(player.duchy.cells.map(cell=>[cell.id,{
      placement:player.id===actorId&&selectedTileId&&active.storage.includes(selectedTileId)?dieAction(i=>i.kind==="place-tile"&&i.tileId===selectedTileId&&i.cellId===cell.id):null,
      shield:player.id===actorId?shieldCandidates.find(a=>a.payload.castleCellId===cell.id):null,
    }]));
    const legal=player.duchy.cells.filter(c=>cellActions.get(c.id)!.placement||cellActions.get(c.id)!.shield).map(c=>c.id);
    const official = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === player.duchy.boardId && b.verification.status === "verified");
    return <section key={player.id} className="panel estate-panel"><div className="estate-heading"><div><span className="eyebrow">YOUR DOMAIN</span><h2 style={tableView?{color:playerColor(player)}:undefined}>{player.name}의 영지 <span className="board-number">{official ? `공식 ${official.officialNumber}` : "비공식 연습 보드"}</span></h2></div><span className="live-status">{player.id === game.turn.activePlayerId ? "● 현재 차례" : "영지 보기"}</span></div>
      {<div className="estate-inventory"><div className="estate-goods">{player.goods.map(g => <button disabled={player.id!==actorId||!dieAction(i=>i.kind==="sell-goods"&&i.goodsType===g.type)} onClick={()=>activate(dieAction(i=>i.kind==="sell-goods"&&i.goodsType===g.type))} className={`goods-chip goods-${g.type}`} key={g.type} title={`${g.type}번 상품 ${g.tiles.length}개`} aria-label={`${g.type}번 상품 ${g.tiles.length}개`}><GoodsArt value={g.type}/><b>×{g.tiles.length}</b>{player.id===actorId&&die&&<small>{costLabel(dieAction(i=>i.kind==="sell-goods"&&i.goodsType===g.type))}</small>}</button>)}<strong className="estate-score">{player.victoryPoints}<small>점</small></strong></div><div className="estate-dice">{game.dice.players[player.id].map((d,i) => <button key={d.id} style={{background:playerColor(player)}} className={`mini-die seat-die-${player.seat}${d.used ? " used" : ""}${player.id === actorId && dieIndex === i ? " chosen" : ""}`} aria-label={`${player.name} 개인 주사위 ${i+1} 눈 ${d.value}`} disabled={computerTurn || player.id !== actorId || game.turn.stage !== "player-turn" || d.used || !!game.turn.pendingChoice} aria-pressed={player.id===actorId&&dieIndex===i} onClick={() => selectDie(i)}>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][d.value]}</button>)}</div><div className="estate-resources"><button aria-label={`${player.name} 일꾼 자원`} disabled={player.id!==actorId||!workersAction} onClick={()=>activate(workersAction)}>♟ 일꾼 <b>{player.workers}</b>{player.id===actorId&&workersAction&&<small> +{monasteryNumbers(game,active).includes(14)?4:2}</small>}</button><span>◈ 은화 <b>{player.silver}</b></span></div></div>}
      <BoardViewport onZoom={delta=>setBoardZooms(old=>({...old,[player.id]:Math.max(.5,Math.min(2,+(Number(old[player.id]??1)+delta).toFixed(2)))}))}><svg className="live-estate-svg" width={620 * zoom} height={565 * zoom} viewBox="0 0 620 565" role="group" aria-label={`${player.name} 영지`}><circle cx="310" cy="282" r="260" fill="#eee9db" stroke="#cfbea0"/>{player.duchy.cells.map(cell => {
        const {x,y}=estateCenter(cell.coord);
        const occupied = cell.tileId ? game.tiles[cell.tileId] : null;
        const {placement,shield}=cellActions.get(cell.id)!;
        const mounted=occupied?.type==="castle"?shields?.mounted.find(m=>m.playerId===player.id&&m.cellId===cell.id):null;
        const canPlace=!!placement||!!shield;
        const select=()=>{if(canPlace)activate(shield??placement);else if(mounted)setDetailShield(mounted.shieldNumber);};
        return <g key={cell.id} data-estate-cell={cell.id} data-q={cell.coord.q} data-r={cell.coord.r} role="button" tabIndex={canPlace||mounted?0:-1} aria-disabled={!canPlace&&!mounted} aria-label={`${player.name} ${cell.id} ${tileInfo[cell.terrain].name} ${cell.number}${occupied ? ` 배치됨 ${titleFor(cell.tileId!)}` : " 빈칸"}${canPlace ? ` 배치 가능 ${costLabel(shield??placement)}` : ""}${mounted?` · 장착 방패 ${mounted.shieldNumber}`:""}`} onClick={select} onKeyDown={e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); select(); } }} className={`hex-cell${canPlace?" direct-legal":""}`}>
          <polygon data-estate-fill="true" points={estatePoints(cell.coord)} fill={tableView ? tableColors[occupied?.type ?? cell.terrain] : tileInfo[occupied?.type ?? cell.terrain].color} fillOpacity={1} stroke="none"/>
          {occupied ? <EstateTile tile={occupied} coord={cell.coord}/> : tableView ? <BoardDie x={x} y={y} value={cell.number}/> : <text x={x} y={y + 6} className="hex-number">{cell.number}</text>}{mounted&&<MountedShield number={mounted.shieldNumber} tileId={cell.tileId!} x={x} y={y}/>}{!occupied && <text x={x} y={y + 27} className="hex-label">{tileInfo[cell.terrain].name}</text>}
        </g>;
      })}<EstateGrid cells={player.duchy.cells} legal={legal}/>{legal.map(id=>{const cell=player.duchy.cells.find(c=>c.id===id)!,{x,y}=estateCenter(cell.coord),a=cellActions.get(id)!;return <g key={id} pointerEvents="none" className="direct-cost"><rect x={x-29} y={y-45} width="58" height="16" rx="6"/><text x={x} y={y-33} textAnchor="middle">{costLabel(a.shield??a.placement)}</text></g>;})}{hasExtension(game,"border-posts") && BORDER_POSTS.map(post=><g key={post.id} aria-label={`국경 초소 ${post.id}`}><circle cx={post.x} cy={post.y} r="13" fill="#a64335" stroke="#f7dc89" strokeWidth="3"/><text x={post.x} y={post.y+5} textAnchor="middle" fontSize="15" fill="#fff4ce">♜</text></g>)}</svg></BoardViewport>{<div className="estate-keyspaces" aria-label={`${player.name} 타일 보관함`}>{player.storage.map((id,i) => <button key={i} className={`keyspace ${id && selectedTileId === id ? "selected" : ""}`} aria-label={`${player.name} 개인 보관 ${i+1} ${id ? titleFor(id) : "빈칸"}`} disabled={id === null || player.id !== actorId} onClick={() => selectStorage(id,i)}>{id ? tileFace(id) : <span>◇</span>}</button>)}</div>}<div className="board-bottom"><span>{player.duchy.cells.filter(c => c.tileId).length} / {player.duchy.cells.length} · {player.victoryPoints}점{hasExtension(game,"border-posts") ? ` · 초소 연결 ${connectedPostPairs(player).length}/3` : ""}</span><div className="live-zoom"><button aria-label={`${player.name} 영지 축소`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.max(.5, +(Number(z[player.id] ?? 1) - .1).toFixed(2)) }))}>−</button><span>{Math.round((boardZooms[player.id] ?? 1) * 100)}%</span><button aria-label={`${player.name} 영지 확대`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.min(2, +(Number(z[player.id] ?? 1) + .1).toFixed(2)) }))}>+</button></div></div></section>;
  }

  const boards = focus ? [active, ...game.players.filter(p => p.id !== actorId)] : game.players;
  return <main data-game-revision={game.revision} data-shields-active={shields?.effectsActive||undefined} className={`app-shell direct-input ${tableView ? "table-view" : ""}`}>
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">♜</span><span>BURGUNDY <b>EXPANDED</b><small>THE ART OF BUILDING AN ESTATE</small></span></Link><div className="header-right"><Link className="outline-button" href="/online">2인 온라인 방</Link><span className="demo-tag">부분 기본판 · 연습 공급</span><button className="outline-button" disabled={!!shieldLayout(game)} title={shieldLayout(game)?"방패 검증 모드는 공용 보드의 테이블 보기를 사용합니다.":undefined} onClick={() => setTableView(v => !v)}>{tableView ? "기존 디자인 보기" : "테이블 보기"}</button><button className="settings-button" aria-expanded={settings} onClick={() => setSettings(!settings)}>⚙ 게임 준비</button></div></header>
    <section className="intro"><div><div className="eyebrow">THE LOIRE VALLEY · 15TH CENTURY</div><h1>위대한 영지는, 작은 선택에서.</h1><p>{game.turn.stage === "round-setup" ? "라운드를 준비하고 있습니다." : game.status === "finished" ? "E단계까지 마쳤습니다. 최종 점수와 승자를 확인하세요." : game.turn.stage === "phase-end" ? "단계 수입과 필수 효과를 처리합니다." : `${active.name}의 차례 · 남은 주사위 ${dice.filter(d => !d.used).length}개`}</p></div><div className="round-display"><span>단계 · 라운드</span><strong>{game.turn.phase} · {game.turn.round}<em> / 5</em></strong></div></section>
    <details className="live-scope"><summary>기본판 연습 · 규칙 지원 범위와 공급 안내</summary><p>공식 전체 게임 준비는 아직 지원하지 않습니다. 공식 영지 {officialOptions.length}개 검증 완료 · {game.config.catalogId === "project:base-160-v1" ? "사용자 지정 가축 구성" : "공급 타일은 연습 구성"} · {game.config.marketRecipeId === "se:main:2" ? "사진 기준 2인 슬롯 · 프로젝트 타일 160개" : game.config.marketRecipeId ? "3·4인 공식 슬롯" : "자체 연습 슬롯"} · 시작 플레이어 선택 가능 · 진행·보기 설정 자동 저장.</p><p>{game.config.extensions.some(e=>e.id==="additional-hexes") ? "선택 추가 타일: 수도원27/28·기중기·거위 활성. " : ""}지원: 네 가지 행동·전체 기본 타일 효과·성/시청 연쇄·수도원1~26. A~E 진행과 최종 정산을 지원하며 2인은 사용자 지정 타일 구성으로 보충합니다.</p></details>
    {settings && <section className="settings-panel live-setup"><h2>게임 준비</h2><label><input type="checkbox" checked={shieldRules} onChange={e=>{setShieldRules(e.target.checked);if(e.target.checked){setShieldPreview(false);}}}/> 방패 확장 · 18종 능력·유지비·종료 점수 (로컬)</label><label><input type="checkbox" checked={shieldPreview} onChange={e=>{setShieldPreview(e.target.checked);if(e.target.checked){setPlayMode("local");setShieldRules(false);}}}/> 방패 UI 검증 모드 (능력·유지비 미구현, 로컬 전용)</label><label><input type="checkbox" checked={additionalHexes} onChange={e=>setAdditionalHexes(e.target.checked)}/> 추가 타일 · 수도원27/28·기중기·거위</label><label>플레이 방식 <select aria-label="플레이 방식" disabled={shieldPreview} value={shieldPreview?"local":playMode} onChange={e=>setPlayMode(e.target.value)}><option value="local">로컬 · 번갈아 플레이</option><option value="computer">일반 AI 상대</option><option value="demo">AI 시연 · 모두 자동</option></select></label><p>일반 AI는 프로젝트 자체 상대이며 공식 샤토마·솔로 규칙과 다릅니다.</p><label><input type="checkbox" checked={geese} onChange={e=>setGeese(e.target.checked)}/> 거위 타일 (검은 뒷면 1개)</label><label><input type="checkbox" checked={borderPosts} onChange={e=>setBorderPosts(e.target.checked)}/> 국경 초소 연결 · 단계 점수와 선착순 보너스</label><label>플레이어 수 <select aria-label="플레이어 수" value={count} onChange={e => { setCount(Number(e.target.value)); setFirstSeat(s=>Math.min(s,Number(e.target.value)-1)); }}>{[2,3,4].map(n => <option key={n} value={n}>{n}명{n>2?" · 연습 공급":""}</option>)}</select></label><label>주사위 시드 <input maxLength={128} value={seed} onChange={e => setSeed(e.target.value)}/></label>{names.slice(0, count).map((name, i) => <div className="setup-seat" key={i}><label>좌석 {i + 1} 이름 <input value={name} maxLength={30} onChange={e => setNames(old => old.map((n, j) => j === i ? e.target.value : n))}/></label><label>색상 <select aria-label={`좌석 ${i+1} 색상`} value={colors[i]} onChange={e=>setColors(old=>old.map((c,j)=>j===i?e.target.value as PlayerColor:c))}>{(["blue","red","green","yellow"] as const).map((c,k)=><option value={c} key={c}>{["파랑","빨강","초록","노랑"][k]}</option>)}</select></label><label>시작 성 <select aria-label={`좌석 ${i+1} 시작 성`} value={startingCastleIds[i]} onChange={e=>setStartingCastleIds(old=>old.map((c,j)=>j===i?e.target.value:c))}><option value="">권장 시작 성</option>{(VERIFIED_BOARD_DEFINITIONS.find(b=>b.id===boardIds[i])??practiceBoard(i%2)).startingCastle.allowedCellIds.map(id=><option value={id} key={id}>성 {id}</option>)}</select></label><label>영지 <select aria-label={`좌석 ${i + 1} 영지 선택`} value={boardIds[i]} onChange={e => { setBoardIds(old => old.map((id, j) => j === i ? e.target.value : id)); setStartingCastleIds(old=>old.map((id,j)=>j===i?"":id)); }}><option value="">자체 제작 연습 영지 (비공식)</option>{officialOptions.length === 0 && <option disabled value="unavailable">공식 영지 · 검증된 데이터 없음</option>}{officialOptions.map(b => <option key={b.id} value={b.id}>영지 {b.officialNumber}{b.family === "base" ? " · 기본" : " · 추가 지형"}</option>)}</select></label></div>)}<label>시작 플레이어 <select aria-label="시작 플레이어" value={firstSeat} onChange={e=>setFirstSeat(Number(e.target.value))}>{names.slice(0,count).map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label><p>공식 규칙의 최고 주사위 눈으로 시작 플레이어를 정한 뒤 선택하세요. 최고 눈 동률 처리 방식은 임의로 정하지 않습니다.</p><p>새 연습 시작은 현재 화면의 진행을 초기화합니다. 영지 1~30을 선택할 수 있습니다. 초소 규칙은 위 선택으로 활성화할 수 있습니다. 11~18번의 선택적 같은 지형·성 연결 조건은 아직 미적용입니다.</p><button onClick={newSession}>새 연습 시작</button></section>}
    {computerPlayerIds.length>0 && <section className="live-scope computer-status" aria-label="일반 AI 상태"><strong>일반 AI · {computerPlayerIds.map(id=>game.players.find(p=>p.id===id)?.name).join(", ")}</strong><span>{game.status === "finished" ? "게임 종료 · 자동 진행 완료" : computerPaused ? "일시정지 · 수동 조작 가능" : computerTurn ? "생각하는 중…" : "사람의 차례"}</span><button className="outline-button" disabled={game.status === "finished"} onClick={()=>setComputerPaused(p=>!p)}>{computerPaused ? "AI 계속 진행" : "AI 일시정지"}</button></section>}
    <div className="live-view-controls"><button className="outline-button" onClick={()=>{const width=estateArea.current?.clientWidth??620;const columns=width>760?Math.min(2,game.players.length):1;setGlobalZoom(Math.max(.5,Math.min(2,(width/columns-30)/(620*(tableView?.58:1)))));setBoardZooms({});}}>화면 맞춤</button><small>Alt+드래그 이동 · Ctrl+휠 영지 확대</small><button className="outline-button" onClick={() => setFocus(!focus)}>{focus ? "전체 영지 모드로" : "현재 차례 중심 모드로"}</button><label>전체 배율 <input aria-label="전체 배율" type="range" min={50} max={200} value={Math.round(globalZoom * 100)} onChange={e => setGlobalZoom(Number(e.target.value) / 100)}/>{Math.round(globalZoom * 100)}%</label><button className="outline-button" onClick={() => { setGlobalZoom(1); setBoardZooms({}); }}>기본 배율 복원</button></div>
    <section className="live-scope" aria-label="저장과 게임 진행"><button className="outline-button" onClick={exportSave} disabled={!saveReady}>저장 파일 내보내기</button><label> 저장 파일 불러오기 <input aria-label="저장 파일 불러오기" type="file" accept=".json,application/json" disabled={!saveReady} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 2_000_000) throw new Error("저장 파일은 2MB 이하여야 합니다."); const saved = parseSavedGame(await file.text()); restore(saved); setNotice("저장한 진행을 불러왔습니다."); } catch { setNotice("저장 파일을 불러오지 못했습니다. 현재 진행은 유지됩니다."); } }}/></label></section>
    {ending.ok && ending.value.ended && <section className="panel live-scope" aria-label="게임 결과"><h2>게임 종료 · {ending.value.winnerIds.map(id => game.players.find(p => p.id === id)!.name).join(", ")} 승리</h2>{ending.value.scores.map(s => <p key={s.playerId}>{game.players.find(p => p.id === s.playerId)!.name}: {s.earnedTotal} + 종료 점수 {s.finalAdditionsTotal} = <strong>{s.total}점</strong></p>)}</section>}
    {game.turn.pendingChoice && <section className="panel live-scope choice-panel" aria-label="타일 효과 선택"><h2>{game.turn.pendingChoice.source.section === "Ship goods" ? "선박 · 상품 선택" : game.turn.pendingChoice.source.section==="Shield abilities"?"방패 · 능력/유지비 선택":game.turn.pendingChoice.source.section}</h2><p>추가 주사위 없이 즉시 효과를 선택하세요. 선택이 끝나면 차례를 계속 진행합니다. 방패 유지비는 광산 수입 전에 지불합니다. 방패를 제거하면 해당 능력도 즉시 종료됩니다.</p><div>{game.turn.pendingChoice.options.map(o => <button className="outline-button" key={o.id} onClick={() => activate({ type: "resolve-choice", playerId: actorId, choiceId: game.turn.pendingChoice!.id, optionId: o.id })}>{o.label}</button>)}</div></section>}
    {saveIssue&&<p role="alert" className="live-scope">자동 저장 실패: {saveIssue} · 저장 파일 내보내기로 진행을 보관하세요.</p>}
    {detailShield!==null&&<ShieldDetails number={detailShield} active={!!shields?.effectsActive} onClose={()=>setDetailShield(null)}/>}
    {notice && <p role="status" className="direct-toast">{notice}</p>}
    {game.status!=="finished"&&<section className="direct-toolbar" aria-label="직접 게임 조작"><strong>{active.name}</strong><div className="direct-dice">{dice.map((d,i)=><button key={d.id} aria-label={`행동 주사위 ${i+1} 눈 ${d.value}${d.used?" 사용됨":""}`} aria-pressed={dieIndex===i} disabled={computerTurn||d.used||game.turn.stage!=="player-turn"||!!game.turn.pendingChoice} onClick={()=>selectDie(i)}>{["","⚀","⚁","⚂","⚃","⚄","⚅"][d.value]}</button>)}</div><button className="direct-worker" aria-label="일꾼 자원" disabled={!workersAction} onClick={()=>activate(workersAction)}>♟ <strong aria-label="현재 일꾼">{active.workers}</strong>{workersAction&&<small>+{monasteryNumbers(game,active).includes(14)?4:2}</small>}</button><span>◈ <b aria-label="현재 은화">{active.silver}</b></span><small className="direct-selection">{selectedShield?`방패 ${selectedShield.shieldNumber} → 성 선택`:selectedTileId?titleFor(selectedTileId):die?`주사위 ${die.value} → 대상 터치`:"주사위를 선택하세요"}</small>{(selectedTileId||selectedShield)&&<button aria-label="선택 취소" onClick={()=>{setSelectedTileId(null);setSelectedShieldSlot(null);setConfirmation(null);}}>×</button>}<details className="direct-special"><summary>특수 행동</summary><label><input type="checkbox" checked={specialMode} onChange={e=>{setSpecialMode(e.target.checked);setDieIndex(-1);}}/>수도원6 · 일꾼2 건물 획득</label><button disabled={!permitted({type:"buy-workers",playerId:actorId})} onClick={()=>run({type:"buy-workers",playerId:actorId})}>수도원28 · 은화1 → 일꾼2</button></details>{permitted({type:"end-turn",playerId:actorId})&&!automaticAction(game,actions)&&<button onClick={()=>run({type:"end-turn",playerId:actorId})}>추가 행동 없이 다음 차례</button>}</section>}
    <div className="direct-goods" aria-label="판매 상품">{active.goods.map(g=>{const a=dieAction(i=>i.kind==="sell-goods"&&i.goodsType===g.type),reward=goodsSaleReward(game,active,g.tiles.length);return <button key={g.type} aria-label={`${g.type}번 상품 ${g.tiles.length}개 판매`} disabled={!a} onClick={()=>activate(a)}><GoodsArt value={g.type}/><span>×{g.tiles.length}<small>{die?`${costLabel(a)} · `:""}은화+{reward.silver} · {reward.points}점</small></span></button>;})}</div>
    {confirmation&&<section role="alertdialog" aria-label="교체 확인" className="direct-confirm"><p>기존 타일 또는 방패가 영구 제거됩니다. 교체하시겠습니까?</p><button onClick={()=>{const a=confirmation;setConfirmation(null);run(a);}}>교체 확정</button><button onClick={()=>setConfirmation(null)}>취소</button></section>}
    <div className="game-layout">
      {shields && <section className="shield-controls" aria-label="방패 배치 검증">
        <strong>{shields.effectsActive?"방패 확장 · 능력 적용 중":"방패 UI 검증 모드 · 공식 확장 플레이 아님"}</strong><p>{shields.effectsActive?"능력은 성에 장착된 동안 적용됩니다. 단계 말 직접 배치와 유지비 선택을 마친 뒤 광산 수입·최종 정산을 처리합니다.":"방패 능력·종료 점수·유지비는 아직 적용되지 않습니다."} 획득에는 두 행동 주사위와 보정 일꾼을 사용합니다. 획득한 방패는 다시 보충하지 않습니다.</p>
        {die&&!selectedShield&&![...shieldOptions.values()].some(a=>a.length>0)&&<p role="status">{!active.duchy.cells.some(c=>c.tileId&&game.tiles[c.tileId]?.type==="castle")?"방패를 장착할 자신의 성 타일이 없습니다.":dice.filter(d=>!d.used).length<2?"방패 획득에는 사용하지 않은 주사위 두 개가 필요합니다.":"현재 획득 가능한 방패가 없습니다. 일꾼 비용과 필수 선택을 확인하세요."}</p>}
        {selectedShield && <p role="status">{shieldLabel(selectedShield.shieldNumber!)} · 장착할 성을 누르세요 · {costLabel(shieldCandidates[0]??null)}</p>}
        {shields.effectsActive && <div className="shield-rule-tools">
          {hasShield(game,actorId,9)&&monasteryNumbers(game,active).includes(3)&&<p role="status">사용자 확정 프로젝트 규칙: 방패9 판매 은화에 수도원3의 은화 1개를 추가합니다.</p>}
          {shields.mounted.filter(m=>m.shieldNumber===6).map(m=><div key={m.shieldNumber}><strong>{game.players.find(p=>p.id===m.playerId)?.name} · 방패6</strong>{shields.rules!.monasteryTarget?<p>수도원 공유 대상: {game.players.find(p=>p.id===shields.rules!.monasteryTarget)?.name} · 상대 수도원27 제외</p>:<><label>수도원 공유 대상 <select aria-label="방패6 수도원 공유 대상" value={shieldTarget} onChange={e=>setShieldTarget(e.target.value)}><option value="">플레이어 선택</option>{game.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="outline-button" disabled={!shieldTarget||!permitted({type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId:m.playerId,payload:{targetPlayerId:shieldTarget}})} onClick={()=>run({type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId:m.playerId,payload:{targetPlayerId:shieldTarget}})}>방패6 대상 확정 (변경 불가)</button></>}</div>)}
          {hasShield(game,actorId,16)&&<div><label>방패16 변경할 눈 <select aria-label="방패16 변경할 눈" value={shieldDieValue} onChange={e=>setShieldDieValue(Number(e.target.value))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>{dice.map((d,i)=>{const action:GameAction={type:"extension",extensionId:"shields",command:"change-die",playerId:actorId,payload:{dieId:d.id,value:shieldDieValue}};return <button key={d.id} className="outline-button" disabled={!permitted(action)} onClick={()=>run(action)}>방패16 · 주사위 {i+1} 변경</button>;})}</div>}
        </div>}
        <div aria-label="장착 방패">{shields.mounted.length?shields.mounted.map(m=><span key={`${m.playerId}:${m.cellId}`}>{game.players.find(p=>p.id===m.playerId)?.name} · 성 {m.cellId} · {shieldLabel(m.shieldNumber)} {shields.effectsActive?" (능력 적용 중)":" (능력 미적용)"}</span>):"장착한 방패 없음"}</div>
      </section>}
      <CommonBoard shieldSelection={{slotId:selectedShieldSlot,onSelect:id=>{if(die&&!computerTurn&&shieldOptions.get(id)?.length){setSelectedShieldSlot(selectedShieldSlot===id?null:id);setSelectedTileId(null);}},cost:id=>die&&!computerTurn?shieldOptions.get(id)?.[0]??null:null}} game={game} selectedTileId={selectedTileId} onSelect={selectSupply} titleFor={titleFor} zoom={commonZoom} onZoom={setCommonZoom} showCosts={!!die} actionFor={supplyAction}/>
      <div className="live-estates" ref={estateArea}>{boards.map(renderBoard)}</div>

    </div>
    <details className="panel compact-log"><summary>행동과 점수 기록 · {logs.length}개</summary><div className="logs live-logs">{logs.map((message,i)=><p key={i}>{message}</p>)}</div></details>
    <footer><span>♜ BURGUNDY EXPANDED</span><p>자체 SVG · 연습 공급 · 공식 기본판 전체 게임 미완성</p><span>모든 행동은 규칙 검사 후 실행됩니다.</span></footer>
  </main>;
}
