# 현재 개발 체크포인트

2026-10-19 · 흰 성/수도원29 구현·검증·백업 완료. 전체 프로젝트 미완료.
- 시작 main/9fa5d24. 기존 미커밋 수도원27/28 원본2개는 보존·백업 제외. 이미지·SVG·좌표는 변경하지 않았다.
- 공식 PDF12–14와 공식 아크릴 라벨5–6을 확인했다. 흰 성은 베이지 건물6+검정2, 수도원29 노랑1. 선택 확장 white-castles로 A단계부터 공급에 혼합한다. 3·4인 공급 전체는 기존 연습 구성이라는 제한을 유지한다.
- 완료: 획득/보관/건물 배치·중복 건물 제한, 흰 주사위 현재 눈의 추가 행동과 자동 최소 일꾼 보정(실제 흰/개인 주사위 불변), 연쇄 선택, 수도원29 배치 흰 성당4점, 기중기 즉시 흰 성 선택과 종료 건물1개 간주(중복 보너스 방지), 방패10 배율.
- 로컬2–4·일반AI·온라인2인 옵션과 서버 검증 연결. 기존 save 버전 유지/확장 미사용 저장 그대로 호환, 추가 행동 대기/실행 후 복원 검증. 수도원28 구매로 가능한 추가 행동이 바뀌면 선택 목록 갱신한다.
- 검사: 전체 코어299/299(당시 신규13 포함), 보드33/33, PC 브라우저12/12(신규2+직접 조작10; 실제25라운드 완주), TypeScript·전체ESLint·첫 프로덕션빌드 통과. 이후 A단계 공급 보완/테스트1개 추가 후 최종 관련14/14 재통과. 최종 TypeScript·관련 ESLint·프로덕션빌드도 재통과했다.
- AI2·3·4인 각각25라운드 완료, 실제 흰 성 배치와 보너스 실행 확인. 기중기→흰 성→시청→은행, 0/1/여러 일꾼·1↔6·수도원8/12/28·29/방패10, 서버 위조/다른좌석/재실행 거부와 양쪽 재접속 상태 일치 검증.
- 실패와 해결: 작은 엔진 fixture는 공식 저장 형식 대상이 아니므로 저장 검증을 등록 보드 fixture로 분리했다. fixture 좌표 연결·단계별 상품 분포·HTTP Content-Type 기대를 수정했다. 샌드박스 임시 rename EPERM은 정상 권한의 격리 서버 테스트로 교차 검증했다. 게임 저장 검증을 완화하지 않았다.
- 화면: .local-data/qa/white-castle-choice.png를 직접 확인(흰 주사위 눈/일꾼 비용·판매·보너스 선택). 이미지 디자인은 기존 건물/수도원 렌더러 재사용. 모바일 정밀QA와 신규 그림은 요청대로 보류.
- 변경 파일: src/game/{white-castles.ts,types.ts,practice.ts,save.ts,tile-help.ts,computer.ts,core/{effects,engine,monasteries,phases,placement,shield-effects,state}.ts}; src/server/{rooms,room-http}.ts; src/app/{game-screen.tsx,online/room-screen.tsx}; tests/{fixtures/white-castles.ts,core/{white-castles.test.ts,white-online.test.ts,run.mjs},browser/white-castles.spec.ts}; docs/{TODO.md,PROGRESS.md,rules/sources.md,rules/white-castles.md,history/progress-tile-frame-2026-10-19.md}.
- 백업 검사: 비공개 origin/main과 push 권한 확인, fetch 후 원격과 기준 HEAD 차이0/0, 대상27파일 민감정보 패턴0건·diff 공백 검사 통과. 기존 원본2개는 제외한다.
- 백업 완료: 구현 커밋 c06fef38de693b951f9a245d3157d1cc82c7428c를 비공개 origin/main에 Push하고 원격 전체 해시 일치를 확인했다. 기존 미커밋 원본2개는 그대로 남았다. 이 결과 기록은 별도 문서 체크포인트 커밋으로 백업한다.
- 다음: 흰 성은 새 게임 준비에서 선택해 사용한다. 이번 요청 범위는 완료했으며 모바일 정밀QA·새 일러스트·기존 전체 연습 공급 제한은 남아 있다. 이후 작업은 새 요청과 TODO를 기준으로 진행한다. 전체 프로젝트 완료로 취급하지 않는다.
- 이전 시각화 기록: history/progress-tile-frame-2026-10-19.md. 기존 원본27/28의 변경을 이번 기능에 포함하지 않는다.
