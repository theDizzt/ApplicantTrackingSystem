# My ATS — 프로젝트 개요

**My ATS**는 한국 구직자를 위한 AI 서류 심사 SaaS입니다.  
이력서와 지원 회사를 등록하면 AI가 서류를 심사하고 면접 준비를 도와줍니다.

---

## 빠른 참고

- **시스템 설명서**: `docs/SYSTEM.md`
- **아키텍처 정의서**: `docs/ARCHITECTURE.md`

## 프로젝트 구조

```
artifacts/api-server/     # Express 5 REST API 백엔드
artifacts/job-doc-check/  # React + Vite SPA 프론트엔드
lib/db/                   # Drizzle ORM 스키마 + PostgreSQL 클라이언트
lib/api-client-react/     # 프론트엔드용 API 훅 (수동 관리)
docs/                     # 시스템·아키텍처 문서
```

## 개발 시작

워크플로가 자동으로 두 서버를 실행합니다:
- **API 서버**: `pnpm --filter @workspace/api-server run dev`
- **프론트엔드**: `pnpm --filter @workspace/job-doc-check run dev`

DB 마이그레이션:
```bash
cd lib/db && pnpm run push
```

DB 스키마 변경 규칙 (2026-11-25):
- `lib/db/src/schema/`를 바꾸면 **같은 변경을 `lib/db/migrations/NNNN_설명.sql`로도 추가**합니다. `push`만 하고 끝내지 않습니다.
  - 이유: API 서버는 시작할 때(`dev`·`start`) `pnpm --filter @workspace/db run migrate`로 이 폴더의 SQL만 파일명 순서대로 적용합니다. `push`를 다시 하지 않은 DB(다른 PC, Replit, Docker)에는 스키마 변경이 반영되지 않아 "column does not exist"로 실패합니다 (예: 면접 열 5개 누락 → `0003_interview_columns.sql`).
- SQL은 재실행해도 안전하게 씁니다: `ALTER TABLE IF EXISTS … ADD COLUMN IF NOT EXISTS …`, `CREATE TABLE IF NOT EXISTS …`, `CREATE INDEX IF NOT EXISTS …`.
- 기본값·NOT NULL은 스키마와 똑같이 맞춥니다. NOT NULL 열을 추가할 때는 기존 행을 위해 `DEFAULT`를 함께 줍니다.
- 열 삭제·이름 변경·타입 변경은 데이터를 잃을 수 있으므로 자동 마이그레이션에 넣지 말고, 백업 후 따로 처리합니다.
- 개발 중 `pnpm --filter @workspace/db run push`는 계속 써도 됩니다.

---

## User Preferences

- 앱 이름: **My ATS** (내부명: AI 서류 심사관)
- 언어: 한국어 (UI 및 커뮤니케이션)
- AI 모델: `gpt-5.6-luna` — `temperature` 파라미터 사용 불가, `max_completion_tokens`만 사용
- API 클라이언트(`lib/api-client-react/src/generated/`)는 orval 자동생성이 아니라 **수동으로 유지**
- 코드 스타일: TypeScript strict, 함수형 컴포넌트, Tailwind CSS
