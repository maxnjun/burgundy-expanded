<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 타일·자원 에셋 공통 규격

- `src/app/tile-standard.json`과 `docs/design/tile-asset-standard.md`를 따른다. 기존 영지 좌표를 변경하지 않는다. 모든 단일 육각형 타일은 `TileArt`/`TileFrame`의 동일한 viewBox·clipPath·안쪽 테두리를 사용한다. 타입별 scale/translate·CSS polygon stroke·두 번째 외곽선을 추가하지 않는다.
- 승인된 베이지 완성형 PNG10종은 `public/assets/tiles/beige/final/manifest.json`의 buildingType으로 연결한다. 원래 테두리가 포함되어 있으므로 같은 viewBox·바깥 hex clip(inset 0)만 사용하고 SVG backdrop/rim을 추가하지 않는다. 파일 실패 시에는 기존 SVG/안쪽 프레임으로 복구한다.
- 원본 PNG는 보존한다. 새 PNG는 알파 영역과 내부 테두리/일러스트를 확인하여 별도 파생 에셋으로 등록한다. 원본 해시가 바뀌면 기존 수동 측정 마스크를 그대로 적용하지 않는다. 그림을 손상시키는 자동 테두리 제거는 금지한다.
- 은화/일꾼은 `public/assets/icons/silver-coin.png`, `worker.png`만 `ResourceIcon`/`ResourceGlyph`로 재사용한다. 승인 원본은 `public/assets/icons/source/resource-icons-approved.png`다. AI로 다시 그리지 않는다. 새 효과 그림도 배경/일러스트와 별도 레이어로 합성하며 숫자·화살표·아이콘 위치는 공통 effect 설정을 사용한다. 기존 합성 PNG의 자원 그림을 안전하게 분리할 수 없다면 임의로 지우거나 덮지 말고 미적용 범위를 보고한다.
- 변경 시 `scripts/validate-tile-assets.py`, 타일 관련 브라우저 테스트와 100/160/200% 실제 스크린샷을 확인한다. 안티앨리어싱 오차와 실제 틈/중복 테두리를 구분한다. 상품 사각 타일·방패 외곽·포도 이중 타일에 단일 육각형 규격을 강제로 적용하지 않는다.

## GitHub 자동 백업 규칙

사용자가 요청한 개발 작업을 완료할 때마다 아래 절차를 적용한다. 이 규칙은 Codex가 작업을 수행하는 동안 적용되는 완료 절차이며, 별도의 상시 실행 프로세스나 예약 작업을 의미하지 않는다.

1. 작업 시작 시 `git status`, 작업 트리와 스테이징 영역의 변경을 확인해 기존 변경 사항을 구분한다. 완료 시 다시 확인하고 이번 작업에서 직접 변경한 내용만 백업 대상으로 선정한다.
2. 커밋 전에 대상 파일과 실제 diff를 검사한다. `.gitignore`를 준수하고 `.env`, `.env.*`, API 키, 비밀번호, 토큰, 인증 정보, 개인 비밀키 및 기타 민감 정보는 절대 커밋하지 않는다. `.env.example`은 실제 비밀 값이 없는 예시만 허용한다. 이미 추적 중인 파일도 검사하며, 비밀 값은 로그나 완료 보고에 출력하지 않는다. 제외된 `reference/`, `node_modules/`, `.next/`, 로그와 빌드 산출물도 추가하지 않는다.
3. `git add .`, `git add -A`처럼 전체 변경을 일괄 추가하지 않는다. 이번 작업의 안전한 파일 또는 변경 구간만 명시적으로 스테이징한다. 같은 파일에 다른 작업의 변경이 섞였으면 구간을 분리한다. 안전하게 분리할 수 없으면 해당 내용을 커밋하지 않고 사유를 보고한다.
4. 기존에 스테이징된 다른 변경을 이번 커밋에 포함하거나 스테이징에서 해제하지 않는다. 커밋 직전에 실제 커밋 범위를 다시 확인하고, 이번 작업만 포함한 커밋을 만든다. 커밋 메시지는 수행한 작업을 간단하고 구체적으로 기록한다. 이번 작업의 변경이 없으면 빈 커밋을 만들지 않는다.
5. 필요한 검사를 통과한 뒤, 연결된 GitHub 저장소가 의도한 비공개 저장소인지 확인한다. 현재 연결 대상은 `https://github.com/maxnjun/burgundy-expanded.git`의 `origin`, 대상 브랜치는 `main`이다. 연결 대상·비공개 상태·브랜치를 확인할 수 없으면 임의로 다른 저장소를 만들거나 공개 저장소에 업로드하지 말고 사유를 보고한다.
6. 이번 작업의 커밋을 비공개 저장소의 `main`에 일반 Push한다. 다른 브랜치에 있다면 다른 작업을 손상시키지 않고 `main`에 반영할 수 있는지 먼저 확인한다. 관계없는 로컬 미업로드 커밋도 함께 올라가지 않는지 확인한다. 안전한 반영이 불가능하면 중단하고 상태를 보고한다.
7. 다른 작업의 변경이나 Git 기록을 덮어쓰거나 삭제하지 않는다. 강제 Push, 기록 초기화, `reset --hard`, `clean`, 임의 변경 폐기·stash, 충돌을 숨기는 자동 덮어쓰기를 사용하지 않는다. 원격 선행 커밋이나 충돌이 있으면 강제로 해결하지 않는다.
8. Push에 실패하면 작업 파일과 생성한 로컬 커밋을 보존하고 실패 이유 및 미업로드 상태를 보고한다. 인증 정보나 비밀 값을 실패 메시지에 노출하지 않는다. 실패한 백업을 성공했다고 보고하지 않는다.
9. Push 성공 후 원격 `main`이 이번 커밋을 가리키는지 확인하고 작업 완료를 보고한다. 보고에는 작업 내용, 검사 결과와 백업 성공 여부를 포함한다. Git 연결·권한·네트워크 문제로 백업이 불가능하면 개발 결과와 백업 실패를 구분해 보고한다.

사용자가 특정 작업에서 커밋·Push를 금지하거나 이 규칙과 다른 명시적 지시를 내리면 그 작업에서는 해당 지시를 우선한다. 기존 Next.js 지침은 계속 유지한다.

## 지속 개발 및 세션 인계

- 시작 시 `docs/TODO.md`, `docs/PROGRESS.md`, 현재 Git 변경을 읽는다. 전체 Phase 1~8 목표는 유지하며 한 항목/단계의 완료를 전체 프로젝트 완료로 보고하지 않는다.
- 전체 목표와 미해결 버그를 `docs/TODO.md`의 세부 체크리스트로 관리한다. 기능 구현과 해당 검증을 모두 마친 항목만 체크한다. 기존 통과 기록과 이번 실행 결과를 구분한다.
- 항목 완료 후 테스트하고 체크리스트를 갱신한 다음, 사용자가 명시적으로 중단하지 않는 한 현재 세션에서 실행 가능한 다음 작업을 순서대로 계속 진행한다. 단계마다 진행 승인을 다시 요구하지 않는다.
- `docs/PROGRESS.md`에 현재 진행, 변경 파일, 미완료 항목, 발견 오류, 검사 명령/결과, 다음 구체 작업과 재개 방법을 기록한다. 장시간 작업 중에도 갱신하여 세션 종료에 대비한다.
- 실행 시간·사용량·권한 제한을 우회하지 않는다. 제한에 도달하면 변경과 재개 상태를 안전하게 보존하고 실제 검증 범위 및 미완료 사항을 보고한다. 무기한 백그라운드 작업을 약속하지 않는다.
- 파괴적 변경·외부 결제·민감 정보 제공·접근 권한 변경은 사전 승인이 필요하다. 기존 GitHub 백업 및 비밀정보 제외 규칙을 계속 적용한다.

## 작업 효율 및 현재 우선순위

- 최신 PROGRESS와 관련 파일만 탐색하며 이미 검증된 기능은 재작성하지 않는다. 한 번에 하나의 기능을 구현·검증·백업한다.
- 최우선은 방패 AI 대전, 다음은 온라인2인 방패 지원이다. 온라인3~4인·공식 솔로·2대2의 신규 개발은 후순위로 보류하고 기존 코드/테스트/문서/저장은 유지한다.
- 개발 중에는 직접 관련 검사만 실행하고, 기능 완성 후 전체 회귀를 한 번 수행한다. 실패 수정 시 필요한 범위만 재검사하며 성공 로그는 요약만 읽는다.
- 전체 파일 출력·반복 브라우저·불필요한 스크린샷을 피한다. 복잡한 규칙/서버 변경의 정확성과 검증은 유지한다.
- PROGRESS는 간결한 최신 체크포인트로 유지하고 상세 과거 기록은 별도 문서에 보존한다. 종료 보고는 완료/검사/남은 작업/백업을10줄 이내로 작성한다.
