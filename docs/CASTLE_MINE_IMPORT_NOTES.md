# 성·광산 GitHub 백업 대상 (2026-10-25)

- 사용자 승인으로 로컬 수정본4PNG+manifest를 main에 백업한다. 그림/정렬/게임 코드는 다시 만들거나 수정하지 않는다.
- 새 환경에서 재현할 수 있도록 승인 원본2개·마스크2개·입력 manifest와 import 스크립트도 포함한다. 교체 전 이미지 세트는 로컬 백업과 이전 Git 커밋 e2d5604의 5개 경로에 보존되어 있어 중복 PNG를 추가하지 않는다.
- 이번 검사: import --check의 모든 바이트 일치/RGB 차이0, Node 문법 검사, 일러스트6/아이콘2 경고0 및 배포 PNG80 통과. 전체 게임 회귀·빌드는 이번 백업에서 다시 실행하지 않았으며 동일 자산/렌더러의 이전 검증은 아래 기록을 참고한다.
- Render 서비스 현재 Auto-Deploy 설정은 직접 조회할 인증이 없다. [skip render] [no-deploy] 커밋으로 자동 배포를 제외한다. 배포·재시작·Computer Use·환경변수/Redis 변경은 하지 않는다.
- 체크포인트: .local-data/castle-mine-push-hzSSUO/. 커밋/Push 결과는 Git 이력과 최종 보고에서 확인한다.

--- 최초 로컬 교체 기록 보존 ---

# 승인 성·광산 이미지 교체 (2026-10-24, 로컬 검증)

- 입력: 사용자가 제공한 `castle-new.png`, `mine-new.png`(각 1254×1254 RGB). 체크무늬는 실제 배경 픽셀이었고 알파 채널은 없었다.
- 새 원본 보존: `asset-inbox/castle-mine-approved/originals/`. 입력 원본을 다시 그리지 않는다. 배경 분리 도구 결과에서는 알파 마스크만 사용하고, 최종 RGB는 사용자 입력 PNG에서 직접 복사한다.
- 교체 전 백업: `asset-inbox/castle-mine-approved/backups/before-2026-10-24/` 아래의 기존 `public/tiles/{castle,mine}.png`, `public/tiles/illustrations/{castle,mine}.png`, `manifest.json` 5개 파일. 최초 파일을 덮어쓰지 않는다.
- 교체 경로: `public/tiles/{castle,mine}.png`는 1254×1254 RGBA 투명 원본 파생, **실제 렌더링**은 `public/tiles/illustrations/{castle,mine}.png`의 1024×1024 RGBA 파생이다. 기존 URL과 데이터 타입을 유지한다.
- 새 원본의 테두리 안쪽을 각각 다시 측정했다. 새 그림에 옛 마스크를 적용하지 않는다. 내부의 성·광산·깃발·바위·수레는 보존하고, 공통 SVG 프레임과 겹치는 원본 테두리는 게임용 파생에서만 분리한다. 원본색에서 공통 프레임 팔레트를 추출한다.
- 기존 등방성 지지함수 fitting, 1024 캔버스와 inset 2.2를 그대로 사용한다. 런타임 scale/translate 예외, viewBox/영지 좌표/클릭 영역/엔진/AI/저장/온라인 코드 변경은 없다.
- `TileArt`를 공유하는 공용 번호/검은 공급처, 개인 보관함, 영지, 미리보기, 온라인 및 설명 UI가 같은 파생을 사용한다. `illustrations/manifest.json`의 해시를 갱신해 기존 캐시 쿼리도 갱신한다. 오래된 `public/tiles/estate/` 파일은 현재 참조되지 않아 유지한다.
- 재생성: `node scripts/import-castle-mine.mjs`. 읽기 전용 검증: `node scripts/import-castle-mine.mjs --check`. 승인 원본/마스크 해시가 달라지거나 외부 배경 제거가 내부 그림에 들어오면 저장 전에 중단한다. 기존 `extract-tile-illustrations.py`는 옛 원본 해시를 요구하므로 이번 교체를 재생성하는 용도로 사용하지 않는다.

## 검증

- 변경 전과 변경 후 `scripts/validate-tile-assets.py`: 전체 일러스트6/자원2, 경고0. `scripts/validate-deployment-assets.py`: 62 PNG 통과.
- 두 원본 파생의 모든 보이는 픽셀 RGB와 사용자 입력 RGB 차이0. 게임용 두 파생은 같은 1024 캔버스와 안쪽 hex 경계에 정렬한다. 검증 보고/실제 화면은 `.local-data/castle-mine-import/`에 보관한다.
- 이번 실행: 코어486/486, 보드33/33, TypeScript·전체 ESLint·프로덕션 빌드 통과. 관련 PC/Chrome터치 브라우저33통과·기기별 비대상5제외, 큰 화면의 깨끗한 캡처1통과(합계34통과). 기존 테스트 삭제/검증 완화 없음.
- PC/모바일 실제 공용 보드·보관함·영지·설명/온라인 공통 UI에서 PNG 로딩·새 해시·fallback·클릭/저장 상태 불변을 확인했다. 100/160/200% 공유 변의 배경 노출0픽셀, 안쪽 hex 경계 초과0. 안티앨리어싱은 기존1px 허용 기준을 유지한다.
- 직접 확인한 화면: `.local-data/castle-mine-import/screens/before-after-storage.png`, `game-common-after.png`, `game-estate-after-{100,160,200}.png`. 전체 보드 캡처만 높이2400px를 사용해 기존 sticky 행동 바가 사진의 타일을 가리지 않도록 했고 UI는 숨기거나 변경하지 않았다.
- 보존 확인: 백업 PNG4개의 SHA가 변경 전 HEAD와 일치, 백업 manifest는 Git CRLF 변환을 제외한 내용 동일. 첨부 원본2개·다른 타일 메타데이터 및 기존 미커밋 파일 보존. 실제 Android/iPhone 기기 검증은 하지 않았다.
- 사용자 요청에 따라 이번 변경은 로컬에만 보존한다. GitHub Push·Render 배포·운영 방/Redis/환경변수 변경 없음.
