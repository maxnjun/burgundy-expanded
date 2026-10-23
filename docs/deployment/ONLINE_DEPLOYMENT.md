# 모바일 온라인·인터넷 배포 운영안

2026-10-23. 기존 Next16/React19/Node24와 서버 권위의 2인 게임을 재사용한다. 로컬·AI는 기존2~4인이다. 현재 Blueprint는 테스트 서버 1개만 정의하며 정식 서버는 생성하지 않는다. 외부 계정 연결·유료 서비스·실제 배포는 아직 실행하지 않았다. 과거 로컬 검증 결과는 이 문서 말미에 기록한다.

## 구성과 보존

브라우저 → 같은 HTTPS 주소의 Next API/실시간 WSS → 단일 Node 프로세스 → 영속 디스크의 JSON RoomStore. 별도 프런트엔드 호스트·DB 가입 없이 기존 저장 형식을 보존한다. 기존 난수/공급·모든 확장·시작 성·최종 점수는 canonical 엔진이 계산하고 공개 뷰만 전달한다. 클라이언트는 전체 저장 상태를 제출할 수 없다.

- 초대 링크는 `/online?room=방코드`이며 인증 토큰을 포함하지 않는다. 각 자리의 강한 무작위 토큰은 브라우저 저장소에, 서버에는 SHA256 해시만 저장한다. 같은 브라우저·프로필·사이트 주소로 돌아와야 한다. 시크릿 모드/저장소 삭제/다른 기기로 자리 이동은 자동 지원하지 않는다. 초대 코드로 다른 사람의 자리를 탈취할 수 없다.
- 새 방은 각자 준비 → 방장 시작. 기존 방은 로비 없이 계속 진행한다. 온라인은 2인이다. 총 저장 방 50개라는 고정 제한은 제거하고 실제 디스크 여유를 검사한다. 진행 중인 방은 오래되어도 삭제·압축하지 않는다.
- WS는 인증 후 공개 뷰를 푸시한다. 변경 액션은 기존 POST+좌석 권한+revision+프로세스별 잠금으로 검증한다. 동시/중복/오래된 액션은409, 다른 좌석403, 미인증401. 응답을 못 받은 행동은 자동 재실행하지 않고 최신 상태를 다시 읽는다. 방 생성/참가 응답 유실은 저장해 둔 동일 인증 정보로 재시도한다.
- 연결 끊김·화면 복귀·네트워크 변경 시 자동 재연결/재조회, WS 차단 시 폴링. 오프라인에서는 행동 잠금. 구 클라이언트의 프로덕션 변경 요청은426으로 차단하고 새로고침 안내. 자동 새로고침/게임 삭제는 하지 않는다.
- 개인 영지는 모바일에서 세로 정렬, 포도밭은 영지 옆의 내부 스크롤로 유지한다. 원래 보드 확대/이동·단일 터치 설명/주사위 조작 우선·상품 겹침을 재사용한다. OS 실기기와 외부망 검증은 별도다.
- 테스트 사이트는 전용 빈 `staging-rooms` 디스크에서 시작한다. localhost의 기존 방 파일은 그대로 보존되며 테스트 사이트로 자동 복사되지 않는다. 브라우저 재접속 토큰도 주소별로 분리되므로 기존 localhost 방 코드만으로 테스트 사이트의 좌석에 복귀할 수 없다. 실제 테스트 사이트에서 만든 방은 같은 주소·브라우저 저장소와 서버 디스크를 사용해 재접속한다. 정식 서비스는 추후 별도 디스크를 사용한다.

## 서비스 비교와 비용

공식 문서 확인일2026-10-23, USD/세전·트래픽·빌드 초과 비용 제외. 결제 전에 대시보드 견적을 다시 확인한다.

| 서비스 | 현재 프로젝트 적합성 | 초기 예상 |
|---|---|---|
| Render `0.5c-512mb`+1GB disk | Node/WS와 기존 JSON 영속 저장을 그대로 사용. 같은 URL HTTPS/WSS, 로그·상태 확인 | **테스트 1개 월 약$7.25**($7 컴퓨트+$0.25 디스크). 정식 서버는 지금 만들지 않음 |
| Railway Hobby+volume | 기존 Node 실행/볼륨 가능하나 배포 설정을 새로 작성해야 함 | 월 최소$5(사용 크레딧 포함), 초과 CPU/RAM/디스크 별도 |
| Vercel | WebSocket 공개 베타가 있으나 현재 로컬 영속 파일/단일 Node 구조를 그대로 배포하는 구성은 아님. 외부 저장소/서버 어댑터 전환이 더 큼 | 별도 설계·견적 필요 |

Render 무료 웹 서비스는15분 유휴 절전과 영속 디스크 부재 때문에 게임방 재시작 복구를 검증할 수 없다. 따라서 **지금은 유료 테스트 환경 1개만** 추천한다. 정식 환경은 별도 승인·디스크·URL로 나중에 만든다. 첫 달 실제 과금과 리소스 사용량은 계정에서 확인한다.

출처: [Render 요금](https://render.com/pricing), [Hobby 작업 공간](https://render.com/docs/new-workspace-plans), [Blueprint 규격](https://render.com/docs/blueprint-spec), [무료 제한](https://render.com/docs/free), [영속 디스크](https://render.com/docs/disks), [WebSocket 지원](https://render.com/docs/websocket), [Railway 요금](https://docs.railway.com/pricing/plans).

## 최초 설정 — 외부 연결·요금 승인 후

0. **현재 정지 지점:** 이 문서와 설정 파일을 GitHub에 백업할 때에는 외부 서비스나 과금이 생기지 않는다. 먼저 전체 main CI가 성공해야 한다. 계정 연결·유료 리소스 생성은 사용자의 별도 확인을 기다린다.
1. [Render](https://dashboard.render.com/)에 가입/로그인하고 **Hobby 작업 공간**을 선택한다. Render의 GitHub 연결 화면에서는 기존 `maxnjun/burgundy-expanded` 저장소 **하나만** 허용한다. 공개 URL을 직접 입력하는 연결은 자동 배포 연동에 사용하지 않는다. 비밀번호/토큰은 채팅에 보내지 않는다.
2. Render **New → Blueprint → 연결된 저장소 선택 → branch `main` → root `render.yaml`**. 미리보기에서 `burgundy-expanded-staging` 웹 서비스 **한 개**, 싱가포르 지역, `0.5c-512mb`, 1GB `staging-rooms` 디스크만 표시되는지 확인한다. 정식 서비스/DB가 표시되면 생성하지 않는다. 월 예상 기본액 **약$7.25**와 추가 사용료를 검토한 뒤 승인이 있을 때만 생성한다.
3. Blueprint **Settings → Auto Sync: No**로 설정한다. 서비스는 **Auto Deploy: Off**, 인스턴스1개, 디스크 `/var/data`, `BURGUNDY_DATA_DIR=/var/data/burgundy-staging`, `NODE_VERSION=24.22.0`, `TRUST_PROXY=1`, build/start 명령은 `render.yaml` 값인지 확인한다. 기본 `https://...onrender.com` 주소를 사용한다. Blueprint 자동 동기화를 켜면 YAML Push가 CI 배포 게이트를 우회할 수 있다.
4. 첫 생성 빌드 후 테스트 사이트 `/api/health`의 status ok·버전 전체 SHA·protocol1·roomFormat1을 확인한다. 빌드가 실패하거나 현재 GitHub CI가 실패 중이면 자동 배포를 켜지 않는다. 외부망/실기기 검증 전에는 인터넷 플레이가 검증되었다고 표시하지 않는다.
5. GitHub 저장소 **Settings → Environments → New environment → `staging`**. 이 환경의 Variables에 `SITE_URL=https://실제-테스트-주소.onrender.com`, Secrets에 Render 테스트 서비스 **Settings → Deploy Hook**의 `RENDER_DEPLOY_HOOK`을 입력한다. 훅 주소 전체는 배포 권한이므로 채팅·코드·로그에 남기지 않는다.
6. GitHub 저장소 **Settings → Secrets and variables → Actions → Variables → New repository variable**에서 `ENABLE_TEST_DEPLOYMENTS=true`를 설정한다. `ENABLE_PRODUCTION_DEPLOYMENTS`는 만들지 않거나 `false`로 둔다. CI 성공한 main Push만 `staging`으로 정확한 SHA를 배포하고 `/api/health`로 검증한다. 실패한 CI는 배포하지 않는다.

이번 단계에는 정식 Render 서비스, 정식 GitHub 환경/훅, 정식 URL을 만들지 않는다. 향후 정식 서버는 별도 디스크와 `BURGUNDY_DATA_DIR=/var/data/burgundy-production`을 사용하고 명시적 승인 뒤에만 `ENABLE_PRODUCTION_DEPLOYMENTS`를 연다. [Render Blueprint 자동 동기화](https://render.com/docs/infrastructure-as-code), [Render GitHub 연결](https://render.com/docs/git-provider), [GitHub 환경](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## 이후 업데이트

**이번 단계:** 수정 → main Push → Game CI(코어/보드/타입/린트/이미지/빌드/프로덕션 서버·WS/PC·모바일) 성공 → 성공한 **동일 SHA** 테스트 배포 → 실제 테스트 사이트 확인. 이후 Push마다 같은 URL이 갱신된다. CI 실패면 기존 테스트 버전이 유지된다. 정식 배포는 아직 비활성화했다. 향후 별도 승인 후 GitHub **Actions → Game release → Run workflow → production → SHA 전체40자리 → confirmation DEPLOY** → 환경 승인을 사용한다.

배포 스크립트는 성공한 main push CI를 GitHub API로 확인하고, staging의 정확한 SHA와 현재 데이터/통신 형식1을 검사한 뒤 Render 훅에 `ref=SHA`를 전달한다. 테스트 실패/다른 SHA/호환 형식 변경이면 정식 배포를 거부한다. [Blueprint 필드](https://render.com/docs/blueprint-spec), [특정 커밋 배포 훅](https://render.com/docs/deploy-hooks).

현재는 형식1을 유지하므로 마이그레이션이 없다. 차후 저장 형식/엔진 규칙이 바뀌면 이전 게임 fixture 복원 검증·명시적 마이그레이션 설계 없이 자동 배포하지 않는다. `/api/health`는 모든 방을 기존 저장 파서로 검증한다. 구버전 클라이언트에는 새로고침을 안내하고 쓰기를 막는다. 버전은 전체 커밋 SHA로 표시·대조하며 `/updates`에서 변경 내용을 확인한다.

## 저장·백업·롤백

- 서비스별 **단일 인스턴스**만 사용한다. JSON 잠금은 다른 프로세스와 공유되지 않는다. 수평 확장/다중 worker는 금지하며 필요해지면 DB 트랜잭션과 pub/sub 전환을 먼저 설계한다. 디스크를 붙이면 배포 시 짧은 중단이 있을 수 있으며 클라이언트가 재접속한다. 무중단이라고 약속하지 않는다.
- 매 행동은 임시 파일 fsync+원자 rename 후 응답. 이전8개 revision을 방별 private backups에 보관한다. 프로덕션 시작 시 변경 전 스냅샷+SHA256 manifest를 생성한다. 초기 데이터 검증/스냅샷 실패 시 시작을 중단한다. 부팅 스냅샷은 삭제하지 않으므로 디스크 사용량 경보/정리 운영이 필요하다. 백업에도 개인정보/인증 해시가 있어 GitHub/공개 artifact에 올리지 않는다.
- 새 방 생성 시 방별 잠금을 사용해 마지막 변경 후 24시간 이상 지난 종료 방 또는 한 자리만 있고 revision=0인 미사용 대기 방만 `archive/<id>.json.gz`로 무손실 보관한다. 임시 파일 fsync·원자 교체·압축 해제 원문 대조가 모두 성공한 뒤에만 일반 JSON 사본을 정리한다. 토큰 해시/원래 게임 상태/코드는 그대로 보존되며, 읽기·재접속은 압축 상태에서도 가능하고 참가나 행동 저장 시 일반 JSON으로 복원한다. 실패하면 원래 방을 유지한다. 진행 중인 두 자리 방/사용한 대기 방/최근 방은 대상이 아니다.
- 생성 전 디스크 여유가 8,400,000bytes(최대 방 2.1MB의 4배, 원자 쓰기·이전 상태 보관 여유) 미만이면 명확한 `ROOM_STORAGE_FULL` 오류로 거절한다. OS의 ENOSPC/EDQUOT도 저장 공간 오류로 표시하며 기존 방을 삭제하지 않는다. 실제 공간 부족은 오래된 부팅 스냅샷의 별도 비공개 보관 또는 디스크 확장을 검토해야 한다. 스냅샷 자동 삭제나 개수 한도 증가는 하지 않는다.
- 운영 확인: `node scripts/room-backups.mjs status SOURCE`는 방 총수/진행·대기·종료/압축 보관 수/원문 크기/디스크 여유만 출력한다. 이름·인증 정보·게임 원문은 출력하지 않는다. 공개 관리·삭제 API는 제공하지 않는다.
- Render의 일일 디스크 스냅샷은 최소7일 제공된다. 전체 디스크 복원은 그 이후 진행을 잃으므로 **명시적 승인 없이 사용하지 않는다**. 서비스 계정/디스크 자체 손실에 대비한 외부 비공개 백업은 가입/보관 위치 승인 후 구성할 후속 항목이다.
- 코드 롤백은 **Game release → rollback → 이전 성공 CI SHA → DEPLOY → 승인**. 데이터 볼륨은 그대로 두며 `/api/health`의 버전/형식을 다시 검사한다. 옛 버전이 현재 데이터를 읽지 못하면 롤백을 중단하고 별도 복구한다. 이번 기능 이전의, 해당 운영/헬스 계약이 없는 커밋으로는 자동 롤백하지 않는다.
- 데이터 복구는 서버를 멈춘 뒤 기존 디렉터리를 보존하고, `node scripts/room-backups.mjs restore SOURCE EMPTY_DESTINATION`으로 **비어 있는 별도 경로**에만 수행한다. 체크섬/경로/형식 검증을 통과해야 하며 기존 파일은 덮어쓰지 않는다. 이후 BURGUNDY_DATA_DIR을 복구 경로로 바꾸고 전체 엔진/상태 검증 후 개방한다. 수동 백업 명령은 `snapshot SOURCE EMPTY_DESTINATION`이다. Codex가 필요 시 수행하므로 사용자에게 명령을 맡기지 않는다.
- 스냅샷은 압축 보관 방까지 포함해 원래 JSON으로 저장한다(동일 코드의 일반 JSON이 있으면 최신 일반 사본 우선). 복원하면 기존 JSON 형식으로 돌아오므로 게임 저장 형식은 바뀌지 않는다. **압축 읽기를 지원하지 않는 이전 서버 버전으로 롤백할 때는**, 중지 상태에서 이 버전의 snapshot/restore로 별도 빈 경로에 모든 방을 풀고 데이터 경로를 전환한 뒤 검증해야 한다. 압축 방을 남긴 채 구버전 코드를 직접 실행하지 않는다.

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
