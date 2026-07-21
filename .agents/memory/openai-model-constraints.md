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
