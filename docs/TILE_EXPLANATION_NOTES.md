# 통합 타일 설명 시스템

## 범위와 입력

사용자 첨부 원문 `tile-explanation-task.md` 전체를 확인했다. 프로젝트 루트에는 없으므로 사용자가 명시한 상위 경로의 원문을 읽었다. 첨부된 텍스트9개는 같은 내용이다. 이후 사용자가 요청한 **모바일 단일 터치 및 단일 설명 카테고리 바로 열기**를 이전 1000ms long-press 요구보다 우선했다. 원문과 기존 PNG는 수정하지 않았다.

## 공통 데이터와 화면

- `src/game/tile-help.ts`: `getTileHelp(kind,number)` 또는 `getTileHelp(id)`. id/kind/number/name/imagePath/summary/details/timing/conditions/notes 및 기존 TileArt에 전달할 타일 데이터. 건물10·가축13·성/광산/선박3·수도원29·방패18·여관/포도/무역로3 =76개.
- `TileHelpContent`/`TileHelpArt`: 도감/hover/터치 팝업이 같은 내용·기존 그림 컴포넌트를 재사용한다. 수도원1–29는 승인된 final PNG. 방패18종은 기존 번호/능력이 연결된 SVG를 재사용한다. 별도 승인 방패 PNG가 등록되어 있지 않으며 새 일러스트는 만들지 않았다.
- `TileEncyclopedia`: 로컬/AI/온라인 화면 하단 접기/펼치기. 카테고리 순서는 건물,가축,성,광산,선박,수도원,방패,여관,포도밭,무역로. 방패 카테고리는 ? 방패. **등록 항목이1개면 목록 없이 즉시 상세**,2개 이상이면 개별 목록. 같은 개별 타일 재선택은 상세 접기. 카테고리 전환 시 이전 선택 초기화.
- `TileEffectTooltip`/`useTileEffectTooltip`: 루트에 단일 이벤트 컨트롤러. TileArt/ShieldArt/VineTile/실제 공급 클릭 영역/영지 장착 방패/무역로에 설명ID만 부여. 서버·저장에 설명창 상태를 넣지 않는다. 보드 전체를 마우스 이동마다 갱신하지 않는다.

## 모바일 입력 우선순위

1. 실제 주사위 선택, 필수 효과/선택, 저장고/포도/방패/교체 선택, 상품 종류 선택 등이 있으면 기존 게임 입력을 그대로 실행한다. 성 추가 행동은 주사위 미선택이어도 게임 입력을 우선한다.
2. 그 외 설명이 있는 타일은 짧은 단일 터치 완료 직후 설명을 연다. 다음 호환 click만 막아 획득/구매/배치/방패 선택이 실행되지 않는다. 설명 열기에는 전체 게임 상태/RNG/revision 변화가 없어야 한다.
3. 터치 이동10px 초과·다중 터치·pointercancel·보드 이동 모드의 preventDefault는 설명 제스처를 취소한다. 내부 터치/스크롤은 유지하고, 바깥 터치/바깥 스크롤은 닫는다. 보이는 다른 타일을 터치하면 설명을 바꾼다. 팝업 내부는 뒤의 타일로 클릭을 통과시키지 않는다.
4. 주사위 소진 뒤에도 선택적 구매를 유지하기 위해 모바일의 기존 추가 행동(⋯) 메뉴에 **보드에서 은화 구매 선택**을 추가했다. 온라인은 합법 행동 자원줄에서 제공한다. 실제 엔진이 합법 구매를 제공할 때만 선택 가능하고, 이후 기존 보드 구매/교체 핸들러를 사용한다. 별도 게임 행동이나 구매 규칙을 추가하지 않는다. 행동/불러오기/되돌리기/주사위 선택 시 구매 선택을 해제한다. 구매가 불가능해져도 기존 구매 선택을 취소할 수 있다. 포도 배치 후 저장고에서 사라진 선택ID는 설명 모드를 잠그지 않는다.
5. PC는 즉시 hover/out, pointer-events:none, 키보드 포커스/Escape 및 원래 보드 클릭을 유지한다. 화면 가장자리 제한과 높이 변화에 따른 재배치를 적용한다. PC는 뷰포트 높이 안에서 전체 내용을 보여주고, 터치는 최대440px 내부 스크롤을 사용한다. 경로 전환·대상 제거/교체 시 정리한다.

## 변경 파일

- 공통 데이터: `src/game/tile-help.ts`.
- 공통 설명 UI: `src/app/tile-effect-tooltip.tsx`, `tile-encyclopedia.tsx`, `tile-help-content.tsx`, `tile-help.css`.
- 연결 및 입력 우선순위: `src/app/layout.tsx`, `game-screen.tsx`, `online/room-screen.tsx`, `common-board.tsx`, `tile-art.tsx`, `shield-art.tsx`, `vineyard-board.tsx`, `trade-route-panel.tsx`.
- 검증: `tests/core/tile-help.test.ts`, `tests/core/run.mjs`, `tests/browser/tile-help.spec.ts`, `tests/browser/vineyards.spec.ts`(실제 주사위 입력/포도 배치 후 모드 복귀 검증 강화).
- 문서: 이 문서 및 `docs/TODO.md`, `docs/PROGRESS.md`의 이번 작업 접두 기록만.

## 실제 엔진과 대조한 설명 차이

게임 규칙은 고치지 않았으며 현재 구현에 맞춰 설명했다. 공식 규칙을 추가 검색하지 않았다.

|항목|확인된 현재 동작|
|---|---|
|수도원13/14|일꾼 획득 intent를 재사용하는 성 등의 추가 행동에도 은화1/일꾼4 적용. 실제 주사위만이라는 기존 설명을 수정.|
|수도원26|색상 보너스뿐 아니라 scoreLedger의 국경 전체 완성 `border:player:all`도 개수에 포함.|
|수도원28|엔진은 게임 진행 중 다른 플레이어 차례·필수 선택 중 반복 구매도 허용. 기존 UI는 행동하는 플레이어의 메뉴만 제공하므로 이 작업에서 다른 차례 입력을 새로 만들지는 않음.|
|방패6|현재 엔진이 자기 자신도 공유 대상으로 허용. 상세 설명/도감 제목은 이를 명시. 기존 능력 데이터ID/선택 처리 불변.|
|방패9|프로젝트 U15:판매 장수만큼 은화,수도원3은 판매1회당 +1.|
|방패14/15·유지비|매 A–E 종료 무료 배치→유지비→광산 수입. 제거한 방패는 종료 점수 제외.|
|포도밭/여관/무역로|프로젝트 확정/복원 규칙임을 표시. 포도밭4층,시작1+층4=5토큰 유지.|

## 검증과 실행

`npm run dev -- --hostname 127.0.0.1` 후 로컬/AI 게임은 `/`,온라인은 `/online`. 화면 아래 타일 설명을 펼치거나 PC 타일 hover/모바일 주사위 미선택 터치를 사용한다. 게임 원본 데이터·좌표·그림·RNG·AI·온라인 액션 및 저장 형식은 유지했다.

- 코어: `npm run test:core`439/439,이 중 새 tile-help 엔진 대조/메타데이터6/6.
- 보드: `npm run test:boards`33/33.
- 에셋: `scripts/validate-tile-assets.py` 기존 그림6/아이콘2 통과,경고0.
- 관련 브라우저: `tests/browser/tile-help.spec.ts`. 수도원29/방패18 전수·단일6카테고리·복수 목록·실제 상태 불변·PC100/160/200%·ARIA/경로 정리·터치/드래그/핀치·선택 주사위 실제 획득/배치·2/3/4인 필수 성 행동·주사위 소진 후 구매·온라인 POST0을 검사한다.
- 전체 PC:134개 중131통과,3개는 터치 전용이므로 PC에서 제외. 약16.8분. 원래 테스트의 검증을 삭제하거나 완화하지 않았다.
- 모바일375/390·태블릿768:관련15개 모두 통과(최초14통과+결과 폴더 충돌1개 별도 재실행 통과). PC/터치 입력 방식에 해당하지 않는 사례만 명시적으로 제외했다.
- 최종 보완 후 관련32개 중23통과/입력방식별9제외. PC5·터치18통과이며 온라인 포도 실제 주사위 획득/폐기 취소/배치 후 설명 모드 복귀/재접속도 포함한다. 전체PC 실행 후 포도 선택ID/구매 선택 취소/PC 긴 팝업 높이를 보완하고 관련 범위를 다시 검증했다. TypeScript(`tsc --noEmit`)/전체ESLint/프로덕션빌드 최종 exit0.
- 재현 중 발견한 진단 문제: Next 개발 알림이 온라인 방패 터치를 가려 대상 중앙 스크롤로 실제 입력을 확인했다. 동시에 실행한 Playwright 작업이 같은 trace 결과 폴더를 사용해1건 종료 시 ENOENT가 났으므로 별도 output 경로로 재검사했다. 게임 코드 검증을 완화하지 않았다.
- 로그/스크린샷: `.local-data/tile-help/` (Git 제외). `desktop-1280-{supply-hover,estate-hover-100,estate-hover-160,estate-hover-200,encyclopedia-monastery,online-tooltip}.png`, `{mobile-375,mobile-390,tablet-768}-{tap-monastery,tap-shield,encyclopedia-monastery,online-tooltip}.png`.

## 보존 및 남은 범위

기존 미커밋 수도원27/28 PNG·승인 원본ZIP/asset-inbox·여관 문서 수정은 보존하며 이번 커밋에서 제외한다. 설명 시스템의 모바일 검증은 수행하되 전체 게임 모바일 정밀QA는 기존 최종 통합 단계로 남긴다. 방패 실제 PNG 제작과 기존 규칙 변경은 범위 밖이다.

## 백업

이번20경로만 선별하며, TODO/PROGRESS는 이번 작업의 접두 부분만 스테이징한다. 기존 public/main의 사용자 Push 허용을 유지한다. 원본·로그·빌드 산출물·기존 미커밋 변경은 제외한다. Commit/Push·원격SHA 결과는 최종 체크포인트에 기록한다.
