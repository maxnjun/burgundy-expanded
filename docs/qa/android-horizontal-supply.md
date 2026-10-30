# Android 공용보드·포도 공급처 가로 스크롤 — 0.1.2/code3

## 원인과 구조

0.1.1은 포도 공급처가 화면 밖에 숨는 문제를 줄바꿈으로 해결했지만 공용보드 아래에 놓여 탐색이 불편했다. 이번에는 기존 두 패널과 공통 컨테이너를 재사용하고 Android 번들 전용 `mobile/native.css`에서 가로 한 줄로 고정했다. 공급처를 SVG 안에 넣거나 보드 좌표를 바꾸지 않았다.

- 공통 행: `display:flex; flex-direction:row; flex-wrap:nowrap; overflow-x:auto`, 얇은 스크롤바, `pan-x pan-y pinch-zoom`.
- 공용보드 왼쪽: 축소0, 기존 최대950px 및 가용 화면 너비를 유지. 내부 SVG의 기존 배율과 스크롤/명시적 드래그는 그대로다.
- 공급처 오른쪽: 축소0, 로컬360px/온라인300px 유지. 그보다 작은 화면에서만 가용 폭으로 제한한다. 간격은 기존 로컬18/온라인12px 그대로다.
- 내부 확대 보드의 기존 `overscroll-behavior-x:contain`을 Android에서만 auto로 바꾸고 바깥 행을 contain으로 두어 페이지 전체의 가로 이동을 막았다. WebView는 확대 그림의 내부 스크롤을 우선하며 내부 끝에서 부모로 즉시 전달하는 동작은 확인되지 않았다. 두 패널 사이 이동에는 보드 상단 단계 안내 줄을 사용하며 이 줄에서 실제 양방향 이동을 검증했다. 내부 탐색/명시적 드래그를 외부 이동으로 대체하지 않았다.
- 세로 높이를 제한하거나 overflow-y:hidden을 추가하지 않았다. 공급처 하단의 상점·사탕도 기존 세로 페이지 탐색으로 확인한다.

웹 CSS/컴포넌트/게임 엔진/온라인 서버/저장 형식/이미지/육각 좌표/타일 크기는 변경하지 않았다. 새 이벤트 처리나 의존성을 추가하지 않고 WebView의 네이티브 스크롤·pointer cancellation을 사용한다.

## 변경 파일

`mobile/native.css`, `mobile/version.json`, `tests/browser/android-vineyard.spec.ts`, `docs/ANDROID.md`, 이 문서, `docs/PROGRESS.md`, `docs/TODO.md`. 기존 dirty 문서 본문/수도원27·28/입력자료는 보존하고 이번 변경만 선별한다.

## 실제 검증

- Android16/WebView133 전용 에뮬레이터 가로866×364 CSS px: A–E 및 종료 × 75/100/160/200% × 디자인 OFF/ON = 48조합. 줄바꿈0, 두 패널 겹침0, 공급/상점의 실제 ID와 빈칸 일치, 실제 ADB 스와이프로 오른쪽 끝 도달.
- 행동 주사위를 선택한 상태에서 실제 과일 위 양방향 스와이프: 게임 상태 변화0·오구매0·주사위 선택 유지. 실제 터치 획득→보관 타일 선택→컨테이너 스크롤 후 선택 유지→미리보기/배치 확정→기존 보상→reload 확인.
- 확대/축소 실제 버튼75→100→75, 200% 명시적 보드 드래그 약237px, 세로 탐색으로 공급처 전체 확인. Android 네이티브 뷰 영역은 [128,63]–[2400,1017]로 상태/내비게이션 바 바깥에 있다. force-stop/relaunch 후 저장 전체 일치.
- 기존에 만든 본인 QA방을 재사용해 실제 Render에서 Android+PC 포도획득/상대동기화/Undo/양쪽reload 확인. 새 방은 만들지 않았고 기존 방/Redis를 삭제·초기화하지 않았다. 로컬2인 및 기존2~4인 인간 턴/Undo 회귀도 확인했다. 별도 신규 핫시트 모드를 만든 것은 아니다.
- core523/523, boards33/33, Android5/5, 배포안전7/7, 타입/전체린트/웹 production build/Android static export/DebugAPK 빌드 통과. 브라우저는 공용보드·수동턴 포함15/15 및 최종 공급처3/3 통과(공급처3개는 재실행 포함). 실제 터치 검사는 게임 결과까지 비교한다.

## 스크린샷과 APK

`.local-data/android-horizontal/screenshots/android-common-board-device.png`는 공용보드 화면, `android-vineyard-supply-device.png`는 실제 스와이프로 오른쪽 공급처를 연 화면이다. 두 장은 ADB의 실제 화면 PNG이며 시스템 바도 포함한다. `android-supply-full.png`는 화면에 보이는 부분을 세로로 캡처·연결해 상점과 남은 사탕까지 보여 준다. 화면 밖 WebView 캡처는 사용하지 않았다. 기존 게임의 저장 완료 알림은 캡처에도 그대로 보존했다.

새 APK: `.local-data/android/apk/burgundy-expanded-0.1.2-3-debug.apk`. 앱ID/서명키/origin 유지, versionCode2→3. 기존 APK1/2 보존. 업데이트 설치 후 게임/Undo/자리 인증을 비교한다. 최종 SHA/서명/225개 에셋 검사·커밋/Push 결과는 `.local-data/android-horizontal/backup-result.json` 및 완료보고를 참조한다.

## 한계와 재현 메모

사용자 실물 휴대폰/다른 Android·WebView 버전은 미검증이다. 48조합은 엔진으로 공급/정산을 진행한 상태를 가져와 렌더링과 실제 스와이프를 검사했으며, 매번 새 게임을25라운드 완주한 것은 아니다. 브라우저 확대/폰트/안티앨리어싱 차이는 그대로다.

검증 중 Windows의 QEMU/SwiftShader 프로세스가0xc0000005로 종료돼 체크포인트44개부터 호스트 GPU로 재개하여48개를 마쳤다. 초기 에뮬레이터 System UI ANR은 Wait로 복원했다. 접근성 덤프 null root는 Android 실제 native view hierarchy로 좌표를 측정해 해결했다. 한 번의 스와이프가 항상 양 끝까지 이동한다고 가정했던 QA와 저장 가져오기 완료 전 설정을 열던 QA도 수정했다. 제품 코드에서 오류를 숨기거나 규칙을 완화하지 않았다.

Render Auto-Deploy Off 사용자 확인·기존 render.yaml Off·release workflow의 no-deploy 차단 유지. 지정 커밋 메시지에 `[skip render] [no-deploy]`를 넣고 일반 GitHub Push만 수행한다. Render 배포/API 배포/재시작/환경변수 변경은 실행하지 않는다.
