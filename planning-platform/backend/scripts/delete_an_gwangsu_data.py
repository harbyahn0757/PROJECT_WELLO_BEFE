#!/usr/bin/env python3
"""
안광수 환자 데이터 완전 삭제 스크립트
검진 설계 요청 데이터 포함 모든 데이터 삭제
"""
import asyncio
import asyncpg
import os
import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# .env 파일 로드
from dotenv import load_dotenv
env_path = project_root / '.env.local'
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv(project_root / '.env')

# 데이터베이스 설정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "10.0.1.10"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "p9_mkt_biz"),
    "user": os.getenv("DB_USER", "peernine"),
    "password": os.getenv("DB_PASSWORD", "autumn3334!")
}

PATIENT_NAME = "안광수"

async def find_and_delete_an_gwangsu_data():
    """안광수 환자 데이터 찾기 및 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print(f"🔍 안광수 환자 데이터 검색 및 삭제")
        print("="*100)
        
        # 1. 환자 찾기
        patients = await conn.fetch(
            """
            SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                   has_health_data, has_prescription_data, created_at
            FROM welno.welno_patients 
            WHERE name = $1
            ORDER BY created_at DESC
            """,
            PATIENT_NAME
        )
        
        if not patients:
            print(f"⚠️ '{PATIENT_NAME}' 이름의 환자를 찾을 수 없습니다.")
            await conn.close()
            return
        
        print(f"\n📋 발견된 환자: {len(patients)}명")
        for i, patient in enumerate(patients, 1):
            print(f"\n{i}. {patient['name']}")
            print(f"   UUID: {patient['uuid']}")
            print(f"   Hospital ID: {patient['hospital_id']}")
            print(f"   전화번호: {patient['phone_number']}")
            print(f"   생년월일: {patient['birth_date']}")
            print(f"   성별: {patient['gender']}")
            print(f"   건강 데이터: {'✅' if patient['has_health_data'] else '❌'}")
            print(f"   처방전 데이터: {'✅' if patient['has_prescription_data'] else '❌'}")
            print(f"   생성일: {patient['created_at']}")
        
        # 2. 각 환자별 데이터 확인
        total_health = 0
        total_prescription = 0
        total_design_requests = 0
        
        for patient in patients:
            uuid = patient['uuid']
            hospital_id = patient['hospital_id']
            patient_id = patient['id']
            
            print(f"\n{'='*100}")
            print(f"📊 {patient['name']}님 데이터 현황 (UUID: {uuid}, Hospital: {hospital_id})")
            print(f"{'='*100}")
            
            # 건강검진 데이터 개수
            health_count = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                """,
                uuid, hospital_id
            )
            print(f"   건강검진 데이터: {health_count}건")
            total_health += health_count
            
            # 처방전 데이터 개수
            prescription_count = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM welno.welno_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                """,
                uuid, hospital_id
            )
            print(f"   처방전 데이터: {prescription_count}건")
            total_prescription += prescription_count
            
            # 검진 설계 요청 데이터 개수 (patient_id 기준)
            design_count = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM welno.welno_checkup_design_requests 
                WHERE patient_id = $1
                """,
                patient_id
            )
            print(f"   검진 설계 요청: {design_count}건")
            total_design_requests += design_count
        
        # 3. 삭제 확인
        print(f"\n{'='*100}")
        print("⚠️ 삭제 대상 데이터 요약")
        print(f"{'='*100}")
        print(f"   환자 정보: {len(patients)}명")
        print(f"   건강검진 데이터: {total_health}건")
        print(f"   처방전 데이터: {total_prescription}건")
        print(f"   검진 설계 요청: {total_design_requests}건")
        print(f"\n⚠️ 위 데이터를 모두 삭제하시겠습니까? (yes/no): ", end="")
        
        # 실제 삭제 실행
        print("\n🗑️ 삭제 시작...")
        
        async with conn.transaction():
            for patient in patients:
                uuid = patient['uuid']
                hospital_id = patient['hospital_id']
                patient_id = patient['id']
                
                print(f"\n{'='*100}")
                print(f"🗑️ {patient['name']}님 데이터 삭제 중...")
                print(f"{'='*100}")
                
                # 1. 검진 설계 요청 삭제 (patient_id 기준)
                design_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM welno.welno_checkup_design_requests WHERE patient_id = $1",
                    patient_id
                )
                if design_count > 0:
                    await conn.execute(
                        "DELETE FROM welno.welno_checkup_design_requests WHERE patient_id = $1",
                        patient_id
                    )
                    print(f"✅ 검진 설계 요청 삭제: {design_count}건")
                
                # 2. 건강검진 데이터 삭제
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
                
                # 3. 처방전 데이터 삭제
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
                
                # 4. 환자 정보 삭제
                await conn.execute(
                    "DELETE FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                    uuid, hospital_id
                )
                print(f"✅ 환자 정보 삭제 완료")
        
        # 5. 삭제 후 확인
        print(f"\n{'='*100}")
        print("📋 삭제 후 확인")
        print(f"{'='*100}")
        
        remaining = await conn.fetch(
            "SELECT uuid, hospital_id FROM welno.welno_patients WHERE name = $1",
            PATIENT_NAME
        )
        
        if remaining:
            print(f"⚠️ 남아있는 환자: {len(remaining)}명")
            for r in remaining:
                print(f"   - UUID: {r['uuid']}, Hospital: {r['hospital_id']}")
        else:
            print("✅ 모든 안광수 환자 데이터 삭제 완료!")
        
        print(f"\n{'='*100}")
        print("✅ 삭제 완료 요약")
        print(f"{'='*100}")
        print(f"   - 환자 정보: {len(patients)}명 삭제")
        print(f"   - 건강검진 데이터: {total_health}건 삭제")
        print(f"   - 처방전 데이터: {total_prescription}건 삭제")
        print(f"   - 검진 설계 요청: {total_design_requests}건 삭제")
        print(f"{'='*100}\n")
        
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(find_and_delete_an_gwangsu_data())
