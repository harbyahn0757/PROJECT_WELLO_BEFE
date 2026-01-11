#!/usr/bin/env python3
"""
모든 테스트 환자 데이터 삭제 스크립트
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 데이터베이스 설정 (환경변수 또는 기본값)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "10.0.1.10"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "p9_mkt_biz"),
    "user": os.getenv("DB_USER", "peernine"),
    "password": os.getenv("DB_PASSWORD", "autumn3334!")
}

# 삭제할 환자 UUID 목록 (최근 테스트 데이터)
TEST_UUIDS = [
    "efc565c5-36d0-4a59-a074-5ed97b9d2037",  # 최근 인증한 사용자
    "36473377-9f8a-447e-aaef-261b10dd2d85",  # 동기화 로그에 나온 UUID
    "49cc4185-1512-44fb-a513-faab0f663663",  # 이전 테스트
]

HOSPITAL_ID = "PEERNINE"

async def delete_all_test_data():
    """모든 테스트 환자 데이터 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🗑️ 모든 테스트 환자 데이터 삭제 시작")
        print("="*100)
        print(f"\n🏥 Hospital ID: {HOSPITAL_ID}")
        print(f"👤 삭제할 환자 수: {len(TEST_UUIDS)}명")
        print("\n⚠️ 주의: 다음 데이터가 삭제됩니다:")
        print("   - 건강검진 데이터 (welno_checkup_data)")
        print("   - 처방전 데이터 (welno_prescription_data)")
        print("   - 환자 정보 플래그 업데이트 (welno_patients)")
        print()
        
        total_health_deleted = 0
        total_prescription_deleted = 0
        
        # 트랜잭션 시작
        async with conn.transaction():
            for uuid in TEST_UUIDS:
                print(f"\n{'='*80}")
                print(f"👤 UUID: {uuid}")
                print(f"{'='*80}")
                
                # 삭제 전 데이터 확인
                health_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, HOSPITAL_ID
                )
                prescription_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    uuid, HOSPITAL_ID
                )
                
                patient_info = await conn.fetchrow(
                    "SELECT id, name, phone_number FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                    uuid, HOSPITAL_ID
                )
                
                if patient_info:
                    print(f"   - 이름: {patient_info['name']}")
                    print(f"   - 전화번호: {patient_info['phone_number']}")
                print(f"   - 건강검진 데이터: {health_count}건")
                print(f"   - 처방전 데이터: {prescription_count}건")
                
                # 건강검진 데이터 삭제
                if health_count > 0:
                    await conn.execute(
                        "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, HOSPITAL_ID
                    )
                    print(f"   ✅ 건강검진 데이터 삭제 완료: {health_count}건")
                    total_health_deleted += health_count
                
                # 처방전 데이터 삭제
                if prescription_count > 0:
                    await conn.execute(
                        "DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, HOSPITAL_ID
                    )
                    print(f"   ✅ 처방전 데이터 삭제 완료: {prescription_count}건")
                    total_prescription_deleted += prescription_count
                
                # 환자 정보 플래그 업데이트
                if patient_info:
                    await conn.execute(
                        """UPDATE welno.welno_patients 
                           SET has_health_data = FALSE,
                               has_prescription_data = FALSE,
                               last_data_update = NULL,
                               updated_at = NOW()
                           WHERE uuid = $1 AND hospital_id = $2""",
                        uuid, HOSPITAL_ID
                    )
                    print(f"   ✅ 환자 정보 플래그 업데이트 완료")
        
        await conn.close()
        
        print()
        print("="*100)
        print("✅ 삭제 완료")
        print("="*100)
        print(f"\n📊 총 삭제 현황:")
        print(f"   - 건강검진 데이터: {total_health_deleted}건")
        print(f"   - 처방전 데이터: {total_prescription_deleted}건")
        print(f"   - 처리한 환자 수: {len(TEST_UUIDS)}명")
        print("\n다음 단계:")
        print("1. 브라우저 콘솔에서 IndexedDB 삭제 명령어 실행")
        print("2. 브라우저 콘솔에서 localStorage 삭제 명령어 실행")
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(delete_all_test_data())
