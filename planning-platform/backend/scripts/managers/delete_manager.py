"""
삭제 작업 통합 스크립트

서브커맨드:
  all                    - 모든 유저 삭제
  test                   - 테스트 데이터 삭제
  patient <uuid> [hospital_id]  - 특정 환자 삭제 (환자 행 있을 때만)
  uuid <uuid> [hospital_id]    - UUID 기준 전체 삭제 (환자 없어도 실행, 재테스트용)
  health <uuid> [hospital_id]  - 건강데이터만 삭제
  payment                - 모든 결제 데이터 삭제
"""
import asyncio
import asyncpg
import os
import sys
import argparse
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

def get_db_config():
    """DB 연결 설정"""
    return {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }


async def cmd_all():
    """모든 유저 삭제"""
    db_config = get_db_config()
    
    print("=" * 80)
    print("⚠️  경고: 모든 유저 데이터를 삭제합니다!")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 현재 유저 수 확인
        total_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
        """)
        
        welno_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
            WHERE registration_source IS NULL OR registration_source = 'DIRECT'
        """)
        
        partner_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
            WHERE registration_source = 'PARTNER'
        """)
        
        print(f"전체 유저: {total_count}명")
        print(f"  - 웰노 유저: {welno_count}명")
        print(f"  - 파트너사 유저: {partner_count}명")
        print()
        
        if total_count == 0:
            print("✅ 삭제할 유저가 없습니다.")
            return
        
        # 모든 유저 UUID 조회
        all_users = await conn.fetch("""
            SELECT uuid, hospital_id, name, registration_source, partner_id
            FROM welno.welno_patients
            ORDER BY created_at DESC
        """)
        
        print(f"총 {len(all_users)}명의 유저를 삭제합니다.")
        print()
        
        # 삭제 실행
        deleted_count = 0
        error_count = 0
        
        for user in all_users:
            uuid = user['uuid']
            hospital_id = user['hospital_id']
            
            try:
                # 관련 데이터 삭제 (외래키 제약 때문에 순서 중요)
                await conn.execute("""
                    DELETE FROM welno.welno_checkup_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                await conn.execute("""
                    DELETE FROM welno.welno_prescription_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                await conn.execute("""
                    DELETE FROM welno.tb_campaign_payments
                    WHERE uuid = $1
                """, uuid)
                
                patient_result = await conn.execute("""
                    DELETE FROM welno.welno_patients
                    WHERE uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                if patient_result == "DELETE 1":
                    deleted_count += 1
                    print(f"✅ 삭제 완료: {user['name']} (UUID: {uuid})")
                else:
                    error_count += 1
                    print(f"⚠️  삭제 실패: {user['name']} (UUID: {uuid})")
                    
            except Exception as e:
                error_count += 1
                print(f"❌ 삭제 오류: {user['name']} (UUID: {uuid}), Error: {e}")
        
        print()
        
        # 최종 확인
        remaining_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
        """)
        
        print(f"삭제 완료: {deleted_count}명")
        if error_count > 0:
            print(f"삭제 실패: {error_count}명")
        print(f"남은 유저: {remaining_count}명")
        print()
        
        if remaining_count == 0:
            print("=" * 80)
            print("✅ 모든 유저 삭제 완료!")
            print("=" * 80)
        else:
            print("=" * 80)
            print(f"⚠️  {remaining_count}명의 유저가 남아있습니다.")
            print("=" * 80)
        
        # 결제 데이터도 함께 삭제
        print()
        print("=" * 80)
        print("💳 결제 데이터 삭제")
        print("=" * 80)
        payment_count = await conn.fetchval("SELECT COUNT(*) FROM welno.tb_campaign_payments")
        print(f"결제 데이터: {payment_count}건")
        
        if payment_count > 0:
            payment_deleted = await conn.execute("DELETE FROM welno.tb_campaign_payments")
            print(f"✅ 결제 데이터 삭제 완료: {payment_deleted}")
        else:
            print("✅ 삭제할 결제 데이터가 없습니다.")
        
    finally:
        await conn.close()


async def cmd_test():
    """테스트 데이터 삭제"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print("🗑️  테스트 데이터 삭제")
        print("=" * 80)
        print()
        
        # 테스트 유저 찾기 (임시사용자, 테스트 전화번호 등)
        test_users = await conn.fetch("""
            SELECT uuid, hospital_id, name, phone_number, registration_source, partner_id
            FROM welno.welno_patients
            WHERE name = '임시사용자'
               OR phone_number = '01000000000'
               OR (registration_source = 'PARTNER' AND created_at >= CURRENT_DATE)
        """)
        
        print(f"발견된 테스트 유저: {len(test_users)}명")
        print()
        
        if len(test_users) == 0:
            print("✅ 삭제할 테스트 유저가 없습니다.")
            return
        
        deleted_count = 0
        for user in test_users:
            uuid = user['uuid']
            hospital_id = user['hospital_id']
            
            try:
                await conn.execute("""
                    DELETE FROM welno.welno_checkup_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                await conn.execute("""
                    DELETE FROM welno.welno_prescription_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                await conn.execute("""
                    DELETE FROM welno.tb_campaign_payments
                    WHERE uuid = $1
                """, uuid)
                
                result = await conn.execute("""
                    DELETE FROM welno.welno_patients
                    WHERE uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                if result == "DELETE 1":
                    deleted_count += 1
                    print(f"✅ 삭제 완료: {user['name']} (UUID: {uuid})")
            except Exception as e:
                print(f"❌ 삭제 오류: {user['name']} (UUID: {uuid}), Error: {e}")
        
        print()
        print(f"✅ 테스트 데이터 삭제 완료: {deleted_count}명")
        
    finally:
        await conn.close()


async def cmd_patient(uuid: str, hospital_id: str = "PEERNINE"):
    """특정 환자 삭제"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🗑️  환자 데이터 삭제: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
        # 환자 정보 확인
        patient = await conn.fetchrow("""
            SELECT id, name, phone_number
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient:
            print("❌ 환자 정보를 찾을 수 없습니다.")
            return
        
        print(f"삭제할 환자: {patient['name']} (전화번호: {patient['phone_number']})")
        print()
        
        # 관련 데이터 삭제
        checkup_deleted = await conn.execute("""
            DELETE FROM welno.welno_checkup_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        prescription_deleted = await conn.execute("""
            DELETE FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        payment_deleted = await conn.execute("""
            DELETE FROM welno.tb_campaign_payments
            WHERE uuid = $1
        """, uuid)
        
        patient_deleted = await conn.execute("""
            DELETE FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        print(f"✅ 건강검진 데이터 삭제: {checkup_deleted}")
        print(f"✅ 처방전 데이터 삭제: {prescription_deleted}")
        print(f"✅ 결제 정보 삭제: {payment_deleted}")
        print(f"✅ 환자 정보 삭제: {patient_deleted}")
        print()
        print("=" * 80)
        print("✅ 환자 데이터 삭제 완료!")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_health(uuid: str, hospital_id: str = "PEERNINE"):
    """건강데이터만 삭제 (환자 정보는 유지)"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🗑️  건강데이터 삭제: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
        # 환자 정보 확인
        patient = await conn.fetchrow("""
            SELECT id, name, phone_number
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient:
            print("❌ 환자 정보를 찾을 수 없습니다.")
            return
        
        print(f"환자: {patient['name']} (전화번호: {patient['phone_number']})")
        print("⚠️  건강검진 데이터만 삭제하고 환자 정보는 유지합니다.")
        print()
        
        # 건강검진 데이터 삭제
        health_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_checkup_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if health_count > 0:
            await conn.execute("""
                DELETE FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
            """, uuid, hospital_id)
            
            # 환자 정보 플래그 업데이트
            await conn.execute("""
                UPDATE welno.welno_patients
                SET has_health_data = FALSE,
                    last_data_update = NULL,
                    updated_at = NOW()
                WHERE uuid = $1 AND hospital_id = $2
            """, uuid, hospital_id)
            
            print(f"✅ 건강검진 데이터 삭제 완료: {health_count}건")
            print(f"✅ 환자 정보 플래그 업데이트 완료")
        else:
            print("ℹ️  삭제할 건강검진 데이터가 없습니다.")
        
        print()
        print("=" * 80)
        print("✅ 건강데이터 삭제 완료!")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_payment():
    """모든 결제 데이터 삭제"""
    db_config = get_db_config()
    
    print("=" * 80)
    print("💳 결제 데이터 삭제")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 현재 결제 데이터 확인
        payment_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.tb_campaign_payments
        """)
        
        print(f"총 결제 데이터: {payment_count}건")
        print()
        
        if payment_count == 0:
            print("✅ 삭제할 결제 데이터가 없습니다.")
            return
        
        # 결제 데이터 상세 확인
        payments = await conn.fetch("""
            SELECT oid, uuid, partner_id, user_name, status, amount, created_at
            FROM welno.tb_campaign_payments
            ORDER BY created_at DESC
        """)
        
        print("삭제할 결제 데이터:")
        for pay in payments:
            print(f"  - 주문번호: {pay['oid']}, UUID: {pay['uuid']}, 파트너: {pay['partner_id']}, 사용자: {pay['user_name']}, 상태: {pay['status']}, 금액: {pay['amount']:,}원")
        print()
        
        # 삭제 실행
        payment_deleted = await conn.execute("DELETE FROM welno.tb_campaign_payments")
        
        # 최종 확인
        remaining_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.tb_campaign_payments
        """)
        
        print(f"삭제 완료: {payment_deleted}")
        print(f"남은 결제 데이터: {remaining_count}건")
        print()
        
        if remaining_count == 0:
            print("=" * 80)
            print("✅ 모든 결제 데이터 삭제 완료!")
            print("=" * 80)
        else:
            print("=" * 80)
            print(f"⚠️  {remaining_count}건의 결제 데이터가 남아있습니다.")
            print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_uuid(uuid: str, hospital_id: str = "PEERNINE"):
    """UUID 기준으로 모든 관련 데이터 삭제 (환자 행 없어도 실행 가능, 재테스트용)"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    try:
        print("=" * 80)
        print(f"🗑️  UUID 기준 데이터 삭제: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        checkup_deleted = await conn.execute("""
            DELETE FROM welno.welno_checkup_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        prescription_deleted = await conn.execute("""
            DELETE FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        mediarc_deleted = await conn.execute("""
            DELETE FROM welno.welno_mediarc_reports
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        payment_deleted = await conn.execute("""
            DELETE FROM welno.tb_campaign_payments
            WHERE uuid = $1
        """, uuid)
        patient_deleted = await conn.execute("""
            DELETE FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        print(f"✅ 건강검진: {checkup_deleted}")
        print(f"✅ 처방전: {prescription_deleted}")
        print(f"✅ 예측리포트: {mediarc_deleted}")
        print(f"✅ 결제: {payment_deleted}")
        print(f"✅ 환자: {patient_deleted}")
        print()
        print("=" * 80)
        print("✅ UUID 기준 삭제 완료 (재테스트 가능)")
        print("=" * 80)
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description='삭제 작업 통합 스크립트')
    subparsers = parser.add_subparsers(dest='command', help='서브커맨드')
    
    # all 명령
    subparsers.add_parser('all', help='모든 유저 삭제')
    
    # test 명령
    subparsers.add_parser('test', help='테스트 데이터 삭제')
    
    # patient 명령
    patient_parser = subparsers.add_parser('patient', help='특정 환자 삭제 (환자 행 있을 때만)')
    patient_parser.add_argument('uuid', help='환자 UUID')
    patient_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # uuid 명령 (환자 없어도 UUID 기준 전체 삭제)
    uuid_parser = subparsers.add_parser('uuid', help='UUID 기준 전체 삭제 (재테스트용)')
    uuid_parser.add_argument('uuid', help='환자 UUID')
    uuid_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # health 명령
    health_parser = subparsers.add_parser('health', help='건강데이터만 삭제')
    health_parser.add_argument('uuid', help='환자 UUID')
    health_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # payment 명령
    subparsers.add_parser('payment', help='모든 결제 데이터 삭제')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'all':
        print("⚠️  경고: 이 작업은 되돌릴 수 없습니다!")
        response = input("계속하시겠습니까? (yes/no): ")
        if response.lower() in ['yes', 'y']:
            asyncio.run(cmd_all())
        else:
            print("취소되었습니다.")
    elif args.command == 'test':
        asyncio.run(cmd_test())
    elif args.command == 'patient':
        asyncio.run(cmd_patient(args.uuid, args.hospital_id))
    elif args.command == 'uuid':
        asyncio.run(cmd_uuid(args.uuid, args.hospital_id))
    elif args.command == 'health':
        asyncio.run(cmd_health(args.uuid, args.hospital_id))
    elif args.command == 'payment':
        asyncio.run(cmd_payment())


if __name__ == "__main__":
    main()
