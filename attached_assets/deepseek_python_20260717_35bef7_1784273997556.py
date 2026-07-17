import pandas as pd
import numpy as np
from datetime import datetime
import json
from typing import Dict, List, Tuple

class FaceReadingAnalyzer:
    """
    관상 분석 및 기업 적합도 평가 시스템
    - 이력서 기반 관상 특징 추출
    - 직무 적합도 평가
    - 기업 문화 매칭 분석
    """
    
    def __init__(self):
        # 관상 특성 매핑 (이력서 내용 기반 추론)
        self.face_features = {
            '이마': {
                '넓음': ['전략적 사고', '창의성', '비전 제시'],
                '좁음': ['집중력', '세부 분석', '실행력']
            },
            '눈': {
                '크고 또렷': ['직관력', '대인관계', '적응력'],
                '작고 날카로움': ['분석력', '정밀성', '논리력']
            },
            '코': {
                '오똑함': ['추진력', '리더십', '자신감'],
                '단정함': ['안정성', '신뢰성', '협업력']
            },
            '입': {
                '입술 두툼': ['표현력', '친화력', '열정'],
                '입술 얇음': ['냉철함', '객관성', '효율성']
            },
            '턱': {
                '둥글고 길쭉': ['인내심', '책임감', '완성도'],
                '각지고 짧음': ['결단력', '속도', '목표지향']
            }
        }
        
        # 직무별 요구 관상 특성
        self.job_requirements = {
            'iOS_개발자': {
                '필수': ['집중력', '분석력', '안정성', '책임감'],
                '우대': ['직관력', '협업력', '추진력', '인내심']
            },
            '백엔드_개발자': {
                '필수': ['논리력', '정밀성', '신뢰성', '객관성'],
                '우대': ['효율성', '안정성', '협업력', '인내심']
            },
            '풀스택_개발자': {
                '필수': ['전략적 사고', '적응력', '협업력', '실행력'],
                '우대': ['창의성', '분석력', '책임감', '직관력']
            },
            '미디어_개발자': {
                '필수': ['직관력', '창의성', '열정', '표현력'],
                '우대': ['집중력', '적응력', '추진력', '인내심']
            }
        }
        
        # 기업 문화 유형별 선호 특성
        self.company_culture = {
            '스타트업': {
                '선호': ['추진력', '창의성', '열정', '적응력', '목표지향'],
                '비선호': ['안정성', '신뢰성']
            },
            '중견기업': {
                '선호': ['안정성', '책임감', '신뢰성', '협업력', '인내심'],
                '비선호': ['혁신성']
            },
            '대기업': {
                '선호': ['전략적 사고', '논리력', '책임감', '객관성', '정밀성'],
                '비선호': ['추진력']
            },
            '미디어/콘텐츠': {
                '선호': ['창의성', '표현력', '직관력', '열정', '적응력'],
                '비선호': ['경직성']
            }
        }

    def extract_face_features_from_resume(self, resume_text: str) -> Dict:
        """
        이력서 내용에서 관상 관련 키워드 추출 및 특성 매핑
        """
        features = {}
        
        # 경력 기반 특성 추론
        if 'iOS' in resume_text or 'Swift' in resume_text:
            features['눈'] = '크고 또렷'
            features['코'] = '오똑함'
        elif 'Spring' in resume_text or 'Java' in resume_text:
            features['눈'] = '작고 날카로움'
            features['코'] = '단정함'
        
        # 경력 기간 기반 특성
        if '2년' in resume_text or '3년' in resume_text:
            features['턱'] = '둥글고 길쭉'
        elif '1년' in resume_text:
            features['턱'] = '각지고 짧음'
        
        # 프로젝트 성격 기반
        if '미디어' in resume_text or '스트리밍' in resume_text:
            features['이마'] = '넓음'
            features['입'] = '입술 두툼'
        elif '데이터' in resume_text or '백엔드' in resume_text:
            features['이마'] = '좁음'
            features['입'] = '입술 얇음'
            
        # 기본값 설정
        for key in self.face_features:
            if key not in features:
                features[key] = list(self.face_features[key].keys())[0]
                
        return features

    def get_personality_traits(self, face_features: Dict) -> List[str]:
        """
        관상 특성으로부터 성격 특성 도출
        """
        traits = []
        for feature, value in face_features.items():
            if value in self.face_features[feature]:
                traits.extend(self.face_features[feature][value])
        return list(set(traits))

    def calculate_job_fit(self, traits: List[str], job_type: str) -> Dict:
        """
        직무 적합도 계산
        """
        if job_type not in self.job_requirements:
            return {'score': 0, 'details': '해당 직무 정보 없음'}
        
        req = self.job_requirements[job_type]
        
        # 필수 특성 매칭
        required_match = len(set(traits) & set(req['필수']))
        required_total = len(req['필수'])
        required_score = required_match / required_total if required_total > 0 else 0
        
        # 우대 특성 매칭
        preferred_match = len(set(traits) & set(req['우대']))
        preferred_total = len(req['우대'])
        preferred_score = preferred_match / preferred_total if preferred_total > 0 else 0
        
        total_score = (required_score * 0.7 + preferred_score * 0.3) * 100
        
        return {
            'score': round(total_score, 1),
            'required_match': f"{required_match}/{required_total}",
            'preferred_match': f"{preferred_match}/{preferred_total}",
            'matched_traits': list(set(traits) & set(req['필수'] + req['우대'])),
            'missing_required': list(set(req['필수']) - set(traits)),
            'level': '적합' if total_score >= 70 else '보통' if total_score >= 50 else '개선필요'
        }

    def analyze_company_fit(self, traits: List[str], company_type: str) -> Dict:
        """
        기업 문화 적합도 분석
        """
        if company_type not in self.company_culture:
            return {'score': 0, 'details': '해당 기업 유형 정보 없음'}
        
        culture = self.company_culture[company_type]
        
        # 선호 특성 매칭
        preferred_match = len(set(traits) & set(culture['선호']))
        preferred_total = len(culture['선호'])
        preferred_score = preferred_match / preferred_total if preferred_total > 0 else 0
        
        # 비선호 특성 매칭 (있으면 감점)
        non_preferred_match = len(set(traits) & set(culture['비선호']))
        non_preferred_penalty = non_preferred_match * 0.15
        
        total_score = max(0, (preferred_score * 100) - (non_preferred_penalty * 100))
        
        return {
            'score': round(total_score, 1),
            'match_count': f"{preferred_match}/{preferred_total}",
            'matched_traits': list(set(traits) & set(culture['선호'])),
            'warning_traits': list(set(traits) & set(culture['비선호'])),
            'level': '우수' if total_score >= 70 else '양호' if total_score >= 50 else '저조'
        }

    def generate_report(self, candidate_name: str, resume_text: str, 
                       job_type: str = '풀스택_개발자', 
                       company_type: str = '중견기업') -> Dict:
        """
        종합 분석 리포트 생성
        """
        # 관상 특성 추출
        face_features = self.extract_face_features_from_resume(resume_text)
        
        # 성격 특성 도출
        traits = self.get_personality_traits(face_features)
        
        # 직무 적합도
        job_fit = self.calculate_job_fit(traits, job_type)
        
        # 기업 적합도
        company_fit = self.analyze_company_fit(traits, company_type)
        
        # 종합 평가
        overall_score = (job_fit['score'] * 0.6 + company_fit['score'] * 0.4)
        
        return {
            'candidate': candidate_name,
            'analysis_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'face_features': face_features,
            'personality_traits': traits,
            'job_fit': job_fit,
            'company_fit': company_fit,
            'overall_score': round(overall_score, 1),
            'overall_level': '우수' if overall_score >= 75 else '양호' if overall_score >= 60 else '보통' if overall_score >= 45 else '개선필요',
            'recommendation': self._get_recommendation(overall_score, traits, job_type),
            'strengths': self._get_strengths(traits, job_type),
            'weaknesses': self._get_weaknesses(traits, job_type)
        }

    def _get_recommendation(self, score: float, traits: List[str], job_type: str) -> str:
        """
        채용 추천 의견 생성
        """
        if score >= 75:
            return f"✅ 적극 추천 - 매우 우수한 관상/성격 특성을 보유. {job_type} 직무에 최적합."
        elif score >= 60:
            return f"👍 추천 - 좋은 관상/성격 특성을 보유. {job_type} 직무에 적합."
        elif score >= 45:
            return f"📌 검토 필요 - 일부 보완이 필요한 특성이 있으나 잠재력 높음."
        else:
            return f"⚠️ 재검토 권장 - 현재 직무와의 부합도가 낮음."

    def _get_strengths(self, traits: List[str], job_type: str) -> List[str]:
        """
        강점 분석
        """
        req = self.job_requirements.get(job_type, {'필수': [], '우대': []})
        return list(set(traits) & set(req['필수'] + req['우대']))

    def _get_weaknesses(self, traits: List[str], job_type: str) -> List[str]:
        """
        약점 분석
        """
        req = self.job_requirements.get(job_type, {'필수': [], '우대': []})
        all_req = set(req['필수'] + req['우대'])
        return list(all_req - set(traits))


def main():
    """
    메인 실행 함수 - 두 지원자 분석
    """
    analyzer = FaceReadingAnalyzer()
    
    # 지원자 데이터
    candidates = {
        '온석태': '''
        iOS 네이티브 개발 중심, 카메라, 스트리밍, 미디어 처리
        AVFoundation, RTMP, WebSocket, HLS
        2년 1개월 경력, 1인 개발 다수
        풀스택 기반 협업 경험
        ''',
        '전정현': '''
        웹디자이너 경력, 개발자 전향
        Spring Boot, Java, React, Node.js
        학원 프로젝트 다수, 신입
        농산물 추천, 회의록 자동화, 필라테스 예약 시스템
        '''
    }
    
    results = []
    
    for name, resume in candidates.items():
        # 직무와 기업 유형을 다르게 설정하여 비교
        if 'iOS' in resume or 'Swift' in resume:
            job = 'iOS_개발자'
            company = '미디어/콘텐츠'
        else:
            job = '백엔드_개발자'
            company = '중견기업'
            
        report = analyzer.generate_report(name, resume, job, company)
        results.append(report)
        
        # 분석 결과 출력
        print(f"\n{'='*60}")
        print(f"📊 관상 분석 리포트 - {name}")
        print(f"{'='*60}")
        print(f"📅 분석일: {report['analysis_date']}")
        print(f"\n👤 관상 특징:")
        for feature, value in report['face_features'].items():
            print(f"  • {feature}: {value}")
        
        print(f"\n🧠 도출된 성격 특성:")
        for trait in report['personality_traits']:
            print(f"  • {trait}")
        
        print(f"\n💼 직무 적합도 ({job})")
        print(f"  • 종합 점수: {report['job_fit']['score']}점")
        print(f"  • 필수 특성 매칭: {report['job_fit']['required_match']}")
        print(f"  • 우대 특성 매칭: {report['job_fit']['preferred_match']}")
        print(f"  • 매칭된 특성: {', '.join(report['job_fit']['matched_traits'])}")
        if report['job_fit']['missing_required']:
            print(f"  • 부족한 필수 특성: {', '.join(report['job_fit']['missing_required'])}")
        print(f"  • 수준: {report['job_fit']['level']}")
        
        print(f"\n🏢 기업 문화 적합도 ({company})")
        print(f"  • 종합 점수: {report['company_fit']['score']}점")
        print(f"  • 매칭된 선호 특성: {', '.join(report['company_fit']['matched_traits'])}")
        if report['company_fit']['warning_traits']:
            print(f"  • ⚠️ 비선호 특성: {', '.join(report['company_fit']['warning_traits'])}")
        print(f"  • 수준: {report['company_fit']['level']}")
        
        print(f"\n📈 종합 평가")
        print(f"  • 총점: {report['overall_score']}점")
        print(f"  • 종합 수준: {report['overall_level']}")
        print(f"  • 💬 {report['recommendation']}")
        
        print(f"\n💪 강점: {', '.join(report['strengths']) if report['strengths'] else '특별한 강점 없음'}")
        print(f"🔧 보완점: {', '.join(report['weaknesses']) if report['weaknesses'] else '없음'}")
        
    # 두 지원자 비교 분석
    print(f"\n{'='*60}")
    print("📊 지원자 비교 분석")
    print(f"{'='*60}")
    
    for result in results:
        print(f"\n👤 {result['candidate']}")
        print(f"  • 종합 점수: {result['overall_score']}점 ({result['overall_level']})")
        print(f"  • 직무 적합도: {result['job_fit']['score']}점")
        print(f"  • 기업 적합도: {result['company_fit']['score']}점")
    
    # 최종 추천
    best = max(results, key=lambda x: x['overall_score'])
    print(f"\n🏆 최종 추천: {best['candidate']}")
    print(f"   종합 점수: {best['overall_score']}점")
    print(f"   추천 의견: {best['recommendation']}")
    
    return results


if __name__ == "__main__":
    results = main()