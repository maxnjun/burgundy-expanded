"use client";

import { useState } from "react";
import Link from "next/link";

type Kind = "castle" | "water" | "pasture" | "building" | "mine" | "knowledge";
const types: Record<Kind, { name: string; color: string; icon: string; detail: string }> = {
  castle: { name: "성", color: "#6a896e", icon: "♜", detail: "영지의 중심이 되는 성입니다. 새로운 전략의 출발점을 만들어 보세요." },
  water: { name: "선박", color: "#6c99aa", icon: "⚓", detail: "강을 따라 교역의 기회를 넓히는 선박입니다. 무역로 확장과 함께 영지를 꾸며 보세요." },
  pasture: { name: "목초지", color: "#a2ac76", icon: "♧", detail: "풍요로운 목초지입니다. 이웃한 초록빛 구역을 연결해 나만의 전원을 만들어 보세요." },
  building: { name: "건물", color: "#cbac82", icon: "⌂", detail: "영지에 활기를 더하는 건물입니다. 마을 구역을 채우며 도시를 확장해 보세요." },
  mine: { name: "광산", color: "#92929b", icon: "⚒", detail: "은을 채굴하는 광산입니다. 영지의 자원 생산 시설을 배치해 보세요." },
  knowledge: { name: "지식", color: "#d2bc70", icon: "✦", detail: "새로운 가능성을 여는 지식 타일입니다. 영지만의 독특한 전략을 상상해 보세요." },
};
const kinds = Object.keys(types) as Kind[];
const supply = Array.from({ length: 12 }, (_, i) => ({ id: i, kind: kinds[(i * 5 + Math.floor(i / 3)) % 6], depot: Math.floor(i / 2) + 1 }));
const cells = Array.from({ length: 7 }, (_, row) => {
  const r = row - 3;
  return Array.from({ length: 7 - Math.abs(r) }, (_, col) => {
    const q = Math.max(-3, -r - 3) + col;
    return { id: `${q},${r}`, x: 310 + 48 * Math.sqrt(3) * (q + r / 2), y: 282 + 72 * r, kind: kinds[(col + row * 2) % 6], number: (col + row * 3) % 6 + 1 };
  });
}).flat();
const polygon = (x: number, y: number, size: number) => Array.from({ length: 6 }, (_, i) => { const a = (60 * i - 30) * Math.PI / 180; return `${x + size * Math.cos(a)},${y + size * Math.sin(a)}`; }).join(" ");
const playerNames = ["엘레오노르", "루이"];
function Dice({ value }: { value: number }) { return <span className="die" aria-label={`주사위 ${value}`}><span>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value]}</span></span>; }
function Tile({ kind, small = false }: { kind: Kind; small?: boolean }) { return <span className={`tile ${small ? "small" : ""}`} style={{ background: types[kind].color }}><span>{types[kind].icon}</span></span>; }

export default function LegacyHome() {
  const [player, setPlayer] = useState(0);
  const [selected, setSelected] = useState<number | null>(0);
  const [cell, setCell] = useState<string | null>(null);
  const [boards, setBoards] = useState<Record<string, Kind>[]>([{ "0,0": "castle", "1,-1": "water", "-1,1": "building" }, { "0,0": "castle" }]);
  const [used, setUsed] = useState<number[]>([]);
  const [dice, setDice] = useState([[3, 5], [2, 6]]);
  const [zoom, setZoom] = useState(1);
  const [shield, setShield] = useState(true);
  const [trade, setTrade] = useState(false);
  const [settings, setSettings] = useState(false);
  const [round, setRound] = useState(1);
  const [logs, setLogs] = useState(["새로운 영지가 여러분을 기다립니다.", "데모 게임이 시작되었습니다."]);
  const log = (message: string) => setLogs(old => [message, ...old].slice(0, 20));
  const chosen = selected === null ? null : supply[selected];
  const placed = Object.keys(boards[player]).length;
  function switchPlayer() { const next = 1 - player; setPlayer(next); setCell(null); if (next === 0) setRound(r => r + 1); log(`${playerNames[next]} 님의 차례입니다.`); }
  function place() {
    if (!chosen || !cell || boards[player][cell] || used.includes(chosen.id)) return;
    setBoards(old => old.map((board, i) => i === player ? { ...board, [cell]: chosen.kind } : board));
    setUsed(old => [...old, chosen.id]); log(`${playerNames[player]} · ${types[chosen.kind].name} 타일 배치 (+2 데모 점수)`); setSelected(null); setCell(null);
  }
  return <main className="app-shell">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">♜</span><span>BURGUNDY <b>EXPANDED</b><small>THE ART OF BUILDING AN ESTATE</small></span></Link><div className="header-right"><span className="demo-tag">인터랙티브 데모</span><span className="header-divider"/><button className="settings-button" onClick={() => setSettings(!settings)} aria-expanded={settings}>⚙ <span>게임 설정</span></button></div></header>
    <section className="intro"><div><div className="eyebrow">THE LOIRE VALLEY · 15TH CENTURY</div><h1>위대한 영지는, 작은 선택에서.</h1><p>주사위를 굴리고, 땅을 넓히고, 당신만의 부르고뉴를 완성하세요.</p></div><div className="round-display"><span>현재 라운드</span><strong>{String(round).padStart(2, "0")}<em> / ∞</em></strong><div className="round-dots">{[1,2,3,4,5].map(i => <i key={i} className={(round - 1) % 5 + 1 >= i ? "filled" : ""}/>)}</div></div></section>
    {settings && <section className="settings-panel"><strong>게임 설정</strong><p>자유 배치 데모 · 인접 조건, 주사위 소모, 정식 점수 계산은 적용하지 않습니다.</p><button onClick={() => { setZoom(1); setSettings(false); }}>기본 배율로 돌아가기</button></section>}
    <div className="game-layout">
      <aside className="panel supply-panel"><div className="panel-heading"><div><span className="eyebrow">CENTRAL DEPOT</span><h2>중앙 공급처</h2></div><span className="count">{12-used.length}</span></div><p className="muted panel-description">영지에 놓을 타일을 선택하세요.</p><div className="depots">{Array.from({length:6},(_,i) => <div className="depot" key={i}><div className="depot-number"><span>{i+1}</span><small>공급처</small></div><div className="depot-tiles">{supply.filter(t => t.depot === i+1).map(t => <button key={t.id} disabled={used.includes(t.id)} aria-label={`${i+1}번 공급처 ${types[t.kind].name}${used.includes(t.id) ? ' 사용됨' : ''}`} aria-pressed={selected === t.id} onClick={() => setSelected(t.id)} className={`tile-button ${selected===t.id?'selected':''}`}><Tile kind={t.kind}/><small>{used.includes(t.id) ? "배치 완료" : types[t.kind].name}</small></button>)}</div></div>)}</div><div className="supply-foot"><span>✧</span> 모든 선택이 새로운 전략이 됩니다.</div></aside>
      <section className="panel estate-panel"><div className="estate-heading"><div><span className="eyebrow">YOUR DOMAIN</span><h2>{playerNames[player]}의 영지 <span className="board-number">보드 01</span></h2></div><span className="live-status"><i/> 자유 배치 모드</span></div><div className="board-area"><div className="board-label">DUCHÉ DE BOURGOGNE</div><svg className="estate-svg" viewBox="0 0 620 565" role="group" aria-label={`${playerNames[player]}의 육각형 영지 보드`}><defs><radialGradient id="boardGlow"><stop stopColor="#f8f4e9"/><stop offset="1" stopColor="#e8e5d8"/></radialGradient></defs><circle cx="310" cy="282" r="262" fill="url(#boardGlow)" stroke="#cfbea0" strokeWidth="1"/><circle cx="310" cy="282" r="253" fill="none" stroke="#cfbea0" strokeDasharray="2 7"/><g transform={`translate(310 282) scale(${zoom}) translate(-310 -282)`}>{trade && <path d="M 95 350 Q 300 65 525 310" fill="none" stroke="#6699ac" strokeWidth="12" strokeDasharray="6 8" opacity=".6"/>}{cells.map(c => { const occupied = boards[player][c.id]; const active = cell === c.id; return <g key={c.id} role="button" tabIndex={0} aria-label={`${c.id} ${types[c.kind].name} 구역 ${c.number}${occupied ? ', 배치됨' : ', 빈칸'}`} aria-pressed={active} onClick={() => setCell(c.id)} onKeyDown={e => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); setCell(c.id); } }} className="hex-cell"><polygon points={polygon(c.x,c.y,44)} fill={types[occupied || c.kind].color} fillOpacity={occupied ? 1 : .27} stroke={active ? "#172437" : "#f9f5ea"} strokeWidth={active ? 4 : 2}/><polygon points={polygon(c.x,c.y,38)} fill="none" stroke={active ? "#c7a66b" : types[c.kind].color} strokeOpacity=".45" strokeWidth="1"/>{occupied ? <><text x={c.x} y={c.y+9} className="hex-icon">{types[occupied].icon}</text><circle cx={c.x+25} cy={c.y+24} r="8" fill="#f4efe5"/><text x={c.x+25} y={c.y+28} className="hex-check">✓</text></> : <><text x={c.x} y={c.y+6} className="hex-number">{c.number}</text><text x={c.x} y={c.y+25} className="hex-label">{types[c.kind].name}</text></>}</g>; })}</g></svg>{shield && <div className="estate-shield">♜<small>BURGUNDY</small></div>}<div className="board-controls"><button aria-label="보드 축소" disabled={zoom <= .8} onClick={() => setZoom(z => Math.max(.8, +(z-.1).toFixed(1)))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="보드 확대" disabled={zoom >= 1.3} onClick={() => setZoom(z => Math.min(1.3, +(z+.1).toFixed(1)))}>+</button></div></div><div className="board-bottom"><span><i className="player-dot"/> {placed} / 37 구역 개척</span><span>타일 선택 <b>→</b> 빈 구역 선택 <b>→</b> 배치</span></div><div className="legend">{kinds.map(k => <span key={k}><i style={{background:types[k].color}}/>{types[k].name}</span>)}</div></section>
      <aside className="right-column"><section className="panel player-panel"><div className="panel-heading"><div><span className="eyebrow">PLAYERS</span><h2>영주들</h2></div><span className="muted">2인</span></div><div className="player-list">{playerNames.map((name,i) => <button className={`player-card ${player===i?'active':''}`} key={name} onClick={() => { if(player!==i) switchPlayer(); }} aria-pressed={player===i}><span className={`avatar avatar-${i}`}>{i===0?'E':'L'}</span><span className="player-name">{name}<small>{player===i?'현재 차례':'다음 차례'}</small></span><span className="score">{(Object.keys(boards[i]).length-1)*2}<small>VP · 데모</small></span></button>)}</div><div className="resources"><div><span>◈</span><strong>3</strong><small>은화</small></div><div><span>♟</span><strong>2</strong><small>일꾼</small></div><div><span>▧</span><strong>1</strong><small>상품</small></div></div><div className="resource-note">자원은 데모 예시 값입니다.</div><div className="dice-heading"><h3>이번 차례의 주사위</h3><span>테스트</span></div><div className="dice-row">{dice[player].map((d,i) => <Dice key={i} value={d}/>)}</div><button className="outline-button w-full" onClick={() => { const values = [1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)]; setDice(old => old.map((d,i)=>i===player?values:d)); log(`${playerNames[player]} · 주사위 ${values.join(', ')} 굴림`); }}>⟳ 주사위 굴리기</button><button className="primary-button w-full" onClick={switchPlayer}>차례 마치기 <span>→</span></button></section><section className="panel expansion-panel"><span className="eyebrow">A NEW PERSPECTIVE</span><h2>확장 모듈 <span>DEMO</span></h2><p className="muted">영지에 새로운 가능성을 더하세요.</p>{[{name:'방패 확장',sub:'가문의 문장 표시',value:shield,set:setShield},{name:'무역로 확장',sub:'영지의 교역로 표시',value:trade,set:setTrade}].map(item=><button className="expansion-row" key={item.name} role="switch" aria-checked={item.value} onClick={()=>{item.set(!item.value);log(`${item.name} ${!item.value?'활성화':'비활성화'}`);}}><span className="expansion-symbol">{item.name==='방패 확장'?'♜':'⚓'}</span><span>{item.name}<small>{item.sub}</small></span><span className={`toggle ${item.value?'on':''}`}><i/></span></button>)}</section></aside>
    </div>
    <div className="bottom-layout"><section className="panel detail-panel"><div className="detail-tile">{chosen ? <Tile kind={chosen.kind}/> : <span className="empty-tile">✧</span>}</div><div className="detail-copy"><span className="eyebrow">SELECTED TILE</span><h2>{chosen ? types[chosen.kind].name : "다음 선택을 기다립니다"} <span className="detail-badge">데모 타일</span></h2><p>{chosen ? types[chosen.kind].detail : "중앙 공급처에서 새로운 타일을 선택하세요."}</p><small>데모 효과: 빈 구역에 자유 배치 · 배치당 2점 · 정식 게임 규칙과 다를 수 있습니다.</small></div><button className="primary-button place-button" disabled={!chosen || !cell || !!boards[player][cell] || used.includes(chosen.id)} onClick={place}>{cell && boards[player][cell] ? "이미 배치된 구역" : "영지에 배치"}<span>↗</span></button></section><section className="panel log-panel"><div className="log-heading"><h2>영지의 기록</h2><span>최근 {logs.length}개</span></div><div className="logs" aria-live="polite">{logs.map((entry,i)=><p key={`${entry}-${i}`}><span>{String(logs.length-i).padStart(2,'0')}</span>{entry}</p>)}</div></section></div>
    <footer><span>♜ BURGUNDY EXPANDED</span><p>The Castles of Burgundy에서 영감을 받은 비공식 UI 데모 · 독자 제작 SVG 디자인</p><span>당신의 다음 수를 기대합니다.</span></footer>
  </main>;
}


