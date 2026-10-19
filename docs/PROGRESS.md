# 최신 체크포인트 — 포도밭 공개 자료 조사

2026-10-20 · 조사 전용 완료, 구현 금지/추가 승인 대기. 기준 main/48083e9.
- 결과: research/vineyards-reconstruction.md(출처/등급/보드24칸/12공간·12숫자/24보너스·51장C수량 후보·호환성·대안), research/vineyards-board-analysis.svg(자체 도식).
- 원본 공식PDF 직접200/19,620,991bytes 및 기존PDF SHA일치. 공개 빈보드/공식도상 교차, 사진14조합과 51장 전수 미확보를 구분. 제거16/29로 혼합15종×3+동색6종×1 논리 복원(C), 공식 전수검증이라고 주장하지 않음.
- 미확인:2/3인 공급대 눈금 세 쌍(E), 보너스6종 개별수량(D), 특수 효과 적용 일부(D), 보드 층/좌표 및 논리 수량은C채택 결정 필요. 사용자에게 사진 요청 없음.
- 검사: 연구 산술51/102/품종17/제거16·29·24좌표 중복0/12쌍 인접 및 SVG XML 검사, 도식 직접 확인. 게임코드 무변경이므로 테스트/타입/린트/빌드/서버 실행하지 않음. PDF/사진 사본은 Git제외 .local-data/vineyards에만 보관.
- 보존: 시작부터 있던 TODO/PROGRESS 여관 기록과 수도원PNG2개를 유지하고 이번 스테이징에서 제외. 기능·PNG원본·렌더러 변경 없음.
- 백업: 조사 문서/도식/체크포인트4파일만 1c05540e3b3611a212f588f57afe682809a9fef0으로 비공개main Commit/Push, 원격해시 일치 확인. 민감정보 패턴0건·원격선행0대0. 이 백업 완료 기록도 후속 문서 커밋으로 보존한다. 최종 보고 후 중단하며 추가 승인 전 데이터 등록/커스텀 확정/구현하지 않는다.

---
이전 체크포인트 보존

# 현재 체크포인트 — 사용자 커스텀 무역로

2026-10-19 · 사용자 고정 데이터 구현, 커스텀 무역로 구현·검증·비공개main 백업 완료. 전체 프로젝트 완료 아님.
- 기준 main/de8a95a. 기존 문서2개의 여관 기록 변경과 수도원 원본PNG2개는 보존하고 이번 커밋에서 제외한다. 여관/그림/프레임/공용 배치·배경은 변경하지 않았다.
- 완료: 사용자12장/36칸, 직접 주사위 판매1회=1칸, 9보상 기존 선택 엔진 재사용, 모든 보상/후속 판매의 재진행 차단, 서버 RNG배분/검증/재접속, 저장 검증, AI평가, 접힌 현재1장/전체 펼치기/자동 전환/뒷면/완료 표시. 공식 자료 추가 조사 없음. 상세 규칙/36칸: rules/custom-trade-routes.md.
- 검사: 신규 코어21+온라인1/22 통과, 전체 npm run test:core 364/364, npm run test:boards33/33, npx tsc --noEmit·npm run lint·npm run build 통과. AI2/3/4인25라운드+확장 동시활성/중간저장 포함. 신규 PC브라우저5/5 통과; 기존 PC회귀19/19도 통과하여 이번 PC합계24/24.
- 화면: .local-data/qa/custom-trade-{collapsed,expanded,sale,mismatch,next-card,complete,online}.png 생성. 펼친 전체·판매보상·경로완료·온라인 실제 스크린샷 직접 확인했다. 기존 공급/영지 SVG 좌표 변경 없음. 모바일 정밀QA는 보류.
- 수정/오류: 테스트 p선언을 const로 수정해 lint 통과. 온라인 브라우저의 접근성 이름을 실제 온라인 행동 종류로 수정해 통과. 샌드박스 전체코어의 임시파일 rename EPERM은 동일명령 일반권한 재실행에서364개 통과. 테스트를 삭제/완화하지 않음.
- 파일: game/custom-trade-routes.ts, core/trade-effects.ts, 기존 effects/engine/state/practice/types/computer, app/trade-route-panel.tsx/game-screen.tsx/css/online/room-screen.tsx, server/rooms.ts/room-http.ts, core/custom-trade*.test.ts/run.mjs, browser/custom-trade*.spec.ts, fixtures/custom-trade.ts, rules/custom-trade-routes.md 및 관련 규칙/체크포인트 문서.
- 다음: 이번 커스텀 무역로 범위 완료. 모바일 정밀QA는 최종 통합 단계에 남겨 둔다. 신규 지시 전 여관/완료 기능을 재작성하지 않는다. 실행: 로컬 게임 준비의 무역로 확장 체크 후 새 연습 시작, 온라인은 온라인 무역로 확장 체크 후 방 생성.
- 백업: 이번26파일만 ea464250bc97c9f4d307e6e2341c0ee247a72c63으로 비공개main Push, 원격 전체해시 일치 확인. 비공개/Push권한/원격0대0 및 민감정보 패턴0건 확인. 문서의 기존 여관 변경은 prefix패치로 분리하고 PNG2개는 제외했다. 이 완료 체크포인트는 후속 문서 커밋으로 백업한다. .local-data 스크린샷/로그는 Git 제외 로컬 산출물.

---
이전 체크포인트 (당시 상태를 보존)

# 현재 체크포인트 — 무역로 확장

2026-10-19 · 기초 모듈/테스트 완료, **실제 게임 확장은 미완료·자료 대기**.
- 시작 main/8a60c2f. 이전부터 미커밋인 TODO/PROGRESS의 여관 완료 기록과 수도원PNG2개를 보존한다. 여관 코드·이미지·공용 보드·양피지 배경은 변경하지 않았고 여관 추가 검사는 하지 않았다.
- 자료: reference 공식PDF3·14페이지와 복사본, 아크릴 스티커PDF 텍스트, Awaken 공식 다운로드/상품/영문PDF 조사. 구성12장·각3칸, 2/3/4인5/4/3장, 좌→우 채우기·번호 일치 보상·초과 판매 규칙 확인. PDF그림은 예시3장뿐, 전체36칸 번호/보상은 확보 못함. 확정 보상 없이 추측하지 않는다.
- 구현: src/game/trade-routes.ts 독립 순수 모듈(카탈로그 주입), 기존RNG로 무작위 배분/잔여, 판매 진행/일치 참조/초과상품/재전송 방지/JSON 이력 검사. 공식 catalog는0개, 가상12장은 tests/core/trade-routes.test.ts의 TEST FIXTURE ONLY. 실제 GameState/GameAction/상품 판매/AI/온라인/UI에는 아직 연결하지 않았다.
- 검사: 신규7/7·기존 core/effects/direct-actions51/51, npx tsc --noEmit·npm run lint·npm run build 통과. 여관 회귀/전체보드/브라우저는 이번 변경과 관계없어 재실행하지 않았다. 마지막 빈 카탈로그 freeze/문구 수정 후 신규7개·타입/린트/빌드도 재통과했다.
- 파일: src/game/trade-routes.ts, tests/core/trade-routes.test.ts, tests/core/run.mjs, docs/rules/{trade-routes,sources,unresolved}.md, TODO/PROGRESS 신규 머리말. 이전 문서 변경은 이번 커밋에 섞지 않도록 패치를 분리한다.
- 연결 설계: core/intents.ts sell-goods 공통 경로. soldGoods 전체 판매이력과 물리적 경로 위치 분리, 수도원15/25·방패9+수도원3·방패2·선택/추가행동을 중복 없이 원자적 실행. 자세한 근거/URL/미완료 목록은 docs/rules/trade-routes.md.
- 백업: 기초 모듈/테스트/조사/신규 체크포인트8파일을 a60029bc1a698c109fee40c80594d35e2be8abe9로 Commit/Push, 비공개main/권한/원격0대0 확인 후 원격 전체해시 일치 확인. 기존 문서2개의 여관 완료 변경과 PNG2개는 미커밋 그대로 남겼다. 실제 확장 전체가 완료된 것은 아니다.
- 다음: 무역로12장 앞면 전체(각3칸 번호/보상 수량)와 불명확 보상 판정을 확보→검증 카탈로그→공통 판매/저장/준비/진행 UI→AI/서버/브라우저 검사. 모바일 정밀QA 보류. 필요한 자료 없이 확장을 활성화하지 않는다.

---
이전 여관 체크포인트 (기존 변경을 그대로 보존)

# 현재 개발 체크포인트

2026-10-19 · 여관 확장 통합 구현/검증 마무리, 비공개main 백업 대기. 전체 프로젝트 미완료.
- 기준 main/09e9d80. 기존 미커밋 public/tiles/monastery-27.png·monastery-28.png 원본은 보존/백업 제외. 기존 개발 서버 유지.
- 규칙: 사용자 지시문/추가 답변만 적용, 공식 추가조사 없음. 은화2·주사위 없이 검은 구매와 턴당1회 제한 공유. 독립 inn 타입/옵션, A–E 각1개·최대5·이월·중복공급방지·top1개 구매. 포도밭은 그림 장식.
- 조커: 원래37칸/6색/숫자/지역/연결 불변, 모든색 배치·같은지역1개·고유타일 효과 없음. 실제 지역 완성 시 점수크기+1, 방패17 합산 최대크기10=55를 명시. 단계/색상/요새 점수 독립. source는 project-user-rule. 보관함 교체는 기존 확인 경로 유지.
- 모드: 로컬2–4인 새게임 옵션, AI가 합법 구매/배치/점수평가, 온라인2인 생성 옵션/서버 계산/공개 스택/좌석·리비전검증/양쪽 동기화/재접속. 랜덤영지 시작 시 옵션 보존. 과거 저장은 여관 추가 없이 그대로, 잘못된 공급·중복지역·예약풀 혼입은 거부.
- 이미지: public/tiles/originals/inn-user-original.png 원본 SHA256 동일 보존, public/tiles/inn.png 투명 파생(RGBA1312×1199, 4모서리alpha0). alpha>128 bbox(95,2)-(1208,1199)를 InnArt가 실제 육각형 마스크로 정규화, 금색 원래 rim 사용·추가 프레임 없음·실패 SVG fallback. 상세 해시/처리/규칙은 rules/inns.md.
- 화면: 기존 검은 마름모/상품/공급 좌표 유지. INN_STACK 중심(215,398)/폭40/층(-1.4,+1.8), 실제 PNG1–5개·투명 그림자·cost/count 배지. union hit path로 노출된 아래층도 같은 구매 대상. PNG 공용/보관/영지/온라인 공통, 다른 타일 원본/프레임 불변.
- 검사: 전체코어335/335(기존311+신규24)·보드33/33 통과. AI2/3/4인25라운드+흰성/수도원29/기중기/방패/요새·저장, 온라인서버 위조/재전송거부/재접속 포함. PC신규9/9(로컬2/3/4인 준비UI 포함, 관련 분리 실행)·기존19/19(직접UI25라운드·공용·방패온라인3·흰성2) 통과. 최종 로그 관련2/2 재통과. TypeScript·전체ESLint·프로덕션 빌드 통과, 마지막 배지/온라인viewBox·로그까지 관련 재검사/타입/린트/빌드 재통과.
- 화면 산출: .local-data/qa/inn-stack-{1..5}-{100,160,200}.png와 detail-* / acquired-*, inn-storage.png, inn-estate.png, inn-completed-estate.png(실제 구역 크기2→3:6점+단계10=16점), inn-four-seats.png, inn-online-purchased.png. 1–5 상세·200%·4인 전체·구역완성 직접 확인. 타일/상품과 스택/배지 다각형 비겹침·실제 중심 클릭 검사. 확대 화면의 가로이동은 기존 방식 유지.
- 수정/실패: 합성 구역 테스트의 regionId 중복을 고쳤고 기존 assert는 완화하지 않음. 새 보관 테스트의 aria이름을 실제 UI로 수정. 4인 공급에서는 처음 오른쪽 배지가 검은 타일과 겹쳐 정밀 검사 실패→왼쪽 빈공간으로 이동하고 온라인viewBox도 확대. lint prefer-const1건 수정. 수정 후 여관PC8/8·추가 로컬준비1/1 및 온라인1/1·최종 타입/린트/빌드 통과.
- 파일: src/game/{types,inns,practice,save,computer}.ts, core/{state,engine,placement,phases,effects,shield-effects}.ts; src/server/{rooms,room-http}.ts; src/app/{inn-art,inn-stack,common-board,game-screen,tile-art,tile-frame}.tsx, online/room-screen.tsx, game-screen.css; tests/core/{inns,inn-online}.test.ts 및 run.mjs; 기존 effects/phases/placement/white-castles fixture는 BaseTile 타입만 좁힘(assert 유지); tests/browser/{inns,inn-online}.spec.ts; 위 PNG2개와 docs/{TODO,PROGRESS,rules/inns,history/progress-parchment-complete-2026-10-19}.md.
- 다음: diff/비밀검사→이번 변경만 private main Commit/Push/원격 전체해시 확인. 모바일 정밀QA는 사용자 요청대로 최종 단계로 보류. 여관 관련 남은 규칙 기능은 없음.
