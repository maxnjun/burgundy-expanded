# 핫시트 새 게임 초기화 검증 — 2026-11-02

## 원인과 수정

공용보드 객체를 재사용하는 코드는 없었다. 기존 `newSession()`도 `createPracticeSession()`으로 전체 GameState를 만들지만, 기본/복원된 시드를 그대로 사용해 같은 공급 타일·방패 추첨이 반복됐다. 생성 후 React effect에서만 localStorage를 저장해 WebView가 디스크에 쓰기 전에 프로세스가 종료되면 이전 게임이 복원될 수 있었다. 구매 모드·상품 선택·방패 대상·회전 등 일부 UI 상태도 초기화하지 않았다. 일반 엔진의 정상 생성/초기 공급/플레이어 수별 규칙은 변경하지 않았다.

새 핫시트는 UUID 시드를 기존 엔진에 전달한다. 그 시드는 게임 식별 경계와 기존 Undo turnKey에도 사용되므로 별도 GameState 필드를 만들지 않는다. 전체 GameState/로그/빈 Undo를 저장 완료한 뒤에만 화면을 바꾼다. UI 선택 상태와 공용보드 자식의 페이지 상태도 새 시드 key로 분리한다. 진행 중 및 시작 성 임시/일부 배치 중에는 확인하고, 종료 후에는 `새 핫시트 게임`으로 설정에 바로 돌아간다. 생성 중 ref/disabled로 중복 실행을 막고 실패하면 기존 게임을 유지한다. 로컬/AI의 수동 시드는 기존대로 유지한다.

Android의 `LocalGameStorePlugin`은 앱 전용 SharedPreferences 한 번의 `commit()`으로 게임 JSON과 matching Undo를 함께 저장하며 디스크 완료 후 응답한다. `local-save.ts`가 이전 autosave→새 게임의 쓰기를 직렬화한다. 첫 업데이트 시 native 저장이 없으면 기존 localStorage를 읽어 이전하고, 이후 native 저장을 우선한다. 읽기/검증 실패는 원본을 유지하고 자동저장을 차단한다. 수동 파일 가져오기도 같은 저장 경로를 통과한다. 웹 저장 키/형식, 온라인 자리·서버·Redis 스키마는 유지한다. 내보낸 과거 JSON과 관련 없는 파일/기기 설정을 삭제하지 않는다.

## 수정 파일

- `src/app/game-screen.tsx`: 새 게임·저장 전환·초기화·확인·중복 방지·종료 버튼.
- `src/app/local-save.ts`: 브라우저/네이티브 읽기와 순서 보장 쓰기.
- `mobile/runtime.tsx`: 기존 Capacitor 런타임에 로컬 저장 연결.
- `mobile/version.json`: 0.1.6, versionCode 7; 기존 source 버전 검사 유지.
- `android/app/src/main/java/com/maxnjun/burgundyexpanded/{MainActivity.java,LocalGameStorePlugin.java}`: 앱 전용 durable 저장과 플러그인 등록.
- `tests/fixtures/hotseat-reset.ts`: 실제 엔진 행동·확장·페이즈 종료 fixture.
- `tests/core/hotseat.test.ts`: 2→3, 3→4, 4→2 전체 상태/과거 파일/Undo 독립성.
- `tests/android/local-save.test.mjs`: 저장 순서·마이그레이션·실패·캐시 불일치.
- `tests/browser/hotseat-reset.spec.ts`: 종료/인원/확장 OFF/저장실패/반복 클릭/재접속/성 임시 배치 확인.
- `tests/browser/android-hotseat.spec.ts`: 기존 진행 중 게임 재시작 검사에 확인창 수락 추가.
- `docs/ANDROID.md`, 이 문서, `docs/PROGRESS.md`·`docs/TODO.md`의 이번 접두사.

## 이번 실행

| 검사 | 결과 |
|---|---|
| 전체 엔진 `npm run test:core` | 550/550 |
| 핫시트 직접 엔진 검사 | 8/8 |
| 보드 `npm run test:boards` | 33/33 |
| Android/저장 `npm run test:android` | 9/9 (신규 저장 4개 포함) |
| 저장소/HTTP/WS/배포 차단 `npm run test:deployment` | 7/7; 운영 저장소 사용 없음 |
| 신규 PC1280·모바일390 브라우저 최종 검사 | 8/8 |
| 기존 브라우저 회귀 | 17/17; AI 25라운드, 2~4인, 시작 성, 설정/디자인, 포도 획득/배치, 확대, 온라인 Undo/재접속 |
| TypeScript·ESLint·웹 production build | 통과; 최종 기록은 작업 디렉터리의 types-final2/lint-final2/build-final-retry |
| Android debug build·225개 번들 에셋·서명 | 통과; 최종 커밋 재빌드/설치는 아래 JSON과 완료 보고 참조 |

fixture는 일반 구매, 방패 장착, 포도 획득/배치, 상품 판매→무역로, 여관 구매를 실제 유효 행동으로 수행하고 A~E를 진행해 종료한다. 테스트용 초기 자원만 늘렸고 타일은 보존한다. 새 게임은 단순 이미지 비교가 아닌 선택한 인원/확장/이름/보드/새 시드로 엔진이 만든 **전체 GameState**와 일치해야 한다. 옛 게임과 파일은 변하지 않고 기록/최종 결과/배치/개인 자원/공용 잔량/방패 장착/포도/무역로/여관이 정상 시작 상태인지 함께 확인한다. 같은 시드로 만드는 3~4인 연습 공급의 사전 작성 규칙을 임의로 바꾸지 않았다.

실제 Android16/API36·WebView133 전용 에뮬레이터에서 기존 APK6→7 `install -r` 후 게임/Undo를 보존했다. 오프라인에서 ADB 버튼 터치로 2→3, 3→4, 4→2, 네 번째 새 게임을 만들었고 각 시드가 다르며 전체 상태가 엔진 factory와 일치했다. HOME/지연 없이 새 게임 표시 직후 `force-stop`하고 다시 열어 전체 상태/빈 Undo를 확인했다. 실제 시작 성 2개 확정→주사위→공급 타일 획득→앱 재실행→이전 행동 취소도 엔진 상태와 정확히 일치했다.

검사 중 실패는 자동 roll 이전 fixture와 이미 진행된 상태를 비교한 테스트, 이름 입력 뒤 IME가 늦게 열려 버튼 터치 좌표가 키보드로 이동한 ADB 검사, .next 디렉터리 EPERM으로 나눠 수정/재검했다. 게임 규칙을 완화하거나 필수 검사를 생략하지 않았다. 첫 APK 서명 도구는 시스템 Java8로 실행 실패했으나 기존 JDK21로 다시 검증해 기존 SHA256 `541b6d701dd3909426ed985b7f44f51b7c3142f615880dd3d805a57c08594917`과 일치했다.

## 결과물과 한계

- APK: `.local-data/android/apk/burgundy-expanded-0.1.6-7-debug.apk`, 앱ID/기존 Debug 키 유지. 이전 APK 1~6 보존.
- 로그/스크린샷: `.local-data/hotseat-reset/`; `device-result.json`, `browser-final2/`, `regression.log` 및 `screenshots/`.
- 최종 커밋을 넣은 APK의 225개 에셋/서명/설치 보존/강제 종료/원격 SHA: `apk-verification-final.json`, `final-install.json`, `backup-result.json`과 완료 보고 참조.
- 기존 dirty 문서 본문/수도원27·28/입력자료는 보존하며 관련 커밋에서 제외한다. before/ 문서 사본과 SHA256 검사로 확인한다.
- Render 배포/재시작/환경변수/Redis 조작 없음. 사용자 확인 AutoDeploy Off, render.yaml off와 release workflow의 `[no-deploy]` 조건 유지. 지정 커밋의 `[skip render]`는 [Render 공식 배포 차단 문구](https://render.com/docs/deploys#skipping-an-auto-deploy)다. 대시보드의 현재 설정을 새로 조회한 것은 아니다.
- 실물 휴대폰/다른 WebView는 미검증. 일반 행동의 비동기 저장 완료 **전** 즉시 강제 종료하면 마지막 미확정 행동은 유실될 수 있다. 새 게임은 저장 완료를 기다리며 별도로 검증했다. 새 APK 온라인은 호환 서버 SHA 검사로 같은 커밋 수동 배포 전 차단될 수 있다. 이번 작업에서는 운영에 배포하지 않는다.
