import re

with open('artifacts/job-doc-check/src/pages/landing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Hero Stats Row
content = content.replace(
    '''<span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />4가지 정밀 채점</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />GitHub 기술 스택 분석</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />AI 면접 질문 생성</span>''',
    '''<span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />채용 공고 URL 자동 수집</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />이력서 자동 커리어 분석</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />이중 AI 서류 심사</span>'''
)

# 2. Trust bar
content = content.replace(
    '''{[
                { value: "4가지", label: "AI 분석 항목" },
                { value: "30초", label: "평균 분석 시간" },
                { value: "실시간", label: "GitHub 기술 분석" },
              ]}''',
    '''{[
                { value: "1초", label: "URL 공고 수집" },
                { value: "스캔본", label: "PDF 이력서 OCR" },
                { value: "3종", label: "이력서 PDF 템플릿" },
              ]}'''
)

# 3. How it works
content = content.replace(
    '''title: "회사 정보 등록",
                desc: "지원 회사의 채용공고, 인재상, JD를 입력하세요. AI가 맞춤 기준을 설정합니다.",''',
    '''title: "지원 공고 자동 수집",
                desc: "채용 공고 URL만 입력하세요. 텍스트는 물론 이미지 공고(OCR)까지 분석하여 맞춤 기준을 세웁니다.",'''
)
content = content.replace(
    '''title: "AI 서류 심사",
                desc: "이력서·자기소개서를 업로드하면 국어 품질, 직무 적합도, AI 작성 여부, GitHub 분석까지 자동으로 채점합니다.",''',
    '''title: "이력서 분석 및 교정",
                desc: "PDF 스캔본도 완벽히 인식하며, 등록 즉시 내 이력서의 강점, 추천 직업, 가이드 연봉, 오탈자를 점검합니다.",'''
)
content = content.replace(
    '''title: "결과 확인 & 면접 준비",
                desc: "통과/불합격 판정과 함께 핵심 개선사항을 받고, AI 면접 질문으로 실전 연습까지 완성하세요.",''',
    '''title: "이중 AI 심사 및 다운로드",
                desc: "인성·역량 평가관의 이중 심사와 복수 AI 의견을 확인하고, 완성된 이력서를 3종의 PDF 템플릿으로 다운로드하세요.",'''
)

# 4. Features
content = content.replace(
    '''title: "AI 작성 탐지",
                  desc: "ChatGPT 등으로 작성된 이력서를 판별합니다. 진정성 점수로 리스크를 사전 파악하세요.",''',
    '''title: "AI 커리어 종합 분석",
                  desc: "이력서 등록 시 강점, NCS 직업군, 미래 전망, 가이드 연봉, 오탈자 및 날짜 표기를 자동으로 점검하고 요약합니다.",'''
)
content = content.replace(
    '''title: "국어 품질 채점",
                  desc: "문법, 맞춤법, 논리 흐름, 설득력을 정밀 평가합니다.",''',
    '''title: "공고 URL 및 OCR 수집",
                  desc: "채용 공고 링크만 넣으면 텍스트는 물론 이미지 공고까지 OCR 기술로 추출해 맞춤 심사 기준을 세웁니다.",'''
)
content = content.replace(
    '''title: "직무 적합도 분석",
                  desc: "JD와 인재상 기반으로 이력서 내용의 일치도를 수치화합니다.",''',
    '''title: "이중 AI 및 복수 심사",
                  desc: "인성 평가관과 역량 평가관 2개의 역할이 교차 검증하며, 유료 플랜에서는 다각도의 복수 AI 의견을 제공합니다.",'''
)
content = content.replace(
    '''title: "GitHub 기술 분석",
                  desc: "이력서의 GitHub 링크를 실시간 접속 확인 후 언어, 프로젝트, 스타 수를 분석합니다.",''',
    '''title: "PDF 다운로드 (3종)",
                  desc: "분석과 교정이 끝난 이력서를 깔끔한 3가지 디자인 템플릿의 PDF로 즉시 다운로드하여 지원에 활용하세요.",'''
)

# 5. Pricing (Fix Free Plan)
content = content.replace(
    '''{["월 1회 AI 서류 심사", "기본 분석 리포트", "개선사항 제시"].map((f) => (''',
    '''{["월 1회 AI 서류 심사", "인성·역량 이중 심사", "직무 유사도 검토"].map((f) => ('''
)
# Pricing (Basic Plan)
content = content.replace(
    '''{["월 5회 AI 서류 심사", "4가지 항목 정밀 분석", "GitHub/포트폴리오 분석", "면접 시뮬레이션", "개선사항 상세 제시"].map((f) => (''',
    '''{["월 5회 AI 서류 심사", "복수 AI 심사 의견", "직무 유사도 검토", "GitHub/포트폴리오 분석", "면접 시뮬레이션"].map((f) => ('''
)
# Pricing (Premium Plan)
content = content.replace(
    '''{["월 20회 AI 서류 심사", "4가지 항목 정밀 분석", "GitHub/포트폴리오 분석", "무제한 면접 시뮬레이션", "우선 지원 처리"].map((f) => (''',
    '''{["월 20회 AI 서류 심사", "복수 AI 심사 의견", "직무 유사도 검토", "무제한 면접 시뮬레이션", "우선 지원 처리"].map((f) => ('''
)

with open('artifacts/job-doc-check/src/pages/landing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
