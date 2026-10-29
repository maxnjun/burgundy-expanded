# Android APK

## 구조와 데이터 보호

Capacitor 8로 기존 Next 화면을 패키징한다. `npm run android:web`는 원본 `src`와 `public`을 `.local-data/android/export-*`에 복사해 API 라우트만 제외하고 정적 export한다. 게임/AI/규칙/컴포넌트/CSS/SVG/PNG는 동일하다. 일반 `npm run build`와 서버 API는 변경하지 않는다. 원본 에셋, 게임방, Redis, Render 환경변수는 이 과정에서 변경하지 않는다.

- 앱 ID: `com.maxnjun.burgundyexpanded` (업데이트 시 유지).
- 이름: Burgundy Expanded. 아이콘과 시작 화면은 기존 `public/tiles/castle.png`를 재사용한다.
- 최소 Android 7.0/API 24, target/compile API 36. **Android System WebView 111 이상**이 필요하며 최신 버전을 권장한다. 구형 Android의 OS 지원 여부와 WebView 버전은 별개다.
- `sensorLandscape`로 가로 방향을 우선한다. Android 16의 큰 화면/멀티윈도에서는 OS가 방향 요청을 무시할 수 있다. 기존 반응형 UI는 유지한다.
- Capacitor의 native safe-area 처리와 CSS env padding을 사용한다. 확대/축소/스크롤/터치 판정은 기존 UI를 재사용한다.
- 시스템 뒤로 가기: 열린 native dialog 닫기 → 이전 화면 → 루트에서 종료 확인. 이 동작은 턴을 종료하지 않는다.

## 오프라인과 온라인

APK 안에 화면·게임 규칙·모든 public 에셋이 들어 있다. 기존 로컬/AI 모드는 인터넷 없이 실행한다. 보류 중인 별도 Android 핫시트 기능을 새로 만들지 않는다. 온라인만 인터넷이 필요하다.

`server.url`을 사용하지 않는다. `server.hostname`은 기존 Render 도메인과 일치하는 **APK 내부 에셋의 HTTPS origin**이다. 이 값은 저장소 origin과 WebSocket 출처 검사에 영향을 주므로 임의로 변경하지 않는다. 일반 Next 요청/이미지는 WebView 로컬 서버로, `/api/*`만 CapacitorHttp로 기존 HTTPS 서버에 전달한다. WebSocket은 기존 wss 연결과 인증/폴링 복구를 그대로 쓴다. 앱 복귀 시 기존 재동기화 이벤트를 발생시킨다. 서버 검증, 토큰, 요청ID, revision, timeout/replay 처리를 유지한다. 토큰을 URL이나 빌드 파일에 넣지 않는다.

`mobile/version.json`의 onlineVersion은 **호환 대상으로 빌드 시 고정한 운영 서버 SHA**다. APK의 코드 버전은 android-build.json의 sourceCommit과 versionName/versionCode로 구분한다. 서버 버전이 바뀌면 기존 버전 차단 정책에 따라 온라인 행동이 중단된다. 웹 새로고침으로 APK 코드가 업데이트되지는 않는다. 새 서버와 호환성을 검사한 APK를 다시 설치한다. 규칙 프로토콜이 다른 서버에 자동으로 버전 문자열을 맞춰 접속하지 않는다.

## 저장과 파일 이전

Android의 기본 SPA fallback이 `/online` 새로고침에 첫 화면을 돌려주는 문제는 `OfflineWebViewClient`에서 해결한다. 앱 내부의 알려진 화면 경로만 해당 번들 `index.html`로 연결하고, 실제 응답·브리지 삽입은 Capacitor에 위임한다. URL의 방 코드 query는 유지한다.

기존 JSON 자동 저장 및 Undo sidecar, 디자인1/안내 고정 설정, 온라인 자리·미확정 요청은 WebView의 앱 전용 localStorage에 보관한다. 자동 저장이 끝난 뒤 강제 종료/재시작해도 복원한다. 시스템 앱 데이터 지우기/앱 삭제는 저장을 삭제한다. Android 클라우드 백업은 자리 토큰 보호를 위해 끈다.

브라우저와 APK 저장소는 서로 다르다. 브라우저의 게임 준비 → 저장 파일 내보내기로 JSON을 저장하고 앱의 기존 파일 불러오기를 사용한다. 앱의 내보내기는 Android 공유 메뉴를 연다. 파일 앱/지원 앱을 선택해 별도로 보관한다. 파일 선택/공유 취소 시 자동 저장은 유지된다. 온라인 자리 토큰은 로컬 게임 JSON에 포함되지 않으며 브라우저 자리로 APK가 자동 이전되지 않는다. 기존 방의 다른 자리를 무단으로 차지하지 않는다.

## 빌드

관련 파일: `capacitor.config.ts`, `mobile/{runtime.tsx,transport.ts,native.css,version.json}`, `android/`(Gradle·Manifest·MainActivity·OfflineWebViewClient·앱 리소스·계측 검사), `scripts/android-{web,build,icons}.mjs`, `scripts/verify-android-apk.py`, `src/app/save-download.ts` 및 기존 `game-screen.tsx`의 내보내기 호출, `tests/android/transport.test.mjs`. package/lock, gitignore, ESLint, 기존 CI에는 필요한 의존성·산출물 제외·검사만 추가했다. 게임/서버/기존 이미지 코드는 변경하지 않았다.

현재 작업 PC에는 JDK21과 Android SDK/API36/에뮬레이터가 `.local-data/android/tools`에 설치돼 있다. 시스템 Java8 설정은 바꾸지 않는다. 다른 PC에서는 Android Studio 2025.2.1 이상(내장 JDK21), SDK platform36/build-tools36/platform-tools를 설치하고 JAVA_HOME/ANDROID_HOME을 지정한다. Node24/npm을 사용한다.

```powershell
npm ci
npm run test:android
npm run android:debug
```

이 명령은 Android 전용 정적 빌드 → `cap sync android` → Gradle assembleDebug를 수행한다. 결과는 `.local-data/android/apk/burgundy-expanded-<versionName>-<versionCode>-debug.apk`와 `android/app/build/outputs/apk/debug/app-debug.apk`다. APK/SDK/키/캐시/복사된 웹 산출물은 Git에 넣지 않는다. `android/`의 Gradle wrapper·manifest·Java·리소스와 Capacitor 설정은 추적한다.

기기에서 APK를 열어 해당 파일 앱의 '알 수 없는 앱 설치'를 허용하거나, USB 디버깅을 허용한 자기 기기에 `adb install -r <apk>`로 설치한다. Debug APK는 개발 테스트용이며 공개 배포용 서명본과 다르다.

## Release 서명

Android Studio의 Generate Signed Bundle/APK에서 **자기 소유 키**를 만들고 안전하게 백업한다. 또는 keytool로 별도 보안 위치에 키를 만든다. 비밀번호/키를 채팅·Git에 넣지 않는다. 로컬 보안 환경에서 다음 환경변수를 설정한다.

- BURGUNDY_KEYSTORE: 저장소 밖 키의 절대경로
- BURGUNDY_KEYSTORE_PASSWORD, BURGUNDY_KEY_ALIAS, BURGUNDY_KEY_PASSWORD

그 뒤 `npm run android:release`. 키가 없으면 서명 없는 산출물을 성공으로 표시하지 않고 명령이 중단된다. 이번 작업에서는 배포용 개인 키를 새로 만들거나 공개하지 않는다. Debug 키는 Gradle의 사용자 `.android/debug.keystore`에 생성되며 같은 설치본을 업데이트하려면 이 키도 유지해야 한다. Debug→다른 키의 Release로는 덮어쓰기 설치가 불가능하므로 먼저 JSON을 내보낸 뒤 별도로 전환한다.

## 업데이트

1. 웹 코드 수정 및 검증. Render 배포는 사용자가 별도로 결정한다.
2. Android와 연결할 서버가 호환되는지 확인하고 공개 `/api/version`의 SHA를 mobile/version.json의 onlineVersion에 기록한다.
3. 같은 파일의 versionCode를 반드시 증가시키고 versionName을 갱신한다.
4. `npm run android:debug` 또는 보안 서명 환경의 `npm run android:release`.
5. 같은 앱 ID와 같은 키로 `adb install -r` 또는 APK 업데이트 설치. 앱 데이터를 지우지 않는다.

자동 업데이트/별도 유료 서비스/Render 배포 기능은 추가하지 않는다. GitHub 백업에는 `[skip render] [no-deploy]`를 사용해 기존 CI 배포를 차단한다. 사용자 확인 Auto-Deploy Off와 render.yaml Off를 유지한다.

## 검증 결과

2026-10-30, 전용 Pixel 6 프로필 Android16/API36 에뮬레이터(2400×1080 가로, WebView133.0.6943.137)에서 설치/실행했다. 실제 휴대폰은 연결되어 있지 않았다.

- core523/523, boards33/33, Android 통신/설정5/5, 배포차단7/7, TypeScript/ESLint/웹 프로덕션 빌드 통과.
- 기존 Playwright PC13/13·모바일6/6: 저장 파일 내보내기/불러오기, 기록, Undo/수동 턴 종료, 온라인, 포도밭/무역로 회귀 확인.
- Android 실제 터치: 주사위/일꾼·이전 행동·새 턴 전체 Undo·수동 종료, 공급 타일→저장고→영지 배치와 실제 점수, 포도 획득/180도 미리보기(상태 불변)/배치 확정/확대/새로고침 확인.
- 오프라인 확장 저장 불러오기·이미지·디자인OFF/ON·설정 유지·페이즈 폐기 기록·JSON 파일 공유/불러오기 확인. 기존 JSON만 가져올 때 턴 시작 sidecar가 없으면 다음 턴부터 전체 되돌리기가 제공되는 기존 제한은 유지한다.
- 기존 Render에서 새 QA 방 1개만 생성해 Android+PC 참가/준비/시작 성/주사위/동기화/Undo/양쪽 새로고침 확인. 실시간 WSS 연결 및 앱 강제 종료 후 같은 자리 복원을 확인했다. 기존 방/Redis 키 삭제·초기화·배포는 하지 않았다.
- 앱 계측 검사2/2: 실제 설치 앱 ID, 가로 방향, 백업 금지, 오프라인 HTML/에셋. `:app:connectedDebugAndroidTest` 태스크 통과. 루트의 전체 `connectedDebugAndroidTest`는 사용하지 않는 Cordova 템플릿 테스트의 Kotlin 의존성 중복으로 실패했으나 앱 테스트2개는 통과했다. 앱 대상 태스크를 사용한다. **Gradle 계측 도구는 검사 후 앱을 제거하므로 전용 테스트 에뮬레이터에서만 실행한다.**
- APK 서명 검증, 최소SDK24/target36, 번들 public225개 바이트 일치 확인. `python scripts/verify-android-apk.py <apk>`로 다시 검사할 수 있다.

실제 웹/Android의 동일 저장 게임 공용/개인/포도밭/무역로를 캡처하고 보드 너비·24개 보상·점수가 일치함을 확인했다. 긴 WebView 캡처는 화면 밖 영역을 잘못 반복하므로 실제 보이는 화면을 스크롤하며 연결했고, 비교 중에만 떠 있는 단계 안내를 static 처리했다. 원본 게임 UI에는 적용하지 않았다. 기기 시스템 글꼴/픽셀 밀도/안티앨리어싱 차이는 남는다.

최종 로그·APK·화면: `.local-data/android/`. `screenshots/web-android-estate-comparison.png`, `web-android-vineyard-comparison.png`, `android-online-controls.png`, `android-vine-preview.png`, `android-vine-placed.png`, `android-discarded.png`, `android-export-sheet.png`. 진행 및 미검증 항목은 `docs/PROGRESS.md`를 참조한다. 모든 확장 조합을 실제 휴대폰에서 끝까지 플레이한 것으로 주장하지 않는다.

Android 가져오기는 WebView 파일 입력·파싱(자동화 파일 주입), 내보내기는 실제 공유창 열기까지 확인했다. 특정 제조사 파일 앱에서 직접 선택·최종 저장하는 과정은 실기기에서 추가 확인해야 한다.

공식 참고: [Capacitor 환경](https://capacitorjs.com/docs/getting-started/environment-setup), [네이티브 HTTP](https://capacitorjs.com/docs/apis/http), [App lifecycle](https://capacitorjs.com/docs/apis/app).
