# AI 서류 심사관

구직자 전용 AI 서류 심사 서비스. 이력서와 지원 회사 정보를 등록하면 AI가 서류 통과 여부를 판정하고 면접 질문을 생성합니다.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 실행 (port 8080, /api 경로)
- `pnpm --filter @workspace/job-doc-check run dev` — 프론트엔드 실행
- `pnpm run typecheck` — 전체 타입체크
- `pnpm run build` — 전체 빌드
- `pnpm --filter @workspace/api-spec run codegen` — OpenAPI → React Query hooks + Zod 스키마 재생성
- `pnpm --filter @workspace/db run push` — DB 스키마 변경 적용 (개발)

## Required Secrets

- `SESSION_SECRET` — 세션 암호화 키 (이미 설정됨)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI Integrations OpenAI 키 (자동 설정됨)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI Integrations 베이스 URL (자동 설정됨)
- `DATABASE_URL` — PostgreSQL 연결 문자열 (자동 설정됨)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui
- API: Express 5 + express-session + bcrypt
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI gpt-5.6-luna (via Replit AI Integrations)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — API 계약 (단일 소스)
- `lib/db/src/schema/` — DB 스키마 (users, companies, resumes, analyses, interviews)
- `artifacts/api-server/src/routes/` — API 라우트별 파일
- `artifacts/api-server/src/lib/openai.ts` — OpenAI 클라이언트
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth 미들웨어
- `artifacts/job-doc-check/src/` — 프론트엔드 소스

## Architecture decisions

- 세션 기반 인증 (express-session + bcrypt). 구독 관리와 자체 회원가입이 필요해 Clerk/Replit Auth 대신 선택.
- 분석(Analysis)은 POST 응답 후 비동기로 AI 처리. 상태 필드(pending → processing → completed)로 폴링.
- 인터뷰 질문은 세션 생성 시 동기적으로 생성 (5개, 즉시 반환).
- 구독 플랜은 DB가 아닌 서버 상수로 정의 (basic/premium).
- OpenAI gpt-5.6-luna 사용 (비용 효율적, 한국어 지원 충분).

## Product

- 랜딩 페이지 (/) — 서비스 소개, 요금제, CTA
- 회원가입/로그인 (/register, /login)
- 대시보드 (/dashboard) — 통계, 최근 분석/면접
- 회사 관리 (/companies) — 지원 회사 정보 등록/수정
- 이력서 관리 (/resumes) — 이력서 등록/수정
- AI 서류 심사 (/analyses, /analyses/new, /analyses/:id) — 4개 점수 카드 + 통과/부적합 판정
- 면접 연습 (/interviews, /interviews/new, /interviews/:id) — AI 질문 5개 + 답변 + 평가
- 구독 관리 (/subscription) — 요금제 업그레이드/해지

## User preferences

_작업하면서 추가_

## Gotchas

- `pnpm --filter @workspace/db run push-force` — 컬럼 충돌 시 강제 적용
- OpenAPI spec 변경 후 반드시 codegen 재실행 필요
- 분석 결과는 즉시 반환되지 않음 — /analyses/:id 폴링 또는 페이지 새로고침 필요
- session cookie는 sameSite 미설정 상태 (개발용). 프로덕션 배포 시 secure: true 설정 필요

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
