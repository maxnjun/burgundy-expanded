"use client";
import {GuidanceSetting,usePinnedGuidance} from "./guidance-settings";
import {EarnedBonusTiles,RewardChoiceLabel} from "./reward-art";
import {ActionLog} from "./action-log";
import {createActionLog,readActionLog} from "../game/action-log";
import {ShieldUpkeep,isShieldUpkeep} from "./shield-upkeep";
import {PersonalScorePages} from "./score-pages";
import {WhiteDie} from "./white-die";
import {ShieldDieChange,ShieldPairDice} from "./shield-dice";
import {PlacementCost} from "./placement-cost";
import {playerPaint} from "../game/player-colors";
import {startingCastlePending} from "../game/starting-castles";
import {GoodsInventory,SoldGoods,PlayerTileStorage} from "./player-inventory";
import {FinalScores} from "./final-scores";
import {TileEncyclopedia} from "./tile-encyclopedia";
import {tileHelpId} from "../game/tile-help";
import { LIVESTOCK_NAMES } from "../game/tile-help";
import { ResourceIcon } from "./resource-icon";
import {VineyardBoard,VineyardSupply} from "./vineyard-board";
import {GRAPES,GRAPE_NAMES,type Grape,keyOccupant} from "../game/vineyards";
import {TradeRoutePanel} from "./trade-route-panel";
import { LocalBoardDraft } from "./board-choices";

import { startTransition, useEffect, useEffectEvent, useCallback, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { shieldLayout, hasShield } from "../game/shields";
import { shieldLabel, MountedShield, ShieldDetails } from "./shield-art";
import type { GameAction, GameState, PlayerState, PlayerColor, TileType } from "../game/types";
import { applyCoreAction, validateCoreAction, orderedPlayers, checkCoreGameEnd } from "../game/core";
import {isCastleAction} from "../game/castle-actions";
import { monasteryNumbers } from "../game/core/state";
import { hasTileFrame } from "./tile-frame";
import { EstateTile, EstateGrid } from "./estate-tile";
import { estateCenter, estatePoints } from "./estate-geometry";
import { BoardViewport } from "./board-viewport";
import { TurnControls } from "./turn-controls";
import {actionGuidance,canEndTurn} from "../game/action-guidance";
import {restoreTurnHistory,serializeTurnHistory} from "../game/turn-history-cache";
import {beginHistory,recordTurnAction,undoTurn,canUndoTurn} from "../game/turn-history";
import { CommonBoard } from "./common-board";
import { createPracticeSession,publicPhaseGoods } from "../game/practice";
import { getSelectableBoards, VERIFIED_BOARD_DEFINITIONS } from "../game/boards/catalog";
import { parseSavedGame, serializeSavedGame, type SavedGame } from "../game/save";
import { chooseComputerAction } from "../game/computer";
import { directActions, directBoardAction, boardTarget, directShieldActions, directCost, automaticAction } from "../game/direct-actions";
import { FortressMarkers } from "./fortress-markers";
import { fortressLinesFor } from "../game/boards/fortress-lines";

const tileInfo: Record<TileType, { name: string; icon: string; color: string }> = {
  castle: { name: "성", icon: "♜", color: "#6a896e" }, ship: { name: "선박", icon: "⚓", color: "#6c99aa" },
  livestock: { name: "가축", icon: "♧", color: "#a2ac76" }, building: { name: "건물", icon: "⌂", color: "#cbac82" },
  mine: { name: "광산", icon: "⚒", color: "#92929b" }, monastery: { name: "수도원", icon: "✦", color: "#d2bc70" },
};
const tableColors: Record<TileType, string> = { castle: "#247d62", ship: "#279db9", livestock: "#98bc45", building: "#c3a545", mine: "#a09f97", monastery: "#e2d337" };
const buildingNames = { "white-castle": "흰 성", crane: "기중기", bank: "은행", "boarding-house": "숙소", watchtower: "감시탑", market: "시장", "carpenters-workshop": "목공소", church: "교회", warehouse: "창고", "town-hall": "시청" };
const playerColor = (p: PlayerState) => playerPaint(p).fill;
const initialNames = ["엘레오노르", "루이", "마리", "필리프"];


export default function GameScreen() {
  const [pinnedGuidance,setPinnedGuidance]=usePinnedGuidance();
  const [game, setGame] = useState<GameState>(() => createPracticeSession({ chooseStartingCastles:true,names: initialNames.slice(0, 2), seed: "burgundy-practice-1", geese:true, fullEffects: true, officialSlots: true, boardIds: ["se:base:2", "se:base:2"] }));
  const [logs, setLogs] = useState(["연습을 준비했습니다. 주사위를 굴려 시작하세요."]);
  const [history,setHistory]=useState(()=>beginHistory(game,[]));
  const [notice, setNotice] = useState("");
  const [saveIssue,setSaveIssue]=useState("");
  const [draftEnabled,setDraftEnabled]=useState(false),[boardDraftReady,setBoardDraftReady]=useState(false);
  const boardsChosen=useCallback((ids:(string|null)[])=>{setBoardDraftReady(ids.every(Boolean));setBoardIds(old=>old.map((id,i)=>ids[i]??id));},[]);
  useEffect(()=>{try{if(localStorage.getItem("burgundy-expanded:board-draft-v1"))startTransition(()=>setDraftEnabled(true));}catch{/* Existing save diagnostics report unavailable browser storage. */}},[]);
  const [settings, setSettings] = useState(false);
  const [computerPlayerIds, setComputerPlayerIds] = useState<readonly string[]>([]);
  const [computerPaused, setComputerPaused] = useState(false);
  const [playMode, setPlayMode] = useState("local");
  const [shieldRules,setShieldRules]=useState(false);
  const [shieldTarget,setShieldTarget]=useState("");
  const [pairDie,setPairDie]=useState("");
  const [shieldPreview,setShieldPreview]=useState(false);
  const [selectedShieldSlot,setSelectedShieldSlot]=useState<string|null>(null);
  const [detailShield,setDetailShield]=useState<number|null>(null);
  const [geese, setGeese] = useState(true);
  const [additionalHexes, setAdditionalHexes] = useState(false);
  const [whiteCastles, setWhiteCastles] = useState(false);
  const [inns, setInns] = useState(false);
  const [vineyards,setVineyards]=useState(false);
  const [excludedGrapes,setExcludedGrapes]=useState<Grape[]>([]);
  const [tradeRoutes,setTradeRoutes]=useState(false);
  const [borderPosts, setBorderPosts] = useState(false);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(initialNames);
  const [boardIds, setBoardIds] = useState(["se:base:2", "se:base:2", "se:base:2", "se:base:2"]);
  const [firstSeat, setFirstSeat] = useState(0);
  const [colors, setColors] = useState<PlayerColor[]>(["blue","red","green","yellow"]);
  const estateArea = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState("burgundy-practice-1");
  const [dieIndex, setDieIndex] = useState(-1);
  const [selectedVineTileId,setSelectedVineTileId]=useState<string|null>(null);
  const [vineRotation,setVineRotation]=useState(0);
  const dispatched=useRef<GameState|null>(null);
  const [confirmation,setConfirmation]=useState<GameAction|null>(null);
  const [specialMode,setSpecialMode]=useState(false);
  const [purchaseMode,setPurchaseMode]=useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [commonZoom, setCommonZoom] = useState(1);
  const [boardZooms, setBoardZooms] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState(false);
  const [tableView, setTableView] = useState(true);
  const [saveReady, setSaveReady] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const storageKey = "burgundy-expanded:local-v1";
  const historyKey = "burgundy-expanded:turn-history-v1";
  function restore(saved: SavedGame, cachedHistory:string|null=null) {
    dispatched.current=null;
    setSelectedVineTileId(null);
    setHistory(restoreTurnHistory(cachedHistory,saved.game,saved.logs));
    setConfirmation(null);setSpecialMode(false);setPurchaseMode(false);
    setShieldPreview(!!shieldLayout(saved.game)&&!shieldLayout(saved.game)?.effectsActive);setShieldRules(!!shieldLayout(saved.game)?.effectsActive);
    setSaveBlocked(false); setGame(saved.game); setComputerPlayerIds(saved.view.computerPlayerIds ?? []); setComputerPaused(saved.view.computerPaused ?? false); setLogs([...saved.logs]); setGlobalZoom(saved.view.zoom); setCommonZoom(saved.view.commonZoom ?? 1); setFocus(saved.view.focus); setTableView(shieldLayout(saved.game) ? true : saved.view.table ?? true); setBoardZooms({ ...saved.view.boardZooms });
    setSelectedShieldSlot(null);
    setSelectedTileId(null);   setDieIndex(-1);  setSettings(false);
  }
  useEffect(() => {
    let saved: SavedGame | undefined;
    let cachedHistory:string|null=null;
    let message = "";
    try { const text = localStorage.getItem(storageKey); if (text) saved = parseSavedGame(text); cachedHistory=localStorage.getItem(historyKey); }
    catch { message = "기존 자동 저장을 읽지 못했습니다. 저장 원본은 유지했습니다."; }
    startTransition(() => { if (saved) restore(saved,cachedHistory); if (message) { setNotice(message); setSaveBlocked(true); } setSaveReady(true); });
  }, []);
  useEffect(() => {
    if (!saveReady || saveBlocked) return;
    try { localStorage.setItem(storageKey, serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs, view: { zoom: globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, table: tableView } }));
      localStorage.setItem(historyKey,serializeTurnHistory(game,logs,history));startTransition(()=>setSaveIssue("")); }
    catch (error) { startTransition(() => setSaveIssue(error instanceof Error?error.message:"자동 저장 실패")); }
  }, [game, logs, history, globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, tableView, saveReady, saveBlocked]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),6000);return()=>clearTimeout(timer);},[notice]);
  function exportSave() {
    try {
      const text = serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs, view: { zoom: globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, table: tableView } });
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "burgundy-save.json"; link.click(); URL.revokeObjectURL(url);
    } catch { setNotice("현재 상태를 저장하지 못했습니다."); }
  }
  const [selectingGoods,setSelectingGoods]=useState(false);
  const actorId = game.turn.activePlayerId ?? orderedPlayers(game)[0];
  const active = game.players.find(p => p.id === actorId)!;
  const dice = game.dice.players[actorId];
  const die = dice[dieIndex];
  const officialOptions = getSelectableBoards();
  const actions=useMemo(()=>directActions(game,actorId),[game,actorId]);
  const dieAction=(match:Parameters<typeof directBoardAction>[3])=>!computerTurn?directBoardAction(game,actions,die?.id,match):null;
  const computerTurn = computerPlayerIds.includes(actorId) && !computerPaused;
  const permitted = (action: GameAction | null) => !computerTurn && action !== null && validateCoreAction(game, action).valid;
  const titleFor = (id: string) => { const t = game.tiles[id]; return t.type === "inn" ? "여관" : t.type === "building" ? buildingNames[t.building] : t.type === "livestock" ? `${LIVESTOCK_NAMES[t.species]} ${t.count}마리` : t.type === "monastery" ? `수도원 ${t.number}` : tileInfo[t.type].name; };
  const ending = checkCoreGameEnd(game);
  const shields=shieldLayout(game);
  const shieldOptions=useMemo(()=>new Map((shieldLayout(game)?.slots??[]).map(s=>[s.id,directShieldActions(game,actorId,s.id)])),[game,actorId]);
  const selectedShield=shields?.slots.find(s=>s.id===selectedShieldSlot&&s.shieldNumber!==null);
  const shieldCandidates=selectedShield&&!computerTurn?shieldOptions.get(selectedShield.id)??[]:[];
  const pairIds=[...new Set(actions.flatMap(a=>boardTarget(game,a).shield?.dieId?[boardTarget(game,a).shield!.dieId!]:[]))];
  const freeShield=actions.some(a=>{const s=boardTarget(game,a).shield;return s&&!s.dieId;});
  const pairId=pairIds.includes(pairDie)?pairDie:freeShield?"":pairIds[0];
  const bonusShields=!computerTurn&&!die?actions.filter(a=>{const s=boardTarget(game,a).shield;return !!s&&(s.dieId?s.dieId===pairId:!pairId);}):[];
  function supplyAction(id:string){
    if(computerTurn)return null;
    if(specialMode)return actions.find(a=>a.type==="use-monastery-six"&&a.tileId===id)??null;
    const free=actions.find(a=>boardTarget(game,a).blackTile?.tileId===id);if(free&&!purchaseMode)return free;
    if(game.market.blackDepot.includes(id)||game.market.inns?.stack.includes(id))return (!game.turn.pendingChoice||purchaseMode)?actions.find(a=>a.type==="buy-black-tile"&&a.tileId===id)??null:null;
    return dieAction(i=>i.kind==="take-tile"&&i.tileId===id);
  }
  function activate(action:GameAction|null){if(!action)return;const intent=boardTarget(game,action).intent;if(action.type==="resolve-choice"&&intent?.kind==="take-tile"&&intent.discardTileId){setConfirmation(action);return;}if((action.type==="resolve-choice"&&(game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {intent?:{discardIds?:string[]};vineBlack?:{discardTileId?:string}}|null)?.intent?.discardIds?.length)||(action.type==="resolve-choice"&&(game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {vineBlack?:{discardTileId?:string}}|null)?.vineBlack?.discardTileId)||(action.type==="use-die"&&action.intent.kind==="vineyard"&&action.intent.discardIds?.length)||(action.type==="extension"&&action.extensionId==="vineyards"&&(action.payload as {discardIds?:string[]})?.discardIds?.length)||(action.type==="use-die"&&action.intent.kind==="take-tile"&&action.intent.discardTileId)||(action.type==="buy-black-tile"&&action.discardTileId)||(action.type==="use-monastery-six"&&action.discardTileId))setConfirmation(action);else run(action);}
  function selectSupply(id:string){const a=supplyAction(id);if(!a)return;setSelectedShieldSlot(null);if(active.storage.every((_,i)=>!!keyOccupant(active,i))){setSelectedTileId(id);setNotice("교체할 보관 타일을 누르세요. 폐기는 확인 후 실행됩니다.");}else activate(a);}
  function selectStorage(id:string|null,index:number){
    if(selectedTileId&&!active.storage.includes(selectedTileId)&&active.storage.every((_,i)=>!!keyOccupant(active,i))){
      const free=actions.find(a=>{const t=boardTarget(game,a).blackTile;return !purchaseMode&&t?.tileId===selectedTileId&&t.storageSlot===index;});if(free){activate(free);return;}
      const bonus=directBoardAction(game,actions,die?.id,i=>i.kind==="take-tile"&&i.tileId===selectedTileId&&i.storageSlot===index);if(bonus?.type==="resolve-choice"){activate(bonus);return;}const a=supplyAction(selectedTileId);if(a?.type==="use-die"&&a.intent.kind==="take-tile")activate({...a,intent:{...a.intent,storageSlot:index,discardTileId:id!}});
      else if(a&&(a.type==="buy-black-tile"||a.type==="use-monastery-six"))activate({...a,storageSlot:index,discardTileId:id!});return;
    }
    if(id&&active.vineyardReserve?.some(r=>r.tileId===id)){setSelectedVineTileId(id);return;}
    setSelectedShieldSlot(null);setSelectedTileId(selectedTileId===id?null:id);
  }
  function selectDie(i:number){setSpecialMode(false);setPurchaseMode(false);setDieIndex(dieIndex===i?-1:i);setSelectedShieldSlot(null);setConfirmation(null);}
  function selectShieldDie(id:string){selectDie(-1);setPairDie(id);setSelectedTileId(null);setSelectedVineTileId(null);}
  const costLabel=(action:GameAction|null)=>action?`일꾼 ${directCost(game,action)}`:"불가";
  const workersAction=dieAction(i=>i.kind==="take-workers");
  function run(action: GameAction) {
    if(dispatched.current===game)return;
    const result = applyCoreAction(game, action);
    if (!result.ok) { setNotice(result.issues.some(i => i.code === "unresolved-rule") ? "이 효과는 아직 지원하지 않습니다." : "차례, 주사위 눈, 일꾼과 보관 공간을 확인해 주세요."); return; }
    dispatched.current=game;setPairDie("");setSelectingGoods(false);setSelectedVineTileId(null);
    const before = game.players.find(p=>p.id===action.playerId)!;
    const routeSale=result.value.state.tradeRoutes?.routes[before.id]?.sales;const tradeLog=routeSale&&routeSale.length>(game.tradeRoutes?.routes[before.id]?.sales.length??0)?`무역로 ${routeSale.length}칸 · ${routeSale.at(-1)!.status==="mismatch"?"색상 불일치":routeSale.at(-1)!.status==="pending"?"보상 선택":"보상 획득"} · `:"";
    const fortressLog=result.value.state.scoreLedger[before.id].filter(e=>e.id.startsWith("fortress:")&&!game.scoreLedger[before.id].some(old=>old.id===e.id)).map(e=>`${e.source.section} +${e.points}점`).join(" · ");
    const record=createActionLog(game,result.value.state,action,[tradeLog.replace(/ · $/,""),fortressLog].filter(Boolean).join(" · "));
    const nextLogs=[record,...logs].slice(0,60);
    setHistory(h=>recordTurnAction(h,game,result.value.state,action,logs,nextLogs));
    setLogs(nextLogs);
    setSelectedShieldSlot(null);setVineRotation(0);setGame(result.value.state); setNotice(readActionLog(record).text);setConfirmation(null);setSpecialMode(false);setPurchaseMode(false);
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
    if (!computerPlayerIds.includes(actorId) || computerPaused || game.status === "finished" || !saveReady || settings) return;
    const timer = setTimeout(() => {
      const decision = chooseComputerAction(game, actorId);
      if (decision.ok) runComputer(decision.value);
      else { setNotice("AI가 합법 행동을 찾지 못했습니다. 진행을 보존하고 일시정지했습니다."); setComputerPaused(true); }
    }, 450);
    return () => clearTimeout(timer);
  }, [game, actorId, computerPlayerIds, computerPaused, saveReady, settings]);

  function newSession() {
    if(draftEnabled&&!boardDraftReady){setNotice("각 좌석의 영지 후보 하나를 선택하세요.");return;}
    try {
      const next = createPracticeSession({ chooseStartingCastles:true,names: names.slice(0, count), seed, boardIds: boardIds.slice(0, count), firstSeat, colors: colors.slice(0,count), officialSlots: true, fullEffects: true, additionalHexes, whiteCastles, inns, tradeRoutes, vineyards, excludedGrapes:vineyards?excludedGrapes.slice(0,count===2?2:count===3?1:0):[], geese, borderPosts, shieldPreview, shieldRules });
      if(shieldPreview||shieldRules)setTableView(true);
      setSelectedShieldSlot(null);
      dispatched.current=null;setSelectedVineTileId(null);setHistory(beginHistory(next,[]));setConfirmation(null);setSaveBlocked(false); setGame(next); setComputerPlayerIds(shieldPreview?[]:playMode === "demo" ? next.players.map(p=>p.id) : playMode === "computer" ? next.players.slice(1).map(p=>p.id) : []); setComputerPaused(false);
      setLogs([`새 연습을 시작했습니다. 첫 차례는 ${next.players[firstSeat].name}입니다.`]); setNotice(""); setSettings(false);  setDieIndex(-1); setSelectedTileId(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "연습 준비에 실패했습니다."); }
  }

  function renderBoard(player: PlayerState) {
    const zoom = (boardZooms[player.id] ?? 1) * globalZoom * (tableView ? .58 : 1);
    const cellActions=new Map(player.duchy.cells.map(cell=>[cell.id,{
      placement:player.id===actorId?(actions.find(a=>saveReady&&!saveBlocked&&a.type==="place-starting-castle"&&a.cellId===cell.id)??(selectedTileId&&active.storage.includes(selectedTileId)?dieAction(i=>i.kind==="place-tile"&&i.tileId===selectedTileId&&i.cellId===cell.id):null)):null,
      shield:player.id===actorId?shieldCandidates.find(a=>a.payload.castleCellId===cell.id)??bonusShields.find(a=>{const t=boardTarget(game,a).shield;return t?.slotId===selectedShieldSlot&&t.castleCellId===cell.id;}):null,
    }]));
    const legal=player.duchy.cells.filter(c=>cellActions.get(c.id)!.placement||cellActions.get(c.id)!.shield).map(c=>c.id);
    const official = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === player.duchy.boardId && b.verification.status === "verified");
    return <section key={player.id} className="panel estate-panel"><div className="estate-heading"><div><span className="eyebrow">YOUR DOMAIN</span><h2 style={tableView?{color:playerColor(player)}:undefined}>{player.name}의 영지 <span className="board-number">{official ? `영지 보드 ${official.officialNumber}번` : "비공식 연습 보드"}</span></h2></div><span className="live-status">{player.id === game.turn.activePlayerId ? "● 현재 차례" : "영지 보기"}</span></div>
      {startingCastlePending(game,player.id)&&<p className="starting-castle-guidance">{player.id===actorId?"시작 성 타일을 배치할 위치를 선택하세요.":`${player.name}의 시작 성 선택 대기`}</p>}{<div className="estate-inventory"><GoodsInventory costFor={type=>{const a=dieAction(i=>i.kind==="sell-goods"&&i.goodsType===type);return a?directCost(game,a):0;}} player={player} canSell={type=>player.id===actorId&&!!dieAction(i=>i.kind==="sell-goods"&&i.goodsType===type)} onSell={type=>activate(dieAction(i=>i.kind==="sell-goods"&&i.goodsType===type))}/><SoldGoods player={player}/><div className="estate-dice">{game.dice.players[player.id].map((d,i) => <button key={d.id} style={{background:playerColor(player)}} className={`mini-die seat-die-${player.seat}${d.used ? " used" : ""}${player.id === actorId && dieIndex === i ? " chosen" : ""}`} aria-label={`${player.name} 개인 주사위 ${i+1} 눈 ${d.value}`} disabled={computerTurn || player.id !== actorId || game.turn.stage !== "player-turn" || d.used || (!!game.turn.pendingChoice&&!isCastleAction(game))} aria-pressed={player.id===actorId&&dieIndex===i} onClick={() => selectDie(i)}>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][d.value]}</button>)}</div><EarnedBonusTiles player={player}/><div className="estate-resources"><button aria-label={`${player.name} 일꾼 자원`} disabled={player.id!==actorId||!workersAction} onClick={()=>activate(workersAction)}><ResourceIcon type="worker"/> 일꾼 <b>{player.workers}</b>{player.id===actorId&&workersAction&&<small> +{monasteryNumbers(game,active).includes(14)?4:2}</small>}</button><span><ResourceIcon type="silver"/> 은화 <b>{player.silver}</b></span></div></div>}
      <div className={game.vineyards?"estate-vineyard-row":""}><div className="estate-original-board"><BoardViewport onZoom={delta=>setBoardZooms(old=>({...old,[player.id]:Math.max(.5,Math.min(2,+(Number(old[player.id]??1)+delta).toFixed(2)))}))}><svg className="live-estate-svg" style={game.vineyards?{width:`${zoom/(tableView?.58:1)*100}%`,height:"auto"}:undefined} width={620 * zoom} height={(fortressLinesFor(player.duchy.boardId).length?640:565) * zoom} viewBox={fortressLinesFor(player.duchy.boardId).length?"0 0 620 640":"0 0 620 565"} role="group" aria-label={`${player.name} 영지`}><circle cx="310" cy="282" r="260" fill="#eee9db" stroke="#cfbea0"/>{player.duchy.cells.map(cell => {
        const {x,y}=estateCenter(cell.coord);
        const occupied = cell.tileId ? game.tiles[cell.tileId] : null;
        const {placement,shield}=cellActions.get(cell.id)!;
        const mounted=occupied?.type==="castle"?shields?.mounted.find(m=>m.playerId===player.id&&m.cellId===cell.id):null;
        const canPlace=!!placement||!!shield;
        const select=()=>{if(canPlace)activate(shield??placement);else if(mounted)setDetailShield(mounted.shieldNumber);};
        return <g key={cell.id} data-estate-cell={cell.id} data-can-start={placement?.type==="place-starting-castle"||undefined} data-tile-help-terrain={occupied?.type==="inn"?cell.terrain:undefined} data-tile-help={mounted?`shield:${mounted.shieldNumber}`:occupied?tileHelpId(occupied):undefined} data-q={cell.coord.q} data-r={cell.coord.r} role="button" tabIndex={canPlace||mounted?0:-1} aria-disabled={!canPlace&&!mounted} aria-label={`${player.name} ${cell.id} ${tileInfo[cell.terrain].name} ${cell.number}${occupied ? ` 배치됨 ${titleFor(cell.tileId!)}` : " 빈칸"}${canPlace ? ` 배치 가능 ${costLabel(shield??placement)}` : ""}${mounted?` · 장착 방패 ${mounted.shieldNumber}`:""}`} onClick={select} onKeyDown={e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); select(); } }} className={`hex-cell${canPlace?" direct-legal":""}`}>
          <polygon data-estate-fill="true" points={estatePoints(cell.coord)} fill={tableView ? tableColors[occupied?.type === "inn" ? cell.terrain : occupied?.type ?? cell.terrain] : tileInfo[occupied?.type === "inn" ? cell.terrain : occupied?.type ?? cell.terrain].color} fillOpacity={1} stroke="none"/>
          {occupied ? <EstateTile tile={occupied} coord={cell.coord}/> : <WhiteDie x={x} y={y} value={cell.number} size={36}/>}{mounted&&<MountedShield number={mounted.shieldNumber} tileId={cell.tileId!} x={x} y={y}/>}{!occupied && !placement && <text x={x} y={y + 27} className="hex-label">{tileInfo[cell.terrain].name}</text>}{!occupied&&placement&&placement.type!=="place-starting-castle"&&<PlacementCost x={x} y={y} count={directCost(game,placement)}/>}
        </g>;
      })}<EstateGrid cells={player.duchy.cells} legal={legal} framed={player.duchy.cells.filter(c=>c.tileId&&hasTileFrame(game.tiles[c.tileId])).map(c=>c.id)}/>{legal.map(id=>{const cell=player.duchy.cells.find(c=>c.id===id)!,{x,y}=estateCenter(cell.coord),a=cellActions.get(id)!;return !a.shield?null:<g key={id} pointerEvents="none" className="direct-cost"><rect x={x-29} y={y-45} width="58" height="16" rx="6"/><text x={x} y={y-33} textAnchor="middle">{costLabel(a.shield??a.placement)}</text></g>;})}<FortressMarkers player={player} entries={game.scoreLedger[player.id]}/></svg></BoardViewport><PersonalScorePages player={player} vineyards={game.vineyards}/></div>{game.vineyards&&<VineyardBoard costFor={a=>directCost(game,a)} revision={game.revision} rotation={vineRotation} onRotation={setVineRotation} v={game.vineyards} player={player} intentFor={a=>boardTarget(game,a).intent} actions={player.id===actorId&&!computerTurn?actions.filter(a=>!die||!isCastleAction(game)||a.type!=="resolve-choice"):[]} dieId={die?.id} onAction={player.id===actorId&&!computerTurn?activate:undefined} onSelection={player.id===actorId?setSelectedVineTileId:undefined} selection={player.id===actorId?selectedVineTileId:null}/>}</div><PlayerTileStorage vineRotation={vineRotation} player={player} tiles={game.tiles} disabled={game.status==="setup"||player.id!==actorId||computerTurn} selected={selectedVineTileId??selectedTileId} onSelect={selectStorage} titleFor={titleFor}/><TradeRoutePanel route={game.tradeRoutes?.routes[player.id]} name={player.name}/><div className="board-bottom"><span>{player.duchy.cells.filter(c => c.tileId).length} / {player.duchy.cells.length} · {player.victoryPoints}점{fortressLinesFor(player.duchy.boardId).length ? ` · 요새 줄 ${game.scoreLedger[player.id].filter(e=>e.id.startsWith("fortress:")).length}/3` : ""}</span><div className="live-zoom"><button aria-label={`${player.name} 영지 축소`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.max(.5, +(Number(z[player.id] ?? 1) - .1).toFixed(2)) }))}>−</button><span>{Math.round((boardZooms[player.id] ?? 1) * 100)}%</span><button aria-label={`${player.name} 영지 확대`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.min(2, +(Number(z[player.id] ?? 1) + .1).toFixed(2)) }))}>+</button></div></div></section>;
  }

  const undoBlocked=computerPlayerIds.includes(actorId)?"AI 차례는 되돌릴 수 없습니다.":confirmation||selectedTileId||selectedShieldSlot||selectedVineTileId||dieIndex>=0||specialMode?"현재 선택을 취소하거나 필수 후속 선택을 먼저 완료하세요.":"";
  const stepReason=undoBlocked||(!canUndoTurn(history,game,'action')?"이 차례에서 취소할 행동이 없습니다.":"");
  const undoReason=stepReason||(!history.start?"불러온 차례의 시작 기록이 없습니다. 다음 차례부터 지원합니다.":"");
  function restoreTurn(kind:'turn'|'action'){
    if(kind==='turn'?undoReason:stepReason)return;
    if(dispatched.current===game)return;
    const restored=undoTurn(history,game,kind);if(!restored)return;
    dispatched.current=game;setSelectingGoods(false);setSelectedVineTileId(null);
    setGame(restored.snapshot.game);setLogs([...restored.snapshot.logs]);setHistory(restored.history);
    setDieIndex(-1);setSelectedTileId(null);setSelectedShieldSlot(null);setConfirmation(null);setSpecialMode(false);setPurchaseMode(false);setNotice(kind==='turn'?'이번 차례 시작 상태로 복원했습니다.':'이전 행동으로 복원했습니다.');
  }
  const fallbackChoices=game.turn.pendingChoice?.options.filter(o=>{const t=boardTarget(game,{type:"resolve-choice",playerId:actorId,choiceId:game.turn.pendingChoice!.id,optionId:o.id});return !t.intent&&!t.goods&&!t.shield&&!t.blackTile;})??[];
  const guidance=actionGuidance(game,actions,{purchase:purchaseMode,dieId:die?.id,tileId:selectedTileId,vineTileId:selectedVineTileId,shieldNumber:selectedShield?.shieldNumber,special:specialMode,replacement:!!confirmation,goodsTypes:selectingGoods,computer:computerPlayerIds.includes(actorId)?(computerPaused?"paused":"playing"):undefined});
  const endReason=!saveReady||saveBlocked?"게임 상태를 먼저 불러오세요.":computerPlayerIds.includes(actorId)?"AI 차례는 자동 진행됩니다.":confirmation||selectedTileId||selectedShieldSlot||selectedVineTileId||specialMode?"현재 선택을 완료하거나 취소하세요.":!canEndTurn(actions)?"두 주사위와 필수 후속 선택을 먼저 해결하세요.":"";
  const boards = focus ? [active, ...game.players.filter(p => p.id !== actorId)] : game.players;
  const touchBrowse=game.status!=="setup"&&!die&&!confirmation&&!selectedTileId&&!selectedShieldSlot&&!selectedVineTileId&&!specialMode&&!selectingGoods&&!purchaseMode&&!game.turn.pendingChoice&&!game.turn.pendingEffects.length;
  const canPurchase=!computerTurn&&actions.some(a=>a.type==="buy-black-tile"||a.type==="extension"&&a.extensionId==="vineyards"&&(a.payload as {source?:string}).source==="store");
  return <main data-guidance-pinned={pinnedGuidance} data-tile-help-touch-browse={touchBrowse} data-game-revision={game.revision} data-shields-active={shields?.effectsActive||undefined} className={`app-shell direct-input ${tableView ? "table-view" : ""}`}>
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">♜</span><span>BURGUNDY <b>EXPANDED</b><small>THE ART OF BUILDING AN ESTATE</small></span></Link><div className="header-right"><Link className="outline-button" href="/online">2인 온라인 방</Link><span className="demo-tag">부분 기본판 · 연습 공급</span><button className="outline-button" disabled={!!shieldLayout(game)} title={shieldLayout(game)?"방패 검증 모드는 공용 보드의 테이블 보기를 사용합니다.":undefined} onClick={() => setTableView(v => !v)}>{tableView ? "기존 디자인 보기" : "테이블 보기"}</button><button className="settings-button" disabled={!saveReady} aria-expanded={settings} onClick={() => setSettings(!settings)}>⚙ 게임 준비</button></div></header>
    <section className="intro"><div><div className="eyebrow">THE LOIRE VALLEY · 15TH CENTURY</div><h1>위대한 영지는, 작은 선택에서.</h1><p>{game.status==="setup"?"시작 성 타일을 배치할 위치를 선택하세요.":game.turn.stage === "round-setup" ? "라운드를 준비하고 있습니다." : game.status === "finished" ? "E단계까지 마쳤습니다. 최종 점수와 승자를 확인하세요." : game.turn.stage === "phase-end" ? "단계 수입과 필수 효과를 처리합니다." : `${active.name}의 차례 · 남은 주사위 ${dice.filter(d => !d.used).length}개`}</p></div><div className="round-display"><span>단계 · 라운드</span><strong>{game.turn.phase} · {game.turn.round}<em> / 5</em></strong></div></section>
    <details className="live-scope"><summary>기본판 연습 · 규칙 지원 범위와 공급 안내</summary>{hasShield(game,actorId,9)&&monasteryNumbers(game,active).includes(3)&&<p>사용자 확정 프로젝트 규칙: 방패9 판매 은화에 수도원3의 은화 1개를 추가합니다.</p>}<p>공식 전체 게임 준비는 아직 지원하지 않습니다. 공식 영지 {officialOptions.length}개 검증 완료 · {game.config.catalogId === "project:base-160-v1" ? "사용자 지정 가축 구성" : "공급 타일은 연습 구성"} · {game.config.marketRecipeId === "se:main:2" ? "사진 기준 2인 슬롯 · 프로젝트 타일 160개" : game.config.marketRecipeId ? "3·4인 공식 슬롯" : "자체 연습 슬롯"} · 시작 플레이어 선택 가능 · 진행·보기 설정 자동 저장.</p><p>{game.config.extensions.some(e=>e.id==="additional-hexes") ? "선택 추가 타일: 수도원27/28·기중기·하프물범 활성. " : ""}지원: 네 가지 행동·전체 기본 타일 효과·성/시청 연쇄·수도원1~26. A~E 진행과 최종 정산을 지원하며 2인은 사용자 지정 타일 구성으로 보충합니다.</p></details>
    {settings && <section className="settings-panel live-setup"><h2>게임 준비 · 설정</h2><GuidanceSetting pinned={pinnedGuidance} onChange={setPinnedGuidance}/><details className="developer-settings"><summary>개발자 설정</summary>{vineyards&&<fieldset className="vineyard-options"><legend>품종 축소 (선택) · 최대 {count===2?2:count===3?1:0}종</legend>{GRAPES.map(g=><label key={g}><input type="checkbox" aria-label={`제외 포도 ${g}`} checked={excludedGrapes.slice(0,count===2?2:count===3?1:0).includes(g)} disabled={!excludedGrapes.includes(g)&&excludedGrapes.length>=(count===2?2:count===3?1:0)} onChange={e=>setExcludedGrapes(old=>e.target.checked?[...old,g]:old.filter(x=>x!==g))}/>{GRAPE_NAMES[g]}</label>)}</fieldset>}<label><input type="checkbox" checked={shieldPreview} onChange={e=>{setShieldPreview(e.target.checked);if(e.target.checked){setPlayMode("local");setShieldRules(false);}}}/> 방패 UI 검증 모드 (능력·유지비 미구현, 로컬 전용)</label></details>    <section className="live-scope" aria-label="저장과 게임 진행"><button className="outline-button" onClick={exportSave} disabled={!saveReady}>저장 파일 내보내기</button><label> 저장 파일 불러오기 <input aria-label="저장 파일 불러오기" type="file" accept=".json,application/json" disabled={!saveReady} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 2_000_000) throw new Error("저장 파일은 2MB 이하여야 합니다."); const saved = parseSavedGame(await file.text()); restore(saved); setNotice("저장한 진행을 불러왔습니다."); } catch { setNotice("저장 파일을 불러오지 못했습니다. 현재 진행은 유지됩니다."); } }}/></label></section><label><input type="checkbox" aria-label="포도밭 확장" checked={vineyards} onChange={e=>setVineyards(e.target.checked)}/>포도밭 · 프로젝트 복원판 v0.1</label><label><input type="checkbox" aria-label="무역로 확장" checked={tradeRoutes} onChange={e=>setTradeRoutes(e.target.checked)}/>커스텀 무역로 · 직접 판매당1칸</label><label><input type="checkbox" aria-label="여관 확장" checked={inns} onChange={e=>setInns(e.target.checked)}/>여관 · 은화2 / 구역 크기+1</label><label><input type="checkbox" checked={draftEnabled} onChange={e=>{setDraftEnabled(e.target.checked);setBoardDraftReady(false);}}/>랜덤 후보2개 중 영지 선택</label>{draftEnabled&&<LocalBoardDraft count={count} ai={playMode} onBoards={boardsChosen}/>}<label><input type="checkbox" checked={shieldRules} onChange={e=>{setShieldRules(e.target.checked);if(e.target.checked){setShieldPreview(false);}}}/> 방패 확장 · 18종 능력·유지비·종료 점수 (로컬)</label><label><input type="checkbox" checked={additionalHexes} onChange={e=>setAdditionalHexes(e.target.checked)}/> 추가 타일 · 수도원27/28·기중기</label><label><input type="checkbox" checked={whiteCastles} onChange={e=>setWhiteCastles(e.target.checked)}/> 흰 성 8개 · 수도원29 (흰 주사위 추가 행동)</label><label>플레이 방식 <select aria-label="플레이 방식" disabled={shieldPreview} value={shieldPreview?"local":playMode} onChange={e=>setPlayMode(e.target.value)}><option value="local">로컬 · 번갈아 플레이</option><option value="computer">일반 AI 상대</option><option value="demo">AI 시연 · 모두 자동</option></select></label><p>일반 AI는 프로젝트 자체 상대이며 공식 샤토마·솔로 규칙과 다릅니다.</p><label><input type="checkbox" aria-label="하프물범 확장" checked={geese} onChange={e=>setGeese(e.target.checked)}/> 하프물범 타일 (검은 뒷면 1개)</label><label><input type="checkbox" checked={borderPosts} onChange={e=>setBorderPosts(e.target.checked)}/> 기존 국경 초소 설정 보존 (23~30번 요새 줄은 자동 적용)</label><label>플레이어 수 <select aria-label="플레이어 수" value={count} onChange={e => { setCount(Number(e.target.value)); setExcludedGrapes([]); setFirstSeat(s=>Math.min(s,Number(e.target.value)-1)); }}>{[2,3,4].map(n => <option key={n} value={n}>{n}명{n>2?" · 연습 공급":""}</option>)}</select></label><label>주사위 시드 <input maxLength={128} value={seed} onChange={e => setSeed(e.target.value)}/></label>{names.slice(0, count).map((name, i) => <div className="setup-seat" key={i}><label>좌석 {i + 1} 이름 <input value={name} maxLength={30} onChange={e => setNames(old => old.map((n, j) => j === i ? e.target.value : n))}/></label><label>색상 <select aria-label={`좌석 ${i+1} 색상`} value={colors[i]} onChange={e=>setColors(old=>old.map((c,j)=>j===i?e.target.value as PlayerColor:c))}>{(["blue","red","green","yellow"] as const).map((c,k)=><option value={c} key={c}>{["파랑","빨강","초록","노랑"][k]}</option>)}</select></label><label>영지 <select disabled={draftEnabled} aria-label={`좌석 ${i + 1} 영지 선택`} value={boardIds[i]} onChange={e => { setBoardIds(old => old.map((id, j) => j === i ? e.target.value : id)); }}><option value="">자체 제작 연습 영지 (비공식)</option>{officialOptions.length === 0 && <option disabled value="unavailable">공식 영지 · 검증된 데이터 없음</option>}{officialOptions.map(b => <option key={b.id} value={b.id}>영지 {b.officialNumber}{b.family === "base" ? " · 기본" : " · 추가 지형"}</option>)}</select></label></div>)}<label>시작 플레이어 <select aria-label="시작 플레이어" value={firstSeat} onChange={e=>setFirstSeat(Number(e.target.value))}>{names.slice(0,count).map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label><p>공식 규칙의 최고 주사위 눈으로 시작 플레이어를 정한 뒤 선택하세요. 최고 눈 동률 처리 방식은 임의로 정하지 않습니다.</p><p>새 연습 시작은 현재 화면의 진행을 초기화합니다. 영지 1~30을 선택할 수 있습니다. 23~30번 영지의 요새 줄 보너스는 자동 적용됩니다. 11~18번의 선택적 같은 지형·성 연결 조건은 아직 미적용입니다.</p><button disabled={!saveReady||(draftEnabled&&!boardDraftReady)} onClick={newSession}>새 연습 시작</button></section>}
    {computerPlayerIds.length>0 && <section className="live-scope computer-status" aria-label="일반 AI 상태"><strong>일반 AI · {computerPlayerIds.map(id=>game.players.find(p=>p.id===id)?.name).join(", ")}</strong><span>{game.status === "finished" ? "게임 종료 · 자동 진행 완료" : computerPaused ? "일시정지 · 수동 조작 가능" : computerTurn ? "생각하는 중…" : "사람의 차례"}</span><button className="outline-button" disabled={game.status === "finished"} onClick={()=>setComputerPaused(p=>!p)}>{computerPaused ? "AI 계속 진행" : "AI 일시정지"}</button></section>}
    <div className="live-view-controls"><button className="outline-button" onClick={()=>{const width=estateArea.current?.clientWidth??620;const columns=width>760?Math.min(2,game.players.length):1;setGlobalZoom(Math.max(.5,Math.min(2,(width/columns-30)/(620*(tableView?.58:1)))));setBoardZooms({});}}>화면 맞춤</button><small>Alt+드래그 이동 · Ctrl+휠 영지 확대</small><button className="outline-button" onClick={() => setFocus(!focus)}>{focus ? "전체 영지 모드로" : "현재 차례 중심 모드로"}</button><label>전체 배율 <input aria-label="전체 배율" type="range" min={50} max={200} value={Math.round(globalZoom * 100)} onChange={e => setGlobalZoom(Number(e.target.value) / 100)}/>{Math.round(globalZoom * 100)}%</label><button className="outline-button" onClick={() => { setGlobalZoom(1); setBoardZooms({}); }}>기본 배율 복원</button></div>

    {ending.ok&&ending.value.ended&&<FinalScores scores={ending.value.scores} players={game.players} winners={ending.value.winnerIds}/> }
    {game.turn.pendingChoice && fallbackChoices.length>0 && <section className="panel live-scope choice-panel" aria-label="타일 효과 선택"><h2>{game.turn.pendingChoice.source.section === "Ship goods" ? "선박 · 상품 선택" : game.turn.pendingChoice.source.section==="Shield abilities"?"방패 · 능력/유지비 선택":game.turn.pendingChoice.source.section}</h2><p>남은 후속 효과를 선택하세요. 처리가 끝나면 차례를 계속 진행합니다.</p><div>{isShieldUpkeep(fallbackChoices)?<ShieldUpkeep key={game.turn.pendingChoice.id} options={fallbackChoices} disabled={computerTurn} onChoose={optionId=>activate({type:"resolve-choice",playerId:actorId,choiceId:game.turn.pendingChoice!.id,optionId})}/>:fallbackChoices.map(o => <button className="outline-button" key={o.id} disabled={computerTurn} onClick={() => activate({ type: "resolve-choice", playerId: actorId, choiceId: game.turn.pendingChoice!.id, optionId: o.id })}><RewardChoiceLabel depots={game.market.numberedDepots} id={o.id} label={o.label}/></button>)}</div></section>}
    {saveIssue&&<p role="alert" className="live-scope">자동 저장 실패: {saveIssue} · 저장 파일 내보내기로 진행을 보관하세요.</p>}
    {detailShield!==null&&<ShieldDetails number={detailShield} active={!!shields?.effectsActive} onClose={()=>setDetailShield(null)}/>}
    {notice && <p role="status" className="direct-toast">{notice}</p>}
    {game.status!=="finished"&&<section className="direct-toolbar" aria-label="직접 게임 조작"><div className="direct-resources"><strong>{active.name}</strong><div className="direct-dice">{dice.map((d,i)=><button key={d.id} aria-label={`행동 주사위 ${i+1} 눈 ${d.value}${d.used?" 사용됨":""}`} aria-pressed={dieIndex===i} disabled={computerTurn||d.used||game.turn.stage!=="player-turn"||!!game.turn.pendingChoice&&!isCastleAction(game)} onClick={()=>selectDie(i)}>{["","⚀","⚁","⚂","⚃","⚄","⚅"][d.value]}</button>)}</div><button className="direct-worker" aria-label="일꾼 자원" disabled={!workersAction} onClick={()=>activate(workersAction)}><ResourceIcon type="worker"/> <strong aria-label="현재 일꾼">{active.workers}</strong>{workersAction&&<small>+{monasteryNumbers(game,active).includes(14)?4:2}</small>}</button><span><ResourceIcon type="silver"/> <b aria-label="현재 은화">{active.silver}</b></span>{(selectedTileId||selectedShield||selectedVineTileId)&&<button aria-label="선택 취소" onClick={()=>{setSelectedTileId(null);setSelectedVineTileId(null);setSelectedShieldSlot(null);setConfirmation(null);}}>×</button>}<details className="direct-special"><summary aria-label="추가 행동" title="추가 행동">⋯</summary><label className="tile-help-touch-purchase"><input type="checkbox" checked={purchaseMode} disabled={!purchaseMode&&!canPurchase} onChange={e=>{setPurchaseMode(e.target.checked);setSpecialMode(false);setDieIndex(-1);}}/>보드에서 은화 구매 선택</label><label><input type="checkbox" checked={specialMode} onChange={e=>{setSpecialMode(e.target.checked);setPurchaseMode(false);setDieIndex(-1);}}/>수도원6 · 일꾼2 건물 획득</label><button disabled={!permitted({type:"buy-workers",playerId:actorId})} onClick={()=>run({type:"buy-workers",playerId:actorId})}>수도원28 · 은화1 → 일꾼2</button></details></div><p className="action-guidance" role="status" aria-live="polite" aria-label="현재 행동 안내">{guidance}</p><TurnControls state={game} undoReason={undoReason} stepReason={stepReason} endReason={endReason} onUndo={()=>restoreTurn("turn")} onStep={()=>restoreTurn("action")} onEnd={()=>run({type:"end-turn",playerId:actorId})}/></section>}

    {confirmation&&<section role="alertdialog" aria-label="교체 확인" className="direct-confirm"><p>기존 타일이 영구 제거됩니다. 교체하시겠습니까?</p><button onClick={()=>{const a=confirmation;setConfirmation(null);run(a);}}>교체 확정</button><button onClick={()=>setConfirmation(null)}>취소</button></section>}
    <div className="game-layout">
      {shields && <section className="shield-action-tools" aria-label="방패 배치 검증">
        {die&&!selectedShield&&![...shieldOptions.values()].some(a=>a.length>0)&&<p role="status">{!active.duchy.cells.some(c=>c.tileId&&game.tiles[c.tileId]?.type==="castle")?"방패를 장착할 자신의 성 타일이 없습니다.":dice.filter(d=>!d.used).length<2?"방패 획득에는 사용하지 않은 주사위 두 개가 필요합니다.":"현재 획득 가능한 방패가 없습니다. 일꾼 비용과 필수 선택을 확인하세요."}</p>}
        {selectedShield && <p role="status">{shieldLabel(selectedShield.shieldNumber!)} · 장착할 성을 누르세요 · {costLabel(shieldCandidates[0]??bonusShields.find(a=>boardTarget(game,a).shield?.slotId===selectedShield.id)??null)}</p>}
        {shields.effectsActive && <div className="shield-rule-tools">

          {shields.mounted.filter(m=>m.shieldNumber===6).map(m=><div key={m.shieldNumber}><strong>{game.players.find(p=>p.id===m.playerId)?.name} · 방패6</strong>{shields.rules!.monasteryTarget?<p>수도원 공유 대상: {game.players.find(p=>p.id===shields.rules!.monasteryTarget)?.name} · 상대 수도원27 제외</p>:<><label>수도원 공유 대상 <select aria-label="방패6 수도원 공유 대상" value={shieldTarget} onChange={e=>setShieldTarget(e.target.value)}><option value="">플레이어 선택</option>{game.players.filter(p=>p.id!==m.playerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="outline-button" disabled={!shieldTarget||!permitted({type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId:m.playerId,payload:{targetPlayerId:shieldTarget}})} onClick={()=>run({type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId:m.playerId,payload:{targetPlayerId:shieldTarget}})}>방패6 대상 확정 (변경 불가)</button></>}</div>)}
          {hasShield(game,actorId,16)&&<ShieldDieChange dice={dice} player={active} actions={computerTurn?[]:actions} onAction={run}/>}
          {freeShield&&<button aria-pressed={!pairId} disabled={computerTurn} onClick={()=>selectShieldDie("")}>방패11 · 보상만 사용</button>}
          {!computerTurn&&pairIds.length>0&&<ShieldPairDice dice={dice} player={active} ids={pairIds} selected={pairId} onSelect={selectShieldDie}/>}
        </div>}

      </section>}
      <div className={game.vineyards?"common-vineyard-row":"common-board-row"}><CommonBoard shields={shields} costFor={a=>directCost(game,a)} shieldSelection={{slotId:selectedShieldSlot,onSelect:id=>{if(!computerTurn&&(die&&shieldOptions.get(id)?.length||bonusShields.some(a=>boardTarget(game,a).shield?.slotId===id))){setSelectedShieldSlot(selectedShieldSlot===id?null:id);setSelectedTileId(null);}},cost:id=>die&&!computerTurn?shieldOptions.get(id)?.[0]??null:bonusShields.find(a=>boardTarget(game,a).shield?.slotId===id)??null}} game={{...game,market:{...game.market,revealedGoods:publicPhaseGoods(game)}}} selectedTileId={selectedTileId} onSelect={selectSupply} titleFor={titleFor} zoom={commonZoom} onZoom={setCommonZoom} showCosts={!!die||pairIds.length>0||freeShield} actionFor={supplyAction} goodsOptions={depot=>!computerTurn?actions.flatMap(a=>{const g=boardTarget(game,a).goods;return g?.depot===depot?[{action:a,goodsIds:g.goodsIds}]:[];}):[]} onGoods={activate} onGoodsSelecting={()=>setSelectingGoods(true)}/>{game.vineyards&&<VineyardSupply costFor={a=>directCost(game,a)} purchaseAllowed={!game.turn.pendingChoice||purchaseMode} v={game.vineyards} actions={!computerTurn?actions.filter(a=>!die||!isCastleAction(game)||a.type!=="resolve-choice"):[]} intentFor={a=>boardTarget(game,a).intent} dieId={die?.id} onAction={activate}/>}</div>
      <div className="live-estates" ref={estateArea}>{boards.map(renderBoard)}</div>

    </div>
    <details className="panel compact-log"><summary>행동과 점수 기록 · {logs.length}개</summary><div className="logs live-logs">{logs.map((message,i)=><p key={i}><ActionLog record={message} tiles={game.tiles}/></p>)}</div></details>
    <TileEncyclopedia/>
    <footer><span>♜ BURGUNDY EXPANDED</span><p>자체 SVG · 연습 공급 · 공식 기본판 전체 게임 미완성</p><span>모든 행동은 규칙 검사 후 실행됩니다.</span></footer>
  </main>;
}
