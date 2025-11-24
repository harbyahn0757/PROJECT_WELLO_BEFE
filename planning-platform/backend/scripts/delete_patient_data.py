#!/usr/bin/env python3
"""
김영상, 안광수님의 검진/처방전 데이터 삭제 스크립트
환자 정보는 유지하고 검진/처방전 데이터만 삭제
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
PATIENTS = [
    {
        "name": "김영상",
        "uuid": "3a96200c-c61a-47b1-8539-27b73ef2f483",
        "hospital_id": "KHW001"
    },
    {
        "name": "안광수",
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "hospital_id": "KHW001"
    }
]

async def delete_patient_data():
    """환자 검진/처방전 데이터 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🗑️ 환자 데이터 삭제 시작")
        print("="*100)
        print("\n⚠️ 주의: 검진/처방전 데이터만 삭제하고 환자 정보는 유지합니다.")
        print("   Tilko부터 단계별로 테스트할 수 있도록 초기화합니다.\n")
        
        # 트랜잭션 시작
        async with conn.transaction():
            for patient in PATIENTS:
                name = patient["name"]
                uuid = patient["uuid"]
                hospital_id = patient["hospital_id"]
                
                print(f"\n{'='*100}")
                print(f"👤 {name}님 데이터 삭제")
                print(f"{'='*100}")
                
                # 삭제 전 데이터 건수 확인
                health_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                prescription_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                
                print(f"  - 건강검진 데이터: {health_count}건")
                print(f"  - 처방전 데이터: {prescription_count}건")
                
                # 건강검진 데이터 삭제
                health_deleted = await conn.execute(
                    "DELETE FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"  ✅ 건강검진 데이터 삭제 완료: {health_count}건")
                
                # 처방전 데이터 삭제
                prescription_deleted = await conn.execute(
                    "DELETE FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"  ✅ 처방전 데이터 삭제 완료: {prescription_count}건")
                
                # 환자 정보 플래그 업데이트
                await conn.execute(
                    """UPDATE wello.wello_patients 
                       SET has_health_data = FALSE, 
                           has_prescription_data = FALSE, 
                           last_data_update = NULL 
                       WHERE uuid = $1 AND hospital_id = $2""",
                    uuid, hospital_id
                )
                print(f"  ✅ 환자 정보 플래그 업데이트 완료")
        
        print("\n" + "="*100)
        print("✅ 데이터 삭제 완료!")
        print("="*100)
        print("\n📋 삭제 결과:")
        
        # 삭제 후 확인
        for patient in PATIENTS:
            name = patient["name"]
            uuid = patient["uuid"]
            hospital_id = patient["hospital_id"]
            
            health_count = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            prescription_count = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            patient_info = await conn.fetchrow(
                "SELECT has_health_data, has_prescription_data FROM wello.wello_patients WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            print(f"\n  {name}님:")
            print(f"    - 건강검진 데이터: {health_count}건 (삭제 완료)")
            print(f"    - 처방전 데이터: {prescription_count}건 (삭제 완료)")
            print(f"    - has_health_data: {patient_info['has_health_data']}")
            print(f"    - has_prescription_data: {patient_info['has_prescription_data']}")
        
        print("\n✅ 환자 정보는 유지되어 Tilko 인증부터 단계별 테스트가 가능합니다.")
        print("\n📝 다음 단계:")
        print("   1. Tilko 인증 테스트")
        print("   2. 건강검진 데이터 수집 테스트")
        print("   3. 처방전 데이터 수집 테스트")
        print("   4. 프론트엔드 표시 테스트")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ [삭제 오류] {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(delete_patient_data())

