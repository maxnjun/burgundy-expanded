# Android 게임 설정·핫시트·화면 맞춤 검증 (2026-10-31)

## 변경

- `GameSettings`가 기존 Guidance/Design/Android 위치 설정을 재사용한다. 로컬·핫시트·AI 헤더와 온라인 헤더에서 접근한다. 기존 게임 준비 기능은 유지한다.
- 상단 고정 OFF인데도 남던 `.table-view .intro`의 별도 sticky를 제거했다. 기존 환경설정이 이름·색상·행동안내 패널 한 곳을 제어한다. Android 헤더 고정46px과 작은 summary 기준 팝업 위치 때문에 생긴 실제 가림도 수정했다.
- 핫시트는 현재 플레이어 먼저, 나머지는 고정 좌석 순으로 모든 개인보드를 세로 표시한다. 상대의 주사위·자원·배치·포도밭 행동은 기존 actor 검사를 유지해 조회만 가능하다. 영지 영역을 보고 있을 때만 턴 전환 스크롤을 조정한다.
- 시작 성 선택은 `SavedGame.view.startingPreview` 선택필드다. GameState를 변경하지 않고 기존 그림으로 미리보기, 재선택, 확정한다. 확정만 기존 엔진 액션을 실행하고 중복 dispatch를 막는다. 파서는 기존 성 위치/현재 플레이어를 검증한다. 과거 저장은 필드 없이 읽는다. 온라인 시작 성 서버처리는 변경하지 않았다.
- 공용보드 버튼은25/35/50/60/75/100/125/160/200%. Android의 공급처 배율은 독립적이다. `BoardSupplyLayout`은 실제 컨테이너 폭/간격/패널 inset을 측정해 fit을 계산하고 방향·너비변경에 재계산한다. 아래 배치는 각 보드별로 맞추고 위치를 강제변경하지 않는다. 확대 시 원래 SVG 내부 탐색/바깥 가로 스크롤을 유지한다.
- Android 전용 화면 환경설정은 별도 localStorage에 저장하며 게임·주사위·점수·온라인 요청에 영향을 주지 않는다. 웹은 기존 레이아웃/zoom 상태를 사용한다. 새로운 라이브러리나 에셋은 없다.

## 파일

- `src/app/{board-display.ts,board-supply-layout.tsx,game-settings.tsx}` 신규.
- `src/app/{common-board.tsx,design-settings.tsx,guidance-settings.tsx,game-screen.tsx,game-screen.css,online/room-screen.tsx}` 연결·표시 수정.
- `src/game/{save.ts,starting-castles.ts}` 선택형 UI 미리보기 검증·공용 배율 허용 범위만 변경. 엔진/프로토콜 불변.
- `mobile/{native.css,version.json}` native 화면 대응,0.1.4/code5.
- `tests/core/{android-flow.test.ts,save.test.ts,run.mjs}` 및 `tests/browser/{android-flow.spec.ts,android-hotseat.spec.ts,design-settings.spec.ts,estate-bonuses.spec.ts,fifteen-online.spec.ts}`. 온라인 QA 보조브라우저의 고정3000포트를 실제 baseURL로 교정했다.
- 이 문서와 PROGRESS/TODO 새 접두사만 이번 백업 대상으로 한다. 기존 dirty 수도원27/28·입력 에셋·문서본문은 제외한다.

## 이번 실행 결과

| 검사 | 결과 |
|---|---|
| `npm run test:core` |532/532|
| `npm run test:boards` |33/33|
| `npm run test:android` |5/5|
| `npm run test:deployment` |7/7|
| `npx tsc --noEmit`, `npm run lint` |통과|
| `npm run build`, `npm run android:debug` |통과|
| `scripts/validate-tile-assets.py` |경고0|
| 신규 flow+기존 hotseat+design PC/모바일 |18통과, 명시적 Android가로전용10skip|
| 기존 game/online-controls/internet-online/design/estate-bonuses/fifteen-online/android-vineyard |28통과, 포트수정 후 실패2건 모두 재검통과|
| 실제 Android16/API36·WebView133 |아래 시나리오 통과|

실제 ADB터치로 2/3/4인 초기성 선택/취소/확정, 현재보드먼저·전체세로순서, 상대일꾼 클릭 무효, 일반주사위/Undo/수동턴종료를 확인했다.3인에서는 미리보기/확정직후/다음일반턴 각각 HOME전환 후 force-stop·재실행해 게임과 보드순서를 비교했다.

오프라인에서25%공용타일획득→실제엔진상태일치→Undo, 공용/공급처 독립축소→화면맞춤(가로넘침≤1px)→포도획득/배치/연쇄보상→Undo,125/160/200확대 및 실제양방향 스크롤 구조, 아래쪽fit, 따라오기 OFF/ON·디자인 OFF/ON·재실행 설정/게임정확일치를 검사했다. UI상태 변경만으로 GameState가 바뀌지 않음을 비교했다.

검사 산출물은 Git제외 `.local-data/android-flow/`의 로그와 `device-result.json`, 최종 APK/설치 검사는 `apk-verification.json`/`final-install.json`에 기록한다. 초기 실패는 실제 헤더/팝업문제, QA의 고정포트·스크린샷1MB버퍼·종료된페이지 locator·기존배율 초기화누락으로 구분해 수정하고 재검했다.

## APK 및 화면

- `.local-data/android/apk/burgundy-expanded-0.1.4-5-debug.apk`
- 앱ID `com.maxnjun.burgundyexpanded`; 기존 Debug서명SHA256 `541b6d701dd3909426ed985b7f44f51b7c3142f615880dd3d805a57c08594917` 유지. APK4→5 `install -r`로 실제 게임/Undo보존 검사. 이전APK보존.
- `screenshots/android-in-game-settings.png`, `android-starting-preview.png`, `android-hotseat-boards.png`, `android-fit-both-boards.png`, `android-expanded-scroll.png`, `android-vineyard-below.png`, `android-turn-guide-off.png` (위 산출물 디렉터리 기준).
- 브라우저 전체 개인보드·PC/모바일 이미지는 `final-browser/`에 있다. 최종 깨끗한 네이티브 캡처는 `final-` 접두사로 구분한다.

## 한계와 운영 보호

실물휴대폰과 다른 Android/WebView에서는 미검증이다. WebView localStorage는 JS에서는 동기지만 디스크반영이 지연되어, 저장직후 백그라운드 전환 없이 즉시 force-stop하면 최신변경이 유실되는 것을 재현했다. 정상 HOME전환+1.5초 후 종료는 정확복원됐다. 즉시강제종료까지 보장한다고 주장하지 않으며 기존 저장엔진을 이번 화면수정에서 임의 교체하지 않았다. 필요한 경우 native 영속저장 별도 설계가 필요하다.

사용자가 확인한 Render AutoDeploy Off와 기존 `render.yaml` off, release workflow의 `[no-deploy]` 차단을 유지한다. 배포/재시작/API배포/환경변수/Redis삭제·초기화 명령은 실행하지 않는다. 지정 subject의 `[skip render] [no-deploy]`를 유지해 관련 파일만 일반Push하고 원격SHA를 확인한다. 최종 Git 결과는 완료보고와 `backup-result.json` 참조.

## 운영 버전 확인 후 APK 호환 정보 보정

실제 네이티브 재접속에서 운영 버전352a04a와 종전APK핀414d4d0의 불일치로 입력이 안전하게 차단됐다. 두 QA자리의 GET인증은 성공했고 방/게임행동은 만들지 않았다.352→현재의 core/server/GameState타입/direct-actions/transport diff가 없는 것을 확인해 onlineVersion만352a04a로 맞췄다. 버전검사를 우회하지 않고 메타데이터 검사를 유지한다. 후속 APK 재빌드/실제 설치/두 자리 재접속 최종 결과는 로컬JSON과 완료보고 참조. Render 배포·재시작·설정·데이터변경은 실행하지 않았다.

## 추가 실제 온라인 화면 맞춤 검사 결과

Android 실제 온라인 화면에서 row의 좌우padding16px와 wrapper 삽입으로 누락된 기존300px공급처 스타일 때문에46px넘침을 발견했다. row content폭을 측정하고 온라인공급처 selector를 descendant로 바꿔 원래300px/타일120px/패딩12px스타일을 유지했다. 기존PC에서는 같은 공급처에 같은스타일이 적용된다. 온라인회귀는866/640/780폭의 row/공급처 넘침≤1px와 행동POST0을 추가한다. 최종타입/린트/웹build·관련브라우저6/6·실제수정APK설치·기존QA방 Android+PC설정/맞춤/재접속/양쪽reload/게임revision불변 검사가 모두 통과했다. 새방생성·게임행동·운영데이터초기화는 없었다. 최종 커밋 APK/설치/Push결과는 .local-data/android-flow/final-install.json·backup-final-result.json 참조.
