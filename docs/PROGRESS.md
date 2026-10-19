# 현재 개발 체크포인트

2026-10-19 · 공용 보드 배경 개선 검증 중. 전체 프로젝트 미완료.
- 기준 main/f4d2be9. 기존 미커밋 public/tiles/monastery-27.png·monastery-28.png 원본은 보존하고 백업 대상에서 제외한다.
- 구현: common-board-backdrop.tsx의 비대화형 SVG 양피지 gradient/섬유 pattern/금색 이중 프레임/모서리 장식/희미한 문양. CSS 갈색·금색 도구/점수 패널, 상품 공간 색상, 필터 없는 반투명 타일 그림자.
- 보존: 공급처6개/상품6공간/검은 마름모/방패 좌표·viewBox·타일 이미지/공통 프레임·GameAction·규칙·저장 구조 불변. 전체 배경 PNG를 삽입하지 않았다.
- 여관 제한: src에 여관 타일·스택·페이즈 보충 상태가 없고 TODO도 미구현이다. 기존 구현을 유지했다는 주장은 할 수 없다. 배경 요청 범위에서 여관 기능/위치를 임의 생성하지 않았으며 별도 구현이 필요하다.
- 검사: 코어311/311(정상 권한 재실행), TypeScript·전체 ESLint·프로덕션 빌드 통과. PC 공용보드4개+기존 직접 조작10개 최종14/14 통과(1.5분): 클릭·은화구매·저장복원·확대·장식 비간섭·방패 장착·실제25라운드 완주 검증.
- 화면: .local-data/qa/common-before-{2,4}[-shields].png와 common-after-{2,4}[-shields].png, common-costs-*.png 생성. 변경 전2인/변경 후2인·4인방패를 직접 확인, 기존 위치와 클릭 영역 유지. 모바일 정밀QA는 요청대로 보류.
- 발생/수정: 새 CSS SVG drop-shadow 필터 적용 시 Edge 페이지 load 지연 재현. CSS 필터 제외 시 정상 복구, 최종은 반투명 polygon 그림자를 사용한다. 첫 코어 실행은 샌드박스 temp rename EPERM이므로 실패로 기록, 정상 권한 재실행311개 통과. 기존 개발 서버 유지, 임시 프로덕션 QA 서버3001은 종료했다.
- 파일: src/app/{common-board-backdrop.tsx,common-board.tsx,game-screen.css}, tests/browser/common-layout.spec.ts, docs/{TODO.md,PROGRESS.md,history/progress-fortress-draft-complete-2026-10-19.md}.
- 다음: 직접 조작 최종 회귀 결과 확인→diff/민감정보 검사→대상7파일만 Commit/Push→원격해시 확인. 여관 구현은 별도 후속 작업. 이전 요새/랜덤 상세는 history 체크포인트에 보존했다.
