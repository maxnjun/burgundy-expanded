# 디자인 1 ON/OFF — 구현·검증 완료 / 안전 백업 (2026-10-28)

- 기본OFF, 게임 준비/온라인 게임 설정의 디자인1 스위치. ON=이전 질감 전부, OFF=기존 영지/아이보리 주사위/포도밭/격자/공용SVG패턴. localStorage key burgundy-expanded:design-1-v1, 즉시 적용/다음접속 유지·온라인 브라우저별 독립. 원래 디자인/에셋 보존, 게임/서버/저장/난수/규칙 무변경.
- 최종 프로덕션 신규/표면3엔진15/15(PC5+Chrome터치5+WebKit5), 기존 관련PC28/28. 선택 주사위 유지, 미리보기 중 OFF/ON→회전→확정→reload→Undo, 실제 서버revision/게임상태 불변을 검증했다.
- 전체PC210개 실행:205통과·모바일전용3제외·초기가림검사2실패. 실제SVG/동일PNG를 브라우저Canvas에서 분리해 재페인트 RGB1~2 오차를 제거하고, 오차0/완전일치·아래타일 노출 검출 조건을 유지했다. 2/3/4인2회씩6/6 재검통과로 실행대상207개 검증 완료. 실제게임100/160/200% 캡처·경계검사 그대로 유지. 초기 reload테스트는 저장 revision 준비를 기다리도록 보완했다.
- core515/515·boards33/33·최종 타입/전체린트/프로덕션 build-final·질감16 재현·기존타일 경고0/배포PNG98 통과. 방패AI25라운드·기존 온라인/저장/재접속/보상/점수 회귀 포함. 실기기·운영 Redis 플레이는 이번 범위 밖.
- 백업범위37파일(이전 시범+이번토글/검사/문서). 기존 dirty PNG2/문서본문/입력 보존·민감파일 제외·이번 문서접두사만 선별. 대상브랜치 codex/design-1-toggle, 운영main 미변경. Commit/일반Push와 원격SHA 실제결과는 Git 기록·최종보고 및 .local-data/design-1/backup-result.json을 따른다.
- Render live Auto-Deploy 조회인증 없음→사용자가 허용한 별도 브랜치만 사용. 기존public저장소 Push허용 유지/공개설정 무변경. 기존 CI/release는 main조건, 커밋 [skip render] [no-deploy]. Render Deploy/API/ManualDeploy/환경변수/재시작을 실행하지 않는다. 운영health 사전SHA=원격main=12e773f; 백업 후 같은 버전인지 읽기로만 재확인한다.
- 증거 .local-data/design-1/: production/(15), regression/(28), full-pc.log, occlusion-svg/(6), core/boards/types-final/lint-final/build-final 로그 및 settings/design-on/off-{desktop-1280,mobile-390,iphone-webkit}.png. 화면 직접 확인. 상세/변경파일/활용·복구는 docs/qa/design-1-toggle.md. localhost3000 최종 빌드·격리 file 저장소로 열어 둠.
- 남은 별도 범위: 사용자 승인에 따른 main 반영/운영 배포, 실기기/운영망 QA. 별도 브랜치 CI는 자동실행 대상이 아니므로 통과했다고 주장하지 않는다.

--- 이전 기록 보존 ---

# 중세 보드 표면 디자인 시범 — 로컬 구현·검증 완료 (2026-10-28)

- 사용자 첨부 전문 및 후속 4층 색상 지시 반영. Commit/Push/PR/모든 배포 금지. HEAD 12e773f/스테이징 비움 유지. 기존 dirty 문서 본문·수도원27/28 PNG·입력 자료 보존.
- 빈 영지6지형+색상 요구 주사위(공통 눈 배열/36크기/중심 유지), 빈 포도밭 actual layer 1~4=#27664A/#79A64C/#C1C99A/#E9C66C·층별2패턴/아이보리 주사위/밝은 글자 바탕, 약한 양피지/지도 펜화/기존 폭 목재 프레임/패널 질감 구현. 기존 게임 그림/배치좌표/규칙/서버/저장/난수 무변경.
- 공통 EmptyEstateCell/VineyardCellSurface는 로컬/온라인 양쪽에서 재사용. 정적 WebP16장 합계75,810B+지도SVG, 실시간 노이즈필터/외부이미지/새 의존성 없음. 장식 pointer-events none, 기존 그림이 놓인 칸에는 빈칸 질감0.
- 최종 검사: core515/515·boards33/33, 타입/전체린트/프로덕션 build-final/기존타일 경고0/질감16 재현 --check 통과. 최종 신규/주사위 PC·Chrome터치·WebKit9/9(100·160·200%, 좌표/눈/대비4.5↑/150%내부스크롤/클릭·Undo·reload), 기존 공용6/6·기존 다른회귀21/21·모바일 온라인2/2 = 선택한 브라우저38/38 검증.
- 초기 fixture 장수 오기(2→실제1) 수정, temp rename EPERM은 허용된 로컬 검사에서 재실행, 공용 장식 image0 기준은 완화하지 않고 순수SVG패턴으로 수정해6/6 재검사. 종이 반복 원형 음영/글자 뒤 강한 타원도 직접 화면 확인 후 완화했다.
- 증거 .local-data/texture-preview/: estate-comparison.png·vineyard-comparison.png·before/after-{estate,vineyard,common}-{desktop-1280,mobile-390}.png, production-browser/100·160·200%, regression/, common-final/, online-mobile/ 및 *-final.log. PC/모바일 실제 캡처 직접 확인.
- 변경파일/구현/복구 상세: docs/qa/board-surfaces-preview.md. 시작 백업 before/ 및 before.patch 유지. 이번32파일(새질감18 포함)만 작업; 원래 문서 본문은 바이트 보존.
- localhost3000은 최종 프로덕션 빌드를 격리 file 저장소(.local-data/texture-preview/rooms)로 열어 둠. 운영 Redis/기존 방/환경변수 쓰기 및 Git 업로드/배포 없음. 남음: 사용자 디자인 승인·실제 Android/iPhone 실기기/운영망 QA. 다음 작업은 사용자 요청에 따른 시범 유지/강도 조절/백업 원본 비교 복원.

--- 기존 본문 보존 ---

# 영지 완성 보상 에셋·공통 숫자·문구 정리 — 완료 (2026-10-28)

- 후속 사용자 승인으로 이번 검증된 변경만 GitHub main Commit/Push 진행. Render 배포/재시작/Manual Deploy 금지. 기준 HEAD 4b994e4. 기존 dirty 문서 본문·수도원27/28 PNG·입력 자료 보존.
- 승인 원본5파일→6종, 원본/입력 SHA 보존. 외곽 알파 동일·1024 RGBA, 공통 숫자2/3/4/5/6/7로36장+숫자6장. 5 본체220×300/중심(513,509), 6종 숫자 윤곽 차이0. 원본 숫자 뒤 중앙 영역만 보완, 바깥 프레임/나머지 그림 보존. 상세 docs/qa/estate-bonus-assets.md 및 입력 폴더 EDIT_NOTES.md.
- 공용 오른쪽 아래 기존 패널 안에 이미지 전용3열×2행. 설명·종류명·소진 문구0. 1위66px/2위49.5px(75%) 겹침·획득 후 공개. 개인 기존 상단 오른쪽에 실제 보상60/45px, 옆5점/2점 문구0·이미지 내부 숫자 유지.
- 엔진/서버/저장 형식 무변경. 기존 색상 전체 완성·선착순/소진·보유/즉시 점수·실행취소 재사용. 인원별2인5/2·3인6/3·4인7/4 유지(사용자 확정). 종료 시 중복 가산 없음.
- 검사: 전체 core515/515(신규10 포함), boards33/33,36PNG/숫자6 레이어 재현·알파·불투명 숫자 픽셀 일치, 기존 타일 검증 경고0, 타입/전체린트/프로덕션 build-final 통과.
- 최종 브라우저 신규18/18(PC·Chrome터치·WebKit) + 기존 공용/방패/점수판/온라인 조작16/16 + 기존 획득 보상1/1 =35/35. 2·3·4인 표시/100·160·200%, 75% 아래 타일 완전 가림 픽셀 일치, 로컬/온라인2인5점→2점→소진, 양쪽 재접속·Undo 검증. 격리 저장소 재생성/동시 중복은 신규 core에서 검증.
- 초기 모바일 픽셀 검사1건 불일치 후 이미지 decode/2프레임 대기를 추가했다. 완전 일치 기준 유지·집중3회/최종3엔진 모두 통과. 기존 테스트는 제거하지 않았고, 문구 검사는 실제 PNG 점수/표시 문구0 검증으로 갱신했다.
- 증거 .local-data/estate-bonus-assets/: five-point-comparison,number-crops,number-outline-overlay,all-36-variants,alignment.json,common-final-pc,common-panel-final,personal-final-mobile,online-final-iphone.png 및 core/boards/browser-verified/regression/earned-regression/types-final/lint-final/build-final 로그. 실제 캡처 직접 확인.
- 원래 문서 본문은 시작 백업에서 바이트 보존해 접두사만 추가했다. 운영 Redis/기존 방/환경변수 쓰기 없음. localhost3000은 격리 file 저장 서버로 열어 둠. 실기기·운영망/Redis/Render QA는 범위 밖이며 실행하지 않았다.

--- 기존 본문 보존 ---

- 백업: origin/main과 기준 SHA 일치·무관한 선행 커밋0 확인. 기존 공개 main Push 허용 유지. [skip render] [no-deploy]로 배포 차단, 원본/이번 코드·테스트·문서 접두사만 선별. 최종 커밋/원격SHA는 Git 기록과 완료 보고에서 확인. 기존 dirty 문서 본문/수도원27·28/무관한 입력은 백업 제외·보존.

# 개인 포도밭 보상 칸 ID 표시 제거 — 완료 (2026-10-28)

- 기준66f4355. vineyard-board.tsx의 화면용 Vxxa/b text만 제거하고, 내부slot/cell ID·aria-label·클릭/게임데이터는 유지했다. 남은 주사위/보상 묶음을 칸 중앙에 정렬했으며 이름/아이콘크기/hex좌표/색상은 무변경. 미사용 CSS만 제거했다.
- 로컬 실제게임 준비 UI로24칸/12자리/주사위24/보상명24/화면ID0 확인. .local-data/vineyard-hide-ids/personal-no-ids.png·visual.json. 기존 PC격자/클릭/배치2 + PC/Chrome터치/WebKit 표시3 통과. 타입/전체린트/빌드 통과. UI 한정이라 전체코어는 반복하지 않았다.
- 기존 dirty본문/수도원27·28/이미지 보존. 이번4파일과 문서 접두사만 선별 main Commit/Push 후 원격SHA 확인. 결과는Git/최종보고. Render Off 사용자확인·[skip render] [no-deploy] 유지, 배포/재시작/ManualDeploy/운영방·Redis 변경 없음.

--- 기존 본문 보존 ---

# 개인 포도밭 연결형·과일 정방향·보유 사탕20% — 구현·검증 완료 (2026-10-28)

- 기준3461450. 공급처 VineTile connected를 개인 배치/미리보기에 재사용한다. 원래 슬롯 중심 거리/48과 각도로 SVG만 정렬하며 격자/클릭/효과/점수/저장/서버 무변경. 상세/변경9파일 docs/qa/vineyard-placed-connected.md.
- 후속 요청 반영: 전체타일 회전이 과일에도 전파되던 구조를 수정했다. FruitGlyph를 자기 중심에서 -(슬롯각도+뒤집기각도)만큼 역회전하여 최종 화면 기준 정방향을 유지한다. 과일6종·마스크·연결 외곽 경로 변경 없음.
- 개인 보유 사탕만 clamp19.2/9.18cqw/43.2로 기존값의 정확1.2배. 공급 남은 사탕·보상 선택/점수표 크기 유지.
- 검사: 전체 core505/505·boards33/33·원본12PNG/마스크6 재현·PNG98·최종 타입/린트/build-upright 통과. 후속 정방향 최종PC/Chrome터치/WebKit30/30+일반/무료 배치/회전/Undo6/6. 원래 요청의 기존회귀24+3+10도 먼저 통과했고 반복 실행 수를 합산하지 않는다.
- 실제 과일 화면 행렬의 회전성분0/양의축 및 각 칸 중심을 검사한다. 가로/대각선 3방향×뒤집기2가지,6품종·점수·미리보기/취소/배치/새로고침/온라인두좌석 재접속 검증. 보유사탕1.2배/공급너비불변/문구비겹침 확인.
- 직접 화면 확인 .local-data/vineyard-placed-connected/{personal-upright,personal-upright-mobile,personal-upright-iphone}.png. upright.log30/30·upright-regression.log6/6, core/boards/types-upright/lint-upright/build-upright 로그 보관.
- 기존 dirty PNG2/문서 본문/입력과 모든 과일/사탕/마스크 SHA 보존. 이번9파일과 문서 접두사만 선별하여 main 일반 Commit/Push 후 원격SHA 확인. 결과/SHA는 Git 기록·최종 보고.
- Render Off 사용자 확인·[skip render] [no-deploy] 유지. 배포/ManualDeploy/재시작/설정변경·운영 Redis/기존 방 쓰기 없음. 실기기/운영망 및 새 GitHub CI 결과는 별도.

--- 기존 본문 보존 ---

# 포도 공급대·상점 연결형/남은 사탕 박스 — 구현·검증 완료 / GitHub 백업 (2026-10-28)

- 기준74c7c34. 공급/상점에만 동일한 두 칸을 잇는 단일 SVG 외곽+연녹색 바탕, 기존 과일PNG를 알파 전용 마스크6개로 재사용. 중앙 이중선 없음. 원본12PNG 불변·개인/저장/도감/다른 보드·규칙/서버 무변경. 상세/파일목록 docs/qa/vineyard-supply-connected.md.
- 상점 아래 크림/베이지점선/둥근 박스와 갈색 남은 사탕 제목 탭 신설. B G O R Y K 6열, 그림 아래 실제 v.pool 재고. 모바일320/375/390px 가로 잘림 없이 유지.
- 검사: core505/505·boards33/33·원본12PNG/마스크6 재현·PNG98·최종 타입/전체린트/빌드 통과. PC/Chrome터치/WebKit24/24·기존 공급/상점/2·3·4인/포도/무료 보상PC11/11·클린 화면/동일정렬3/3 통과. 반복 수를 합산하지 않는다.
- 200% 픽셀 캡처를 기존 고정바가 덮은 경우 테스트에서 기존 설정OFF, 온라인 선택자는 실제 필수 선택 영역으로 수정했다. 중앙 연녹색 픽셀 기준은 유지. 모바일 툴팁은 헤더터치로 정상 닫고 재촬영. 실제 PC/320px/WebKit 화면을 직접 비교했다.
- 증거 .local-data/vineyard-supply-connected/{before-desktop,after-desktop,after-mobile-320,after-iphone,comparison}.png 및 *.log. 실제 두 좌석에서 토큰 획득 후 재고/재접속을 확인했다.
- 기존 dirty 문서 본문·수도원27/28 해시 보존. 기존 과일/사탕12PNG SHA, 게임/서버/개인보드/공용좌표 무변경. 운영 Redis/기존 방/환경변수에 접근·초기화 없음.
- 최신 사용자 지시에 따라 이번16개 관련 파일과 문서 접두사만 선별해 main 일반 Commit/Push 후 원격SHA 확인. 커밋/푸시 결과는 Git 기록·최종 보고. 기존 Render Off 사용자 확인과 [skip render] [no-deploy]를 유지하며 배포/Manual Deploy/재시작/설정변경은 하지 않는다. 실기기/운영망 QA는 별도.

--- 기존 본문 보존 ---

# 승인 과일6·사탕6 에셋 적용 — 구현·검증 완료 (2026-10-28)

- 기준 main f9a3f11. 승인 단일 원본을 그대로 분리한 과일768×768/사탕512×512 RGBA12개. 원본/이전SVG 보존·RGB변경0·추출 재현 검사 통과. 입력/출력/매핑/변경 파일 상세 docs/VINEYARD_ASSET_IMPORT.md.
- UI B=블루베리 K=딸기 G=샤인머스켓 O=귤 R=복숭아 Y=패션후르츠. 게임 색상ID/51장/좌표/4층/최대5토큰/난수/규칙/저장·서버 무변경.
- 공통 FruitGlyph/VineTile로 영지/미리보기/저장/공급/상점/도감/기록 연결. 사탕 보상/보유/공급/점수표·UI 전용 이름. 차지한 칸 문자·주사위·중복 SVG테두리 제거, 빈칸/외부 요구 주사위와 층 경계 유지. 사탕 공급 너비 약50%, 개인 보유16~36px.
- 검사: core505/505·boards33/33·격리 저장/HTTP/WSS/재시작7/7·PNG92·일러스트6/자원2 경고0·타입/린트/최종빌드 통과. 최종PC/Chrome터치/WebKit36/36 및 기존 포도/공급/도감PC15통과(모바일전용3제외).
- 첫 관련 브라우저68통과/휠1실패. 기존 WebKit 합성 wheel을 렌더2프레임 뒤 보내도록 테스트 타이밍만 보정, 정확10%·100/160/200 기준 유지 및 동일검사3회/최종3엔진 모두 통과. 신규 reload DOM 대기도 hydration 완료를 기다린다.
- 실제 캡처 직접 검토: .local-data/vineyard-art-6ODuhn/screens/{desktop-board,mobile-board,mobile-supply,iphone-board,online-board}.png. 원본 비교12종 preview-sheet.png. 최종검사 browser-final.log/related-pc.log, 모든 증거는 같은 체크포인트 폴더.
- 보존: 이전 문서 본문과 미커밋 수도원27/28 해시 일치. 이번 관련 파일/문서 접두사만 명시 선별해 main 일반 Commit/Push 후 원격SHA 확인. 결과/SHA는 Git 기록·최종 보고.
- Render Auto-Deploy Off 사용자 확인. [skip render] [no-deploy]로 배포 제외. Render 배포/재시작/설정변경·운영 Redis/기존 방 쓰기 없음. GitHub CI와 실기기/외부망 검증은 별도이며 전체 프로젝트 완료로 간주하지 않는다.

--- 기존 본문 보존 ---

# Ver.3 8개 수정 — 구현·검증 완료 / Render 미배포 (2026-10-27)

- 기준 main d3d5106. 항목별 최초 원인·변경 파일·구현·검증 결과: docs/qa/ver3-8.md. 체크포인트 .local-data/ver3-0peRz2/. 1~8 모두 완료하며 전체 프로젝트/실기기/운영 Redis 완료를 뜻하지 않는다.
- 구현: 공급된 상품 원위치 빈칸·성/포도/흰 보상+미사용 실제 주사위 방패·16번 공통2단계 눈금UI·일반 영지 합법 배치 비용 PNG×수량·5번 실상품/3종 제한·6번 상대만·하프물범 독립 ON/OFF와 신규 기본ON·타일 앞쪽 그림/출처별 실제 색·보정 눈금 기록.
- 보존: 기존11 무료 획득과 결합을 별도 선택·두 실제 주사위 중 선택·실제 주사위1개/일꾼 정확 소비·흰 주사위/RNG 보존. 구형 정상 보상/방패5 메뉴만 읽기 시 메모리에서 갱신한다. 기존4층/최대5토큰·인증/저장/재접속·온라인 방/Upstash/환경변수·원본PNG 무변경.
- 검사: 전체 core/server/AI505/505·boards33/33·격리 서버 재시작/저장/HTTP/WSS 계약7/7·PNG80 통과. full-pc186통과/모바일 전용3제외/실패0. 마지막 비용 안내/선택 정리 후 build-verified·types-after-build·lint-release 및 PC/Chrome실제터치/WebKit실제터치33/33 재검증. 로그/화면을 구분하며 반복 수를 합산하지 않는다.
- 화면: screens/의 영지 비용·상품 빈칸·방패16·방패5·온라인 Undo·색상 기록 실제 캡처 확인. 처음의 신규 버튼 선택자 오류는 수정했고, 예전 기록/숫자select/공급 후5개 표시 기대값만 새 요구에 맞춰 갱신했다.
- 백업: 관련31파일과 이번 문서 접두사2개만 명시 선별 Commit/일반 Push, 원격 SHA 확인 절차. 결과/SHA는 최종 채팅·Git 기록. 기존 dirty 수도원27/28 해시·문서 원문·asset-inbox/ZIP은 보존/제외한다.
- Render staging blueprint는 Off이나 실제 서비스 인증은 없어 autoDeploy 직접 미확인. 공식 [skip render]와 기존 release [no-deploy]로 배포를 제외하며 Render 배포/재시작/설정변경 없음. 운영 Redis에 쓰거나 기존 방을 열지 않았다.
- 남음: 사용자 수동 배포 판단·새 GitHub CI 결과 확인·실제 기기/외부망/실Upstash 정밀QA. 구버전 바이너리로 보상 선택 중 방을 무검증 롤백하지 않는다. 전체 프로젝트의 다른 TODO는 유지한다.

--- 기존 본문 보존 ---

# 성·광산 이미지 GitHub 백업 준비 (2026-10-25)

- 기준 main e2d5604 및 실제 origin/main 일치. 새 성/광산 4PNG+illustrations manifest가 미커밋으로 유지됐으며, 후속 작업 전후 해시가 같은 수정본임을 확인했다.
- 현재 그림을 재생성/덮어쓰기하지 않고 5개 런타임 파일과 재현 입력5개·import 스크립트·가이드/노트를 선별한다. 혼합 PROGRESS/TODO는 이번 접두사만 스테이징한다. 수도원27/28·다른 승인 원본 폴더·이전 문서 본문은 보존/제외한다.
- 이번 검사: node --check 및 import-castle-mine.mjs --check 통과(RGB 변경0), 공통 일러스트6/아이콘2 경고0, 배포 PNG80 통과. 검증 보고서는 기존 것을 덮지 않고 .local-data/castle-mine-push-hzSSUO/validation에 생성했다. 원본/파생/마스크의 해시·수정시각을 보존한다.
- Render staging blueprint는 autoDeployTrigger:off. 실제 서비스의 현재 설정은 인증이 없어 미확인이다. 공식 [skip render] 및 기존 GitHub release의 [no-deploy] 제외 조건을 사용하며 Render 배포/재시작/Computer Use는 실행하지 않는다.
- 백업 절차: 이번 변경만 main에 일반 Commit/Push 후 원격 SHA 확인. 성공 여부/SHA는 최종 채팅과 Git 기록으로 확인한다. 다음: 사용자 수동 배포 판단 및 남은 별도 TODO. 체크포인트 .local-data/castle-mine-push-hzSSUO/.

--- 이전 진행 본문 보존 ---

# Ver.2 14개 수정 — 구현·검증 완료 / Render 미배포 (2026-10-25)

- 기준 cb28918에서 중단된 구현을 재사용해 1~14를 완료했다. 최초/최종 상태·원인·변경 파일은 docs/qa/ver2-14.md. 14번은 방패 PNG 흰 hover 덮임이며 툴팁 규격/위치는 바꾸지 않았다.
- 공통 판매 무역로·시청 무료 포도/구형 선택 호환·실제 주사위/타일 기록(+0/좌표 정리)·일꾼 그림 비용/개인 클릭·토큰/획득 보너스·개인 드래그 토글 제거·고정 설정·180도 미리보기/확정·방패 색상/비용 비겹침 구현.
- 최종 core 494/494, boards 33/33, PC179통과+모바일 전용3제외, Chrome터치46통과+PC전용2제외, WebKit41/41. 격리 HTTP/WSS/저장·서버 재시작7/7, 타입/전체린트/빌드, PNG80/일러스트6/아이콘2 경고0/SVG토큰12 검사 통과.
- 모바일 신규 수치 검사 DPR1 한 건이 정상 그림의 AA 차이3.20으로 실패했다. 기준3/질감15%는 그대로 두고 신규 수치 검사를 DPR2로 분리했으며 3엔진 2회씩6/6 통과했다. 기존 DPR1 기능/에셋 검사는 유지. 이전 UI 기대값 검사도 삭제/완화 없이 갱신해 최종 전체 통과.
- 마지막 옛 포도/방패 좌표 표시 정리 후 코어494/보드33·빌드/타입/린트 및 최종 빌드 브라우저2/2 재확인. 로그 .local-data/ver2-14/{release-*,final-desktop.log,verified-mobile-final.log,final-webkit.log,verified-color.log}. 화면에서 정상 방패 번호/그림·비용 간격·모바일 설정 패널 확인.
- 원본/미커밋 PNG7개·관련 에셋 가이드와 PROGRESS/TODO 기존 본문 보존 대조10/10. 초기 before.patch·재개 resume-worktree.patch·preserved-resume.json 보관. 이번 커밋은 명시적56파일과 혼합 문서2개의 새 접두사만 선별한다.
- 저장형식/4층2·4·5·1/시작1+층4=최대5토큰/게임방/재접속/난수/기존 규칙 유지. 실제 운영 Redis/방/환경변수에 쓰기·삭제·초기화 없음. 이전 판매를 소급 정산하지 않는다.
- 백업 절차: [skip render] [no-deploy] 커밋을 기존 승인된 공개 main에 일반 Push하고 원격 SHA를 확인한다. 결과/SHA는 최종 채팅과 Git 기록에서 확인한다. 이번에는 Render를 배포하거나 배포 완료를 기다리지 않는다.
- 다음 작업: 사용자 수동 배포 판단, 필요 시 GitHub CI 결과 확인, 실기기·외부망·운영 Redis 정밀 QA 및 기존 별도 TODO. 이번14항목 미완료 구현 없음, 전체 프로젝트 완료로 간주하지 않음.

--- 이전 기록 (보존) ---

## CI 글꼴 단계 점검 — 설정 보완·전체 재검사 준비 (2026-10-25)

- 완료 로그를 확보해 정정:200fe13 CI40113380264는 성공, Noto CJK 설치3.3초였다. 상태 API 지연을 설치 정체로 오판했다. 실제 PC19.4분/Chrome4.0분/WebKit5.5분. 코어486·보드33·저장/배포7·PC173/Chrome40/WebKit35 및 린트/타입/두 빌드 통과. 상세 docs/qa/ci-font-setup.md.
- 이번 범위는 CI만: 기존 한글 스크린샷의 Noto CJK 유지·비대화형설치5분·다운로드 재시도2/HTTP·HTTPS30초/잠금60초·한글폰트존재검사. Playwright 설치10분 제한·PC/Chrome/WebKit 단계 명명. 기존 모든 검사 명령/대상/기준/전역60분 제한 유지. 게임·서버·이미지 무변경.
- YAML 파싱·전체 검사명령/빌드 환경/권한/제한 보존 자동검사 통과. Git Bash 문법검사 후 이 CI변경만 [skip render] [no-deploy] 커밋/Push→전체CI→기존Render 최신SHA배포/온라인복구 확인 순서. 현재200fe13 운영·18PNG해시/두좌석실측1.18/복구 확인. 기존Redis/방/미커밋자료 보존.

## 방패18종 PNG/장착18% 확대 — CI 픽스처 보완·재검증 준비 (2026-10-25)

- 기준 main a05e7e6. ZIP18종의 실제 체크무늬를 분리하고 원본RGB/비율을 유지한1200×1480 RGBA와 번호/해시 manifest를 public/shields에 등록했다. 입력은 asset-inbox/shield-approved/originals 보존. 상세 docs/SHIELD_ASSET_IMPORT.md.
- ShieldArt 공통 적용·중복 SVG 그림/점수/번호 제거·성 장착 자식만1.18·상세 확대·새 해시 캐시. 성의 중심/클릭·공급처 좌표/크기는 유지한다. PNG 번호를 가리지 않도록 비용 배지만 기존 빈 여백으로 옮겼다. 게임/서버/Redis 코드는 무변경.
- 코어486/486·보드33/33·격리 HTTP/WSS/저장 재시작/Upstash REST 계약7/7·타입/전체린트/프로덕션 빌드 통과. 에셋80 PNG/원본18해시/재현 통과·일러스트6/자원2 경고0. 최종 방패 PC·Chrome390·WebKit390 9/9,100/160/200%·2/3/4인·중심/클릭·성 내부 포함·fallback·게임 상태 불변 확인. 실제 화면 screens/before-after,pc-estate,mobile-estate,pc-common 등을 직접 확인했다.
- 전체PC176=172통과/3대상제외/1테스트 HTTP 정리 시간 초과. 정리 코드 보완 후 같은 방 전환/포도 획득 PC·WebKit4/4. 모바일84=76통과/4대상제외/방 전환 정리1실패(수정 재검증 통과)/기존 Chromium CDP 전용3개 WebKit 실행불가. Chrome40/40. 실제 기기·운영 새 아트는 미검증. 상세 docs/SHIELD_ASSET_IMPORT.md, 로그 .local-data/shield-assets/.
- 149eb25 일반Push 완료·origin/main SHA 일치. 첫CI40110925485의 코어/보드/린트/빌드/타입/배포 계약 통과, PC172통과/3대상제외/1초기화 픽스처 경합 실패. 새 문서 초기화 전 테스트 데이터 주입으로 보완하고 PC/Chrome/WebKit 각각3회9/9 통과·타입/해당 린트 통과. 다음: 이 테스트 보완만 별도 커밋/Push→전체CI→Render 실제 SHA/자산 확인. 149eb25는 아직 배포하지 않는다.
- 기존 성·광산/수도원27·28/기타 미커밋 입력과 문서 꼬리는 포함하지 않는다. Render health는 기존 a05e7e6, 인증/훅이 없어 사용자가 CI 통과 후 수동 배포하기로 했다. 자동 승인 검토가 Git 자격증명을 추출해 배포 메타데이터를 읽는 방식을 거절해 해당 조회는 중단했다. 운영 방/Redis/환경변수 무변경·유료 작업 없음.

## 15개 수정 — 검증 완료·운영 반영 보류 (2026-10-24)

- 기준 e2d84fe. 1~7/9~15 완료, 8은 지원 포도보드ID1종의 저장/복원만 완료(서로다른 보드 자료 부족). 임의 변형/RNG 변경 없음. 상세 항목별 원인/파일/근거/한계: docs/qa/fifteen-fixes.md.
- 구현: 공통60° 회전(두 보관함 그림/실슬롯방향)·확정/마지막 보상 자동·상품5눈금·개인 주사위 강조·sticky·두 보드 fit/점수 아래·실제 영지번호·5상품 공개/구형deal 읽기전용 복구·1~10칸 실점수·원래 밝기·검은문구 제거·무료/은화/수도원6 입력 분리·방패 유지/정확한반환/구형출처선택·기존방 버튼/초대URL 일치.
- 검사: 최종 전체코어486/486·보드33/33·Node 재시작/HTTP/WSS/격리 파일·Upstash REST 계약모형7/7·빌드/타입/전체ESLint 통과. 안내/직접입력/단계/구형방패 관련36/36·구매로 선택지가 생기는 보상을 자동 포기하지 않는 경계73/73 통과. 실제 운영 Redis/실기기/외부망은 미검증.
- 브라우저: 전체PC165 중156통과/6실패/모바일전용3제외→옛 유지비2·고정픽스처1·180°기대1·행스크롤기대1 및 PC구매체크박스숨김1 수정. 실패6 포함 관련PC45/45, Chrome터치/WebKit40/40, 수도원6 6/6,375/768px22/22, 포도상점 무료/유료3/3, 전체보드 캡처3/3 통과. 좌석/URL·기존 온라인 추가12/12 통과(browser-seat.log). 테스트 삭제/기준 완화 없음.
- 최종 자동 보상 경계 변경 후 PC/Chrome터치/WebKit21/21 추가 통과(browser-final-auto.log). 실제 온라인 구매→무료 배치·은화/주사위·상대 화면·수동 턴 유지 검증. 최종 core-final-auto486/486·build-final-auto/types-final-auto/lint-final-auto 성공.
- 호환: v1/0.2.1 유지, 공개 상품/보드ID/방패 출처는 optional. 기존 장착 출처는 사용자 승인대로 반환 공급처 선택. 구형 유지비는 정확한 기존 메뉴일 때만 메모리에서 갱신하며 GET 원본 무변경 검사. 새 반환 슬롯/출처를 모르는 옛 서버로 무검증 롤백 금지.
- 보존/산출물: 기존 dirty 문서꼬리·수도원27/28·asset-inbox·원본 ZIP/PNG 보존/커밋 제외. .local-data/fifteen-fixes/ 로그, screens/ PC·모바일·온라인·가로 이미지 직접 확인. 작은 휴대폰은 전체 보기 후 보드 확대/이동 사용.
- 배포: render.yaml Auto-Deploy Off, 기존 release [no-deploy] 제외 확인. 실제 운영 Render 설정을 읽을 인증이 없어 Push도 보류한다. 이번 변경만 [skip render][no-deploy] 로컬 main 커밋으로 보존, 원격/운영 방/Upstash/유료 리소스 변경 없음. 다음: 실제 Auto-Deploy Off 확인 후 필요시 Push, 사용자의 명시 배포 요청 전 운영 반영 금지; 추가 포도보드 데이터 확보; 실기기 정밀 QA. 전체 프로젝트 완료로 보고하지 않음.

## 온라인 자동 저장·재접속 복구 — 로컬 검증 완료/배포 보류 (2026-10-24)

- 기준 main2a36666. 운영 Upstash/기존 온라인 방/원본이미지·기존 dirty 문서꼬리·수도원27/28·asset-inbox·입력ZIP/프롬프트 보존. 이번은 Render 배포·재시작·환경변수/데이터 초기화 없이 main 백업만 한다.
- 기존 구조: 전체 StoredRoom.game(난수 seed/cursor·주사위·턴·단계/라운드·영지/공급·보관함·자원/상품·점수·모든 확장·필수효과), 해시 좌석토큰, Undo, 시작성 미리보기, 로비/영지후보가 이미 Redis CAS에 저장되어 있었다. lock/event/weak revision은 메모리 보조 상태다. 부족했던 것은 확정 직후 응답 유실의 성공 확인과 동일 요청 중복 방지였다.
- 서버: 선택적 requests(최근128개의 ID/좌석/본문해시)를 상태와 같은 CAS JSON에 확정. 같은 요청은 현재 뷰 반환, 다른본문/좌석/오래된revision 거부. 겹치는 프로세스409·Redis 응답 유실은 재조회로 확정 확인. Undo 밖에 기록해 취소 후 이전요청 재전송도 재실행하지 않는다. 기록이 제외돼도 원래revision은 거부된다.
- 복귀: 기존 256비트 생성 좌석토큰·서버SHA256/상수시간검증 재사용. 브라우저에 토큰을 중복 저장하지 않고 별도 행동큐에 ID/원래revision/본문을 전송 전에 기록한다. 같은ID로 확인·복구 후 삭제, 재연결/미확인 중 입력차단·선택상태 재동기화, GET/WS/행동 확인 최대15초 지수대기, 수동재시도. 제출 오류와 연결 오류를 분리해 거부 이유가 동기화 직후 사라지지 않는다.
- 호환: StoredRoom v1/engine0.2.1/protocol1/roomFormat1 유지. 없는 requests는 읽은 객체에서만 빈 배열로 정규화하며 GET은 원본을 다시 쓰지 않는다. 미래 방/엔진 형식은 ROOM_SCHEMA_UNSUPPORTED로 멈추고 손상 데이터도 보존한다. 기존 parseSavedGame/포도밭 업그레이드는 그대로 사용한다.
- 최종 검사: 전체코어475/475(core-all-final)·보드33/33(boards)·타입/전체ESLint/프로덕션빌드(build-final/types-commit/lint-commit) 통과. 전체PC156통과/모바일전용3제외(browser-full-pc). 이후 미래엔진형식 안내/오류표시 보완 뒤 관련PC13/13·Chrome터치20/20(PC전용2제외) 재검증(browser-final-pc/mobile).
- WebKit/경합: 관련15개 중14통과/응답유실1건 시간초과. trace에서 자동 복구로 사라진 수동버튼을 기다리는 신규 검사 경합을 확인해 망 복구는 online 이벤트로 수정했다. 수동버튼은 별도 영구 오류 상태에서 물리 클릭 검증을 유지했다. 게임상태/ID/중복자원 판정은 그대로, 수정 후 WebKit복구3/3(browser-webkit-recovery)·같은 흐름PC/Chrome6/6(browser-recovery-final) 통과. 초기 새 코어 검사의 game.extensions 오타는 game.config.extensions로 수정했고 기존 테스트 삭제/기준 완화 없음.
- 실제 프로세스 검증: deployment-final7/7. 외부 저장이 확정되고 HTTP 응답은 보내지 않은 시점의 실제 Node 서버를 SIGKILL→빈 로컬 디렉터리/새 서버버전으로 시작→기존토큰/같은요청ID로 복원, 자원1회/원문/양쪽상태·WebSocket 복귀 확인. 기존 v1·미래형식·서로다른서버/두플레이어 동시제출·배치포도/층/토큰/장착방패 복원도 코어에서 확인.
- 범위/한계: 외부 저장은 격리 Upstash REST 계약모형이며 실제 Redis Lua 엔진/실계정·Android/iPhone 실기기·외부망 검증이 아니다. 운영 Redis에 쓰기/삭제·기존 방 생성/변경 없음. 첫 운영health 읽기30초 지연 뒤 재조회200/version2a36666/protocol1/roomFormat1 확인(이전98e와 앱소스 동일한 문서커밋).
- 백업/배포: 모든 이번 커밋에 [skip render][no-deploy]를 넣어 Render 자체 자동 배포와 기존 Game release를 보류한다. 구현 f6eba9013d18821ade8d0632a25e566d167a0419 main Commit/일반Push·원격SHA 일치 확인. Push후 health200/version2a36666/protocol1/roomFormat1 유지 확인. [GitHub CI40085392311](https://github.com/maxnjun/burgundy-expanded/actions/runs/40085392311)는 실행 중이며 원격통과로 보고하지 않는다. 상세 설계/파일/검사는 docs/deployment/ONLINE_RECOVERY.md, 로그 .local-data/online-recovery/. 이 완료기록은 [skip ci][skip render][no-deploy] 문서 전용 백업으로 운영에 반영하지 않는다. 다음: 원격CI 결과 확인·사용자 명시 배포 요청 대기. 전체 프로젝트 완료나 실제클라우드/실기기 검증으로 보고하지 않는다.

## 영지/포도밭 점수판·Render 배포 완료 (2026-10-24)

- 기능/배포 커밋: 98e62a3c96957c56abe4fc74dfee691654753e39(main 일반Push·원격 SHA 일치). 최초 구현d3c71f6, 모바일 너비 보완98e62a3. 이 완료 기록 커밋은 앱 변경 없이 [skip ci][no-deploy]로 백업하므로 실제 서비스의 기능 SHA는98e62a3이다.
- UI: 공용950×1030의 기존 좌하단390×155 영역과 각 개인 영지 우하단에 영지1/2·포도밭2/2·▲/▼. 각 컴포넌트의 페이지 선택은 독립된 로컬UI 상태이며 게임 revision/난수/저장 형식에 넣지 않는다. PC390px·모바일 최대100vw-32px(390px화면에서358px), 영지/공급/포도밭 좌표와 원본 이미지는 유지한다.
- 점수: 영지 기본 점수표는 regionSizePoints, 현재 누적은 victoryPoints. 포도밭은 기존 종료 정산의 연결 영역/토큰 판정을 vineScoreBreakdown으로 공유하여 품종별 토큰·채점 영역·종료 예상 점수를 표시한다. 예상 점수를 누적에 더하지 않는다. 확장 비활성은 미사용 안내. 4층·시작1+완성4토큰 규칙 그대로.
- 온라인: 기존 공개 RoomView의 players/vineyards로 두 화면 점수가 갱신된다. 새 서버 DTO·저장 마이그레이션·권한 변경 없음. 격리 서버에서 실제 포도 획득→배치→후속 효과 후 양쪽 점수/누적 갱신·재접속 검증.
- 로컬 검사: 전체 코어471/471·보드33/33·HTTP/WSS/격리 저장 배포7/7, 전체 ESLint·타입·프로덕션 빌드 통과. 최종 browser-responsive.log PC/Chrome터치/WebKit15/15(100/160/200%·키보드·2/3/4인·비활성확장·게임상태불변), browser-regression.log 관련PC8/8(방패2/3/4인·온라인보드·Undo·시작성·고정포도효과·상품/무역로).
- 원격 검증: [Game CI40075189920](https://github.com/maxnjun/burgundy-expanded/actions/runs/40075189920) 최종98e62a3 전체 성공. 코어471·보드33·배포7·PC153통과/3제외·Chrome터치17통과/2제외·WebKit12통과·버전빌드/타입/린트 통과. 제외5건은 해당 프로젝트 대상이 아닌 기존 테스트의 조건부 제외이며 실패0. ci-summary.log 보존.
- 실제 배포: GitHub Actions secrets/Environments0개로 자동 배포를 가정하지 않았고, 사용자가 기존 Render 수동 Deploy 방식을 선택했다. 기존 burgundy-expanded의 https://burgundy-expanded.onrender.com/api/health·api/version·online 모두200, health/version98e62a3·protocol1·roomFormat1을 확인했다.
- 실사이트 검증: .local-data/score-pages/verify-live.cjs 실행 성공(live-verification.log). PC와390px모바일 브라우저에서 새 QA방1개 생성→두번째 참가→공용/개인/다른플레이어 점수판 독립 전환→모바일 새로고침/재접속 성공. live/{common-vineyard,mobile-personal}.png를 직접 확인했다. 기존 방 접근/삭제·Redis 초기화·환경변수/네임스페이스 변경·유료 리소스 생성 없음. QA방은 정상 보존/만료 정책을 따른다.
- 화면/한계: .local-data/score-pages/{responsive,screens}/ 및 mobile-visible.png. PC·모바일·WebKit 캡처 직접 확인. 로컬 모바일 캡처가 기존 고정HUD 아래로 스크롤되어 가린 장면은 제외하고 화면 중앙으로 옮긴358px 캡처에서 잘림 없음/중앙 hit target 확인. 실제 Android/iPhone 실기기와 다른 네트워크, 기존 사용자 방별 토큰 재접속은 이번에 미검증. 자동 배포 훅은 설정되지 않았으므로 이후 배포도 수동 또는 별도 보안 설정이 필요하다.
- 변경 파일: src/app/{score-pages.tsx,score-pages.css,common-board.tsx,game-screen.tsx,online/room-screen.tsx}, src/game/vineyards.ts, tests/{core/vineyards.test.ts,browser/score-pages.spec.ts}, .github/workflows/ci.yml, docs/{PROGRESS.md,TODO.md}. 시작시 기존 dirty 문서꼬리·수도원 원본27/28·asset-inbox·입력ZIP/프롬프트는 백업 제외/그대로 보존했다. 다음: 이 범위 완료, 사용자 다음 지시 대기. 전체 프로젝트/실기기QA 완료로 보고하지 않는다.

## 터미널 기반 Render 반영 준비 (2026-10-24)

- 사용자 지시: Computer Use/브라우저 직접 자동 조작 없이 Git·터미널만 사용. 기존 Render burgundy-expanded/Upstash staging 유지.
- 시작: main/dafe34d18e688ed9c75663ab8e4e22bbb99eaf58와 원격 main 차이0/0, 앱 소스 미커밋 없음. 기존 dirty 문서꼬리·수도원 원본27/28·입력 ZIP/asset-inbox는 이미 승인 최종 PNG와 구분해 보존한다. 최종 배포 PNG62개 SHA/해상도/RGBA 헤더 검사 통과.
- CI40015013553 실패 원인은 기존 player-inventory-zoom의40px 기대값 잔존(실제52px). 합의된 상품52px×배율로 수정하고 겹침·판매·Undo 검증은 유지. 기존 원격 PC147통과/3모바일 전용제외/1실패 결과와 이번 실행을 구분한다.
- 이번 터미널 검사: 코어471/471·보드33/33·HTTP/WSS/격리파일·Upstash REST 모의 배포7/7, TypeScript·ESLint·프로덕션 빌드 통과. 로컬 브라우저 테스트/Computer Use는 요청대로 실행하지 않았다.
- 실제 사이트 HTTP 읽기: /api/health·/api/version·/online 모두200, 현재 version32e895a5c174c5304b0375930a345491dfbf181f/protocol1/roomFormat1. 최신 버전 배포 완료가 아니다. 실제 기존 방/Redis 쓰기·삭제 없음.
- render.yaml 자동배포Off 유지. 기존 CI배포는 성공CI와 계정의 활성화 변수/배포훅이 필요하므로 Push만으로 반영된다고 주장하지 않는다. 이번 준비 커밋은 [no-deploy]로 백업하고, 사용자 수동 배포는 docs/deployment/FREE_RENDER.md의 기존 서비스→Deploys→Manual Deploy→Deploy latest commit 순서. 새 리소스·유료 옵션·환경변수 변경 없음.
- 변경: tests/browser/player-inventory-zoom.spec.ts(40→52), docs/deployment/FREE_RENDER.md(실제 URL·수동 단계), 이번 PROGRESS/TODO 접두 구간만. 기존 여관 완료 문서꼬리는8a60c2f 이력과 대조했으나 다른 작업으로 남겨 둠. 원본27/28은 현재 최종 수도원 이미지 경로에 쓰이지 않는 보존 자료이며 이번 배포에 포함하지 않음.
- 백업:70f023145d5c9221995a44723d75a8d87a581c76 main Commit/일반Push·원격 SHA 일치 확인. 이 결과 기록도 별도 main 백업한다. 남음: [최신 main CI](https://github.com/maxnjun/burgundy-expanded/actions/workflows/ci.yml) 결과 확인, 사용자의 수동 배포 후 health버전/온라인 새방 생성·참가 실제 확인. 미제작 방패18장은 기존SVG 유지(후속1200×1480 RGBA·회색석재·상단점수/하단번호 규격), 이번 배포 준비를 막지 않음.

## 공용 보드 은화 가격 아이콘 위치 (2026-10-24)

- 완료: 검은 공급처 타일 묶음 오른쪽18 SVG 단위에 ResourceGlyph 은화2개, 포도 상점은 마지막 상점 타일의 오른쪽 빈 셀에 ResourceIcon 은화2개. 둘 다 승인 silver-coin.png 그대로 크기26·간격6, 세로 중앙 정렬. 해당 가격의 상단 중복 아이콘 없음.
- 보존: 게임 규칙/지급·구매 로직/서버/저장·원본 PNG·기존 방 데이터 미수정. 보드950×1030·포도 공급대 크기·타일 좌표/클릭 영역 유지.
- 이번 검사: PC2/3/4인 배치3/3(qa-final.log: 정확히2개,타일 오른쪽/중앙 정렬,게임 상태 불변)·포도2/3/4인 실제구매/빈 슬롯 유지 및 온라인 검은구매/Undo/동기화4/4(related.log),100/160/200% 클릭·겹침 포함. TypeScript·관련 ESLint·프로덕션 빌드 통과. 게임 로직 변경이 없어 전체 코어는 이번에 재실행하지 않음.
- 화면: .local-data/silver-layout/pc-{2,3,4}p.png 및 screens/ 아래 가격 확대 캡처를 직접 열어 확인. 격리 픽스처만 사용했고 localhost3000 최종 빌드는 유지.
- 변경: src/app/{common-board.tsx,vineyard-board.tsx,vineyards.css}, tests/browser/vineyard-supply-layout.spec.ts, docs/{PROGRESS.md,TODO.md}. 기존 공급 테스트의 svg 선택자는 주사위도 잡으므로 .vine-tile-art로 한정했으며 원래 크기·구매·클릭 판정은 유지.
- 백업 범위는 위6파일의 이번 변경만([no-deploy]); 기존 미커밋 문서 꼬리/PNG/ZIP 제외. Render 배포 금지. 실제 외부망·실기기 검사는 이번 범위에서 수행하지 않음.

## 요구값 주사위·상품·무역로 가독성 (2026-10-24)

- 완료: 공용 보드의 기존 흰색 얼굴을 WhiteDie 하나로 통합했다. 로컬/온라인 빈 영지·후보 보드, 포도밭/공급 요구값, 모든 GoodsArt 및 무역로가 같은 눈금 좌표를 재사용한다. 배치된 칸에는 요구 주사위를 덧그리지 않으며 플레이어 색상 주사위·보상/층/점수 숫자는 유지했다.
- 크기: 영지36·후보32·포도밭20(각 빈 육각형 위쪽)·공용28 SVG 단위. 상품 저장고40→52 CSS px(슬롯74px, 실제 장수 겹침 유지), 공용 공급23→32 SVG 단위/라운드44→52, 판매 내역64→72 CSS px. 상품칸92→104 SVG 단위로 넓히고 기존 중심은 유지했다. 무역로 셀72→101px·높이110→154px(온라인94→132), 상품30→42px·보상35×40→49×56px, 설명 글자9→13px로 약1.4배. 펼친 카드는 PC/모바일 모두 가로 스크롤한다.
- 보존: 게임 엔진·서버·저장 형식·난수·판정·보상 데이터 변경 없음. 공용950×1030/영지/포도밭24칸·4층 좌표·원본 PNG와 기존 방·무관한 미커밋 파일 보존. 공용 공급 수량 배지는 타일 우상단, 개인 저장고는 숫자 배지 없이 실제 PNG/SVG 층으로 표시한다.
- 이번 검증: 전체 코어471/471(core.log)·보드33/33(boards.log), 관련 PC15/15(browser-pc.log), Chrome/WebKit6/6(browser-touch.log), 타일/상품/AI/시작 성/정산 회귀12/12(regression.log), 2·3·4인 방패/겹침100·160·200%3/3(shields.log). 최종 포도밭 배치 조정 후 신규 PC/Chrome터치/WebKit3/3(visual-final.log): 눈금1~6,24칸 요구값,보상 글자 경계 비겹침,상품52px/무역로42px·101px,판매→무역로 진행→행동별 Undo 실상태 복원. 총39회 브라우저 검사 통과이며 중간/최종 실행은 위 로그로 구분한다.
- 타입/빌드/린트: types-visual-final.log·build-visual-final.log exit0. 전체 lint-final.log 및 마지막 변경의 lint-visual-final.log exit0/경고0. 타일 프레임·혼합 인접 타일의100/160/200% 실제 브라우저 검증 통과. Python 실행 별칭이 정상 실행되지 않아 scripts/validate-tile-assets.py는 이번 로컬에서 실행하지 못했다. PNG/알파 가공 없이 공유 TileArt 사용만 유지했으며 이 한계를 숨기지 않는다.
- 시각 확인: screenshots/{before-pc,before-mobile,before-trade,after-pc,after-mobile,after-trade,after-vineyard,after-inventory,after-webkit-vineyard}.png를 .local-data/dice-readability/ 아래 보존. PC/터치/WebKit 캡처를 직접 열어 확인했다. 초기 seam 주사위가 긴 보상 글자에 닿아 각 육각형 상단으로 옮겼고24칸 모두 경계 검사 통과.
- 실행 구분: 첫 신규 테스트는 중간 저장 픽스처에 없는 차례 시작 Undo를 기다려 중단, 기존 동작에 맞는 이전 행동으로로 검사 후 통과. 초기 린트 미사용 주사위 함수2개 경고는 중복 구현 삭제로 해결했다. 테스트 삭제/기준 완화·규칙 수정 없음.
- 변경: src/app/{white-die.tsx,common-board.tsx,game-screen.tsx,online/room-screen.tsx,board-choices.tsx,vineyard-board.tsx,vineyards.css,tile-art.tsx,goods-space.tsx,player-inventory.tsx,trade-route-panel.tsx,game-screen.css}, tests/browser/dice-readability.spec.ts, .github/workflows/ci.yml, docs/{PROGRESS.md,TODO.md}. CI Chrome/WebKit에도 신규 검사 포함.
- 백업/다음: 기존 공개 main Push 허용 지시에 따라 이번16개 파일만 e6d1b019aec61d3ba7c0b4f2de3b185330328eb1 [no-deploy]로 커밋·일반 Push하고 원격 main 일치를 확인했다. Render 배포·실제 Upstash 접속·기존 방 삭제는 하지 않는다. localhost3000을 최종 빌드로 열어 둔다. 실제 Android/iPhone 기기·외부망 및 Python PNG 검증은 미실행. localhost health200 확인. [GitHub CI40008849657](https://github.com/maxnjun/burgundy-expanded/actions/runs/40008849657)는 pending이며 로컬 통과 결과와 구분한다.

## 온라인 2인 이름·색상 및 주사위 UI (2026-10-24)

- 완료: 생성/참가 이름(빈 입력은 영주 1/2), 파랑·빨강·초록·노랑·보라·분홍, 로비 본인 정보 수정. 서버가 중복 색상/다른 좌석/시작 후 변경/오래된 revision을 거부하며 수정 시 본인 준비 해제. 응답 유실 재시도는 기존 좌석을 복구하고 이름·색상을 덮어쓰지 않는다.
- 표시: 공통 팔레트를 상단/개인 주사위, 이름·현재 차례, 영지, 공용 순서 트랙, 최종 점수에 적용. 상단 주사위 58×58 CSS px·선택 강조·사용 상태·모바일 줄바꿈. 기존 4색/색상 없는 저장은 좌석 기본값으로 읽고 파일 구조·규칙·난수·타일 좌표는 유지.
- 검증: 관련 코어24/24, 전체 코어471/471, 보드33/33, HTTP/WSS/파일 및 Upstash REST 모의7/7, TypeScript·ESLint·프로덕션 빌드 exit0. 관련 PC19/19(기존 온라인4+신규 프로필1+로컬/AI/정산/방패/턴 회귀14), 모바일 Chrome4/4·WebKit4/4. 두 컨텍스트 실제 HTTP/폴링 조작으로 색상 충돌→재선택, 양측 이름 수정, 시작 성→주사위→두 Undo→수동 종료→새로고침/재접속을 확인. 실제 WSS는 별도 배포 회귀7개에서 확인.
- 시각 확인: PC1280·터치390·WebKit390 캡처를 직접 열어 58px 주사위, 색상·이름·현재 차례 및 버튼 접근성을 확인. 증거 .local-data/online-identity/screenshots/{pc-controls,pc-lobby,pc-game,mobile-controls,webkit-controls}.png. 전체 로그는 같은 상위 폴더의 *.log.
- 실행 구분: 첫 코어 실행은 Windows 샌드박스 rename EPERM→권한 확장 후 통과. 첫 신규 PC 검사는 native option disabled를 toBeDisabled로 검사한 매처 부적합→disabled JS 속성 직접 검사로 수정 후 PC/Chrome/WebKit 통과(기존 검증 완화 없음).
- 변경 파일: src/game/{player-colors.ts,types.ts,practice.ts,save.ts}, src/server/{rooms.ts,room-http.ts}, src/app/{online/room-screen.tsx,game-screen.css,game-screen.tsx,common-board.tsx,final-scores.tsx}, tests/{core/online-identity.test.ts,core/run.mjs,browser/online-identity.spec.ts}, .github/workflows/ci.yml, docs/{PROGRESS.md,TODO.md}. CI 모바일/WebKit 목록에도 신규 테스트 포함.
- 백업: 기존 공개 main Push 허용 지시 적용. 소스 c0f9589353fe86ec8dbdc2c7384eb605988faa67을 별도 커밋·일반 Push하고 원격 main 일치를 확인했다. [no-deploy]로 Render 배포 경로 차단하며 운영 사이트·실제 Upstash·기존 저장 방·원본 PNG 및 무관한 미커밋 꼬리는 변경하지 않는다. localhost3000은 최종 빌드로 실행 중.
- 미검증/다음: 실제 Android/iPhone 기기와 외부망 재시험, 운영 Render 적용은 별도 사용자 승인 후. [Game CI40002378709](https://github.com/maxnjun/burgundy-expanded/actions/runs/40002378709)는 진행 중이며 전체 CI 성공으로 보고하지 않는다. 위 결과는 이번 로컬 실행의 통과 범위다. localhost health200 확인.

# 현재 작업 — 온라인 공용 게임판 통합 (2026-10-24)

- 범위: 온라인의 별도 방패/상품/검은공급 목록을 기존 CommonBoard(950×1030)로 통합. 방패는 6개 공급처, 여관은 검은 공급처 옆, 포도 공급대·상점은 오른쪽 고정 레일. 개인 커스텀 무역로는 해당 영지 아래로 이동. 모바일도 같은 좌우 구조로 스크롤/확대한다.
- 자료: 기존 최종 common-board-layout 설계·공식 규칙서 추출 공용 보드 이미지·포도밭 복원 조사·사용자 확정 custom-trade 규칙 재사용. 포도 공급대의 화면 오른쪽 배치는 프로젝트 UI 선택이며 공식 지정 좌표라고 주장하지 않는다.
- 서버 변경은 공개 표시 DTO만: 순서 트랙/완성점수/단계상품 수량/남은 라운드상품 개수. 미래 상품 종류/덱/난수/Undo 이력은 전송하지 않는다. 엔진·저장·방 데이터·PNG 변경 없음.
- 완료 검사: 코어468/468(15)·보드33/33(16)·HTTP/WSS/파일·Upstash REST 모의7/7(20), 프로덕션빌드14·타입19/24·린트17/25 exit0. PC 온라인8/8(10), 확대/직접입력3브라우저3/3(13), Chrome터치/WebKit 온라인10/10(21), 실제탭 포함 최종 PC/Chrome터치/WebKit3/3(23). 전체 PC18: 145통과/3모바일 전용 제외/이전 방패 목록 선택자1실패. 선택자를 실제 SVG 방패로 교체 후 최종 빌드27·타입28·린트29 exit0, 관련 PC30은25통과/3모바일 전용 제외, Chrome터치31은2/2·WebKit32는1/1 통과. 동일한 행동요청0/revision불변 검증을 유지했다.
- 시각 확인: 950×1030 게임판·6방패·중앙시장·4패널·포도 오른쪽 레일을 실제 PC/Chrome터치/WebKit 캡처로 직접 확인. 증거 `.local-data/online-board/screenshots/{before-pc,before-mobile,after-pc-board,after-pc-game,after-mobile-board,after-mobile-vineyards,after-webkit-vineyards}.png`. 모든 방패/타일/상품 100/160/200% hit·겹침 검사 통과.
- 초기 실행 구분: 01-before는 테스트 HTTP 성공코드201 가정을 실제200으로 바로잡아02 통과. 코어08은 샌드박스 임시파일 rename EPERM→정상 권한15 통과. 22는 PC에서 터치 전용 숨김 구매토글까지 누르던 테스트를 중단한 불완전 실행이며 입력환경을 구분한23으로 재검증. 26 모바일 도움말4통과/2PC전용제외/옛선택자1실패도31에서 해결했다. 최종 소스는 로컬의 기존 선택ID 기반 초기화 키/불가 안내도 유지한다. 테스트 삭제/완화 없음.
- 백업: 761a17b4d103ec2d91289df12ed77d6c08df395a 일반 Push·원격 main 일치 확인. [Game CI39987233742](https://github.com/maxnjun/burgundy-expanded/actions/runs/39987233742) 전체 성공: 원격 PC146통과/3모바일전용제외, Chrome터치10통과/2PC전용제외, WebKit5통과. 최종 배포 버전 빌드까지 성공. [Game release39989487576](https://github.com/maxnjun/burgundy-expanded/actions/runs/39989487576)는 [no-deploy]로 skipped 확인. 이 결과만 문서 전용 [skip ci] 체크포인트로 추가 백업하며 게임 소스는 검증한761a17b와 동일하다. localhost3000은 최종 빌드/파일모드/기존56방·health200으로 실행 중. 실제 Render/실Upstash/외부망·Android/iPhone 실기기 재검증은 하지 않았다. Render는 사용자 추가 지시 전 배포 금지. 기존 미커밋 문서꼬리/수도원27·28/입력 ZIP·PNG는 보존.

---
# 최신 체크포인트 — 온라인 직접 입력·Undo·시작 성 확정 (2026-10-23)

- 사용자 승인 범위: 온라인 행동 실행/드롭다운 제거, 서버 스냅샷 Undo2종, 시작 성 미리보기→턴 종료 확정. 실제 Render/Upstash 데이터에 접근·삭제하지 않음. 기존 PNG/ZIP/미커밋 문서꼬리 보존.
- 구현: BoardTarget 직접클릭 재사용·필수 효과만 구체적 버튼. Undo는 기존 TurnHistory 전체상태/RNG/연쇄단위 재사용·서버 JSON에만 보관·revision 단조증가·현재차례/본인만. 새난수공개 이전/종료된턴/시작기록없는 구방은 제한 및 이유 표시. 시작 성은 서버 startingPreview에 보관·이동/Undo/재접속 후 end-turn만 엔진확정.
- 최종 로컬 검사: 코어468/468(10), 보드33/33(11), HTTP/WSS·파일/Upstash REST모의 재시작/Undo/시작 성7/7(13), PC15/15(24), Chrome터치/WebKit8/8(25), 타입26·린트23·빌드22 exit0. 실제 화면 PC/모바일 캡처 확인, 안정 경로 screenshots/pc-online-{starting-preview,undo-ready,direct-controls}.png. 기존56방/1,778,806bytes 유지.
- 초기 실패 기록: 01/05/14/21 타입 테스트/nullable 입력 보완, 06/12/16은 롤 응답/로비 참가 완료 대기·고정3000·과거 게스트 선행 확정 기대를 새 흐름에 맞게 수정. 18은 빌드와 브라우저가 겹친 불완전 실행(15통과 후 중지)으로 구분하고22빌드 후24/25 순차 재검증. 검증 삭제/완화 없음.
- 배포보호: release workflow는 head commit의 [no-deploy] 표시를 존중하도록 추가. 이번 모든 Push는 이 표시 사용. 기존 CI 경로/무료서버/저장소 유지, 사이트 실제 배포는 별도 사용자 확인 전 금지. 유료/계정설정 변경 없음.
- 백업/CI 완료(2026-10-24): a5ffb547c39d505c1a88cd1be0975fe63351b29f 일반Push·원격main 일치 확인. GitHub GameCI39973878632 전체 성공(PC/Chrome터치/WebKit/버전빌드 포함), Game release는 [no-deploy]로 skip. 원본/미커밋 보존. 이 기록만 문서 전용 [skip ci] 체크포인트로 백업하며 게임 소스는 검증한 a5ffb54와 동일하다.
- 다음: 사용자 배포 확인 뒤에만 검증된 a5ffb54 SHA를 기존 Render Free 서비스에 적용하고 두 브라우저를 새로고침해 운영 검증한다. 운영사이트 미배포, 실제 외부망/실기기/실Upstash 재검증은 남아 있다. localhost3000은 파일모드·기존56방으로 실행/health200 확인, 운영Upstash 미연결.

---
# 최신 체크포인트 — 비용0원 Render Free 전환 (2026-10-23)

- 구현: Render Free1개·유료디스크/DB 없음. Upstash Free REST의 전체 Room JSON 원자 비교저장·namespace 분리·서버 전용 비밀값·한도/통신503·동시변경409·파일 fallback 금지. 기존 파일 모드/56방/원본/미커밋 보존. 추가 패키지/게임규칙/UI 변경 없음.
- 배포: 기존 성공CI→테스트동일SHA 자동업데이트 재사용. 콜드스타트 health 제한재시도 추가. 외부계정/리소스 생성·결제/유료전환은 하지 않음. 실제 연결은 사용자 확인 대기.
- 문서: docs/deployment/FREE_RENDER.md에 무료 한도/장기미사용 보관/최신상태만 저장/0원 조건/초보자 설정/대안·롤백 명시. ONLINE_DEPLOYMENT.md는 새 안내로 연결하며 과거 검증은 보존.
- 검사 완료: 전체코어462/462(05), 보드33/33(06), 프로덕션 배포7/7(08: 파일/외부REST모의 HTTP·WSS·재시작/빈경로·권한·한도), PC/Chrome터치/iPhoneWebKit9/9(11), 타입09·린트10·빌드07 exit0. 별도3126 테스트서버 사용, 기존56방/1,778,806bytes 유지. 첫 테스트 ProcessEnv 타입 오류 수정 후 재검증. Windows sandbox rename/.next mkdir EPERM은 정상권한 재검사 통과와 구분(01/04 실패로그 보존).
- 미완료: 실제 Upstash Lua/계정·Render15분절전·외부인터넷/실기기·HTTPS사이트 검증. 모의 REST/로컬 재시작을 실제 무료 운영검증이라고 주장하지 않음. 무료 DB는 최신상태만 보존, 자동백업/SLA/무한보존 보장 없음. 카드/한도초과 과금 방지 조건 확인 필요.
- 백업 완료: 코드/설정/테스트17경로와 문서접두만 d807f6515727fba2486c43f3cc2d9090c76e7c93 Commit/일반Push·원격main 일치 확인. 원본PNG/ZIP·asset-inbox·선행문서꼬리는 보존/제외. 원격 GameCI39936256286 시작 확인(아직 진행 중). 이 백업확인 문서만 별도 체크포인트로 반영한다.
- 다음: 무료 계정 연결 및 실제 HTTPS/절전/외부망 검증은 사용자 확인 대기. 초보자 단계는 FREE_RENDER.md의1~9번. 정식환경/유료리소스/결제수단 변경 없음.

---
# 최신 체크포인트 — 온라인 2인 인터넷 테스트 배포 준비 (2026-10-23)

- 현재: 로컬 온라인 2인 플레이 가능, 사용자가 추가 버그를 보고했으나 개별 재현 절차는 없음. 이전 원격 Game CI의 드래그 기대값 실패는 수정됐고, `dd4caec` 원격 PC는 여관 fixture의 이전 저장 상태 경쟁으로 141통과/3제외/3실패. 실패한 SHA의 테스트 자동 배포는 차단되어 있음.
- 변경: `render.yaml`은 유료 테스트 서비스 1개·싱가포르·단일 인스턴스·1GB 디스크·`/var/data/burgundy-staging`만 정의한다. 정식 서버는 만들지 않는다. release workflow의 테스트/정식 플래그를 분리하고, 실제 터치 설정 검사를 현재 양방향 스크롤 규칙에 맞게 수정했다. 온라인 시작 성 검사에는 기존 `waitOnlineFresh`를 적용해 409 동시 입력 보호를 존중했다. `docs/BUGS.md`와 설정 안내를 추가했다.
- 보존: 기존 `.local-data/rooms`와 원본 PNG/ZIP·asset-inbox·선행 미커밋 문서 꼬리에는 접근/변경하지 않는다. 비교 원본은 `.local-data/staging-prep/`에 비공개 보관. 서비스 연결·유료 리소스·GitHub 환경 값 변경은 실행 전 사용자 확인 대기.
- 검사: 배포 격리 계약 포함 배포5/5(서버 재시작·WS·백업 포함), 코어459/459, 보드33/33, 관련 PC·390터치2/2, 모바일 Chrome8통과·PC전용2제외, iPhone WebKit3/3, TypeScript·ESLint·프로덕션 빌드 exit0. 전체 PC 첫 실행143통과·3제외·1실패: 게스트 뒤 호스트의 오래된 revision은 서버에서 올바르게409 거절. 기존 `waitOnlineFresh` 적용 후 단독1/1 통과. `dd4caec` 원격 CI는 PC 여관 fixture 3건 실패(141통과·3제외), 그 전 단계 모두 통과. 여관 fixture를 게임이 없는 `/updates` 화면에서 주입하고 여관 PC8/8(스택1~5장·3배율) 재검증 통과. 원격 재검증 대기. 첫 샌드박스 실행의 임시파일 rename/.next mkdir EPERM은 권한 허용 후 같은 검사 통과로 구분해 기록한다.
- 백업: 테스트 배포 준비9경로만 `dd4caec`으로 기존 공개 main에 일반 Push·원격 SHA 확인. 원래 미커밋 자료는 제외. 추가 여관 fixture 수정·버그 기록도 필요한 검사 후 별도 선별 백업한다.
- 다음: 여관 fixture 관련 PC 재검사 후 보완 커밋·Push, 새 원격 main CI를 확인한다. 성공하면 Render Hobby/깃허브 연결 및 월 예상$7.25 테스트 서버 생성 승인을 요청한다. 실제 외부망/실기기·정식 서비스는 미검증.

---
# 최신 체크포인트 — 온라인 방 생성 오류 수정 (2026-10-22)

- 완료: 고정50파일 제한이 원인. 실제50방=진행49/미사용 대기1/종료0, 원문1,579,112bytes·여유114GB. 단순 한도 증가/방 삭제 없이 실제 디스크 여유(원자쓰기4개분 8.4MB) 검사로 교체.
- 정리: 새 방 생성 시 24시간 지난 종료 방/한 자리·revision0 미사용 대기 방만 gzip 무손실 보관. fsync·원자교체·압축해제 원문대조 후 일반 사본 정리, 같은 코드·토큰으로 읽기/재접속·참가 시 복원. 진행 방은 나이와 무관하게 유지. 압축 방 포함 status/스냅샷/복원·실제 ENOSPC/EDQUOT 안내.
- UI: 확정 저장거절/좌석충돌은 해당 pending 키와 잘못된 retry배너 정리. 응답유실은 인증정보 유지·멱등복구. 온라인 오류에 명시적 접근성 이름을 주어 Next route-announcer와 분리.
- 실제 localhost 개발서버: 생성→코드→PC/390터치 두번째 참가→각자 준비/시작→새로고침·동기화 성공. 원래50방 모두 SHA256 동일(압축 대기1 포함), 전체 백업 보존. 실제 재시작 후 두 좌석 exact view/revision4 및 원래50방 SHA 재확인. 추가 검증 방/사용자 방도 삭제하지 않음.
- 최종 검사: 코어459/459(12-full-core), 보드33/33(13), 관련 브라우저23개 최종통과(09의11통과+WebKit실패1은14에서수정재검사통과, 15의7/16의4). 프로덕션 WS·중복·권한·재시작·백업/배포4/4(20). TypeScript18/21·ESLint17·build19 exit0. 01샌드박스EPERM/05오류selector/09WebKit초기화 실패로그 보존, 검증 삭제·완화 없음.
- 변경: src/server/{rooms,room-http}.ts, src/app/online/room-screen.tsx, scripts/room-backups.mjs, 관련 core/browser/deployment 테스트·runner, 운영문서. 게임규칙/좌표/이미지/저장JSON형식은 변경하지 않음. 기존 원본·문서꼬리 미커밋 변경 보존.
- 캡처 직접확인: .local-data/room-capacity/live-host.png / live-guest.png. inventory-before/체크섬스냅샷/live-result/22-restart 로그는 private 로컬 보관. localhost3000 개발서버 실행 유지. 실제 외부망/Android·iPhone 실기기는 미검증.
- 백업 완료: 106260592ebf70276fba9a950fd8534b8b8ee46a Commit/일반Push·원격main 일치 확인. origin은 기존 공개 maxnjun/burgundy-expanded(사용자의 공개 main Push 예외 유지). 이번13경로/문서접두만 반영, 기존 변경/원본/방 데이터 제외. 압축 미지원 구버전 롤백은 중지 후 이번 snapshot/restore로 빈 경로에 모든 JSON을 복원해야 함. 이전 외부배포/서비스승인 및 개발도구 braces 이슈는 별도 TODO 유지.

---
# 최신 체크포인트 — 모바일 온라인·인터넷 배포 (2026-10-22)

- 기존 2인 RoomStore/Next16.4.2·React19.3·Node24 재사용. 현재 HTTPS폴링/인증/revision/원자JSON 저장, CI/배포설정 없음. 기존 원본/미커밋 보존 baseline .local-data/internet-release/.
- 순서: ①온라인 점검→②초대/로비/재접속/WS/버전·저장보호→③모바일→④영속디스크 단일Node/Render 설정→⑤CI·staging/production 승인·롤백→⑥전체검사·선별백업.
- 외부 서비스 가입/유료 생성/비용 발생/실제 배포는 아직 미승인, 실행하지 않음. 먼저 로컬 검증 가능한 구현/설정을 모두 완료한다. 실기기·외부망 검증은 별도 보고. 온라인은 기존2인 제한 유지, 로컬/AI2~4인 유지.
- 구현: 기존 RoomStore opt-in 로비/각자 준비·방장 시작/초대·중복 생성복구/WS·폴링 재접속/오프라인 잠금/버전426. JSON fsync·이전8revision·부팅스냅샷/체크섬·빈경로 복원, 단일Node 영속디스크 설정. 게임규칙/이미지/구저장 유지.
- 설정: Render2환경 Blueprint(미생성), GitHub CI·CI후staging/정식수동승인·동일SHA/호환검사·rollback, /updates·버전표시. 상세 docs/deployment/ONLINE_DEPLOYMENT.md. 외부 Secret·환경 보호·비용 승인은 미실행.
- 최종 검사: 전체코어455/455·보드33/33, PC145건=142통과/터치전용3제외(13-production-full-pc.log). 최종 PC/Chrome터치/WebKit 관련9/9·기존모바일도움말5통과/PC전용2제외(29-*). 실제 프로덕션 WS·동시중복·재시작·빈경로 복원/배포보호3/3. 최종27번 타입/린트/빌드 exit0, 에셋6/아이콘2 경고0·YAML 통과·runtime audit0.
- 해결: 개발 HMR/테스트 소유 서버 종료는 프로덕션 상시서버/CI모드 분리. WS는 인증된 state 후에만 live, 막힌 WS는 정상HTTP 조작을 잠그지 않음. 고정포도보상 전송 유실/인증대기 폴링복구. 모바일 영지 pan-x/중첩overscroll 차단해제→실제 CDP 가로스와이프·revision불변·팝업미발생 확인. 실패로그19/23/25/26 보존, 검증 삭제/완화 없음.
- 실제 캡처 확인: .local-data/internet-release/*mobile-board-portrait.png, *mobile-estate.png, *vineyard-swiped.png 및 *online-pair/*update-required. 기존 그림/좌표/게임규칙/구저장 유지. 원본SHA·기존 문서꼬리 보존/민감패턴0 사전검사 완료.
- 백업: 이번46경로/문서접두만 bd45e3e218eed988b7641af0693f4259c7b319f0 일반Push·원격main일치 확인. origin 공개/이전 사용자 Push 허용 유지. 원본/기존문서꼬리 제외. localhost3000 최종 프로덕션 유지, 로컬기존방50개 보존(한도 도달).
- 원격CI: 첫 GameCI39652071835는 저장소 원본27/28과 로컬검토hash 차이로 중단, Game release는 정상skip. 원본 제작검사/기존테스트 그대로 두고 새 배포PNG62개 무결성 검사로 CI입력 구분(31-deploy-assets통과). 원본을 백업에 끼워넣거나 변경하지 않음. 보완커밋/원격CI 재확인 중.
- 알려진 문제: full npm audit 개발의존성 braces 동일권고 전이5high/현재patch없음; runtime0과 구분, 강제 Next14 downgrade 안함. 상세 운영안. 다음은 보완Commit/Push→실제CI 통과 확인→Render환경/비용 승인 안내. 전체 외부망/실기기/유료 배포/외부백업은 미완료다.

---
# 최신 체크포인트 — 수정사항 프롬프트 통합 (2026-10-22)

- 루트 문서 전체/후순위 지시 구현 완료. 상품 보유 수량은 실물 겹침, 누적 판매 수량만 숫자로 표시. 전체 프로젝트 완료 아님.
- 엔진: 포도 은화/일꾼/망루 즉시 자동보상·used 중복방지·구저장 canonical 자동재개. 방패 교체는 비워지는 공급 슬롯에 이전 방패 반환, 즉시 실행·공유 대상 갱신. 일반 타일 폐기 확인 유지.
- UI: 배치 여관 실제 terrain 설명, 엔진 원장/종료항목 정산표, 판매6종 팝업, 상품3슬롯 전량겹침, 개인 자원/저장고 확대, 실물 포도2키/돌려서 배치, 여관60좌표(온라인46px) 일반타일 크기 일치. 기존 그림/좌표/4층5토큰 유지.
- 시작 성: 기존 setup+초기실물로 보드 직접선택·추천AI·온라인 본인권한/중복/revision/재접속·부분저장. 새UI 게임만 선택을 활성화, 구 저장/기존API 유지. 품종축소/방패preview는 개발자 details로 보존.
- 검증 완료: 전체코어451/451·보드33/33, 최종 TypeScript/전체ESLint(경고0)/프로덕션빌드 exit0(22-checks.json), 에셋6/아이콘2 경고0. PC 전체143건 실행은135통과/3터치전용제외/5실패, 수정 후5건 모두 재검증 통과→실행대상140개 최종확인. 온라인6통과/관련PC·모바일8통과(입력방식2제외), 25라운드/3배율4통과, 여관16통과 등 기능별 로그01~22.
- 발견/해결: 모바일 sticky 클릭가림·200% 상품잘림→일반흐름/줄바꿈. 저장고 illustrated-tile 래퍼 누락→기존 래퍼60px 복원, 키보드/외곽clip 검사 유지. 새setup 전 roll하던fixture/구상품이름 도우미 이관. 온라인 stale409는 정상 거부, 최신UI 동기화 후 실제 클릭하는 helper로 보완. 검증 삭제/완화/강제클릭 없음.
- 실제 PC·390터치 100/160/200% 캡처 직접 확인. 로그/캡처 .local-data/player-improvements/, .local-data/qa/inn-stack-*, .local-data/tile-standard/game-storage-after.png. 원본PNG27/28/사용자txt SHA 불변, 기존 문서꼬리/asset-inbox/ZIP 보존·백업 제외.
- 변경 파일/원리/검사 상세 docs/PLAYER_IMPROVEMENTS_NOTES.md. 코드/UI/테스트54경로와 이 작업 문서 접두 구간만 선별 백업. 기존 origin 공개main은 사용자의 기존 Push 허용에 따라 사용, 공개설정 불변. 원격시작main=85b7bf1 확인. 이번56경로 661be175ec404c5c6f25f4cb9fb0af7f3be91b42 Commit/일반Push 후 원격main 전체SHA 일치 확인.
- 완료: 실제 staged diff/민감정보 패턴0/원본SHA/문서꼬리 제외 확인 후 백업 완료. 이 원격검증 완료 기록은 별도 문서 커밋으로 보존한다. 다음은 사용자 결과 보고. localhost3000 유지. 실기기 정밀QA 및 온라인Undo 기존 미지원은 범위 밖.

---
# 최신 체크포인트 — 통합 타일 설명 시스템 (2026-10-21)

- 최신 단일 터치/단일 카테고리 지시까지 구현·검증 완료. 원문 전체/첨부9개 동일 확인, 기존 구현 재사용. 1000ms 길게 누르기 제거, 주사위/필수 선택/배치 선택이 없을 때 단일 터치 설명. 실제 조작 우선, 이동/다중터치/팬 취소, PC hover/키보드 유지.
- 공통 설명76개(수도원29·방패18), 도감10카테고리. 등록1개 즉시 상세/복수 목록. 로컬·AI·온라인/영지·공급·보관함 공유. 모바일 명시적 은화 구매 선택으로 주사위 소진 후 구매 유지. 포도 배치 후 오래된 선택ID 잠금 방지. 게임 규칙·저장 형식·이미지·서버·AI 불변.
- 이번 전체 코어439/439·보드33/33·전체PC131통과/터치전용3제외(134개). 최종 상태 보완 후 관련 PC/375/390/768 총23통과/입력방식별9제외(32개). 타입·전체ESLint·프로덕션빌드 최종 exit0, 타일 에셋6/아이콘2 경고0. 기존 검증 삭제/완화 없음.
- 실제 PC100/160/200%·모바일/태블릿 도감/팝업/온라인 캡처 직접 확인. 초기 Next 개발알림 터치 가림/병렬trace폴더 충돌은 실제 대상 중앙 스크롤·별도output 재검사로 해소. 상세 변경파일/설명 차이/검사 docs/TILE_EXPLANATION_NOTES.md. 로그/캡처 .local-data/tile-help/.
- 원본PNG27/28·원본ZIP 시작SHA 동일, asset-inbox·여관 문서 수정 보존/커밋 제외. origin=기존 public/main, 사용자 기존 공개main Push 허용 유지, 원격main=시작HEAD 일치 확인. 이번20파일 및 문서 접두 구간만 4d182d8444c258e3e2ca700b7eb34ea1a4f32c14 Commit/일반 Push 후 원격main 전체SHA 일치 확인. localhost3000 유지.
- 완료: staged20개 내용/민감정보패턴0/기존 문서 꼬리 불변 확인 후 백업. 남은 기능 오류 없음. 이 원격 확인 기록은 별도 문서 커밋으로 보존한다. 다음은 사용자에게 결과 보고이며, 전체게임 모바일 정밀QA는 기존 최종통합 계획 유지. 전체 프로젝트 완료 아님.

---
# 최신 체크포인트 — 승인 수도원29종 에셋 교체 (2026-10-21)

- 사용자 승인 ZIP29개 번호1–29 중복/누락0. ZIP/추출 원본 바이트 보존,1024 RGBA29개+manifest+프리뷰 생성. 기존 베이지 공통 alpha/등방성 등록 재사용, 내부90% 보호/검은 바탕 외부 투명화. 번호 리본의 검은 선은 그림으로 보존.
- TileArt 번호 manifest/완성형 바깥 clip, SVG 테두리·번호·14효과·마름모 중복 제거, 기존 번호 있는 오류 SVG 유지. 읽기전용 /monastery-gallery. 게임 규칙/AI/온라인/저장/기존 좌표/클릭 변경 없음.
- 원본/파생 check(실제ZIP 및 원본만 있는 clone조건)/기존 validate 통과. 실제29종 번호·검은 공급/저장/영지10묶음/선택·404복구·3배율/갤러리 직접 확인. 공유 변66개 좌표오차<0.001px, 경계 AA거리100/160/200%=0.0847/0.0538/0px. 눈에 띄는 틈/검은 사각형/효과 중복 없음.
- 이번 최종 검사: 전체코어433/433·보드33/33·전체PC127/127(15.0분)·TypeScript/ESLint/프로덕션빌드 exit0. 초기 sandbox 서버 rename EPERM은 정상 권한 재실행 통과, 새 gallery 타입캐시는 빌드 생성 후 재검사 통과. fixture는 실제 슬롯/확장/수량 검증을 유지하며 수정했다.
- 파일: 새 원본29+입력manifest, 파생29+출력manifest/프리뷰, 준비스크립트, TileArt/갤러리, 관련브라우저4파일, AGENTS/디자인가이드/가져오기문서 및 이 접두 기록(73경로). 상세 docs/MONASTERY_TILE_IMPORT_NOTES.md. 로그/캡처 .local-data/monastery-import/.
- 기존 미커밋 PNG27·28/타 asset-inbox/여관 문서 수정 및 원본ZIP은 보존/선별 백업 제외. origin/public/main 및 기존 사용자 Push 허용 확인. 이번73경로만 a527a57369322471c806242c18d689f426261b74 Commit/일반 Push 후 원격main 전체 SHA 일치 확인. localhost3000 유지.
- 제한: 미세 AA/원본 금색 외곽 비대칭은 재도색하지 않음. 모바일 정밀QA/전체프로젝트 완료 아님. 이번 범위 완료·검증·백업 완료. 이 마지막 원격 검증 기록은 별도 문서 커밋으로 보존하며 사용자에게 결과를 보고한다.

---
# 최신 체크포인트 — 성 추가 행동·선박·상품 직접 선택 (2026-10-21)

- 승인 범위 구현·검증·main 백업 완료(전체 프로젝트 완료 아님). 상세 변경 파일/원리/검사/경계는 docs/CASTLE_DIRECT_INPUT_NOTES.md.
- 기존 canonical 성 선택을 재사용하고 실제 주사위 우선 사용 시만 성 효과를 보관/복원한다. 시작된 필수 자식 효과는 계속 차단한다. 직접 타일 획득·저장고→영지 배치·상품 종류 전체 판매·노동자 획득·선박 네모칸/종류 그림 선택을 연결했다.
- Undo는 독립 행동별 전체 상태/RNG 스냅샷과 자식 효과 묶음. 시작한 효과 중 취소도 원래 행동으로 복원한다. 구버전 저장/sidecar 검증·서버 소유권/revision/재접속 유지. 온라인 Undo는 기존 미지원.
- 최종 전체 코어433/433·보드33/33·타입/ESLint/프로덕션빌드 exit0. 전체PC118개 최초116통과 후 기존 입력2건을 실제 조작으로 이관·재검증. 추가 PC/모바일30/30·온라인14/14·원본픽셀 확대2/2. PC 고유124개를 전체 실행+관련 재검사로 확인했다.
- 스크린샷 직접 확인: .local-data/castle-direct/{desktop-1280,mobile-390}/ 아래 2/3/4인 양쪽 순서·상품 종류 선택·온라인·100/160/200. 로그 .local-data/castle-*.log. 보드 좌표·원본 PNG·기존 규칙/AI 전략 유지, 새 의존성 없음.
- 기존 수도원 PNG2·asset-inbox·여관 문서 변경은 보존/백업 제외. 이번 기능/테스트/검증36파일만 76f2830b11b003d3cc819bb349c83b8fe514cc4a 일반 Push 후 원격 main SHA 일치 확인. public/main 및 이전 사용자 명시 허용 유지.
- 제한: 온라인 Undo 미지원·전체 확장 모바일 정밀 QA 최종 단계 유지. 이번 범위 남은 오류 없음. localhost3000 유지. 민감정보0·실제 diff/스테이징36경로 확인 후 백업 완료. 이 마지막 검증 기록은 별도 문서 커밋으로 보존한다.

---
# 최신 체크포인트 — 중앙 행동 안내 및 즉시 턴 제어 (2026-10-21)

- 사용자 “진행해” 승인 범위 구현·검증·main 백업 완료(전체 프로젝트 완료 아님). 사람의 자동 end-turn 금지는 유지, 라운드/단계 자동 처리·AI 전략/진행·게임 규칙/저장 형식/보드 좌표/PNG 불변.
- 원인: 첫 좌석 전용 숨김이 아니라 restore의 start 스냅샷 부재. 기존 저장 파일은 그대로 두고 burgundy-expanded:turn-history-v1 sidecar에 현재 게임/로그와 턴 스냅샷을 자동 저장. 복원 시 상태 전체·로그·턴키·config·revision 순서·기존 저장 파서로 검증하고 잘못된 기록은 안전하게 초기화. 전체 턴/행동 Undo·연쇄 효과/RNG·새 분기·다음 플레이어 경계 유지.
- TurnControls의 종료 dialog/자동 팝업과 full Undo window.confirm 제거. 세 빨간 버튼 즉시 실행, 같은 로컬 상태의 중복 실행 방지 및 온라인 in-flight/좌석/revision 검증 유지. 폐기/보관/방패 교체 확인창은 유지. 온라인 Undo 기존 미지원.
- action-guidance는 화면 상태로부터 순수 계산: 필수 효과/포도·방패·무역로 자식 선택→현재 선택→엔진 합법 end-turn/구매→주사위. 검은 타일·여관·포도 상점의 실제 합법 구매만 “(구매 가능)”. 불가능한 수도원6 선택은 취소 안내. 온라인은 서버가 공개 안내 문자열만 계산하며 숨은 게임 상태는 추가 노출하지 않음.
- 중앙 큰 안내/대칭 grid(PC 좌우 최소360px)/좁은 화면 줄바꿈. 기존 별도 주사위 안내와 “특수 행동” 글자 제거, 기능은 접근 가능한 ⋯ 메뉴 유지. 공용 보드 헤더의 고정 주사위 안내만 삭제, 단계/라운드·조작 도움말/보드 디자인 유지. 포도 보관 UI 선택도 중앙 안내/취소와 연결, 4층·시작1+층4=최대5토큰 규칙 유지.
- 변경 코드/검사20파일: app/{common-board,game-screen,turn-controls,vineyard-board,online/room-screen}.tsx 및 game-screen.css/globals.css; game/{action-guidance,turn-history-cache}.ts; server/rooms.ts; core action-guidance.test.ts/run.mjs; browser {direct-input,game,manual-turn,rooms,shield-ai,shield-castles,shield-rules,turn-controls}.spec.ts. 새 의존성/이미지 변경 없음.
- 검사: 전체 코어422/422·보드33/33·전체PC109/109(18.5분). 최종 안내 조건 코어5/5·PC/모바일12/12(3.1분), 마지막 PC 자원 줄바꿈 보정 후 관련PC/모바일6/6(49초). TypeScript·전체ESLint·최종프로덕션빌드 exit0. 초기 관련PC10/10 및 온라인/AI6/6도 통과. 기존 검증 삭제/완화 없이 확인창 동작만 새 요구대로 갱신.
- 직접 확인: .local-data/action-guidance/desktop-1280-{2,3,4}p-game.png 및 *-toolbar.png, mobile-390-{2,3,4}p-game.png, desktop-1280-mandatory-resolved.png, 각 프로젝트 toolbar-{1280,390,375}-{100,160,200}.png. 중앙 안내/세 버튼/전체 턴·행동 Undo/새로고침/두 주사위 후 유지/실구매 전후/필수 성 효과/중복 종료/다음 플레이어 제한 검증. 현재 사용자 localhost도 화면 관찰만 수행, 게임 행동은 테스트 전용 브라우저에서 검증.
- 로그: .local-data/action-guidance/{core-full,boards-full,browser-full-pc,browser-final-ui,browser-final-layout,core-guidance-final,types-final,lint-final,build-final}.log 및 final-validation.json. 샌드박스 임시 방 rename/빌드 mkdir EPERM은 동일 검사를 정상 권한에서 재실행해 통과, 규칙 코드나 검증 기준으로 우회하지 않음.
- 백업: 20파일 민감 패턴0·실제diff/스테이징 검사 후 0ac329e4b88d2edb85762113fc0f66d3a9e127ec 일반 Push·원격main SHA 일치 확인. origin=maxnjun/burgundy-expanded, public/main 유지(이전 사용자 명시 Push 허용), 기존 수도원 PNG2·asset-inbox·여관 문서 꼬리 변경은 보존/제외. 이 접두 검증 기록만 별도 문서 커밋으로 백업.
- 제한/재개: 기록 없는 과거 저장과 파일 import는 Undo 시작을 추정하지 않음(현재 턴의 새 행동별 Undo/다음 턴부터 전체 Undo). 내보내는 저장 파일 형식은 동일, Undo sidecar는 로컬 자동 저장 전용. 온라인 Undo 미지원·모바일 확장 전반 정밀QA는 기존 최종 단계 유지. 이번 범위 남은 오류 없음. localhost3000 유지, 다른 미완성 기능은 건드리지 않음.

---
# 최신 체크포인트 — 사람 턴 수동 종료 확인 (2026-10-21)

- 이번 버그 수정·검증·main 백업 완료(전체 프로젝트 완료 아님). 원인=automaticAction이 선택 구매가 없으면 사람 end-turn을 반환. 사람 자동 처리는 round-setup/phase-end만 유지, AI chooseComputerAction은 변경 없음. 두 주사위를 써도 현재 턴/스냅샷을 유지하며 사용자 확인에서만 end-turn 실행.
- TurnControls 공통 native dialog: 필수 효과가 모두 해결된 뒤 “턴을 종료하시겠습니까?”/취소. 엔진·서버 검증 buy-black-tile 액션이 있으면 “(은화 구매 가능)”; 빈 공급·은화 부족·공유 구매 사용/보관 교체 조건은 엔진 기준. 같은 game/view 객체에서 취소 후 반복 자동 표시 없음. Undo/구매 등 상태 변경과 수동 요청은 새 확인. 메뉴를 열어도 수동 확인 가능. 중앙 정렬/취소 기본 포커스.
- 로컬의 모든 end-turn 호출·온라인 범용 행동 실행도 확인창을 거침. 확인 중복 실행/온라인 요청 ref 잠금, 기존 서버 revision·좌석·직렬화 검증 유지. 오래된 종료 요청409·다른 좌석403·연속 클릭POST1회 검사. 엔진/턴 기록/저장 구조/난수/자원 수치는 변경하지 않음. 온라인 Undo 기존 미지원 유지.
- 이번 검사: 전체코어417/417·보드33/33, 최종 타입/전체ESLint/프로덕션빌드 exit0. 전체PC108개 최초106통과/기존2개실패(17.8분): 사람→AI 인계에 종료 확인이 빠졌고 방패 획득 후 확대에 취소가 빠짐. 스크린샷/trace 원인 확인 후 기존 판정은 유지하며 확인/취소 추가. 실패2개 포함 최종관련PC15/15(2.6분), 유효한 구매 fixture 강화 후 관련코어15/15 및 타입/해당lint 재검사 통과. 전체108개를 수정 뒤 다시 일괄 실행하지는 않음. 미해결 실패 없음.
- 소스5개(direct-actions,game-screen.tsx/css,online/room-screen,turn-controls)·관련검사9개만 변경. A~L: 2·3·4인 한 주사위/두 주사위/취소·반복방지/행동별·턴전체Undo/실구매 전후 안내/1은화/필수 성 효과/수동 종료/AI 25라운드/온라인 재접속·권한·중복·오래된 요청/저장 포맷 검사. 실제 화면 직접 확인=.local-data/manual-turn/confirm-{2,3,4}p.png,mandatory-resolved.png,online-confirm.png. 실패 당시 화면/trace는 같은 폴더 failures/에 보존.
- 백업: 검증된 소스·검사14개만 9da259b9b913d1eb49734becb376fca8b2cd6004 일반Push·원격main SHA 일치. 기존 공개 origin/main Push 허용과 이번 Push 요청에 따라 공개 설정 유지. 비밀패턴0/동결14파일 일치/기존 수도원PNG2·문서 꼬리2 해시 유지. asset-inbox와 다른 미커밋 여관 문서/수도원 원본은 보존·제외. 이번 문서 접두 구간만 별도 체크포인트로 백업.
- 다음: 이번 수정 완료. localhost:3000은 별도 숨김 dev 프로세스로 유지. 모바일 정밀QA는 통합 단계로 보류. 재개/재검사는 .local-data/manual-turn/{core,boards,full-pc,final-affected,core-final-direct,types-last,lint-final,build-final}.log 및 final-validation.json 참조. 다른 미완성 기능은 이번 범위에서 변경하지 않음.

---
# 최신 체크포인트 — 승인 동물 13종 실제 게임 적용 (2026-10-21)

- 구현·검증·GitHub main 백업 완료(전체 프로젝트 완료 아님). 승인 ZIP13개(1254 RGBA)를 보존하여 1024 공통 alpha/등방성 파생 등록. 비정규 원본 테두리만 분리·원본 연두 RGB의 공통 SVG 프레임 사용. 단일 viewBox/clip/imageRect, 동물별 런타임 배율·이동 없음.
- TileArt의 species/count→final manifest+캐시해시로 번호/검은 공급·보관·영지·선택·온라인 공통 적용. chickens→기니피그,geese→하프물범 이름만 분리. 카탈로그/공급/점수/AI/저장 ID는 유지. 하프물범은 기존 검은 확장1개만 사용. 가축 count 배지는 얼굴 가림을 피한 상단 중앙 공통 위치.
- 이번 검사: 관련PC9/9·최종배지PC3/3·최종 전체PC103/103(10.4분,full-pc.log), 전체코어413/413·보드33/33, 최종타입/전체lint/프로덕션빌드 exit0. 동물 재생성--check13/기존 에셋6·아이콘2 통과/경고0. 기존 검사 삭제·완화 없음.
- 직접 확인: .local-data/animal-live/neighbours-200.png·game-estate-5/7-200.png·game-supply-7.png·game-storage-all-thirteen.png, 13종 동물 수/자세·어두운 무늬 보존·잘림/검정/흰 배경/추가 테두리 이상 없음. 10공유변×3배율 배경노출0px, 동일alpha·투명RGBA0. baseline18파일(원본ZIP/13PNG/기존수도원2PNG/문서꼬리)해시 유지·소스/에셋23파일 동결 일치.
- 산출물: public/assets/tiles/animals/final/13PNG+manifest+_preview_sheet.png, prepare-animal-tiles.py(--check), ANIMAL_TILE_IMPORT_NOTES.md, animal-assets 브라우저3건. 실제 게임은 기존 보관3칸/지형을 유지해2종씩7fixture로 검증. 상세 캡처=같은 폴더 before-after,neighbours-{100,160,200},game-supply/storage-{1..7},game-estate-{1..7}-{100,160,200}.png.
- 백업: 이번26파일만 85623841b14a93cce4fc75d9586b198b6311af7d 일반Push·원격main SHA 일치. 기존 공개 origin/main 예외를 사용자가 명시 허용했고 공개 설정은 변경하지 않음. 베이지 검증 기록d4970a0도 함께 백업. 무관한 asset-inbox/수도원 원본2개/기존 문서 여관 구간은 보존·제외. 이번 문서 접두 구간만 별도 체크포인트로 기록.
- 다음: 이번 동물 적용 작업 완료. 모바일 정밀QA는 최종 통합 단계로 보류. 재검증은 가져오기노트의 명령과 .local-data/animal-live/*.log 및 asset-validation.json 참조. 새로운 승인 ZIP은 해시/contour를 다시 검수하며 현재 원본을 덮어쓰지 않는다.

---
# 최신 체크포인트 — 승인 베이지 PNG10종 실제 게임 연결 (2026-10-21)

- 구현·최종 회귀·main 백업 완료. TileArt에서 final/manifest의 buildingType→file+출력해시 연결. 베이지 완성형만 바깥clip0/추가SVG backdrop·rim 없음, 실패 시 기존SVG/안쪽프레임 복구. 공용/보관/영지/온라인/무역로 공통 적용. 좌표/클릭/게임엔진/AI/저장·PNG원본/최종파일 불변.
- 관련PC9/9(related.log)·코어413/413·보드33/33·타입/린트/빌드 exit0. 테스트를 production TileArt/실게임으로 전환, 3칸 저장고를 3·3·3·1로 나눠10종의 공급/보관/영지 URL일치·클릭·GameState불변·3배율 및404복구 검사. 이전 수동 DOM 그림 치환은 제거.
- 직접 확인: .local-data/beige-live/game-estate-200.png 및 neighbours-200.png, 모든 건물/소품/깃발 보존·간격/중복선 이상 없음. 스크린샷은 같은 폴더에 game-estate-{100,160,200},game-supply-{1..4},game-storage-{1..4}.png. 기존 게임/규격변환 캡처는 보존. 4공유변×3배율 배경노출0px, 입력/출력/기존문서29해시 보존·소스4파일 동결 일치(asset-validation.json).
- 변경: tile-art.tsx,beige-assets/tile-standard/tile-png 브라우저검사,AGENTS/디자인가이드/가져오기노트 및 이번 TODO/PROGRESS 접두 구간. 전체PC100/100 통과(full-pc.log,14.1분). 소스4파일 동결 해시=verified-source-hashes.json.
- 백업: f48401ac89adc8fc6f84407472c21172f6a07370 일반Push·원격main SHA 일치. 사용자가 기존 공개 main 백업 예외를 명시 허용. 기존 문서 여관 구간/수도원PNG2개/asset-inbox는 보존·커밋 제외.

---
# 최신 체크포인트 — 승인 베이지 타일 10종 정규화 (2026-10-21)

- 이번 에셋 정리/검증/본체 백업 완료(게임 기본 연결 자동치환 및 전체 프로젝트 완료 아님). manifest/README/동봉 지시문·원본10종 확인. 신규 public/assets/tiles/beige/final/에 1024 RGBA10개·동일 alpha·승인 베이지 바닥/목재 테두리 유지. 새 그림/색 보정/비등방 변형 없음.
- 파일: scripts/prepare-beige-tiles.py(재생성/--check), tests/browser/beige-assets.spec.ts, docs/BEIGE_TILE_IMPORT_NOTES.md, 최종 PNG10/manifest/83px·3배 비교 시트. 게임 building 매핑은 목수carpenters-workshop/시청town-hall 등 코드 대조. 실제 게임 공급/보관/영지는 격리 DOM 미리보기로 교체 규격 확인하며 추가 SVG rim 없음.
- 이번 검사: 원본10해시/동일 alpha/투명 RGBA0/검정 matte0/결정적 픽셀/기존 자산 검사 통과. 전체 코어413/413(core-final.log), 보드33/33(boards.log), 관련PC7/7(browser-final.log), 최종신규PC2/2(beige-final.log), 최종타입/전체lint+신규파일lint/프로덕션빌드 exit0. PC 전체97 및 모바일 정밀QA는 에셋 준비 범위에서 재실행하지 않음.
- 실패 수정: SVG image의 사각 bbox 대신 getScreenCTM의 공유 꼭짓점을 측정, fixture 흰 성 활성/저장 로딩 대기·TS narrowing 보완. 초기 코어14건 sandbox Temp rename EPERM은 정상 권한으로 같은 테스트 재실행하여 전부 통과. 기존 테스트 삭제/완화 및 게임 코드 변경 없음.
- 직접 확인: .local-data/beige-import/{before-after,neighbours-100,neighbours-160,neighbours-200,game-estate-preview,game-supply-preview,game-storage-preview}.png 및 final/_preview_sheet.png. 4공유변×3배율 순수 배경노출0px, alpha 경계 오차≤0.9773 PNG px(0.0917 영지 SVG 단위), 추가 수동보정 필요 현상 없음. 상세=asset-validation.json.
- 백업: 신규15파일만 4b470f4055964cbd6aa12126a43c4e79e7c1744b 커밋/일반Push·원격SHA 일치. 사용자가 공개 전환한 기존 public origin/main 유지, 권한/선행0대0/민감패턴0/실제diff 확인. 기존 문서 여관 구간·수도원PNG2개·asset-inbox 원본은 보존/제외. 이번 문서 접두 구간은 별도 체크포인트로 백업.
- 다음: 사용자 최종 PNG/프리뷰 확인 후 게임 기본 연결 교체가 필요하면 full-face용 바깥 clip(0)/추가 rim 없음 방식으로 적용. 이번 요청 범위의 에셋 정리는 완료. 승인 원본이 없는 clone에서도 브라우저 최종10종 검사는 실행되며 재생성에는 로컬 승인 입력이 필요.

---
# 최신 체크포인트 — 공통 타일·자원 규격 v1 (2026-10-20)

- 구현/검증/본체 백업 완료(전체 프로젝트 및 합성PNG 자원 교체 완료 아님). JSON 공통규격·48개 단일 타일 viewBox/안쪽clip/3겹 SVG rim,보관함 부모clip 제거. 좌표/규칙/AI/저장 불변. 기존PNG 원본/기존5종 파생 보존;여관 rim 분리·기중기/거위 공통alpha canvas.
- 승인 은화/일꾼은 원본RGB 보존·정사각 투명PNG/ResourceIcon/Glyph,자원표시줄·은행·비용·방패2/3/8/9·수도원14에 적용. 작은방패 자원/번호/점수 bbox 비겹침 보장. AGENTS/디자인가이드 규격 기록. 기존 수도원28 합성PNG 내부 자원은 장면 손상 없이 분리할 수 없어 보존.
- 전체 코어413/413·보드33/33,최종타입/린트/빌드 exit0. 전체PC97건 실행=92통과/여관5실패(추가 은화이미지 개수기대),타일n+비용1/모든이미지 로딩 검사 강화 후5/5재실행 통과. 이후 방패관련4통과,글꼴별 번호간격 신규검사1실패 보완 후 최종 규격3+여관fallback1=4/4통과. 전체를 다시 한 번 실행한 기록은 아니며 영향범위 재검증. 현재 미해결 테스트 실패 없음.
- 자동자산:전체형6/중앙형2/자원2 검사통과,원본RGB차이0·투명RGBA0. 공유변 배경노출0,rim4/8/8px(100/160/200%,이론4.4/7.04/8.8;AA차이<1px). 실제 수정전후/게임/48얼굴/작은아이콘 캡처 직접 확인: .local-data/tile-standard/{before-after,all-faces-resources,game-common-after,game-storage-after,game-estate-after-100,game-estate-after-160,game-estate-after-200}.png.
- 변경32파일/재생성/제한/명령/결과=docs/design/tile-asset-standard.md. 로그=.local-data/tile-standard/*-final.log,full-pc.log,inn-retry.log,last-related.log,asset-validation.json. 최종 소스/테스트 해시 변경0 확인. 3000서버 유지,모바일 정밀QA 유보.
- 본체 685438c8f7a40304e25b4f848bbdfc8187e791c9 커밋/일반Push 완료·원격SHA일치. 기존사용자공개전환한public origin/main 유지,선행0/0·민감패턴0. 기존문서 여관구간·수도원PNG2개 보존/제외;체크포인트2문서는별도구간만백업.
- 남음/재개:수도원27·28의 미커밋원본은 현재파생의검수입력과일치하지만Git원본과다르다. 깨끗한clone의엄격한원본해시검사/재추출에는 해당원본2개의별도승인·백업이 필요(자동완화/덮어쓰기금지). 기존합성PNG내부자원은배경원화확보후공통레이어분리. 그외이번타일정렬의눈에띄는틈/중복없음.

---
# 최신 체크포인트 — 두 Undo·빨간 턴 제어·설정 정리 (2026-10-20)

- 이번 UI·턴 제어 구현/검증/본체 백업 완료(전체 프로젝트 완료 아님). TurnControls(되돌리기/이전 행동으로/턴 종료) 공통 적색 #A83232,우측/반응형 배치. 전체GameState+로그 스냅샷으로 복원,random커서/점수/모든확장 포함. 최초행동과 필수연쇄를 묶고 턴 경계에서 기록 폐기. 기존 자동 진행/엔진 end-turn 검사 유지.
- 로컬/사람 AI 대전 Undo 지원,AI좌석/이전차례 Undo 차단. 불러오기/새로고침은 기록초기화:현재차례 시작 불명으로 턴 Undo는 다음차례부터,불러온뒤 새 행동의 단계 Undo는 가능. 온라인 Undo는 명시 비활성/서버거절(권한/revision기존검사유지),온라인 end-turn은 서버합법목록 사용. 설계/한계=docs/design/turn-controls.md.
- 저장 패널을 ⚙ 게임 준비·설정 안으로 이동,형식/자동저장 유지. 상시 방패 설명/장착목록 제거,상세/실제 방패/6·16특수선택/오류/필수후속 유지. 기존보드/이미지/AI전략/규칙 불변.
- 관련 코어9/9,확장포함25라운드 모든완료행동·턴 스냅샷 복원7/7,브라우저 새4/4 통과. 최종 전체코어413/413·보드33/33 통과. 타입/린트/프로덕션빌드 모두 exit0 확인(types-final.log/lint-final.log/build.log). 최종 전체PC94/94통과(full-pc.log,11.6분,실패/skip0;기존90+신규4). 최종소스/테스트16개 해시 변경0(frozen-files.json). 초기구버튼명/hover중간색 검사 수정,기존검사삭제/완화없음.
- 실제확인:.local-data/turn-controls/4p-active-game.png,4p-active-buttons.png(세버튼모두활성#A83232),settings-save.png 및2/3/4인/대응배율버튼 캡처. 기본회색/파란버튼 없음,비활성만저채도적색.
- 백업:원격은사용자가이전에공개전환한기존public origin/main 유지(설정변경없음),Push권한/선행0대0·민감패턴0건/diff검사. 본체·테스트·설계17파일만65dddfe339c79ad98c1aa02c2a2334fcc48ef198 커밋/Push 완료·원격SHA일치. 이번문서2개접두구간은별도체크포인트. 기존PROGRESS/TODO여관구간·수도원PNG2개 보존/제외.
- 다음/한계:이번범위미해결오류없음. 온라인Undo미지원·불러온현재차례턴Undo제한은의도된안전제한(화면/설계에명시),모바일정밀QA후속.3000서버유지.

---
# 최신 체크포인트 — 공용 보드 하단 UI 정리 (2026-10-20)

- 이번 하단 UI 정리 완료(전체 프로젝트 완료 아님). 기존 950×1030 viewBox·모든 공급처/방패/패널 좌표와 디자인 유지. 외곽950px에 테두리5px×2가 포함되므로 SVG 표시 기준만950→940px로 맞춤(100% 기준). 이전10px 가로 넘침을 제거하며 overflow 숨김/잘라내기 없음. 좁은 화면·확대 시 기존 auto 스크롤/드래그 유지.
- 하단 common-board-note 삭제, 동일 설명은 상단 common-board-actions의 기본 닫힘 details ‘조작 도움말’로 이동. 게임 오류/선택/진행 메시지는 변경 없음.
- 모바일 추가 원인:포도확장 없는 단독 보드의 익명 부모div가 내용 최소폭950px로 페이지를 넓힘. common-board-row를 붙여 width950/max-width100%/min-width0으로 제한,스크롤은 내부에 유지. 375px 실측 panel355/client345/scroll940/page375. 초기 모바일 실행은 이 문제 진단 후 중단했으며 통과 수에 포함하지 않는다.
- 소스:src/app/common-board.tsx,game-screen.css,game-screen.tsx(부모 클래스만). 테스트:browser/common-layout.spec.ts(PC두스크롤영역넘침0/모바일스크롤/도움말토글/125%스크롤),shields.spec.ts 및 vineyard-supply-layout.spec.ts(940×배율 명시 검사,기존 클릭/겹침/공급검사 유지).
- 실측/직접확인:.local-data/footer-cleanup/after-4p-combined.png. SVG940/내부 client940·scroll940,하단문구없음/도움말닫힘. before-4p.png 보존. 포도패널/실물/빈칸 치수 동일(screenshots.log).
- 최종 이번 타입/린트/빌드 통과(types-final.log/lint-final.log/build-final.log),관련PC13/13(2.6분,desktop-final.log) 및 모바일375/390의12/12(1.8분,mobile-final.log)통과. PC100% 두스크롤영역넘침0·100/160/200%클릭/겹침·모바일125%스크롤/도움말/구매검증. 직전 전체90/코어406/보드33은 이전 체크포인트 결과이며 이번 실행으로 간주하지 않는다.
- 백업:공개origin/main/선행0대0·권한·diff·민감패턴0건 확인,본체6파일만 cc84ae093c57183c7ca8a72f3a65da21d2ed7bce 커밋/Push 완료·원격SHA일치. 이번 문서2개 접두 구간은 별도 체크포인트. 기존 문서 여관 변경·수도원 PNG2개 보존/제외.
- 다음:이번 범위 미해결 오류 없음. 모바일 정밀QA는 기존 후속 계획 유지,로컬3000 유지.

---
# 최신 체크포인트 — 최종 공용 보드 중앙축·네 패널 (2026-10-20)

- 이번 UI 작업 구현·검증·본체 백업 완료(전체 프로젝트 완료 아님). 보드950×1030·양피지 유지. 1번 방패(475,160)→가로 타일y290→상품(475,390),4번 상품(475,690)→가로 타일y790→방패(475,920). 2/3/4인 실제 공급 수량 그대로. 중앙축x475/플레이 중심y540.
- 검은 공급처 모든 슬롯의 bbox 중심(475,540), null 슬롯 유지로 구매·복원 후에도 중심 고정. 네 패널 공통 CornerPanel(좌18/우542,폭390;상18/높이205,하857/높이155). 측면 위390/아래690. 여관 스택만 표시좌표(325,540)로 이동, 규칙 불변.
- 수정:src/app/common-board.tsx,tests/browser/common-layout.spec.ts,docs/design/common-board-layout.md 및 이번 TODO/PROGRESS 접두 구간. 기존 문서 여관 구간·PNG2개 미커밋 보존/커밋 제외. 엔진/AI/저장/다른 확장/포도밭 변경 없음.
- 직접 화면 확인:2/3/4인 전체 및 1/4의200% 확대,4인12방패 확인. 증거 .local-data/final-layout/{before-Np-board,after-Np-shields,after-4p-depot-{1,4}-200,debug-4p}.png. 디버그선은 캡처에서만 임시 삽입.
- 이번 검사:관련PC10/10통과(related.log),코어406/406(core.log),보드33/33(boards.log),타입/린트/프로덕션빌드 통과(types.log/lint.log/build.log). 최종 전체PC90/90통과(pc.log,10.7분,실패/skip0). 전체 실행 중 소스/테스트 해시 변경0(verified-source-hashes.json).
- 백업:origin/main 선행0대0·공개상태/Push권한·diff·민감패턴0건 확인. 본체3파일만 6966875eb523317e099f4313773663781f5ce574 커밋/일반 Push 완료,원격main SHA 일치. 이번 문서2개 접두 체크포인트는 별도 커밋. 사용자 공개 전환 저장소 유지.
- 다음:이번 UI 미해결 오류 없음. 모바일 정밀QA는 최종 통합 단계로 유보,로컬3000 유지. 기존 문서 여관 변경2개/PNG2개는 그대로 미커밋 보존.

---
# 최신 체크포인트 — 공용 보드·포도 공급처 UI 통합 (2026-10-20)

- 이번 UI 구현·검증 및 본체 백업 완료. 전체 프로젝트 완료 아님. 기준 main/d2575f4. 사용자 최신 확정:950×1030 보드 및 좌우 모서리 패널(각390×205) 고정. 이전 중간1200×1330에서면적38.7% 축소한 상태 유지.
- 1/4 재설계:일반 타일2열(1:x462/390,y280/360;4:y860/940), 세로 방패 중심(540,320)/(540,900), 상품 중심(650,340)/(650,830). 2/3/5/6 좌표 유지. 전 그룹 방패 간격70/회색 폭72, 한개 높이104·두개172. 보드 크기·상단·검은 마름모 불변. 최종표=docs/design/common-board-layout.md.
- 포도 원인 실측:채워진100×57 SVG/빈46×57 SPAN, 획득 시 버튼폭112→58. VINE_TILE_FRAME(원래100×57 viewBox/path) 공유, 표시140×79.796875·버튼157×142로 실물/빈칸 동일. 공급 패널260→360, 실측 높이2인407→665.09375/3인500→819.09375/4인596.5→973.09375. 2열/색상범례/고정가격·비용행, 내용 기반 높이. main 고정950+가로스크롤, 개인 포도밭 좌표/보관그림 기본100×57 보존.
- 파일:src/app/common-board.tsx/common-board-backdrop.tsx/game-screen.css/vineyard-board.tsx/vineyards.css;browser/common-layout.spec.ts/shields.spec.ts/vineyard-supply-layout.spec.ts;설계/TODO/PROGRESS 총11개. 엔진·AI·저장형식·원본PNG·포도밭4층/총5토큰 변경 없음.
- 기준안 검증:PC87/87(final-pc.log,10.7분), 코어406/406/보드33/33/타입·린트·빌드 통과. 이후 최신1/4·포도추가 요청 적용했으므로 이87통과를최신전체통과로표현하지않는다. 최신 관련20/20통과(followup/target.log,2.5분), 코어406/406·보드33/33·타입/린트/빌드도 followup/ 로그로 재통과. 최종전체PC90/90통과(followup/final-pc.log,11.2분,실패/skip0;기존85+신규5). 최종실행중소스/테스트해시변경0(frozen-files.json).
- 증거:.local-data/common-expanded/followup/before/after-{2,3,4}p-{combined,board,supply-filled,supply-empty}.png 및 before/after-sizes.json. 최신4인 합동화면/2인 빈칸 직접확인(패널width360/실물·빈칸픽셀동일). 1/4전후200% 및최신160%확대직접확인완료. 이전3/6확대사진도보존.
- 보존:기존PROGRESS/TODO 여관구간·수도원PNG2개미커밋보존/커밋제외. 원격은사용자가공개전환한maxnjun/burgundy-expanded/main,Push권한/선행0대0확인. 본체9파일만 a19a7a3a59f5d87b2fbef28729541136f2299fb4 커밋·main Push 완료/원격SHA일치. 이 문서/TODO의 이번 구간은 별도 체크포인트로 기록(최종HEAD는 git log -1 참조).
- 다음:이번 UI 범위 미해결 오류 없음. 모바일정밀QA및사용자화면피드백은후속. 다른 확장 신규 개발은 기존 보류 원칙 유지. 모바일정밀QA유보.3000서버유지.

---
# 최신 체크포인트 — 방패 미리보기 겹침 해결 (2026-10-20)

- 이번 겹침 수정 검증 및 비공개main 백업 완료. 전체 프로젝트 완료 아님. 시작 main/6bd7f27. 기존 문서2개 여관 기록/수도원 PNG2개 미커밋 보존. 포도밭4층V11/최대5토큰·게임규칙/원본PNG 변경없음.
- 원인:4번공급처가쌍방패일때두번째중심(490,570),3번공급처하단가축과bbox14×3.3675SVG단위겹침(PC100%11.846×2.849px).2인단일슬롯은문제없음.
- 수정:src/app/common-board.tsx,4번공급처가2슬롯일때만그룹cx455→431(−24),두번째중심466/570. 세로/간격/타일/상품/검은공급/2인배치는그대로. 본체/선택/빈슬롯/연결선/라벨에같은계산좌표사용. 수평간격10.000006SVG단위,전후2/3/4인측정겹침0(after.json).정보제목과라벨도비겹침.
- tests/browser/shields.spec.ts:기존assert유지,방패라벨·정보패널/제목까지겹침범위추가,PC2/3/4인100·160·200%/모든방패중심hit검사/실제클릭·선택취소·획득후빈슬롯·저장검사유지. 확대시실제scrollIntoView(center)후hit확인.
- 최종검사:관련PC8/8(final-target.log),전체PC85/85(9.7분;final-full-pc.log),코어406/406(core.log),보드33/33(boards.log),npx tsc --noEmit/npm run lint/npm run build통과(final-lint.log/final-build.log).최종코드고정후전체PC실행,실패0/skip0.초기수직이동시도/중단한전체실행은최종통과수에포함안함.
- 증거:.local-data/shield-overlap/에기존trace/screenshot복사original/,전후before.json/after.json,before-{2,3,4}p.png/after-{2,3,4}p.png,배율after-Np-{100,160,200}.png,수정영역확대after-{3,4}p-{160,200}-detail.png.수정전후100/160/200직접시각확인.최종trace/결과는final-full-pc/.로그/이미지는Git제외.
- 남은범위:이번겹침수정/PC회귀의미해결오류없음.모바일정밀QA는요청대로최종통합단계로유보.엔진/AI규칙/이미지/포도밭좌표불변.
- 백업:민감패턴0건/실제diff확인·비공개/Push권한/원격0대0확인후이번4파일만6f50090559f5932b41bc43197152e4453c6eff3b로main Push/원격해시일치.기존여관문서구간2개/수도원PNG2개보존·제외.
- 다음:이번PC겹침2건해결완료.후속모바일정밀QA는최종통합단계에서실행.로컬3000서버유지.

---
# 진행 체크포인트 — 포도밭4층 수정 (2026-10-20)

- 진행중/전체 프로젝트 완료 아님. 시작 main/9be7e63. 기존 문서2개 여관 기록/수도원 PNG2개 미커밋 보존.
- 사용자 정정 확정:4층은 맨 위 중앙 가로2칸 V11(눈6/승점4·자유행동). V07 왼쪽 위는3층. 아래부터2/4/5/1;V01~02 /V03~06 /V07,08,09,10,12 /V11. 초기3층 및 중간V07판독 오류는 폐기. 시작1+층4=총5토큰 사용자 확인.
- 구현:회전된 표시공식/정방향아이콘/흰측면·진한경계/층색보존. 공통층판정1~4/최대5/AI층잔여·공개토큰가치/토큰선택평가. 좌표·번호·보너스·공용공급·기존타일원본불변.
- 저장:신규v2 topSlotId=V11. 검증된 진행v1은 보상수량 그대로 승격,완료v1은 과거점수유지. 최상층ID없는중간v2도기존보상과새층경계가일치하면표식만보완. 불일치보상이면명시안내로거절/원본보존(임의토큰재배정안함).
- 수정:src/app/vineyard-board.tsx,vineyards.css;game/vineyards.ts,core/vineyard-effects.ts,save.ts,computer.ts;tests/core/vineyards.test.ts,fixtures/vineyards.ts,browser/vineyards.spec.ts;설계/규칙/연구문서·TODO/PROGRESS.
- 최종검사:코어406/406(four-release-core.log),보드33/33(four-boards.log),관련42/42(four-final-save-tests.log),타입/린트/프로덕션빌드통과(four-release-*). PC전체85중83통과/2실패(11.7분;four-final-PC.log),포도밭최종7/7+100/160/200실측2/2통과(four-release-browser.log/four-zoom-browser.log). AI2/3/4인각30게임 총90게임25라운드/저장통과(443초;four-final-simulation90.log). 마지막저장표식/글자보완은AI정책·현재신규게임진행불변,최종관련/전체코어/PC재검사완료. 전체브라우저통과아님.
- 발견오류:PC shields.spec.ts의방패미리보기3/4인공용보드겹침검사2건실패(line24 overlapping=true). 포도밭비활성상태이며이번common-board.tsx/공용CSS변경없음. 실패테스트/원본로그·스크린샷/trace보존(test-results/shields-shield-groups-{3,4}p-*)·후속별도수정필요. 전체브라우저통과라고보고하지않는다.
- 화면:.local-data/qa/vineyards-four-{multiple,enlarged,token-choice,completed}.png 및 vineyards-empty-estate.png.직접시각확인완료(빈보드/여러배치/V11보상·확대). 검은/상점 획득 라벨은두줄로줄바꿈해칸침범방지.모바일정밀QA미실행.
- 백업:14파일의이번변경만9f0c00ef4213b19c66dfd0d8fdb86d6bcdddd7fd로비공개mainPush/원격해시일치.민감패턴0건·원격선행0/0·권한/비공개확인.기존PNG2개/문서여관구간제외보존.
- 다음:후속별도우선:방패미리보기3/4인겹침2건수정/원본실패재실행(포도밭비활성).모바일정밀QA유보.서버25180/127.0.0.1:3000유지,사용자내장브라우저탭열어둠.

---
# 현재 구현 체크포인트 — 포도밭 프로젝트 복원판 v0.1

2026-10-20 · 구현/검증 완료 단계, 구현/검증 및 비공개main 백업 완료. 기준 main/156c6e6. 전체 프로젝트 완료 아님. 기존 문서2개 여관 기록/수도원PNG2개 미커밋 보존.
- 구현:game/vineyards.ts(24칸/12쌍/3층2·4·6·51장·공급/축소·보관2칸·배치·점수/검증),core/vineyard-effects.ts(2보너스 순서·자식스택·층 토큰·무료획득),기존 core/types/practice/computer/computer-shields/direct-actions·server/rooms/room-http 연결.
- UI:app/vineyard-board.tsx/vineyards.css. 개인 영지 오른쪽 항상 펼침, 기존 영지 좌표 유지. 공용 옆 공급/상점/토큰, 주사위 직접 선택·뒤집기·2칸 예약·폐기 확인. 로컬2~4인/AI/온라인2인, 서버 보유 주머니 순서는 비공개. PNG/원본/타일프레임 변경 없음.
- 검사:전체 코어401/401(기존364+신규37),보드33/33,PC 고유28개(기존23+신규5).최신 온라인 포도 폐기/취소/배치/재접속 및 기존 방패3 포함8/8. 최종 저장 검증/출처 메타 강화 후 관련37/37·TypeScript/ESLint/프로덕션 빌드 재통과.
- AI:게임 로직 수정 후 VINEYARD_SIMULATIONS=30으로2/3/4인각30게임,총90게임25라운드+중간저장 통과(232초).관련36개 전체통과.최종 저장 불변식/출처 강화는별도관련37개 재통과,정책/진행로직변경없음.장기검증을 모바일/온라인90게임으로표현하지않는다.
- 화면:.local-data/qa/vineyards-{empty-estate,planted-estate,common-board,supply,online,online-placed}.png.빈/배치/공용/온라인 원본 스크린샷 직접 확인,24칸/12쌍/55공유변·층2/4/6·오른쪽/공용옆 배치 검사.시각 CSS/기하/규칙 분리.모바일정밀QA는후속.
- 수정:장기3인seed5 방패15→단계종료 흰 성에서 whiteDie가 null이 되어선택0개→흰눈금을 단계보너스끝까지유지(없는과거기록은임의복원없이사용안함).장기4인포도discard AI type조회오류→포도별도가치.방패4상실2칸정리·인원변경축소초기화·온라인폐기확인/취소.테스트삭제/완화없음.
- 파일:위소스와 tests/core/vineyards.test.ts/vineyard-online.test.ts/run.mjs,tests/fixtures/vineyards.ts,tests/browser/vineyards.spec.ts,docs/rules/vineyards.md/design/vineyards-proposal.md/TODO/PROGRESS.상세규칙/한계는 rules/vineyards.md.
- 남은범위:모바일정밀QA·첫버전시각사용자피드백·AI토큰/장기연결전략고도화.공식전수검증완료아님.새확장/온라인3~4/공식솔로/팀전은보류유지.
- 백업:28파일의 이번 변경만33b8c7b211aeae7bfc7484dedb714c46fd5eaa32로 비공개main Push·원격해시일치.민감패턴0건,origin/main선행0·관계없는로컬커밋0확인.기존문서2개여관구간/수도원PNG2개는제외보존.
- 다음:사용자PC화면피드백에따라시각설정조정,최종통합단계에서모바일정밀QA.기존우선순위보류항목을임의신규개발하지않는다.개발서버유지.

---
이전 체크포인트 보존

# 최신 체크포인트 — 포도밭 패턴 기반 설계

2026-10-20 · 사용자의 '특징을 찾아 나머지 설계' 요청으로 design/vineyards-proposal.md 작성. 게임 구현 요청으로 해석하지 않았다. 기준 main/a206423.
- 특징:눈금별2회/층2·4·6/창고4·자유행동3·4VP3, C덱 혼합각3·동색각1.12슬롯의 한 색 포도 상한13이 공식 점수표와 일관됨. 품종1/2개 제거 시 상한13/11.
- 제안:복원 보드/C덱 유지, 미확인 공급대는(1,4)/(2,5)/(3,6),보너스는품종당4개. 공식 확인이라고 주장하지 않고 P01/P02 프로젝트 초안으로 분리. 무료 여관 제외·포도 액션 수도원9~12 할인 제외 등 보수적 호환 판정도 명시.
- 설계:두칸 예약 보관/첫배치/두 보너스 순서와 자식 continuation/층 지급/최종 점수/AI/온라인 저장 검증 및 향후 시뮬레이션 목표를 기록. 게임데이터·규칙·PNG는 변경하지 않음.
- 검사:조사표12행/눈금각2/보너스24 재집계, 공급쌍 최소 일꾼 평균2/3·최대1(인접쌍 평균1·최대2),51장/축소35·22/색별 포도 상한13·13·11 계산. 로그 .local-data/vineyards/design-pattern-check.json. 실제 플레이/밸런스/게임 테스트·빌드 실행 아님.
- 다음:사용자가 초안을 채택/수정하고 구현을 요청하면 진행. 기존 연구 문서/등급 유지. 이미 검증한 여관/무역로를 재작업하지 않는다.
- 백업:설계/체크포인트3파일만09bc1d5967135070cc1cb06a8dd60b477457af84으로 비공개main Push, 원격 전체해시 일치 확인. 비공개/권한/원격0대0 및 민감정보 패턴0건 검사. 시작 미커밋 문서2개 여관 기록/수도원PNG2개 제외·보존. 이 완료 기록도 별도 문서 체크포인트로 백업.

---
이전 연구 체크포인트 보존

# 최신 체크포인트 — 포도밭 공개 자료 조사

2026-10-20 · 조사 전용 완료, 구현 금지/추가 승인 대기. 기준 main/48083e9.
- 결과: research/vineyards-reconstruction.md(출처/등급/보드24칸/12공간·12숫자/24보너스·51장C수량 후보·호환성·대안), research/vineyards-board-analysis.svg(자체 도식).
- 원본 공식PDF 직접200/19,620,991bytes 및 기존PDF SHA일치. 공개 빈보드/공식도상 교차, 사진14조합과 51장 전수 미확보를 구분. 제거16/29로 혼합15종×3+동색6종×1 논리 복원(C), 공식 전수검증이라고 주장하지 않음.
- 미확인:2/3인 공급대 눈금 세 쌍(E), 보너스6종 개별수량(D), 특수 효과 적용 일부(D), 보드 층/좌표 및 논리 수량은C채택 결정 필요. 사용자에게 사진 요청 없음.
- 검사: 연구 산술51/102/품종17/제거16·29·24좌표 중복0/12쌍 인접 및 SVG XML 검사, 도식 직접 확인. 게임코드 무변경이므로 테스트/타입/린트/빌드/서버 실행하지 않음. PDF/사진 사본은 Git제외 .local-data/vineyards에만 보관.
- 보존: 시작부터 있던 TODO/PROGRESS 여관 기록과 수도원PNG2개를 유지하고 이번 스테이징에서 제외. 기능·PNG원본·렌더러 변경 없음.
- 백업: 조사 문서/도식/체크포인트4파일만 1c05540e3b3611a212f588f57afe682809a9fef0으로 비공개main Commit/Push, 원격해시 일치 확인. 민감정보 패턴0건·원격선행0대0. 이 백업 완료 기록도 후속 문서 커밋으로 보존한다. 최종 보고 후 중단하며 추가 승인 전 데이터 등록/커스텀 확정/구현하지 않는다.

---
이전 체크포인트 보존

# 현재 체크포인트 — 사용자 커스텀 무역로

2026-10-19 · 사용자 고정 데이터 구현, 커스텀 무역로 구현·검증·비공개main 백업 완료. 전체 프로젝트 완료 아님.
- 기준 main/de8a95a. 기존 문서2개의 여관 기록 변경과 수도원 원본PNG2개는 보존하고 이번 커밋에서 제외한다. 여관/그림/프레임/공용 배치·배경은 변경하지 않았다.
- 완료: 사용자12장/36칸, 직접 주사위 판매1회=1칸, 9보상 기존 선택 엔진 재사용, 모든 보상/후속 판매의 재진행 차단, 서버 RNG배분/검증/재접속, 저장 검증, AI평가, 접힌 현재1장/전체 펼치기/자동 전환/뒷면/완료 표시. 공식 자료 추가 조사 없음. 상세 규칙/36칸: rules/custom-trade-routes.md.
- 검사: 신규 코어21+온라인1/22 통과, 전체 npm run test:core 364/364, npm run test:boards33/33, npx tsc --noEmit·npm run lint·npm run build 통과. AI2/3/4인25라운드+확장 동시활성/중간저장 포함. 신규 PC브라우저5/5 통과; 기존 PC회귀19/19도 통과하여 이번 PC합계24/24.
- 화면: .local-data/qa/custom-trade-{collapsed,expanded,sale,mismatch,next-card,complete,online}.png 생성. 펼친 전체·판매보상·경로완료·온라인 실제 스크린샷 직접 확인했다. 기존 공급/영지 SVG 좌표 변경 없음. 모바일 정밀QA는 보류.
- 수정/오류: 테스트 p선언을 const로 수정해 lint 통과. 온라인 브라우저의 접근성 이름을 실제 온라인 행동 종류로 수정해 통과. 샌드박스 전체코어의 임시파일 rename EPERM은 동일명령 일반권한 재실행에서364개 통과. 테스트를 삭제/완화하지 않음.
- 파일: game/custom-trade-routes.ts, core/trade-effects.ts, 기존 effects/engine/state/practice/types/computer, app/trade-route-panel.tsx/game-screen.tsx/css/online/room-screen.tsx, server/rooms.ts/room-http.ts, core/custom-trade*.test.ts/run.mjs, browser/custom-trade*.spec.ts, fixtures/custom-trade.ts, rules/custom-trade-routes.md 및 관련 규칙/체크포인트 문서.
- 다음: 이번 커스텀 무역로 범위 완료. 모바일 정밀QA는 최종 통합 단계에 남겨 둔다. 신규 지시 전 여관/완료 기능을 재작성하지 않는다. 실행: 로컬 게임 준비의 무역로 확장 체크 후 새 연습 시작, 온라인은 온라인 무역로 확장 체크 후 방 생성.
- 백업: 이번26파일만 ea464250bc97c9f4d307e6e2341c0ee247a72c63으로 비공개main Push, 원격 전체해시 일치 확인. 비공개/Push권한/원격0대0 및 민감정보 패턴0건 확인. 문서의 기존 여관 변경은 prefix패치로 분리하고 PNG2개는 제외했다. 이 완료 체크포인트는 후속 문서 커밋으로 백업한다. .local-data 스크린샷/로그는 Git 제외 로컬 산출물.

---
이전 체크포인트 (당시 상태를 보존)

# 현재 체크포인트 — 무역로 확장

2026-10-19 · 기초 모듈/테스트 완료, **실제 게임 확장은 미완료·자료 대기**.
- 시작 main/8a60c2f. 이전부터 미커밋인 TODO/PROGRESS의 여관 완료 기록과 수도원PNG2개를 보존한다. 여관 코드·이미지·공용 보드·양피지 배경은 변경하지 않았고 여관 추가 검사는 하지 않았다.
- 자료: reference 공식PDF3·14페이지와 복사본, 아크릴 스티커PDF 텍스트, Awaken 공식 다운로드/상품/영문PDF 조사. 구성12장·각3칸, 2/3/4인5/4/3장, 좌→우 채우기·번호 일치 보상·초과 판매 규칙 확인. PDF그림은 예시3장뿐, 전체36칸 번호/보상은 확보 못함. 확정 보상 없이 추측하지 않는다.
- 구현: src/game/trade-routes.ts 독립 순수 모듈(카탈로그 주입), 기존RNG로 무작위 배분/잔여, 판매 진행/일치 참조/초과상품/재전송 방지/JSON 이력 검사. 공식 catalog는0개, 가상12장은 tests/core/trade-routes.test.ts의 TEST FIXTURE ONLY. 실제 GameState/GameAction/상품 판매/AI/온라인/UI에는 아직 연결하지 않았다.
- 검사: 신규7/7·기존 core/effects/direct-actions51/51, npx tsc --noEmit·npm run lint·npm run build 통과. 여관 회귀/전체보드/브라우저는 이번 변경과 관계없어 재실행하지 않았다. 마지막 빈 카탈로그 freeze/문구 수정 후 신규7개·타입/린트/빌드도 재통과했다.
- 파일: src/game/trade-routes.ts, tests/core/trade-routes.test.ts, tests/core/run.mjs, docs/rules/{trade-routes,sources,unresolved}.md, TODO/PROGRESS 신규 머리말. 이전 문서 변경은 이번 커밋에 섞지 않도록 패치를 분리한다.
- 연결 설계: core/intents.ts sell-goods 공통 경로. soldGoods 전체 판매이력과 물리적 경로 위치 분리, 수도원15/25·방패9+수도원3·방패2·선택/추가행동을 중복 없이 원자적 실행. 자세한 근거/URL/미완료 목록은 docs/rules/trade-routes.md.
- 백업: 기초 모듈/테스트/조사/신규 체크포인트8파일을 a60029bc1a698c109fee40c80594d35e2be8abe9로 Commit/Push, 비공개main/권한/원격0대0 확인 후 원격 전체해시 일치 확인. 기존 문서2개의 여관 완료 변경과 PNG2개는 미커밋 그대로 남겼다. 실제 확장 전체가 완료된 것은 아니다.
- 다음: 무역로12장 앞면 전체(각3칸 번호/보상 수량)와 불명확 보상 판정을 확보→검증 카탈로그→공통 판매/저장/준비/진행 UI→AI/서버/브라우저 검사. 모바일 정밀QA 보류. 필요한 자료 없이 확장을 활성화하지 않는다.

---
이전 여관 체크포인트 (기존 변경을 그대로 보존)

# 현재 개발 체크포인트

2026-10-19 · 여관 확장 통합 구현/검증 마무리, 비공개main 백업 대기. 전체 프로젝트 미완료.
- 기준 main/09e9d80. 기존 미커밋 public/tiles/monastery-27.png·monastery-28.png 원본은 보존/백업 제외. 기존 개발 서버 유지.
- 규칙: 사용자 지시문/추가 답변만 적용, 공식 추가조사 없음. 은화2·주사위 없이 검은 구매와 턴당1회 제한 공유. 독립 inn 타입/옵션, A–E 각1개·최대5·이월·중복공급방지·top1개 구매. 포도밭은 그림 장식.
- 조커: 원래37칸/6색/숫자/지역/연결 불변, 모든색 배치·같은지역1개·고유타일 효과 없음. 실제 지역 완성 시 점수크기+1, 방패17 합산 최대크기10=55를 명시. 단계/색상/요새 점수 독립. source는 project-user-rule. 보관함 교체는 기존 확인 경로 유지.
- 모드: 로컬2–4인 새게임 옵션, AI가 합법 구매/배치/점수평가, 온라인2인 생성 옵션/서버 계산/공개 스택/좌석·리비전검증/양쪽 동기화/재접속. 랜덤영지 시작 시 옵션 보존. 과거 저장은 여관 추가 없이 그대로, 잘못된 공급·중복지역·예약풀 혼입은 거부.
- 이미지: public/tiles/originals/inn-user-original.png 원본 SHA256 동일 보존, public/tiles/inn.png 투명 파생(RGBA1312×1199, 4모서리alpha0). alpha>128 bbox(95,2)-(1208,1199)를 InnArt가 실제 육각형 마스크로 정규화, 금색 원래 rim 사용·추가 프레임 없음·실패 SVG fallback. 상세 해시/처리/규칙은 rules/inns.md.
- 화면: 기존 검은 마름모/상품/공급 좌표 유지. INN_STACK 중심(215,398)/폭40/층(-1.4,+1.8), 실제 PNG1–5개·투명 그림자·cost/count 배지. union hit path로 노출된 아래층도 같은 구매 대상. PNG 공용/보관/영지/온라인 공통, 다른 타일 원본/프레임 불변.
- 검사: 전체코어335/335(기존311+신규24)·보드33/33 통과. AI2/3/4인25라운드+흰성/수도원29/기중기/방패/요새·저장, 온라인서버 위조/재전송거부/재접속 포함. PC신규9/9(로컬2/3/4인 준비UI 포함, 관련 분리 실행)·기존19/19(직접UI25라운드·공용·방패온라인3·흰성2) 통과. 최종 로그 관련2/2 재통과. TypeScript·전체ESLint·프로덕션 빌드 통과, 마지막 배지/온라인viewBox·로그까지 관련 재검사/타입/린트/빌드 재통과.
- 화면 산출: .local-data/qa/inn-stack-{1..5}-{100,160,200}.png와 detail-* / acquired-*, inn-storage.png, inn-estate.png, inn-completed-estate.png(실제 구역 크기2→3:6점+단계10=16점), inn-four-seats.png, inn-online-purchased.png. 1–5 상세·200%·4인 전체·구역완성 직접 확인. 타일/상품과 스택/배지 다각형 비겹침·실제 중심 클릭 검사. 확대 화면의 가로이동은 기존 방식 유지.
- 수정/실패: 합성 구역 테스트의 regionId 중복을 고쳤고 기존 assert는 완화하지 않음. 새 보관 테스트의 aria이름을 실제 UI로 수정. 4인 공급에서는 처음 오른쪽 배지가 검은 타일과 겹쳐 정밀 검사 실패→왼쪽 빈공간으로 이동하고 온라인viewBox도 확대. lint prefer-const1건 수정. 수정 후 여관PC8/8·추가 로컬준비1/1 및 온라인1/1·최종 타입/린트/빌드 통과.
- 파일: src/game/{types,inns,practice,save,computer}.ts, core/{state,engine,placement,phases,effects,shield-effects}.ts; src/server/{rooms,room-http}.ts; src/app/{inn-art,inn-stack,common-board,game-screen,tile-art,tile-frame}.tsx, online/room-screen.tsx, game-screen.css; tests/core/{inns,inn-online}.test.ts 및 run.mjs; 기존 effects/phases/placement/white-castles fixture는 BaseTile 타입만 좁힘(assert 유지); tests/browser/{inns,inn-online}.spec.ts; 위 PNG2개와 docs/{TODO,PROGRESS,rules/inns,history/progress-parchment-complete-2026-10-19}.md.
- 다음: diff/비밀검사→이번 변경만 private main Commit/Push/원격 전체해시 확인. 모바일 정밀QA는 사용자 요청대로 최종 단계로 보류. 여관 관련 남은 규칙 기능은 없음.
