# CSS 빌드 오류 조사

2026-10-17, Windows / Next.js 16.4.2. 외부 서비스나 패키지 설치 없이 수정했다.

## 재현과 분리

기존 next.config.ts는 모든 *.css에 @tailwindcss/turbopack JavaScript loader를 적용했고 globals.css는 @import "tailwindcss"를 사용했다. 이때 next build의 CSS webpack-loader 평가용 자식 프로세스가 연결 전 종료했다. 메시지는 `creating new process / node process exited before we could connect to it with exit code: 0`이었다.

동일 오류가 샌드박스 안, 승인된 샌드박스 밖, 시스템 Node v24.22.0을 PATH 앞에 둔 실행에서 반복됐다. 따라서 샌드박스 권한만이 원인이라는 가설은 맞지 않는다. Tailwind 내부 자식 프로세스가 왜 종료되는지까지 확정한 것은 아니며, 저수준 Turbopack IPC 결함의 정확한 원인이라고 주장하지 않는다.

별도로 Webpack을 샌드박스 안에서 실행했을 때 .next/server/app/_global-error 생성에 EPERM이 발생했다. 이 파일 접근 오류와 CSS loader 연결 오류는 구분한다. 승인된 샌드박스 밖에서는 해결된 설정의 Webpack 빌드가 통과했다.

## 수정과 결과

이 UI는 자체 CSS 클래스들을 사용하며 w-full도 자체 정의돼 있다. Tailwind utility 생성이 필요하지 않아 전체 컴파일 import를 정적 `tailwindcss/preflight.css` import로 바꿨다. 기존 CSS의 색상·레이아웃·SVG 관련 선언은 유지하고 next.config.ts의 custom CSS loader rule만 제거했다. 기본 스타일 초기화는 계속 적용된다. 기존 의존성은 제거하지 않았다.

설정 변경 직후 기존 화면 소스로 Turbopack 전체 빌드가 성공했다. 이후 실제 UI·엔진 코드를 추가한 최종 소스에서도 Turbopack과 Webpack 빌드가 모두 성공했다. 즉 실패 경로를 유발하는 불필요한 JS loader 의존성을 제거해 이 프로젝트의 빌드 오류를 해결했다. 일반적인 Tailwind CSS 또는 모든 Turbopack 환경이 잘못됐다는 결론은 아니다.

새 UI 연결 도중 page.tsx에 허용되지 않는 LegacyHome export를 둔 별도 타입 오류도 발견했다. 기존 데모는 legacy-demo.tsx에 보존하고 page.tsx는 default만 export하도록 고쳤다. 이 문제는 원래 CSS 실패의 원인이 아니다.

## 재검증 명령

```text
npm run build
npm run build -- --webpack
```

두 명령 모두 컴파일·TypeScript·정적 페이지 생성과 종료 코드 0을 확인했다. 빌드 산출물에 대한 샌드박스 EPERM이 나타나면 같은 소스로 승인된 실행 환경에서 확인한다. 폴더를 무작정 삭제하거나 UI 코드를 바꾸는 해결법은 사용하지 않았다.
