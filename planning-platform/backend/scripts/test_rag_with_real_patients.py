"""
RAG 시스템 실제 환자 데이터 테스트
- DB에서 검진 데이터가 있는 환자 조회
- 각 환자별 검진 데이터 기반 질문 생성
- RAG API 응답 테스트
- 로그 파일 저장
"""

import asyncio
import asyncpg
import json
from datetime import datetime
from typing import List, Dict, Any
import sys
import os

# 상위 디렉토리를 Python path에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.checkup_design.rag_service import search_checkup_knowledge
from app.services.welno_data_service import WelnoDataService


class RAGPatientTester:
    """실제 환자 데이터로 RAG 시스템 테스트"""
    
    def __init__(self):
        self.db_config = {
            "host": "10.0.1.10",
            "port": "5432",
            "database": "p9_mkt_biz",
            "user": "peernine",
            "password": "autumn3334!"
        }
        self.welno_service = WelnoDataService()
        self.test_results = []
        self.log_file = f"/tmp/rag_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
    async def get_patients_with_checkup_data(self, limit: int = 10) -> List[Dict[str, Any]]:
        """검진 데이터가 있는 환자 목록 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    p.uuid,
                    p.hospital_id,
                    p.name,
                    p.birth_date,
                    p.gender,
                    p.has_health_data,
                    p.has_prescription_data,
                    COUNT(c.id) as checkup_count
                FROM welno.welno_patients p
                LEFT JOIN welno.welno_checkup_data c 
                    ON p.uuid = c.patient_uuid AND p.hospital_id = c.hospital_id
                WHERE p.has_health_data = TRUE
                GROUP BY p.uuid, p.hospital_id, p.name, p.birth_date, p.gender, 
                         p.has_health_data, p.has_prescription_data
                HAVING COUNT(c.id) > 0
                ORDER BY COUNT(c.id) DESC
                LIMIT $1
            """
            
            rows = await conn.fetch(query, limit)
            await conn.close()
            
            patients = [dict(row) for row in rows]
            print(f"✅ 검진 데이터가 있는 환자 {len(patients)}명 조회 완료")
            
            return patients
            
        except Exception as e:
            print(f"❌ 환자 조회 실패: {e}")
            return []
    
    async def get_patient_checkup_summary(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 검진 데이터 요약"""
        try:
            full_data = await self.welno_service.get_patient_health_data(uuid, hospital_id)
            
            if "error" in full_data.get("patient", {}):
                return {"error": "환자 데이터 없음"}
            
            patient = full_data.get("patient", {})
            health_data_list = full_data.get("health_data", [])
            
            if not health_data_list:
                return {"error": "검진 데이터 없음"}
            
            # 최신 검진 데이터
            latest = health_data_list[0]
            
            summary = {
                "patient_name": patient.get("name", "Unknown"),
                "age": self._calculate_age(patient.get("birth_date")),
                "gender": "남성" if patient.get("gender") == "M" else "여성",
                "checkup_count": len(health_data_list),
                "latest_checkup": {
                    "year": latest.get("year"),
                    "date": latest.get("checkup_date"),
                    "bmi": latest.get("bmi"),
                    "blood_pressure": f"{latest.get('blood_pressure_high')}/{latest.get('blood_pressure_low')}",
                    "blood_sugar": latest.get("blood_sugar"),
                    "cholesterol": latest.get("cholesterol"),
                    "hdl": latest.get("hdl_cholesterol"),
                    "ldl": latest.get("ldl_cholesterol"),
                    "triglyceride": latest.get("triglyceride"),
                    "hemoglobin": latest.get("hemoglobin"),
                    "height": latest.get("height"),
                    "weight": latest.get("weight")
                }
            }
            
            return summary
            
        except Exception as e:
            print(f"❌ 검진 데이터 요약 실패: {e}")
            return {"error": str(e)}
    
    def _calculate_age(self, birth_date) -> int:
        """나이 계산"""
        if not birth_date:
            return 0
        
        if isinstance(birth_date, str):
            from datetime import datetime
            birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
        else:
            birth = birth_date
        
        today = datetime.now().date()
        return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    
    def generate_test_questions(self, summary: Dict[str, Any]) -> List[Dict[str, str]]:
        """검진 데이터 기반 테스트 질문 생성"""
        latest = summary.get("latest_checkup", {})
        questions = []
        
        # 1. BMI 관련 질문
        bmi = latest.get("bmi")
        if bmi:
            if bmi >= 25:
                questions.append({
                    "category": "비만",
                    "question": f"BMI가 {bmi}인데 어떻게 관리해야 하나요?",
                    "context": f"환자: {summary['patient_name']}, BMI: {bmi}"
                })
        
        # 2. 혈압 관련 질문
        bp_high = latest.get("blood_pressure", "").split("/")[0]
        if bp_high and bp_high != "None":
            try:
                bp_val = int(bp_high)
                if bp_val >= 140:
                    questions.append({
                        "category": "고혈압",
                        "question": f"혈압이 {latest['blood_pressure']}mmHg인데 위험한가요?",
                        "context": f"환자: {summary['patient_name']}, 혈압: {latest['blood_pressure']}"
                    })
            except:
                pass
        
        # 3. 혈당 관련 질문
        blood_sugar = latest.get("blood_sugar")
        if blood_sugar and blood_sugar >= 100:
            questions.append({
                "category": "혈당",
                "question": f"공복혈당이 {blood_sugar}mg/dL인데 당뇨 위험이 있나요?",
                "context": f"환자: {summary['patient_name']}, 공복혈당: {blood_sugar}"
            })
        
        # 4. 콜레스테롤 관련 질문
        cholesterol = latest.get("cholesterol")
        ldl = latest.get("ldl")
        if cholesterol and cholesterol >= 200:
            questions.append({
                "category": "콜레스테롤",
                "question": f"총 콜레스테롤이 {cholesterol}mg/dL인데 관리 방법을 알려주세요",
                "context": f"환자: {summary['patient_name']}, 총콜레스테롤: {cholesterol}, LDL: {ldl}"
            })
        
        # 5. 종합 건강 상담 질문
        questions.append({
            "category": "종합",
            "question": f"{summary['age']}세 {summary['gender']} 건강검진 결과 어떻게 해석하면 되나요?",
            "context": f"환자: {summary['patient_name']}, 나이: {summary['age']}, 성별: {summary['gender']}"
        })
        
        # 6. 맞춤형 검사 추천
        questions.append({
            "category": "검사추천",
            "question": "제 건강 상태를 고려할 때 추가로 받아야 할 검사가 있나요?",
            "context": f"환자 상태: BMI {bmi}, 혈압 {latest['blood_pressure']}, 혈당 {blood_sugar}"
        })
        
        return questions
    
    async def test_rag_with_question(
        self, 
        patient_uuid: str,
        hospital_id: str,
        summary: Dict[str, Any],
        question_data: Dict[str, str]
    ) -> Dict[str, Any]:
        """RAG API로 질문 테스트"""
        try:
            print(f"\n📝 질문 [{question_data['category']}]: {question_data['question']}")
            
            # RAG 검색 실행
            start_time = datetime.now()
            
            result = await search_checkup_knowledge(
                query=question_data['question'],
                use_local_vector_db=True
            )
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            if not result.get("success"):
                print(f"❌ RAG 검색 실패")
                return {
                    "success": False,
                    "error": "RAG 검색 실패",
                    "duration": duration
                }
            
            answer = result.get("answer", "")
            sources = result.get("sources", [])
            
            print(f"✅ 응답 생성 완료 ({duration:.2f}초)")
            print(f"📄 답변 (첫 200자): {answer[:200]}...")
            print(f"📚 출처: {len(sources)}개")
            
            # 답변 품질 분석
            quality_score = self._analyze_answer_quality(
                question=question_data['question'],
                answer=answer,
                sources=sources,
                patient_context=question_data['context']
            )
            
            return {
                "success": True,
                "patient_uuid": patient_uuid,
                "hospital_id": hospital_id,
                "patient_name": summary['patient_name'],
                "patient_age": summary['age'],
                "patient_gender": summary['gender'],
                "question_category": question_data['category'],
                "question": question_data['question'],
                "context": question_data['context'],
                "answer": answer,
                "answer_length": len(answer),
                "sources_count": len(sources),
                "sources": [
                    {
                        "text": s.get("text", "")[:200],
                        "score": s.get("score", 0),
                        "metadata": s.get("metadata", {})
                    }
                    for s in sources[:3]  # 상위 3개만
                ],
                "duration_seconds": duration,
                "quality_score": quality_score,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ 테스트 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "question": question_data['question']
            }
    
    def _analyze_answer_quality(
        self, 
        question: str, 
        answer: str, 
        sources: List[Dict], 
        patient_context: str
    ) -> Dict[str, Any]:
        """답변 품질 분석"""
        score = {
            "total": 0,
            "length_ok": False,
            "has_sources": False,
            "relevant": False,
            "specific": False
        }
        
        # 1. 답변 길이 체크 (최소 100자)
        if len(answer) >= 100:
            score["length_ok"] = True
            score["total"] += 25
        
        # 2. 출처 있는지 체크
        if len(sources) > 0:
            score["has_sources"] = True
            score["total"] += 25
        
        # 3. 관련성 체크 (키워드 매칭)
        keywords = self._extract_keywords(question)
        if any(kw in answer for kw in keywords):
            score["relevant"] = True
            score["total"] += 25
        
        # 4. 구체성 체크 (수치, 기준 포함 여부)
        if any(char.isdigit() for char in answer):
            score["specific"] = True
            score["total"] += 25
        
        return score
    
    def _extract_keywords(self, question: str) -> List[str]:
        """질문에서 키워드 추출"""
        keywords = []
        
        health_terms = ["BMI", "혈압", "혈당", "콜레스테롤", "비만", "고혈압", "당뇨", "검사", "관리"]
        
        for term in health_terms:
            if term in question:
                keywords.append(term)
        
        return keywords
    
    async def run_tests(self, max_patients: int = 10):
        """전체 테스트 실행"""
        print("=" * 80)
        print("🧪 RAG 시스템 실제 환자 데이터 테스트 시작")
        print("=" * 80)
        
        # 1. 환자 조회
        patients = await self.get_patients_with_checkup_data(limit=max_patients)
        
        if not patients:
            print("❌ 테스트할 환자 데이터가 없습니다")
            return
        
        print(f"\n📊 총 {len(patients)}명의 환자 데이터로 테스트 진행")
        
        # 2. 각 환자별 테스트
        for idx, patient in enumerate(patients, 1):
            print("\n" + "=" * 80)
            print(f"👤 환자 {idx}/{len(patients)}: {patient['name']} (검진 {patient['checkup_count']}회)")
            print("=" * 80)
            
            # 검진 데이터 요약
            summary = await self.get_patient_checkup_summary(
                patient['uuid'], 
                patient['hospital_id']
            )
            
            if "error" in summary:
                print(f"⚠️ 검진 데이터 없음: {summary['error']}")
                continue
            
            print(f"📋 최신 검진: {summary['latest_checkup']['year']} {summary['latest_checkup']['date']}")
            print(f"   - BMI: {summary['latest_checkup']['bmi']}")
            print(f"   - 혈압: {summary['latest_checkup']['blood_pressure']} mmHg")
            print(f"   - 혈당: {summary['latest_checkup']['blood_sugar']} mg/dL")
            
            # 테스트 질문 생성
            questions = self.generate_test_questions(summary)
            print(f"\n📝 생성된 질문: {len(questions)}개")
            
            # 각 질문별 RAG 테스트
            for q_idx, question_data in enumerate(questions, 1):
                print(f"\n--- 질문 {q_idx}/{len(questions)} ---")
                
                result = await self.test_rag_with_question(
                    patient['uuid'],
                    patient['hospital_id'],
                    summary,
                    question_data
                )
                
                self.test_results.append(result)
                
                # 짧은 대기 (API 부하 방지)
                await asyncio.sleep(1)
        
        # 3. 결과 저장
        await self.save_results()
        
        # 4. 통계 출력
        self.print_statistics()
    
    async def save_results(self):
        """테스트 결과 저장"""
        try:
            result_data = {
                "test_date": datetime.now().isoformat(),
                "total_tests": len(self.test_results),
                "results": self.test_results
            }
            
            with open(self.log_file, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, ensure_ascii=False, indent=2)
            
            print(f"\n✅ 테스트 결과 저장: {self.log_file}")
            
            # 추가로 가독성 좋은 텍스트 로그도 생성
            text_log = self.log_file.replace('.json', '.txt')
            with open(text_log, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("RAG 시스템 테스트 결과\n")
                f.write("=" * 80 + "\n\n")
                
                for idx, result in enumerate(self.test_results, 1):
                    if not result.get("success"):
                        continue
                    
                    f.write(f"\n[테스트 {idx}]\n")
                    f.write(f"환자: {result['patient_name']} ({result['patient_age']}세, {result['patient_gender']})\n")
                    f.write(f"카테고리: {result['question_category']}\n")
                    f.write(f"질문: {result['question']}\n")
                    f.write(f"컨텍스트: {result['context']}\n")
                    f.write(f"\n[답변]\n{result['answer']}\n")
                    f.write(f"\n출처: {result['sources_count']}개\n")
                    f.write(f"응답시간: {result['duration_seconds']:.2f}초\n")
                    f.write(f"품질점수: {result['quality_score']['total']}/100\n")
                    f.write("-" * 80 + "\n")
            
            print(f"✅ 텍스트 로그 저장: {text_log}")
            
        except Exception as e:
            print(f"❌ 결과 저장 실패: {e}")
    
    def print_statistics(self):
        """테스트 통계 출력"""
        print("\n" + "=" * 80)
        print("📊 테스트 통계")
        print("=" * 80)
        
        total = len(self.test_results)
        successful = len([r for r in self.test_results if r.get("success")])
        failed = total - successful
        
        print(f"총 테스트: {total}개")
        print(f"성공: {successful}개")
        print(f"실패: {failed}개")
        
        if successful > 0:
            # 평균 응답 시간
            avg_duration = sum(
                r.get("duration_seconds", 0) 
                for r in self.test_results if r.get("success")
            ) / successful
            
            # 평균 품질 점수
            avg_quality = sum(
                r.get("quality_score", {}).get("total", 0)
                for r in self.test_results if r.get("success")
            ) / successful
            
            # 평균 출처 개수
            avg_sources = sum(
                r.get("sources_count", 0)
                for r in self.test_results if r.get("success")
            ) / successful
            
            print(f"\n평균 응답 시간: {avg_duration:.2f}초")
            print(f"평균 품질 점수: {avg_quality:.1f}/100")
            print(f"평균 출처 개수: {avg_sources:.1f}개")
            
            # 카테고리별 통계
            categories = {}
            for r in self.test_results:
                if not r.get("success"):
                    continue
                cat = r.get("question_category", "Unknown")
                if cat not in categories:
                    categories[cat] = []
                categories[cat].append(r.get("quality_score", {}).get("total", 0))
            
            print("\n카테고리별 품질:")
            for cat, scores in categories.items():
                avg = sum(scores) / len(scores)
                print(f"  - {cat}: {avg:.1f}/100 ({len(scores)}개)")


async def main():
    """메인 실행 함수"""
    tester = RAGPatientTester()
    
    # 최대 10명의 환자로 테스트 (조정 가능)
    await tester.run_tests(max_patients=10)


if __name__ == "__main__":
    asyncio.run(main())
