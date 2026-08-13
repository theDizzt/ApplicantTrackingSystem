---
name: OpenAI gpt-5.6-luna 파라미터 제약
description: gpt-5.6-luna 모델에서 지원되지 않는 API 파라미터 목록과 대체 방법
---

## 지원되지 않는 파라미터

| 파라미터 | 에러 | 대체 방법 |
|---|---|---|
| `max_tokens` | 400 Unsupported parameter | `max_completion_tokens` 사용 |
| `temperature` (1 이외) | 400 Unsupported value | 파라미터 자체를 제거 (기본값 1 사용) |

**Why:** gpt-5.6-luna는 신형 추론 모델 계열로, 일부 레거시 파라미터와 비-기본 temperature를 지원하지 않는다.

**How to apply:** 이 프로젝트의 모든 `openai.chat.completions.create()` 호출에서 `temperature`와 `max_tokens`를 사용하지 말 것. `max_completion_tokens`만 사용할 것.

## 추론 토큰과 max_completion_tokens
gpt-5.6-luna 같은 추론 모델은 내부 추론에 completion 토큰을 소모하므로 `max_completion_tokens`가 작으면(예: 800~2000) JSON 응답이 잘리거나 비어서 파싱 실패가 남. **How to apply:** JSON 구조 응답을 기대하는 호출은 최소 4000, 큰 구조는 16000 정도로 넉넉히 잡을 것.
