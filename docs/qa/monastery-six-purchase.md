# 수도원 6번 구매·공통 구매 제한 검증 (2026-10-31)

## 원인과 수정

기존 core와 team adapter 모두 `tile.type === building`만 구매후보/검증에 사용했고 수도원6은 `monasterySixUsed`, 은화구매는 `blackPurchaseUsed`만 확인해 두 번 구매가 가능했다.

`src/game/purchases.ts`의 두 작은 공통검사를 재사용한다. 번호공급처의 실제 슬롯에 있는 등록타일인지로 대상을 확인하며 색상/건물종류로 제한하지 않는다. `purchaseUsed`는 두 기존사용flag의 OR다. 새로운일꾼구매는 `blackPurchaseUsed`도 true로 설정하고 기존`monasterySixUsed`는 진단·저장호환용으로 유지한다. 은화/여관/포도상점도 같은검사를 통과해야 하며 기존무료보상/수도원28 자원교환은 구매기회를 사용하지 않는다.

비용/이동은 원래 검증된 구매처리를 사용한다. 번호타일은 `executeIntent(take-tile)`, 검은타일은 기존 `storeTile`, 기존저장고빈칸/명시교체·removed zone·선택지갱신·턴초기화·AI법적후보가 그대로 동작한다. 유효성검사 뒤 clone에만 비용과flag를 확정하며 실패/취소는 상태불변이다. 주사위를 소모하지 않는다.

로컬과 온라인은 기존구매선택과공용보드클릭을 재사용한다. `수도원6 · 일꾼2 타일 구매`로 표시하고 합법후보가 없으면 비활성화한다. 사용후 두수단차단과 사유를 표시하고 구매의수단/비용/타일이미지를 기록한다. 온라인에서 모드미선택클릭이 일꾼구매로 암묵실행되는 fallback도 제거했다. `RoomView.purchase`는 사용여부/수도원6활성여부의 공개투영이며 서버에새저장필드는 만들지 않는다.

## 파일 목록

- `src/game/purchases.ts`: 공통기회/번호슬롯검사(신규).
- `src/game/core/engine.ts`, `src/game/modes/team-engine.ts`: 필터/검증/공통flag/기존후보생성.
- `src/game/action-guidance.ts`, `src/game/action-log.ts`: 일꾼구매 안내·완료후구매가능판정·실제수단/비용 기록.
- `src/app/game-screen.tsx`, `src/app/online/room-screen.tsx`: 기존모드선택·보드직접클릭·비활성사유/비용표시.
- `src/server/rooms.ts`: 엔진기반 공개구매상태 투영. 요청인증·원자적저장·중복방지·온라인Undo는 기존처리 재사용.
- `tests/fixtures/monastery-six.ts`, `tests/core/monastery-six.test.ts`, `tests/browser/monastery-six.spec.ts`: 신규 실제보존픽스처/규칙/서버/PC·모바일 검사.
- `tests/core/{run.mjs,effects.test.ts,team.test.ts,action-guidance.test.ts}`: 기존검사연결·의도된새규칙기대값.
- `mobile/version.json`, `scripts/{android-web.mjs,verify-android-apk.py}`:0.1.5/code6 및 규칙변경APK의 source SHA고정/빌드검사.
- `docs/ANDROID.md`, 이문서, `docs/PROGRESS.md`, `docs/TODO.md`의 이번접두사.

기존수도원설명과이미지/타일좌표/클릭구조/점수/공급규칙/저장필드/방데이터는 바꾸지 않았다. 기존dirty 수도원27/28·입력자료·문서기존본문은 커밋에서 제외한다. APK는 기존작업트리이미지를 보존한다.

## 실제 실행 결과

| 검사 | 결과 |
|---|---|
| `npm run test:core` |547/547|
| 최종 `node tests/core/run.mjs monastery-six` |15/15|
| `npm run test:boards` |33/33|
| `npm run test:android` |5/5|
| `npm run test:deployment` |빌드완료후순차재검7/7; fake Upstash/HTTP/WS 서버재시작포함|
| `npx tsc --noEmit`, `npm run lint`, `npm run build` |통과|
| 신규 Playwright PC1280·모바일390 |14/14|
| 기존 game/manual-turn/online-controls/vineyards PC |20/20(AI25라운드/일반2~4인/추가행동/포도밭/온라인Undo·재접속)|
| `scripts/validate-tile-assets.py` |경고0|
| `npm run android:debug`, `scripts/verify-android-apk.py` |통과,225개공개에셋 원본바이트일치|
| 실제 Android16/API36·WebView133 |아래ADB시나리오통과|

각6종마다 번호타일→저장고·일꾼정확2·은화/주사위불변·점수변화없음·공통기회를 확인했다. 검은/포도/비어있는슬롯/다른공급처/비소유플레이어·능력미활성·자원부족·잘못된교체를 거부하고 원본상태를 비교했다. 은화와일꾼을 양순서로 구매후 두수단·포도상점차단, 상대실제은화구매후 다음내턴기회복원, 과거worker-only flag저장호환, AI실제일꾼구매를 검사했다.

Undo는 원래엔진전체snapshot/로그를 복원한다. 로컬두Undo범위·sidecar/파일저장, 온라인양좌석동기화·요청ID중복1회처리·위조거부·방저장소재시작후현재게임/양쪽reload·두Undo를 검사했다. 가져온파일에없던turn-start기록을 조작해만들지않고 핫시트QA는 정식Undo포함저장형식으로검증했다.

실제 Android에서 기존5→6 `install -r`로 게임/Undo보존을 먼저 확인했다. 오프라인에서6종실제ADB터치·은화/일꾼양방향차단·저장고교체취소/확정·이전행동/턴되돌리기·정상HOME후force-stop복원·2/3/4핫시트·100/160/200%를 확인했다. 서명SHA256은 기존 `541b6d701dd3909426ed985b7f44f51b7c3142f615880dd3d805a57c08594917`이다.

초기실패는 구문구기대값, 샌드박스rename권한, QA요청ID규격, import에없는turn-start Undo를 요구하던픽스처, production build동시실행으로BuildID가잠시없던 배포검사로 구분해 수정/재실행했다. 엔진검증/요청ID/Undo보안을 우회하지 않았다.

## APK·스크린샷과 운영 제한

- APK `.local-data/android/apk/burgundy-expanded-0.1.5-6-debug.apk`, 동일앱ID `com.maxnjun.burgundyexpanded`/기존Debug키. 이전APK는 보존.
- `.local-data/monastery-six/screenshots/android-monastery6-{100,160,200}.png`, `android-monastery6-purchased.png`; 신규브라우저 화면은 같은작업디렉터리의 `browser2/`.
- 검사로그/현재진행: 같은디렉터리의 `device-result.json`과 각log. 최종커밋APK/설치·버전차단/Push SHA검증은 `apk-verification.json`, `final-install.json`, `version-guard.json`, `backup-result.json` 및 완료보고 참조.

이번은 규칙수정이므로 APK의 `onlineVersion: source`가 빌드Git SHA를 사용한다. 구운영352/다른커밋을 호환이라고 위장하거나 버전검사를 우회하지 않는다. 같은커밋으로 운영서버를 사용자가 별도로수동배포하기전에는 새APK온라인입력이차단될 수 있다. 로컬온라인2인새규칙은 검증했고 운영새규칙게임은 미배포라 미검증이다. Render 배포/재시작/설정/운영Redis명령은 실행하지 않는다. AutoDeploy Off 사용자확인·render.yaml off·release `[no-deploy]`guard·지정커밋태그를 유지한다.

저장구조는 그대로여서 과거`monasterySixUsed=true,blackPurchaseUsed=false`도 현재턴의기회를쓴것으로판정한다. 이미과거에획득한타일을 지우거나게임을초기화하지않는다. 실물휴대폰/다른WebView는 미검증이고 기존WebView의 저장직후즉시강제종료시디스크flush전유실위험은 별도미해결사항이다.
