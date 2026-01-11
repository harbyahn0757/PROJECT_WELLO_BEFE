#!/usr/bin/env python3
"""
안광수님의 건강검진 데이터만 삭제 스크립트
환자 정보와 처방전 데이터는 유지
"""
import asyncio
import asyncpg

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 삭제할 환자 정보
PATIENT = {
    "name": "안광수",
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "hospital_id": "KHW001"
}

async def delete_health_data():
    """건강검진 데이터만 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🗑️ 건강검진 데이터 삭제 시작")
        print("="*100)
        print(f"\n👤 환자: {PATIENT['name']}")
        print(f"   UUID: {PATIENT['uuid']}")
        print(f"   병원 ID: {PATIENT['hospital_id']}")
        print("\n⚠️ 주의: 건강검진 데이터만 삭제하고 환자 정보와 처방전 데이터는 유지합니다.\n")
        
        # 트랜잭션 시작
        async with conn.transaction():
            uuid = PATIENT["uuid"]
            hospital_id = PATIENT["hospital_id"]
            
            # 삭제 전 데이터 건수 확인
            health_count = await conn.fetchval(
                "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            print(f"  📊 삭제 전 건강검진 데이터: {health_count}건")
            
            if health_count == 0:
                print("  ℹ️ 삭제할 건강검진 데이터가 없습니다.")
            else:
                # 건강검진 데이터 삭제
                await conn.execute(
                    "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"  ✅ 건강검진 데이터 삭제 완료: {health_count}건")
            
            # 환자 정보 플래그 업데이트 (건강검진 데이터만 FALSE로)
            await conn.execute(
                """UPDATE welno.welno_patients 
                   SET has_health_data = FALSE,
                       last_data_update = NULL 
                   WHERE uuid = $1 AND hospital_id = $2""",
                uuid, hospital_id
            )
            print(f"  ✅ 환자 정보 플래그 업데이트 완료 (has_health_data = FALSE)")
        
        print("\n" + "="*100)
        print("✅ 데이터 삭제 완료!")
        print("="*100)
        
        # 삭제 후 확인
        health_count_after = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        prescription_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        patient_info = await conn.fetchrow(
            "SELECT has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print(f"\n📋 삭제 후 데이터 현황:")
        print(f"  - 건강검진 데이터: {health_count_after}건")
        print(f"  - 처방전 데이터: {prescription_count}건 (유지됨)")
        print(f"  - has_health_data: {patient_info['has_health_data']}")
        print(f"  - has_prescription_data: {patient_info['has_prescription_data']}")
        
        print("\n✅ 건강검진 데이터가 삭제되었습니다. Tilko 인증부터 다시 테스트할 수 있습니다.")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ [삭제 오류] {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(delete_health_data())


