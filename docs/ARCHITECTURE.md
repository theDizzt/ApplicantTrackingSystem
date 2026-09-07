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
│  라우트: auth · resumes · companies · company-posting ·    │
│          analyses · career-analysis · interviews ·         │
│          subscription · dashboard · spellcheck ·           │
│          cover-letter · admin · health                     │
│  미들웨어: express-session · bcrypt · pino-http            │
│  스케줄러: node-cron (매주 월요일 09:00 KST)               │
│  OCR: pdftoppm(poppler-utils) + 비전 모델                  │
└───────┬────────────────────────┬────────────────────────┘
        │ Drizzle ORM            │ OpenAI 호환 API
        │                        │ (Replit AI Integrations Proxy)
┌───────▼────────┐    ┌──────────▼──────────────────────────┐
│  PostgreSQL DB │    │  주 모델 gpt-5.6-luna (+ 보조 2종)   │
│  (Replit 내장) │    │  서류 심사 / 커리어 분석 / 면접 생성 │
│                │    │  기업 추천 / 공고 수집 / 맞춤법 검토 │
│                │    │  임베딩 유사도 / 스캔 PDF 비전 OCR   │
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
| `src/lib/openai.ts` | OpenAI 호환 클라이언트 싱글턴 (주 모델 + 보조 모델 ai2_*/ai3_*) |
| `src/lib/resume-text.ts` | 이력서·기존 자기소개서 HTML을 AI 입력용 일반 텍스트로 정규화 |
| `src/lib/vision-ocr.ts` | 스캔(이미지) PDF·이미지 OCR. `MISTRAL_API_KEY` 있으면 Mistral OCR 우선, 없으면 pdftoppm PNG 변환 후 비전 모델 OCR |
| `src/lib/mistral-ocr.ts` | Mistral OCR API 래퍼 (선택). `MISTRAL_API_KEY` 설정 시 활성화, 실패 시 비전 OCR로 폴백 |
| `src/lib/similarity.ts` | 임베딩 기반 직무↔자소서 문장 유사도(0~100) |
| `src/lib/url-analyzer.ts` | GitHub API + URL 접근성 검사 |
| `src/lib/job-scrapers.ts` | 사람인 스크래퍼 + 잡코리아 URL 생성 |
| `src/lib/safe-fetch.ts` | SSRF 가드(사설/루프백/링크로컬 차단, DNS 핀닝, 바이트 파싱) |
| `src/lib/ai-health-monitor.ts` | AI 서버 주기 헬스체크(관리자 배너용) |
| `src/lib/logger.ts` | pino 로거 |
| `src/middlewares/auth.ts` | 세션 인증 미들웨어 |
| `src/middlewares/admin.ts` | 관리자 인증 미들웨어 |
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
| `src/components/career-analysis-panel.tsx` | 커리어 분석 결과 패널 |
| `src/components/resume-print.tsx` | 이력서 PDF 출력용 컴포넌트(템플릿 3종, print CSS) |
| `src/pages/cover-letter.tsx` | 음성 녹음·파일 업로드·가이드 질문 기반 자기소개서 생성 |
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
| career_analysis_result | text | 커리어 분석 결과 (JSON string) |
| career_analyzed_at | timestamptz | 커리어 분석 실행 시각 |

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
| rich_analysis_result | text | JSON: 기술스킬·성격·조직 적합도, `modelOpinions`(보조 모델 다중 심사 의견, UI는 모델명 미표기), `jobSimilarity`(임베딩 유사도 점수·의견) |

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
| POST | `/resumes/upload` | 파일 업로드 → 텍스트 추출 (스캔 PDF는 비전 OCR 폴백) 🔒 |
| POST | `/resumes/:id/spellcheck` | 맞춤법·표현 검토 🔒 |
| POST | `/resumes/:id/career-analysis` | 커리어 분석 실행(재실행 코얼레싱) 🔒 |
| GET | `/resumes/:id/career-analysis` | 커리어 분석 상태·결과 조회 🔒 |

> 이력서 PDF 다운로드는 별도 API가 아니라 프론트엔드에서 `resume-print.tsx`(템플릿 3종 + print CSS) 방식으로 처리합니다.

### Companies
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/companies` | 회사 목록 🔒 |
| POST | `/companies` | 회사 생성 🔒 |
| GET | `/companies/:id` | 회사 상세 🔒 |
| PATCH | `/companies/:id` | 회사 수정 🔒 |
| DELETE | `/companies/:id` | 회사 삭제 🔒 |
| POST | `/companies/fetch-postings` | 필터 기반 채용공고 자동 수집(사람인 스크래핑 + AI 보강) 🔒 |
| POST | `/companies/fetch-posting` | 채용 공고 URL 1건 가져오기(SSRF 가드, 이미지 공고 OCR) 🔒 |
| POST | `/companies/recommend` | AI 기업 추천 🔒 |

### Analyses
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/analyses` | 심사 목록 🔒 |
| POST | `/analyses` | 심사 생성 (AI 분석 시작) 🔒 |
| POST | `/analyses/:id/retry` | 실패한 심사 재시도 🔒 |
| GET | `/analyses/:id` | 심사 결과 상세 🔒 |

### Interviews
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/interviews` | 면접 세션 목록 🔒 |
| POST | `/interviews` | 면접 세션 생성 🔒 |
| GET | `/interviews/:id` | 면접 세션 상세 🔒 |
| POST | `/interviews/:id/answers` | 답변 제출 → AI 피드백 🔒 |

### Cover Letter
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/cover-letter/guided-prompts` | 선택한 이력서·기존 자기소개서 기반 음성 가이드 질문 6~8개 생성 🔒 |
| POST | `/cover-letter/generate` | 녹음/오디오 업로드 → ffmpeg 정규화 → STT → 자기소개서 생성 🔒 |

### Subscription
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/subscription/plans` | 플랜 목록 (공개) |
| GET | `/subscription/me` | 현재 구독 상태 🔒 |
| POST | `/subscription/subscribe` | 구독 시작/변경 🔒 |
| POST | `/subscription/cancel` | 구독 취소 🔒 |

### Admin
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/admin/login` · `/admin/logout` | 관리자 로그인/로그아웃 |
| GET | `/admin/me` · `/admin/stats` · `/admin/users` | 관리자 세션·통계·사용자 |
| GET/POST/PATCH/DELETE | `/admin/organizations…` | 조직 관리 🛡 |
| GET/PUT | `/admin/settings/ai` | AI 공급자 설정 조회/저장(주·보조 모델 ai2_*/ai3_* 및 STT 모델) 🛡 |
| GET | `/admin/settings/ai/health` · `/admin/settings/ai/health-status` | AI 헬스체크 🛡 |
| POST | `/admin/settings/ai/test` | AI 연결 테스트 🛡 |

> 🛡 = 관리자 인증 필요. 로컬 LLM(Ollama) 관련 관리 라우트는 전면 제거됨.

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
| `/cover-letter` | CoverLetterPage | ✅ |
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
    ├─ 3. 주 모델 gpt-5.6-luna 호출
    │      입력: 이력서 전문 + 직무설명 + URL 분석 결과 + 희망연봉
    │      출력: JSON (4개 점수 + 피드백 + 개선 제안 + 기술스킬·성격 평가)
    │
    ├─ 3-1. 보조 심사 모델(ai2_*/ai3_*)이 설정돼 있으면 추가 심사 →
    │        richAnalysisResult.modelOpinions 배열에 다중 의견 저장 (UI는 모델명 미표기)
    │
    ├─ 3-2. 직무↔자소서 임베딩 유사도(lib/similarity.ts) →
    │        richAnalysisResult.jobSimilarity (60점 이하면 개선 의견 첨부)
    │
    └─ 4. 결과 DB 저장 (status: completed)
```

### 파일 업로드 / 텍스트 추출 흐름
```
POST /resumes/upload
    │
    ├─ 1. 파일명·본문 NFD→NFC 정규화 (Mac 한글 자소 분리 대응)
    │
    ├─ 2. PDF: pdf-parse로 텍스트 추출 → 텍스트가 비면(스캔 이미지) 폴백:
    │        pdftoppm(poppler-utils)로 페이지별 PNG 렌더 → 비전 모델 OCR
    │
    └─ 3. DOCX/DOC: mammoth로 텍스트 추출
```

### 커리어 분석 흐름
```
POST /resumes/:id/career-analysis  (이력서 등록·수정 시 자동 실행)
    │
    ├─ 진행 중 재요청은 코얼레싱(중복 실행 방지)
    │
    └─ 결과(JSON) 저장 → resumes.career_analysis_result / career_analyzed_at
       필드: strengths · ncsCategories(NCS 1~8수준) · recommendedJobs · salaryGuide ·
             typoIssues · dateIssues · resumeSummary · summary
```

이력서 학술 정보는 논문 제목, 저자 순서, 학회/저널, Abstract를 구조화하고 가능한 경우 외부 서지 기록과 대조합니다. 추출된 Abstract는 서류 심사와 면접 질문의 추가 근거로 사용합니다.

### 음성 자기소개서 흐름
```
POST /cover-letter/guided-prompts
    │
    ├─ 이력서 소유권 확인
    ├─ 기존 자기소개서를 최우선 맥락으로 정규화
    └─ 성장 과정·학교생활·문제 해결·강점·지원 동기·입사 후 포부 질문 6~8개
       (AI 실패 또는 형식 오류 시 기본 질문으로 복구)

POST /cover-letter/generate
    │
    ├─ 브라우저 녹음 또는 오디오 파일 수신 (최대 50MB, 녹음 최대 10분)
    │    └─ API 인스턴스당 동시 음성 처리 2건, 초과 요청은 429 + Retry-After
    ├─ 임시 파일 생성 → ffmpeg 정규화 (최대 90초)
    ├─ 관리자 STT 모델로 전사
    │    └─ 미지원 모델이면 gpt-4o-mini-transcribe로 한 번 재시도
    ├─ 기존 관리자 AI 설정(getAI)으로 자기소개서 생성
    └─ 임시 원본·변환 파일 삭제, 결과를 선택한 이력서에 반영
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
    └─ 4. 주 모델 호출
           입력: 스크래핑 공고 + 잡코리아 URL + 필터 조건
           출력: JSON 배열 (6건 이하, 정규화된 공고 데이터)
```

### 채용 공고 URL 가져오기 흐름
```
POST /companies/fetch-posting  (공고 URL 1건)
    │
    ├─ 1. SSRF 가드(safe-fetch): 사설/루프백/링크로컬/예약 대역 차단, DNS 핀닝
    │      사람인/잡코리아는 상세 페이지 추적
    │
    ├─ 2. 페이지 파싱(cheerio)으로 공고 텍스트 추출
    │      이미지 공고는 비전 모델 OCR로 텍스트화
    │
    └─ 3. AI가 회사·직무 필드로 정규화해 반환
```

### OpenAI 파라미터 제약 (gpt-5.6-luna)
> ⚠️ 이 모델은 아래 파라미터를 **지원하지 않습니다**.
> - `temperature` (1 이외의 값): 파라미터 자체를 제거해야 함
> - `max_tokens`: `max_completion_tokens`로 대체

---

## 8. 인증 및 세션

- **방식**: `express-session` (서버 사이드 세션)
- **저장소**: PostgreSQL `user_sessions` 테이블(`connect-pg-simple`)
- **비밀번호**: `bcrypt` (salt rounds 10)
- **세션 데이터**: `req.session.userId` (users.id)
- **인증 미들웨어**: `requireAuth` → userId 없으면 401 반환
- **프론트엔드**: `credentials: 'include'` fetch로 쿠키 전송, `getMe` 쿼리로 인증 상태 관리

---

## 9. 환경 변수

| 변수명 | 필수 | 설명 |
|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅ | 주 모델 API 키 (관리자 설정 미지정 시 폴백) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ | OpenAI 호환 API URL (관리자 설정 미지정 시 폴백) |
| `SESSION_SECRET` | ✅ | express-session 서명 키 |
| `ADMIN_USERNAME` | 운영 ✅ | 관리자 포털 아이디 |
| `ADMIN_PASSWORD_HASH` | 운영 ✅ | bcrypt 관리자 비밀번호 해시 |
| `DATABASE_URL` | ✅ | PostgreSQL 연결 문자열 (Replit DB 자동 제공) |
| `PORT` | ✅ | 서버 포트 (Replit 자동 할당) |
| `MISTRAL_API_KEY` | — | 선택 사항. 설정 시 스캔·이미지 문서 OCR에 Mistral OCR을 우선 사용 (미설정·실패 시 비전 모델 OCR로 폴백) |
| `NODE_ENV` | — | `development` / `production` |

> **AI 공급자 설정 우선순위**: 관리자 페이지(DB `settings` 테이블: `ai_api_key`/`ai_base_url`/`ai_model`)가 우선, 없으면 위 환경변수 폴백. STT 모델은 관리자 설정을 사용하며 기본값은 `gpt-4o-mini-transcribe`입니다.
> 보조 심사 모델은 DB 설정 키 `ai2_*` / `ai3_*`로만 등록하며 환경변수 폴백은 없습니다.
>
> **런타임 의존성**: 스캔(이미지) PDF OCR 폴백에 `pdftoppm`(poppler-utils)이 필요합니다. Docker 이미지·설치 스크립트에 포함되어 있습니다.
>
> **OCR 엔진 우선순위**: `MISTRAL_API_KEY`가 설정되어 있으면 Mistral OCR(전용 OCR API)을 우선 사용합니다. PDF는 문서 전체를 한 번에 처리하여 `pdftoppm` 렌더링이 불필요하며, 이미지는 그대로 전송합니다. 키가 없거나 호출이 실패·결과가 너무 짧으면(30자 미만) 기존 `pdftoppm`+비전 모델 OCR 경로로 자동 폴백합니다.

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

### Docker / 온프렘 배포
- 런타임 베이스 이미지: `node:22-slim`(Debian). Nginx·tini·curl과 **`poppler-utils`(pdftoppm, 스캔 PDF OCR)** 를 설치
- 오디오 처리용 `ffmpeg`를 포함하며 앱·Nginx 모두 업로드 한도를 50MB로 통일
- 앱 시작 전에 DB 마이그레이션을 완료해야 하며 스키마가 없으면 fail-fast
- 세션 테이블도 Drizzle 스키마에 포함하며 앱 시작 시 임시 DDL을 실행하지 않음
- `/healthz`는 Nginx→API→PostgreSQL `select 1`까지 성공해야 200 반환
- 세션 쿠키 `secure: "auto"` + `trust proxy` — HTTPS(`X-Forwarded-Proto: https`)면 자동으로 Secure 쿠키, 평문 HTTP면 미적용
- 컨테이너 Nginx는 상위 프록시의 `X-Forwarded-Proto` 를 패스스루(없으면 `$scheme`)
- 브라우저 API는 동일 출처 `/api`를 사용하며 운영에서 API 포트와 DB 포트를 인터넷에 직접 공개하지 않음
- 일반 Ubuntu VM 직접 설치는 Node.js 22, pnpm 10, PostgreSQL, Nginx, poppler-utils, ffmpeg를 사용
- 자세한 내용은 `docs/DOCKER.md` 참고
