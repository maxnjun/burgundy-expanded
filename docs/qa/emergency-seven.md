# 긴급 버그 7종: 웹·Android 검증 (2026-11-08)

기준 커밋 `730cdc2f3cde9a2dd20f1387d9cc208eb16aa4d3`. 운영 Redis/방/환경변수는 조작하지 않았다. Render 배포·재시작도 실행하지 않았다. 이번 문서의 완료는 로컬 코드와 격리 테스트를 뜻하며 운영 반영을 뜻하지 않는다.

| 항목 | 상태 | 원인 및 수정 | 확인 |
|---|---|---|---|
| 1. 무역로 추가 행동 | 완료 | 커스텀 카드 네 곳의 보상 ID가 `white-castle`였다. 기존 `castle` 즉시 효과로 연결해 한 번의 자유 주사위 행동을 제공한다. 실제 흰 성은 흰 주사위/일꾼 보정 규칙을 그대로 쓴다. | 무역 판매→추가 행동→일꾼 획득, 실제 흰 성 비용과 차이, 재실행 거부, 연쇄 Undo, 저장·격리 온라인. |
| 2. 구매창 펼침 | 완료 | 로컬 `<details>`에 초기 open이 없었다. 기본 펼침으로 변경하고 수동 접기 상태는 기존 DOM에 유지한다. 비활성 수도원28 전용 버튼은 효과 보유 시에 표시한다. | 최초 펼침, 행동 후 유지, 수동 접음 후 유지, 수도원6·일반 은화 구매 회귀. |
| 3. 상단 점수 | 완료 | 상단에 실제 `victoryPoints`를 표시하는 공통 영역이 없었다. 이름·색상과 누적 점수를 함께 표시한다. 온라인은 내/상대, 핫시트는 현재/모든 좌석이다. | 판매 후 서버 점수와 두 브라우저 일치, 재접속, 2/3/4인. 최종 정산을 앞당겨 합산하지 않는다. |
| 4. 더블 구매 | 완료 | 같은 타일/상태/시간을 구분하는 입력 상태가 없었다. 첫 클릭은 구매 선택, 400ms 이내 동일 타일 두 번째 클릭은 합법 수단이 하나일 때만 실행한다. 수단이 겹치면 명시적으로 선택한다. | 단일 무변경, 다른 타일·스크롤·다중 터치 분리, 은화/수도원6/일반 주사위, 저장고 교체 취소·확정, 자원·주사위·공통구매횟수·Undo, 온라인 revision 한 번 증가. |
| 5. 상단 축소 | 완료 | 온라인에 두 Undo 제한 사유가 중복 출력됐고 기본 구매창 확대도 높이를 늘렸다. 중복 문단을 제거하고 버튼 title을 유지한다. 펼친 구매 항목과 패딩을 줄였다. | Android 가로 WebView 866×364에서 최종 높이 약132.24 CSS px(기본/디자인1 동일). 주사위·일꾼·점수·수동 종료 유지. |
| 6. 접속 지연 | 부분 완료 | 최초 운영 GET 세 건이 각각25초 지연됐으나 TCP는 연결됐다. 마지막 GET은 모두200이다. 운영 원인은 인증된 Render/Redis 로그 없이 확정할 수 없다. 클라이언트의 raw timeout 노출, 생성/참가 실패 시 복구 안내, 멈춘 WS handshake, 중복 버전 조회를 보완했다. | 로컬 실제 타임아웃 종료·한국어 재시도, 생성 응답 유실 후 동일 방ID/자리 토큰으로 두 번 요청해 방 한 개, 두 자리 동기화/새로고침/Undo. 운영에는 새 코드 미반영. |
| 7. 방패 유지·제거 | 완료 | Android 전용 엔진 누락이 아니라 로컬 공통 선택 패널이 고정 조작부 밖/위에 있어 스크롤 중 접근하기 어려웠다. 기존 `ShieldUpkeep`를 고정 조작부 안으로 옮겼다. | 실제 Android 핫시트 2/3/4인, 유지 은화/방패3 일꾼 대안, 제거 후 원공급처 반환. 페이즈 경계 Undo 제한은 기존 규칙 유지. |

## 구매와 터치

- 새 빠른 구매는 기존 명시적 은화/수도원6 모드와 직접 주사위·필수 보너스 보드 조작을 보존한다. 정상적인 일반 주사위 획득을 무조건 두 번 누르게 만들지 않는다.
- 수도원6과 주사위 획득이 함께 합법이면 선택창에서 수단을 고른다. 가득 찬 저장고에서도 선택한 주사위/구매 수단을 유지하며, 기존 교체 확인을 통과해야 소비한다.
- WebView는 pointerup에서 팝업이 손가락을 덮으면 뒤따르는 click을 팝업으로 보냈다. 빠른 구매 타일의 도움말을 click 시점에 열고 원래 타일 바깥에 배치했다. 구매 방법 창은 도움말보다 앞에 표시한다.
- 스크롤·wheel·pointercancel·다중 터치는 더블클릭 연결을 끊는다. 보드의 기존 드래그/핀치 취소와 서버 request ID·revision·소유권·엔진 검사를 그대로 사용한다.

## 저장과 호환성

저장 스키마/방 형식은 변경하지 않는다. 예전 무역로 선택지가 정확히 기존 흰 성 메뉴와 일치하고 해당 무역로 칸을 처리 중인 경우에만 castle 선택지로 이전한다. 실제 흰 성이나 변조된 메뉴는 변환하지 않는다. 로컬 Undo sidecar의 현재 상태도 같은 제한으로 이전한다. 이미 처리된 과거 보상이나 로그는 임의 재계산하지 않는다.

번호 공급처/검은 공급처·비용·공통 구매 제한은 기존 서버 합법 행동 목록을 재사용한다. 엔진의 가격/방패 유지비/포도밭/점수 계산은 추가 행동 ID 수정 외에 변경하지 않는다.

## 접속 조사와 한계

- 처음: health/version/online 각각 약25초 타임아웃, 별도 curl TCP 약65ms 연결. 서비스 전체 중단 또는 Redis 장애라는 증거는 아니다.
- 마지막 읽기 전용 GET(UTC 2026-11-08 14:34): health481ms/200, version229ms/200, online235ms/200. 실제 운영 버전 `730cdc2f3cde9a2dd20f1387d9cc208eb16aa4d3`, protocol1.
- 생성/참가는 기존15초 제한을 늘리지 않고 최대 한 번만 1.2초 뒤 재시도한다. 같은 ID/토큰/설정으로 요청한다. 두 번 실패하면 진행 상태를 종료하고 저장된 요청 재시도 버튼을 제공한다.
- GET의12초 제한/기존 재접속 backoff와 HTTP 폴링은 유지한다. 인증 상태가 오지 않는 WS도12초 후 닫고 HTTP/기존 backoff로 복구한다. 버전 조회는15초 제한·중첩 방지·unmount 취소를 적용한다.
- Upstash의 기존10초 제한과 원자적 CAS/기록/인증은 유지한다. 실패 로그에는 명령 종류와 소요 시간만 남기며 URL·토큰·키·원본 방·provider 오류를 출력하지 않는다.
- 운영의 실제 초기 HTML 지연 원인은 미확정이다. 인증된 서비스 로그 확인과 승인된 후속 수동 배포가 필요하다. 이번 코드를 운영에서 검증했다고 주장하지 않는다.

## 이번 검사

- 전체 엔진 `npm run test:core`: **554/554**.
- 보드 `npm run test:boards`: **33/33**; Android `npm run test:android`: **9/9**.
- `npm run test:deployment`: **7/7**. 실제 HTTP/WS 인증·상태 동기화·서버 프로세스 재시작 복구 포함, 운영과 격리된 저장소 사용.
- TypeScript `npx tsc --noEmit`, 전체 ESLint, 웹 프로덕션 빌드 통과.
- 브라우저: `emergency-seven`, `monastery-six`, `custom-trade`, `custom-trade-online`를 PC1280·터치390에서 검사. 최종 수치는 `.local-data/emergency-seven/browser-verified.log` 참조. 실제31초 지연 종료도 측정했다.
- Android16/WebView133 ADB: 실제 단일/더블탭, 두 구매 수단, 정확한 비용/주사위, Undo, 2~4인 방패 유지·제거/반환, 무역로 판매→추가 행동, 점수, 강제 종료 후 복원, 디자인 ON/OFF 통과.
- 업데이트 설치에서 게임/Undo 유지, 앱 ID `com.maxnjun.burgundyexpanded`, 기존 debug 서명 SHA256 `541b6d701dd3909426ed985b7f44f51b7c3142f615880dd3d805a57c08594917`, public225개 포함 확인. 최종 커밋 APK의 SHA/메타데이터/원래 저장·설정 복원은 로컬 `final-install.json` 참조.
- 새 APK: `.local-data/android/apk/burgundy-expanded-0.1.7-8-debug.apk`. 원래 APK는 보존한다. `onlineVersion: source`로 최종 커밋을 요구하므로 구 운영 서버 버전으로 위장하지 않는다.

## 화면

로컬 `.local-data/emergency-seven/screenshots/`에 `android-before.png`(기존 APK7), `android-after.png`, `android-after-design1.png`를 보존한다. PC·모바일·방패 화면은 해당 브라우저 검사 결과 PNG와 복사본에 보존한다. Android는 실제2400×1080, WebView866×364/DPR2.625다. PC 변경 전 화면은 이번 실행에서 별도로 확보하지 못했다.

## 변경 파일과 백업

- UI: `src/app/{common-board.tsx,current-scores.tsx,supply-purchase.tsx,game-screen.tsx,game-screen.css,game-version.tsx,tile-effect-tooltip.tsx}`, `src/app/online/{room-screen.tsx,room-connection.ts}`.
- 규칙/호환: `src/game/{custom-trade-routes.ts,core/effects.ts,save.ts,turn-history-cache.ts}`; 진단 `src/server/upstash-rooms.ts`.
- `mobile/version.json`; `tests/core/{emergency-seven.test.ts,custom-trade.test.ts,custom-trade-online.test.ts,run.mjs}`; `tests/browser/{emergency-seven.spec.ts,custom-trade.spec.ts,custom-trade-online.spec.ts}`; 본 문서 및 PROGRESS/TODO 새 접두사만 백업한다.
- 기존 dirty 수도원27·28 이미지/원본 입력 에셋/이전 문서 수정은 해시·바이트 사본으로 보존하고 이번 Git 커밋에서 제외한다. APK는 기존 로컬 이미지 상태를 보존해 포함한다.
- 기존 origin/main의 공개 상태는 이전 명시적 허용 범위에서 유지한다. 새 저장소나 공개 전환은 하지 않는다. 민감정보/운영 저장/로컬 QA 산출물은 스테이징하지 않는다.
- [Render 공식 skip 문구](https://render.com/docs/deploys#skipping-an-auto-deploy)도 다시 확인했다. 사용자 확인 Auto-Deploy Off, render.yaml off, 지정 커밋의 `[skip render] [no-deploy]`, release의 no-deploy 차단을 유지한다. 실제 Dashboard 설정을 API로 다시 조회할 인증은 없다. Render 요청/설정 변경/재시작/배포 명령은 실행하지 않는다.

실물 휴대폰·다른 WebView·실제 다른 네트워크는 미검증이다. 일반 행동의 저장 확정 이전 강제 종료 위험은 기존 별도 항목이며 새 기능의 완료로 해소됐다고 주장하지 않는다. Phase1~8 및 다른 미완료 과제는 기존 TODO를 보존한다.
