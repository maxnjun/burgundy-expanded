# 페이즈별 버려진 타일 기록

`GameState.discardedTiles?: PhaseDiscardedTiles[]`는 `{phase, tileIds, vineyardTileIds}` 참조만 저장한다. 타일 정의/번호/건물/동물 정보를 기존 `tiles`에서 읽고 포도 타일은 기존 `VINE_TILES`로 그린다. 물리적 타일 위치나 이미지 파일을 복제하지 않는다.

성공한 `advancePhase`의 직전/직후 `market.removedTileIds` 및 `vineyards.removed` 차이만 기록한다. 단계 종료의 방패 후속 선택이 남으면 기록하지 않는다. 새 일반/검은 공급 보충과 포도 공급대·상점 교체에 의해 실제로 제거된 타일만 포함한다. 구매·영지/저장고 보유·이전 개인 폐기·상품은 제외한다. 여관은 이월, 방패는 기존 유지/반환 규칙이므로 포함하지 않는다. **E 단계는 기존 코드가 공급처 제거 없이 최종 정산만 하므로 E 기록은 0개다.** 이 기능 때문에 기존 폐기 규칙을 바꾸지 않는다.

A~E 레코드는 순서대로 최대5개, 미래/중복 단계와 중복/미등록/아직 폐기되지 않은 ID는 검증에서 거부한다. 기존 `0.2.1` 게임 및 `burgundy-local-v1` 저장 형식은 유지한다. 선택형 필드가 없는 예전 저장은 그대로 불러오며, 개인 폐기와 섞인 과거 제거 목록으로 페이즈를 추측하지 않는다. 이후 끝나는 페이즈부터 기록한다. 새 게임은 빈 배열로 시작한다.

로컬과 온라인 행동 기록 바로 아래에서 같은 `DiscardedTiles` 패널을 사용한다. 기본접힘, 총개수/완료페이즈별 개수, 실제 `TileArt`/연결형 `VineTile`,48px 일반타일/84px 포도타일, 자동줄바꿈/최대320px 내부스크롤, 구매/드래그 없음. 온라인 행동기록은 기존 내용과 기본표시를 유지한 펼침 `details`로 감싸 두 패널을 독립적으로 접을 수 있다. 기존 디자인1의 공통 패널 스타일을 그대로 사용한다.

서버의 전체 게임 저장·원자적 CAS·고유 요청 ID·재접속 경로를 재사용한다. `RoomView`에는 폐기 기록과 그 기록에 필요한 공개 타일 정의만 추가하며 비공개 공급 풀/포도 주머니는 계속 숨긴다. 기록은 상태 스냅샷의 일부라 일반 턴 Undo 시 그대로 복원된다. 기존 Undo는 턴 경계를 넘지 못하므로 페이즈 종료 자체를 되돌리는 새 권한은 추가하지 않는다.

## 변경 파일

- 게임: `src/game/types.ts`, `discarded-tiles.ts`, `practice.ts`, `core/phases.ts`, `core/state.ts`.
- 서버: `src/server/rooms.ts`.
- UI: `src/app/discarded-tiles.tsx`, `game-screen.tsx`, `online/room-screen.tsx`, `game-screen.css`.
- 검사: `tests/fixtures/discarded-tiles.ts`, `tests/core/discarded-tiles.test.ts`, `upstash-rooms.test.ts`, `run.mjs`, `tests/browser/discarded-tiles.spec.ts`, `.github/workflows/ci.yml`.
- 문서: 이 문서와 `docs/PROGRESS.md`/`docs/TODO.md`의 이번 작업 접두사만. 기존 미커밋 본문과 원본 에셋은 보존한다.

검사 결과와 실제 PC/모바일 캡처는 `docs/PROGRESS.md`의 최신 체크포인트 및 `.local-data/discarded-tiles/`에 기록한다. Redis 검사는 외부 계약 테스트 더블을 사용하며 운영 데이터에 접속하지 않는다. Render 배포는 수행하지 않는다.
