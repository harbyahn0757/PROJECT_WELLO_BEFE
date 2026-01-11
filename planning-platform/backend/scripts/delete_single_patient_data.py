#!/usr/bin/env python3
"""
단일 환자의 건강데이터 삭제 스크립트
"""
import asyncio
import asyncpg

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def delete_patient_data(uuid: str, hospital_id: str):
    """특정 환자의 건강데이터 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("="*100)
        print(f"환자 건강데이터 삭제")
        print(f"UUID: {uuid}")
        print(f"Hospital ID: {hospital_id}")
        print("="*100)
        print()
        
        # 삭제 전 데이터 확인
        health_count_before = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        prescription_count_before = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print(f"📊 삭제 전 데이터 현황:")
        print(f"  - 건강검진 데이터: {health_count_before}건")
        print(f"  - 처방전 데이터: {prescription_count_before}건")
        print()
        
        # 트랜잭션 시작
        async with conn.transaction():
            # 건강검진 데이터 삭제
            if health_count_before > 0:
                await conn.execute(
                    "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 건강검진 데이터 삭제 완료: {health_count_before}건")
            
            # 처방전 데이터 삭제
            if prescription_count_before > 0:
                await conn.execute(
                    "DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 처방전 데이터 삭제 완료: {prescription_count_before}건")
            
            # 환자 정보 플래그 업데이트
            await conn.execute(
                """UPDATE welno.welno_patients 
                   SET has_health_data = FALSE,
                       has_prescription_data = FALSE,
                       last_data_update = NULL 
                   WHERE uuid = $1 AND hospital_id = $2""",
                uuid, hospital_id
            )
            print(f"✅ 환자 정보 플래그 업데이트 완료")
        
        # 삭제 후 확인
        health_count_after = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        prescription_count_after = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        patient_info = await conn.fetchrow(
            "SELECT has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print()
        print("="*100)
        print(f"📋 삭제 후 데이터 현황:")
        print(f"  - 건강검진 데이터: {health_count_after}건")
        print(f"  - 처방전 데이터: {prescription_count_after}건")
        print(f"  - has_health_data: {patient_info['has_health_data']}")
        print(f"  - has_prescription_data: {patient_info['has_prescription_data']}")
        print("="*100)
        
        if health_count_after == 0 and prescription_count_after == 0:
            print("✅ 건강데이터 삭제 완료!")
        else:
            print("⚠️ 일부 데이터가 남아있습니다.")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 삭제할 환자 정보
    UUID = "e3471a9a-2d67-4a23-8599-849963397d1c"
    HOSPITAL_ID = "KIM_HW_CLINIC"
    
    asyncio.run(delete_patient_data(UUID, HOSPITAL_ID))

