# Android 핫시트와 포도 공급처 위치

## 사용법과 구조

- Android 첫 화면의 **핫시트 — 한 기기에서 2~4인** → 인원·이름·색상·확장 선택 → **핫시트 게임 시작**. 기존 로컬/AI/온라인은 유지한다. 시작 성은 기존 로컬 방식으로 위치를 누르면 다음 좌석으로 넘어간다.
- 기본 이름은 플레이어 1~4. 기존 6색을 사용하고 다른 활성 좌석이 선택한 색은 비활성화한다. 인원을 늘릴 때 숨겨진 좌석의 중복 색상은 남는 색으로 보정한다. 최종 검증은 기존 엔진의 색상 검사도 거친다.
- 게임 엔진의 `activePlayerId`로 기존 `renderBoard` 하나를 선택한다. 별도 플레이어 상태나 규칙 모드는 없다. 턴 종료 후 다음 플레이어의 보드·저장고·상품·포도밭·방패·무역로가 같은 객체에서 표시된다. 주사위 2개 사용만으로 사람 턴이 끝나지 않는다.
- **개인보드 확인**으로 다른 보드를 열람할 수 있다. 실제 행동 대상은 현재 플레이어로 유지되고 다른 보드의 게임 행동은 비활성화한다. 열람 선택은 현재 턴 키에만 연결하며, 새 턴·불러오기·재실행에서는 현재 플레이어 보드로 복귀한다.
- 이름·색상은 기존 플레이어 상태를 재사용한다. 새 행동 기록에는 원래 행동한 플레이어 ID·색상을 선택형 메타데이터로 포함하고 핫시트에서 색상 표식을 표시한다. 기존 텍스트 기록도 그대로 읽는다.
- Android 설정 **포도밭 공급처 위치**: 기본 `오른쪽 — 가로 스크롤`, 선택 `아래쪽 — 세로 스크롤`. 확장이 활성화된 진행에서만 표시한다. 두 위치는 동일한 DOM과 선택 상태를 사용하며 CSS 방향만 바꾼다. 별도 보드 내부 확대·축소/드래그는 유지한다.
- 위치는 `burgundy-expanded:vineyard-layout-v1`에 기기별 저장한다. Android 런타임이 HTML 데이터 속성으로 적용하며 웹에서는 메뉴나 레이아웃을 활성화하지 않는다. 확대 그림 안에서는 내부 탐색이 우선하므로 오른쪽 공급처로 이동할 때 공용보드 상단 안내 줄을 스와이프할 수 있다.

## 저장 및 호환성

- 기존 `burgundy-local-v1`과 전체 GameState를 유지하고 `view.hotseat?: boolean`, `undo?: string`만 추가한다. 자동 저장은 기존 게임/Undo sidecar 두 키를 그대로 사용한다. 개인정보·재접속 토큰·서버 방 상태와 무관하다.
- 핫시트 JSON 내보내기에는 Undo sidecar를 포함한다. 가져오기에서 원래 `restoreTurnHistory`가 게임·설정·로그·현재 턴·revision·스냅샷의 합법성을 검증한다. 다른 플레이어의 확정된 턴이나 오래된 Undo는 연결하지 않는다. 유효하지 않은 Undo는 폐기하고 게임은 유지한다.
- 기존 일반 파일은 2백만 문자 제한을 유지한다. hotseat+Undo만 6백만 문자, Undo 자체는 4백만 문자, 공통 깊이/노드 제한은 동일하다. UI는 6MB 넘는 가져오기/내보내기를 거부한다. 긴 턴의 Undo 용량 초과는 기존 명시적 오류를 표시하며 현재 게임 자동 저장을 보존한다.
- 기존 저장 파일은 핫시트 플래그가 없으면 기존 화면으로 열린다. 과거 내보내기에 없던 Undo나 과거 기록의 색상을 추측하여 생성하지 않는다. 위치 설정은 게임 파일과 독립적이다.

## 변경 파일

- `src/app/android-settings.tsx`: Android 감지/위치 설정 구독과 메뉴.
- `mobile/runtime.tsx`, `mobile/native.css`, `mobile/version.json`: Android 속성·두 배치·버전0.1.3/code4.
- `src/app/game-screen.tsx`, `src/app/game-screen.css`: 핫시트 진입/좌석 설정/현재 보드/열람/저장 연결.
- `src/app/online/room-screen.tsx`: Android용 위치 메뉴만 재사용.
- `src/game/player-colors.ts`: 좌석 색상 정규화.
- `src/game/save.ts`, `src/game/bounded-json.ts`: 선택형 저장 필드와 제한.
- `src/game/action-log.ts`, `src/app/action-log.tsx`: 행동자 색상 메타데이터와 표시.
- `tests/core/hotseat.test.ts`, `tests/core/run.mjs`, `tests/browser/android-hotseat.spec.ts`: 새 검사 등록.
- `docs/PROGRESS.md`, `docs/TODO.md`, 이 문서: 진행·검증 기록.

## 이번 실행 검사

- 관련 코어31/31 이후 전체528/528, 보드33/33, Android5/5, 배포방지7/7, TypeScript/ESLint/웹 production 및 APK 빌드 통과.
- 새 Playwright6/6: 2/3/4인 실제 준비·시작 성·색상 중복 차단·개인 상태·수동 종료·Undo·상대 보드 열람·새로고침·JSON Undo 복원, 두 위치/4배율/2디자인, 웹 메뉴 비노출, 키보드 높이127px에서도 시작 버튼 클릭·과거 연습 보드 가져오기 후 새 게임. 기존 회귀12/12: 로컬·AI 25라운드·3/4인·드래그·온라인 두 좌석/재접속/Undo·포도 A~E/빈 공급처/획득/배치/보상.
- 실제 Android16/WebView133/2400×1080 가로 전용 에뮬레이터에서 APK3→4 업데이트 후 게임 전체 동일. Wi-Fi/모바일 데이터를 끄고 2·3·4인 준비·이름/색상·시작 성·주사위/일꾼 실제 ADB 탭·Undo·수동 종료·보드 자동 전환·개인 상태 분리 통과. 두 위치×4배율×두 디자인16조합, 양방향 스크롤·선택 유지, 실제 포도 획득/배치/필수 보상, force-stop 후 정확한 게임/현재 보드/아래쪽 위치 복원 및 실제 이전 행동 취소 통과. 인원별 검증은 한 라운드와 해당 행동 단위이며 2~4인 수동 게임 전체 완주를 주장하지 않는다.
- QA 첫 실행의 option matcher 미지원/새로고침 선택 초기화/로컬 시작 성 즉시 확정 흐름 대기 오류를 수정한 뒤 Playwright 통과. native QA는 마지막 좌석 종료 후 라운드 준비의 일시적 null active ID를 기다리도록 보완했다. 실제 발견한 제품 문제는 Android 키보드로 높이가127px가 됐을 때 sticky 안내가 준비 버튼을 가린 현상과, 과거 연습 보드ID를 새 게임 메뉴에 그대로 넣은 오류였다. 준비 메뉴를 여는 동안 Android 안내만 static 처리하고 연습 보드ID는 기존 빈 선택값으로 정규화했다. 기존 화면·게임 엔진은 유지했다. 새로고침/재실행 QA는 저장 복원이 끝난 뒤 보드를 검사하며, 보상 선택은 사라진 텍스트 버튼 대신 기존 공용보드 직접 클릭을 사용한다.
- 상세 로그·APK·비공개 에뮬레이터 저장 백업·PNG는 Git 제외 `.local-data/android-hotseat/`. 에뮬레이터와 웹 테스트는 별도 QA 데이터만 사용한다.

## 배포와 한계

- 같은 앱 ID `com.maxnjun.burgundyexpanded`와 기존 Debug 서명을 유지한다. APK1/2/3은 보존한다. 최종 커밋을 포함한 재빌드의 sourceCommit/해시/크기/서명과 설치 검사는 `.local-data/android-hotseat/` 및 완료 보고에 남긴다.
- 사용자 확인 Render Auto-Deploy Off, `render.yaml` off, release workflow의 `[no-deploy]` 차단을 확인했다. 요청한 커밋 제목에 두 차단 태그를 유지한다. Render 배포·재시작·설정/환경변수 변경, 운영 Redis 초기화는 하지 않는다.
- 실제 휴대폰/다른 Android·WebView·제조사 터치와 공유 메뉴는 별도 실기기 확인이 필요하다. 모든 확장 조합을 네이티브로 완주한 것은 아니며 기존 전체 엔진 검사와 관련 UI 회귀 범위를 구분한다.

## 화면과 결과 파일

- `screenshots/android-hotseat-current-player.png`: 현재 플레이어 이름·색상.
- `screenshots/android-vineyard-right.png`, `android-vineyard-below.png`: 실제 Android의 두 배치.
- `.local-data/android-hotseat/device-result.json`: 인원별·16조합·오프라인·보상·재실행/Undo 결과.
- `browser-verified.log`: 최종6/6. `regression.log`: 기존12/12. `core-final.log`, `boards.log`, `android-tests.log`, `deployment.log`, `types-complete.log`, `lint-complete.log`, `build-last.log`, `tile-assets.log`: 이번 검사 결과.
- APK: `.local-data/android/apk/burgundy-expanded-0.1.3-4-debug.apk`. APK/서명/최종 설치/Push 결과는 `apk-verification.json`, `signature.log`, `final-install.json`, `backup-result.json`. 비공개 QA 저장/자리 인증은 Git에 포함하지 않는다.
