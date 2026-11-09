# My ATS — AI 서류 심사관

한국 구직자를 위한 AI 서류 심사 서비스입니다. 이력서와 지원 회사를 등록하면 AI가 서류를 심사하고, 면접 준비까지 도와줍니다.

> 핵심 컨셉: **"내가 이 회사에 얼마나 적합한가"** 를 알려주고, **왜 떨어졌는지**와 **면접 대비**에 집중합니다.

## 주요 기능

| 기능 | 내용 |
|---|---|
| 이력서 관리 | 리치 텍스트 작성, PDF·Word 업로드, 맞춤법 검토, 커리어 분석(NCS 직무·수준, 연봉 가이드), 논문 정보 분석, PDF 출력 |
| 음성 자기소개서 | 녹음으로 경험을 자유롭게 말하면 STT로 받아 적어 자기소개서로 정리 |
| 지원 회사 관리 | 직접 입력, 채용 공고 URL 가져오기, 사람인 공고 자동 수집, AI 기업 추천 |
| AI 서류 심사 | 이력서와 회사를 매칭해 다차원 점수 산출, GitHub·포트폴리오 분석, 직무 문장 유사도, 다중 모델 심사 의견 |
| AI 면접 연습 | 이력서·공고·심사 결과를 바탕으로 질문 생성, 답변 피드백 반복 |

### 현재 구현 상태
- 한국어 기반으로 동작합니다.
- 스캔 PDF·이미지 공고용 **OCR 기능은 들어가 있지만 정확도가 높지 않습니다**. 약 5%의 오인식률을 감안할 때 실제로 효과가 있을지 검토 중입니다.
- 녹음으로 경험을 나열하면 자기소개서 형태로 정리되는 기능이 들어가 있습니다.

## 기술 스택

- **프론트엔드**: React, Vite, Tailwind CSS, shadcn/ui, TanStack Query (`artifacts/job-doc-check`)
- **백엔드**: Express 5, express-session, node-cron (`artifacts/api-server`)
- **DB**: PostgreSQL + Drizzle ORM (`lib/db`)
- **AI**: OpenAI 호환 API (주 모델 + 보조 심사 모델)
- **모노레포**: pnpm workspace, TypeScript strict

```
artifacts/api-server/     # REST API 백엔드
artifacts/job-doc-check/  # 웹 프론트엔드
lib/db/                   # DB 스키마·클라이언트
lib/api-client-react/     # 프론트엔드 API 훅 (수동 관리)
docs/                     # 시스템·아키텍처·Docker·VS Code 문서
```

## 실행 방법

```bash
pnpm install
cp .env.example .env            # 환경 변수 설정
cd lib/db && pnpm run push      # DB 마이그레이션
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/job-doc-check run dev
```

Windows에서 바로 실행하려면 `dev-windows.bat`을 사용하세요. 처음 설정 방법은 [docs/WINDOWS.md](docs/WINDOWS.md)에 있습니다.

Docker 실행은 [docs/DOCKER.md](docs/DOCKER.md), VS Code 환경은 [docs/VS_CODE.md](docs/VS_CODE.md)를 참고하세요. 자세한 구조는 [docs/SYSTEM.md](docs/SYSTEM.md)와 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)에 있습니다.

## 추가 개발 계획

**1. 불합격 원인 분석** — 왜 떨어졌는지 예상되는 이유를 짚어주는 것을 핵심 기능으로 삼습니다.
- 불합격 예상 원인 리포트, 점수 산출 근거 시각화("왜 이 점수가 나왔나?")
- 회사가 실제로 보는 기준 반영: 논문 등급과 저자 순서(1저자/2저자) 평가, AI 작성 문장 탐지, 장기 근속 가능성 판단
- 단순히 스펙을 높이라고 하기보다, 지원자의 강점을 회사에 맞춰 어필하는 방향으로 피드백

**2. 면접 대비 강화**
- 꼬리 질문, 음성 답변 지원
- 실시간 대화형 AI 모의 면접

**3. 지원 관리 편의 기능**
- 자격증·프로젝트·공모전 항목 추가, 회사마다 다른 이력서 기재 항목 통합 관리
- 캘린더 일정 관리와 전형 결과 발표일 알림
- 영어 이력서 판독, 모바일 환경 지원

**개발 원칙**
- 토큰 비용을 고려해 모델 5개 정도를 역할별로 나눠 사용합니다.
- 클라우드 환경에 배포해 바로 테스트해 볼 수 있게 할 예정입니다.
- 코드는 자유롭게 바꿔도 되고, 기능이 겹쳐도 괜찮습니다. 불합격 원인과 면접 대비 두 가지 컨셉에 집중합니다.
