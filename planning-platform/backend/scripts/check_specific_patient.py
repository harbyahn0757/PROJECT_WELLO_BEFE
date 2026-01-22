#!/usr/bin/env python3
"""
특정 환자의 검진 설계 데이터 확인
"""
import asyncio
import asyncpg
import json

async def check_patient():
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    uuid = "701c1959-d39b-452f-9f1e-ddcc9a483d29"
    hospital_id = "PEERNINE"
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        # 환자 ID 조회
        patient = await conn.fetchrow("""
            SELECT id, name FROM welno.welno_patients 
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient:
            print(f"❌ 환자를 찾을 수 없습니다: {uuid}")
            await conn.close()
            return
        
        print(f"✅ 환자: {patient['name']} (ID: {patient['id']})")
        print()
        
        # 검진 설계 요청 조회
        designs = await conn.fetch("""
            SELECT 
                id, status, 
                design_result IS NOT NULL as has_design_result,
                CASE 
                    WHEN design_result IS NOT NULL THEN 
                        jsonb_typeof(design_result)
                    ELSE NULL 
                END as design_result_type,
                created_at, updated_at
            FROM welno.welno_checkup_design_requests 
            WHERE uuid = $1 AND hospital_id = $2
            ORDER BY created_at DESC
        """, uuid, hospital_id)
        
        print(f"📋 검진 설계 요청: {len(designs)}건")
        print()
        
        for idx, design in enumerate(designs, 1):
            print(f"[{idx}] ID: {design['id']}")
            print(f"    상태: {design['status']}")
            print(f"    design_result 있음: {design['has_design_result']}")
            print(f"    design_result 타입: {design['design_result_type']}")
            print(f"    생성: {design['created_at']}")
            print(f"    수정: {design['updated_at']}")
            print()
        
        # 가장 최근 완료된 설계 상세 조회
        latest = await conn.fetchrow("""
            SELECT design_result
            FROM welno.welno_checkup_design_requests 
            WHERE uuid = $1 AND hospital_id = $2 
              AND status = 'step2_completed'
              AND design_result IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """, uuid, hospital_id)
        
        if latest and latest['design_result']:
            result = latest['design_result']
            if isinstance(result, str):
                result = json.loads(result)
            
            print("=" * 80)
            print("🎯 최신 완료된 설계 결과 구조:")
            print("=" * 80)
            print(f"최상위 키: {list(result.keys())}")
            print()
            
            # 주요 키 확인
            if 'priority_1' in result:
                p1 = result['priority_1']
                print(f"✅ priority_1: {p1.get('title', 'N/A')}")
                print(f"   항목 수: {len(p1.get('items', []))}")
            
            if 'priority_2' in result:
                p2 = result['priority_2']
                print(f"✅ priority_2: {p2.get('title', 'N/A')}")
                print(f"   항목 수: {len(p2.get('items', []))}")
            
            if 'priority_3' in result:
                p3 = result['priority_3']
                print(f"✅ priority_3: {p3.get('title', 'N/A')}")
                print(f"   항목 수: {len(p3.get('items', []))}")
            
            if 'strategies' in result:
                print(f"✅ strategies: {len(result['strategies'])}개")
            
            if 'recommended_items' in result:
                print(f"✅ recommended_items: {len(result['recommended_items'])}개 카테고리")
            
            print()
            print("🔍 'design_result' 키 존재 여부:")
            if 'design_result' in result:
                print(f"   ⚠️ 중첩된 'design_result' 키 발견!")
                print(f"   내용: {type(result['design_result'])}")
            else:
                print(f"   ✅ 중첩 없음 (정상)")
        else:
            print("❌ 완료된 설계 결과가 없습니다.")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_patient())
