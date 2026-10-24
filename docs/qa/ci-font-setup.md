# CI 한글 글꼴 단계 점검 (2026-10-25)

- 완료 로그 기준으로200fe13의 Noto CJK 설치는 UTC16:53:13.324~16:53:16.654, 약3.3초였다. 61.2MB 다운로드 자체는1초다. 앞선149eb25에서도 약3.8초였다. 반복적인 실제 설치 정체는 확인되지 않았다. 상태 API가 설치/실행 중으로 남은 결과를 완료 로그와 대조하지 않고 정체로 판단한 이전 보고를 정정한다.
- 200fe13의 전체CI40113380264는 성공했다. 코어486·보드33·배포/저장7, PC173통과/모바일전용3제외, Chrome40통과/PC전용2제외, WebKit35통과, 린트·타입·프로덕션 및 버전 지정 빌드가 통과했다. 실제 오래 걸린 단계는 PC19.4분, Chrome4.0분, WebKit5.5분이다.
- 앱은 Arial/Malgun Gothic/sans-serif를 사용한다. Linux의 한글 스크린샷을 기존과 같은 글꼴 메트릭으로 재현하도록 Noto CJK는 유지한다. Playwright의 기본 글꼴로 무조건 대체하거나 한글 검사를 생략하지 않는다.
- CI만 보완했다. 브라우저/시스템 의존성 설치는10분, 한글 글꼴 준비는5분으로 제한한다. APT는 비대화형·다운로드 실패 재시도2회·HTTP/HTTPS 대기30초·패키지 잠금 대기60초를 사용한다. 설치 후 `fc-list ':lang=ko'`가 비어 있으면 실패한다. `fc-match`도 로그에 남긴다.
- PC/Chrome/WebKit 단계를 명명하여 설치 단계와 구분한다. 기존 테스트 명령/대상/기준과 전역60분 제한은 유지한다. 실패 무시·테스트 삭제·게임 코드·이미지 변경은 없다.
- 새 커밋은 `[skip render] [no-deploy]`로 자동 배포를 보류하고 전체 CI를 다시 실행한다. 성공 후 기존 Render 서비스의 최신 SHA/health/온라인 재접속을 확인한다. 기존200fe13과 Redis 방 데이터는 보존한다.

근거: [완료된 CI](https://github.com/maxnjun/burgundy-expanded/actions/runs/40113380264), [Playwright 공식 CI 지침](https://playwright.dev/docs/ci), [Ubuntu APT 설정](https://manpages.ubuntu.com/manpages/noble/man5/apt.conf.5.html), [APT 잠금 대기 구현](https://github.com/Debian/apt/blob/main/apt-pkg/deb/debsystem.cc), [Render 자동 배포 생략](https://render.com/docs/deploys#skipping-an-auto-deploy). 설치된 Playwright1.64.1의 `lib/coreBundle.js`도 시스템 글꼴 의존성을 대조했다.
