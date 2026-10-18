"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import type { DieAdjustment, GameAction, GameState, PlayerState, PlayerColor, TileType } from "../game/types";
import { applyCoreAction, validateCoreAction, adjustedDie, orderedPlayers, checkCoreGameEnd, planAdjustment } from "../game/core";
import { BoardViewport } from "./board-viewport";
import { CommonBoard } from "./common-board";
import { GoodsArt, TileArt } from "./tile-art";
import { createPracticeSession, practiceBoard } from "../game/practice";
import { getSelectableBoards, VERIFIED_BOARD_DEFINITIONS } from "../game/boards/catalog";
import { parseSavedGame, serializeSavedGame, type SavedGame } from "../game/save";
import { chooseComputerAction } from "../game/computer";
import { tileHelp } from "../game/tile-help";
import { supportsPlacement } from "../game/core/placement";
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
const polygon = (x: number, y: number, size: number) => Array.from({ length: 6 }, (_, i) => {
  const angle = (60 * i - 30) * Math.PI / 180; return `${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`;
}).join(" ");
const actionNames: Record<string, string> = { "buy-workers": "수도원28 · 은화로 일꾼 구매", "use-monastery-six": "수도원6 건물 획득", "resolve-choice": "타일 추가 효과 선택", "advance-phase": "단계 수입·보충 / 최종 정산", "roll-round": "라운드 주사위 굴림·상품 배분", "end-turn": "차례 종료", "buy-black-tile": "검은 공급처 구매", "take-workers": "일꾼 획득", "sell-goods": "상품 판매", "take-tile": "타일 획득", "place-tile": "영지 배치" };

function BoardDie({ x, y, value }: { x: number; y: number; value: number }) {
  const positions: Record<number, readonly (readonly [number, number])[]> = {1:[[0,0]],2:[[-8,-8],[8,8]],3:[[-8,-8],[0,0],[8,8]],4:[[-8,-8],[8,-8],[-8,8],[8,8]],5:[[-8,-8],[8,-8],[0,0],[-8,8],[8,8]],6:[[-8,-10],[8,-10],[-8,0],[8,0],[-8,10],[8,10]]};
  return <g className="board-die" aria-hidden="true"><rect x={x-18} y={y-18} width={36} height={36} rx={6} fill="#fff6ca" stroke="#8f8665" strokeWidth={1.2}/>{positions[value].map(([dx,dy],i)=><circle key={i} cx={x+dx} cy={y+dy} r={3.2} fill="#394b36"/>)}</g>;
}

export default function GameScreen() {
  const [game, setGame] = useState<GameState>(() => createPracticeSession({ names: initialNames.slice(0, 2), seed: "burgundy-practice-1", fullEffects: true, officialSlots: true, boardIds: ["se:base:2", "se:base:2"] }));
  const [logs, setLogs] = useState(["연습을 준비했습니다. 주사위를 굴려 시작하세요."]);
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(false);
  const [computerPlayerIds, setComputerPlayerIds] = useState<readonly string[]>([]);
  const [computerPaused, setComputerPaused] = useState(false);
  const [playMode, setPlayMode] = useState("local");
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
  const [dieIndex, setDieIndex] = useState(0);
  const [shift, setShift] = useState(0);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ playerId: string; cellId: string } | null>(null);
  const [slotSelection, setSlotSelection] = useState<number | null>(null);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [commonZoom, setCommonZoom] = useState(1);
  const [boardZooms, setBoardZooms] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState(false);
  const [tableView, setTableView] = useState(true);
  const [saveReady, setSaveReady] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const storageKey = "burgundy-expanded:local-v1";
  function restore(saved: SavedGame) {
    setSaveBlocked(false); setGame(saved.game); setComputerPlayerIds(saved.view.computerPlayerIds ?? []); setComputerPaused(saved.view.computerPaused ?? false); setLogs([...saved.logs]); setGlobalZoom(saved.view.zoom); setCommonZoom(saved.view.commonZoom ?? 1); setFocus(saved.view.focus); setTableView(saved.view.table ?? true); setBoardZooms({ ...saved.view.boardZooms });
    setSelectedTileId(null); setSelectedCell(null); setShift(0); setDieIndex(Math.max(0, saved.game.dice.players[saved.game.turn.activePlayerId ?? orderedPlayers(saved.game)[0]].findIndex(d => !d.used))); setSlotSelection(null); setSettings(false);
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
    try { localStorage.setItem(storageKey, serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs, view: { zoom: globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, table: tableView } })); }
    catch { startTransition(() => setNotice("자동 저장 실패: 저장 파일 내보내기로 진행을 보관해 주세요.")); }
  }, [game, logs, globalZoom, commonZoom, computerPlayerIds, computerPaused, focus, boardZooms, tableView, saveReady, saveBlocked]);
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
  const adjustment: DieAdjustment = { workersSpent: Math.abs(shift), steps: Array(Math.abs(shift)).fill(shift < 0 ? -1 : 1) };
  const effectiveDie = adjustedDie(die.value, adjustment.steps);
  const tile = selectedTileId ? game.tiles[selectedTileId] : null;
  const officialOptions = getSelectableBoards();
  const targetSlot = slotSelection ?? Math.max(0, active.storage.indexOf(null));
  const destination = { storageSlot: targetSlot, ...(active.storage.every(id => id !== null) ? { discardTileId: active.storage[targetSlot]! } : {}) };
  const makeDieAction = (intent: Extract<GameAction, { type: "use-die" }>["intent"]): GameAction => ({ type: "use-die", playerId: actorId, dieId: die.id, adjustment: planAdjustment(game, active, intent, adjustment.steps), intent });
  const computerTurn = computerPlayerIds.includes(actorId) && !computerPaused;
  const permitted = (action: GameAction | null) => !computerTurn && action !== null && validateCoreAction(game, action).valid;
  const titleFor = (id: string) => { const t = game.tiles[id]; return t.type === "building" ? buildingNames[t.building] : t.type === "livestock" ? `${({cattle:"소",sheep:"양",pigs:"돼지",chickens:"닭",geese:"거위"})[t.species]} ${t.count}마리` : t.type === "monastery" ? `수도원 ${t.number}` : tileInfo[t.type].name; };
  const ending = checkCoreGameEnd(game);
  const takeDepot = selectedTileId && game.market.numberedDepots.find(d => d.slots.some(s => s.tileId === selectedTileId));
  const takeAction: GameAction | null = takeDepot && selectedTileId ? makeDieAction({ kind: "take-tile", depot: takeDepot.number, tileId: selectedTileId, ...destination })
    : selectedTileId && game.market.blackDepot.includes(selectedTileId) ? { type: "buy-black-tile", playerId: actorId, tileId: selectedTileId, ...destination } : null;
  const placeAction = selectedTileId && selectedCell?.playerId === actorId ? makeDieAction({ kind: "place-tile", tileId: selectedTileId, cellId: selectedCell.cellId }) : null;

  function run(action: GameAction) {
    const result = applyCoreAction(game, action);
    if (!result.ok) { setNotice(result.issues.some(i => i.code === "unresolved-rule") ? "이 효과는 아직 지원하지 않습니다." : "차례, 주사위 눈, 일꾼과 보관 공간을 확인해 주세요."); return; }
    const before = active, after = result.value.state.players.find(p => p.id === actorId)!;
    const delta = [`승점 ${after.victoryPoints - before.victoryPoints >= 0 ? "+" : ""}${after.victoryPoints - before.victoryPoints}`,
      `은화 ${after.silver - before.silver >= 0 ? "+" : ""}${after.silver - before.silver}`, `일꾼 ${after.workers - before.workers >= 0 ? "+" : ""}${after.workers - before.workers}`];
    const label = actionNames[action.type === "use-die" ? action.intent.kind : action.type];
    setLogs(old => [`${active.name} · ${label}${action.type === "use-die" || action.type === "buy-black-tile" || action.type === "resolve-choice" || action.type === "use-monastery-six" ? ` (${delta.join(" · ")})` : ""}`, ...old].slice(0, 60));
    setGame(result.value.state); setNotice(""); setShift(0); setSlotSelection(null);
    const nextId = result.value.state.turn.activePlayerId ?? orderedPlayers(result.value.state)[0];
    const unused = result.value.state.dice.players[nextId].findIndex(d => !d.used);
    setDieIndex(unused < 0 ? 0 : unused);
    if (action.type !== "roll-round") { setSelectedTileId(null); setSelectedCell(null); }
  }

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
      const next = createPracticeSession({ names: names.slice(0, count), seed, boardIds: boardIds.slice(0, count), startingCastleIds: startingCastleIds.slice(0,count), firstSeat, colors: colors.slice(0,count), officialSlots: true, fullEffects: true, additionalHexes, geese, borderPosts });
      setSaveBlocked(false); setGame(next); setComputerPlayerIds(playMode === "demo" ? next.players.map(p=>p.id) : playMode === "computer" ? next.players.slice(1).map(p=>p.id) : []); setComputerPaused(false);
      setLogs([`새 연습을 시작했습니다. 첫 차례는 ${next.players[firstSeat].name}입니다.`]); setNotice(""); setSettings(false); setShift(0); setDieIndex(0); setSelectedTileId(null); setSelectedCell(null); setSlotSelection(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "연습 준비에 실패했습니다."); }
  }

  function tileFace(id: string) { return <span className="tile illustrated-tile"><TileArt tile={game.tiles[id]}/></span>; }
  function renderBoard(player: PlayerState) {
    const zoom = (boardZooms[player.id] ?? 1) * globalZoom * (tableView ? .58 : 1);
    const official = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === player.duchy.boardId && b.verification.status === "verified");
    return <section key={player.id} className="panel estate-panel"><div className="estate-heading"><div><span className="eyebrow">YOUR DOMAIN</span><h2 style={tableView?{color:playerColor(player)}:undefined}>{player.name}의 영지 <span className="board-number">{official ? `공식 ${official.officialNumber}` : "비공식 연습 보드"}</span></h2></div><span className="live-status">{player.id === game.turn.activePlayerId ? "● 현재 차례" : "영지 보기"}</span></div>
      {tableView && <div className="estate-inventory"><div className="estate-goods">{player.goods.map(g => <span className={`goods-chip goods-${g.type}`} key={g.type} title={`${g.type}번 상품 ${g.tiles.length}개`} aria-label={`${g.type}번 상품 ${g.tiles.length}개`}><GoodsArt value={g.type}/><b>×{g.tiles.length}</b></span>)}<strong className="estate-score">{player.victoryPoints}<small>점</small></strong></div><div className="estate-dice">{game.dice.players[player.id].map((d,i) => <button key={d.id} style={{background:playerColor(player)}} className={`mini-die seat-die-${player.seat}${d.used ? " used" : ""}${player.id === actorId && dieIndex === i ? " chosen" : ""}`} aria-label={`${player.name} 개인 주사위 ${i+1} 눈 ${d.value}`} disabled={player.id !== actorId || game.turn.stage !== "player-turn" || d.used || !!game.turn.pendingChoice} onClick={() => {setDieIndex(i);setShift(0);}}>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][d.value]}</button>)}</div><div className="estate-resources"><span>♟ 일꾼 <b>{player.workers}</b></span><span>◈ 은화 <b>{player.silver}</b></span></div></div>}
      <BoardViewport onZoom={delta=>setBoardZooms(old=>({...old,[player.id]:Math.max(.5,Math.min(2,+(Number(old[player.id]??1)+delta).toFixed(2)))}))}><svg className="live-estate-svg" width={620 * zoom} height={565 * zoom} viewBox="0 0 620 565" role="group" aria-label={`${player.name} 영지`}><circle cx="310" cy="282" r="260" fill="#eee9db" stroke="#cfbea0"/>{player.duchy.cells.map(cell => {
        const x = 310 + 48 * Math.sqrt(3) * (cell.coord.q + cell.coord.r / 2), y = 282 + 72 * cell.coord.r;
        const occupied = cell.tileId ? game.tiles[cell.tileId] : null;
        const selected = selectedCell?.playerId === player.id && selectedCell.cellId === cell.id;
        const canPlace = player.id === actorId && selectedTileId && active.storage.includes(selectedTileId) && permitted(makeDieAction({ kind: "place-tile", tileId: selectedTileId, cellId: cell.id }));
        const select = () => setSelectedCell({ playerId: player.id, cellId: cell.id });
        return <g key={cell.id} role="button" tabIndex={0} aria-label={`${player.name} ${cell.id} ${tileInfo[cell.terrain].name} ${cell.number}${occupied ? ` 배치됨 ${titleFor(cell.tileId!)}` : " 빈칸"}${canPlace ? " 배치 가능" : ""}`} aria-pressed={selected} onClick={select} onKeyDown={e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); select(); } }} className="hex-cell">
          <polygon points={polygon(x, y, 44)} fill={tableView ? tableColors[occupied?.type ?? cell.terrain] : tileInfo[occupied?.type ?? cell.terrain].color} fillOpacity={occupied ? 1 : .27} stroke={selected ? "#172437" : canPlace ? "#a27a30" : "#faf6ed"} strokeWidth={selected || canPlace ? 4 : 2}/>
          {occupied ? <TileArt tile={occupied} x={x-35} y={y-39} width={70} height={77}/> : tableView ? <BoardDie x={x} y={y} value={cell.number}/> : <text x={x} y={y + 6} className="hex-number">{cell.number}</text>}{!occupied && <text x={x} y={y + 27} className="hex-label">{tileInfo[cell.terrain].name}</text>}
        </g>;
      })}{hasExtension(game,"border-posts") && BORDER_POSTS.map(post=><g key={post.id} aria-label={`국경 초소 ${post.id}`}><circle cx={post.x} cy={post.y} r="13" fill="#a64335" stroke="#f7dc89" strokeWidth="3"/><text x={post.x} y={post.y+5} textAnchor="middle" fontSize="15" fill="#fff4ce">♜</text></g>)}</svg></BoardViewport>{tableView && <div className="estate-keyspaces" aria-label={`${player.name} 타일 보관함`}>{player.storage.map((id,i) => <button key={i} className={`keyspace ${id && selectedTileId === id ? "selected" : ""}`} aria-label={`${player.name} 개인 보관 ${i+1} ${id ? titleFor(id) : "빈칸"}`} disabled={id === null || player.id !== actorId} onClick={() => {setSelectedTileId(id);setSelectedCell(null);}}>{id ? tileFace(id) : <span>◇</span>}</button>)}</div>}<div className="board-bottom"><span>{player.duchy.cells.filter(c => c.tileId).length} / {player.duchy.cells.length} · {player.victoryPoints}점{hasExtension(game,"border-posts") ? ` · 초소 연결 ${connectedPostPairs(player).length}/3` : ""}</span><div className="live-zoom"><button aria-label={`${player.name} 영지 축소`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.max(.5, +(Number(z[player.id] ?? 1) - .1).toFixed(2)) }))}>−</button><span>{Math.round((boardZooms[player.id] ?? 1) * 100)}%</span><button aria-label={`${player.name} 영지 확대`} onClick={() => setBoardZooms(z => ({ ...z, [player.id]: Math.min(2, +(Number(z[player.id] ?? 1) + .1).toFixed(2)) }))}>+</button></div></div></section>;
  }

  const boards = focus ? [active, ...game.players.filter(p => p.id !== actorId)] : game.players;
  return <main className={`app-shell ${tableView ? "table-view" : ""}`}>
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">♜</span><span>BURGUNDY <b>EXPANDED</b><small>THE ART OF BUILDING AN ESTATE</small></span></Link><div className="header-right"><Link className="outline-button" href="/online">2인 온라인 방</Link><span className="demo-tag">부분 기본판 · 연습 공급</span><button className="outline-button" onClick={() => setTableView(v => !v)}>{tableView ? "기존 디자인 보기" : "테이블 보기"}</button><button className="settings-button" aria-expanded={settings} onClick={() => setSettings(!settings)}>⚙ 게임 준비</button></div></header>
    <section className="intro"><div><div className="eyebrow">THE LOIRE VALLEY · 15TH CENTURY</div><h1>위대한 영지는, 작은 선택에서.</h1><p>{game.turn.stage === "round-setup" ? "모두의 주사위를 굴려 라운드를 시작하세요." : game.status === "finished" ? "E단계까지 마쳤습니다. 최종 점수와 승자를 확인하세요." : game.turn.stage === "phase-end" ? "다섯 라운드를 마쳤습니다. 단계 수입을 받고 다음 단계로 진행하세요." : `${active.name}의 차례 · 남은 주사위 ${dice.filter(d => !d.used).length}개`}</p></div><div className="round-display"><span>단계 · 라운드</span><strong>{game.turn.phase} · {game.turn.round}<em> / 5</em></strong></div></section>
    <details className="live-scope"><summary>기본판 연습 · 규칙 지원 범위와 공급 안내</summary><p>공식 전체 게임 준비는 아직 지원하지 않습니다. 공식 영지 {officialOptions.length}개 검증 완료 · {game.config.catalogId === "project:base-160-v1" ? "사용자 지정 가축 구성" : "공급 타일은 연습 구성"} · {game.config.marketRecipeId === "se:main:2" ? "사진 기준 2인 슬롯 · 프로젝트 타일 160개" : game.config.marketRecipeId ? "3·4인 공식 슬롯" : "자체 연습 슬롯"} · 시작 플레이어 선택 가능 · 진행·보기 설정 자동 저장.</p><p>{game.config.extensions.some(e=>e.id==="additional-hexes") ? "선택 추가 타일: 수도원27/28·기중기·거위 활성. " : ""}지원: 네 가지 행동·전체 기본 타일 효과·성/시청 연쇄·수도원1~26. A~E 진행과 최종 정산을 지원하며 2인은 사용자 지정 타일 구성으로 보충합니다.</p></details>
    {settings && <section className="settings-panel live-setup"><h2>게임 준비</h2><label><input type="checkbox" checked={additionalHexes} onChange={e=>setAdditionalHexes(e.target.checked)}/> 추가 타일 · 수도원27/28·기중기·거위</label><label>플레이 방식 <select aria-label="플레이 방식" value={playMode} onChange={e=>setPlayMode(e.target.value)}><option value="local">로컬 · 번갈아 플레이</option><option value="computer">일반 AI 상대</option><option value="demo">AI 시연 · 모두 자동</option></select></label><p>일반 AI는 프로젝트 자체 상대이며 공식 샤토마·솔로 규칙과 다릅니다.</p><label><input type="checkbox" checked={geese} onChange={e=>setGeese(e.target.checked)}/> 거위 타일 (검은 뒷면 1개)</label><label><input type="checkbox" checked={borderPosts} onChange={e=>setBorderPosts(e.target.checked)}/> 국경 초소 연결 · 단계 점수와 선착순 보너스</label><label>플레이어 수 <select aria-label="플레이어 수" value={count} onChange={e => { setCount(Number(e.target.value)); setFirstSeat(s=>Math.min(s,Number(e.target.value)-1)); }}>{[2,3,4].map(n => <option key={n} value={n}>{n}명{n>2?" · 연습 공급":""}</option>)}</select></label><label>주사위 시드 <input maxLength={128} value={seed} onChange={e => setSeed(e.target.value)}/></label>{names.slice(0, count).map((name, i) => <div className="setup-seat" key={i}><label>좌석 {i + 1} 이름 <input value={name} maxLength={30} onChange={e => setNames(old => old.map((n, j) => j === i ? e.target.value : n))}/></label><label>색상 <select aria-label={`좌석 ${i+1} 색상`} value={colors[i]} onChange={e=>setColors(old=>old.map((c,j)=>j===i?e.target.value as PlayerColor:c))}>{(["blue","red","green","yellow"] as const).map((c,k)=><option value={c} key={c}>{["파랑","빨강","초록","노랑"][k]}</option>)}</select></label><label>시작 성 <select aria-label={`좌석 ${i+1} 시작 성`} value={startingCastleIds[i]} onChange={e=>setStartingCastleIds(old=>old.map((c,j)=>j===i?e.target.value:c))}><option value="">권장 시작 성</option>{(VERIFIED_BOARD_DEFINITIONS.find(b=>b.id===boardIds[i])??practiceBoard(i%2)).startingCastle.allowedCellIds.map(id=><option value={id} key={id}>성 {id}</option>)}</select></label><label>영지 <select aria-label={`좌석 ${i + 1} 영지 선택`} value={boardIds[i]} onChange={e => { setBoardIds(old => old.map((id, j) => j === i ? e.target.value : id)); setStartingCastleIds(old=>old.map((id,j)=>j===i?"":id)); }}><option value="">자체 제작 연습 영지 (비공식)</option>{officialOptions.length === 0 && <option disabled value="unavailable">공식 영지 · 검증된 데이터 없음</option>}{officialOptions.map(b => <option key={b.id} value={b.id}>영지 {b.officialNumber}{b.family === "base" ? " · 기본" : " · 추가 지형"}</option>)}</select></label></div>)}<label>시작 플레이어 <select aria-label="시작 플레이어" value={firstSeat} onChange={e=>setFirstSeat(Number(e.target.value))}>{names.slice(0,count).map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label><p>공식 규칙의 최고 주사위 눈으로 시작 플레이어를 정한 뒤 선택하세요. 최고 눈 동률 처리 방식은 임의로 정하지 않습니다.</p><p>새 연습 시작은 현재 화면의 진행을 초기화합니다. 영지 1~30을 선택할 수 있습니다. 초소 규칙은 위 선택으로 활성화할 수 있습니다. 11~18번의 선택적 같은 지형·성 연결 조건은 아직 미적용입니다.</p><button onClick={newSession}>새 연습 시작</button></section>}
    {computerPlayerIds.length>0 && <section className="live-scope computer-status" aria-label="일반 AI 상태"><strong>일반 AI · {computerPlayerIds.map(id=>game.players.find(p=>p.id===id)?.name).join(", ")}</strong><span>{game.status === "finished" ? "게임 종료 · 자동 진행 완료" : computerPaused ? "일시정지 · 수동 조작 가능" : computerTurn ? "생각하는 중…" : "사람의 차례"}</span><button className="outline-button" disabled={game.status === "finished"} onClick={()=>setComputerPaused(p=>!p)}>{computerPaused ? "AI 계속 진행" : "AI 일시정지"}</button></section>}
    <div className="live-view-controls"><button className="outline-button" onClick={()=>{const width=estateArea.current?.clientWidth??620;const columns=width>760?Math.min(2,game.players.length):1;setGlobalZoom(Math.max(.5,Math.min(2,(width/columns-30)/(620*(tableView?.58:1)))));setBoardZooms({});}}>화면 맞춤</button><small>Alt+드래그 이동 · Ctrl+휠 영지 확대</small><button className="outline-button" onClick={() => setFocus(!focus)}>{focus ? "전체 영지 모드로" : "현재 차례 중심 모드로"}</button><label>전체 배율 <input aria-label="전체 배율" type="range" min={50} max={200} value={Math.round(globalZoom * 100)} onChange={e => setGlobalZoom(Number(e.target.value) / 100)}/>{Math.round(globalZoom * 100)}%</label><button className="outline-button" onClick={() => { setGlobalZoom(1); setBoardZooms({}); }}>기본 배율 복원</button></div>
    <section className="live-scope" aria-label="저장과 게임 진행"><button className="outline-button" onClick={exportSave} disabled={!saveReady}>저장 파일 내보내기</button><label> 저장 파일 불러오기 <input aria-label="저장 파일 불러오기" type="file" accept=".json,application/json" disabled={!saveReady} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 2_000_000) throw new Error("저장 파일은 2MB 이하여야 합니다."); const saved = parseSavedGame(await file.text()); restore(saved); setNotice("저장한 진행을 불러왔습니다."); } catch { setNotice("저장 파일을 불러오지 못했습니다. 현재 진행은 유지됩니다."); } }}/></label>{game.turn.stage === "phase-end" && <button className="primary-button" disabled={!permitted({ type: "advance-phase", playerId: actorId })} onClick={() => run({ type: "advance-phase", playerId: actorId })}>{game.turn.phase === "E" ? "E단계 수입 · 최종 정산" : "단계 수입 · 다음 단계 준비"}</button>}</section>
    {ending.ok && ending.value.ended && <section className="panel live-scope" aria-label="게임 결과"><h2>게임 종료 · {ending.value.winnerIds.map(id => game.players.find(p => p.id === id)!.name).join(", ")} 승리</h2>{ending.value.scores.map(s => <p key={s.playerId}>{game.players.find(p => p.id === s.playerId)!.name}: {s.earnedTotal} + 종료 점수 {s.finalAdditionsTotal} = <strong>{s.total}점</strong></p>)}</section>}
    {game.turn.pendingChoice && <section className="panel live-scope choice-panel" aria-label="타일 효과 선택"><h2>{game.turn.pendingChoice.source.section === "Ship goods" ? "선박 · 상품 선택" : game.turn.pendingChoice.source.section}</h2><p>추가 주사위 없이 즉시 효과를 선택하세요. 선택이 끝나면 차례를 계속 진행합니다. 건물 효과 도중에도 아래 공급처에서 검은 타일을 구매할 수 있습니다.</p><div>{game.turn.pendingChoice.options.map(o => <button className="outline-button" key={o.id} onClick={() => run({ type: "resolve-choice", playerId: actorId, choiceId: game.turn.pendingChoice!.id, optionId: o.id })}>{o.label}</button>)}</div></section>}
    {notice && <p role="alert" className="live-scope">{notice}</p>}
    <div className="game-layout">
      {tableView && <CommonBoard game={game} selectedTileId={selectedTileId} onSelect={id=>{setSelectedTileId(id);setSelectedCell(null);}} titleFor={titleFor} zoom={commonZoom} onZoom={setCommonZoom} canRoll={permitted({type:"roll-round",playerId:actorId})} onRoll={()=>run({type:"roll-round",playerId:actorId})} acquisition={selectedTileId && takeAction ? {tile:game.tiles[selectedTileId],title:titleFor(selectedTileId),enabled:permitted(takeAction),replacesTile:!!destination.discardTileId,onAcquire:()=>run(takeAction)} : null}/>}{!tableView && <aside className="panel supply-panel"><div className="panel-heading"><div><span className="eyebrow">CENTRAL DEPOT</span><h2>공용 공급처</h2></div></div><p className="muted panel-description">연습 구성 · 타일을 선택한 뒤 획득</p>{game.market.numberedDepots.map(depot => <div className="depot" key={depot.number}><div className="depot-number"><span>{depot.number}</span><small>상품 {depot.goods.length}</small></div><div className="depot-tiles">{depot.slots.map(slot => slot.tileId ? <button key={slot.id} className={`tile-button ${selectedTileId === slot.tileId ? "selected" : ""}`} aria-label={`${depot.number}번 공급처 ${titleFor(slot.tileId)}`} aria-pressed={selectedTileId === slot.tileId} onClick={() => { setSelectedTileId(slot.tileId); setSelectedCell(null); }}>{tileFace(slot.tileId)}<small>{titleFor(slot.tileId)}</small></button> : <span className="empty-supply" key={slot.id}>획득됨</span>)}</div></div>)}<h3 className="live-subheading">검은 공급처 · 은화 2</h3><div className="depot-tiles">{game.market.blackDepot.map((id, i) => id ? <button key={id} className={`tile-button ${selectedTileId === id ? "selected" : ""}`} aria-label={`검은 공급처 ${titleFor(id)}`} onClick={() => setSelectedTileId(id)}>{tileFace(id)}<small>{titleFor(id)}</small></button> : <span key={i} className="muted">획득됨</span>)}</div><div className="supply-foot">흰 주사위 {game.dice.whiteDie ?? "—"} · 라운드 상품 {game.market.roundGoods.length}개 남음</div></aside>}
      <div className="live-estates" ref={estateArea}>{boards.map(renderBoard)}</div>
      <aside className="right-column"><section className="panel player-panel live-player-panel"><div className="panel-heading"><div><span className="eyebrow">PLAYERS</span><h2>영주들</h2></div><span className="muted">{game.players.length}인</span></div><div className="player-list">{game.players.map((p, i) => <div className={`player-card ${p.id === game.turn.activePlayerId ? "active" : ""}`} key={p.id}><span className={`avatar avatar-${i}`} style={{background:playerColor(p)}}>{p.name.slice(0, 1)}</span><span className="player-name">{p.name}<small>{p.id === game.turn.activePlayerId ? "현재 차례" : "대기"}</small></span><span className="score">{p.victoryPoints}<small>VP</small></span></div>)}</div>
        <h3 className="live-subheading">{active.name}의 자원</h3><div className="resources"><div><span>◈</span><strong aria-label="현재 은화">{active.silver}</strong><small>은화</small></div><div><span>♟</span><strong aria-label="현재 일꾼">{active.workers}</strong><small>일꾼</small></div><div><span>▧</span><strong>{active.goods.reduce((n, g) => n + g.tiles.length, 0)}</strong><small>상품</small></div></div>
        <div className="dice-heading"><h3>행동할 주사위 선택</h3></div><div className="dice-row">{dice.map((d, i) => <button key={d.id} aria-label={`행동 주사위 ${i + 1} 눈 ${d.value}${d.used ? " 사용됨" : ""}`} aria-pressed={dieIndex === i} className={`die live-die ${dieIndex === i ? "selected-die" : ""}`} disabled={game.turn.stage !== "player-turn" || d.used} onClick={() => { setDieIndex(i); setShift(0); }}><span>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][d.value]}</span></button>)}</div>
        <div className="live-adjust"><button aria-label="주사위 보정 감소" disabled={game.turn.stage !== "player-turn" || die.used || shift <= -5} onClick={() => setShift(s => s - 1)}>−</button><span>보정 후 <b>{effectiveDie}</b> · 변경 {Math.abs(shift)}칸</span><button aria-label="주사위 보정 증가" disabled={game.turn.stage !== "player-turn" || die.used || shift >= 5} onClick={() => setShift(s => s + 1)}>+</button></div><p className="resource-note">행동에 맞는 수도원 보정을 자동 적용하고 필요한 일꾼을 실행 시 차감합니다.</p>
        <button className="outline-button w-full" disabled={!permitted({ type: "roll-round", playerId: actorId })} onClick={() => run({ type: "roll-round", playerId: actorId })}>라운드 주사위 굴리기</button><button className="outline-button w-full live-gap" disabled={!permitted(makeDieAction({ kind: "take-workers" }))} onClick={() => run(makeDieAction({ kind: "take-workers" }))}>일꾼 2개 획득</button>
        <button className="outline-button w-full live-gap" disabled={!permitted({type:"buy-workers",playerId:actorId})} onClick={()=>run({type:"buy-workers",playerId:actorId})}>수도원28 · 은화1 → 일꾼2</button><h3 className="live-subheading">상품 판매</h3>{active.goods.length === 0 ? <p className="muted">판매할 상품이 없습니다.</p> : active.goods.map(g => <button key={g.type} className="outline-button w-full live-gap" disabled={!permitted(makeDieAction({ kind: "sell-goods", goodsType: g.type }))} onClick={() => run(makeDieAction({ kind: "sell-goods", goodsType: g.type }))}>{g.type}번 상품 {g.tiles.length}개 판매 · +{g.tiles.length * game.config.playerCount}점</button>)}
        <button className="primary-button w-full live-gap" disabled={!permitted({ type: "end-turn", playerId: actorId })} onClick={() => run({ type: "end-turn", playerId: actorId })}>차례 마치기 →</button><p className="resource-note">두 주사위를 사용한 뒤 차례를 마칩니다.</p></section>
        <section className="panel expansion-panel"><span className="eyebrow">STORAGE</span><h2>{active.name}의 보관 타일</h2><div className="live-storage">{active.storage.map((id, i) => <button key={i} className={`tile-button ${selectedTileId === id && id !== null ? "selected" : ""}`} disabled={id === null} aria-label={`보관 ${i + 1} ${id ? titleFor(id) : "빈칸"}`} onClick={() => { setSelectedTileId(id); setSelectedCell(null); }}>{id ? <>{tileFace(id)}<small>{titleFor(id)}</small></> : <span className="empty-tile">◇</span>}</button>)}</div><p className="muted">보관 타일 선택 → 금색 테두리의 빈칸 선택 → 배치</p><label className="live-slot-label">획득할 보관 칸 <select value={targetSlot} onChange={e => setSlotSelection(Number(e.target.value))}>{active.storage.map((id, i) => <option value={i} key={i}>{i + 1}번 {id ? `${titleFor(id)}${active.storage.every(t => t !== null) ? " 폐기 후 교체" : " 사용 중"}` : "빈칸"}</option>)}</select></label></section>
      </aside>
    </div>
    <div className="bottom-layout"><section className="panel detail-panel"><div className="detail-tile">{selectedTileId && tile ? tileFace(selectedTileId) : <span className="empty-tile">✧</span>}</div><div className="detail-copy"><span className="eyebrow">SELECTED TILE</span><h2>{selectedTileId && tile ? titleFor(selectedTileId) : "타일을 선택하세요"}</h2>{tile && <p>{tileHelp(tile)}</p>}<p>{tile && !supportsPlacement(tile) ? "이 타일의 배치 효과는 아직 지원하지 않습니다." : selectedTileId !== null && active.storage.includes(selectedTileId) ? "색·주사위 눈·인접 조건을 만족하는 칸에만 배치할 수 있습니다." : "공급처에서 획득하면 개인 보관 칸으로 이동합니다."}</p><small>영지 완성 점수는 규칙 엔진에서 계산합니다. 선택만으로 게임 상태는 바뀌지 않습니다.</small></div><div className="live-detail-actions"><button className="primary-button" disabled={!permitted(takeAction)} onClick={() => takeAction && run(takeAction)}>{destination.discardTileId ? "선택한 보관 타일 폐기 후 획득" : "보관으로 획득"}</button><button className="outline-button" disabled={!selectedTileId || !takeDepot || !permitted({type:"use-monastery-six",playerId:actorId,depot:takeDepot.number,tileId:selectedTileId,...destination})} onClick={()=>selectedTileId&&takeDepot&&run({type:"use-monastery-six",playerId:actorId,depot:takeDepot.number,tileId:selectedTileId,...destination})}>수도원6 · 일꾼2로 획득</button><button className="primary-button" disabled={!permitted(placeAction)} onClick={() => placeAction && run(placeAction)}>영지에 배치 ↗</button></div></section><section className="panel log-panel"><div className="log-heading"><h2>행동과 점수 기록</h2><span>{logs.length}개</span></div><div className="logs live-logs" aria-live="polite">{logs.map((message, i) => <p key={`${game.revision}-${i}`}><span>{logs.length - i}</span>{message}</p>)}</div></section></div>
    {game.status !== "finished" && <div className="mobile-action-dock" aria-label="모바일 게임 조작"><div><strong>{active.name} · {active.victoryPoints}점</strong><small>{tile && selectedTileId ? titleFor(selectedTileId) : `주사위 ${effectiveDie} · ${game.turn.phase}${game.turn.round}`}{selectedCell ? ` · 선택 칸 ${selectedCell.cellId}` : ""}</small></div>{takeAction ? <button className="primary-button" disabled={!permitted(takeAction)} onClick={()=>run(takeAction)}>{destination.discardTileId ? "폐기 후 획득" : "타일 획득"}</button> : <button className="primary-button" disabled={!permitted(placeAction)} onClick={()=>placeAction&&run(placeAction)}>선택 칸에 배치</button>}<button className="outline-button" disabled={!permitted({type:"end-turn",playerId:actorId})} onClick={()=>run({type:"end-turn",playerId:actorId})}>차례 종료</button></div>}
    <footer><span>♜ BURGUNDY EXPANDED</span><p>자체 SVG · 연습 공급 · 공식 기본판 전체 게임 미완성</p><span>모든 행동은 규칙 검사 후 실행됩니다.</span></footer>
  </main>;
}
