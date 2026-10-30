# Android 포도 공급처 복구 (0.1.1 / versionCode 2)

## 원인과 변경 범위

기존 APK1의 Android16/WebView133 가로 화면은 CSS 866×364px이었다. 포도밭 확장은 활성화되어 있었고 공급대3개·상점1개, 연결 타일 SVG 및 모든 과일/사탕 PNG도 존재했다. `display:flex`/`visibility:visible`인데 공용행 너비822px, 내용 너비1200px, 공급처 시작 x862px/너비360px였다. 오른쪽으로 약378px 스크롤하면 원래 공급처가 나타났다. 페이즈/E종료/에셋 누락이 원인이 아니다.

웹의 760px 이하 줄바꿈 조건이 가로 휴대폰을 포함하지 못했다. Android 번들에만 들어가는 `mobile/native.css`에서 두 보드가 실제 폭에 맞춰 줄바꿈하도록 했다. 좁으면 공급처가 공용보드 다음 줄, 충분히 넓으면 오른쪽이다. 보드 내부 SVG 좌표/타일/공급처 버튼 크기·공급/획득/배치/빈칸 규칙과 웹 CSS는 그대로다. 정적 export의 CSS 순서에 의존하지 않도록 기존 상위 컨테이너로 선택자를 한정했다. 브라우저 검사도 native CSS를 앞에 삽입해 이 순서를 검증한다.

`mobile/version.json`은 0.1.1/code2다. 앱ID/기존 Debug 서명키/저장 origin은 유지한다. 기존 APK1은 삭제하지 않았다. 읽기 전용 운영 version 조회가 414d4d0을 반환해, 게임/서버/WS 코드가 이전 de11281과 동일한 것을 확인하고 onlineVersion을 그 SHA로 고정했다. 운영 서버에는 코드/설정/배포 변경을 하지 않는다.

## 이번 변경 파일

- `mobile/native.css`: Android 공용행 줄바꿈 및 보드 너비 제한.
- `mobile/version.json`: 버전코드/표시버전/검증된 온라인 대상.
- `tests/fixtures/android-vineyard.ts`: 실제 엔진의 A–E 공급/최종정산 상태를 재사용하는 테스트 픽스처.
- `tests/browser/android-vineyard.spec.ts`: 실제 CSS 순서, 모든 페이즈/배율/디자인/빈칸/화면폭, 획득·배치·보상·Undo·reload 및 온라인 두좌석 검사.
- `docs/ANDROID.md`, 이 문서, `docs/PROGRESS.md`, `docs/TODO.md`: 재현/업데이트/검증 기록. 이전 dirty 문서본문은 보존하고 이번 접두사만 커밋한다.

## 검증과 증거

- Android16/API36 전용 Pixel6 에뮬레이터/WebView133: A–E 및 종료 × 75/100/160/200% × 두 디자인 = 48조합, 공급대3/상점1 및 정확한 타일ID 일치. 빈칸4개도 유지.
- 실제 ADB 터치: 공급처 획득→개인 저장고→V01 미리보기(게임불변)→확정→시장 보상 직접획득·일꾼 보상→reload. 기존 엔진 판정/점수 테스트 유지.
- 200% 공용보드 실제 터치드래그로 scrollLeft 약241px, 내용1880px/뷰포트812px. 앱 force-stop 후 저장 전체 일치와 공급처 복원.
- 같은 게임 저장의 웹/Android 공급처를 실제 보이는 뷰포트 픽셀로 나눠 캡처·비교했다. 폭360/과일/빈칸/사탕 재고 일치. 캡처 시 떠있는 단계 안내만 비교용으로 static 처리하며 제품 소스는 바꾸지 않았다. 시스템 폰트/안티앨리어싱 차이는 남는다.
- core523/523, boards33/33, Android5/5, 배포안전7/7, TypeScript/전체 ESLint/웹 production build/Android static export/Debug APK build 통과. 신규 Playwright3/3 및 기존 포도밭·수동턴·폐기기록16/16 통과.
- APK1→2 `adb install -r`, 저장 전체 보존. 앱ID 동일, 인증서 SHA256 동일. APK 안 public225파일 모두 현재 로컬 원본과 바이트 일치.
- 기존 Render에서도 Android 네이티브HTTP+PC 두좌석의 참가/준비/시작 성/포도획득/동기화/Undo/주사위·일꾼/양쪽reload를 검증했다. 실시간 연결과 서버414d4d0을 확인했다. 새 QA방2개만 만들었으며 첫 검사 경합으로 중단된 방도 삭제하지 않았다. 기존 다른 방은 건드리지 않았다.
- 최종 웹 빌드의 신규 검사 중2개는 바로 통과했고 온라인1개는 기존 helper가 GET 이전 revision을 엄격히 기다려 실패했다. 새 테스트만 HTTP 준비/시작과 실제 저장/이미지/두화면 결과를 검증하도록 보완해15.9초에 통과했다. 기존 공통 helper/게임 코드는 수정하지 않았다.

증거는 `.local-data/android-vineyard-fix/`의 before/metrics.json, device-result.json(행렬48·획득/배치 결과), capture-restart.json, 각 테스트 로그 및 screenshots/에 있다. APK는 `.local-data/android/apk/burgundy-expanded-0.1.1-2-debug.apk`다. 최종 APK 해시/Commit/Push 결과는 backup-result.json과 완료보고에 기록한다. APK/도구/자격정보/운영방 파일은 Git에 포함하지 않는다.

## 한계와 안전

사용자 실물 휴대폰/다른 Android·WebView 버전은 직접 연결하지 못했다. 모든 배율·페이즈를 실제 사용자 방으로 재생하지 않았으며 보존된 엔진 상태를 가져와 화면과 공급ID를 검증했다. 이 작업은 확장 활성화가 안 된 게임에 공급처 데이터를 임의로 생성하지 않는다. 기존 저장/Redis/진행방 삭제·초기화, Render 배포/재시작/환경변수 변경은 하지 않는다.

검증 중 호스트 QEMU가 0xc0000005로 한 번 종료됐다. 에뮬레이터 재시작 후 GPU swiftshader/2048MB로 모든48조합을 마쳤다. 테스트의 이전 텍스트 보상 선택자·설정 가져오기 대기·중복 결과폴더 충돌은 QA 코드에서 바로잡았고 제품 오류로 숨기지 않았다.
