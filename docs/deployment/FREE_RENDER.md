# 월 서버 비용 0원 테스트 배포

2026-10-23. Render Free Web Service + 계정 소유 Upstash Redis Free를 사용한다. 기존 월$7.25 유료 디스크 계획을 대체한다. 외부 가입·연결·리소스 생성은 아직 실행하지 않았다. 실제 서비스의 지속 저장은 연결 후 검증해야 한다.

## 0원 조건과 무료 한도

Render **Hobby 작업 공간($0)** 안에서 Web Service의 **Free 인스턴스**를 선택한다. Hobby라는 이름만으로 서버가 무료인 것은 아니다. Render와 Upstash에 결제수단을 추가하지 않고 유료 디스크·DB·추가 옵션·자동 업그레이드를 사용하지 않는다. 이미 카드가 있는 Render 계정에서는 무료 트래픽/빌드 초과가 청구될 수 있으므로 이 설정만으로 0원을 보장하지 않는다. 카드나 유료 전환을 요구하면 중단한다. 한도에 닿으면 비용 지출 대신 사용 중단/다음 주기 초기화를 기다린다.

| 서비스 | 공식 무료 제한과 영향 |
|---|---|
| Render Free | HTTP/WS 수신 트래픽 없이15분이면 절전, 요청/새 WSS로 기동하며 약1분 지연. 언제든 재시작 가능. 절전·재시작·재배포 때 로컬 파일 유실. WSS 지원 |
| Render 사용량 | 작업 공간 전체 월750 인스턴스시간. Hobby 기본 월5GB 외부 전송·500 빌드분. 결제수단 없으면 초과 시 서비스/빌드 중단. 외부 DB 트래픽이 과도해도 정지될 수 있음 |
| Upstash Redis Free | 계정 소유 Free DB1개, 약250MB(일부 공식 표256MB)·월500K 명령·10GB 전송. 디스크 지속 저장 기본 활성. Eviction Disabled 필수. Free 유지·카드/자동 업그레이드 금지 |
| 장기 미사용 | Upstash는 최소30일 미사용 후 경고 이메일과 함께 DB를 보관할 수 있음. 콘솔에서 새 DB로 복구 후 Render의 접속 URL/토큰 갱신이 필요. 무기한 무관리/무중단은 보장하지 않음 |

확인일2026-10-23. [Render 무료 제한](https://render.com/docs/free), [요금](https://render.com/pricing), [빌드](https://render.com/docs/build-pipeline), [WSS](https://render.com/docs/websocket), [Upstash 요금](https://upstash.com/pricing/redis), [지속 저장](https://upstash.com/docs/redis/features/durability), [보관·한도 FAQ](https://upstash.com/docs/redis/help/faq), [Eviction](https://upstash.com/docs/redis/features/eviction).

## 저장 방식과 확인 수준

브라우저 → 같은 HTTPS 주소의 Next API/WSS → 단일 Node 서버 → Upstash HTTPS REST. 기존 Room JSON/게임 규칙/좌석 토큰 해시를 유지하며 외부 저장 성공 후에만 응답한다. 외부 모드에서 로컬 파일로 우회하지 않는다. 키 생성은 미존재 조건, 변경은 읽었던 revision을 비교하는 원자 Lua SET으로 확정하여 재배포 중 겹치는 프로세스의 중복 쓰기도 방지한다. TTL/자동 삭제를 설정하지 않는다. 한도·통신 오류는503, 동시 변경은409로 거절한다. 응답 유실이면 이미 저장되었을 수 있으므로 재접속 후 최신 상태를 확인하고 행동을 자동 재전송하지 않는다.

- 비밀 REST Token은 서버 환경변수에만 둔다. 공개 뷰·초대 링크·GitHub·NEXT_PUBLIC 변수에 넣지 않는다. URL에도 토큰을 붙이지 않는다.
- 테스트 키는 `burgundy:staging:room:<방코드>`. 정식 서비스는 별도 DB와 `production` 이름을 사용해야 하며 이번에는 만들지 않는다. 단일 인스턴스를 유지한다. WSS 이벤트는 프로세스 내부이므로 수평 확장을 지원한다고 주장하지 않는다.
- localhost의 기존56방/백업/압축/복원은 파일 모드에서 그대로 보존한다. 새 사이트로 자동 이전하지 않는다. 브라우저 토큰도 주소별로 분리되므로 새 사이트에서 새 방을 만든다.
- 외부 모드는 **최신 상태만** 저장한다. 기존 파일 모드의 이전8revision·부팅 스냅샷·backup CLI는 Redis 백업이 아니다. 무료 DB의 자동 백업·SLA·계정 삭제/키 삭제/공급자 장애에 대한 완전한 보호를 약속하지 않는다. 중요한 장기 게임은 별도 비공개 백업 절차를 추가 검토한다.
- 로컬 REST 모의 서버로 재시작/새 로컬 경로·권한·동시 변경·응답유실·한도 실패를 검사한다. **실제 Upstash Lua·계정, Render 절전·인터넷 배포·실기기는 미검증**이다. 계정 연결 후 통과하기 전 운영 중인 영구 저장소라고 표시하지 않는다.

## 무료 저장 대안

| 후보 | 판단 |
|---|---|
| Upstash Redis Free | REST+원자 Lua로 기존 JSON을 재사용하며 추가 패키지가 필요 없어 이번 구현의 기본값 |
| Supabase Free | DB500MB·월5GB 전송·2프로젝트·1주 저활동 후 일시정지. RLS/테이블/조건부 갱신 추가 설정 필요. 선택 가능한 무료 대안이며 중복 구현하지 않음. [요금](https://supabase.com/pricing), [일시정지](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Render Free Postgres | 30일 후 만료되므로 장기 저장으로 선택하지 않음 |
| Render 로컬 JSON/SQLite | 서버 수명에 묶여 유실되므로 무료 배포의 저장소로 사용하지 않음 |

무료 한도가 부족하면 방 생성/사용을 줄이거나 초기화를 기다린다. 저장소 변경은 데이터 보존 계획과 사용자 결정 후 진행하고, 유료 전환을 자동 실행하지 않는다.

## 초보자 설정 순서

1. [Upstash Console](https://console.upstash.com/) 가입 → **Redis → Create Database**. 이름 `burgundy-staging`, **Free**, Render와 가까운 지역(가능하면 싱가포르). **Eviction Disabled**, 자동 업그레이드 끄기. 카드·유료 옵션을 선택하지 않는다. 익명72시간 임시 DB는 사용하지 않는다.
2. DB의 **REST API / Connect**에서 **REST URL**과 읽기·쓰기용 **REST Token** 위치를 확인한다. Readonly Token은 쓰지 않는다. 비밀값은 채팅에 보내지 않고 다음 Render 비공개 환경변수 칸에 직접 입력한다.
3. [Render Dashboard](https://dashboard.render.com/) 가입 → **Hobby($0)** 작업 공간 → GitHub 연결에서 기존 `maxnjun/burgundy-expanded` 하나만 허용한다. **New → Blueprint → 저장소 → main → render.yaml**. 미리보기는 `burgundy-expanded-staging` **Free($0)** 하나, disk/DB 없음이어야 한다. 카드나 유료 플랜이 보이면 생성하지 않는다. Blueprint가 카드를 요구하면 중단하고 **New → Web Service → Free** 수동 설정을 검토한다.
4. `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`에2단계 값을 넣는다. 나머지는 YAML대로 `BURGUNDY_STORAGE=upstash`, `BURGUNDY_ROOM_NAMESPACE=staging`, `TRUST_PROXY=1`, Node24.22.0. build=`npm ci --include=dev && NEXT_PUBLIC_GAME_VERSION=$RENDER_GIT_COMMIT npm run build`, start=`npm start`. **유료 disk는 추가하지 않는다.**
5. 생성 후 서비스 **Settings → Auto Deploy: Off**, Blueprint **Settings → Auto Sync: No**. CI를 우회한 직접 배포를 막는다. 첫 배포 후 `https://실제주소.onrender.com/api/health`의 status=ok를 확인한다. 콜드 스타트면 약1분 뒤 재시도. 실패 시 환경변수/무료 한도를 확인하며 파일 저장으로 바꾸지 않는다.
6. GitHub 저장소 **Settings → Environments → New environment → staging**. 이 환경의 **Variables**에 `SITE_URL`=실제 HTTPS 주소. **Secrets**에 `RENDER_DEPLOY_HOOK`=Render 서비스 Settings → Deploy Hook 전체 주소. 훅은 배포 권한이므로 채팅·코드·로그에 노출하지 않는다.
7. GitHub **Settings → Secrets and variables → Actions → Variables**에서 `ENABLE_TEST_DEPLOYMENTS=true`. `ENABLE_PRODUCTION_DEPLOYMENTS`는 미등록 또는 false 유지. 이후 main Push → Game CI 전체 통과 → 같은 SHA 테스트 배포 → health/버전 확인으로 자동 갱신한다. URL과 Redis 키는 유지하고 CI 실패 시 이전 사이트를 유지한다.
8. 두 브라우저에서 `/online` → 이름 →2인 방 생성 → 초대 링크 → 다른 기기 참가 → 각자 준비 → 방장 시작을 확인한다. 같은 브라우저·프로필·주소로 돌아와야 같은 자리로 재접속한다. 저장소 삭제/시크릿 종료/기기 간 자리 이동은 자동 지원하지 않는다.
9. Render Restart/새 배포 후 방·revision·좌석 유지,15분 유휴 뒤 재접속, 계정 사용량을 실제 확인한다. 정상 동기화 트래픽이 있으면 절전되지 않을 수 있다. 인위적인 keep-alive를 추가하지 않는다. 버그는 `docs/BUGS.md`에 토큰/개인정보 없이 기록한다. iPhone은 WebKit 자동검사와 실기기를 구분한다.

현재 기존 서비스는 `burgundy-expanded`, 주소는 `https://burgundy-expanded.onrender.com/online`이다. 위 Blueprint는 신규 구성 예시이므로 기존 서비스를 다시 만들지 않는다. 기존 Upstash와 `staging` 네임스페이스를 유지한다.

## 기존 서비스에 수동으로 최신 main 반영

2026-10-24 터미널 점검 기준 `render.yaml`은 `autoDeployTrigger: off`다. 실제 대시보드 설정은 이번 작업에서 조작하지 않는다. GitHub의 별도 자동 배포 workflow도 `[no-deploy]` 커밋은 배포하지 않는다.

1. GitHub `main`의 **Game CI**가 초록색 `success`인지 확인한다. 실패/진행 중이면 배포를 기다린다. 최신 커밋 해시는 `git rev-parse origin/main`으로 확인할 수 있다.
2. Render 대시보드의 기존 프로젝트에서 **burgundy-expanded** 서비스를 선택한다. `New`나 Blueprint 생성은 사용하지 않는다.
3. 서비스의 **Deploys → Manual Deploy → Deploy latest commit**을 선택한다. 서비스가 연결한 저장소가 `maxnjun/burgundy-expanded`, 브랜치가 `main`인지 먼저 확인한다.
4. `Restart service`는 기존 버전을 재시작하므로 새 코드 반영 용도로 선택하지 않는다. 빌드 캐시 삭제도 이번 업데이트에는 필요하지 않다.
5. 배포가 `Live`가 되고 표시된 커밋이 원하는 main 커밋인지 확인한다. 실패하면 기존 `Live` 버전을 유지하고 실패 로그를 확인한다. 기존 환경변수·Upstash 토큰·`BURGUNDY_ROOM_NAMESPACE=staging`은 변경하지 않는다.
6. `/api/health`의 `status=ok`, `version=배포한 전체 커밋 SHA`, `protocol=1`, `roomFormat=1`을 확인한다. `/api/version`도 같은 버전이어야 하고 `/online`이 열려야 한다. 이전 SHA면 아직 업데이트 완료가 아니다.
7. 기존 방은 삭제하지 않고 같은 브라우저로 재접속한다. 별도 테스트 방에서 생성·참가·동기화를 확인한다. 데이터 초기화/Redis 키 삭제/새 DB 생성은 업데이트 절차에 포함되지 않는다.

공식 절차: [Render 배포 및 Manual Deploy 옵션](https://render.com/docs/deploys). 터미널 HTTP 응답만 확인한 상태와 실제 수동 배포 완료를 구분한다.

## 업데이트·롤백

기존 CI/release workflow를 재사용한다. 배포 전 health는 콜드 스타트의503/HTML/네트워크 오류에 제한된 재시도를 한다. 저장소가 계속 실패하면 배포도 중단한다. Render/GitHub/Upstash Usage에서 무료 한도를 확인한다. 상태 동기화 GET도 Redis 명령·전송량을 사용하므로 장시간 열린 탭과 게임 수에 따라 사용량이 늘어난다.

저장형식/통신형식1을 유지하며 구 클라이언트는426 후 새로고침 안내를 받는다. Redis 상태는 코드 배포와 분리되지만 호환되지 않는 형식 변경은 별도 마이그레이션이 필요하다. 롤백은 **외부 저장소를 지원하는 성공 CI 커밋**으로만 한다. 파일 전용 과거 커밋으로는 방을 읽지 못하므로 롤백하지 않는다. Redis 키/계정을 삭제하거나 JSON으로 덮어쓰지 않는다. 정식 환경은 아직 비활성이다.

[Blueprint 규격](https://render.com/docs/blueprint-spec), [GitHub 연결](https://render.com/docs/git-provider), [Auto Sync](https://render.com/docs/infrastructure-as-code), [배포 훅](https://render.com/docs/deploy-hooks), [REST](https://upstash.com/docs/redis/features/restapi), [원자 Lua](https://upstash.com/docs/redis/commands/scripting/eval).
