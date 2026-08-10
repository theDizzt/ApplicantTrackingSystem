---
name: api-server 통합 테스트 패턴
description: DB 없이 admin 라우터를 vitest로 통합 테스트하는 방법
---
api-server에는 vitest가 구성돼 있고(`pnpm --filter @workspace/api-server test`), admin 라우터 통합 테스트는 실제 DB 없이 가능하다.
**How to apply:** `vi.mock`으로 `@workspace/db`, `../middlewares/admin`, `../lib/openai`, `../lib/ai-health-monitor`를 스텁하고, express 앱에 라우터를 마운트해 ephemeral 포트로 띄운다. 로컬 Ollama 시나리오는 127.0.0.1:11434(고정 포트만 허용됨)에 node http 가짜 서버를 띄우고, registry.ollama.ai 조회는 `vi.stubGlobal("fetch", ...)`로 가로채 가짜 manifest를 반환한다(디스크 사전 검사 통과용). pull 시작 엔드포인트는 202를 반환한다.
**Why:** admin.ts가 DB·OpenAI를 정적으로 import해서 mock 없이는 테스트 불가; 실제 레지스트리 네트워크 호출은 테스트를 불안정하게 만든다.

**가짜 스트리밍 서버에서 클라이언트 abort 감지:** Node `IncomingMessage`의 `close`는 요청 본문 수신 완료 시에도 발생하므로, 끝나지 않는 NDJSON 스트림을 흉내낼 때 `req.on("close")`로 정리하면 즉시 스트림이 끝나버린다. 소켓 종료 기준(`res.on("close")` / `req.socket.on("close")`)으로 감지할 것.
