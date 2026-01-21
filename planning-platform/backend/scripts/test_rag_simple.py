"""
RAG API 간단 테스트 (HTTP 요청)
"""

import asyncio
import asyncpg
import aiohttp
import json
from datetime import datetime
from typing import List, Dict


async def get_patients_with_data(limit: int = 3) -> List[Dict]:
    """검진 데이터가 있는 환자 조회"""
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
            c.bmi,
            c.blood_pressure_high,
            c.blood_pressure_low,
            c.blood_sugar,
            c.cholesterol
        FROM welno.welno_patients p
        JOIN welno.welno_checkup_data c 
            ON p.uuid = c.patient_uuid AND p.hospital_id = c.hospital_id
        WHERE p.has_health_data = TRUE
        LIMIT $1
    """
    
    rows = await conn.fetch(query, limit)
    await conn.close()
    
    return [dict(row) for row in rows]


async def test_rag_api(question: str) -> Dict:
    """RAG API 테스트"""
    url = "http://localhost:8082/api/v1/rag/test"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, params={"q": question}, timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {"error": f"HTTP {response.status}"}
        except asyncio.TimeoutError:
            return {"error": "Timeout"}
        except Exception as e:
            return {"error": str(e)}


async def main():
    """메인 실행"""
    print("🧪 RAG API 간단 테스트\n")
    
    # 환자 조회
    print("1️⃣ DB에서 검진 데이터 조회...")
    patients = await get_patients_with_data(limit=3)
    print(f"   ✅ {len(patients)}명의 환자 데이터 조회 완료\n")
    
    results = []
    
    # 각 환자별 테스트
    for idx, patient in enumerate(patients, 1):
        print(f"{'='*70}")
        print(f"환자 {idx}: {patient['name']}")
        print(f"{'='*70}")
        
        # 검진 데이터 출력
        print(f"검진 데이터:")
        print(f"  - BMI: {patient['bmi']}")
        print(f"  - 혈압: {patient['blood_pressure_high']}/{patient['blood_pressure_low']} mmHg")
        print(f"  - 혈당: {patient['blood_sugar']} mg/dL")
        print(f"  - 콜레스테롤: {patient['cholesterol']} mg/dL")
        
        # 질문 생성 (간단히 1개만)
        question = f"BMI {patient['bmi']}, 혈압 {patient['blood_pressure_high']}/{patient['blood_pressure_low']}인 환자 관리 방법"
        
        print(f"\n질문: {question}")
        print(f"요청 중...")
        
        # API 호출
        start = datetime.now()
        result = await test_rag_api(question)
        duration = (datetime.now() - start).total_seconds()
        
        if "error" in result:
            print(f"❌ 오류: {result['error']}\n")
            results.append({
                "patient": patient['name'],
                "question": question,
                "error": result['error'],
                "duration": duration
            })
        else:
            answer = result.get("context_text", "")
            sources = result.get("structured_evidences", [])
            
            print(f"✅ 응답 완료 ({duration:.1f}초)")
            print(f"   답변 길이: {len(answer)}자")
            print(f"   출처: {len(sources)}개")
            print(f"\n답변 미리보기:")
            print(f"   {answer[:200]}...\n")
            
            results.append({
                "patient": patient['name'],
                "bmi": float(patient['bmi']) if patient['bmi'] else None,
                "blood_pressure": f"{patient['blood_pressure_high']}/{patient['blood_pressure_low']}",
                "question": question,
                "answer": answer,
                "answer_length": len(answer),
                "sources_count": len(sources),
                "sources": [
                    {
                        "document": s.get("source_document", "Unknown"),
                        "score": s.get("confidence_score", 0),
                        "citation": s.get("citation", "")[:100]
                    }
                    for s in sources[:3]
                ],
                "duration": duration,
                "timestamp": datetime.now().isoformat()
            })
    
    # 결과 저장
    log_file = f"/tmp/rag_api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(log_file, 'w', encoding='utf-8') as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "total_tests": len(results),
            "results": results
        }, f, ensure_ascii=False, indent=2)
    
    # 텍스트 로그
    text_log = log_file.replace('.json', '.txt')
    with open(text_log, 'w', encoding='utf-8') as f:
        f.write("RAG API 테스트 결과\n")
        f.write("="*70 + "\n\n")
        
        for idx, r in enumerate(results, 1):
            f.write(f"[테스트 {idx}] {r['patient']}\n")
            f.write(f"검진 데이터: BMI {r.get('bmi')}, 혈압 {r.get('blood_pressure')}\n")
            f.write(f"질문: {r['question']}\n")
            
            if "error" in r:
                f.write(f"오류: {r['error']}\n")
            else:
                f.write(f"\n답변:\n{r['answer']}\n")
                f.write(f"\n출처 ({r['sources_count']}개):\n")
                for s in r.get('sources', []):
                    f.write(f"  - {s['document']} (신뢰도: {s['score']:.2f})\n")
                f.write(f"\n응답시간: {r['duration']:.1f}초\n")
            
            f.write("\n" + "-"*70 + "\n\n")
    
    print(f"\n{'='*70}")
    print(f"✅ 테스트 완료!")
    print(f"{'='*70}")
    print(f"📄 JSON 로그: {log_file}")
    print(f"📄 텍스트 로그: {text_log}")
    
    # 통계
    successful = [r for r in results if "error" not in r]
    if successful:
        avg_duration = sum(r['duration'] for r in successful) / len(successful)
        avg_length = sum(r['answer_length'] for r in successful) / len(successful)
        
        print(f"\n📊 통계:")
        print(f"   총 테스트: {len(results)}개")
        print(f"   성공: {len(successful)}개")
        print(f"   평균 응답시간: {avg_duration:.1f}초")
        print(f"   평균 답변길이: {avg_length:.0f}자")


if __name__ == "__main__":
    asyncio.run(main())
