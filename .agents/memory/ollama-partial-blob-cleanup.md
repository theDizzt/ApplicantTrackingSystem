---
name: Ollama 취소된 pull 제약
description: 취소된 Ollama 다운로드가 남긴 임시 파일에 대한 API의 한계
---
- Ollama `/api/delete`는 완성된 모델만 지운다. 취소된 pull이 남긴 partial blob은 모델 목록에 나타나지 않아 API로는 정리할 수 없고 파일시스템에서 직접 지워야 한다.
- **Why:** blob을 기록하는 주체는 CLI가 아니라 Ollama 서버라서, 파일 위치·소유권은 서비스 계정과 서비스의 `OLLAMA_MODELS` 설정이 결정한다.
- **How to apply:** 다른 프로세스가 이 파일을 정리하려면 서비스의 실제 경로와 해당 디렉터리 쓰기 권한이 전제이며, 서비스 계정의 소유권을 해치면 pull 자체가 깨진다.
