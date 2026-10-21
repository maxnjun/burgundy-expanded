# 최신 체크포인트 — 성 추가 행동·선박·상품 직접 선택 (2026-10-21)

- 승인 범위 구현·검증 완료, main 백업 준비 중(전체 프로젝트 완료 아님). 상세 변경 파일/원리/검사/경계는 docs/CASTLE_DIRECT_INPUT_NOTES.md.
- 기존 canonical 성 선택을 재사용하고 실제 주사위 우선 사용 시만 성 효과를 보관/복원한다. 시작된 필수 자식 효과는 계속 차단한다. 직접 타일 획득·저장고→영지 배치·상품 종류 전체 판매·노동자 획득·선박 네모칸/종류 그림 선택을 연결했다.
- Undo는 독립 행동별 전체 상태/RNG 스냅샷과 자식 효과 묶음. 시작한 효과 중 취소도 원래 행동으로 복원한다. 구버전 저장/sidecar 검증·서버 소유권/revision/재접속 유지. 온라인 Undo는 기존 미지원.
- 최종 전체 코어433/433·보드33/33·타입/ESLint/프로덕션빌드 exit0. 전체PC118개 최초116통과 후 기존 입력2건을 실제 조작으로 이관·재검증. 추가 PC/모바일30/30·온라인14/14·원본픽셀 확대2/2. PC 고유124개를 전체 실행+관련 재검사로 확인했다.
- 스크린샷 직접 확인: .local-data/castle-direct/{desktop-1280,mobile-390}/ 아래 2/3/4인 양쪽 순서·상품 종류 선택·온라인·100/160/200. 로그 .local-data/castle-*.log. 보드 좌표·원본 PNG·기존 규칙/AI 전략 유지, 새 의존성 없음.
- 기존 수도원 PNG2·asset-inbox·여관 문서 변경은 보존/백업 제외. 이번 기능/테스트와 이 접두 기록만 커밋한다. origin/main=13ea9ad 일치 및 public/main/권한 확인, 이전 사용자 공개 main Push 허용 유지.
- 제한: 온라인 Undo 미지원·전체 확장 모바일 정밀 QA 최종 단계 유지. 이번 범위 남은 오류 없음. localhost3000 유지. 다음은 이번 diff/민감정보 검사→선별 스테이징→일반 Push/원격 SHA 확인.

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
