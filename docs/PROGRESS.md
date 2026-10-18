# 현재 개발 체크포인트

갱신:2026-10-18. 전체 프로젝트 미완료. 과거 기록: [직접 입력](history/progress-direct-input-2026-10-18.md).

- 우선순위: 방패 AI 완료 → 온라인2인 방패 구현·검증·백업 완료. 온라인3~4인·공식 솔로·2대2 신규 개발 보류. 기존 코드/검사/문서/저장은 보존했다.
- 방패 AI: 합법 행동 열거·공개 정보 기반18종 가치/유지비/교체 평가·저장/로컬 AI 연결.2~4인25라운드·18종·재접속·모바일을 검사했다.422/422 및 타입/린트/빌드 통과 후 c86ae4f를 비공개 main에 Push하고 원격 해시를 확인했다.
- 온라인2인: 방 생성 시 방패 옵션, 서버 합법 행동 검증, 공용 슬롯/장착/6대상/종료 점수의 공개 상태, 방패 선택과 성/교체 비용 안내, 오래된 폴링 응답의 상태 역행 방지를 연결했다. 미사용 방패/공급 풀·난수·좌석 인증 값은 공개 응답에 추가하지 않는다.
- 온라인 관련 코어11/11 및 신규 브라우저8/8(375/390/768/1280px) 통과. 위조/다른 좌석/중복 요청, 빈 슬롯 동기화, 단계 선택/유지비, U15 판매, 재접속 및 서버25라운드 종료를 검증했다. 모바일 검사1건의 서버 응답 대기 누락을 수정해 재검사했다.
- 기능 고정 후 전체 코어278/278·보드33/33·TypeScript·ESLint·Turbopack 빌드 통과. 전체 브라우저124/124(10.1분) 통과. 총435/435(기존390+신규45)로 전체 회귀를 보존했다. 검사 로그: .local-data/qa/shield-online-browser-full.log. 기능 커밋0a3dc91을 비공개 main에 Push했고 원격 해시 일치를 확인했다.
- 변경: src/server/{rooms,room-http}.ts, src/app/online/room-screen.tsx, globals.css, tests/core/{run.mjs,shield-online.test.ts}, tests/browser/{isolated-rooms.ts,shield-online.spec.ts}, TODO/PROGRESS/shield-ui 문서.
- 실제 개발 서버의 기존 방50개는 보존했다. 방 저장 한도 때문에 검사는 별도 임시 RoomStore/HTTP에서 실행하며 그 데이터만 정리한다. 기존 방의 임의 삭제/한도 변경은 하지 않는다. 검사가 끝난 후 소유를 확인한 프로젝트 개발 서버만 재시작했고 /·/online200 및 잘못된 방패 옵션400으로 새 코드 반영을 확인했다. 방50개 보존·서버 실행 유지. 온라인은 같은 서버의 개발용2인 기능이며 외부 서비스 배포는 아니다.
- 재개: 방패 AI·온라인2인 방패의 구현·검사·백업을 마쳤다. TODO의 공식 공급/보드 독립 대조와 실제 기기 검증은 미완료이며 전체 완성은 아니다. 새 요청 시 관련 체크포인트부터 이어가고 보류 모드의 신규 개발을 임의 재개하지 않는다.
- 명령: npm run test:core -- shield-online rooms room-http (관련), 전체 test:core / test:boards / test:browser -- --workers=2, npx tsc --noEmit, npm run lint, npm run build. 성공 로그는 .local-data/qa/shield-online-*.log(업로드 제외).
