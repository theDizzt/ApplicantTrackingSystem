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

---

## User Preferences

- 앱 이름: **My ATS** (내부명: AI 서류 심사관)
- 언어: 한국어 (UI 및 커뮤니케이션)
- AI 모델: `gpt-5.6-luna` — `temperature` 파라미터 사용 불가, `max_completion_tokens`만 사용
- API 클라이언트(`lib/api-client-react/src/generated/`)는 orval 자동생성이 아니라 **수동으로 유지**
- 코드 스타일: TypeScript strict, 함수형 컴포넌트, Tailwind CSS
