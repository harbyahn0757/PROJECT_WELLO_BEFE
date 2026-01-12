import asyncio
import asyncpg
import json

async def main():
    db_config = {
        "host": "10.0.1.10",
        "port": "5432", 
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    conn = await asyncpg.connect(**db_config)
    
    # 1. 환자 정보
    patient = await conn.fetchrow("SELECT * FROM welno.welno_patients WHERE name = '안광수'")
    if not patient:
        print("안광수 환자를 찾을 수 없습니다.")
        await conn.close()
        return
    
    print(f"환자 정보: UUID={patient['uuid']}, ID={patient['id']}")
    
    # 2. 검진 데이터 중 '암' 키워드 확인
    checkups = await conn.fetch("SELECT * FROM welno.welno_checkup_data WHERE patient_uuid = $1", patient['uuid'])
    print(f"검진 데이터: {len(checkups)}건")
    for c in checkups:
        if '암' in (c['description'] or '') or '암' in (c['raw_data'] or ''):
            print(f" - [검진] 암 관련 키워드 발견: {c['year']} {c['location']}")
            
    # 3. 처방전 데이터
    prescriptions = await conn.fetch("SELECT * FROM welno.welno_prescription_data WHERE patient_uuid = $1", patient['uuid'])
    print(f"처방전 데이터: {len(prescriptions)}건")
    
    # 4. 문진/설계 요청 데이터
    requests = await conn.fetch("SELECT * FROM welno.welno_checkup_design_requests WHERE patient_id = $1", patient['id'])
    print(f"문진 요청 데이터: {len(requests)}건")
    for r in requests:
        if r['design_result']:
            result = json.loads(r['design_result'])
            if '암' in str(result):
                print(f" - [문진] 암 관련 결과 발견: {r['created_at']}")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
