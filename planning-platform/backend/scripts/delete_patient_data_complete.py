#!/usr/bin/env python3
"""
환자 데이터 완전 삭제 스크립트 (고도화 버전)
이름 또는 UUID로 환자 데이터를 완전 삭제 (서버 DB만)
"""
import asyncio
import asyncpg
import os
import sys

# 데이터베이스 설정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "10.0.1.10"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "p9_mkt_biz"),
    "user": os.getenv("DB_USER", "peernine"),
    "password": os.getenv("DB_PASSWORD", "autumn3334!")
}

async def delete_patient_data_by_name(patient_name: str):
    """이름으로 환자 데이터 완전 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print(f"🗑️ 환자 데이터 완전 삭제 (이름: {patient_name})")
        print("="*100)
        
        # 환자 찾기
        patients = await conn.fetch(
            "SELECT uuid, hospital_id, name, phone_number, id FROM welno.welno_patients WHERE name = $1",
            patient_name
        )
        
        if not patients:
            print(f"⚠️ '{patient_name}' 이름의 환자를 찾을 수 없습니다.")
            await conn.close()
            return
        
        print(f"\n📋 발견된 환자: {len(patients)}명")
        total_health = 0
        total_prescription = 0
        
        # 각 환자별 데이터 삭제
        async with conn.transaction():
            for patient in patients:
                uuid = patient['uuid']
                hospital_id = patient['hospital_id']
                
                print(f"\n{'='*100}")
                print(f"👤 {patient['name']}님 데이터 삭제 (UUID: {uuid}, Hospital: {hospital_id})")
                print(f"{'='*100}")
                
                # 건강검진 데이터 삭제
                health_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                if health_count > 0:
                    await conn.execute(
                        "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, hospital_id
                    )
                    print(f"✅ 건강검진 데이터 삭제: {health_count}건")
                    total_health += health_count
                
                # 처방전 데이터 삭제
                prescription_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                if prescription_count > 0:
                    await conn.execute(
                        "DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, hospital_id
                    )
                    print(f"✅ 처방전 데이터 삭제: {prescription_count}건")
                    total_prescription += prescription_count
                
                # 환자 정보 완전 삭제
                await conn.execute(
                    "DELETE FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 환자 정보 삭제 완료")
        
        # 삭제 후 확인
        remaining = await conn.fetch(
            "SELECT uuid, hospital_id FROM welno.welno_patients WHERE name = $1",
            patient_name
        )
        
        print("\n" + "="*100)
        print("📋 삭제 후 확인")
        print("="*100)
        if remaining:
            print(f"⚠️ 남아있는 환자: {len(remaining)}명")
            for r in remaining:
                print(f"   - UUID: {r['uuid']}, Hospital: {r['hospital_id']}")
        else:
            print("✅ 모든 환자 정보 삭제 완료")
        
        print(f"\n✅ 총 삭제 완료:")
        print(f"   - 건강검진 데이터: {total_health}건")
        print(f"   - 처방전 데이터: {total_prescription}건")
        print(f"   - 환자 정보: {len(patients)}명")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

async def delete_patient_data_by_uuid(uuid: str, hospital_id: str):
    """UUID로 환자 데이터 완전 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print(f"🗑️ 환자 데이터 완전 삭제 (UUID: {uuid}, Hospital: {hospital_id})")
        print("="*100)
        
        # 환자 확인
        patient = await conn.fetchrow(
            "SELECT uuid, hospital_id, name, phone_number, id FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        if not patient:
            print(f"⚠️ 해당 UUID와 Hospital ID의 환자를 찾을 수 없습니다.")
            await conn.close()
            return
        
        print(f"\n👤 환자: {patient['name']} (UUID: {uuid}, Hospital: {hospital_id})")
        
        # 데이터 확인
        health_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        prescription_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print(f"   - 건강검진 데이터: {health_count}건")
        print(f"   - 처방전 데이터: {prescription_count}건")
        
        # 트랜잭션으로 삭제
        async with conn.transaction():
            if health_count > 0:
                await conn.execute(
                    "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 건강검진 데이터 삭제: {health_count}건")
            
            if prescription_count > 0:
                await conn.execute(
                    "DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 처방전 데이터 삭제: {prescription_count}건")
            
            await conn.execute(
                "DELETE FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            print(f"✅ 환자 정보 삭제 완료")
        
        # 삭제 후 확인
        remaining = await conn.fetchrow(
            "SELECT uuid FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        print("\n📋 삭제 후 확인:")
        if remaining:
            print("⚠️ 환자 정보가 남아있습니다.")
        else:
            print("✅ 모든 데이터 삭제 완료")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("사용법:")
        print("  이름으로 삭제: python delete_patient_data_complete.py --name '안광수'")
        print("  UUID로 삭제: python delete_patient_data_complete.py --uuid <uuid> --hospital <hospital_id>")
        sys.exit(1)
    
    if sys.argv[1] == '--name' and len(sys.argv) >= 3:
        patient_name = sys.argv[2]
        asyncio.run(delete_patient_data_by_name(patient_name))
    elif sys.argv[1] == '--uuid' and len(sys.argv) >= 5:
        uuid = sys.argv[2]
        hospital_id = sys.argv[4] if sys.argv[3] == '--hospital' else sys.argv[3]
        asyncio.run(delete_patient_data_by_uuid(uuid, hospital_id))
    else:
        print("사용법:")
        print("  이름으로 삭제: python delete_patient_data_complete.py --name '안광수'")
        print("  UUID로 삭제: python delete_patient_data_complete.py --uuid <uuid> --hospital <hospital_id>")
        sys.exit(1)
