# 승인 방패 18종 적용 (2026-10-25)

## 입력과 보존

`burgundy_shield_assets_ready.zip`의 `public/shields/shield-01.png`~`shield-18.png`를 번호 그대로 연결했다. 원본 ZIP은 변경하지 않았다. ZIP에는 실제 알파가 없는 RGB 체크무늬 이미지가 들어 있었으며, 대부분1159×1358(일부1357), 3·4번은1043×1508이었다.

추출 원본은 로컬 `asset-inbox/shield-approved/originals/`에 보존한다. 배경 분리 도구로 두 외곽 계열을 확인하고 최종 그림의 RGB는 ZIP 원본에서만 가져왔다. 각 원본의 연결된 외부 체크무늬를 제거하고 내부 회색 동전/균열/석재를 보존한다. 외곽 마스크가 중앙 그림으로 들어오면 추출을 중단한다. 색이나 효과 그림을 다시 생성하지 않는다.

게임용18종은 `public/shields/`의 **1200×1480 RGBA PNG**다. 원본 불투명 영역을 같은1460px 높이 안에 등방성으로 맞추고 중앙에 배치해 최소10px 투명 여백을 둔다. 3·4번의 다른 비율도 유지한다. 원본에 합쳐진 자원 그림은 분리/재그림/덮어쓰지 않았으며, 승인 공통 자원 PNG를 추가로 겹치지 않는다.

`public/shields/manifest.json`에1~18 매핑, 원본/출력 SHA256, 원본 크기/경계 및 최종 그림 경계를 기록한다. `node scripts/prepare-shield-assets.mjs --check`는 로컬 승인 원본의 해시와 파생 재현을 확인한다. `--check` 없이 실행하면 같은 파일을 재생성한다. 승인 원본 해시가 달라지면 먼저 검수해야 한다. 배포에는 원본 ZIP/사적 입력 폴더가 필요하지 않다.

## 적용 범위와 크기

- `ShieldArt` 한 곳에서 PNG를 사용하므로 공용 공급/선택, 로컬·AI·온라인 영지 장착, 설명 도감, hover/터치 팝업이 같은 번호의 이미지를 사용한다. `ShieldDetails`에도 같은 PNG 확대 이미지를 추가했다.
- 원본 PNG에 인쇄된 점수12/8/4, 번호1~18, 효과 그림 위에는 기존 SVG 숫자/점수/자원/테두리를 중복하지 않는다. 회색 빈 슬롯/물음표는 기존 실루엣을 유지한다. PNG 로딩 실패 때만 원래 SVG를 복구하고 새로고침 후 PNG 복구도 검증한다.
- 기본 PNG 이미지 상자는52×64.1333 보드 단위, 성 위 장착 레이어만 **scale(1.18)**로61.36×75.6773이 된다. 성의 translate 중심과 소유/클릭 영역은 유지한다. 이전 SVG 외곽은48×63.5였으며 PNG의 투명 여백과 종류별 실제 종횡비 때문에 외곽 bbox를 그대로18% 늘리는 방식은 사용하지 않는다. 실제 불투명 그림 높이는 이전보다 약18% 크다.
- 공용 공급 방패에는1.18 배율을 적용하지 않는다. PNG 아래쪽 번호/그림을 가리지 않도록 일꾼 비용 배지만 기존 회색 구역의 위/아래 여백으로 이동한다. 반환 방패 페이지 버튼에는 첫 방패 비용을 두 번째 줄로 표시한다. 공급처 좌표·칸 수·회색 영역·점수 패널 크기는 유지한다.
- URL에 출력 SHA 앞12자를 붙여 새 아트로 캐시를 갱신한다. 이미지와 SVG 모두 원래 비율을 보존하며 일반 타일의 육각 clip을 방패에 강제하지 않는다.

## 변경 범위

`public/shields/`의18 PNG와 manifest, `src/app/shield-art.tsx`, `common-board.tsx`, `game-screen.css`, `scripts/prepare-shield-assets.mjs`, `validate-deployment-assets.py`, 방패/타일 브라우저 검사와 CI 모바일 목록, 진행 문서다. 회귀 검사 중 발견한 HTTP 종료 대기를 없애기 위해 `tests/browser/isolated-rooms.ts`에서 완료된 테스트의 연결만 닫는다. 게임 엔진/능력/점수/유지비/저장 스키마/온라인 인증/Redis 코드는 변경하지 않는다.

기존 미커밋 성·광산 이미지와 도구/문서, 수도원27·28 및 다른 원본 자료는 이번 커밋에서 제외한다. 기존 문서의 미커밋 부분도 분리해서 보존한다.

## 검사와 배포

- 18개 전체 번호/점수/그림은 `.local-data/shield-assets/preview-sheet.png`에서 대조했다. 전체 에셋 배포 검사는 기존62개를 유지하고 방패18개를 추가해80개를 검사한다.
- 초기 관련 검사23통과/3실패: 새 픽스처가 재로드 때2인 상태를 재설정한2건, 기존 모바일 설명 팝업 이름을 다른 창으로 찾은1건이다. 픽스처/선택자를 바로잡고 상태/설명/이미지 검증은 유지했다. 관련 PC·Chrome터치·WebKit27/27 통과 후, 비용 배지와 알파 경계 검증을 추가하여 전체 회귀 중이다.
- 최종 코어486/486·보드33/33·격리 HTTP/WSS/저장 재시작/Upstash REST 계약7/7, TypeScript·ESLint·프로덕션 빌드 통과. `validate-tile-assets.py`는 일러스트6/자원2 경고0, `validate-deployment-assets.py`는80 PNG, `prepare-shield-assets.mjs --check`는18종 모두 통과했다. ZIP→보존 원본→manifest의 SHA256도18종 일치한다.
- 전체PC176개는172통과/3모바일전용 제외/1 HTTP 정리 대기 시간 초과였다. 모든 상태 검증 후 발생한 정리 대기를 수정하고 같은 방 전환/포도 획득 검사를 PC·WebKit4/4로 재검증했다. 전체 모바일 추가 실행84개는76통과/4PC전용 제외/4실패였다. 실패 중 방 전환1개는 같은 정리 문제로 재검증 통과했고, 나머지3개는 기존 `tile-help.spec.ts`의 Chromium 전용 CDP 호출로 WebKit에서 실행 불가다. 이 파일은 기존 WebKit CI 대상에도 없으며 테스트를 삭제하거나 기준을 완화하지 않았다. Chrome 모바일40개는 모두 통과했다.
- 최종 방패 전용 PC1280×900·Chrome390×844·WebKit390×844 **9/9** 통과:18종 번호/파일/해시/알파, 모든 실제 불투명 픽셀의 성 내부 포함, 2·3·4인 장착1.18/중심/클릭/비용 분리,100/160/200% 확대, 상세 이미지, PNG 실패 복구, 전체 게임 상태 불변을 확인했다. PC/Chrome의 높이2400 캡처2개도 통과했다. 캡처용 긴 WebKit 화면의 상세 터치1건은 실패했지만 동일 검사가 일반844 높이에서는 통과했다. 실제 Android/iPhone 기기는 미검증이다.
- 직접 확인한 실제 게임 화면: `.local-data/shield-assets/screens/{before-after,pc-estate,mobile-estate,pc-common,pc-160,pc-200}.png`.18종 전체 비교는 `.local-data/shield-assets/preview-sheet.png`. 로그는 같은 폴더의 `browser-all-pc.log`, `browser-mobile.log`, `cleanup-check.log`, `final-shields.log` 등이다. 운영 배포 결과와 GitHub CI는 로컬 검사와 별도로 확인한다.
- 기존 Render 서비스와 Upstash를 사용한다. 운영 방/Redis/환경변수 초기화 또는 유료 리소스 생성은 하지 않는다. 로컬 검증 후 이번 변경만 main에 백업하고, 실제 배포 SHA·자산 해시·운영 화면을 확인하기 전에는 배포 성공으로 보고하지 않는다.

### GitHub CI 픽스처 보완

149eb25의 첫 CI40110925485는 에셋80개·코어486·보드33·린트·빌드·타입·배포 계약을 통과했으나 PC176개 중172통과/3대상제외/1픽스처 시간 초과로 중단했다. 실패 화면/trace에는 포도밭 테스트 상태 대신 기본 새 게임이 나타났다. `fifteen-online.spec.ts`가 초기화 중인 페이지의 localStorage를 바꾼 직후 reload하면서 이전 페이지의 자동 저장과 경합한 것이다. 테스트의 sessionStorage에 다음 픽스처를 보관하고 새 문서의 init script에서 React 초기화 전에 주입하도록 수정했다. 실제 이름 검증을 추가하고 기존 보드 번호/2·3·4인/가로 넘침/세로·가로 캡처 기준은 유지했다. 같은 검사를 PC/Chrome390/WebKit390에서 각각3회,9/9 통과했다. 운영 자동 저장 코드는 변경하지 않는다. 상세 로그 `ci-fixture.log` 및 CI 실패 원본 `.local-data/shield-assets/ci-results/`.
