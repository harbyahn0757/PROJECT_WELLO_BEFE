"""
환자 조회/관리 통합 스크립트

서브커맨드:
  check <uuid> [hospital_id]  - UUID로 환자 정보 조회
  list [--welno|--partner]      - 전체 환자 목록 조회
  terms <uuid> [hospital_id]    - 약관 동의 데이터 확인
  health <uuid> [hospital_id]   - 건강데이터 확인
  design <uuid> [hospital_id]   - 검진 설계 데이터 확인
  status <uuid> [--api-key KEY] [--data DATA] - 파트너 상태 확인 (어떤 화면으로 가야 하는지)
"""
import asyncio
import asyncpg
import json
import os
import sys
import argparse
import aiohttp
from dotenv import load_dotenv
from datetime import datetime

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


async def cmd_check(uuid: str, hospital_id: str = "PEERNINE"):
    """UUID로 환자 정보 조회"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🔍 환자 정보 조회: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
        # 환자 기본 정보
        patient = await conn.fetchrow("""
            SELECT id, uuid, hospital_id, name, birth_date, gender, phone_number,
                   has_health_data, has_prescription_data, registration_source, partner_id,
                   last_data_update, last_auth_at, last_access_at,
                   created_at, updated_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient:
            print("❌ 해당 UUID의 환자 정보가 없습니다.")
            return
        
        print("1️⃣ 환자 기본 정보")
        print("-" * 80)
        print(f"  - ID: {patient['id']}")
        print(f"  - 이름: {patient['name']}")
        print(f"  - 생년월일: {patient['birth_date']}")
        print(f"  - 성별: {patient['gender']}")
        print(f"  - 전화번호: {patient['phone_number']}")
        print(f"  - 등록 출처: {patient['registration_source'] or 'NULL'}")
        print(f"  - 파트너 ID: {patient['partner_id'] or '없음'}")
        print(f"  - 건강검진 데이터 보유: {patient['has_health_data']}")
        print(f"  - 처방전 데이터 보유: {patient['has_prescription_data']}")
        print(f"  - 마지막 데이터 업데이트: {patient['last_data_update']}")
        print(f"  - 마지막 인증: {patient['last_auth_at']}")
        print(f"  - 마지막 접속: {patient['last_access_at']}")
        print(f"  - 생성일: {patient['created_at']}")
        print(f"  - 수정일: {patient['updated_at']}")
        print()
        
        patient_id = patient['id']
        
        # 건강검진 데이터
        print("2️⃣ 건강검진 데이터")
        print("-" * 80)
        checkup_count = await conn.fetchval("""
            SELECT COUNT(*) 
            FROM welno.welno_checkup_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        print(f"  - 총 {checkup_count}건")
        
        if checkup_count > 0:
            checkup_years = await conn.fetch("""
                SELECT DISTINCT checkup_year, data_source
                FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY checkup_year DESC
            """, uuid, hospital_id)
            print("  - 연도별:")
            for row in checkup_years:
                print(f"    • {row['checkup_year']}년 ({row['data_source']})")
        print()
        
        # 처방전 데이터
        print("3️⃣ 처방전 데이터")
        print("-" * 80)
        prescription_count = await conn.fetchval("""
            SELECT COUNT(*) 
            FROM welno.welno_prescription_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        print(f"  - 총 {prescription_count}건")
        
        if prescription_count > 0:
            prescription_dates = await conn.fetch("""
                SELECT prescription_date, data_source
                FROM welno.welno_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY prescription_date DESC
                LIMIT 5
            """, uuid, hospital_id)
            print("  - 최근 5건:")
            for row in prescription_dates:
                print(f"    • {row['prescription_date']} ({row['data_source']})")
        print()
        
        # 검진 설계 요청
        print("4️⃣ 검진 설계 요청")
        print("-" * 80)
        design_count = await conn.fetchval("""
            SELECT COUNT(*) 
            FROM welno.welno_checkup_design_requests 
            WHERE patient_id = $1
        """, patient_id)
        print(f"  - 총 {design_count}건")
        
        if design_count > 0:
            designs = await conn.fetch("""
                SELECT id, status, created_at, completed_at
                FROM welno.welno_checkup_design_requests 
                WHERE patient_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            """, patient_id)
            print("  - 최근 5건:")
            for row in designs:
                status_emoji = "✅" if row['status'] == 'completed' else "⏳"
                print(f"    {status_emoji} ID: {row['id']}, 상태: {row['status']}, 생성: {row['created_at']}")
        print()
        
        print("=" * 80)
        print("✅ 조회 완료")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_list(welno_only: bool = False, partner_only: bool = False):
    """전체 환자 목록 조회"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print("📋 환자 목록 조회")
        print("=" * 80)
        print()
        
        # 필터 조건
        where_clause = ""
        if welno_only:
            where_clause = "WHERE registration_source IS NULL OR registration_source = 'DIRECT'"
        elif partner_only:
            where_clause = "WHERE registration_source = 'PARTNER'"
        
        query = f"""
            SELECT uuid, hospital_id, name, phone_number, registration_source, partner_id,
                   terms_agreement IS NOT NULL as has_terms,
                   terms_agreement_detail IS NOT NULL as has_terms_detail,
                   created_at, updated_at
            FROM welno.welno_patients
            {where_clause}
            ORDER BY created_at DESC
            LIMIT 50
        """
        
        users = await conn.fetch(query)
        
        welno_count = 0
        partner_count = 0
        
        for idx, user in enumerate(users, 1):
            is_welno = user['registration_source'] is None or user['registration_source'] == 'DIRECT'
            if is_welno:
                welno_count += 1
            else:
                partner_count += 1
            
            user_type = '웰노' if is_welno else '파트너사'
            print(f"{idx}. [{user_type}] {user['name']} (UUID: {user['uuid']})")
            print(f"   Hospital: {user['hospital_id']}, 전화번호: {user['phone_number'] or '없음'}")
            print(f"   Source: {user['registration_source'] or 'NULL'}, Partner: {user['partner_id'] or '없음'}")
            print(f"   약관: terms={user['has_terms']}, detail={user['has_terms_detail']}")
            print(f"   생성일: {user['created_at']}")
            print()
        
        print("=" * 80)
        print(f"총 {len(users)}명 (최근 50명)")
        print(f"  - 웰노 유저: {welno_count}명")
        print(f"  - 파트너사 유저: {partner_count}명")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_terms(uuid: str, hospital_id: str = "PEERNINE"):
    """약관 동의 데이터 확인"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🔍 약관 동의 데이터 확인: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
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
            return
        
        patient = dict(patient_row)
        print("1️⃣ 환자 기본 정보")
        print("-" * 80)
        print(f"   - ID: {patient['id']}")
        print(f"   - 이름: {patient['name']}")
        print(f"   - 전화번호: {patient['phone_number']}")
        print(f"   - 등록 출처: {patient['registration_source'] or 'None'}")
        print(f"   - 파트너 ID: {patient['partner_id'] or 'None'}")
        print()
        
        # 약관 정보
        terms_agreement = patient.get('terms_agreement')
        terms_agreement_detail = patient.get('terms_agreement_detail')
        terms_agreed_at = patient.get('terms_agreed_at')
        terms_all_required_agreed_at = patient.get('terms_all_required_agreed_at')
        
        print("2️⃣ 약관 동의 정보")
        print("-" * 80)
        
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
        
        # verify_terms_agreement 검증
        print("3️⃣ verify_terms_agreement 함수로 검증")
        print("-" * 80)
        
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
                
                marketing_data = terms_detail.get('terms_marketing', {})
                if isinstance(marketing_data, dict):
                    terms_details['terms_marketing'] = marketing_data.get('agreed', False)
                else:
                    terms_details['terms_marketing'] = bool(marketing_data)
            elif terms_status_row.get('terms_agreement'):
                terms = terms_status_row['terms_agreement']
                if isinstance(terms, str):
                    terms = json.loads(terms)
                
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
        
        # 파트너 결제 정보
        if patient['partner_id']:
            print("4️⃣ 파트너 결제 정보")
            print("-" * 80)
            
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
            else:
                print("❌ 결제 정보 없음")
        else:
            print("4️⃣ 파트너 결제 정보")
            print("-" * 80)
            print("ℹ️  웰노 유저 (파트너 정보 없음)")
        
        print()
        print("=" * 80)
        print("✅ 조회 완료")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_health(uuid: str, hospital_id: str = "PEERNINE"):
    """건강데이터 확인"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🔍 건강데이터 확인: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
        # 환자 정보
        patient_info = await conn.fetchrow("""
            SELECT id, name, phone_number, has_health_data, has_prescription_data, last_data_update
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient_info:
            print("❌ 환자 정보를 찾을 수 없습니다.")
            return
        
        print("📋 환자 정보:")
        print(f"   - 이름: {patient_info['name']}")
        print(f"   - 전화번호: {patient_info['phone_number']}")
        print(f"   - has_health_data: {patient_info['has_health_data']}")
        print(f"   - has_prescription_data: {patient_info['has_prescription_data']}")
        print(f"   - last_data_update: {patient_info['last_data_update']}")
        print()
        
        # 건강검진 데이터
        health_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_checkup_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        print(f"🏥 건강검진 데이터: {health_count}건")
        
        if health_count > 0:
            health_rows = await conn.fetch("""
                SELECT year, checkup_date, location, code, data_source, created_at
                FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
                LIMIT 10
            """, uuid, hospital_id)
            
            for idx, row in enumerate(health_rows, 1):
                print(f"   {idx}. {row['year']}년 {row['checkup_date']} - {row['location']} ({row['code']}) [{row['data_source']}]")
        print()
        
        # 처방전 데이터
        prescription_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        print(f"💊 처방전 데이터: {prescription_count}건")
        
        if prescription_count > 0:
            prescription_rows = await conn.fetch("""
                SELECT hospital_name, treatment_date, treatment_type, data_source, created_at
                FROM welno.welno_prescription_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY treatment_date DESC
                LIMIT 10
            """, uuid, hospital_id)
            
            for idx, row in enumerate(prescription_rows, 1):
                print(f"   {idx}. {row['treatment_date']} - {row['hospital_name']} ({row['treatment_type']}) [{row['data_source']}]")
        print()
        
        print("=" * 80)
        print("✅ 조회 완료")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_design(uuid: str, hospital_id: str = "PEERNINE"):
    """검진 설계 데이터 확인"""
    db_config = get_db_config()
    conn = await asyncpg.connect(**db_config)
    
    try:
        print("=" * 80)
        print(f"🔍 검진 설계 데이터 확인: UUID={uuid}, Hospital={hospital_id}")
        print("=" * 80)
        print()
        
        # 환자 ID 조회
        patient = await conn.fetchrow("""
            SELECT id, name FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if not patient:
            print(f"❌ 환자를 찾을 수 없습니다: {uuid}")
            return
        
        print(f"✅ 환자: {patient['name']} (ID: {patient['id']})")
        print()
        
        # 검진 설계 요청 조회
        designs = await conn.fetch("""
            SELECT 
                id, status,
                design_result IS NOT NULL as has_design_result,
                CASE 
                    WHEN design_result IS NOT NULL THEN 
                        jsonb_typeof(design_result)
                    ELSE NULL
                END as design_result_type,
                created_at, updated_at
            FROM welno.welno_checkup_design_requests
            WHERE uuid = $1 AND hospital_id = $2
            ORDER BY created_at DESC
        """, uuid, hospital_id)
        
        print(f"📋 검진 설계 요청: {len(designs)}건")
        print()
        
        for idx, design in enumerate(designs, 1):
            print(f"[{idx}] ID: {design['id']}")
            print(f"    상태: {design['status']}")
            print(f"    design_result 있음: {design['has_design_result']}")
            print(f"    design_result 타입: {design['design_result_type']}")
            print(f"    생성: {design['created_at']}")
            print(f"    수정: {design['updated_at']}")
            print()
        
        # 가장 최근 완료된 설계 상세 조회
        latest = await conn.fetchrow("""
            SELECT design_result
            FROM welno.welno_checkup_design_requests
            WHERE uuid = $1 AND hospital_id = $2
              AND status = 'step2_completed'
              AND design_result IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """, uuid, hospital_id)
        
        if latest and latest['design_result']:
            result = latest['design_result']
            if isinstance(result, str):
                result = json.loads(result)
            
            print("=" * 80)
            print("🎯 최신 완료된 설계 결과 구조:")
            print("=" * 80)
            print(f"최상위 키: {list(result.keys())}")
            print()
            
            if 'priority_1' in result:
                p1 = result['priority_1']
                print(f"✅ priority_1: {p1.get('title', 'N/A')}")
                print(f"   항목 수: {len(p1.get('items', []))}")
            
            if 'priority_2' in result:
                p2 = result['priority_2']
                print(f"✅ priority_2: {p2.get('title', 'N/A')}")
                print(f"   항목 수: {len(p2.get('items', []))}")
            
            if 'priority_3' in result:
                p3 = result['priority_3']
                print(f"✅ priority_3: {p3.get('title', 'N/A')}")
                print(f"   항목 수: {len(p3.get('items', []))}")
        else:
            print("❌ 완료된 설계 결과가 없습니다.")
        
        print()
        print("=" * 80)
        print("✅ 조회 완료")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_status(uuid: str, api_key: str = None, encrypted_data: str = None):
    """파트너 상태 확인 (어떤 화면으로 가야 하는지)"""
    print("=" * 80)
    print(f"🔍 파트너 상태 확인: UUID={uuid}")
    if api_key:
        print(f"   API Key: {api_key[:8]}...")
    if encrypted_data:
        print(f"   Encrypted Data: {encrypted_data[:50]}...")
    print("=" * 80)
    print()
    
    # 백엔드 API 호출
    api_url = os.getenv('API_BASE_URL', 'http://localhost:8082')
    endpoint = f"{api_url}/api/v1/disease-report/check-partner-status"
    
    payload = {
        "uuid": uuid
    }
    if api_key:
        payload["api_key"] = api_key
    if encrypted_data:
        payload["data"] = encrypted_data
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(endpoint, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    print("1️⃣ 상태 체크 결과")
                    print("-" * 80)
                    print(f"   - Case ID: {result.get('case_id', 'N/A')}")
                    print(f"   - Action: {result.get('action', 'N/A')}")
                    print(f"   - Message: {result.get('message', 'N/A')}")
                    print()
                    
                    print("2️⃣ 상태 정보")
                    print("-" * 80)
                    print(f"   - 리포트 있음: {result.get('has_report', False)}")
                    print(f"   - 건강데이터 있음: {result.get('has_checkup_data', False)}")
                    print(f"   - 결제 완료: {result.get('has_payment', False)}")
                    print(f"   - 결제 필요: {result.get('requires_payment', False)}")
                    if result.get('payment_amount'):
                        print(f"   - 결제 금액: {result.get('payment_amount'):,}원")
                    print(f"   - 웰노 유저: {result.get('is_welno_user', False)}")
                    print(f"   - 파트너 ID: {result.get('partner_id', 'N/A')}")
                    print()
                    
                    print("3️⃣ 리다이렉트 정보")
                    print("-" * 80)
                    redirect_url = result.get('redirect_url')
                    if redirect_url:
                        print(f"   ✅ 리다이렉트 URL: {redirect_url}")
                    else:
                        print(f"   ℹ️  리다이렉트 URL 없음 (IntroLandingPage 표시)")
                    print()
                    
                    print("4️⃣ 화면 이동 안내")
                    print("-" * 80)
                    action = result.get('action', 'show_intro')
                    action_map = {
                        'show_report': '리포트 페이지로 이동',
                        'show_terms_modal': 'IntroLandingPage → 플로팅 버튼 클릭 시 약관 모달',
                        'show_payment': 'IntroLandingPage → 결제 버튼 표시',
                        'redirect_to_auth': 'IntroLandingPage → 인증 버튼 표시',
                        'redirect_to_auth_auto': 'IntroLandingPage → 인증 버튼 표시 (자동)',
                        'show_loading': 'IntroLandingPage → 로딩 표시',
                        'show_expired_message': '만료 메시지 표시',
                        'show_intro': 'IntroLandingPage 표시'
                    }
                    print(f"   → {action_map.get(action, action)}")
                    print()
                    
                    print("=" * 80)
                    print("✅ 상태 확인 완료")
                    print("=" * 80)
                    
                else:
                    error_text = await response.text()
                    print(f"❌ API 오류: HTTP {response.status}")
                    print(f"   {error_text}")
                    
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description='환자 조회/관리 통합 스크립트')
    subparsers = parser.add_subparsers(dest='command', help='서브커맨드')
    
    # check 명령
    check_parser = subparsers.add_parser('check', help='UUID로 환자 정보 조회')
    check_parser.add_argument('uuid', help='환자 UUID')
    check_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # list 명령
    list_parser = subparsers.add_parser('list', help='전체 환자 목록 조회')
    list_parser.add_argument('--welno', action='store_true', help='웰노 유저만 조회')
    list_parser.add_argument('--partner', action='store_true', help='파트너사 유저만 조회')
    
    # terms 명령
    terms_parser = subparsers.add_parser('terms', help='약관 동의 데이터 확인')
    terms_parser.add_argument('uuid', help='환자 UUID')
    terms_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # health 명령
    health_parser = subparsers.add_parser('health', help='건강데이터 확인')
    health_parser.add_argument('uuid', help='환자 UUID')
    health_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # design 명령
    design_parser = subparsers.add_parser('design', help='검진 설계 데이터 확인')
    design_parser.add_argument('uuid', help='환자 UUID')
    design_parser.add_argument('hospital_id', nargs='?', default='PEERNINE', help='병원 ID (기본값: PEERNINE)')
    
    # status 명령
    status_parser = subparsers.add_parser('status', help='파트너 상태 확인 (어떤 화면으로 가야 하는지)')
    status_parser.add_argument('uuid', help='환자 UUID')
    status_parser.add_argument('--api-key', help='API Key')
    status_parser.add_argument('--data', help='암호화된 데이터')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'check':
        asyncio.run(cmd_check(args.uuid, args.hospital_id))
    elif args.command == 'list':
        asyncio.run(cmd_list(welno_only=args.welno, partner_only=args.partner))
    elif args.command == 'terms':
        asyncio.run(cmd_terms(args.uuid, args.hospital_id))
    elif args.command == 'health':
        asyncio.run(cmd_health(args.uuid, args.hospital_id))
    elif args.command == 'design':
        asyncio.run(cmd_design(args.uuid, args.hospital_id))
    elif args.command == 'status':
        asyncio.run(cmd_status(args.uuid, api_key=getattr(args, 'api_key', None), encrypted_data=getattr(args, 'data', None)))


if __name__ == "__main__":
    main()
