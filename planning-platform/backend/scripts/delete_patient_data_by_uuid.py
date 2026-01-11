#!/usr/bin/env python3
"""
특정 UUID와 Hospital ID로 환자 데이터 삭제 스크립트
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

# 삭제할 환자 정보
UUID = "0a030e57-80fd-4010-af74-9aa3ffe0407b"
HOSPITAL_ID = "PEERNINE"

async def delete_patient_data():
    """특정 환자의 모든 데이터 삭제"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🗑️ 환자 데이터 삭제 시작")
        print("="*100)
        print(f"\n👤 환자 정보:")
        print(f"   UUID: {UUID}")
        print(f"   Hospital ID: {HOSPITAL_ID}")
        print("\n⚠️ 주의: 다음 데이터가 삭제됩니다:")
        print("   - 건강검진 데이터 (welno_checkup_data)")
        print("   - 처방전 데이터 (welno_prescription_data)")
        print("   - 환자 정보 플래그 업데이트 (welno_patients)")
        print()
        
        # 삭제 전 데이터 확인
        health_count_before = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        prescription_count_before = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        patient_info = await conn.fetchrow(
            "SELECT id, name, phone_number, has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        print(f"📊 삭제 전 데이터 현황:")
        if patient_info:
            print(f"   - 환자 ID: {patient_info['id']}")
            print(f"   - 이름: {patient_info['name']}")
            print(f"   - 전화번호: {patient_info['phone_number']}")
        print(f"   - 건강검진 데이터: {health_count_before}건")
        print(f"   - 처방전 데이터: {prescription_count_before}건")
        print()
        
        if health_count_before == 0 and prescription_count_before == 0 and not patient_info:
            print("⚠️ 삭제할 데이터가 없습니다.")
            await conn.close()
            return
        
        # 트랜잭션 시작
        async with conn.transaction():
            # 건강검진 데이터 삭제
            if health_count_before > 0:
                health_deleted = await conn.execute(
                    "DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    UUID, HOSPITAL_ID
                )
                print(f"✅ 건강검진 데이터 삭제 완료: {health_count_before}건")
            else:
                print(f"ℹ️ 건강검진 데이터 없음 (삭제할 데이터 없음)")
            
            # 처방전 데이터 삭제
            if prescription_count_before > 0:
                prescription_deleted = await conn.execute(
                    "DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                    UUID, HOSPITAL_ID
                )
                print(f"✅ 처방전 데이터 삭제 완료: {prescription_count_before}건")
            else:
                print(f"ℹ️ 처방전 데이터 없음 (삭제할 데이터 없음)")
            
            # 환자 정보 플래그 업데이트 (환자 정보는 유지, 플래그만 업데이트)
            if patient_info:
                await conn.execute(
                    """UPDATE welno.welno_patients 
                       SET has_health_data = FALSE,
                           has_prescription_data = FALSE,
                           last_data_update = NULL,
                           updated_at = NOW()
                       WHERE uuid = $1 AND hospital_id = $2""",
                    UUID, HOSPITAL_ID
                )
                print(f"✅ 환자 정보 플래그 업데이트 완료")
            else:
                print(f"ℹ️ 환자 정보 없음 (플래그 업데이트 불필요)")
        
        # 삭제 후 확인
        health_count_after = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        prescription_count_after = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        patient_info_after = await conn.fetchrow(
            "SELECT has_health_data, has_prescription_data FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        print()
        print("="*100)
        print(f"📋 삭제 후 데이터 현황:")
        print("="*100)
        print(f"   - 건강검진 데이터: {health_count_after}건 (삭제 전: {health_count_before}건)")
        print(f"   - 처방전 데이터: {prescription_count_after}건 (삭제 전: {prescription_count_before}건)")
        if patient_info_after:
            print(f"   - 환자 정보 플래그:")
            print(f"     * has_health_data: {patient_info_after['has_health_data']}")
            print(f"     * has_prescription_data: {patient_info_after['has_prescription_data']}")
        
        await conn.close()
        
        print()
        print("="*100)
        print("✅ 삭제 완료")
        print("="*100)
        print("\n다음 단계:")
        print("1. 브라우저 콘솔에서 IndexedDB 삭제 명령어 실행")
        print("2. 브라우저 콘솔에서 localStorage 삭제 명령어 실행")
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(delete_patient_data())
