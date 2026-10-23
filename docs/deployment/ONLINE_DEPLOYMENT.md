# 무료 온라인 테스트 배포 운영안

2026-10-23. 현재 계획은 **Render Free Web Service + Upstash Redis Free**, 테스트 서비스1개·유료 리소스0개다. 이전 유료 디스크 계획은 대체되었다. 기존 온라인2인·WSS·초대·재접속·모바일을 유지하며 외부 저장 실패 시 파일로 우회하지 않는다.

비용0원 조건, 무료 한도, 저장 방식/미검증 범위, 대안, Render·Upstash·GitHub의 단계별 설정과 롤백은 [무료 배포 안내](FREE_RENDER.md)를 따른다. 실제 계정 연결·배포는 아직 실행하지 않았으며 사용자 확인 후 무료 리소스만 연결한다. 정식 환경은 비활성이다.

---
아래는 이전 **유료 디스크 계획의 로컬 검증 기록**이다. 무료 서버의 실제 운영 검증이나 Redis 백업으로 해석하지 않는다.

## 이번 실제 검증

| 검사 | 실제 결과 | 로그(.local-data/internet-release/) |
|---|---|---|
| 전체 코어 | 455/455 통과. 로컬/AI2~4인·확장·서버 권한·중복·구저장 포함 | 29-core-final.log |
| 전체 보드 | 33/33 통과 | 06-boards-full.log |
| 전체 PC 브라우저 | 145건 중142통과, 터치 전용3건 기존 조건으로 제외 | 13-production-full-pc.log |
| 최종 관련 PC/Chrome 터치/WebKit | 9/9 통과. 직접 공급 타일 획득·양쪽 상태·오프라인/브라우저 복귀 모사·버전 안내·전송 유실·인증 응답 없는 WS 포함 | 29-browser-final.log |
| 기존 모바일 설명/조작 | 5통과, PC 전용2제외. 선택 주사위/필수 효과 우선·스크롤/다중터치·도감 보존 | 29-help-final.log |
| 프로덕션 서버/배포 보호 | 3/3 통과. 실제 HTTP+WS 권한·동시 입력·2회 재시작·정확한 빈 경로 복원, 잘못된 Origin/버전/토큰, CI 실패·staging 불일치 차단·가짜 훅 rollback | 29-deployment-final.log |
| 타입·린트·프로덕션 빌드 | 모두 exit0 | 27-{types,lint,build}.log |
| 기존 이미지 규격 | 일러스트6/아이콘2 검증, 경고0. 원본PNG27/28·사용자 문서 시작 SHA 불변 | 10-assets.log/prepare-backup.py |
| 배포용 이미지 | 승인된 배포 PNG62개의 해시·규격·RGBA·알파 경계 통과. 원본 제작 검사는 별도 유지 | 31-deploy-assets.log |
| YAML/런타임 의존성 | Render/워크플로 구문 통과, 공식 Actions v7 태그 존재 확인, 프로덕션 의존성 취약점0 | 29-yaml.log/production-audit.json |

초기 개발 HMR이 검사 중 페이지를 다시 여는 문제는 프로덕션 테스트 모드로 분리했다. 테스트가 관리하던 공유 서버 종료 문제도 상시 서버와 분리했다. 인증 전 OPEN 소켓을 연결 완료로 보던 판단을 고쳐 폴링 지연을 없앴고, WS 실패 중 HTTP가 정상인 경우 행동 버튼을 잠그지 않는다. 필수 보상 첫 전송 실패 후에도 최신 공개 뷰로 재개해 정확히 한 번만 지급한다. 영지 내부의 pan-y/overscroll contain은 모바일 가로 포도밭 탐색을 막았으므로 두 축 터치와 행 내부 스크롤 연결을 허용했다. Chrome 실제 CDP 터치로 가로 이동, revision 불변, 팝업 미발생을 검사했다. 실패 로그19/23/25/26은 보존했으며 테스트 삭제나 결과 기준 완화는 하지 않았다.

직접 확인한 캡처(같은 폴더, 게임 자료는 GitHub에 올리지 않음):

- `mobile-390-mobile-board-portrait.png`: 세로 공용 공급처/상품/타일.
- `mobile-390-mobile-estate.png`: 개인 영지·실물 보관함·자원.
- `mobile-390-vineyard-swiped.png`: 실제 손가락 가로 이동 후 포도밭 접근.
- `iphone-webkit-mobile-board-portrait.png`, `iphone-webkit-mobile-estate.png`: Safari 엔진 세로 화면.
- `desktop-1280-online-pair.png`, 각 프로젝트 `*-update-required.png`: PC 상태 및 업데이트 안내.

2026-10-22 방 생성 오류를 수정하고 localhost3000 개발 서버에서 실제 생성→코드 발급→PC/모바일 두 번째 참가→준비/시작→동일 좌석 새로고침·동기화를 확인했다. 수정 전 50방(진행49/미사용 대기1/종료0)은 1,579,112bytes, 디스크 여유는 약114GB였으므로 오류는 공간 부족이 아닌 고정 개수 제한 때문이었다. 원래50방 모두 SHA256 동일(대기1방은 무손실 압축 상태 포함)로 확인했다. 검증 자료는 `.local-data/room-capacity/`, 자동 검사는 격리 경로를 사용한다. 생성의 명확한 거절은 재시도 배너/해당 대기 키를 정리하고, 응답 유실 등 성공 여부가 불명확하면 같은 인증 정보로 멱등 재접속한다. 실제 외부 배포/실기기는 별도 검증 대상이다.

## 변경 파일

- 서버: `src/server/{rooms,room-http,room-limit,room-events,release}.ts`, `src/game/release.ts`, `src/app/api/{health,version}/route.ts`.
- 화면: `src/app/online/{room-screen.tsx,room-connection.ts}`, `board-viewport.tsx`, `game-screen.css`, `layout.tsx`, `game-version.tsx`, `updates/page.tsx`.
- 실행/운영: `scripts/{server,room-websockets,room-backups,deploy-render}.mjs`, `package.json`, `package-lock.json`, `.node-version`, `.env.example`, `render.yaml`, `.github/workflows/{ci,release}.yml`, `playwright.config.ts`. 새 런타임 의존성은 ws 하나다.
- 배포 검증: `scripts/validate-deployment-assets.py`는 실제 배포 PNG62개를 검사한다. 기존 `validate-tile-assets.py`는 변경하지 않았다. 후자는 버전 관리에서 의도적으로 제외된 검토용 원본27/28도 요구하므로 제작 작업에서 그대로 사용한다. 원본·이미지를 재생성하거나 GitHub에 추가하지 않았다.
- 검증: `tests/core/internet-online.test.ts`, `run.mjs`, `tests/deployment/{backups,release,server}.test.mjs`, `tests/browser/internet-online.spec.ts`, `starting-castles.ts`. 기존 온라인 spec의 준비/시작 단계를 연결하고 fixture revision을 단조 증가시키며, 기존 fixed-vine-reward 검사는 전송 유실/응답 없는 WS까지 강화했다.
- 문서: 이 운영안, `docs/CHANGELOG.md`, `docs/TODO.md`, `docs/PROGRESS.md`의 이번 작업 접두 구간만 백업한다. 기존 문서 수정 꼬리/원본 PNG/ZIP/다른 asset-inbox는 포함하지 않는다.

## GitHub 백업·원격 CI와 남은 항목

코드46경로는 `bd45e3e218eed988b7641af0693f4259c7b319f0`로 main 일반Push 후 원격 SHA 일치를 확인했다. 최초 [실제 CI](https://github.com/maxnjun/burgundy-expanded/actions/runs/39652071835)는 기존 원본27/28의 저장소 버전과 로컬 검토용 해시 차이를 발견해 이미지 단계에서 중단했다. [배포 workflow](https://github.com/maxnjun/burgundy-expanded/actions/runs/39652204344)는 정상적으로 skip되어 정식 배포가 실행되지 않았다. 기존 원본 제작 검사와 기존 브라우저 검사 기준을 유지하고, CI에는 버전 관리된 승인 배포 이미지62개 검사를 연결했다. 이 보완 커밋의 CI 결과를 계속 확인한다.

전체 npm audit에는 기존 개발 도구 `eslint-config-next → fast-glob → micromatch → braces`의 동일 [braces 권고](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)가 전이되어 고위험 패키지5개로 보고된다. 현재 패치 버전이 없고 npm은 Next14 계열로의 큰 변경을 제안하므로 강제 downgrade/fix는 하지 않았다. 프로덕션 의존성 audit0과 구분한다. 별도 개발 의존성 유지보수가 남아 있으며, 모든 보안 문제가 없다고 주장하지 않는다.

미실행: 실제 Android/iPhone/macOS 기기, 서로 다른 인터넷망, 실제 Render 유료 환경, 환경 승인·실제 배포·실제 서비스 롤백·외부 백업. 로컬 에뮬레이터/가짜 배포 훅 검증과 구분한다. 온라인 Undo는 기존 보안 제한대로 미지원이다.
