"""
RAG 시스템 빠른 테스트 (5명, 각 2개 질문)
"""

import asyncio
import asyncpg
import json
from datetime import datetime
from typing import List, Dict, Any
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.checkup_design.rag_service import search_checkup_knowledge
from app.services.welno_data_service import WelnoDataService


async def get_test_patients(limit: int = 5) -> List[Dict]:
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
            p.birth_date,
            p.gender
        FROM welno.welno_patients p
        WHERE p.has_health_data = TRUE
        LIMIT $1
    """
    
    rows = await conn.fetch(query, limit)
    await conn.close()
    
    return [dict(row) for row in rows]


async def test_single_patient(patient: Dict, welno_service: WelnoDataService) -> List[Dict]:
    """단일 환자 테스트"""
    results = []
    
    print(f"\n{'='*60}")
    print(f"환자: {patient['name']}")
    print(f"{'='*60}")
    
    # 검진 데이터 조회
    full_data = await welno_service.get_patient_health_data(
        patient['uuid'], 
        patient['hospital_id']
    )
    
    health_data = full_data.get("health_data", [])
    if not health_data:
        print("⚠️ 검진 데이터 없음")
        return results
    
    latest = health_data[0]
    
    # 간단한 질문 2개만
    questions = [
        {
            "q": f"BMI {latest.get('bmi')}인 환자 관리 방법은?",
            "category": "BMI"
        },
        {
            "q": f"혈압 {latest.get('blood_pressure_high')}/{latest.get('blood_pressure_low')}mmHg 해석",
            "category": "혈압"
        }
    ]
    
    for q_data in questions:
        print(f"\n질문: {q_data['q']}")
        
        try:
            start = datetime.now()
            
            result = await search_checkup_knowledge(
                query=q_data['q'],
                use_local_vector_db=True
            )
            
            duration = (datetime.now() - start).total_seconds()
            
            answer = result.get("answer", "")
            sources = result.get("sources", [])
            
            print(f"✅ 응답 완료 ({duration:.1f}초)")
            print(f"   답변 길이: {len(answer)}자")
            print(f"   출처: {len(sources)}개")
            
            results.append({
                "patient": patient['name'],
                "question": q_data['q'],
                "category": q_data['category'],
                "answer": answer[:500],  # 500자만 저장
                "answer_length": len(answer),
                "sources_count": len(sources),
                "duration": duration,
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"❌ 오류: {e}")
            results.append({
                "patient": patient['name'],
                "question": q_data['q'],
                "error": str(e)
            })
    
    return results


async def main():
    """메인 실행"""
    print("🧪 RAG 빠른 테스트 시작")
    
    # 환자 조회
    patients = await get_test_patients(limit=5)
    print(f"📊 테스트 대상: {len(patients)}명")
    
    # 서비스 초기화
    welno_service = WelnoDataService()
    
    # 전체 결과
    all_results = []
    
    # 각 환자 테스트
    for patient in patients:
        patient_results = await test_single_patient(patient, welno_service)
        all_results.extend(patient_results)
    
    # 결과 저장
    log_file = f"/tmp/rag_quick_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(log_file, 'w', encoding='utf-8') as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "total_tests": len(all_results),
            "results": all_results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ 테스트 완료: {log_file}")
    print(f"{'='*60}")
    
    # 통계
    successful = [r for r in all_results if "error" not in r]
    if successful:
        avg_duration = sum(r['duration'] for r in successful) / len(successful)
        avg_length = sum(r['answer_length'] for r in successful) / len(successful)
        
        print(f"\n📊 통계:")
        print(f"   성공: {len(successful)}/{len(all_results)}개")
        print(f"   평균 응답시간: {avg_duration:.1f}초")
        print(f"   평균 답변길이: {avg_length:.0f}자")
    
    # 텍스트 로그도 생성
    text_log = log_file.replace('.json', '.txt')
    with open(text_log, 'w', encoding='utf-8') as f:
        f.write("RAG 빠른 테스트 결과\n")
        f.write("="*60 + "\n\n")
        
        for idx, r in enumerate(all_results, 1):
            if "error" in r:
                continue
            
            f.write(f"[테스트 {idx}]\n")
            f.write(f"환자: {r['patient']}\n")
            f.write(f"카테고리: {r['category']}\n")
            f.write(f"질문: {r['question']}\n")
            f.write(f"\n답변 (일부):\n{r['answer']}\n")
            f.write(f"\n응답시간: {r['duration']:.1f}초\n")
            f.write(f"출처: {r['sources_count']}개\n")
            f.write("-"*60 + "\n\n")
    
    print(f"✅ 텍스트 로그: {text_log}")


if __name__ == "__main__":
    asyncio.run(main())
