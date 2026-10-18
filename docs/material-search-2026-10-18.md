# SE 자료 추가 조사 — 2026-10-18

요청: 공식 출처에 한정하지 않고 2인 빈 공용 보드, 기본 타일 164개 세부 구성, 영지 1·3~10의 자료를 찾는다. 이번 작업은 자료 조사이며 게임 코드는 변경하지 않았다.

## 1. 사용자 제공 영상

- https://www.youtube.com/watch?v=VW4UqctAyk4&t=19s
- 실제 브라우저에서 제목 `Castles of Burgundy BGA Arena Gameplay 1 [2026]`, 채널 Strategy Meeples, 길이 32:09 확인.
- **0:19**: 시작 성 선택 화면. 왼쪽에 타일 없는 2인 공용 보드, 가운데에 지형과 눈이 표시된 개인 영지가 보인다.
- 실물 촬영이 아니라 BGA 화면이다. 2인 공급처의 참고 도상으로 유용하지만 SE 실물의 빈 보드 사진을 확보한 것으로 분류하지 않는다. 영상 한 장면만으로 164개의 전체 공급 분포를 알아낼 수도 없다.
- BGA 코드·에셋은 취득하지 않았다.

## 2. 새로 확보한 공식 자료: 뒷면 스티커 PDF

- 공식 발표: https://gamefound.com/en/projects/awaken-realms/castles-of-burgundy-special-edition/updates/35
- 제목: Shipping update #6 / Printable stickers for acrylic tiles!
- 발표에서 연결한 공개 폴더: https://drive.google.com/drive/folders/1wzmlA0ibTXDVGKts4UaRb6CorgTbOqiG
- 영문 원본: https://drive.google.com/file/d/1b873UFomZUaWEZ4yODdlRVUZfs52YA8f/view
- 로컬: `reference/official-se-acrylic-stickers-en.pdf` (6쪽).
- SHA-256: `EB7FD46BFA81A59774772F5233EB10A8A46F0C0D8AD678F14ADB9257F1971E3F`.
- 6쪽 모두 렌더링하고 색과 효과별 개수를 시각 확인했다. 확장 타일도 들어 있으므로 기본판과 분리했다.

### 기본판 합계

| 종류 | 일반 뒷면 | 검은 뒷면 | 합계 | 스티커 위치 |
| --- | ---: | ---: | ---: | --- |
| 건물 | 40 | 16 | 56 | 3~5쪽 |
| 가축 | 20 | 8 | 28 | 2쪽, 거위 제외 |
| 광산 | 10 | 2 | 12 | 1~2쪽 |
| 선박 | 20 | 6 | 26 | 1쪽 |
| 수도원 | 20 | 6 | 26 | 5~6쪽, 27~29 제외 |
| 성 | 14 | 2 | 16 | 2~3쪽 |
| 합계 | 124 | 40 | 164 | |

### 건물 8종의 세부 구성

시장, 목공소, 교회, 창고, 숙소, 은행, 시청, 감시탑 **각각 일반 5개·검은 2개**, 각 7개다. 스티커의 효과를 기존 공식 규칙서의 건물 이름에 대응했다. 하얀 성과 학은 이 56개에서 제외한다.

### 수도원 1~26의 세부 구성

번호별 1개. **검은 뒷면은 7, 12, 14, 15, 24, 25번**이다. 나머지 **1~6, 8~11, 13, 16~23, 26번**은 노란 뒷면이다. PDF 5~6쪽의 효과와 색상을 규칙서의 번호에 대응해 확인했다. 27~29는 확장이다.

이로써 가축을 제외한 **136개**는 종류/번호별 뒷면과 수량을 특정할 수 있다. 이는 실제 게임 카탈로그에 반영하거나 테스트한 상태를 뜻하지 않는다.

### 가축에서 여전히 모르는 부분

2쪽은 일반 20개·검은 8개와 별도의 검은 거위 1개를 구분해 보여준다. 그러나 기본 가축의 뒷면 문구는 모두 같아 **소·양·돼지·닭 각각의 2/3/4마리별 수량과 뒷면 대응은 제공하지 않는다**. 따라서 164개 전수 세부표를 완성했다고 할 수 없다.

소유자 검수 보조 자료도 발견했다:
https://unknowns.de/forum/thread/21361-burgen-von-burgund-special-edition-by-awaken-realms/?pageNo=37
게시물 #1472 (2023-09-18, s3chaos)는 건물의 5/2 분포와 검은 수도원 번호를 같은 값으로 적었다. 공식 PDF와 일치하지만 가축 세부값은 없다. 확장을 포함한 검은 가축 9개를 기본판 8개로 오인하지 않는다.

## 3. 영지 도감 후보 — 다운로드에 로그인 필요

- https://boardgamegeek.com/filepage/262000/list-of-every-duchy-with-picture-and-names
- 제작자 unreal_ed, 파일 `Burgundy boards v2.jpg`, 표시 용량 923KB.
- 설명: 영지를 그림과 작성자의 별칭으로 모아 기본/확장 종류에 따라 정리한 이미지.
- 웹 조회 도구의 직접 열기는 403이었으나, **브라우저에서는 페이지 열람 성공**. 파일을 클릭하면 Sign in 창이 표시됐다. 원본은 다운로드하지 못했다.
- 따라서 모든 영지의 지형과 숫자가 실제로 판독 가능한지는 아직 미검증이다. 링크 발견과 도면 전수 확보는 구분한다. 별칭은 공식 명칭이 아니다.
- 페이지 작성자가 원자료로 연결한 https://fwtwr.com/fwtwr/cob/boards.asp 는 웹 조회 실패. SE와 이전 판본의 번호를 동일하다고 간주하지 않는다.

## 4. 빈 공용 보드 사진 조사 결과

SE **2인 면 전체가 가림 없이 선명한 정면 실물 사진**은 이번 조사에서도 확보하지 못했다.

- SE 양면 플레이매트 판매 사진: https://3dlevelup.com.au/products/castles-of-burgundy-special-edition-playmat
  - 내려받은 이미지: `reference/se-playmat-two-sides.jpg` (1600×1600).
  - 한 면이 말려 다른 면 상당 부분을 가린 사진이다. 2인 면 전체 판독용으로 채택하지 않는다.
- https://boardgamegeek.com/thread/2878863/the-main-board-looks-subpar-when-compared-to-other
  - 브라우저에서 본문 확인. 2022년 개발 중 보드와 사용자 수정안이 섞여 있어 최종 SE 2인 면 근거로 채택하지 않는다. 검색 이미지의 설명만으로 최종판을 단정할 수 없다.
- https://boardgamegeek.com/filepage/271317/castles-of-burgundy-tile-distribution
  - 검색에 노출된 작성자 답변은 **2011판 기본 구성**을 대상으로 했다고 명시한다. SE 전수표로 채택하지 않는다.

## 남은 최소 자료

1. 최종 SE 2인 공용 보드 면의 전체 도상.
2. SE 가축 28개의 앞면(종·마릿수)과 뒷면 대응.
3. 영지 도감 원본을 확보한 뒤 1·3~10번의 37칸 지형·눈 판독.

공식 자료만 허용해서 보류한 것이 아니다. 비공식 자료도 조사했으며, 읽지 못한 내용이나 다른 판본의 수치를 추측해 채우지 않았다.
