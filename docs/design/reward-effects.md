# 승인 보상 아이콘 — 실제 보드 공통 규격

- `public/assets/effects/manifest.json`은 2026-10-29 revision-06 승인 시안의 PNG를 바이트 그대로 등록한다. 변경하지 않은 검은/포도 획득과 가로형 시장은 revision-05 원본이다. source 필드와 SHA256/캔버스/알파 경계로 원본 대응을 보존한다. 원본 시안은 `.local-data/effect-icon-review/2026-10-29/`에 남긴다.
- 교회=성·광산·수도원→저장고, 시장=선박·동물→저장고, 목공소=베이지 건물 실루엣 1개→저장고, 검은/포도 획득=해당 타일→저장고, 무료 배치=저장고→점선 빈 영지다. 저장고는 승인된 주황색 3육각형이다.
- 상품 판매는 빨간 사각형·주머니·위 빨간 삼각형이며 은화 그림을 포함하지 않는다. 일꾼4는 2×2, 은화2는 나란히, 승점4는 빨간 방패, 자유 행동은 기존 성 효과 그림을 그대로 쓴다. 일반 자원 표시는 기존 ResourceIcon/ResourceGlyph를 유지한다. 이 PNG는 사용자가 승인한 완성 효과 그림이며 재생성/자원 재그리기를 하지 않는다.
- 실제 포도밭/무역로는 `RewardEffectArt`를 공유한다. SVG 안의 `image`는 원본 비율을 유지하고 파일 해시로 캐시를 구분한다. 화면 텍스트 대신 접근성 이름/title은 유지하며 pointer-events를 받지 않는다.
- 포도밭은 기존 radius38 및 24칸 좌표를 유지한다. 승인 radius91 시안을 같은 비율로 축소하고 중앙 배치한다. 12개 이중 칸마다 같은 요구값 주사위 1개를 두 칸 중심의 중간점에 표시한다. 가로형 시장/목공소만 승인된 compact PNG를 사용한다. 상품 판매는 하단 그림자와 주사위를 분리하기 위해 승인 시안 기준 높이103→98(약5% 축소), 중앙/비율은 동일하다. 배치 미리보기/실제 배치 타일 위에는 보상 아이콘과 주사위를 숨긴다.
- 무역로의 카탈로그12장·장당3칸과 실제 플레이어별 할당을 유지한다. 보상 영역94×76px 안에 실제 불투명 경계 기준 contain으로 표시한다. 상품 크기50px, 기존 칸 너비101px, 완료 표시와 접기/펼치기는 유지한다.
- 공용보드에서 빈 슬롯 점선은 기존 `tileId` 조건에서만 그린다. 채워진 타일의 direct-unavailable 선택 폴리곤을 점선으로 만드는 CSS를 제거했다. 투명 hit 영역, 합법/hover/focus/선택의 실선 강조는 유지한다. 은화 옆 곡선은 별도 640×640 장식 경로이므로 보드950×1030에 맞춰 장식만 scale한다. 게임 타일/공급/은화 좌표는 바꾸지 않는다.

검사: `scripts/validate-deployment-assets.py`의 13개 PNG 해시·RGBA·알파 경계, `tests/browser/reward-effects.spec.ts`와 기존 가독성/질감/포도밭/온라인 검사를 사용한다. `reward-geometry.ts`는 투명 패딩이나 그림 경계 사각형 대신 실제 알파 픽셀과 SVG transform으로 주사위 가림을 검사한다. PC/터치 Chrome/WebKit, 두 디자인, 100/160/200% 캡처를 남긴다. 운영 Redis는 사용하지 않는다.

## 변경 파일

- 표시 코드: `src/app/reward-effect-art.tsx`, `vineyard-board.tsx`, `trade-route-panel.tsx`, `common-board-backdrop.tsx`, `game-screen.css`.
- 에셋: `public/assets/effects/manifest.json` 및 `church.png`, `market.png`, `market-compact.png`, `building.png`, `building-compact.png`, `black.png`, `vine.png`, `placement.png`, `sale.png`, `workers4.png`, `silver2.png`, `vp4.png`, `free-action.png`.
- 검사: `tests/browser/reward-effects.spec.ts`, `reward-geometry.ts`, `dice-readability.spec.ts`, `board-surfaces.spec.ts`, `scripts/validate-deployment-assets.py`, `.github/workflows/ci.yml`(새 검사를 기존 모바일 검사에 추가).
- 문서: 이 가이드와 `docs/PROGRESS.md`, `docs/TODO.md`의 이번 접두사. 기존 미커밋 문서 본문은 그대로 유지하고 커밋에서 제외한다.
