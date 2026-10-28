# 포도 공급대·상점 국소 UI 수정 (2026-10-28)

기준 커밋 `74c7c34`. 최신 사용자 지시로 검증 후 이번 관련 파일만 main에 Commit/Push한다. Render 배포·재시작·Manual Deploy·설정 변경은 하지 않는다.

## 구현

- 공급대와 상점의 `VineTile`에만 `connected` 변형을 지정했다. 기존 100×57 viewBox 안에 좌우 동일한 48×55.42 단위 육각형을 잇는 `VINE_TILE_FRAME.connectedOutline` 경로 하나를 사용한다. 두 칸 중심은 (26,28.5)/(74,28.5)이며 기존 비대상 `outline`은 유지한다. 연녹색 `#d8e0bb` 바탕과 갈색 `#806d46` 외곽만 그리며 중앙에 별도 선이나 겹치는 두 hex 테두리를 그리지 않는다.
- 승인된 과일 PNG 6개는 경로·바이트·비율을 그대로 재사용한다. 별도 **알파 전용 마스크**로 공급/상점에서 기존 베이지 바닥·개별 hex rim만 가린다. 과일 윤곽·색·명암을 다시 그리거나 수정하지 않았다. 6개 마스크는 승인 PNG 해시에 묶이며 원본이 바뀌면 검증이 중단된다.
- React `useId`로 마스크를 각 SVG 인스턴스에 안전하게 연결한다. 개인 보드·저장고·도감·기록은 기존 완성형 PNG 표시를 유지한다. 보드 좌표·회전·클릭/획득·규칙/저장·서버 코드는 변경하지 않았다.
- 공급 타일의 외부 주사위 조건·상태 문구, 상점의 은화 2개·구매 가능 표시는 유지했다. 2열 공급 구조, 빈 슬롯 규격도 유지한다.
- 상점 아래에 크림색/얇은 베이지 점선/둥근 모서리의 새 `fieldset`을 만들고 위 테두리에 갈색 **남은 사탕** 제목 탭을 배치했다. 6열 순서는 **B 블루베리 → G 샤인머스켓 → O 귤 → R 복숭아 → Y 패션후르츠 → K 딸기**다.
- 사탕 이미지는 기존 파일을 32px 이하로 사용하고 각 그림 바로 아래 `×수량`을 표시한다. 수량은 개인 보유량이 아닌 **`v.pool[g]`**다. 모바일 공급 패널과 SVG는 가용 너비에 맞춰 줄어들며 사탕은 한 줄을 유지한다.

## 변경 파일

- `src/app/vineyard-art.tsx`: 승인 PNG를 재사용하는 선택적 알파 마스크.
- `src/app/vineyard-board.tsx`: 공급/상점 연결형 변형 및 실제 남은 사탕 박스.
- `src/app/vineyards.css`: 공급/상점 한정 연녹색/크림색·6열/모바일 스타일.
- `scripts/prepare-vineyard-masks.py`: 승인 PNG의 닫힌 과일 윤곽을 이용한 알파 마스크 재현/`--check`.
- `scripts/validate-deployment-assets.py`: 새 마스크의 원본 해시·PNG 규격·알파·해시 검증.
- `public/assets/vineyards/illustration-masks/{blueberry,shine-muscat,mandarin,peach,passionfruit,strawberry}.png`와 `manifest.json`.
- `tests/browser/vineyard-assets.spec.ts`: 연결형 경로/중앙 픽셀, 재고 갱신, 6열/320px, 기존 비대상 UI 보존과 온라인 두 좌석 동기화.
- `docs/PROGRESS.md`, `docs/TODO.md`, 이 문서: 최신 체크포인트. 기존 미커밋 본문/이미지/입력 파일은 보존한다.

## 검증

- `prepare-vineyard-masks.py --check`: 6개 마스크 재현 일치, 승인 PNG 변경 0.
- `prepare-vineyard-assets.py --check`: 기존 과일 6개/사탕 6개, 768/512 RGBA·원본 RGB 불변·재현 픽셀 일치.
- `validate-deployment-assets.py`: PNG 98개 통과. 전체 코어 505/505, 보드 33/33, TypeScript/전체 ESLint/프로덕션 빌드 통과.
- 신규/보완 브라우저 **PC·Chrome 터치·iPhone WebKit 터치 24/24** 통과. 100/160/200%의 단일 외곽·마스크·가운데 연녹색 픽셀, 회전/확정/Undo/재접속, 사탕 획득 전후 실제 재고, 두 온라인 좌석의 수량 동기화를 검증했다.
- 기존 공급/상점·빈칸·2/3/4인·포도밭/무료 보상 PC 회귀 **11/11** 통과. 모바일 320/375/390px에서 사탕 6열, 공급 패널/내부 가로 잘림 없음. 화면을 직접 확인했다.
- 첫 픽셀 캡처는 200%에서 기존 상단 고정 안내바가 타일 위를 가려 실패했다. 게임 UI를 숨기거나 수정하지 않고 테스트의 기존 고정 설정을 OFF로 바꿔 같은 픽셀 기준을 다시 검사했다. 추가한 온라인 재고 테스트의 선택자도 실제 온라인 필수 선택 영역으로 수정했다. 최종 24개는 모두 통과했다.
- 모바일 스크린샷에 기존 설명 툴팁이 겹친 경우에는 헤더를 터치해 닫고 320/375/390px 화면을 재촬영했다. 동일 재고/정렬 검사 3엔진 3/3 재통과. 기존 툴팁 기능은 변경하지 않았다.

증거: `.local-data/vineyard-supply-connected/`의 `build-final.log`, `types-release.log`, `lint-release.log`, `core.log`, `boards.log`, `browser-release.log`, `related-release.log`, `screens-clean.log`. 이전/이후 실제 화면과 비교 시트도 같은 폴더에 보관한다.

실제 Android/iPhone 기기·외부망/운영 Redis는 이번 시험 범위가 아니다. 격리된 로컬 두 좌석 서버만 사용했으며 기존 운영 게임방·Redis·환경변수는 건드리지 않았다.
