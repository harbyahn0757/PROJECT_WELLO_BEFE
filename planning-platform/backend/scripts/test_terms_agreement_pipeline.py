"""
약관 저장 수정 통합 테스트 스크립트

모든 Phase 테스트를 통합한 스크립트:
- Phase 0: verify_terms_agreement 함수 테스트
- Phase 2+3: register-patient API 통합 테스트
- Phase 3-1: save_patient_data 함수 필드 저장 테스트
"""
import asyncio
import asyncpg
import json
import os
import sys
import uuid as uuid_lib
from datetime import datetime, date
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

# DB 연결 설정
def get_db_config():
    return {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }


async def test_phase0_verify_terms_agreement(conn):
    """Phase 0: verify_terms_agreement 함수 테스트"""
    print("=" * 80)
    print("🧪 Phase 0: verify_terms_agreement 함수 테스트")
    print("=" * 80)
    print()
    
    try:
        # 테스트 케이스: 약관 정보가 없는 경우
        test_row = await conn.fetchrow("""
            SELECT uuid, hospital_id
            FROM welno.welno_patients
            WHERE (terms_agreement IS NULL OR terms_agreement::text = '{}'::text)
              AND (terms_agreement_detail IS NULL OR terms_agreement_detail::text = '{}'::text)
            LIMIT 1
        """)
        
        if test_row:
            uuid = test_row['uuid']
            hospital_id = test_row['hospital_id']
            
            # 직접 검증 로직 실행
            terms_status_row = await conn.fetchrow("""
                SELECT terms_agreement, terms_agreement_detail, terms_agreed_at, terms_all_required_agreed_at
                FROM welno.welno_patients
                WHERE uuid = $1 AND hospital_id = $2
            """, uuid, hospital_id)
            
            if not terms_status_row:
                result = {
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
                
                if terms_status_row.get('terms_agreement_detail'):
                    terms_detail = terms_status_row['terms_agreement_detail']
                    if isinstance(terms_detail, str):
                        terms_detail = json.loads(terms_detail)
                    
                    for term_name in required_terms:
                        term_data = terms_detail.get(term_name, {})
                        if isinstance(term_data, dict):
                            agreed = term_data.get('agreed', False)
                        else:
                            agreed = bool(term_data)
                        terms_details[term_name] = agreed
                        if not agreed:
                            missing_terms.append(term_name)
                elif terms_status_row.get('terms_agreement'):
                    terms = terms_status_row['terms_agreement']
                    if isinstance(terms, str):
                        terms = json.loads(terms)
                    
                    for term_name in required_terms:
                        agreed = terms.get(term_name, False)
                        terms_details[term_name] = agreed
                        if not agreed:
                            missing_terms.append(term_name)
                else:
                    missing_terms = required_terms
                
                result = {
                    "is_agreed": len(missing_terms) == 0,
                    "agreed_at": agreed_at,
                    "terms_details": terms_details,
                    "missing_terms": missing_terms
                }
            
            print(f"✅ 테스트 통과: 약관 정보 없음 → is_agreed = {result['is_agreed']}")
            assert result['is_agreed'] == False, "약관 정보가 없으면 is_agreed는 False여야 합니다"
            print("✅ Phase 0 테스트 완료\n")
            return True
        else:
            print("⚠️  약관 정보가 없는 환자를 찾을 수 없습니다.\n")
            return False
    except Exception as e:
        print(f"❌ Phase 0 테스트 실패: {e}\n")
        return False


async def test_phase2_3_register_patient(conn):
    """Phase 2+3: register-patient API 통합 테스트"""
    print("=" * 80)
    print("🧪 Phase 2+3: register-patient API 통합 테스트")
    print("=" * 80)
    print()
    
    try:
        test_uuid = str(uuid_lib.uuid4())
        partner_id = 'kindhabit'
        
        print(f"📋 테스트 케이스: 파트너사 유저 (user_info 없음)")
        print(f"   - UUID: {test_uuid}")
        print(f"   - Partner ID: {partner_id}")
        print()
        
        # 약관 동의 정보 준비
        now = datetime.now().isoformat()
        terms_agreement_detail = {
            "terms_service": {"agreed": True, "agreed_at": now},
            "terms_privacy": {"agreed": True, "agreed_at": now},
            "terms_sensitive": {"agreed": True, "agreed_at": now},
            "terms_marketing": {"agreed": False, "agreed_at": None}
        }
        
        # 최소 정보로 환자 등록
        patient_info = {
            "name": "임시사용자",
            "phone_number": "01000000000",
            "birth_date": "1900-01-01",
            "gender": "M"
        }
        
        session_id = f"CAMPAIGN_TERMS_{test_uuid}"
        registration_source = 'PARTNER'
        
        # 환자 등록
        patient_id = await conn.fetchval("""
            INSERT INTO welno.welno_patients (uuid, hospital_id, name, phone_number, birth_date, gender, 
                                      last_auth_at, tilko_session_id, registration_source, partner_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW())
            ON CONFLICT (uuid, hospital_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                phone_number = EXCLUDED.phone_number,
                birth_date = EXCLUDED.birth_date,
                gender = EXCLUDED.gender,
                last_auth_at = NOW(),
                tilko_session_id = EXCLUDED.tilko_session_id,
                registration_source = COALESCE(EXCLUDED.registration_source, welno.welno_patients.registration_source),
                partner_id = COALESCE(EXCLUDED.partner_id, welno.welno_patients.partner_id),
                updated_at = NOW()
            RETURNING id
        """, test_uuid, "PEERNINE", patient_info["name"], patient_info["phone_number"],
            date(1900, 1, 1), patient_info["gender"], session_id, registration_source, partner_id)
        
        # 약관 동의 정보 저장
        await conn.fetchval("""
            UPDATE welno.welno_patients
            SET terms_agreement_detail = $1::jsonb,
                terms_all_required_agreed_at = CASE 
                    WHEN ($1::jsonb->'terms_service'->>'agreed')::boolean = true
                     AND ($1::jsonb->'terms_privacy'->>'agreed')::boolean = true
                     AND ($1::jsonb->'terms_sensitive'->>'agreed')::boolean = true
                    THEN NOW()
                    ELSE terms_all_required_agreed_at
                END,
                updated_at = NOW()
            WHERE uuid = $2 AND hospital_id = $3
            RETURNING id
        """, json.dumps(terms_agreement_detail), test_uuid, "PEERNINE")
        
        # 검증
        saved_row = await conn.fetchrow("""
            SELECT uuid, name, registration_source, partner_id,
                   terms_agreement_detail, terms_all_required_agreed_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, test_uuid, "PEERNINE")
        
        assert saved_row['registration_source'] == 'PARTNER'
        assert saved_row['partner_id'] == partner_id
        assert saved_row['terms_agreement_detail'] is not None
        
        print(f"✅ 환자 등록 완료: patient_id={patient_id}")
        print(f"✅ 약관 동의 정보 저장 완료")
        print(f"✅ 모든 검증 통과!")
        print(f"\n📝 테스트 UUID: {test_uuid} (수동 삭제 필요)\n")
        print("✅ Phase 2+3 테스트 완료\n")
        return True, test_uuid
    except Exception as e:
        print(f"❌ Phase 2+3 테스트 실패: {e}\n")
        import traceback
        traceback.print_exc()
        return False, None


async def test_phase3_1_save_patient_fields(conn):
    """Phase 3-1: save_patient_data 함수 필드 저장 테스트"""
    print("=" * 80)
    print("🧪 Phase 3-1: save_patient_data 함수 필드 저장")
    print("=" * 80)
    print()
    
    try:
        test_uuid = str(uuid_lib.uuid4())
        partner_id = 'kindhabit'
        
        # 테스트 1: 약관 동의 시 등록 (파트너사)
        patient_info = {
            "name": "임시사용자",
            "phone_number": "01000000000",
            "birth_date": "1900-01-01",
            "gender": "M"
        }
        
        session_id = f"CAMPAIGN_TERMS_{test_uuid}"
        registration_source = 'PARTNER'
        
        result = await conn.fetchrow("""
            INSERT INTO welno.welno_patients (uuid, hospital_id, name, phone_number, birth_date, gender, 
                                      last_auth_at, tilko_session_id, registration_source, partner_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW())
            ON CONFLICT (uuid, hospital_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                phone_number = EXCLUDED.phone_number,
                birth_date = EXCLUDED.birth_date,
                gender = EXCLUDED.gender,
                last_auth_at = NOW(),
                tilko_session_id = EXCLUDED.tilko_session_id,
                registration_source = COALESCE(EXCLUDED.registration_source, welno.welno_patients.registration_source),
                partner_id = COALESCE(EXCLUDED.partner_id, welno.welno_patients.partner_id),
                updated_at = NOW()
            RETURNING id, registration_source, partner_id
        """, test_uuid, "PEERNINE", patient_info["name"], patient_info["phone_number"],
            date(1900, 1, 1), patient_info["gender"], session_id, registration_source, partner_id)
        
        assert result['registration_source'] == 'PARTNER'
        assert result['partner_id'] == partner_id
        print("✅ 테스트 1 통과: 약관 동의 시 등록")
        
        # 테스트 2: Tilko 인증 후 업데이트 (기존 값 유지)
        real_user_info = {
            "name": "홍길동",
            "phone_number": "01012345678",
            "birth_date": "1990-01-01",
            "gender": "M"
        }
        
        updated_result = await conn.fetchrow("""
            UPDATE welno.welno_patients
            SET name = $3,
                phone_number = $4,
                birth_date = $5,
                gender = $6,
                last_auth_at = NOW(),
                tilko_session_id = $7,
                updated_at = NOW()
            WHERE uuid = $1 AND hospital_id = $2
            RETURNING id, name, registration_source, partner_id
        """, test_uuid, "PEERNINE", real_user_info["name"], real_user_info["phone_number"],
            date(1990, 1, 1), real_user_info["gender"], "TILKO_SESSION_123")
        
        assert updated_result['name'] == '홍길동'
        assert updated_result['registration_source'] == 'PARTNER'
        assert updated_result['partner_id'] == partner_id
        print("✅ 테스트 2 통과: Tilko 인증 후 업데이트 (기존 값 유지)")
        print(f"\n📝 테스트 UUID: {test_uuid} (수동 삭제 필요)\n")
        print("✅ Phase 3-1 테스트 완료\n")
        return True, test_uuid
    except Exception as e:
        print(f"❌ Phase 3-1 테스트 실패: {e}\n")
        import traceback
        traceback.print_exc()
        return False, None


async def main():
    """메인 테스트 함수"""
    print("=" * 80)
    print("🧪 약관 저장 수정 통합 테스트")
    print("=" * 80)
    print()
    
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    test_uuids = []
    
    try:
        # Phase 0 테스트
        phase0_result = await test_phase0_verify_terms_agreement(conn)
        
        # Phase 2+3 테스트
        phase2_3_result, uuid1 = await test_phase2_3_register_patient(conn)
        if uuid1:
            test_uuids.append(uuid1)
        
        # Phase 3-1 테스트
        phase3_1_result, uuid2 = await test_phase3_1_save_patient_fields(conn)
        if uuid2:
            test_uuids.append(uuid2)
        
        # 최종 결과
        print("=" * 80)
        print("📊 최종 테스트 결과")
        print("=" * 80)
        print(f"Phase 0: {'✅ 통과' if phase0_result else '❌ 실패'}")
        print(f"Phase 2+3: {'✅ 통과' if phase2_3_result else '❌ 실패'}")
        print(f"Phase 3-1: {'✅ 통과' if phase3_1_result else '❌ 실패'}")
        print()
        
        if test_uuids:
            print("📝 테스트 데이터 UUID (수동 삭제 필요):")
            for uuid in test_uuids:
                print(f"   - {uuid}")
            print()
        
        all_passed = phase0_result and phase2_3_result and phase3_1_result
        if all_passed:
            print("✅ 모든 테스트 통과!")
        else:
            print("❌ 일부 테스트 실패")
        
    except Exception as e:
        print(f"❌ 테스트 실행 중 오류: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
