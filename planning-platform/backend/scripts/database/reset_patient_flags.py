#!/usr/bin/env python3
"""
안광수님의 플래그 둘 다 리셋 스크립트
has_health_data, has_prescription_data 둘 다 FALSE로 설정
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

# 리셋할 환자 정보
PATIENT = {
    "name": "안광수",
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "hospital_id": "KHW001"
}

async def reset_patient_flags():
    """환자 플래그 둘 다 리셋"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🔄 환자 플래그 리셋 시작")
        print("="*100)
        print(f"\n👤 환자: {PATIENT['name']}")
        print(f"   UUID: {PATIENT['uuid']}")
        print(f"   병원 ID: {PATIENT['hospital_id']}")
        print("\n⚠️ 주의: has_health_data와 has_prescription_data 둘 다 FALSE로 설정합니다.\n")
        
        # 트랜잭션 시작
        async with conn.transaction():
            uuid = PATIENT["uuid"]
            hospital_id = PATIENT["hospital_id"]
            
            # 현재 플래그 상태 확인
            patient_info = await conn.fetchrow(
                "SELECT has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            if not patient_info:
                print(f"  ❌ 환자 정보를 찾을 수 없습니다.")
                await conn.close()
                return
            
            print(f"  📊 현재 플래그 상태:")
            print(f"    - has_health_data: {patient_info['has_health_data']}")
            print(f"    - has_prescription_data: {patient_info['has_prescription_data']}")
            
            # 실제 데이터 건수 확인
            health_count = await conn.fetchval(
                "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            prescription_count = await conn.fetchval(
                "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            print(f"\n  📊 실제 데이터 건수:")
            print(f"    - 건강검진 데이터: {health_count}건")
            print(f"    - 처방전 데이터: {prescription_count}건")
            
            # 플래그 둘 다 FALSE로 리셋
            await conn.execute(
                """UPDATE welno.welno_patients 
                   SET has_health_data = FALSE, 
                       has_prescription_data = FALSE,
                       last_data_update = NULL 
                   WHERE uuid = $1 AND hospital_id = $2""",
                uuid, hospital_id
            )
            print(f"\n  ✅ 플래그 리셋 완료 (둘 다 FALSE로 설정)")
        
        print("\n" + "="*100)
        print("✅ 플래그 리셋 완료!")
        print("="*100)
        
        # 리셋 후 확인
        patient_info_after = await conn.fetchrow(
            "SELECT has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print(f"\n📋 리셋 후 플래그 상태:")
        print(f"  - has_health_data: {patient_info_after['has_health_data']}")
        print(f"  - has_prescription_data: {patient_info_after['has_prescription_data']}")
        print(f"\n📊 실제 데이터 건수 (변경 없음):")
        print(f"  - 건강검진 데이터: {health_count}건")
        print(f"  - 처방전 데이터: {prescription_count}건")
        
        print("\n✅ 플래그가 리셋되었습니다. Tilko 인증부터 다시 테스트할 수 있습니다.")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ [리셋 오류] {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(reset_patient_flags())


