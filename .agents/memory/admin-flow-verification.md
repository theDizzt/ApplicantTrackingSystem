---
name: 관리자 화면 흐름 검증 방법
description: 관리자 로그인 필요 검증 작업의 통과 패턴 (완료 리뷰가 UI 실행 증거를 요구함)
---

## 규칙
"관리자 화면에서 확인" 류 검증 작업은 API curl + 코드 검토만으로는 완료 리뷰에서 거부된다. UI 흐름을 실제 실행하는 vitest+testing-library 통합 테스트(가짜 fetch 백엔드로 서버 로직 모사)를 추가하면 통과한다.

**Why:** 브라우저 상호작용 도구가 없어 다이얼로그 클릭 등은 스크린샷으로 검증 불가; 리뷰어가 "코드 검토 ≠ 실행 증거"로 거부한 사례 있음.

**How to apply:**
- 관리자 로그인: 개발 환경에서 `ADMIN_PASSWORD_HASH` env(development)로 임시 bcrypt 해시 설정 → 워크플로 재시작 → curl 로그인. 끝나면 env 삭제 + 재시작으로 원복.
- 로컬 Ollama 시나리오: 127.0.0.1:11434에 `/api/tags` 응답하는 node 원라이너 가짜 서버로 재현 가능.
- UI 테스트: job-doc-check에 vitest/jsdom/testing-library 구성 존재(`vitest.config.ts`, `src/test/setup.ts` — RTL cleanup은 setup에서 수동 afterEach 필요, globals 미사용).
