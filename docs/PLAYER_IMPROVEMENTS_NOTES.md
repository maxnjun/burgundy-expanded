# 수정사항 프롬프트 통합 구현

2026-10-22. 루트 `수정사항 프롬프트.txt` 전체를 읽고 마지막 지시를 우선했다. 앞부분의 명시적인 엔진 변경과 뒷부분의 UI 전용 지시를 구분했다. 원본 PNG, ZIP, 기존 미커밋 자료는 수정하거나 백업에 포함하지 않는다.

## 기능과 데이터 연결

- 포도밭: 은행(+은화2), 하숙집(+일꾼4), 망루(+4점)는 배치 후 바로 처리하고 기존 `used`에 기록한다. 선택형 보상과 중첩 효과는 원래 엔진에 남긴다. 방패의 일꾼 효과와 점수 원장도 기존 경로를 사용한다. 구 저장의 보상 순서 선택은 검증된 `resolve-choice` 자동 요청으로 재개한다. 온라인은 해당 좌석에 공개된 합법 액션만 내려주고 기존 인증/revision/요청 잠금으로 중복을 막는다.
- 방패: 교체로 획득한 방패가 비워 준 공급 슬롯에 이전 방패를 반환한다. 공급이 가득 차 있어도 정확히 한 슬롯이 생기므로 유실/추가 슬롯/임의 반환 순서가 없다. 장착 효과와 공유 수도원 대상은 교체에 맞춰 갱신한다. 방패 교체만 즉시 실행하며 일반 저장 타일의 영구 폐기 확인은 유지한다. 과거 저장에서 이미 제거된 방패는 임의 복원하지 않는다.
- 여관 설명: 실제 개인 영지의 `cell.terrain`을 공통 팝업에 전달한다. 미배치 여관은 기본 설명, 배치된 여관은 현재 적용 종류를 덧붙인다. PC hover/모바일 조작 우선 단일 터치 규칙은 유지한다.
- 정산: 공통 `FinalScores`가 엔진 `finalScores`의 누적 원장과 종료 항목을 표시한다. 누적 소계/종료 소계/최종 합계를 구분한다. 과거 원장이 없을 때는 차이를 미분류로 표시하며 승점을 재계산하지 않는다.
- 상품: 공통 `GoodsInventory`의 3슬롯은 현재 `player.goods`의 실물 전량을 동일한 상품 그림으로 겹쳐 그린다. 보유량 숫자/배지는 없다. 그림 안의 상품 종류 번호는 유지한다. 판매 콜백과 3종류 제한은 원래 엔진을 따른다. `SoldGoods`는 기존 `soldGoods`로 6종 판매 내역과 총량/종류 수를 표시한다. 원래 무역로의 상품 뒷면 SVG를 재사용한다.
- 시작 성: 설정에서 위치를 미리 지정하지 않고 실제 영지의 유효한 칸을 클릭한다. 초기 성 실물을 기존 저장고에 대기시키는 `setup` 단계이며 별도 저장 필드는 없다. 모두 배치하기 전 일반 행동은 차단하고 초기 성 효과/승점/RNG는 발생하지 않는다. AI는 추천 시작 칸을 선택한다. 온라인은 각 좌석이 자신의 성을 선택하며 상대보다 먼저 선택해도 된다. API/기존 fixture 기본값은 이전 흐름을 보존하고 실제 UI의 새 게임/방 생성은 직접 선택을 활성화한다. 구 저장의 성 위치는 유지한다.
- 설정: 품종 축소와 방패 검증 모드는 접힌 개발자 설정에 보존한다.
- 개인 저장: 공통 `PlayerTileStorage`에서 포도 실물을 오른쪽과 같은 `VineTile`로 표시한다. 실제 2키 점유와 방패4 확장 용량을 유지한다. 방향 버튼은 `돌려서 배치`로만 이름을 바꿨다.
- 여관 스택: 공용 보드 일반 타일과 같은 60 좌표 폭을 전달한다. 온라인은 일반 타일과 같은 46px로 환산한다. 모든 장은 같은 크기이고 오프셋만 다르다. 공용 보드 viewBox 950×1030과 공급/개인 영지 좌표는 그대로다.
- 모바일 온라인의 긴 sticky 조작 패널과 로컬 200% 확대의 sticky 행동 표시줄이 실제 클릭을 가리는 문제가 재현되어 좁은 화면에서 일반 문서 흐름으로 바꿨다. PC의 고정 표시줄은 유지한다.

## 검증과 캡처

- 기능별 코어와 PC/모바일 검사를 단계마다 실행했다. 테스트의 상태/자원/점수/권한/실제 클릭 검증을 유지하고 변경된 설정 경로와 상품 접근성 이름만 이관했다.
- 전체 코어 451/451, 보드 33/33 통과. 최종 TypeScript/전체 ESLint 경고0/프로덕션 빌드 exit0. 전체 PC 143건은 135통과·3터치전용 제외·5실패였고 수정 후 해당5건을 모두 재검증하여 실행대상140건의 최종 통과를 확인했다. 온라인 재검사6/6, 저장고·설명·온라인 관련8통과/입력방식2제외. 최초 PC 실행은 공유 도우미의 이전 상품 접근성 이름으로 대기하여 중단하고 해당 선택자를 수정했다. 모바일 확대의 실제 가림/3번째 상품 잘림은 고정 바와 상품/자원 줄바꿈 CSS를 수정한 뒤 3배율 검사2건·25라운드 포함4건이 통과했다. 온라인 시작 연속 클릭 2건의 trace에서 409를 확인했다. 상대 선택 후 최신 revision이 화면에 반영되기를 기다리는 테스트 보조를 추가했고, 기존 409/권한/결과 검증은 유지한다. 추가로 시작 단계 전 roll을 시도하던 방패 온라인 fixture는 실제 두 좌석 시작 선택을 거친다. 저장고 공통화에서 빠진 기존 illustrated-tile 래퍼를 복원하고 60px로 확대해 CSS polygon 잘림과 키보드 설명 회귀를 함께 수정했다. 실패 검증을 삭제하거나 강제 클릭으로 우회하지 않는다.
- 타일 에셋 검증: 일러스트6/자원 아이콘2, 경고0. 이 작업에서 이미지 픽셀을 변경하지 않았다.
- 새 관련 테스트: `tests/core/player-improvements.test.ts`, `tests/browser/player-improvements.spec.ts`, `fixed-vine-reward.spec.ts`, `player-inventory-zoom.spec.ts`. 준비 흐름 보조는 `tests/browser/starting-castles.ts`.
- 실제 캡처: `.local-data/player-improvements/`의 PC/모바일 `goods-history`, `inventory-100/160/200`, `vine-storage`, `inn-context`, `settlement`, `starting-2p/3p/4p`, `online-starting` PNG.
- 여관 크기/겹침 캡처: `.local-data/qa/inn-stack-{1..5}-{100,160,200}.png`, `inn-stack-detail-*`, `inn-four-seats.png`. 검사 중 생성된 캡처/로그/trace는 Git에 추가하지 않는다.

## 유지 범위와 제한

로컬 2–4인, AI, 온라인 2인의 기존 점수/추첨/수도원/포도 4층·시작1+층보상4 토큰/여관/무역로/Undo를 유지한다. 온라인 Undo는 원래 미지원 정책을 유지한다. 모바일 검사는 Chromium 터치 에뮬레이션이며 실제 기기 정밀 QA는 별도다. 구 저장의 미기록 점수 출처를 복원하거나 과거 방패 제거를 취소하지 않는다.

기존 원격은 `maxnjun/burgundy-expanded`의 공개 `main`이다. 앞선 사용자의 명시적 공개 main Push 허용에 따라 이 원격을 사용하고 공개 설정을 바꾸지 않는다. 이번 변경만 선별 백업하며 원본 미커밋 PNG27/28, asset-inbox, 사용자 ZIP/txt 및 기존 문서 꼬리는 제외한다.

## 변경 파일

- `src/app/common-board.tsx`
- `src/app/game-screen.css`
- `src/app/game-screen.tsx`
- `src/app/inn-stack.tsx`
- `src/app/online/room-screen.tsx`
- `src/app/tile-art.tsx`
- `src/app/tile-effect-tooltip.tsx`
- `src/app/tile-help-content.tsx`
- `src/app/trade-route-panel.tsx`
- `src/app/vineyard-board.tsx`
- `src/game/action-guidance.ts`
- `src/game/computer.ts`
- `src/game/core/engine.ts`
- `src/game/core/shield-effects.ts`
- `src/game/core/state.ts`
- `src/game/core/vineyard-effects.ts`
- `src/game/direct-actions.ts`
- `src/game/practice.ts`
- `src/game/save.ts`
- `src/game/shields.ts`
- `src/game/tile-help.ts`
- `src/game/types.ts`
- `src/server/room-http.ts`
- `src/server/rooms.ts`
- `tests/browser/bonus-direct.spec.ts`
- `tests/browser/custom-trade-online.spec.ts`
- `tests/browser/custom-trade.spec.ts`
- `tests/browser/fortress-online.spec.ts`
- `tests/browser/game.spec.ts`
- `tests/browser/inn-online.spec.ts`
- `tests/browser/inns.spec.ts`
- `tests/browser/rooms.spec.ts`
- `tests/browser/shield-ai.spec.ts`
- `tests/browser/shield-castles.spec.ts`
- `tests/browser/shield-online.spec.ts`
- `tests/browser/shields.spec.ts`
- `tests/browser/u15-sale.spec.ts`
- `tests/browser/vineyards.spec.ts`
- `tests/browser/white-castles.spec.ts`
- `tests/core/run.mjs`
- `tests/core/shield-castles.test.ts`
- `tests/core/shield-computer.test.ts`
- `tests/core/shields.test.ts`
- `tests/fixtures/direct-choice.ts`
- `src/app/final-scores.tsx`
- `src/app/player-inventory.tsx`
- `src/game/score-summary.ts`
- `src/game/starting-castles.ts`
- `tests/browser/player-improvements.spec.ts`
- `tests/browser/starting-castles.ts`
- `tests/browser/fixed-vine-reward.spec.ts`
- `tests/browser/player-inventory-zoom.spec.ts`
- `tests/core/player-improvements.test.ts`
- 이 문서와 `docs/PROGRESS.md`, `docs/TODO.md`의 이번 작업 접두 기록.
