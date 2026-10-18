# Burgundy Expanded v0.2.1 아키텍처

## 1. 작업 범위와 실제 루트

이 문서는 v0.2.1 설계 단계의 기록이다. 이후 Phase 2에서 추가한 보드 독립 부분 엔진은 [core-engine.md](core-engine.md), 최신 구현·검사 결과는 [development-progress.md](development-progress.md) 9절을 따른다. 아래의 '실제 함수 없음'은 당시 전체 GameEngine에 대한 설명이며 별도 core API를 포함하지 않는다.

아래 상대 경로는 `package.json`이 있는 Next.js 프로젝트 루트를 기준으로 한다.

```text
./
```

확인 근거: 루트의 `package.json`에 next dev/build/start 스크립트와 Next.js 16.4.2·React 19.3.0이 있고, `src/app/page.tsx`, `layout.tsx`, `globals.css`, `tsconfig.json`, `next.config.ts`가 존재한다. `turbopack.root`는 `process.cwd()`다. 명령은 위 루트에서 실행해야 한다.

중첩 `burgundy-expanded/`에는 `.next/build`와 빌드 청크, `{"type":"commonjs"}` 내용의 생성용 package.json만 있다. 독립 앱의 package.json·src·Next 설정은 발견되지 않았다. 별도 프로젝트로 취급하지 않는다. 과거 빌드 산출물로 보이나 정확한 생성 경위는 확인할 수 없다. 삭제·이동·수정하지 않는다. 기존 ESLint 설정은 모든 깊이의 `.next`를 제외한다.

현재 package.json의 버전은 0.1.0으로 유지한다. v0.2.1은 이번 설계 산출물의 목표 버전이며 실행 엔진의 완성을 의미하지 않는다.

## 2. 파일 구성

```text
src/app/                     기존 v0.1 UI — 수정·연결하지 않음
src/game/
  types.ts                   게임 도메인·상태·행동·점수 타입
  interfaces.ts              7개 엔진 함수 계약, 결과·오류·카탈로그 계약
  extensions.ts              독립 확장 모듈·호환성·훅 계약
  index.ts                   type-only 공개 진입점

docs/rules/sources.md         출처, PDF 해시, 페이지별 검증 범위
docs/rules/base-game.md       공식 기본판 요약
docs/rules/unresolved.md      미확정 규칙·데이터·제품 정책
docs/ui-layout-spec.md       기존 후속 UI 요구사항 — 변경하지 않음
docs/architecture.md         이 문서
```

React·Next·DOM·localStorage를 엔진에 의존시키지 않는다. UI의 현재 데모 종류명(예: knowledge)과 엔진의 공식 타일 종류(예: monastery)를 즉시 치환하지 않는다. 미래 UI 어댑터에서 명시적으로 대응한다.

## 3. 상태 모델과 불변 조건

- `GameState`: 설정, 플레이어, 타일 인스턴스 사전, 시장, 주사위, 단계/차례, 득점 원장, 난수 진행 상태, 확장별 직렬화 상태를 보유한다.
- `GameConfig`: 좌석·보드 선택·시작 성·seed·카탈로그와 확장 선택을 정의한다. 기본 competitive 모드의 인원 2~4, playerCount/players 일치, 중복 없는 식별자는 미래 설정 검증기의 조건이다.
- `DuchyBoard`/`HexCell`: 정수 axial `(q,r)`, 고유 셀 ID, 색·눈·구역 ID와 점유 타일 ID를 사용한다. 픽셀 좌표와 확대율을 넣지 않는다. 인접 차이는 `(1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)`의 표준 axial 설계를 채택하되 실제 맵은 검증된 자료로만 만든다.
- `Tile`: 앞면 종류를 판별자로 사용하고 건물 종류·가축 종류/수·수도원 번호를 구분한다. 검은 뒷면을 별도 앞면 종류로 취급하지 않는다. 기본판 수도원은 1~26이다.
- `MarketState`: 번호 공급처의 타일 슬롯과 상품, 검은 공급처, 공급 풀, 제거 타일, 단계/라운드 상품, 색상 보너스를 분리한다.
- `PlayerState`: 영지, 개인 타일 보관, 상품 묶음, 판매 상품, 은화, 일꾼, 승점, 획득 보너스를 보유한다. 상품은 타일 수와 종류 수를 구분한다.
- `DiceState`: 개인 주사위 두 개의 ID·눈·사용 여부와 흰 주사위 및 라운드 상품 배분 여부를 분리한다.
- `TurnState`: 단계 A~E, 라운드 1~5, 진행 상태, 현재 플레이어, 위→아래 순서 스택, 이번 라운드 행동 완료자, 구매/수도원6 사용 여부, 미해결 효과·선택을 보유한다. 좌석 순서와 행동 순서를 혼동하지 않는다.
- `ScoreBreakdown`: 진행 중 이미 얻은 점수와 종료 추가점을 나눠 중복 정산을 막는다. 항목별 출처·타일·구역 식별자를 기록할 수 있게 한다.

타입은 런타임 유효성을 보장하지 않는다. 각 타일은 공급·시장·개인 보관·영지·제거 영역 중 정확히 한 곳에 있어야 하며, 모든 참조 ID는 사전에 존재해야 한다. 자원은 음수가 될 수 없고 보드 구역/슬롯 수도 검증해야 한다. 이 검증 로직은 이번에 구현하지 않는다.

## 4. 엔진 함수 계약

`GameEngine` 인터페이스의 함수들은 다음 계약을 가진다. 대문자 함수 타입을 공개하고, 인터페이스 멤버는 요청한 소문자 이름으로 제공한다. 실제 함수 값, stub, 가짜 성공 결과는 없다. `import type`으로만 사용하며 `createGame()`을 현재 호출할 수 없다.

| 멤버 / 함수 타입 | 입력 | 결과 및 책임 |
| --- | --- | --- |
| createGame / CreateGame | 설정, 엔진 문맥 | 검증된 카탈로그로 초기 GameState 생성. 데이터 미비 시 오류 |
| getLegalActions / GetLegalActions | 상태, 플레이어, 문맥 | 현재 가능한 행동/선택 목록. 미확정 상태를 빈 목록으로 숨기지 않음 |
| validateAction / ValidateAction | 상태, 행동, 문맥 | 합법 여부와 근거 있는 오류. 상태 변경 없음 |
| applyAction / ApplyAction | 상태, 행동, 문맥 | 검증 후 새 상태와 이벤트. 실패 시 입력 상태 불변 |
| calculateScore / CalculateScore | 상태, 플레이어, current/final, 문맥 | 점수 내역 조회. 상태나 원장에 재가산하지 않음 |
| advanceTurn / AdvanceTurn | 상태, 문맥 | 선택/효과 해소 후 차례·라운드·단계 경계 전이 |
| checkGameEnd / CheckGameEnd | 상태, 문맥 | 종료 여부, 종료 시 점수와 승자 목록. 미확정 동률은 임의 판정하지 않음 |

`EngineContext`는 검증된 `RuleCatalog`와 확장 모듈을 전달한다. 카탈로그에는 정확한 영지/시장 레시피와 타일 전수 자료가 필요하다. `EngineResult`는 설정 오류, 불법 행동, 미확정 규칙, 미완성 카탈로그, 미지원 확장을 구별한다. 현재 값이나 기본 카탈로그는 생성하지 않는다.

행동은 주사위 기본 행동, 검은 공급처 구매, 수도원6 특수 행동, 대기 선택 해소, 차례 종료, 확장 명령으로 구분한다. `end-turn`은 UI 요청일 뿐 남은 필수 행동/선택을 건너뛸 권한이 아니다. 배치 유효성·소유권·비용·선행 조건은 미래 검증기가 판단한다.

성·시청 등의 추가 행동은 남은 개인 주사위를 증가시키는 가짜 굴림 대신 `pendingEffects`/`pendingChoice`로 표현할 수 있도록 한다. 구체적인 효과 해소 순서는 원문 대조가 끝날 때까지 보류한다.

미래 구현 원칙: applyAction은 사용자 행동과 즉시 처리 가능한 강제 효과를 원자적으로 처리하고, 선택이 필요하면 대기 상태를 반환한다. advanceTurn은 해소되지 않은 선택을 넘기지 않는다. 난수는 상태의 seed/cursor 기반으로 재현 가능해야 하며 UI나 Math.random에 의존하지 않는다. 알고리즘 자체는 아직 선택하지 않았다.

## 5. 확장 모듈 경계

모듈 ID별 독립 상태를 JSON 값으로 격리하고, `ExtensionModule`은 설정 검증·초기화·합법 행동·행동 검증·라이프사이클 해소·추가 점수 인터페이스를 제공한다. 반환된 상태 전이 제안은 미래 코디네이터가 검증·통합한다. 확장이 공유 상태를 직접 변이하지 않는다.

| 모듈 | 독립 책임 | 근거 |
| --- | --- | --- |
| Shields (`shields`) | 방패 획득·유지·플레이어 능력·점수 | PDF p.17–18 |
| Trade Routes (`trade-routes`) | 상품 판매와 경로 진행·보너스 연결 | p.14 |
| Vineyards (`vineyards`) | 추가 보드·이중 육각 타일·보관/획득/배치·득점 | p.19–21 |
| Team Game (`team-game`) | 팀 소유권·공유 보드/자원·팀 점수 어댑터 | p.15 |
| Solo Game (`solo-game`) | 전용 준비·진행·목표와 종료 조건 어댑터 | p.15–16 |
| Châteauma (`chateauma`) | 자동 상대·전용 카드/보드·행동 선택·난이도·점수 | p.22–28 |

훅 후보는 setup, before/after-action, phase-start, round-start, turn-end, phase-end, final-scoring이다. 이 목록은 확정된 규칙 처리 순서를 뜻하지 않는다.

독립 등록 가능성과 임의 조합 허용은 다르다. requires/incompatibleWith/verifiedCombinations 및 validateConfig로 검증 전 조합을 거부해야 한다. 특히 팀 공유 보드, 솔로 전용 보드, 자동 상대의 상태는 기본 개인 영지로 억지 변환하지 않고 모듈 상태와 후속 어댑터로 표현한다. 현재 기본 `Tile`에 이중 육각 타일이나 방패를 섞지 않는다. 확장 전용 자료는 모듈 상태가 소유한다. 이 계약은 통합 설계의 출발점이며 실제 확장 로직·카탈로그·실행 등록은 없다.

## 6. UI 보존과 검증

기존 UI에서 src/game을 import하지 않는다. v0.1 데모의 자유 배치·점수·주사위·확장 토글·디자인은 이번 타입 설계와 연결하지 않는다. 보기 설정은 docs/ui-layout-spec.md대로 후속 단계에서 별도 구현한다.

이번 단계 검증 명령(루트에서):

```text
node node_modules/typescript/bin/tsc --noEmit
npm run lint
npm run build
```

기존 src/app/page.tsx, layout.tsx, globals.css의 변경 전후 SHA-256을 비교하여 소스 보존을 확인한다. 프로덕션 HTTP 응답은 페이지 렌더링 확인이며, 브라우저 조작 회귀 테스트와 동일하지 않다. 타입 계약만 추가하므로 규칙 행동 단위 테스트나 실제 플레이 가능성을 주장하지 않는다.

## 7. 의도적으로 보류한 작업

실제 게임 함수 구현, 공식 보드 카탈로그, 확장 규칙 구현, v0.1 UI 연결, 레이아웃 구현, 패키지 버전 변경, 폴더 정리·삭제, 네트워크 멀티플레이, 영구 게임 저장은 이번 범위 밖이다. 이 단계 결과를 보고한 뒤 다음 구현 단계로 자동 진행하지 않는다.

## 8. 이번 단계 검증 결과 (2026-10-17)

- TypeScript `tsc --noEmit`: 종료 코드 0.
- `npm run lint`: 종료 코드 0, 오류·경고 없음.
- `npm run build`: 종료 코드 0, 프로덕션 컴파일·타입 검사·정적 페이지 생성 성공.
- 프로덕션 서버 `localhost:3101`: 메인 페이지 HTTP 200. 브랜드, SVG 보드, 선택 타일 상세 마크업 존재 확인. 검증 후 임시 서버 종료.
- UI 소스 3개의 변경 전후 SHA-256 동일:
  - page.tsx: `35E4BEE6A4AB6B777943D05935683BD5EAA515778C51637A40A5E60B6E1A6917`
  - layout.tsx: `B69F681F308D829ABFE5ECE7A15B06AEF1A4C68485D3957A89853C6D25A56216`
  - globals.css: `95F5FD679A24BF1630F569C39F3F2B818AFD0A27F1D2A3F0D5EF4DD24D9B6E4B`
- 브라우저에서 클릭·드래그를 직접 수행하는 회귀 검증은 하지 않았다. 기존 기능 보존 근거는 소스 불변·빌드·HTTP 렌더링 확인이다.

