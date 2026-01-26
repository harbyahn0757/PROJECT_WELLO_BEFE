"""
약관 동의 데이터 확인 스크립트

특정 UUID의 약관 동의 데이터를 조회하고, 웰노 유저 vs 파트너사 유저를 비교합니다.
"""
import asyncio
import asyncpg
import json
import os
import sys
from dotenv import load_dotenv
from datetime import datetime

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_terms_agreement(uuid: str, hospital_id: str = "PEERNINE"):
    """약관 동의 데이터 확인"""
    
    # DB 연결 설정
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    print("=" * 80)
    print("🔍 약관 동의 데이터 확인")
    print("=" * 80)
    print(f"\n📊 DB 연결 정보:")
    print(f"  - Host: {db_config['host']}")
    print(f"  - Port: {db_config['port']}")
    print(f"  - Database: {db_config['database']}")
    print(f"  - User: {db_config['user']}")
    print(f"\n🔑 조회 정보:")
    print(f"  - UUID: {uuid}")
    print(f"  - Hospital ID: {hospital_id}")
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 1. 환자 기본 정보 조회
        print("1️⃣ 환자 기본 정보 조회 (welno_patients)")
        print("-" * 80)
        
        patient_row = await conn.fetchrow("""
            SELECT 
                id, uuid, hospital_id, name, phone_number, birth_date, gender,
                registration_source, partner_id,
                terms_agreement, terms_agreement_detail,
                terms_agreed_at, terms_all_required_agreed_at,
                created_at, updated_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient_row:
            print("❌ 환자 정보를 찾을 수 없습니다.")
            print(f"   UUID: {uuid}, Hospital ID: {hospital_id}")
            return
        
        patient = dict(patient_row)
        print(f"✅ 환자 정보 발견:")
        print(f"   - ID: {patient['id']}")
        print(f"   - 이름: {patient['name']}")
        print(f"   - 전화번호: {patient['phone_number']}")
        print(f"   - 생년월일: {patient['birth_date']}")
        print(f"   - 성별: {patient['gender']}")
        print(f"   - 등록 출처: {patient['registration_source'] or 'None'}")
        print(f"   - 파트너 ID: {patient['partner_id'] or 'None'}")
        print(f"   - 생성일: {patient['created_at']}")
        print(f"   - 수정일: {patient['updated_at']}")
        print()
        
        # 2. 약관 동의 정보 확인
        print("2️⃣ 약관 동의 정보 확인")
        print("-" * 80)
        
        terms_agreement = patient.get('terms_agreement')
        terms_agreement_detail = patient.get('terms_agreement_detail')
        terms_agreed_at = patient.get('terms_agreed_at')
        terms_all_required_agreed_at = patient.get('terms_all_required_agreed_at')
        
        # terms_agreement (기존 형식)
        if terms_agreement:
            if isinstance(terms_agreement, str):
                try:
                    terms_agreement = json.loads(terms_agreement)
                except:
                    terms_agreement = {}
            
            print("📋 terms_agreement (기존 형식):")
            print(f"   - 서비스 이용약관: {terms_agreement.get('terms_service', False)}")
            print(f"   - 개인정보 수집/이용: {terms_agreement.get('terms_privacy', False)}")
            print(f"   - 민감정보 수집/이용: {terms_agreement.get('terms_sensitive', False)}")
            print(f"   - 마케팅 활용: {terms_agreement.get('terms_marketing', False)}")
        else:
            print("📋 terms_agreement: 없음")
        
        print()
        
        # terms_agreement_detail (새 형식)
        if terms_agreement_detail:
            if isinstance(terms_agreement_detail, str):
                try:
                    terms_agreement_detail = json.loads(terms_agreement_detail)
                except:
                    terms_agreement_detail = {}
            
            print("📋 terms_agreement_detail (새 형식):")
            for term_name in ['terms_service', 'terms_privacy', 'terms_sensitive', 'terms_marketing']:
                term_data = terms_agreement_detail.get(term_name, {})
                if isinstance(term_data, dict):
                    agreed = term_data.get('agreed', False)
                    agreed_at = term_data.get('agreed_at', None)
                    print(f"   - {term_name}:")
                    print(f"     * 동의 여부: {agreed}")
                    print(f"     * 동의 시각: {agreed_at or 'None'}")
                else:
                    print(f"   - {term_name}: {bool(term_data)}")
        else:
            print("📋 terms_agreement_detail: 없음")
        
        print()
        
        # 약관 동의 시각
        print("⏰ 약관 동의 시각:")
        print(f"   - terms_agreed_at: {terms_agreed_at or 'None'}")
        print(f"   - terms_all_required_agreed_at: {terms_all_required_agreed_at or 'None'}")
        print()
        
        # 3. verify_terms_agreement 함수로 검증
        print("3️⃣ verify_terms_agreement 함수로 검증")
        print("-" * 80)
        
        # 직접 함수 로직 구현 (import 경로 문제 회피)
        terms_status_row = await conn.fetchrow("""
            SELECT terms_agreement, terms_agreement_detail, terms_agreed_at, terms_all_required_agreed_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not terms_status_row:
            verification_result = {
                "is_agreed": False,
                "agreed_at": None,
                "terms_details": {},
                "missing_terms": ['terms_service', 'terms_privacy', 'terms_sensitive']
            }
        else:
            required_terms = ['terms_service', 'terms_privacy', 'terms_sensitive']
            terms_details = {}
            missing_terms = []
            agreed_at = terms_status_row.get('terms_all_required_agreed_at') or terms_status_row.get('terms_agreed_at')
            
            # terms_agreement_detail 우선 체크
            if terms_status_row.get('terms_agreement_detail'):
                terms_detail = terms_status_row['terms_agreement_detail']
                if isinstance(terms_detail, str):
                    try:
                        terms_detail = json.loads(terms_detail)
                    except:
                        terms_detail = {}
                
                for term_name in required_terms:
                    term_data = terms_detail.get(term_name, {})
                    if isinstance(term_data, dict):
                        agreed = term_data.get('agreed', False)
                    else:
                        agreed = bool(term_data)
                    
                    terms_details[term_name] = agreed
                    if not agreed:
                        missing_terms.append(term_name)
                
                marketing_data = terms_detail.get('terms_marketing', {})
                if isinstance(marketing_data, dict):
                    terms_details['terms_marketing'] = marketing_data.get('agreed', False)
                else:
                    terms_details['terms_marketing'] = bool(marketing_data)
            elif terms_status_row.get('terms_agreement'):
                terms = terms_status_row['terms_agreement']
                if isinstance(terms, str):
                    try:
                        terms = json.loads(terms)
                    except:
                        terms = {}
                
                for term_name in required_terms:
                    agreed = terms.get(term_name, False)
                    terms_details[term_name] = agreed
                    if not agreed:
                        missing_terms.append(term_name)
                
                terms_details['terms_marketing'] = terms.get('terms_marketing', False)
            else:
                missing_terms = required_terms
            
            verification_result = {
                "is_agreed": len(missing_terms) == 0,
                "agreed_at": agreed_at,
                "terms_details": terms_details,
                "missing_terms": missing_terms
            }
        
        print(f"✅ 검증 결과:")
        print(f"   - 모든 필수 약관 동의: {verification_result['is_agreed']}")
        print(f"   - 동의 시각: {verification_result['agreed_at']}")
        print(f"   - 약관 상세:")
        for term_name, agreed in verification_result['terms_details'].items():
            print(f"     * {term_name}: {agreed}")
        if verification_result['missing_terms']:
            print(f"   - 미동의 약관: {verification_result['missing_terms']}")
        print()
        
        # 4. 파트너 결제 정보 확인
        print("4️⃣ 파트너 결제 정보 확인")
        print("-" * 80)
        
        if patient['partner_id']:
            payment_row = await conn.fetchrow("""
                SELECT oid, status, amount, created_at, updated_at
                FROM welno.tb_campaign_payments
                WHERE uuid = $1 AND partner_id = $2
                ORDER BY created_at DESC
                LIMIT 1
            """, uuid, patient['partner_id'])
            
            if payment_row:
                payment = dict(payment_row)
                print(f"✅ 결제 정보 발견:")
                print(f"   - 주문번호: {payment['oid']}")
                print(f"   - 상태: {payment['status']}")
                print(f"   - 금액: {payment['amount']}")
                print(f"   - 생성일: {payment['created_at']}")
                print(f"   - 수정일: {payment['updated_at']}")
            else:
                print("❌ 결제 정보 없음")
        else:
            print("ℹ️  웰노 유저 (파트너 정보 없음)")
        
        print()
        
        # 5. 요약
        print("5️⃣ 요약")
        print("-" * 80)
        print(f"✅ 환자 등록: {'완료' if patient else '없음'}")
        print(f"✅ 약관 동의 (terms_agreement): {'있음' if terms_agreement else '없음'}")
        print(f"✅ 약관 동의 (terms_agreement_detail): {'있음' if terms_agreement_detail else '없음'}")
        print(f"✅ 매트릭스 인식: {'인식 가능' if verification_result['is_agreed'] else '인식 불가 (약관 미동의)'}")
        print(f"✅ 유저 타입: {'파트너사 유저' if patient['partner_id'] else '웰노 유저'}")
        print()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


async def check_all_payments_and_users():
    """결제 테이블과 웰노 유저 테이블 전체 확인"""
    
    # DB 연결 설정
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    print("=" * 80)
    print("🔍 결제 및 웰노 유저 데이터 전체 확인")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 1. 결제 테이블 (tb_campaign_payments) - 파트너용 임시 테이블
        print("1️⃣ 결제 테이블 (tb_campaign_payments) - 파트너용")
        print("-" * 80)
        
        payment_count = await conn.fetchval("SELECT COUNT(*) FROM welno.tb_campaign_payments")
        print(f"총 결제 데이터: {payment_count}건")
        print()
        
        if payment_count > 0:
            payments = await conn.fetch("""
                SELECT oid, uuid, partner_id, user_name, status, amount, 
                       email, created_at, updated_at
                FROM welno.tb_campaign_payments
                ORDER BY created_at DESC
            """)
            
            for pay in payments:
                print(f"  - 주문번호: {pay['oid']}")
                print(f"    UUID: {pay['uuid']}")
                print(f"    파트너: {pay['partner_id']}")
                print(f"    사용자: {pay['user_name']}")
                print(f"    상태: {pay['status']}")
                print(f"    금액: {pay['amount']:,}원")
                print(f"    이메일: {pay['email'] or '없음'}")
                print(f"    생성일: {pay['created_at']}")
                print(f"    수정일: {pay['updated_at']}")
                print()
        else:
            print("  ✅ 결제 데이터 없음")
        print()
        
        # 2. 웰노 유저 테이블 (welno_patients)
        print("2️⃣ 웰노 유저 테이블 (welno_patients)")
        print("-" * 80)
        
        user_count = await conn.fetchval("SELECT COUNT(*) FROM welno.welno_patients")
        print(f"총 웰노 유저: {user_count}명")
        print()
        
        if user_count > 0:
            # 웰노 유저와 파트너 유저 구분
            welno_users = await conn.fetch("""
                SELECT uuid, name, hospital_id, phone_number, registration_source, 
                       partner_id, created_at, updated_at
                FROM welno.welno_patients
                WHERE registration_source IS NULL OR registration_source = 'DIRECT'
                ORDER BY created_at DESC
            """)
            
            partner_users = await conn.fetch("""
                SELECT uuid, name, hospital_id, phone_number, registration_source, 
                       partner_id, created_at, updated_at
                FROM welno.welno_patients
                WHERE registration_source = 'PARTNER'
                ORDER BY created_at DESC
            """)
            
            print(f"  - 웰노 유저: {len(welno_users)}명")
            for user in welno_users:
                print(f"    * {user['name']} (UUID: {user['uuid']}, 전화: {user['phone_number']})")
                print(f"      생성일: {user['created_at']}")
            print()
            
            print(f"  - 파트너사 유저: {len(partner_users)}명")
            for user in partner_users:
                print(f"    * {user['name']} (UUID: {user['uuid']}, 파트너: {user['partner_id']}, 전화: {user['phone_number']})")
                print(f"      생성일: {user['created_at']}")
        else:
            print("  ✅ 웰노 유저 데이터 없음")
        print()
        
        # 3. 요약
        print("3️⃣ 요약")
        print("-" * 80)
        print(f"  - 결제 데이터: {payment_count}건")
        print(f"  - 웰노 유저: {user_count}명")
        print()
        
        if payment_count == 0 and user_count == 0:
            print("  ✅ 모든 데이터가 삭제되었습니다.")
        else:
            print("  ⚠️  일부 데이터가 남아있습니다.")
        print()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


async def main():
    """메인 함수"""
    if len(sys.argv) < 2:
        print("사용법:")
        print("  python check_terms_agreement.py <uuid> [hospital_id]  # 특정 UUID 확인")
        print("  python check_terms_agreement.py all                   # 전체 결제/유저 확인")
        print("\n예시:")
        print("  python check_terms_agreement.py bbfba40ee649d172c1cee9471249a535")
        print("  python check_terms_agreement.py bbfba40ee649d172c1cee9471249a535 PEERNINE")
        print("  python check_terms_agreement.py all")
        sys.exit(1)
    
    if sys.argv[1] == 'all':
        await check_all_payments_and_users()
    else:
        uuid = sys.argv[1]
        hospital_id = sys.argv[2] if len(sys.argv) > 2 else "PEERNINE"
        await check_terms_agreement(uuid, hospital_id)


if __name__ == "__main__":
    asyncio.run(main())
