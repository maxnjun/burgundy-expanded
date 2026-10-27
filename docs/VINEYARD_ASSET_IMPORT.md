# 승인 과일·사탕 에셋 적용 (2026-10-27)

승인된 단일 이미지에서 그림을 그대로 분리했다. AI 생성, 다시 그리기, 색상 변경, 원본 덮어쓰기는 하지 않았다.

## 입력·백업

- 승인 원본: `asset-inbox/vineyard-approved/originals/vineyard-fruit-candy-approved.png` (RGB 1536×1024)
- SHA256: `59ecbcdfb77883c560f51930df134c8c2afb7365045848042f1712bda619ee8d`
- 추출 영역·배경 판정·매핑: `asset-inbox/vineyard-approved/manifest.json`
- 기존 토큰 SVG 6개: `asset-inbox/vineyard-approved/backups/`. 기존 `public/assets/tokens/grape/`도 그대로 보존했다. 이전 SVG 포도 그림은 기준 커밋 `f9a3f11`에 보존되어 있다.

## 매핑·출력

출력은 모두 `public/assets/vineyards/`에 있다. 기존 상태 ID, 51장 조합, 제외 품종, 토큰 수, 점수 계산은 변경하지 않았다. 화면 표시 이름만 분리했다.

|저장 ID|이전 색상|새 표시|과일 PNG (768×768)|사탕 PNG (512×512)|
|---|---|---|---|---|
|Y|노랑|패션후르츠|vineyard-passionfruit.png|candy-passionfruit.png|
|G|연두|샤인머스켓|vineyard-shine-muscat.png|candy-shine-muscat.png|
|O|주황|귤|vineyard-mandarin.png|candy-mandarin.png|
|B|파랑|블루베리|vineyard-blueberry.png|candy-blueberry.png|
|R|자홍|복숭아 (분홍)|vineyard-peach.png|candy-peach.png|
|K|검정|딸기 (빨강)|vineyard-strawberry.png|candy-strawberry.png|

기존 다섯 색상과 가장 가까운 색을 유지하고, 남는 K를 새 빨강에 연결했다. 엔진의 기존 색상 이름도 보존하여 구형 필수 선택 메뉴의 검증/저장 데이터에 영향을 주지 않는다. UI가 사용하는 이름·경로·버전은 별도 공통 매니페스트에서 읽는다.

## 추출·정렬

- RGB 원본이므로 배경은 실제 픽셀이다. 각 그림의 바깥 가장자리에서만 밝은 중성 배경을 flood fill하여 알파 0으로 바꿨다. 닫힌 윤곽 내부의 베이지 바닥·하이라이트·그림은 유지한다.
- 리사이즈 전 모든 원본 RGB 바이트가 동일함을 검사한다. 승인된 검은/갈색 테두리와 얇은 포장도 보존한다.
- 알파 경계로 잘라 과일은 높이 720px, 사탕은 너비 480px로 등비 리사이즈하고 정사각 캔버스 중앙에 배치한다. 각각 위아래 24px/좌우 16px 기준 여백이다. 반대 축은 원본 비율을 따른다.
- 런타임의 6과일은 **하나의 공통 fit**을 사용한다. 기존 100×57 이중 타일 viewBox, 공급처 140×79.8px, 24칸의 좌표·클릭 다각형을 변경하지 않았다. 승인 그림의 자연스러운 육각 비율을 억지로 늘이지 않는다.
- PNG 자체 테두리만 사용한다. 차지한 칸과 미리보기의 기존 SVG 채움/테두리는 제거하고, 빈칸과 기존 4층 경계/흰 측면은 유지한다. SVG 이미지에는 pointer-events를 끄고 원래 칸 다각형으로 클릭을 판정한다.
- 과일 그림에는 문자·주사위·종류 텍스트를 겹치지 않는다. 빈 배치 칸과 공급 타일 바깥의 주사위 요구값은 유지한다.
- 공급 사탕의 실제 불투명 너비는 과일 한 칸의 약 50%다. 개인 보유 사탕은 보드 폭에 반응하며 최소 16px로 보장한다. 아주 좁은 화면에서는 가독성 최소값이 비율보다 우선하지만 과일 한 칸보다는 작게 유지한다. 점수표는 기존 행 안에 22px 아이콘을 사용한다.
- SHA 접미사를 이미지 URL에 포함해 기존 브라우저 캐시와 구분한다.

## 재현·검증

```text
python scripts/prepare-vineyard-assets.py --check
python scripts/validate-deployment-assets.py
npx playwright test tests/browser/vineyard-assets.spec.ts --project=desktop-1280 --project=mobile-390 --project=iphone-webkit
```

`--check`는 원본 해시, 매핑, 12개 RGBA 규격, 알파 경계, 투명한 모서리, 재현한 픽셀의 완전 일치를 검사한다. PNG 압축 바이트 차이와 실제 픽셀 차이를 구분한다. 결과를 재생성하려면 `--check`를 빼지만, 승인 원본 해시가 달라지면 먼저 중단한다. 원본을 덮어쓰지 않는다.

실행 결과·PC/모바일 실제 게임 화면은 `.local-data/vineyard-art-6ODuhn/`에 보관한다. 새 브라우저 검사는 100/160/200%, 여섯 과일/사탕, 크기 비율, 회전/확정 전 무보상, 배치/Undo/불러오기, 실제 토큰/점수, 격리된 두 좌석의 서버 동기화와 인증 재접속을 검증한다. 기존 무료 배치/점수/포도 관련 검사를 함께 유지한다.

운영 Redis/게임방/환경변수에는 쓰지 않았다. Render 배포·재시작·설정 변경은 하지 않는다. 실제 기기와 외부망/운영 Redis 시험은 이번 로컬 브라우저 검증과 구분한다.

## 적용 파일

- `src/app/vineyard-art.tsx`: 공통 과일/사탕 경로·표시 이름·등비 SVG 렌더러.
- `src/app/vineyard-board.tsx`, `vineyards.css`: 개인 배치/미리보기, 공용 공급/상점, 보유/공급 토큰. 같은 `VineTile`을 쓰는 개인 저장고·도감·기록에도 자동 적용한다.
- `src/app/reward-art.tsx`, `score-pages.tsx`, `score-pages.css`: 선택 보상·점수표 사탕 PNG.
- `src/app/game-screen.tsx`, `online/room-screen.tsx`: 로컬/온라인 설정의 UI 전용 과일 이름.
- `scripts/prepare-vineyard-assets.py`, `validate-deployment-assets.py`: 정확한 추출 재현 및 배포 PNG 검사.
- `tests/browser/vineyard-assets.spec.ts`: 승인 에셋·배치·보상·도감·두 좌석 복구 검사. 기존 `fifteen-fixes.spec.ts`, `vineyards.spec.ts`는 옛 SVG 이름 대신 실제 동일 ID/사탕 접근성 이름을 검사한다.
- `tests/browser/score-pages.spec.ts`: WebKit의 빠른 합성 wheel 입력 사이에 두 렌더 프레임을 기다린다. 100/160/200%와 매 단계 정확히 10% 증가하는 기존 검증 기준은 유지했다. 실제 게임 입력 코드는 변경하지 않았다.
- `.github/workflows/ci.yml`: 기존 검사에 신규 모바일 에셋 검사 파일만 추가했다. 폰트/필수 검사/배포 설정은 바꾸지 않았다.

## 이번 검증 기록

- 전체 core/server/AI 505/505, boards 33/33. 격리된 저장/서버 재시작/HTTP/WSS 계약 7/7. 실제 운영 Upstash에 접속하는 검사가 아니다.
- 원본 RGB 불변 및 12개 RGBA 재현 검사 통과, 배포 PNG 92개 검증, 기존 공통 일러스트 6개/자원 2개 검사 경고 0. TypeScript, 전체 ESLint, 최종 프로덕션 빌드 통과.
- 첫 관련 브라우저 실행은 69개 중 68개 통과했다. WebKit 점수판의 합성 wheel 이벤트 누락을 3회 반복 중 1회 재현했다. 이벤트를 두 렌더 프레임 뒤에 보내도록 테스트만 동기화한 뒤 동일 기준 3/3 통과했다.
- 최종 과일/사탕/점수판 PC·Chrome 터치·WebKit 터치 36/36 통과. 100/160/200%, 실제 투명 PNG 로딩, 사탕/과일 비율, 미리보기/회전/배치/Undo/저장, 실제 토큰/점수, 도감 및 두 브라우저 인증 재접속 포함.
- 실제 캡처를 직접 검토해 원본 테두리·포장·색상 유지와 문자/주사위 중복 제거를 확인했다. 모바일 개인 보유 사탕 최소값을 24→16px로 조정하여 작은 과일 칸보다 크게 보이지 않도록 재검증했다.
- 전체 PC 브라우저 전부를 새로 반복한 기록과는 구분한다. 관련 기존 포도밭/공급 레이아웃/무료 보상/도감 회귀 결과는 PROGRESS의 최신 실행 결과를 따른다.
