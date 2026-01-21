"""
실제 검진 수치가 있는 환자 RAG 테스트
"""

import asyncio
import asyncpg
import aiohttp
import json
from datetime import datetime
from typing import List, Dict


async def get_patients_with_real_values(limit: int = 5) -> List[Dict]:
    """실제 검진 수치가 있는 환자 조회"""
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    conn = await asyncpg.connect(**db_config)
    
    query = """
        SELECT 
            p.uuid,
            p.hospital_id,
            p.name,
            p.birth_date,
            p.gender,
            c.year,
            c.bmi,
            c.blood_pressure_high,
            c.blood_pressure_low,
            c.blood_sugar,
            c.cholesterol,
            c.ldl_cholesterol,
            c.triglyceride
        FROM welno.welno_patients p
        JOIN welno.welno_checkup_data c 
            ON p.uuid = c.patient_uuid AND p.hospital_id = c.hospital_id
        WHERE p.has_health_data = TRUE
          AND c.bmi IS NOT NULL
          AND c.blood_pressure_high IS NOT NULL
        LIMIT $1
    """
    
    rows = await conn.fetch(query, limit)
    await conn.close()
    
    return [dict(row) for row in rows]


async def test_rag_api(question: str, timeout: int = 90) -> Dict:
    """RAG API 테스트"""
    url = "http://localhost:8082/api/v1/rag/test"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(
                url, 
                params={"q": question}, 
                timeout=aiohttp.ClientTimeout(total=timeout)
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {"error": f"HTTP {response.status}"}
        except asyncio.TimeoutError:
            return {"error": "Timeout"}
        except Exception as e:
            return {"error": str(e)}


def generate_specific_questions(patient: Dict) -> List[Dict]:
    """환자별 맞춤 질문 생성"""
    questions = []
    
    bmi = patient.get('bmi')
    bp_high = patient.get('blood_pressure_high')
    bp_low = patient.get('blood_pressure_low')
    blood_sugar = patient.get('blood_sugar')
    cholesterol = patient.get('cholesterol')
    
    # 1. BMI 관련
    if bmi:
        if bmi >= 25:
            questions.append({
                "category": "비만관리",
                "q": f"{patient['name']} 환자 BMI {bmi}로 비만인데 어떻게 관리해야 하나요?",
                "expected_keywords": ["체중", "감량", "운동", "식단"]
            })
        elif bmi >= 23:
            questions.append({
                "category": "과체중관리",
                "q": f"BMI {bmi}인 경우 정상 체중으로 돌아가는 방법은?",
                "expected_keywords": ["체중", "관리", "운동"]
            })
    
    # 2. 혈압 관련
    if bp_high and bp_low:
        if bp_high >= 140 or bp_low >= 90:
            questions.append({
                "category": "고혈압",
                "q": f"혈압 {bp_high}/{bp_low}mmHg인데 약 먹어야 하나요?",
                "expected_keywords": ["혈압", "고혈압", "약물", "치료"]
            })
        elif bp_high >= 120:
            questions.append({
                "category": "혈압주의",
                "q": f"혈압 {bp_high}/{bp_low}는 정상인가요?",
                "expected_keywords": ["혈압", "정상", "주의"]
            })
    
    # 3. 혈당 관련
    if blood_sugar:
        if blood_sugar >= 126:
            questions.append({
                "category": "당뇨",
                "q": f"공복혈당 {blood_sugar}mg/dL인데 당뇨병인가요?",
                "expected_keywords": ["당뇨", "혈당", "관리"]
            })
        elif blood_sugar >= 100:
            questions.append({
                "category": "혈당주의",
                "q": f"공복혈당 {blood_sugar}는 당뇨 전단계인가요?",
                "expected_keywords": ["혈당", "전단계", "주의"]
            })
    
    # 4. 콜레스테롤
    if cholesterol and cholesterol >= 200:
        questions.append({
            "category": "콜레스테롤",
            "q": f"총 콜레스테롤 {cholesterol}mg/dL은 높은 편인가요?",
            "expected_keywords": ["콜레스테롤", "높음", "관리"]
        })
    
    # 5. 종합 질문
    if patient.get('birth_date'):
        age = datetime.now().year - patient['birth_date'].year
    else:
        age = 40  # 기본값
    
    questions.append({
        "category": "종합상담",
        "q": f"{age}세 {'남성' if patient.get('gender')=='M' else '여성'}, BMI {bmi}, 혈압 {bp_high}/{bp_low}, 혈당 {blood_sugar} - 건강 상태 평가 부탁드립니다",
        "expected_keywords": ["건강", "관리", "위험"]
    })
    
    return questions[:3]  # 최대 3개


def evaluate_answer(answer: str, expected_keywords: List[str]) -> Dict:
    """답변 품질 평가"""
    score = {
        "keyword_match": 0,
        "length_ok": len(answer) >= 300,
        "has_numbers": any(c.isdigit() for c in answer),
        "has_specific_advice": any(word in answer for word in ["권고", "추천", "필요", "관리", "치료"])
    }
    
    # 키워드 매칭
    matched = sum(1 for kw in expected_keywords if kw in answer)
    score["keyword_match"] = matched
    score["keyword_ratio"] = matched / len(expected_keywords) if expected_keywords else 0
    
    # 총점 (100점 만점)
    total = 0
    total += min(50, score["keyword_match"] * 15)  # 키워드당 15점, 최대 50점
    total += 20 if score["length_ok"] else 0
    total += 15 if score["has_numbers"] else 0
    total += 15 if score["has_specific_advice"] else 0
    
    score["total"] = total
    score["grade"] = "우수" if total >= 80 else "양호" if total >= 60 else "보통" if total >= 40 else "미흡"
    
    return score


async def main():
    """메인 실행"""
    print("="*80)
    print("🧪 RAG 시스템 실제 검진 데이터 테스트")
    print("="*80 + "\n")
    
    # 환자 조회
    print("1️⃣ 실제 검진 수치가 있는 환자 조회...")
    patients = await get_patients_with_real_values(limit=5)
    print(f"   ✅ {len(patients)}명의 환자 조회 완료\n")
    
    results = []
    total_questions = 0
    
    # 각 환자별 테스트
    for p_idx, patient in enumerate(patients, 1):
        print(f"\n{'='*80}")
        print(f"👤 환자 {p_idx}/{len(patients)}: {patient['name']}")
        print(f"{'='*80}")
        
        # 검진 데이터 출력
        if patient.get('birth_date'):
            age = datetime.now().year - patient['birth_date'].year
        else:
            age = 0
        print(f"기본정보: {age}세, {'남성' if patient.get('gender')=='M' else '여성'}, 검진년도: {patient['year']}")
        print(f"검진수치:")
        print(f"  - BMI: {patient['bmi']}")
        print(f"  - 혈압: {patient['blood_pressure_high']}/{patient['blood_pressure_low']} mmHg")
        print(f"  - 공복혈당: {patient['blood_sugar']} mg/dL")
        print(f"  - 총콜레스테롤: {patient['cholesterol']} mg/dL")
        print(f"  - LDL콜레스테롤: {patient['ldl_cholesterol']} mg/dL")
        print(f"  - 중성지방: {patient['triglyceride']} mg/dL")
        
        # 질문 생성
        questions = generate_specific_questions(patient)
        print(f"\n생성된 질문: {len(questions)}개")
        
        # 각 질문 테스트
        for q_idx, q_data in enumerate(questions, 1):
            total_questions += 1
            print(f"\n--- 질문 {q_idx}/{len(questions)} [{q_data['category']}] ---")
            print(f"❓ {q_data['q']}")
            
            # API 호출
            start = datetime.now()
            result = await test_rag_api(q_data['q'], timeout=90)
            duration = (datetime.now() - start).total_seconds()
            
            if "error" in result:
                print(f"❌ 오류: {result['error']} ({duration:.1f}초)")
                results.append({
                    "patient": patient['name'],
                    "age": age,
                    "category": q_data['category'],
                    "question": q_data['q'],
                    "error": result['error'],
                    "duration": duration
                })
            else:
                answer = result.get("context_text", "")
                sources = result.get("structured_evidences", [])
                
                # 답변 평가
                evaluation = evaluate_answer(answer, q_data['expected_keywords'])
                
                print(f"✅ 응답 완료 ({duration:.1f}초)")
                print(f"   답변 길이: {len(answer)}자")
                print(f"   출처: {len(sources)}개")
                print(f"   평가 점수: {evaluation['total']}/100 ({evaluation['grade']})")
                print(f"   키워드 매칭: {evaluation['keyword_match']}/{len(q_data['expected_keywords'])}")
                
                results.append({
                    "patient": patient['name'],
                    "age": age,
                    "gender": "남성" if patient.get('gender')=='M' else "여성",
                    "checkup_data": {
                        "bmi": float(patient['bmi']) if patient['bmi'] else None,
                        "blood_pressure": f"{patient['blood_pressure_high']}/{patient['blood_pressure_low']}",
                        "blood_sugar": int(patient['blood_sugar']) if patient['blood_sugar'] else None,
                        "cholesterol": int(patient['cholesterol']) if patient['cholesterol'] else None
                    },
                    "category": q_data['category'],
                    "question": q_data['q'],
                    "expected_keywords": q_data['expected_keywords'],
                    "answer": answer,
                    "answer_preview": answer[:300],
                    "answer_length": len(answer),
                    "sources_count": len(sources),
                    "top_sources": [
                        {
                            "document": s.get("source_document", "Unknown"),
                            "relevance": s.get("relevance", "Unknown"),
                            "score": s.get("confidence_score", 0)
                        }
                        for s in sources[:3]
                    ],
                    "evaluation": evaluation,
                    "duration": duration,
                    "timestamp": datetime.now().isoformat()
                })
                
                # 짧게 대기
                await asyncio.sleep(2)
    
    # 결과 저장
    log_file = f"/tmp/rag_real_data_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(log_file, 'w', encoding='utf-8') as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "total_patients": len(patients),
            "total_questions": total_questions,
            "results": results
        }, f, ensure_ascii=False, indent=2)
    
    # 텍스트 로그
    text_log = log_file.replace('.json', '.txt')
    with open(text_log, 'w', encoding='utf-8') as f:
        f.write("RAG 시스템 실제 검진 데이터 테스트 결과\n")
        f.write("="*80 + "\n\n")
        
        for idx, r in enumerate(results, 1):
            f.write(f"\n[테스트 {idx}]\n")
            f.write(f"환자: {r['patient']} ({r.get('age')}세, {r.get('gender')})\n")
            
            if "checkup_data" in r:
                f.write(f"검진데이터: BMI {r['checkup_data']['bmi']}, ")
                f.write(f"혈압 {r['checkup_data']['blood_pressure']}, ")
                f.write(f"혈당 {r['checkup_data']['blood_sugar']}, ")
                f.write(f"콜레스테롤 {r['checkup_data']['cholesterol']}\n")
            
            f.write(f"카테고리: {r['category']}\n")
            f.write(f"질문: {r['question']}\n")
            
            if "error" in r:
                f.write(f"\n❌ 오류: {r['error']}\n")
            else:
                f.write(f"\n✅ 답변:\n{r['answer']}\n")
                f.write(f"\n📊 평가:\n")
                f.write(f"  점수: {r['evaluation']['total']}/100 ({r['evaluation']['grade']})\n")
                f.write(f"  키워드 매칭: {r['evaluation']['keyword_match']}/{len(r.get('expected_keywords', []))}\n")
                f.write(f"  출처: {r['sources_count']}개\n")
                
                for s in r.get('top_sources', []):
                    f.write(f"    - {s['document']} (관련도: {s['relevance']}, 점수: {s['score']:.2f})\n")
                
                f.write(f"  응답시간: {r['duration']:.1f}초\n")
            
            f.write("\n" + "-"*80 + "\n")
    
    print(f"\n\n{'='*80}")
    print(f"✅ 테스트 완료!")
    print(f"{'='*80}")
    print(f"📄 JSON 로그: {log_file}")
    print(f"📄 텍스트 로그: {text_log}")
    
    # 통계
    successful = [r for r in results if "error" not in r]
    if successful:
        avg_duration = sum(r['duration'] for r in successful) / len(successful)
        avg_length = sum(r['answer_length'] for r in successful) / len(successful)
        avg_score = sum(r['evaluation']['total'] for r in successful) / len(successful)
        
        grade_dist = {}
        for r in successful:
            grade = r['evaluation']['grade']
            grade_dist[grade] = grade_dist.get(grade, 0) + 1
        
        print(f"\n📊 통계:")
        print(f"   총 테스트: {len(results)}개")
        print(f"   성공: {len(successful)}개")
        print(f"   실패: {len(results) - len(successful)}개")
        print(f"   평균 응답시간: {avg_duration:.1f}초")
        print(f"   평균 답변길이: {avg_length:.0f}자")
        print(f"   평균 평가점수: {avg_score:.1f}/100")
        print(f"\n   등급 분포:")
        for grade, count in sorted(grade_dist.items(), key=lambda x: -x[1]):
            print(f"     - {grade}: {count}개")


if __name__ == "__main__":
    asyncio.run(main())
