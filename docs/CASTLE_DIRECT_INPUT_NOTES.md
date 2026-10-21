# 성 추가 행동·선박·상품 직접 선택 — 구현/검증 (2026-10-21)

## 동작

- 성 추가 행동은 기존 `resolve-choice`와 `immediateOptions`를 재사용한다. 실제 주사위를 먼저 쓰는 경우에만 성 효과를 선택지 없는 `turn.castleActions`에 보관한다. 일반 행동과 필수 자식 효과가 끝나면 현재 보드로 성 선택지를 다시 계산한다. 주사위/성 중 선택한 자원만 소모한다.
- 이미 시작한 선박/건물/포도밭 자식 선택은 중간에 전환할 수 없다. 성 안에서 새 성을 배치한 연쇄와 기존 흰 성/수도원/방패/포도밭/무역로/여관 처리는 기존 효과 해석기를 사용한다. 무역로는 기존 프로젝트 규칙대로 일반 주사위 판매만 진행한다.
- 공급 타일 한 번 클릭은 즉시 획득한다. 저장고가 가득 찼을 때는 교체 슬롯을 선택하고 기존 폐기 확인만 유지한다. 포도 타일의 두 칸 점유도 기존 `keyOccupant`로 판정한다.
- 개인 저장고 타일→영지 칸의 두 번 클릭으로 배치한다. 개인 상품 종류 한 번 클릭은 그 종류 전체를 즉시 판매한다. 노동자 버튼은 기존 수도원/방패 보너스를 포함한 획득을 즉시 실행한다.
- 선박은 공용 보드의 기존 상품 네모칸을 클릭한다. 합법적인 묶음이 하나면 즉시 획득하고, 여러 묶음이면 같은 네모칸 안의 상품 종류 그림으로 선택한다. 선택 중간에는 게임 상태를 변경하지 않으며, 완성된 canonical option만 전송한다. 확정 전 선택한 종류는 다시 눌러 변경할 수 있다.
- 최대 상품 3종류, 보유 종류의 전량 획득, 선택한 새 종류의 전량 획득, 수도원5 인접 공급처 추가 선택과 순서 트랙 한 번 전진은 수정하지 않은 `core/ship.ts`를 따른다.
- 중앙 안내는 두 자원 모두 남음/성만 남음/주사위만 남음/현재 배치/선박 네모칸/상품 종류 선택을 구분한다. 필수 선택과 성 행동이 남으면 턴 종료가 차단된다. 사람의 자동 종료는 계속 금지한다.
- 각 독립 행동 직전 전체 스냅샷을 기록하고 필수 후속 효과는 같은 Undo 단위로 묶는다. 효과 진행 도중에도 원래 행동으로 복원할 수 있다. 일반 행동과 성 행동을 어느 순서로 실행하든 역순으로 각각 복원하며 점수/자원/상품/주사위/RNG/확장 상태를 포함한다.
- 기존 v1 저장 형식 식별자는 유지한다. 성 보관 필드는 선택 항목이므로 구버전 저장은 그대로 읽는다. 자동 저장 Undo sidecar는 시작 기록, 현재 턴, canonical 성 선택 스냅샷을 검증한다. 부분 상품 종류 선택은 미확정 UI이므로 새로고침하면 상품 네모칸 선택부터 다시 시작하며 상품 이동/중복 획득은 없다.
- 온라인은 엔진 합법 액션에서 공개 클릭 대상만 추출한다. 실제 주사위·저장고·영지·상품·일꾼·방패를 직접 선택하며 중복 일반 행동 목록/종료 메뉴는 제거했다. 추상 후속 선택과 준비/특수 기능은 기존 입력을 유지한다. 좌석·revision·직렬 실행 검증은 그대로이며 숨은 공급/난수는 노출하지 않는다. 온라인 Undo는 기존대로 미지원이다.

## 검증 결과

- 최종 전체 코어 **433/433**, 보드 **33/33**, TypeScript/전체 ESLint/프로덕션 빌드 exit0.
- 전체 PC 실행: 118개 중 116개 최초 통과(13.9분). 변경 전 온라인 효과 목록과 다른 플레이어까지 찾던 흰 성 판매 locator의 2건은 실제 보드 입력/현재 영지로 이관하여 모두 재검증했다. 보상·수량·소유권·저장 assert를 삭제하거나 완화하지 않았다.
- 이후 PC 집중18개 중 수도원5 신규 fixture의 초기 상품을 명시하지 않은 1건을 수정했다. 현재 게임 규칙은 바꾸지 않았다. 수정 후 성/주사위 양쪽 순서2/3/4인·직접 판매·교체·선박 연쇄·3종류 제한·수도원5·온라인을 PC/모바일 **30/30** 검증했다.
- 최종 온라인 직접 입력/무역로/여관/수동 종료/방패/방패11·재접속은 PC/모바일 **14/14**. 확대의 CSS viewport/DPR 및 실제 버튼 경계/브라우저 원본 픽셀 캡처 **2/2**. PC 목록의 고유 **124개**는 전체 실행과 관련 재검사로 모두 확인했다(124개를 한 번에 재실행했다는 뜻은 아님).
- 시나리오: 실제 주사위 먼저/성 먼저 소모, 남은 자원 유지, 보관→영지→선박 연쇄, 상품 종류 전량/초과 잔류, 수도원5 인접 제한/트랙1회, 판매 점수/은화/일꾼/주사위/저장 복원, 추가 행동 재전송/다른 좌석/오래된 revision 거부, 첫 플레이어 Undo/자동 종료 금지, 기존 AI25라운드/방패/포도밭 회귀.
- 관련 테스트만 새 입력 흐름으로 이관했다. 기존 테스트 삭제/skip/검증 기준 완화는 없다. 새 의존성, PNG, 영지/포도밭/공용 보드 좌표 변경은 없다.

## 실제 화면 및 로그

- `.local-data/castle-direct/desktop-1280/bonus-{2,3,4}p-{castle,die}-first.png`
- `.local-data/castle-direct/{desktop-1280,mobile-390}/ship-types-{selecting,completed}.png`
- 같은 폴더 `castle-direct-supply.png`, `online-direct-castle.png`, `bonus-toolbar-{100,160,200}.png`.
- 브라우저 원본 캡처를 직접 열어 PC160/200의 중앙 안내와 세 빨간 버튼 전체 표시, 모바일 줄바꿈, 상품 네모칸 내부 선택을 확인했다. CSS body zoom만으로 반응형 배율을 판단하지 않았다.
- 로그: `.local-data/castle-{core-final,boards,browser-full,browser-final,browser-final-modes,browser-online-final,browser-zoom-final,types-final,lint-final,build-final}.log`.

## 범위/제한

- 온라인 Undo 미지원, 확장 전체의 모바일 정밀 QA는 기존 최종 통합 단계로 유지한다. 구버전의 기록 없는 저장 파일에 턴 시작 스냅샷을 임의로 만들지 않는다.
- 사용자의 기존 수도원 원본 PNG2개, asset-inbox와 여관 관련 문서 변경은 보존/백업 대상에서 제외한다. localhost3000은 유지한다.
- 백업 대상은 기존 `maxnjun/burgundy-expanded`의 공개 main이다. 이전 사용자 명시 허용을 유지하고 저장소 공개 설정을 변경하지 않는다.

## 변경 파일

- `src/app/common-board.tsx`
- `src/app/game-screen.css`
- `src/app/game-screen.tsx`
- `src/app/online/room-screen.tsx`
- `src/app/vineyard-board.tsx`
- `src/app/goods-space.tsx`
- `src/game/action-guidance.ts`
- `src/game/castle-actions.ts`
- `src/game/core/effects.ts`
- `src/game/core/engine.ts`
- `src/game/core/state.ts`
- `src/game/direct-actions.ts`
- `src/game/turn-history-cache.ts`
- `src/game/turn-history.ts`
- `src/game/types.ts`
- `src/server/rooms.ts`
- `tests/browser/bonus-direct.spec.ts`
- `tests/browser/bonus-online.spec.ts`
- `tests/browser/custom-trade-online.spec.ts`
- `tests/browser/custom-trade.spec.ts`
- `tests/browser/direct-input.spec.ts`
- `tests/browser/manual-turn.spec.ts`
- `tests/browser/rooms.spec.ts`
- `tests/browser/inn-online.spec.ts`
- `tests/browser/shield-castles.spec.ts`
- `tests/browser/shield-rules.spec.ts`
- `tests/browser/u15-sale.spec.ts`
- `tests/browser/white-castles.spec.ts`
- `tests/core/action-guidance.test.ts`
- `tests/core/castle-order.test.ts`
- `tests/core/run.mjs`
- `tests/core/turn-history.test.ts`
- `tests/fixtures/direct-choice.ts`
- `docs/CASTLE_DIRECT_INPUT_NOTES.md`
- `docs/PROGRESS.md` 및 `docs/TODO.md`의 이번 접두 기록만 별도 스테이징한다.

## 백업 확인

- 기능 커밋 `76f2830b11b003d3cc819bb349c83b8fe514cc4a`를 기존 공개 main에 일반 Push하고 원격 SHA 일치를 확인했다. 36개 경로만 포함했으며 원본 PNG/asset-inbox/기존 여관 문서 변경은 제외했다.
