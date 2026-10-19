# 현재 개발 체크포인트

2026-10-19 · 요새23–30 줄 완성 + 랜덤 후보2개 구현·검증 완료, 백업 준비. 전체 프로젝트 미완료.
- 기준 main/79cfdd0. 기존 미커밋 수도원27/28 원본2개 보존·백업 제외. 공용 보드·이미지·프레임·기존37칸 데이터는 변경하지 않았다. 공식 자료 조사 없이 사용자 빨간 선/설명을 프로젝트 규칙으로 기록했다.
- 요새: 보드23–30 각각 r=-2의5칸, q=-2/r=-1..3의5칸, q+r=2/r=-1..3의5칸을 명시. 외곽(70,138)/(310,590)/(550,138), 줄 강조/미완성·기존완성·획득 표시. 1–22 미적용,23–30 자동 적용. 세 실제 줄은 겹치지 않으며 일반 동시 판정은 교차 TEST FIXTURE로 검증했다.
- 점수: placement가 줄별 새 완성 때 공통 단계10/8/6/4/2점, 고유fortress ledger ID로 중복/재전송/단계 재지급 방지. 일반 구역/색상 점수 독립. AI 기존 배치평가에 자동 반영,2·3·4인25라운드 완주. 온라인 서버 계산과 양쪽 공개 요새 기록·로그·재접속 검증.
- 저장 호환: 버전 유지·과거 border:* 점수 보존·소급 지급 없음. 기존 완성 줄은 ‘기존 완성’ 표시. 옛 연결 유틸/테스트는 보존하지만 현재 엔진은 호출하지 않는다. 새 잘못된/중복 요새 ledger는 거부한다.
- 아이콘: fortress-markers.tsx의 FORTRESS_ICON 경로/크기/offset 공통 설정. /tiles/fortress.png 예약 경로(현재 파일 없음). 사전 로드 성공 시만 PNG 표시, 실패·지연은 SVG 유지. 정상 TEST PNG 교체 시 위치/게임 상태 불변 확인. 실제 그림 제작 없음.
- 랜덤: 기본1–22/요새23–30/전체1–30의 등록 데이터만 균등 후보2개(중복 없음). 로컬 준비 체크로 활성화·수동 기존 시작도 유지. 각좌석 범위/선택/후보/cursor를 localStorage board-draft-v1에 보존,2/4인 실제UI 시작·2–4인코어 검증·AI후보 자동선택. 저장 복원 완료 전 준비 버튼을 잠가 새로고침 경합을 막았다.
- 온라인: 새 랜덤방은 서버 room.draft로 후보 생성/보관, 본인 좌석·후보·범위·revision 검증. 양쪽 선택 전 게임 행동 금지, 완료 시 실제 선택 영지로 시작. 선택 재접속·양쪽 동기화·위조/다른좌석/오래된 요청 거부, 기존방은 기존 시작 경로 유지. RNG는 공개하지 않으며 저장 좌석 순서/보드 일치도 검증한다.
- 검사: 전체코어311/311·보드33/33 통과. PC는 신규14/14(요새8보드3배율/완료복원+누락PNG+정상PNG+로컬3시나리오+온라인)와 기존직접조작10/10(실제25라운드 포함)을 분리 재검증했다. 최종 후보3/4인·좌석순서 강화 후 관련코어4/4 재통과. TypeScript·전체ESLint·빌드 통과, 마지막 후보검증 소스의 타입/관련린트/빌드도 재통과했다.
- 화면: fortress-{23..30}-{100,160,200}.png 및 fortress-{23..30}-awarded.png(총32장) 생성. 최종 overview100/160/200와 원본28번 전후를 직접 확인. 아이콘/모든37칸 polygon 분리축 검사 통과, PNG누락/정상교체·타일클릭 비간섭 확인. board-draft-local.png 실제 후보 미리보기도 직접 확인. 고정 안내바는 QA 캡처 시만 숨겨 영지 전체를 기록한다.
- 실패/해결: 참가 직후 이전revision으로 선택한 온라인 테스트는 최신 참가 상태를 받은 뒤 요청하도록 보완(서버409 거부는 정상). PNG 지연/깨진이미지 표시를 사전로드/fallback으로 해결. 복원 전 준비 화면 클릭 경합은 saveReady 잠금으로 해결. 실패 검사를 완료로 처리하지 않았으며 관련 재검증은 통과했다.
- 파일: src/game/{board-draft.ts,boards/fortress-lines.ts,core/{fortress-lines,border-posts,placement,state}.ts,types.ts}; src/app/{board-choices.tsx,fortress-markers.tsx,game-screen.tsx,online/room-screen.tsx,globals.css}; src/server/{rooms,room-http}.ts; tests/{fixtures/fortress.ts,core/{fortress,fortress-online,board-draft}.test.ts,core/run.mjs,browser/{fortress,fortress-online,board-draft}.spec.ts}; docs/{TODO.md,PROGRESS.md,rules/fortress-lines-and-board-draft.md,history/progress-common-layout-2026-10-19.md}.
- 다음: 최종 검사 결과와안전한 diff/민감정보·비공개main을 확인하고 해당 파일만 Commit/Push·원격해시 확인. 모바일 정밀QA·실제PNG 제공·기존3/4인 연습 공급 제한은 남아 있다. 전체 프로젝트 완료로 취급하지 않는다.
