# Ver.3 8개 수정 (2026-10-27)

기준 main d3d5106. 기존 미커밋 문서 본문·수도원27/28 PNG·asset-inbox/ZIP은 보존한다. 체크포인트 `.local-data/ver3-0peRz2/`. 운영 방/Redis에 접근하거나 Render 배포·재시작·자동배포 설정 변경을 하지 않는다.

|항목|최초 상태/원인|수정/검증 상태|
|---|---|---|
|1 공급된 상품 빈칸|부분:5개 공개는 구현, 렌더러가 공급 후에도 공개 원본을 표시|완료 · 신규 PC·Chrome터치·WebKit 통과|
|2 보상 주사위+실제 주사위 방패|미완료:실제2개 또는 방패11 무료 획득만 지원|완료 · 3종 보상·비용·미사용 주사위·위조 거부·복원 통과, 최종 비용 안내·두 미사용 주사위 선택까지 재검사 통과|
|3 방패16 눈금 UI|부분:로컬 select, 온라인 모든 조합 텍스트 목록|완료 · 공통2단계 UI·회수 제한·새로고침 통과|
|4 영지 배치 비용 그림|부분:로컬 텍스트 비용, 온라인 비용 표시 없음|완료 · 엔진 합법 칸·일꾼 실제 소비·모바일 검사 통과|
|5 방패5 상품|부분:보관3종 제한은 검사하나 공급처 상품 존재를 무시|완료 · 종류별5개 실수령·상대 불변·구형 선택 호환·재접속 통과|
|6 방패6 상대 제한|미완료:서버/로컬/설명 모두 자기 자신 허용|완료 · 본인 요청 거절·상대만 표시·대상 복원 통과|
|7 하프물범 ON/OFF|부분:로컬만 노출, 추가 타일 옵션이 OFF를 덮음, 온라인 없음|완료 · ON·OFF 공급·서버 boolean·생성 UI·저장 복원 통과|
|8 기록 그림/색상 주사위|부분:배치 그림만 뒤에 표시, 획득 그림·주사위 출처/색상 없음|완료 · 획득·배치 앞쪽 그림·실제 색상·보상 출처·Undo 통과|

규칙 근거: 프로젝트 `reference/official-rulebook-public.pdf` 인쇄17–18쪽과 [공개 동일 규칙서](https://www.boardgamesbot.com/assets/games-library/the-castles-of-burgundy-special-edition/manual_eng.pdf). 기본 방패 획득은 같은 눈2개(일꾼 보정 가능), 방패5는 선박 처리 후 전 공급처의 한 종류 전량, 방패11은 성 보상만으로 획득한다. 보상 주사위 결합은 이번 사용자 요청으로 명시 추가하며, 자기 자신 제외도 사용자 확정 프로젝트 제한이다. 공식 본문에 추가 판정이 있다고 주장하지 않는다.

## 실제 변경 파일과 동작

1. `src/app/common-board.tsx`: 공개 원본5개는 유지하고 `roundGoods.length`로 공급 완료 위치를 비운다. 상품의 물리적 이동은 기존 서버 `roll-round`만 담당한다. 동일한 DTO·저장 상태로 두 좌석/새로고침에서도 동일 표시다.
2. `src/game/core/{shield-effects,effects}.ts`, `direct-actions.ts`, `computer-shields.ts`, `src/app/{shield-dice,game-screen}.tsx`, `online/room-screen.tsx`: 가상 보상 눈과 선택한 미사용 실제 주사위를 같은 공급처 눈으로 맞춰 일꾼 비용을 계산한다. 성/포도 자유 보상은 가상 눈을 자유 지정, 흰 보상은 현재 흰 눈에 필요한 보정까지 계산한다. 실제 주사위1개만 사용하고 흰 주사위/다른 주사위/RNG는 보존한다. 기존11 무료 획득 버튼은 결합 모드와 별도로 유지한다. AI도 실제 비용/주사위1개 소비 가치를 반영한다.
3. 공통 `src/app/shield-dice.tsx`, `white-die.tsx`: 변경 대상은 플레이어 색 주사위2개, 다음 줄은 엔진이 허용한 흰 눈금 최대5개다. 사용한 대상은 비활성화하고 회수 제한으로 더 이상 행동이 없으면 UI를 닫는다. 온라인의 긴 숫자 목록을 제거한다.
4. 공통 `src/app/placement-cost.tsx`, 로컬/온라인 보드: 실제 선택된 타일과 주사위의 합법 엔진 액션을 기준으로 비용을 표시한다. 무료는 '무료', 유료는 승인 일꾼 PNG×수량이다. 요구 눈금 아래에 놓고 이전 지형 글자는 겹치지 않도록 해당 합법 칸에서 숨긴다. 부족한 자원 칸/상대 영지에는 표시하지 않는다.
5. `core/shield-effects.ts`, `save.ts`, `src/app/reward-art.tsx`: 실재하는 상품과 보관3종 제한을 동시에 만족하는 종류만 제공한다. 기존 실제 상품ID를 전 공급처에서 옮기며 생성하지 않는다. `GoodsArt`+총수량으로 선택하고 합법 수령이 없으면 건너뛰기를 안내한다.
6. `core/shield-effects.ts`, `src/app/game-screen.tsx`, `tile-help.ts`: 서버/로컬 모두 자기 자신을 새 대상으로 선택할 수 없다. 기존 저장에 이미 확정된 대상은 임의로 바꾸지 않는다.
7. `practice.ts`, `server/{rooms,room-http}.ts`, 로컬/온라인 준비 UI: 신규 기본ON, 명시OFF는 추가 타일 묶음보다 우선한다. 온라인 생성·영지 후보 선택 후 재생성에도 설정을 유지한다. 진행 중인 게임에는 소급하지 않는다.
8. `game/action-log.ts`, `app/action-log.tsx`, `game-screen.css`: 기존 문자열 저장 안의 선택적 메타데이터만 확장한다. 획득/배치 타일 그림을 앞에 두고 실제 소비된 플레이어 눈/색과 흰/자유 보상 눈을 구별한다. 보정된 사용 눈을 표시하고 자유 일꾼 보상처럼 정해진 눈이 없으면 자유 표시를 사용한다. 옛 텍스트/기존 v1 로그는 계속 읽으며 스냅샷 Undo로 기록도 복원한다.

공통: `src/game/save.ts`의 마이그레이션은 **정확한 이전의 정상 메뉴**에만 적용한다. 구형 성/흰/포도 자유 보상 및 방패5 메뉴를 메모리에서 갱신한다. 위조 메뉴는 거부하고 GET으로 원본을 다시 저장하지 않는다. 기존 `0.2.1`/방v1/프로토콜1, 좌석 인증, Redis CAS/요청ID,4층·최대5포도토큰을 유지한다.

## 검사 및 산출물

- 신규 `tests/{core,browser}/ver3.*`, `tests/fixtures/ver3.ts`. 전체 코어 실행 목록과 기존 관련 테스트를 갱신했다. 과거 '공급 후에도5개 표시', '흰 보상 로그에 주사위 없음', 자기 대상 허용, 숫자 select 기대값을 새 동작으로 바꾸고 실제 자원/주사위/상품/권한 검증은 유지했다.
- `.github/workflows/ci.yml`: 기존 PC 전체 유지, 명시된 Chrome/WebKit 목록에 Ver.3를 추가한다. 글꼴·타임아웃·기존 필수 검사는 변경하지 않는다.
- 현재 전체 코어505/505, 보드33/33, 격리 배포/복원7/7, PNG80, 타입/ESLint/빌드 통과. 신규 PC7/7·Chrome터치7/7·WebKit7/7. 전체PC186통과/모바일 전용3제외(실패0). 최종 비용 안내·선택 상태/보정 눈금 보완 후 build-verified/types-after-build/lint-release 통과 및 PC·Chrome 실제터치·WebKit 실제터치 33/33 재검증(verified-ui.log). 신규 파일만의 초기21개 통과와 합산하지 않는다.
- 최초 신규 브라우저 선택자의 잘못된 버튼 이름은 바로잡았다. 최초 코어의 Windows 샌드박스 파일 교체 EPERM은 같은 격리 검사를 승인된 터미널 환경에서 재실행해 통과했다. 기존 게임 저장 코드를 우회하지 않았다.
- 산출물: `.local-data/ver3-0peRz2/{core-final.log,boards.log,deployment.log,assets.log,browser-pc2/,browser-mobile/,full-pc/}`. PC/모바일의 상품5·방패16·배치비용·그림 기록을 직접 열어 확인했다. 스크린샷은 실제 브라우저 렌더링이다.

## 보존·배포 한계

- 운영 Upstash/기존 온라인 방/환경변수는 읽거나 쓰지 않는다. 서버 재시작/HTTP/WSS 검사는 격리 파일과 Upstash REST 계약 모형이며 실제 운영 Redis Lua·외부망/실기기 Android/iPhone 검증은 아니다.
- 새 기능/기존 상태를 함께 검증하나, 예전 서버 바이너리는 확장된 보상 메뉴를 해석하지 못할 수 있다. 수동 배포/롤백 시 진행 중인 보상 선택의 버전 호환을 확인해야 한다.
- Render staging blueprint는 `autoDeployTrigger: off`; 실제 `burgundy-expanded` 서비스 설정을 읽을 인증은 없다. 설정을 바꾸지 않고 공식 [`[skip render]`](https://render.com/docs/deploys#skipping-an-auto-deploy)와 기존 release의 `[no-deploy]` 게이트로 Push의 배포를 제외한다. Render 배포·재시작은 수행하지 않는다.

## 최종 결과

- 1~8 모두 구현 및 로컬/격리 서버 검증 완료. 실패 테스트 삭제/기준 완화 없음. 기존 미커밋 PNG2개 SHA 및 이전 문서 본문 바이트 일치 확인.
- 스크린샷: `.local-data/ver3-0peRz2/screens/`의 `pc-estate-costs.png`, `mobile-estate-costs.png`, `iphone-shield16.png`, `mobile-shield5-goods.png`, `pc-online-undo.png`, `pc-action-log.png`, `pc-phase-goods.png`. 원본 브라우저 캡처를 그대로 복사했으며 그림을 재가공하지 않았다.
- 이번 31개 관련 파일과 혼합 PROGRESS/TODO의 이번 접두사만 main 백업 대상으로 선정한다. Render 배포·재시작 없음. Push 결과/SHA는 Git 기록과 최종 채팅으로 확인한다. 새 GitHub CI는 로컬 검사와 구분한다.
