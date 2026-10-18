# 현재 개발 체크포인트

갱신:2026-10-18. 전체 프로젝트 미완료. 과거 상세 기록: [직접 입력 체크포인트](history/progress-direct-input-2026-10-18.md).

- 시작 main/a70fd11, 변경·스테이징 없음. 기존390개(코어249/보드33/브라우저108) 통과 기록 유지.
- 최우선 **방패 AI 대전** 구현·검증 완료, 백업 준비. 다음은 온라인2인 방패 지원. 온라인3~4인·공식 솔로·2대2 신규 개발 보류. 기존 자료/저장 삭제 없음.
- 변경: engine 합법 행동 열거에 방패 획득/교체·6대상·16눈 변경을 추가했다. computer-shields의 공개 정보 휴리스틱으로18종 능력·유지비·종료 가치와 선택 큐를 평가한다. 규칙 효과는 기존 엔진에 위임한다.
- 활성 방패 AI 저장/로컬 AI·시연을 연결했다. 레거시 preview는 계속 거절한다. 관련 검사95/95 후 추가 교체/자원 판단 검사로 shield-computer24/24 통과. 실제 모바일/PC 시연 완주2개 및 사람↔AI 차례 반환 재검사2/2 통과. 초기에 round-setup 직후 검사를 끝낸 대기 조건1개를 고쳤으며 제품 차례 오류는 아니었다.
- 기능 고정 후 전체 코어273/273·보드33/33·TypeScript·ESLint(0경고)·빌드 성공. 전체 브라우저116/116(375/390/768/1280px) 통과(9.5분). 총422/422로 기존390개+신규32개를 보존·검증했다. 검토한13개 파일을 비공개 main에 백업한다. 다음 별도 기능은 온라인2인 방패이며 서버 코드는 이번 기능에서 수정하지 않았다.
- 효율 원칙은 AGENTS에 기록했다. 관련 코어 검사: npm run test:core -- shield-computer computer shields shield-rules. 전체: npm run test:core / test:boards / test:browser -- --workers=2, npx tsc --noEmit, npm run lint, npm run build.

온라인2인 방패 재개 지점: src/server/rooms.ts의 create 옵션/공개 ShieldLayout 투영, room-http.ts의 준비 입력 검증, src/app/online/room-screen.tsx의 방패 준비/공급/장착 표시를 연결한다. core 합법 행동 열거는 이번에 방패를 지원하므로 서버가 그 결과를 그대로 검증한다. 동시 요청·위조/다른 좌석·단계 선택·25라운드·재접속을 격리된 RoomStore/HTTP에서 검사한다. 실제 저장 방50개는 삭제하지 않는다.
