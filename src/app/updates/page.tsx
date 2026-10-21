import Link from "next/link";
import {GAME_VERSION} from "../../game/release";
export default function Updates(){return <main className="app-shell"><section className="panel"><h1>업데이트 내역</h1><p>현재 버전 {GAME_VERSION.slice(0,12)}</p><h2>2026-10-22 · 온라인 연결과 배포 준비</h2><ul><li>초대 링크, 준비 완료와 방장 시작, 자리 보호 및 안전한 재접속.</li><li>연결 복구와 WebSocket 상태 알림, 업데이트 버전 안내.</li><li>모바일 보드 조작과 상품·포도·방패 설명 유지.</li></ul><h2>이전 업데이트</h2><p>포도 자동 보상, 방패 반환 교체, 시작 성 직접 선택, 실물 상품 겹침과 최종 정산표.</p><Link href="/">게임으로 돌아가기</Link></section></main>;}
