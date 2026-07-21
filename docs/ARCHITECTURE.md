# My ATS — 아키텍처 정의서

---

## 목차

1. [전체 구조](#1-전체-구조)
2. [모노레포 레이아웃](#2-모노레포-레이아웃)
3. [패키지별 역할](#3-패키지별-역할)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [API 엔드포인트](#5-api-엔드포인트)
6. [프론트엔드 라우팅](#6-프론트엔드-라우팅)
7. [AI 파이프라인](#7-ai-파이프라인)
8. [인증 및 세션](#8-인증-및-세션)
9. [환경 변수](#9-환경-변수)
10. [배포 구성](#10-배포-구성)

---

## 1. 전체 구조

```
┌──────────────────────────────────────────────────────────┐
│                     사용자 브라우저                        │
│              React SPA (job-doc-check)                    │
│  Vite · Tailwind · shadcn/ui · TanStack Query · Wouter   │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP REST (JSON)
                     │ /api/*  (쿠키 세션)
┌────────────────────▼─────────────────────────────────────┐
│              Express 5 API 서버 (api-server)               │
│  라우트: auth · resumes · companies · analyses ·           │
│          interviews · subscription · dashboard ·           │
│          spellcheck · health                               │
│  미들웨어: express-session · bcrypt · pino-http            │
│  스케줄러: node-cron (매주 월요일 09:00 KST)               │
└───────┬────────────────────────┬────────────────────────┘
        │ Drizzle ORM            │ OpenAI API
        │                        │ (Replit AI Integrations Proxy)
┌───────▼────────┐    ┌──────────▼──────────────────────────┐
│  PostgreSQL DB │    │        gpt-5.6-luna                  │
│  (Replit 내장) │    │  서류 심사 / 면접 생성 / 기업 추천   │
│                │    │  채용공고 보강 / 맞춤법 검토          │
└────────────────┘    └─────────────────────────────────────┘
```

---

## 2. 모노레포 레이아웃

```
workspace/
├── artifacts/
│   ├── api-server/          # Express REST API (포트: $PORT)
│   └── job-doc-check/       # React SPA (포트: $PORT)
├── lib/
│   ├── db/                  # Drizzle 스키마 + DB 클라이언트
│   ├── api-client-react/    # 프론트엔드용 API 훅 (수동 관리)
│   ├── api-spec/            # OpenAPI 명세 (orval 설정)
│   ├── api-zod/             # Zod 스키마
│   └── integrations/        # OpenAI 통합 유틸리티
├── docs/
│   ├── SYSTEM.md            # 시스템 설명서 (비즈니스 관점)
│   └── ARCHITECTURE.md      # 아키텍처 정의서 (기술 관점)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── replit.md
```

---

## 3. 패키지별 역할

### `artifacts/api-server`
| 파일/폴더 | 역할 |
|---|---|
| `src/index.ts` | 서버 진입점, 포트 바인딩 |
| `src/app.ts` | Express 앱 설정, 미들웨어 등록 |
| `src/scheduler.ts` | node-cron 주간 스케줄러 |
| `src/routes/` | REST 라우트 핸들러 |
| `src/lib/openai.ts` | OpenAI 클라이언트 싱글턴 |
| `src/lib/url-analyzer.ts` | GitHub API + URL 접근성 검사 |
| `src/lib/job-scrapers.ts` | 사람인 스크래퍼 + 잡코리아 URL 생성 |
| `src/lib/logger.ts` | pino 로거 |
| `src/middlewares/auth.ts` | 세션 인증 미들웨어 |
| `build.mjs` | esbuild 번들 스크립트 |

### `artifacts/job-doc-check`
| 파일/폴더 | 역할 |
|---|---|
| `src/App.tsx` | 라우터 정의, QueryClient 프로바이더 |
| `src/pages/` | 페이지 컴포넌트 |
| `src/components/ui/` | shadcn/ui 컴포넌트 라이브러리 |
| `src/components/layout/` | AppShell (사이드바·헤더) |
| `src/components/auth-guard.tsx` | 인증 보호 래퍼 |
| `src/components/rich-text-editor.tsx` | TipTap 에디터 래퍼 |
| `vite.config.ts` | Vite 설정, 프록시, 베이스 경로 |

### `lib/db`
- Drizzle ORM 스키마 정의 (`lib/db/src/schema/`)
- `drizzle.config.ts`로 마이그레이션 관리
- `@workspace/db`로 api-server에서 임포트

### `lib/api-client-react`
- `src/generated/api.ts`: TanStack Query 훅 (수동 작성·관리)
- `src/generated/api.schemas.ts`: 타입 정의
- `src/custom-fetch.ts`: 세션 쿠키 포함 fetch 래퍼

---

## 4. 데이터베이스 스키마

### ERD 개요

```
users ──────< resumes
  │
  ├──────< companies
  │
  ├──────< analyses >───── resumes
  │              └──────── companies
  │
  └──────< interviews >─── companies
               │
               └──< conversations >─── messages
```

### 테이블 정의

#### `users`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | 사용자 ID |
| email | text UNIQUE | 이메일 (로그인 ID) |
| password_hash | text | bcrypt 해시 |
| name | text | 표시 이름 |
| subscription_status | text | `free` / `basic` / `premium` |
| subscription_plan_id | text | 플랜 ID |
| subscription_expires_at | timestamptz | 구독 만료일 |
| analyses_used_this_month | integer | 이번 달 사용 횟수 |

#### `resumes`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | 이력서 ID |
| user_id | integer FK→users | 소유자 |
| title | text | 이력서 제목 |
| content | text | 이력서 본문 (HTML) |
| cover_letter | text | 자기소개서 본문 (HTML) |
| desired_salary | integer | 희망 연봉 (만원) |
| photo_url | text | 사진 URL |
| file_url | text | 첨부 파일 URL |

#### `companies`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | 회사 ID |
| user_id | integer FK→users | 소유자 |
| name | text | 회사명 |
| site_url | text | 회사 홈페이지 URL |
| job_posting_url | text | 채용공고 URL |
| talent_profile | text | 인재상 |
| job_description | text | 직무 설명·자격요건 |
| notes | text | 메모 |
| career_level | text[] | 경력 구분 (복수) |
| education_level | text | 학력 요건 |
| recruitment_field | text[] | 모집 분야 (복수) |
| is_recommended | boolean | AI 추천 여부 |
| synced_at | timestamptz | 마지막 동기화 시각 |

#### `analyses`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | 심사 ID |
| user_id | integer FK→users | 소유자 |
| resume_id | integer FK→resumes | 대상 이력서 |
| company_id | integer FK→companies | 대상 회사 |
| status | text | `pending` / `processing` / `completed` / `failed` |
| overall_score | integer | 종합 점수 (0~100) |
| ai_writing_score | integer | AI 작성 감지 점수 |
| language_score | integer | 언어 품질 점수 |
| job_match_score | integer | 직무 적합도 점수 |
| overall_result | text | 종합 평가 코멘트 |
| ai_writing_feedback | text | AI 작성 피드백 |
| language_feedback | text | 언어 품질 피드백 |
| job_match_feedback | text | 직무 적합도 피드백 |
| improvement_suggestions | text | 개선 제안 |
| url_analysis_result | text | URL 분석 결과 텍스트 |
| rich_analysis_result | text | JSON: 기술스킬·성격·조직 적합도 |

#### `interviews`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | 면접 ID |
| user_id | integer FK→users | 소유자 |
| company_id | integer FK→companies | 대상 회사 |
| status | text | 면접 진행 상태 |

#### `conversations` / `messages`
- `conversations`: 면접 세션별 대화 컨테이너
- `messages`: role(`user`/`assistant`) + content 저장

---

## 5. API 엔드포인트

모든 엔드포인트는 `/api` 접두사를 가집니다.  
인증이 필요한 엔드포인트는 🔒 표시.

### Auth
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/login` | 로그인 |
| POST | `/auth/logout` | 로그아웃 🔒 |
| GET | `/auth/me` | 현재 사용자 조회 🔒 |

### Resumes
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/resumes` | 이력서 목록 🔒 |
| POST | `/resumes` | 이력서 생성 🔒 |
| GET | `/resumes/:id` | 이력서 상세 🔒 |
| PATCH | `/resumes/:id` | 이력서 수정 🔒 |
| DELETE | `/resumes/:id` | 이력서 삭제 🔒 |
| POST | `/resumes/upload` | 파일 업로드 → 텍스트 추출 🔒 |
| POST | `/resumes/:id/spellcheck` | 맞춤법·표현 검토 🔒 |

### Companies
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/companies` | 회사 목록 🔒 |
| POST | `/companies` | 회사 생성 🔒 |
| GET | `/companies/:id` | 회사 상세 🔒 |
| PATCH | `/companies/:id` | 회사 수정 🔒 |
| DELETE | `/companies/:id` | 회사 삭제 🔒 |
| POST | `/companies/fetch-postings` | 채용공고 자동 수집 🔒 |
| POST | `/companies/recommend` | AI 기업 추천 🔒 |

### Analyses
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/analyses` | 심사 목록 🔒 |
| POST | `/analyses` | 심사 생성 (AI 분석 시작) 🔒 |
| GET | `/analyses/:id` | 심사 결과 상세 🔒 |

### Interviews
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/interviews` | 면접 세션 목록 🔒 |
| POST | `/interviews` | 면접 세션 생성 🔒 |
| GET | `/interviews/:id` | 면접 세션 상세 🔒 |
| POST | `/interviews/:id/answers` | 답변 제출 → AI 피드백 🔒 |

### Subscription
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/subscription/plans` | 플랜 목록 (공개) |
| GET | `/subscription/me` | 현재 구독 상태 🔒 |
| POST | `/subscription/subscribe` | 구독 시작/변경 🔒 |
| POST | `/subscription/cancel` | 구독 취소 🔒 |

### 기타
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/dashboard` | 대시보드 통계 🔒 |
| GET | `/healthz` | 헬스체크 (공개) |

---

## 6. 프론트엔드 라우팅

Wouter 기반 SPA. 베이스 경로: `import.meta.env.BASE_URL`

| 경로 | 컴포넌트 | 인증 필요 |
|---|---|---|
| `/` | LandingPage | ❌ |
| `/login` | LoginPage | ❌ |
| `/register` | RegisterPage | ❌ |
| `/dashboard` | Dashboard | ✅ |
| `/resumes` | ResumesPage | ✅ |
| `/resumes/:id` | ResumeDetail | ✅ |
| `/companies` | CompaniesPage | ✅ |
| `/companies/:id` | CompanyDetail | ✅ |
| `/analyses` | AnalysesPage | ✅ |
| `/analyses/new` | NewAnalysisPage | ✅ |
| `/analyses/:id` | AnalysisDetail | ✅ |
| `/interviews` | InterviewsPage | ✅ |
| `/interviews/new` | NewInterviewPage | ✅ |
| `/interviews/:id` | InterviewDetail | ✅ |
| `/subscription` | SubscriptionPage | ✅ |

---

## 7. AI 파이프라인

### 서류 심사 흐름
```
POST /analyses
    │
    ├─ 1. DB에 분석 레코드 생성 (status: processing)
    │
    ├─ 2. URL 분석
    │      ├─ 이력서 텍스트에서 URL 추출 (최대 8개)
    │      ├─ GitHub URL → GitHub REST API 호출 (언어·스타·리포 정보)
    │      └─ 기타 URL → HEAD 요청으로 접근 가능 여부 확인
    │
    ├─ 3. OpenAI gpt-5.6-luna 호출
    │      입력: 이력서 전문 + 직무설명 + URL 분석 결과 + 희망연봉
    │      출력: JSON (4개 점수 + 피드백 + 개선 제안 + 기술스킬·성격 평가)
    │
    └─ 4. 결과 DB 저장 (status: completed)
```

### 채용공고 수집 흐름
```
POST /companies/fetch-postings
    │
    ├─ 1. 필터 → 검색어 변환 (buildKeyword)
    │
    ├─ 2. 사람인 스크래핑 (scrapeSaramin, cheerio)
    │      최대 8건, 20초 타임아웃
    │
    ├─ 3. 잡코리아 검색 URL 생성 (getJobkoreaSearchUrl)
    │
    └─ 4. OpenAI gpt-5.6-luna 호출
           입력: 스크래핑 공고 + 잡코리아 URL + 필터 조건
           출력: JSON 배열 (6건 이하, 정규화된 공고 데이터)
```

### OpenAI 파라미터 제약 (gpt-5.6-luna)
> ⚠️ 이 모델은 아래 파라미터를 **지원하지 않습니다**.
> - `temperature` (1 이외의 값): 파라미터 자체를 제거해야 함
> - `max_tokens`: `max_completion_tokens`로 대체

---

## 8. 인증 및 세션

- **방식**: `express-session` (서버 사이드 세션)
- **저장소**: 메모리 (단일 인스턴스 배포 가정)
- **비밀번호**: `bcrypt` (salt rounds 10)
- **세션 데이터**: `req.session.userId` (users.id)
- **인증 미들웨어**: `requireAuth` → userId 없으면 401 반환
- **프론트엔드**: `credentials: 'include'` fetch로 쿠키 전송, `getMe` 쿼리로 인증 상태 관리

---

## 9. 환경 변수

| 변수명 | 필수 | 설명 |
|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅ | OpenAI API 키 (Replit 제공) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ | OpenAI 프록시 URL (Replit 제공) |
| `SESSION_SECRET` | ✅ | express-session 서명 키 |
| `DATABASE_URL` | ✅ | PostgreSQL 연결 문자열 (Replit DB 자동 제공) |
| `PORT` | ✅ | 서버 포트 (Replit 자동 할당) |
| `NODE_ENV` | — | `development` / `production` |

---

## 10. 배포 구성

### 워크플로
| 워크플로명 | 명령 | 역할 |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 백엔드 API |
| `artifacts/job-doc-check: web` | `pnpm --filter @workspace/job-doc-check run dev` | 프론트엔드 SPA |

### 빌드 프로세스 (api-server)
1. `node build.mjs` — esbuild로 TypeScript → ESM 번들
2. `node --enable-source-maps ./dist/index.mjs` — 번들 실행

### Replit 프록시 구성
- 프론트엔드와 백엔드는 각각 다른 포트에서 실행
- Vite devServer proxy: `/api/*` → 백엔드 포트 (`VITE_API_URL`)
- 프론트엔드 베이스 경로: `/job-doc-check/` (Replit 경로 기반 라우팅)
