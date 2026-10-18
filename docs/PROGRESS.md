# 현재 개발 체크포인트

갱신:2026-10-19. 전체 프로젝트 미완료. [직전 진단 체크포인트](history/progress-hex-diagnosis-2026-10-19.md).

- 요청:5종 원본(성/광산/선박/수도원27/28)의 중앙 그림을 보존하고 불규칙한 이미지 테두리를 분리, 공통 입체 SVG 프레임과 CSS 중복 제거, PC 화면/검사 후 백업.
- 시작 main/8b2d2a4. 기존 미커밋은 수도원27/28 원본2개. 원본5개 바이트를 절대 수정하지 않는다. 기존2개 변경은 보존하며 이번 커밋에는 직접 수정한 파생/코드만 포함한다.
- 진단 재사용: 좌표/인접90쌍은 변경하지 않는다. table-view의polygon stroke2와 공통Grid1px 중복을 제거할 계획이다.
- 구현: public/tiles/illustrations/에5종 분리 에셋·팔레트를 생성했다. 원본은 그대로 읽고 프레임 안쪽 contour/깃발·뱃머리·십자가·번호 리본 마스크를 사용한다. 마스크 적용 전후 RGB는 원본과 바이트 동일하며, 이후 비율 유지BICUBIC fit만 한다. 임의 종류별CSS 보정은 없고 같은 수식으로 측정된contour중심과 최대지지거리에서fit을 계산한다. 원본 해시가 바뀌면 재검토 없이 처리하지 않는다.
- 공통 tile-frame.tsx는 같은 정육각형/3개 안쪽 링(.0～.5～1.85～2.2,100폭 기준)을 그린다. 원본에서 실제 추출한 dark/base/light와 장면 가장자리색을 사용하며 새로운 그림/인페인팅은 없다.5종은 공급/보관/영지/확대의 같은TileArt를 사용한다. fallback SVG도 공통프레임을 유지한다.
- 중복 제거: broad polygon CSS를기초셀로좁혀stroke:none; hover/focus/온라인성장착은프레임색으로표시; EstateGrid는프레임셀과닿는변을그리지않고빈칸/다른기존타일경계를유지한다. 합법강조는안쪽1.5SVG로옮겼다. 기존칸/엔진/저장은변경하지않았다.
- 검증: 관련PC17/17·코어286/286·보드33/33·TypeScript·ESLint·프로덕션빌드통과. 초기실패는새fixture의12개를11개로센기대값과보간alpha5/2/2픽셀의프레임침범이었으며 기대값/3px보간여유를고쳐재검증했다. 최종5종모두프레임안쪽에수용된다. 수도원27/28 누락fallback까지확대재검사1/1도통과했다. QA스타일제거Node타입을수정한뒤타입/린트/빌드재실행통과. 빈칸의기존opacity.78은유지했다.
- 화면: .local-data/qa/uniform-original-vs-svg.png 원본/수정비교와uniform-pairs-{100,160,200}.png(동종/혼합/수도원/빈칸)을직접확인했다. 실제영지3배율은estate-after-desktop-1280-*.png. 체크무늬없음/번호·아이콘·깃발·뱃머리확인. 일부사진주변은원본추출장면색gradient로연결되며그림을생성하지않는다.
- 선폭: 한쪽림은1.829045653 SVG단위,짝의합3.658091306. QA검정마스크의100/160/200% 공유변커버리지는성/광산/선박모두각각5/7/8화면픽셀로같다(AA포함). core<128은2/4/8픽셀;이는분수좌표의AA이며실제틈/외곽좌표오차는없다. 원자료uniform-rim-widths.json.
- 다음: 수도원fallback/최종검사확인→민감정보/원본보존/비공개main확인→이번관련파일만Commit/Push·원격해시확인. 기존수도원원본2개와기존estate파생/정규화스크립트는삭제/변경하지않는다. 모바일정밀QA는보류.

- 변경파일: src/app/{tile-frame.tsx,tile-art.tsx,estate-geometry.ts,estate-tile.tsx,game-screen.tsx,online/room-screen.tsx,game-screen.css,globals.css}; scripts/extract-tile-illustrations.py; public/tiles/illustrations/{castle,mine,ship,monastery-27,monastery-28}.png·manifest.json; tests/browser/{tile-frame,estate-geometry,tile-png}.spec.ts; docs/TODO.md·PROGRESS.md·history/progress-hex-diagnosis-2026-10-19.md.
- 주의: 기존 수도원원본2개의 미커밋변경은 보존하므로 원격체크아웃의 원본과 파생manifest의 원본해시가 다를 수 있다. 재추출 시 해시보호장치가 중단하며 현재로컬원본 또는 사용자지정원본이 필요하다. 배포는 이미 생성한분리PNG만사용하므로5종표시에는영향없다.
