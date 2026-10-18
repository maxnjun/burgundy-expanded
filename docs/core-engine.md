# Phase 2 부분 핵심 엔진

2026-10-18 최신: 네 가지 기본 행동, 모든 타일/수도원1~26 효과, 즉시 선택 연쇄, 단계/종료가 구현되어 있다. 공식 공급/정식 createGame 어댑터는 자료 미확보로 미완성이다. 최신 계약·검사는 development-progress.md13절, 핵심 추가 모듈은 intents/effects/modifiers/monasteries/market-recipes를 따른다. 아래 초기 기록은 역사적 상태다.

2026-10-17. 공개 경로: src/game/core/index.ts. UI와 React/Next/DOM/localStorage 의존성 없이 동작한다. 전체 GameEngine 인터페이스의 완성 구현이 아니다.

최신 갱신(이후 업데이트): 단계 진행·최종 정산·선박 선택·저장과 테이블 UI는 development-progress.md 12절을 따른다. 아래 초기 부분 엔진 기록은 당시 상태다. 공식 영지는 SE2 1개이며 공급은 연습 구성이다.

이전 갱신: 단순 배치·가축/은행/숙소/감시탑 효과·구역/색상 점수를 placement.ts에 추가하고 게임 화면을 연결했다. 아래 초기의 'place-tile 미구현', '앱 미연결' 설명은 당시 기록이며 최신 지원/미지원 표는 development-progress.md 10절을 따른다. 공식 영지는 여전히 미등록이며 UI는 비공식 연습 모드다.

## API와 데이터 주입

| API | 계약 |
| --- | --- |
| validateCoreState(state) | 타입이 있는 주입 상태의 자원·참조·고유 위치·순서/주사위 불변식 검사. 외부 JSON 파서나 공식 보드 인증기가 아님 |
| validateCoreAction(state, action) | 지원 행동의 합법성 검사. 미구현 처리와 불법 행동을 오류 코드로 구분 |
| applyCoreAction(state, action) | 검증 후 새 상태·revision·이벤트 반환. 실패와 오버플로 때 입력 불변 |
| advanceCoreTurn(state) | 현재 플레이어의 end-turn과 같은 경계만 처리. 라운드 굴림·단계 수입을 건너뛰지 않음 |
| listCoreActionOptions(state, playerId) | 실행 가능한 지원 행동의 대표 목록과 unsupported 기능 목록. 전체 getLegalActions 대체물이 아님 |
| orderedPlayers(state) | 큰 position부터, 같은 위치는 players 배열의 위→아래 순서 |
| drawDie(random) | 버전 고정 counter-v1의 다음 주사위 값과 새 seed/cursor. 입력 불변 |
| adjustedDie(value, steps) | 검증된 기본 눈과 ±1 단계의 순환 계산. 실제 비용/소유권 검증은 validateCoreAction |

주입 상태는 기존 GameState를 사용한다. 영지·타일·공급처·순서·주사위·자원·원장은 호출자가 준비한다. `phaseGoods`는 아직 공급 보충에 사용하지 않는다. `market.roundGoods`는 아래쪽부터 사용할 순서로 배열을 주입한다. round-setup에서 남은 개수는 6-round, player-turn에서는 5-round다. 라운드 처음 굴리기 전에는 activePlayerId=null, actedPlayerIds=[], rolledForRound=false, roundGoodsDistributed=false여야 한다.

공식 칸 배치가 없어도 코어를 테스트할 수 있다. 테스트는 tests/core/fixture.ts의 **TEST FIXTURE ONLY** 상태를 직접 주입한다. 앱에서는 import하지 않고 VERIFIED_BOARD_DEFINITIONS에도 등록하지 않는다. 공식 규칙에 따른 새 게임 생성은 별도 createGame과 검증 카탈로그가 필요하다.

## 명령과 근거

- roll-round: 라운드 준비 단계에서 트랙 선두 플레이어가 명령을 요청한다. 이는 로컬 상태 전이의 호출권이며, 모든 플레이어의 주사위를 한꺼번에 굴린다. 좌석 순서대로 개인 주사위, 마지막에 흰 주사위를 생성하고 상품 하나를 흰 눈 공급처에 옮긴다(p.6).
- use-die: 기존 GameAction의 adjustment와 intent를 재사용한다. 기본 보정에서 workersSpent는 steps.length와 같고 보유 일꾼 이하여야 한다. 흰 주사위·다른 플레이어 주사위·사용한 주사위는 선택할 수 없다(p.6~7).
- take-workers: 기본 일꾼 2개. 수도원 13은 은화 1개, 14는 일꾼을 4개로 바꾼다(p.10~11).
- sell-goods: 보정된 눈과 같은 종류를 전량 판매한다. 상품당 인원수 점수와 묶음당 은화 1개. 수도원 3은 은화 2개, 4는 일꾼 1개를 추가한다(p.10~11).
- take-tile: 보정된 눈의 번호 공급처에서 보관으로 이동한다. 보관 칸이 가득 찬 경우 해당 칸을 명시적으로 비우는 discardTileId가 필요하다. 코드가 임의 타일을 선택해 버리지 않는다(p.7,9).
- buy-black-tile: 은화 2개·차례당 1회. 개인 주사위를 사용하지 않는다(p.10).
- end-turn: 사용한 두 주사위, 미해결 선택·효과 없음이 전제다. 트랙상 아직 행동하지 않은 다음 플레이어를 선택하고 전원 완료 시 다음 라운드 준비로 간다(p.6). 선박의 실제 이동은 이 모듈에 없으며 변경된 트랙을 주입한 시나리오로 순서 처리를 검증한다.

코어의 이벤트는 규칙 출처 페이지와 자원/점수 변화 등을 반환한다. 호출자가 누적·표시·저장해야 한다. GameState에 아직 일반 행동 기록 필드를 추가하지 않았으며 점수만 scoreLedger에 누적한다.

## 의도적인 경계

place-tile, resolve-choice, use-monastery-six는 unresolved-rule을 반환한다. 단계 종료 수입·보충·최종 정산도 아직 제공하지 않는다. 5라운드 마지막 차례 이후 phase-end 상태를 반환하고 같은 A/B/C/D/E 값을 유지한다. 그 상태에서 advanceCoreTurn을 호출해도 진행하지 않는다. E에서도 finished나 승자를 가짜로 생성하지 않는다.

수도원 8의 ±2 비용 표현과 9~12의 선택적 보정, 추가 행동과의 조합은 보류한다. action.adjustment.monasteryNumber가 있으면 오류이며, 수도원 8 보유자가 일꾼 보정을 요청해도 오류다. 이미 배치된 9~12를 갖고 무료 보정을 요청하지 않는 기본 행동은 허용한다. 확장 상태나 자동 상대가 포함되면 코어는 unsupported-extension을 반환한다.

counter-v1은 seed 문자열과 cursor를 FNV-1a/32bit avalanche로 혼합하는 재현 가능한 비암호학적 시뮬레이션 난수다. 32bit 상위 네 값을 거절해 6으로 나눌 때의 나머지 편향을 피한다. 공식 규칙에서 지정한 알고리즘이라고 주장하지 않는다. 네트워크 공정성·치트 방지 용도로 사용할 수 없다. 이후 저장 버전을 설계할 때 알고리즘 ID를 함께 고정해야 하며 변경 시 기존 seed/cursor 재생 호환성을 고려한다.

## 실행 검사

```text
npm run test:core
npm run test:boards
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
```

테스트 러너는 Node 내장 테스트를 사용하며 자신의 새 임시 컴파일 폴더만 경로 검증 후 정리한다. 프로젝트 파일·기존 빌드 폴더·중첩 폴더를 삭제하지 않는다. 의존성 추가나 외부 업로드는 없다. 최신 실제 검사 결과는 development-progress.md 9절을 따른다.
