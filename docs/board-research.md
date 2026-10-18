# 공개 공식 영지 자료 조사

**2026-10-18 후속 확보:** 사용자가 팬 영지 도감 원본을 제공했다. 이제 개인 영지1~30의 전체 지형·눈이 등록됐다. [전사 및 검증](boards/se-duchy-sheet.md). 아래의 다운로드 미확보/2번만 구현은 과거 상태다.

최신 추가 조사: [2026-10-18 영상·비공식 자료 검색](material-search-2026-10-18.md). 사용자 영상0:19의 BGA 빈2인보드 확인, SE 영지 그림도감 후보 발견(다운로드 로그인 필요), 공식 스티커 PDF 확보로 가축 제외136개 세부구성 확인. 아래는 기존 조사 기록이다.

2026-10-17 재조사. **검증 완료 공식 영지 1개: 기본 영지 2번.** 앞선 0개 보고는 자료가 전혀 없어서가 아니라, 확보한 규칙서 사진의 전수 판독을 끝내지 못했기 때문이다. 2번 전체 면이 보이는 점을 재검토해 전사·구현했다.

## 실제 확인한 주소와 결과

| URL | 실제 결과 | 보드 이미지/미확보 이유 |
| --- | --- | --- |
| https://awakenrealms.com/download | 웹 조회 성공, 추출 본문 0줄 | 추출 도구로 동적 다운로드 목록을 읽지 못함. 사이트 전체 접근 실패나 로그인 필요로 판정하지 않음 |
| https://awakenrealms.com/images/download/CoB/CoB_Rulebook_285x210mm%20%5B28%20pages%5D.pdf | 실제 다운로드 성공, 19,620,991바이트 | 공식 PDF p.2에 2번 전체 영지 사진 확보. 웹 PDF 열기 도구의 용량 제한은 HTTP 다운로드 실패가 아님 |
| https://boardgamegeek.com/boardgame/363622/the-castles-of-burgundy-special-edition/files | 직접 웹 요청 HTTP 403 Forbidden 재확인 | 자료실 본문/다운로드/이미지 미확보. 로그인 요구인지 자동화 차단인지는 확인 불가, 우회 안 함 |
| https://boardgamegeek.com/filepage/262788/duchies-list-all-duchy-details-and-rules-reference | 직접 웹 요청 HTTP 403 Forbidden 재확인 | 파일 원본 미확보. 검색에 노출된 설명은 magictom1의 CoB_SE_2013_Board_List_v2, 30개 영지 텍스트 목록. 설명만으로 칸 배치를 확보했다고 보지 않음 |
| https://www.ravensburger.co.uk/en-GB/pdp/26600 | 웹 도구에서 제품 본문·링크 확인 성공. 별도 실제 HTTP 요청은 Cloudflare의 JavaScript/cookie challenge 반환 | 제품 소개와 공식 PDF 링크 확인. challenge는 우회하지 않음. 로그인 문제로 단정하지 않음 |
| https://ravensburger.cloud/images/produktseiten/310x250/26600_1.webp | 실제 다운로드 HTTP 200, 310×226px | 제품 사진 확보. 개별 영지 37칸 판독용 정면 이미지가 아님. 웹 도구의 Cache miss를 사이트 다운로드 실패로 잘못 분류하지 않음 |
| https://ravensburger.cloud/images/produktseiten/310x250/26600_2.webp | 실제 다운로드 HTTP 200, 254×250px | 제품 사진 확보. 전체 영지의 모든 눈을 전사하기에 부족 |
| https://product-files.ravensburger.cloud/manuals/687188.pdf | 제품 페이지 Download 링크, 실제 다운로드 성공, 19,621,606바이트 | 같은 공식 규칙서 도상. p.2 영지 사진 확인, 독립 보드 사진은 아님. 웹 도구는 용량 제한으로 열지 못함 |

## 로컬 reference 공식 PDF에 보드 자료가 있는가

있다. 기존 파일과 Awaken Realms 공개 다운로드본의 SHA-256은 모두 `8E5822756333B3EFEE52A0C0E203D1A16B16A458E0B130A074D360D72C0C038F`다.

- p.2 구성품 사진: 2번이 맨 앞에 있어 37칸 전부 보인다. 뒤쪽 4/6/8/10번은 일부가 가려져 전체 도상으로 사용할 수 없다.
- p.5: 영지·플레이어판·오버레이 삽입 예시와 시작 성 규칙. 1~10번 전체 도면 모음은 아니다.
- p.2의 `/Im23` 원본 객체(630×492px)를 추출하고 페이지 확대 렌더링과 대조했다. 인쇄 번호 2 및 모든 칸의 지형/주사위를 수동 판독했다. 확대는 새 해상도를 만드는 것이 아니며 AI 복원이나 수치 추정은 하지 않았다.

Ravensburger PDF SHA-256: `D4A1334EBEC1C96CC255CB8BC05D67314FB43BFD9B72EC51B3A3981975913126`. 같은 사진의 재배포이므로 독립적인 두 자료로 교차 검증했다고 표현하지 않는다.

## 구현·남은 자료

2번은 axial 37칸, 19개 지역, 성 후보 4칸, 권장 중앙6을 구현했다. 셀별 감사표·검토 한계·출처는 [boards/se-base-2.md](boards/se-base-2.md). `verified`는 Codex가 해당 공식 도상을 전사·구조 검증한 상태이며 별도 사람/실물 검수는 아직 없다. 선택 UI에서 실제 GameState로 연결하며 공급은 계속 연습 구성이다.

1,3~10번 각각은 **인쇄 번호와 37칸 전체 지형·눈이 함께 보이는 정면 사진/스캔/도면**이 부족하다. 뒤에 가려진 칸을 다른 판본이나 생성 규칙으로 보충하지 않는다. 지역 경계와 성 후보도 전체 도상에 따라 확인해야 한다. 추가/특수/팀/솔로 보드는 기본 영지로 임의 변환하지 않는다. 현재 기본 영지 10개 중 1개 등록, 나머지 9개 보류다.

공식 PDF와 검사 이미지는 `reference/` 제외 규칙을 유지하며 게임 화면에는 자체 SVG만 사용한다.


## 2026-10-18 추가 조사 — 공급 데이터

| 실제 확인 URL | 접근 및 확보 결과 | 채택 범위 |
| --- | --- | --- |
| https://cdn.awsli.com.br/2500x2500/301/301714/produto/198210298/tmprendercobrulebookcomponentsboardmin-cb1be5104f.jpg | HTTP 다운로드 성공,2349×1603px 공용 보드 제품 렌더 | 공식PDF p.4 도표와 색 슬롯/4표시/3BD 위치를 대조했다.3·4인 슬롯 채택. 판매처 호스팅이며 이 이미지 자체만을 출판사 원본이라고 주장하지 않는다 |
| https://www.lojameeplebrjogos.com.br/castles-of-burgundy-special-edition-gameplay-all-in | 이미지 검색에서 위 렌더의 제품 페이지로 확인 | 제품 렌더의 출처 맥락. 본문 전체 조사나 구매는 하지 않음 |
| https://storage.googleapis.com/ludopedia-imagens-jogo/55765_247575.jpg | 실제 다운로드 성공,1000×467px 실물 세팅 사진 | 사진 전체의 중앙 보드가 작고 기울어 있으며 타일/표식이 가려 모든 슬롯을 읽을 수 없다.2인용 면임을 표시하는 아이콘도 확정 판독하지 못해2인 공식 레시피로 채택하지 않음 |
| https://ludopedia.com.br/jogo/the-castles-of-burgundy-special-edition/imagens/247575 | 이미지 검색의 설명은 Setup2jogadores | 설명을 정확한2인 면·슬롯의 증거로 대신하지 않음 |
| https://boardgamegeek.com/filepage/271317/castles-of-burgundy-tile-distribution | 직접 요청403 Forbidden. 파일 미확보 | 검색 설명에는 판본을 명확히 해 달라는 댓글도 보인다. 다른 판본의 분포를 SE에 대입하지 않음 |
| https://gamefound.com/en/projects/awaken-realms/castles-of-burgundy-special-edition/updates/20 | 공식 캠페인 페이지 조회, 본문 추출0줄 | 새 플레이어판 소개 이미지가 검색되나164개 앞면/뒷면 전수 구성표를 확보한 것은 아님 |

3/4인 슬롯 데이터는 market-recipes.ts에 저장했다. 공급처별4개 지형은 각각 다음과 같다.3인은 각 줄의 마지막4표시 슬롯을 제외하고,6번의성슬롯은 B/D에광산으로바꾼다.

1. 수도원·건물·선박·가축(4)
2. 건물·수도원·성·건물(4)
3. 건물·선박·가축·수도원(4)
4. 가축·선박·건물·광산(4)
5. 광산·건물·수도원·건물(4)
6. 건물·가축·성(3BD)·선박(4)

검은 슬롯은4인8개,3인6개다. 공식 슬롯을 구현했어도 현재 타일 구성비는 자체 연습 데이터이며 공식164개 카탈로그로 표시하지 않는다.2인 면의 전체 도상과 가축 종/수별 개수·뒷면 및 건물 종류별 뒷면의 전수 근거가 남아 있다. 원본PDF의7×8건물/7×4가축 및 종류별 합계는 확인했지만 세부 분포를 그 합계로 추정하지 않았다.
