# 승인 베이지 건물 타일 10종 정리

2026-10-21. 새 일러스트 제작/AI 재생성/색 보정 없이 승인 PNG를 정규화했다.
게임 규칙, 기본 렌더러, 실제 게임의 에셋 연결, 사용자 저장 데이터는 변경하지 않았다.

## 입력과 파일 매핑

먼저 `asset-inbox/beige-approved/manifest.json`, `README_KO.md`, `CODEX_PROMPT_KO.txt`를 읽고 `originals/`의 10개 원화를 모두 비교했다. 이전 동봉 지시문의 2종 선처리/승인 대기는 이번 사용자의 10종 전체 처리 지시로 대체했다. 입력 파일은 쓰지 않으며 manifest의 원본 SHA256이 하나라도 다르면 중단한다.

출력: `public/assets/tiles/beige/final/`. 원본 id는 그대로 기록하고 파일명만 kebab-case로 정리했다.
게임의 `tile.id`는 인스턴스별로 달라지므로 그림 매핑은 `type: "building"`의 `building` 필드를 사용한다. `src/game/{types,tile-catalog,practice,white-castles}.ts` 및 기존 `TileArt`에서 대조했다.

|이름|승인 원본 (`originals/`)|최종 PNG|게임 building 값|
|---|---|---|---|
|시장|market.png|market.png|market|
|목수작업장|carpenter_workshop.png|carpenter-workshop.png|carpenters-workshop|
|교회|church.png|church.png|church|
|창고|warehouse.png|warehouse.png|warehouse|
|기중기|crane.png|crane.png|crane|
|하숙집|boarding_house.png|boarding-house.png|boarding-house|
|은행|bank.png|bank.png|bank|
|시청|city_hall.png|city-hall.png|town-hall|
|망루|watchtower.png|watchtower.png|watchtower|
|흰 성|white_castle.png|white-castle.png|white-castle|

흰 성은 일반 초록 성과 다른 건물이며, 하숙집은 별도 여관 확장의 `inn`이 아니다.

## 공통 규격과 보존 범위

- `src/app/tile-standard.json`의 rasterCanvas=1024를 재사용한 **1024×1024 PNG/RGBA**. 새 타일 좌표 규격을 만들지 않았다.
- 중심 `(512,512)`, 반지름512인 정규 pointy 육각형. 꼭짓점은 `(512,0)`, `(955.4050067376,256)`, `(955.4050067376,768)`, `(512,1024)`, `(68.5949932624,768)`, `(68.5949932624,256)`.
- 수학적 좌우 투명 여백 약68.595px. 상하 꼭짓점은 캔버스 끝에 닿는다. 래스터 alpha>0 bbox는 **[69,0,955,1024)** 로 10개 모두 같다. 같은 4배 supersampling 마스크를 사용하며 수학적 육각형 밖은 RGBA=(0,0,0,0)이다.
- 1254px 원본 각각의 직선 테두리 중간을 같은 알고리즘으로 측정한다. 여섯 변에 내접하는 정규 육각형을 계산하고 바깥 matte 제거용 4원본px 안전폭을 둔다. 측정된 중심과 반지름으로 **등방성 affine 리샘플링 1회**만 한다. 임의의 타일별 눈대중 이동/배율, 비등방 확대, 삼각형 분할 워핑은 없다.
- 원본의 비정규 외곽에서 공통 경계 밖으로 나오는 아주 바깥 목재 부분만 클리핑된다. 베이지 바닥·건물·소품·깃발·숫자·내부 그림자는 보존한다. 안쪽92% 보호 영역이 출력 육각형 안에 전부 포함되는지 수학적으로 검사하고 실제 그림도 비교했다.
- 불투명 검정 배경7종은 원본 바깥 배경이 최종 마스크 밖으로 나가므로 사라진다. **어두운 색 전체를 지우는 색상 치환/flood fill은 하지 않았다.** 따라서 내부 검정·회색 소품을 지우지 않는다. 기존 반투명 원본3종도 타일 내부는 불투명하게, 외부만 투명하게 정리했다.
- 목재 테두리의 기존 색/질감/명암은 유지한다. 표준화되는 것은 외곽 geometry와 크기이며, 원화의 나뭇결까지 단색의 동일 굵기로 다시 그리지 않는다. 재채색·AI 보완·새 디테일 합성은 없다.
- 출력별 source/output SHA256, 측정 중심/꼭짓점/반지름과 계산 배율은 `final/manifest.json`에 기록했다. 렌더링 단계에는 모든 PNG에 같은 x/y/width/height만 쓴다.

## 게임에서 사용할 때: 테두리를 한 번만 표시

최종 PNG에는 승인된 원래 테두리가 이미 들어 있다. 기존 `TileArt`의 **안쪽 clip(inset 2.2)+추가 TileFrame rim을 그대로 겹쳐 쓰면 안 된다.** 이번에는 요청대로 최종 에셋만 정리하고 게임 기본 에셋을 자동 교체하지 않았다.

- 같은 viewBox `0 0 100 (200/√3)`를 사용한다.
- image는 `x=(100-H)/2`, `y=0`, `width=height=H`, `H=200/√3`, `preserveAspectRatio="xMidYMid meet"`.
- clip은 기존 `tileHexPoints(0)` 공통 바깥 육각형이다. 추가 polygon stroke와 `TileFrame` rim은 그리지 않는다. 클릭 영역과 영지 좌표는 그대로 쓴다.
- URL은 `/assets/tiles/beige/final/<file>?v=<outputSha256 앞12자>`. 베이지 원화에 별도 외부 그림자나 검은 뒷면 식별자를 합성하지 않았으므로 필요시 기존 UI 레이어로 표시한다.

`tests/browser/beige-assets.spec.ts`가 이 방식으로 10종/인접 배치/100·160·200%를 확인하고, 실제 게임의 공용 공급·보관함·영지 DOM에만 임시 적용해 교체 가능성을 확인한다. 이 **검증용 미리보기는 production 기본 연결 변경이 아니다.** 격리된 브라우저 컨텍스트만 쓰며 사용자 게임은 건드리지 않는다.

## 생성 및 검증

Pillow가 설치된 Python에서 실행:

```text
python scripts/prepare-beige-tiles.py
python scripts/prepare-beige-tiles.py --check
python scripts/validate-tile-assets.py
npx playwright test tests/browser/beige-assets.spec.ts tests/browser/tile-standard.spec.ts --project=desktop-1280
```

`--check`는 쓰기 없이 10개 누락/중복, PNG/RGBA/1024규격, 원본 해시, 계산된 등록 결과의 픽셀 일치, 공통 alpha, 전체 외곽의 검정 matte 유무와 manifest 일치를 검사한다. 원본은 로컬 입력 폴더에 따로 보존되며 이번 신규 에셋 커밋에 기존 미추적 원본을 임의로 섞지 않는다. clean clone에서 재생성하려면 승인 입력 폴더가 필요하다.

비교 시트 `final/_preview_sheet.png`: 10종을 실제 영지에 가까운 약83px 폭과 3배인 약249px 폭으로 나란히 표시한다. 시트 자체는 1500×980px로 게임 타일 파일이 아니다.

브라우저 산출물 (`.local-data/beige-import/`, Git 제외):

- `approved-originals-sheet.png`: 원본10종 최초 비교.
- `before-after.png`: 승인 원화와 등록 결과 비교.
- `neighbours-{100,160,200}.png`: 10종 혼합 인접/2줄 대각선 공유 변.
- `game-{supply,storage,estate}-preview.png`: 실제 게임 좌표계의 교체 미리보기.
- 검사 명령/결과와 실패 수정은 최신 PROGRESS 체크포인트에 요약한다.

## 이번 검증 결과

- 원본10종 전부 입력 manifest SHA256과 일치. 1024 RGBA10개·동일 alpha·투명 픽셀 RGBA0·전체 외곽 검정 matte0, 재현된 픽셀 일치 및 기존 자산검사(전체형6/자원2) 통과.
- alpha≥128 경계와 이상 육각형의 최대 내측 차이는 **0.977241336 PNG px = 0.091616375 영지 SVG 단위**다. 래스터/안티앨리어싱에 따른1픽셀 미만 차이로, 10개 모두 같은 마스크를 사용한다.
- 100/160/200% 스크린샷의 가로 공유 변4쌍씩에서 순수 마젠타 배경 노출 **0/0/0/0px**. 대각선 공유 변과 실제 영지/공용/보관 미리보기도 직접 확인했다. 추가 SVG rim/stroke가 없으므로 원화 목재 테두리 위에 외곽선을 중복하지 않는다.
- 관련 브라우저 **7/7**(신규2+기존 타일 규격3/프레임2), 전체 코어 **413/413**, 보드 **33/33**, TypeScript·ESLint·프로덕션 빌드 통과. PC 전체97건 및 모바일 정밀QA는 에셋 준비 범위에서 다시 돌리지 않았다.
- 초기 테스트 fixture의 미활성 흰 성·저장 로딩 대기·SVG 이미지 사각 bbox 측정을 고쳐 실제 공유 좌표를 검사했다. 코어 첫 실행의14건은 sandbox 임시 파일 rename 권한(EPERM) 실패였고, 같은 테스트를 정상 권한에서 재실행해413개 전부 통과했다. 기존 테스트 삭제/완화 또는 게임 코드 수정은 없다.
- 입력 원본이 없는 clean clone에서도 브라우저의 최종10종 검사는 동작한다. 원본 비교 사진만 로컬 입력이 있을 때 추가한다. 재생성/원본 해시 검사는 승인 입력 폴더가 필요하다.

추가 수동 보정이 필요한 잘림/검정 배경/왜곡/중심 어긋남은 발견하지 못했다. 원화의 자연스러운 건물 높이/폭 차이는 유지하며 개별 건물만 떼어 임의 확대하지 않는다. 현재 기본 게임의 에셋 연결은 변경하지 않았으므로, 게임 전체 교체는 위의 단일 테두리 방식으로 별도 적용할 수 있다.
