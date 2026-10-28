# 메뉴 누락 재조사 및 main 반영 (2026-10-29)

사용자 스크린샷은 Render 수동 배포 버전이다. 실제 운영 health 및 원격 main은 `12e773f`, 디자인 기능은 별도 브랜치의 `89bfa27`에 있었다. PC·모바일의 새 운영 브라우저에서도 설정의 안내 체크박스1개/디자인 스위치0개를 재현했다. 현재 로컬 코드에는 두 게임 설정 메뉴 모두 토글이 이미 있으므로 중복 위젯을 추가하지 않는다.

사용자가 이번에 Render Auto-Deploy **Off**를 다시 확인했다. 따라서 디자인 기능을 포함한 기존 커밋과 새 메뉴 회귀 검사를 main에 일반 fast-forward Push한다. `[skip render] [no-deploy]`를 유지하고 기존 CI/release의 배포 조건도 확인했다. Render 설정/배포/재시작은 변경하지 않는다. **이번 main 반영만으로 현재 운영 화면이 바뀌지는 않는다. Render는 사용자의 별도 수동 배포 전까지 구버전 메뉴를 표시한다.**

새 검사는 방에 참가하기 전 실제 온라인 설정 메뉴를 열어 디자인 스위치가 정확히1개 보이는지, OFF/ON과 기존 안내 설정/다음접속/PC·모바일 경계가 유지되는지 확인한다. 게임 중 전환·배치·Undo·두 브라우저 독립 검사도 재실행한다. 결과/스크린샷은 `.local-data/design-menu-visible/` 및 최신 PROGRESS에 보관한다. 이번검사는3엔진12/12·좁은375px1/1, core515/boards33·타입/린트/빌드 통과. 이번변경파일은 `tests/browser/design-settings.spec.ts`, `.github/workflows/ci.yml`(두모바일검사목록 등록), 이문서 및 PROGRESS/TODO다. 런타임토글 코드는 이미정상이므로 재작성하지 않았다.

--- 아래는 기존 구현 및 검증 기록 ---

# 디자인 1 ON/OFF 및 안전 백업 (2026-10-28)

## 사용 방법과 상태

- 로컬: **게임 준비 → 디자인 1**. 온라인: **게임 설정 → 디자인 1**.
- 최초 OFF: 기존 단색 육각형/아이보리 주사위/기본 배경/기존 포도밭 색상, 기존 공용 SVG 섬유 패턴과 밝은 격자 선을 사용한다.
- ON: 이전 시범의 영지6지형/지형색 주사위/포도밭4층 색상과 질감/양피지/지도/목재/패널 질감. 이전 에셋16장과 지도 SVG를 그대로 보존한다.
- 전환은 새로고침 없이 적용된다. `burgundy-expanded:design-1-v1` localStorage 값 `on`/`off`만 저장한다. 값이 없거나 알 수 없는 값이면 OFF다. 저장소 접근이 불가능하면 현재 화면 전환은 유지하지만 다음 접속의 설정 저장은 보장하지 않는다.
- 브라우저별 화면 설정이다. 서버로 전송하거나 게임 저장/스키마/리플레이/방 revision에 넣지 않는다. 온라인 상대방의 설정과 독립적이다. 실제 주사위 색상, 클릭 좌표, 점수, Undo 및 배치 미리보기 상태는 바꾸지 않는다.

## 구현

`src/app/design-settings.tsx`의 공통 Provider가 로컬·온라인과 body 팝업을 감싼다. CSS는 `html[data-design-1="on"]` 아래에서만 적용한다. `:where`로 기존 CSS 우선순위를 유지한다. 빈칸 렌더러/격자/SVG 배경은 같은 Context를 읽으며 OFF에서 원래 렌더링으로 돌아간다. CSS로 그림만 가린 채 주사위 색상이나 외곽선을 남겨 두지 않는다.

관련 파일:

- `src/app/design-settings.tsx`, `layout.tsx`, `board-surfaces.tsx`, `board-surfaces.css`
- `src/app/game-screen.tsx`, `online/room-screen.tsx`, `game-screen.css`
- `src/app/estate-tile.tsx`, `common-board-backdrop.tsx`, `white-die.tsx`, `vineyard-board.tsx`
- 이전 시범의 `public/assets/textures/`, `scripts/prepare-board-textures.mjs`
- `tests/browser/design-settings.spec.ts`, `board-surfaces.spec.ts`, `estate-bonuses.spec.ts`
- `docs/PROGRESS.md`, `docs/TODO.md`, `docs/qa/board-surfaces-preview.md`, 이 문서

게임 엔진·서버·실제 게임 이미지·보상 시스템·온라인 저장 포맷은 변경하지 않았다. 기존 dirty 수도원27/28 PNG와 입력자료는 이번 백업에서 제외한다. 과거 작업과 섞인 문서는 이번 접두사만 선별한다.

## 검증

증거는 제외 폴더 `.local-data/design-1/`에 저장한다. 최종 수치와 백업 SHA는 PROGRESS 및 Git 기록에 남긴다.

- PC1280·Chrome 터치390·iPhone WebKit: 기본 OFF, 모든 표면 즉시 전환, OFF 완전 복원, localStorage/새로고침, 선택한 실제 주사위 유지, 실제 자원 획득·Undo.
- 실제 포도 획득 → 배치 미리보기 → OFF/ON → 180도 회전 → 확정 → 새로고침 → Undo. 미리보기 동안 자원/점수/토큰을 변경하지 않는다.
- 격리된 실제 HTTP 서버와 두 브라우저: 한쪽 ON/상대 OFF, 재접속, 반대로 전환, 서버 게임 상태/revision 불변.
- 기존 공용보드/방패/프레임/상품·무역로/점수/포도밭/온라인 회귀, 코어·보드·타입·린트·프로덕션 빌드 및 질감 재현 검사.
- 최초 새 테스트의 reload 검사는 초기 화면을 너무 일찍 읽었다. 저장 game revision 준비를 기다리도록 수정했으며, 복원/상태 일치 기준은 유지했다.

전체 PC 회귀에서 기존 보상 가림 검사의 브라우저 재페인트 차이를 발견했다. 반투명 배경에서는 최대2 RGB, 배경을 단색으로 고정해도 첫 PNG 가장자리에 최대1 RGB 차이가 남았다. 실제 DOM의 타일 그룹을 복제하고 동일 PNG를 인라인하여 브라우저 SVG/Canvas에서 비교하도록 검사만 보완했다. 픽셀 허용 오차0/완전 일치를 유지하며, 첫 타일을 반투명하게 하면 아래 타일 노출을 반드시 검출하는 음성 대조도 추가했다. 실제 게임 100/160/200% 스크린샷/배치 경계 검사는 그대로 유지한다. 게임 아트나 렌더링을 바꿔 테스트를 숨기지 않았다.

실제 Android/iPhone 기기·운영 Redis 플레이는 이번 검사 범위가 아니다. 온라인 검사는 운영 방과 분리된 로컬 파일 저장소/실제 서버 핸들러를 사용한다.

## GitHub 및 배포 방지

사용자의 후속 승인으로 이전 질감 시범과 토글을 함께 백업한다. 이전 문서의 시범 당시 Commit 금지는 이번 관련 백업에 한해 갱신되었다.

- 기존 저장소 `maxnjun/burgundy-expanded`는 현재 **public**이다. 같은 대화에서 허용된 기존 공개 저장소 Push 범위를 유지하며 공개 설정은 변경하지 않는다.
- Render 대시보드의 실제 Auto-Deploy를 조회할 인증이 없으므로 **운영 main에는 Push하지 않는다**. 새 `codex/design-1-toggle` 브랜치에만 일반 Push한다. PR은 만들지 않는다.
- 기존 CI는 main Push/PR만 자동 실행하며, release는 main의 CI 완료 또는 명시적 수동 승인만 대상으로 한다. 관련 설정은 수정하지 않는다.
- 커밋에는 추가로 `[skip render] [no-deploy]`를 넣는다. Render Deploy/API/재시작/환경변수·자동배포 설정 변경은 실행하지 않는다.
- 전후 `/api/health`의 버전과 원격 main SHA를 읽어 운영 버전 불변을 확인한다. 이는 Render 대시보드 설정을 직접 조회했다는 뜻이 아니다.

운영 적용은 이번 범위 밖이다. main 반영이나 Render 수동 배포는 사용자의 별도 요청이 있어야 한다. 디자인만 끄려면 설정의 OFF를 사용하며 코드/이미지를 삭제할 필요가 없다. 시작 원본은 `.local-data/design-1/before/`, 질감 제작 전 기본 원본은 `.local-data/texture-preview/before/`에 보존한다.

## 최종 로컬 검사

코어515/515·보드33/33·타입·전체린트·프로덕션 빌드·질감/기존에셋 검증 통과. 최종 신규/표면3엔진15/15, 기존관련PC28/28. 전체PC210개는205통과·모바일전용3제외·초기가림2실패였고, 보완된 가림검사3종×2회가6/6 통과하여 실행대상207개를 검증했다. 모바일 별도 실행대상10개도 모두 통과했다. 원래 실패 로그와 최종 재검 로그를 모두 보존한다.

캡처: `.local-data/design-1/settings-desktop-1280.png`, `settings-mobile-390.png`, `design-on-desktop-1280.png`, `design-off-desktop-1280.png` 및 WebKit 동등 캡처. GitHub 새 CI 통과나 Render 대시보드 확인을 주장하지 않는다.
