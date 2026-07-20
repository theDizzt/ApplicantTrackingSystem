/**
 * 잡코리아·사람인 채용공고 기반 회사 및 채용 정보 시드 스크립트
 * 신입 4개 + 경력 3년차 4개 = 총 8개 회사
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_USER_ID = 1; // 박준호

// ──────────────────────────────────────────────────────────────────────────────
// 회사 데이터 (출처: 잡코리아·사람인 실제 채용공고 기반)
// ──────────────────────────────────────────────────────────────────────────────
const companies = [
  // ═══════════════════════ 잡코리아 신입 ═══════════════════════
  {
    name: "이지케어텍(주)",
    siteUrl: "https://www.ezCaretech.com",
    jobPostingUrl: "https://www.jobkorea.co.kr/Recruit/GI_Read/48982560",
    talentProfile: `디지털 헬스케어 혁신을 함께 이끌어 나갈 인재 / 의료 IT 분야에서 기술로 사회적 가치를 실현하고자 하는 인재 / 협업과 소통 능력이 뛰어나며 주도적으로 문제를 해결하는 인재 / 새로운 기술 습득에 열정적이며 지속적으로 성장하고자 하는 인재`,
    jobDescription: `[출처: 잡코리아] 이지케어텍(주) - [의료IT] 2026년 이지케어텍 신입 개발자 채용 (채용연계형 인턴)

【모집 포지션】
- SW 개발자 (신입)
- 고용 형태: 인턴 3개월 → 정규직 전환 (채용연계형)
- 근무지: 서울 중구 퇴계로 307 광희빌딩 4~6층
- 근무 시간: 주 5일(월~금) 09:00~18:00
- 급여: 회사 내규에 따름

【담당 업무】
- 의료정보시스템(HIS) / 전자의무기록(EMR) SW 개발 및 유지보수
- 병원 정보 연동 API 개발 (HL7, FHIR 등 의료 표준 프로토콜)
- AI 기반 임상 의사결정지원(CDSS) 모듈 개발
- 스마트병원 플랫폼 연계 기능 개발

【자격 요건】
- 학력: 4년제 대졸 이상 (컴퓨터공학, 소프트웨어공학 등 관련 전공 우대)
- 경력: 신입
- Java / Spring Framework 기초 지식 보유자
- DB(Oracle, MySQL) 기초 이해 및 SQL 작성 능력
- 팀워크 및 커뮤니케이션 능력 보유자

【우대 사항】
- 의료정보 관련 프로젝트 경험자
- Spring Boot, MyBatis 활용 경험자
- RESTful API 설계·개발 경험자
- AWS 또는 클라우드 서비스 기초 이해자
- HL7·FHIR 의료 표준 규격 학습자

【복리후생】
- 채용연계형 인턴 → 3개월 후 정규직 전환 평가
- 4대 보험 / 연차·반차 자유 사용
- 사내 교육 및 외부 교육 지원
- 건강검진 지원
- 유연근무제 (코어타임 준수)`,
    notes: "출처: 잡코리아 | 신입 | 의료IT·EMR·HIS 분야 | 채용연계형 인턴 3개월",
  },
  {
    name: "(주)샌드박스네트워크",
    siteUrl: "https://www.sandbox.co.kr",
    jobPostingUrl: "https://m.jobkorea.co.kr/Recruit/GI_Read/49178182",
    talentProfile: `창의적인 아이디어로 엔터테인먼트 산업을 혁신하는 인재 / 크리에이터 생태계를 기술로 지원하고자 하는 인재 / 빠른 환경 변화에 유연하게 적응하고 능동적으로 행동하는 인재 / 협업을 중시하며 팀의 성장을 함께 이끌어나갈 인재`,
    jobDescription: `[출처: 잡코리아] (주)샌드박스 - React기반 풀스택 개발자 신입 모집

【모집 포지션】
- React 기반 풀스택 개발자 (신입)
- 모집 인원: 1명
- 고용 형태: 정규직 (수습 3개월) / 계약직 / 인턴 동시 모집
- 근무지: 서울 강서구 화곡로 416 가양역더스카이밸리5차지식산업센터
- 근무 시간: 주 5일(월~금) 09:00~18:00
- 급여: 회사 내규에 따름 (면접 후 결정)

【담당 업무】
- React.js 기반 크리에이터 플랫폼 프론트엔드 개발 및 유지보수
- Node.js / Express 백엔드 API 개발
- 크리에이터 콘텐츠 관리 시스템(CMS) 기능 개발
- 내부 어드민 페이지 설계 및 개발
- 서비스 성능 모니터링 및 버그 수정

【자격 요건】
- 학력: 학력 무관
- 경력: 신입
- React.js 기초 이해 및 컴포넌트 구현 경험
- HTML5 / CSS3 / JavaScript(ES6+) 기본 지식
- REST API 연동 개발 경험
- Git 버전 관리 기본 사용 가능

【우대 사항】
- Next.js 활용 SSR·SSG 구현 경험자
- Node.js / Express 백엔드 개발 경험자
- TypeScript 사용 경험자
- AWS S3, CloudFront 등 클라우드 활용 경험자
- 크리에이터·MCN 산업에 관심 있는 자
- 사이드 프로젝트 또는 오픈소스 기여 이력 보유자

【복리후생】
- 4대 보험 완비
- 스톡옵션 부여 (정규직 전환 후)
- 도서 구입비·교육비 지원
- 자유로운 연차 사용
- 크리에이터 콘텐츠 제작 참여 기회`,
    notes: "출처: 잡코리아 | 신입 | 엔터테인먼트·크리에이터 플랫폼 | React 풀스택",
  },

  // ═══════════════════════ 잡코리아 경력 3년 ═══════════════════════
  {
    name: "온잇코리아(주)",
    siteUrl: "https://www.onit.co.kr",
    jobPostingUrl: "https://www.jobkorea.co.kr/Recruit/GI_Read/48969595",
    talentProfile: `물류 IT 혁신을 주도하는 기술 지향적 인재 / 스타트업 문화에 맞게 주도적으로 업무를 추진하는 인재 / 성과 중심의 사고방식으로 지속적인 서비스 개선을 추구하는 인재 / 백엔드 설계 역량을 갖추고 시스템 최적화에 관심 있는 인재`,
    jobDescription: `[출처: 잡코리아] 온잇코리아(주) - [물류IT 스타트업] 백엔드 개발자 채용 (경력 3년 이상)

【모집 포지션】
- 백엔드 개발자
- 모집 인원: 1명
- 고용 형태: 정규직 (수습 3개월)
- 경력: 3년 이상
- 근무지: 서울 서초구 태봉로 114 한국교원단체총연합회빌딩
- 근무 시간: 주 5일(월~금) 09:00~18:00 (탄력근무제 운영)
- 급여: 연봉 3,800만원 이상 (면접 후 결정)

【담당 업무】
- 물류 플랫폼 백엔드 API 설계·개발 및 운영
- 실시간 물류 데이터 처리 및 배송 추적 시스템 개발
- 외부 물류 파트너 API 연동 및 통합
- 시스템 성능 최적화 및 DB 쿼리 튜닝
- 마이크로서비스 아키텍처 설계·개발
- 코드 리뷰 및 기술 문서 작성

【자격 요건】
- 경력: 백엔드 개발 경력 3년 이상
- Java / Spring Boot 기반 서비스 개발 실무 경험
- MySQL / PostgreSQL 등 RDBMS 설계 및 최적화 경험
- RESTful API 설계·개발 경험
- Git 기반 협업 개발 능숙

【우대 사항】
- 물류·커머스 도메인 서비스 개발 경험자
- Redis, Kafka 등 메시징·캐싱 시스템 활용 경험자
- AWS (EC2, RDS, SQS 등) 운영 경험자
- 마이크로서비스 아키텍처(MSA) 설계·운영 경험자
- Docker / Kubernetes 컨테이너 환경 경험자
- 대용량 트래픽 처리 경험자

【복리후생】
- 스타트업 스톡옵션 제공
- 자율 출퇴근 (탄력근무제)
- 도서·교육비 지원 (연간 100만원)
- 4대 보험 완비
- 명절 상여금
- 연차 자유 사용`,
    notes: "출처: 잡코리아 | 경력 3년 이상 | 물류IT 스타트업 | 연봉 3,800만원↑",
  },
  {
    name: "(주)코디얼",
    siteUrl: "https://www.cordial.co.kr",
    jobPostingUrl: "https://www.jobkorea.co.kr/Recruit/GI_Read/48644675",
    talentProfile: `소프트웨어 품질과 아키텍처 설계를 중시하는 인재 / 풀스택 역량을 보유하며 제품 전체 사이클을 이해하는 인재 / 문제 해결 능력이 뛰어나고 새로운 기술 도입에 적극적인 인재 / 강소기업 선정 기업답게 기술력과 성과를 동시에 추구하는 인재`,
    jobDescription: `[출처: 잡코리아] (주)코디얼 - 2026년 경력 채용공고 Node.js Full-Stack Developer

【모집 포지션】
- Node.js Full-Stack Developer (IT개발 / 데이터·웹개발 / Fullstack)
- 고용 형태: 정규직
- 경력: 경력직 (3년 이상 권장)
- 근무지: 서울
- 급여: 면접 후 결정
- 참고: 잡코리아 선정 '참 괜찮은 강소기업'

【담당 업무】
- Node.js 기반 백엔드 API 서버 개발 및 운영
- React / Next.js 기반 프론트엔드 개발
- PostgreSQL / MongoDB 데이터 모델링 및 쿼리 최적화
- 클라우드(AWS) 인프라 구성 및 DevOps 운영
- 서비스 기능 설계·기획 참여 및 기술 스펙 결정

【자격 요건】
- Node.js(Express / NestJS) 백엔드 개발 경험 3년 이상
- React.js 또는 Next.js 프론트엔드 개발 경험
- RDBMS 및 NoSQL DB 설계·운영 경험
- RESTful API 또는 GraphQL API 개발 경험
- Git 기반 협업 및 코드 리뷰 경험

【우대 사항】
- TypeScript 실무 적용 경험자
- Redis 캐싱 / Pub-Sub 패턴 사용 경험자
- AWS (Lambda, S3, CloudFront, RDS) 운영 경험자
- 마이크로서비스 아키텍처 설계 및 운영 경험자
- CI/CD 파이프라인 구축 경험자 (GitHub Actions, Jenkins 등)
- SaaS 또는 B2B 플랫폼 개발 경험자

【복리후생】
- 자유로운 연차 사용
- 교육비·도서비 지원
- 4대 보험 완비
- 우수 성과자 인센티브
- 성과 기반 연봉 협상`,
    notes: "출처: 잡코리아 | 경력 3년↑ | 강소기업 선정 | Node.js 풀스택",
  },

  // ═══════════════════════ 사람인 신입 ═══════════════════════
  {
    name: "(주)지투이",
    siteUrl: "https://www.g2e.co.kr",
    jobPostingUrl: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=53293016",
    talentProfile: `정직(Honesty) · 성실(Sincerity) · 창의(Creative) 세 가지 핵심 가치를 갖춘 인재 / 바른 가치관으로 좋은 세상을 열어갈 열정을 가진 인재 / 의료·헬스케어 IT 분야에서 사회적 가치를 실현하고자 하는 인재 / 팀 기여 및 조직 연결 문화에 공감하는 인재`,
    jobDescription: `[출처: 사람인] (주)지투이 - 2026년 상반기 IT개발자 신입 채용

【모집 포지션】
- IT개발자 (신입)
- 고용 형태: 정규직
- 경력: 신입
- 근무지: 서울
- 급여: 면접 후 결정

【회사 소개】
1990년대 벤처 붐을 거쳐 4차 산업혁명 시대까지 20여 년간 "우월한 IT기술을 통한 사회적 가치 실현"을 목표로 성장한 의료·헬스케어 IT 전문 기업. 응급상황 모니터링부터 만성질환 관리, 간호간병 병동, 헌혈/수혈, 연명치료까지 의료 현장 전반에 솔루션을 제공.

【담당 업무】
- 의료정보 솔루션 (응급실·ICU·수술실 관리 시스템) 개발
- 개인정보관리(PIMS) 및 헬스케어 데이터 처리 시스템 개발
- 웹 기반 의료 플랫폼 신규 기능 개발 및 유지보수
- 내부 업무 자동화 도구 개발

【자격 요건】
- 학력: 4년제 대졸 이상 (컴퓨터공학, 소프트웨어공학 등 관련 전공 우대)
- 경력: 신입
- Java / Python 기초 지식 보유자
- 관계형 DB(MySQL, Oracle) 기초 이해
- 기본적인 알고리즘·자료구조 이해

【우대 사항】
- Spring Framework 또는 Spring Boot 실습 경험자
- 의료·바이오 정보 관련 전공자 또는 프로젝트 경험자
- 공공·의료 IT 도메인에 관심 있는 자
- AWS 클라우드 기초 이해자
- 팀 프로젝트 협업 경험자

【복리후생】
- 4대 보험 완비
- 정기 건강검진
- 교육비 지원 (직무 관련 교육 100% 지원)
- 자유로운 연차 사용
- 명절 상여 지급
- 사내 동호회 지원`,
    notes: "출처: 사람인 | 신입 | 의료·헬스케어 IT | 20년 이상 기업",
  },
  {
    name: "인스피언(주)",
    siteUrl: "https://inspien.co.kr",
    jobPostingUrl: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=52833510",
    talentProfile: `SAP 보안·SIEM·EDI 분야의 전문성을 키우고자 하는 인재 / 새로운 기술을 빠르게 습득하고 업무에 적용하는 인재 / 고객사와의 원활한 커뮤니케이션 능력을 갖춘 인재 / SaaS 솔루션 개발에 관심 있는 성장 지향적 인재`,
    jobDescription: `[출처: 사람인] 인스피언(주) - [청년디지털일자리] 2026년 상반기 Java개발 신입/경력 사원

【모집 포지션】
- Java 개발자 (신입/경력)
- 청년디지털일자리 사업 연계 채용
- 고용 형태: 정규직 또는 인턴 (정규직 전환 가능)
- 경력: 신입 / 경력 1~3년
- 근무지: 서울
- 급여: 면접 후 결정

【회사 소개】
SAP 보안·SIEM·EDI SaaS 솔루션 전문 기업. 국내외 대기업 고객사를 대상으로 SAP 기반 보안 솔루션 및 전자문서 교환(EDI) 플랫폼을 제공. SaaS 형태의 클라우드 기반 솔루션 개발에 특화.

【담당 업무】
- Java 기반 백엔드 서비스 개발 (Spring Boot)
- SAP 연동 API 개발 및 데이터 처리 모듈 개발
- EDI(전자문서교환) 솔루션 기능 개발 및 운영
- SIEM(보안정보·이벤트 관리) 시스템 기능 개발
- 고객사 커스터마이징 및 기술 지원

【자격 요건】
- 학력: 학력 무관 (관련 전공 우대)
- 경력: 신입 / 경력 1년 이상
- Java 언어 기초 역량 보유자
- Spring Framework 또는 Spring Boot 기초 이해
- RDBMS 기본 SQL 작성 능력

【우대 사항】
- SAP 관련 교육 이수자 또는 관심 있는 자
- EDI·전자문서 표준(XML, EDIFACT) 이해자
- 보안(SIEM, ISMS) 분야 관심 보유자
- AWS 또는 Azure 클라우드 서비스 기초 이해자
- 영어 기술 문서 독해 가능자

【복리후생】
- 청년디지털일자리 사업 연계 (정부 지원 혜택)
- 4대 보험 완비
- 교육비 지원 (SAP 자격증 취득 지원)
- 유연근무제
- 연차 자유 사용`,
    notes: "출처: 사람인 | 신입·경력1~3년 | SAP 보안·EDI·SIEM SaaS | 청년디지털일자리",
  },

  // ═══════════════════════ 사람인 경력 3년 ═══════════════════════
  {
    name: "(주)파인티처",
    siteUrl: "https://www.fineteacher.co.kr",
    jobPostingUrl: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=53633418",
    talentProfile: `React·NestJS·AWS 기반 서비스를 설계하고 운영한 경험이 있는 인재 / 프론트엔드와 백엔드를 모두 이해하며 제품 전반에 기여할 수 있는 인재 / 빠른 실행력과 책임감으로 서비스 품질을 높이는 인재 / 에듀테크 서비스에 관심이 있으며 성장 지향적 마인드를 가진 인재`,
    jobDescription: `[출처: 사람인] (주)파인티처 - [파인티처] Nest.js & AWS 백엔드 경력 (3년 이상) 개발자 모집

【모집 포지션】
- 백엔드 개발자 (NestJS & AWS)
- 고용 형태: 정규직
- 경력: 3년 이상
- 근무지: 서울
- 급여: 면접 후 결정 (경력 및 역량 반영)

【회사 소개】
에듀테크 분야 스타트업. React 프론트엔드 + Node.js/NestJS 백엔드 + AWS 인프라 기반 학습 플랫폼을 운영. 교육 콘텐츠 제공·관리 시스템 및 학습 분석 서비스를 개발 중.

【담당 업무】
- NestJS 기반 백엔드 API 서버 개발·운영
- AWS 인프라 설계 및 운영 (EC2, RDS, Lambda, S3, CloudFront)
- TypeScript 기반 서비스 아키텍처 설계
- PostgreSQL 데이터 모델링 및 쿼리 최적화
- React 프론트엔드 협업 및 API 설계
- 서비스 모니터링 및 장애 대응

【자격 요건】
- 경력: 3년 이상
- NestJS 또는 Express 기반 백엔드 개발 실무 경험
- AWS 서비스 운영 경험 (EC2, RDS, S3 필수)
- TypeScript 실무 경험
- PostgreSQL 또는 MySQL 설계·운영 경험
- RESTful API 설계 능력

【우대 사항】
- React.js 프론트엔드 개발 경험자 (풀스택 가능자 우대)
- Redis 캐싱 및 Bull Queue 활용 경험자
- Docker / Kubernetes 컨테이너 운영 경험자
- CI/CD 파이프라인 구축 경험자 (GitHub Actions)
- 에듀테크·교육 도메인 서비스 개발 경험자
- 대용량 데이터 처리 및 성능 튜닝 경험자

【복리후생】
- 유연근무제 (코어타임 10:00~17:00)
- 재택근무 일부 지원
- 도서·교육비 지원
- 4대 보험 완비
- 자유로운 연차 사용
- 성과 인센티브 지급`,
    notes: "출처: 사람인 | 경력 3년↑ | 에듀테크 | NestJS·AWS·TypeScript",
  },
  {
    name: "(주)아이엠폼",
    siteUrl: "https://imform.co.kr",
    jobPostingUrl: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54326373",
    talentProfile: `서비스 품질과 사용자 경험을 최우선으로 생각하는 인재 / 복잡한 비즈니스 로직을 체계적으로 설계할 수 있는 인재 / 빠른 의사결정 환경에서 자기 주도적으로 업무를 수행하는 인재 / 지속적인 코드 개선과 기술 부채 해결에 관심 있는 인재`,
    jobDescription: `[출처: 사람인] (주)아이엠폼 - [경력 3년 이상] 백엔드 개발자 채용

【모집 포지션】
- 백엔드 개발자
- 고용 형태: 정규직
- 경력: 3년 이상
- 근무지: 서울
- 급여: 면접 후 결정

【회사 소개】
폼(Form) 기반 데이터 수집·관리 솔루션을 제공하는 SaaS 기업. 기업 고객을 위한 설문·신청서·계약서 디지털화 플랫폼 운영. 빠른 성장세의 B2B SaaS 스타트업.

【담당 업무】
- 서버 사이드 비즈니스 로직 설계 및 API 개발
- 대용량 폼 데이터 처리 및 데이터 파이프라인 구축
- 멀티테넌트 SaaS 아키텍처 설계 및 운영
- 외부 서비스 연동 (전자서명, 결제, 스토리지 등)
- 코드 리뷰 및 신규 개발자 온보딩 지원
- 성능 모니터링 및 DB 인덱스 최적화

【자격 요건】
- 경력: 3년 이상
- Node.js (Express 또는 NestJS) 백엔드 개발 3년 이상 실무 경험
- MySQL / PostgreSQL 설계 및 튜닝 경험
- REST API 설계·개발 및 문서화 능력
- 클라우드 서비스 (AWS 또는 GCP) 운영 경험

【우대 사항】
- TypeScript 실무 적용 경험자
- Redis / ElasticSearch 활용 경험자
- 전자서명·문서 관련 서비스 개발 경험자
- SaaS 멀티테넌시 아키텍처 경험자
- 테스트 코드 작성 습관 보유자 (Jest, Mocha 등)
- CI/CD 파이프라인 운영 경험자

【복리후생】
- 자율 출퇴근 (코어타임 10:00~16:00)
- 전면 재택근무 옵션
- 도서·교육비 전액 지원
- 최신 장비 제공 (맥북 또는 원하는 사양)
- 4대 보험 완비
- 스톡옵션 부여`,
    notes: "출처: 사람인 | 경력 3년↑ | B2B SaaS·폼 솔루션 | Node.js·TypeScript",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DB 삽입
// ──────────────────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    let skipped  = 0;

    for (const c of companies) {
      // 동일 이름 + userId 중복 방지
      const exist = await client.query(
        "SELECT id FROM companies WHERE user_id = $1 AND name = $2",
        [TARGET_USER_ID, c.name]
      );
      if (exist.rows.length > 0) {
        console.log(`⏭  이미 존재 → ${c.name}`);
        skipped++;
        continue;
      }

      const res = await client.query(
        `INSERT INTO companies
           (user_id, name, site_url, job_posting_url, talent_profile, job_description, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
         RETURNING id`,
        [TARGET_USER_ID, c.name, c.siteUrl, c.jobPostingUrl, c.talentProfile, c.jobDescription, c.notes]
      );
      console.log(`✅ 등록 완료 → [id=${res.rows[0].id}] ${c.name}`);
      inserted++;
    }

    console.log(`\n📊 결과: ${inserted}개 등록, ${skipped}개 스킵 (총 ${companies.length}개)`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
