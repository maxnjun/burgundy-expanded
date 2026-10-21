# 승인 수도원 타일 1–29 전체 적용

2026-10-21. 사용자 승인 ZIP의 그림/색상/번호/효과 그림을 보존한 에셋 교체다. 게임 능력·공급 분포·타일 ID·저장/AI/온라인 엔진은 변경하지 않는다.

## 입력·원본 보존

- 입력: 프로젝트 최상위 `수도원 타일.zip` (46MB), 이미지 정확히29개·중복/누락0.
- ZIP SHA256: `81ad011a09699ef0012fdb697a6f0c7d9e3772e2231cedece6c86a72aba1705e`.
- 보존: `asset-inbox/monastery-approved/originals/monastery-01.png`부터29까지 ZIP의 원본 바이트를 그대로 추출. 원본29개와 입력 manifest를 백업하며 대용량 ZIP은 로컬 원본으로 보존한다.
- 입력 원본은 모두 검은 불투명 RGB 배경(25번도 RGBA지만 alpha255). 1·3번의 캔버스만 다르고 나머지는1254 정사각이다. 체크무늬는 없다.
- 기존 미커밋 `public/tiles/monastery-27.png`, `monastery-28.png`와 다른 asset-inbox/여관 문서 변경은 건드리거나 이번 커밋에 넣지 않는다.

## 등록 방식·보존 범위

- 출력: `public/assets/tiles/monastery/final/monastery-01.png`–`monastery-29.png`, 모두1024×1024 RGBA. 외부 투명 픽셀 RGB도0, 29장 alpha 완전 일치.
- 기존 베이지의 `common_alpha`/`registered` 재사용. 실제 외곽의 여섯 직선 측정→내접 정육각형→동일 비율의 단일 affine 표본화. 늘이기/개별 런타임 scale·translate/AI 재생성/인페인팅 없음.
- 원본 육각형은 완전한 정육각형이 아니므로 공통 외곽을 얻기 위해 바깥 금색 가장자리 일부를 trim한다. 각 원본 중심·꼭짓점·등록 반지름·축척은 출력 manifest에 기록한다. 측정된 내부90% 보호 조건을 자동 검사하고 숫자/효과/건물은 전후 비교한다. 원본 외곽선 픽셀까지 전부 보존하는 무변환 복사는 아니다.
- 아래쪽 번호 리본의 검은 외곽선은 승인된 그림이다. 이를 검은 배경으로 오인해 지우지 않는다. 허용되는 어두운 경계는 리본이 닿는 하단 범위로 제한해 검사하며 위/양옆/아래 꼭짓점의 배경 잔여와 외부 alpha0도 검사한다.
- 공통 viewBox `0 0 100 115.47005383792516`, 같은 정사각 imageRect, 바깥 hex clip(inset0). PNG의 금색 테두리만 표시하고 SVG backdrop/rim/번호/14번 효과/검은 마름모를 위에 중복하지 않는다. 로딩 실패 시만 기존 번호 있는 SVG+안쪽 테두리로 복구한다.
- 새 URL은 output SHA256의 앞12자를 쿼리에 붙여 오래된 브라우저 캐시와 구분한다.
- 적용 경로: `TileArt`→공용 번호/검은 공급처·보관함/선택·배치 미리보기·`EstateTile` 영지/확대·온라인/무역로. 별도 수도원 이미지 경로를 쓰는 화면은 없다. 기존 툴팁/도움말/행동 기록의 번호·능력 설명은 유지한다(기록은 기존부터 텍스트형).
- 승인 PNG에 합성된 자원 그림은 수정하지 않는다. 기존 자원 아이콘 PNG도 그대로이며 새 효과 일러스트를 만들지 않았다.

## 번호 매핑

| 수도원 번호 | ZIP 원본 | 게임용 PNG | 원본 크기 |
|---|---|---|---|
| 1 | `수도원 타일/1번.png` | `monastery-01.png` | 1294×1216 |
| 2 | `수도원 타일/2번.png` | `monastery-02.png` | 1254×1254 |
| 3 | `수도원 타일/3번.png` | `monastery-03.png` | 1293×1216 |
| 4 | `수도원 타일/4번.png` | `monastery-04.png` | 1254×1254 |
| 5 | `수도원 타일/5번.png` | `monastery-05.png` | 1254×1254 |
| 6 | `수도원 타일/6번.png` | `monastery-06.png` | 1254×1254 |
| 7 | `수도원 타일/7번.png` | `monastery-07.png` | 1254×1254 |
| 8 | `수도원 타일/8번.png` | `monastery-08.png` | 1254×1254 |
| 9 | `수도원 타일/9번.png` | `monastery-09.png` | 1254×1254 |
| 10 | `수도원 타일/10번.png` | `monastery-10.png` | 1254×1254 |
| 11 | `수도원 타일/11번.png` | `monastery-11.png` | 1254×1254 |
| 12 | `수도원 타일/12번.png` | `monastery-12.png` | 1254×1254 |
| 13 | `수도원 타일/13번.png` | `monastery-13.png` | 1254×1254 |
| 14 | `수도원 타일/14번.png` | `monastery-14.png` | 1254×1254 |
| 15 | `수도원 타일/15번.png` | `monastery-15.png` | 1254×1254 |
| 16 | `수도원 타일/16번.png` | `monastery-16.png` | 1254×1254 |
| 17 | `수도원 타일/17번.png` | `monastery-17.png` | 1254×1254 |
| 18 | `수도원 타일/18번.png` | `monastery-18.png` | 1254×1254 |
| 19 | `수도원 타일/19번.png` | `monastery-19.png` | 1254×1254 |
| 20 | `수도원 타일/20번.png` | `monastery-20.png` | 1254×1254 |
| 21 | `수도원 타일/21번.png` | `monastery-21.png` | 1254×1254 |
| 22 | `수도원 타일/22번.png` | `monastery-22.png` | 1254×1254 |
| 23 | `수도원 타일/23번.png` | `monastery-23.png` | 1254×1254 |
| 24 | `수도원 타일/24번.png` | `monastery-24.png` | 1254×1254 |
| 25 | `수도원 타일/25번.png` | `monastery-25.png` | 1254×1254 |
| 26 | `수도원 타일/26번.png` | `monastery-26.png` | 1254×1254 |
| 27 | `수도원 타일/27번.png` | `monastery-27.png` | 1254×1254 |
| 28 | `수도원 타일/28번.png` | `monastery-28.png` | 1254×1254 |
| 29 | `수도원 타일/29번.png` | `monastery-29.png` | 1254×1254 |

각 번호는 정확히 한 final asset으로 매핑된다. 원본·출력 전체 SHA256은 각 manifest에 기록한다.

## 검증 방법·화면

- `python scripts/prepare-monastery-tiles.py --check`: 원본 ZIP/PNG SHA, 번호29개, 출력 재생성 일치, 공통 alpha, 배경/크기/형식 검사(읽기 전용). ZIP이 없는 깨끗한 clone에서도 보존 원본과 manifest로 검사 가능.
- `python scripts/validate-tile-assets.py`: 기존 공통 타일/자원 에셋 회귀.
- `tests/browser/monastery-assets.spec.ts`: 29개 URL SHA/실제 디코드·외곽 clip·중복 그림0·100/160/200 공유 꼭짓점, 실제 게임 10묶음으로29개를 번호/검은 공급처·보관함·영지에 표시, 선택 및 상태 전체 불변, 1/14/29번404 fallback/복구.
- 이전 tile-standard/frame/png 검사는 새 baked 테두리와 SVG fallback을 각각 검사하도록 수정했다. 공통 SVG 프레임 검사를 삭제하거나 다른 종류의 기대값을 완화하지 않았다.
- 갤러리: `/monastery-gallery`, 큰 그림과 게임 크기를29종 모두 비교한다. 엔진 fixture를 주입하거나 게임 저장을 바꾸지 않는 읽기 전용 페이지다.
- 프리뷰: `public/assets/tiles/monastery/final/_preview_sheet.png` (큰 그림/66px 실표시).
- 브라우저 캡처: `.local-data/monastery-import/gallery.png`, `before-after.png`, `neighbours-{100,160,200}.png`, `game-supply-{1..10}.png`, `game-storage-{1..10}.png`, `game-estate-batch-{1..10}.png`, `game-estate-{100,160,200}.png`.

## 변경 파일

- `src/app/tile-art.tsx`: 번호 manifest 등록과 정상 PNG/오류 SVG 분기만 수정.
- `src/app/monastery-gallery/page.tsx`: 공통 렌더러를 쓰는 읽기 전용29종 비교.
- `scripts/prepare-monastery-tiles.py`: ZIP/원본 검증, 공통 파생 생성/재검증, 캡처가 있을 때66개 공유 변 픽셀 검사.
- `tests/browser/monastery-assets.spec.ts`, `tile-frame.spec.ts`, `tile-png.spec.ts`, `tile-standard.spec.ts`:29종 매핑/출력/기존 전체 규격/fallback/게임 상태 불변 검증.
- `asset-inbox/monastery-approved/{manifest.json,originals/*.png}`, `public/assets/tiles/monastery/final/{manifest.json,monastery-01..29.png,_preview_sheet.png}`.
- `AGENTS.md`, 이 문서, `docs/design/tile-asset-standard.md`, `docs/PROGRESS.md`, `docs/TODO.md`의 이번 작업 접두 기록.

## 실행 결과

- 29/29 번호 매핑/원본 SHA/투명 RGBA/동일 alpha/출력 재생성 일치 통과. ZIP이 있는 경우와 ZIP 없이 보존 원본만 있는 clone 조건 모두 확인했다.
- 프리뷰·승인 원본 대비 전후·갤러리·실제 게임 10묶음(29종)의 번호/검은 공급처·저장/영지·100/160/200 캡처를 직접 확인했다. 그림/숫자/효과/종류별 원래 색감 유지, 검은 사각형/추가 SVG 테두리/효과 중복 없음.
- 공유 변66개×배율별528개 지점 및 주변5×5px 검사: 좌표 오차<0.001px. 마젠타 노출은100%에서 공유선으로부터 최대0.0847px,160%0.0538px,200%0px. 정확한 경계 위의1픽셀 안티앨리어싱은 남지만 외곽 크기나 실제 틈으로 분류하지 않는다.
- 전체 코어433/433, 보드33/33, 최종 TypeScript/ESLint/프로덕션 빌드 exit0. 기존 에셋 validate 통과/경고0.
- 초기 sandbox의 서버 임시파일 rename EPERM은 같은 코어 검사를 정상 권한에서 재실행해 해소했다. 새 라우트 타입 캐시는 빌드 생성 후 타입 검사를 재실행해 통과했다. 브라우저 신규 fixture는 공식 슬롯 타입·29번 확장 설정·실제 같은 번호 수량을 준수하도록 수정했고 검증 기준/게임 코드는 우회하지 않았다.
- 초기 관련11개 실행8통과 후 fixture/라우팅 검사를 수정: 관련6개 실행5통과, 마지막 실제게임1/1 재검증 통과. 최종 전체PC 127/127이 한 번의 전체 실행에서 통과했다(15.0분).
- 모바일 정밀QA는 이번 범위에서 수행하지 않았다. 원본에 포함된 금색 테두리/리본의 미세한 비대칭은 새로 그리거나 왜곡해 없애지 않았다. 공통 외곽/중앙/클릭 좌표는 같으며 작은 가장자리 trim은 위 등록 방식에 명시했다.
- 이번 검증/정규화/렌더러/문서73경로만 main 백업 대상으로 선정했다(민감 패턴0). origin/maxnjun/burgundy-expanded의 공개 main은 기존 사용자 Push 허용을 적용하며 공개 설정은 변경하지 않는다. 다른 원본/문서 미커밋 변경은 제외한다.

- 백업: 구현/에셋73경로 커밋 `a527a57369322471c806242c18d689f426261b74`를 origin/main에 일반 Push하고 원격 전체 SHA 일치를 확인했다. 이 마지막 검증 기록만 별도 문서 커밋으로 보존한다.
