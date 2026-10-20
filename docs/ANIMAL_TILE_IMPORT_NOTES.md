# 승인 동물 타일 13종 — 실제 게임 적용

## 입력과 매핑

입력: `asset-inbox/animal-approved/동물 타일.zip` 및 바이트 그대로 추출한 `originals/` 13개. ZIP/원본 PNG는 수정하지 않는다. 입력 해시와 출력 해시는 최종 manifest에 기록한다.

| 내부 species (유지) | 표시 이름 | 최종 파일 |
| --- | --- | --- |
| pigs | 돼지 | pig-2.png, pig-3.png, pig-4.png |
| chickens | 기니피그 | guinea-pig-2.png, guinea-pig-3.png, guinea-pig-4.png |
| cattle | 소 | cow-2.png, cow-3.png, cow-4.png |
| sheep | 양 | sheep-2.png, sheep-3.png, sheep-4.png |
| geese | 하프물범 | harp-seal-2.png (입력: 하프물범 2.png) |

결과: `public/assets/tiles/animals/final/`. `_preview_sheet.png`는 13종의 83px 및 3배 비교용이다. 실제 SVG 프레임까지 포함한 비교는 브라우저 캡처를 사용한다.

## 규격과 원본 보존

- 원본 모두 1254×1254. 그림의 육각형은 게임의 정육각형과 비율이 다르고, 하단 입체 테두리가 더 두껍다. 원본 전체를 강제로 늘리거나 게임 좌표를 변경하지 않는다.
- 여섯 외곽 직선과 테두리/풀밭 전환을 측정한다. 해시가 고정된 원본의 안쪽 contour를 검수하여 테두리만 분리한다. 중심 그림의 검은색을 전역 투명 처리하지 않는다.
- 중앙 동물·풀밭은 한 번의 등방성 리샘플링으로 공통 캔버스 안에 넣는다. 남은 가장자리에는 기존 목초지 바탕색을 사용한다. 동물 생성, 인페인팅, 색 보정, 비등방 변형은 없다. 원본 안의 동물 수·자세를 유지한다.
- 최종 13개는 1024×1024 RGBA, 공통 정육각형 알파와 중심 (512,512), 반지름 512를 공유한다. 완전 투명 픽셀은 RGBA 모두 0이다.
- 원본 테두리에서 실제 RGB를 추출한 공통 연두색 팔레트로 기존 `TileFrame`의 안쪽 3겹 프레임을 재사용한다. PNG에 두 번째 테두리를 합성하지 않는다. 같은 viewBox `0 0 100 115.47005383792515`, inset 2.2 clip, 공통 imageRect만 쓴다.
- 마릿수는 기존 원형 배지 정책을 유지한다. 모든 가축에서 상단 중앙 (50,16), 반지름 7에 놓아 동물 얼굴을 가리지 않는다. 검은 뒷면 표시도 유지한다.

## 연결과 기능 보호

`TileArt`에서 manifest의 species/count로만 선택하고 출력 SHA로 URL 캐시를 구분한다. 공용 번호/검은 공급처, 보관함, `EstateTile`, 선택 미리보기 및 온라인의 같은 컴포넌트에 자동 적용된다. 실패 시 기존 SVG/공통 프레임으로 복구한다.

`LIVESTOCK_NAMES`는 로컬 이름, 방패 선택 문구, 서버의 온라인 행동 문구가 공유한다. 도움말과 준비 화면의 표시 이름도 바꾼다. 내부 chickens/geese ID, 타일 카탈로그/총량/뒷면, 목초지 점수, 거위 확장 특수 효과, 저장 포맷 및 AI는 유지한다. 하프물범은 기존 검은 뒷면 확장 타일 1개이며 기본판 공급에 추가하지 않는다.

변경 소스: `src/app/tile-art.tsx`(모든 화면의 이미지/공통 프레임), `src/app/game-screen.tsx`(표시 이름/준비 안내), `src/game/tile-help.ts`(공통 이름/도움말), `src/game/core/shield-effects.ts`(선택 문구만), `src/server/rooms.ts`(온라인 행동 문구만). 보드 좌표·스타일시트·타일 카탈로그·수치 효과는 변경하지 않는다.

## 재생성·검증

Pillow가 설치된 Python으로 실행한다. 재생성에는 승인 ZIP이 필요하며 원본을 출력 위치로 사용하지 않는다.

```text
python scripts/prepare-animal-tiles.py
python scripts/prepare-animal-tiles.py --check
python scripts/validate-tile-assets.py
npx playwright test tests/browser/animal-assets.spec.ts tests/browser/tile-png.spec.ts tests/browser/tile-standard.spec.ts --project=desktop-1280
```

검사는 13종 누락/매핑/원본 해시/동일 크기·알파/결정적 픽셀·투명/외곽 matte, 실제 이미지 URL과 count, 단일 SVG 프레임, 100/160/200% 공유 변, 13종 실제 게임 공급·보관·영지·선택/저장 상태 불변과 404 복구를 확인한다. 기존 3칸 보관함과 영지 지형은 바꾸지 않고 2종씩 7개 게임 fixture로 나누어 확인한다.

스크린샷: `.local-data/animal-live/before-after.png`, `neighbours-{100,160,200}.png`, `game-supply-{1..7}.png`, `game-storage-{1..7}.png`, `game-estate-{1..7}-{100,160,200}.png`. 임의 DOM 그림 교체 없이 실제 production TileArt와 게임 저장을 사용한다. 공급처 캡처만 고정 도구막대의 가림을 숨겨 전체를 기록한다. 정밀 모바일 QA는 이번 범위에서 제외한다.

실행 결과는 최신 `PROGRESS.md`의 동물 작업 체크포인트에 기록한다. 기존 수도원 PNG 2종과 문서의 다른 작업 변경은 보존하고 이번 커밋에서 제외한다.
