---
name: 실제 Ollama 스모크 테스트 방법
description: Replit 워크스페이스에서 진짜 Ollama 바이너리로 로컬 AI 관리 흐름을 검증하는 방법
---

Replit 워크스페이스에서 진짜 Ollama를 띄워 스모크 테스트할 수 있다 (docker 불필요):
- GitHub 릴리스 자산은 `.tar.zst` (`.tgz`는 404) → `nix shell nixpkgs#zstd -c tar --zstd -xf ...`로 해제, `/tmp`에 두고 `OLLAMA_MODELS=/tmp/... OLLAMA_HOST=127.0.0.1:11434 ./bin/ollama serve`.
- **함정:** ShellExec 세션이 끝나면 백그라운드 프로세스가 죽는다(nohup/setsid로도 안 살아남음). 서버 기동 + 전체 테스트 시나리오를 **하나의 긴 ShellExec** 안에서 실행할 것.
- 진짜 mid-pull 취소를 보려면 작은 모델(smollm2:135m, 270MB)은 수 초 만에 끝나므로 ~1GB 모델(qwen2.5:1.5b)을 쓰고 8초쯤 후 취소.
- 테스트 후 원복: settings 테이블의 ai_base_url/ai_model 행 삭제(환경변수 기본값으로 폴백), dev env의 임시 ADMIN_PASSWORD_HASH 삭제 + 워크플로 재시작.

**Why:** 가짜 Ollama로는 pull 스트리밍 진행률·partial blob 정리·실제 /api/tags 포맷을 검증할 수 없음.
