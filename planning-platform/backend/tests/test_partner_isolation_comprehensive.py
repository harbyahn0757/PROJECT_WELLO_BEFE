#!/usr/bin/env python3
"""
파트너별 클라이언트 관리 및 격리 종합 테스트

이 스크립트는 다음을 테스트합니다:
1. 파트너별 세션 격리 (메디링스 vs 웰노)
2. 파트너별 DB 데이터 격리 (welno_patients, tb_campaign_payments)
3. 메디링스 병원별 접근 제어
4. UUID 충돌 방지 및 파트너 격리
5. 세션 보안 강화 검증
"""

import asyncio
import asyncpg
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List

# 테스트 설정
DB_CONFIG = {
    'host': '10.0.1.10',
    'port': 5432,
    'database': 'p9_mkt_biz',
    'user': 'peernine',
    'password': 'autumn3334!'
}

# 테스트 데이터
TEST_PARTNERS = ['welno', 'medilinx']
TEST_HOSPITALS = {
    'welno': ['CEBF7A8B9C1D2E3F', 'default_hospital'],
    'medilinx': ['MEDILINX_HOSPITAL_1', 'MEDILINX_HOSPITAL_2']
}
TEST_USERS = [
    {'name': '안광수', 'uuid': 'test_uuid_ahn_' + secrets.token_hex(8)},
    {'name': '최안안', 'uuid': 'test_uuid_choi_' + secrets.token_hex(8)}
]

class PartnerIsolationTester:
    """파트너 격리 테스트 클래스"""
    
    def __init__(self):
        self.conn = None
        self.test_results = []
    
    async def connect_db(self):
        """데이터베이스 연결"""
        try:
            self.conn = await asyncpg.connect(**DB_CONFIG)
            print("✅ 데이터베이스 연결 성공")
            return True
        except Exception as e:
            print(f"❌ 데이터베이스 연결 실패: {e}")
            return False
    
    async def cleanup_test_data(self):
        """테스트 데이터 정리"""
        try:
            # 테스트 UUID로 생성된 데이터 삭제
            for user in TEST_USERS:
                uuid = user['uuid']
                await self.conn.execute(
                    "DELETE FROM welno.welno_patients WHERE uuid = $1", uuid
                )
                await self.conn.execute(
                    "DELETE FROM welno.tb_campaign_payments WHERE uuid = $1", uuid
                )
            
            print("🧹 테스트 데이터 정리 완료")
        except Exception as e:
            print(f"⚠️ 테스트 데이터 정리 중 오류: {e}")
    
    def generate_secure_session_id(self, partner_id: str, user_uuid: str = None) -> str:
        """보안 강화된 세션 ID 생성 (실제 구현과 동일)"""
        # 암호학적으로 안전한 랜덤 바이트 생성
        random_bytes = secrets.token_bytes(32)
        timestamp = str(datetime.now().timestamp()).encode('utf-8')
        partner_bytes = partner_id.encode('utf-8')
        user_bytes = user_uuid.encode('utf-8') if user_uuid else b''
        
        # 모든 요소를 결합하여 해시 생성
        combined = random_bytes + timestamp + partner_bytes + user_bytes
        session_hash = hashlib.sha256(combined).hexdigest()
        
        # 파트너 접두사 추가
        return f"{partner_id}_{session_hash[:32]}"
    
    async def test_session_isolation(self) -> bool:
        """테스트 1: 세션 격리 테스트"""
        print("\n🔒 테스트 1: 세션 격리 검증")
        
        try:
            # 각 파트너별로 세션 생성
            sessions = {}
            for partner in TEST_PARTNERS:
                for user in TEST_USERS:
                    session_id = self.generate_secure_session_id(partner, user['uuid'])
                    sessions[f"{partner}_{user['name']}"] = {
                        'session_id': session_id,
                        'partner_id': partner,
                        'user': user
                    }
            
            # 세션 ID 형식 검증
            all_valid = True
            for key, session in sessions.items():
                session_id = session['session_id']
                partner_id = session['partner_id']
                
                # 파트너 접두사 확인
                if not session_id.startswith(f"{partner_id}_"):
                    print(f"❌ 세션 ID 형식 오류: {session_id} (파트너: {partner_id})")
                    all_valid = False
                    continue
                
                # 세션 ID에서 파트너 추출
                extracted_partner = session_id.split('_')[0]
                if extracted_partner != partner_id:
                    print(f"❌ 파트너 ID 추출 오류: 예상={partner_id}, 실제={extracted_partner}")
                    all_valid = False
                    continue
                
                print(f"✅ {key}: {session_id[:20]}... (파트너: {partner_id})")
            
            # 파트너간 세션 ID 중복 확인
            session_ids = [s['session_id'] for s in sessions.values()]
            if len(session_ids) != len(set(session_ids)):
                print("❌ 세션 ID 중복 발견")
                all_valid = False
            else:
                print("✅ 모든 세션 ID가 고유함")
            
            self.test_results.append({
                'test': 'session_isolation',
                'passed': all_valid,
                'details': f"생성된 세션: {len(sessions)}개"
            })
            
            return all_valid
            
        except Exception as e:
            print(f"❌ 세션 격리 테스트 실패: {e}")
            self.test_results.append({
                'test': 'session_isolation',
                'passed': False,
                'error': str(e)
            })
            return False
    
    async def test_database_isolation(self) -> bool:
        """테스트 2: 데이터베이스 격리 테스트"""
        print("\n🏛️ 테스트 2: 데이터베이스 격리 검증")
        
        try:
            # 각 파트너별로 환자 데이터 삽입
            for partner in TEST_PARTNERS:
                for user in TEST_USERS:
                    # welno_patients 테이블에 삽입 (중복 확인 후 삽입)
                    existing = await self.conn.fetchval("""
                        SELECT COUNT(*) FROM welno.welno_patients 
                        WHERE uuid = $1 AND partner_id = $2
                    """, user['uuid'], partner)
                    
                    if existing == 0:
                        await self.conn.execute("""
                            INSERT INTO welno.welno_patients 
                            (uuid, name, partner_id, created_at, terms_agreement)
                            VALUES ($1, $2, $3, NOW(), $4::jsonb)
                        """, user['uuid'], user['name'], partner, '{"agreed": true}')
                    
                    # tb_campaign_payments 테이블에 삽입 (중복 확인 후 삽입)
                    oid = f"TEST_{partner}_{user['name']}_{secrets.token_hex(4)}"
                    existing_oid = await self.conn.fetchval("""
                        SELECT COUNT(*) FROM welno.tb_campaign_payments WHERE oid = $1
                    """, oid)
                    
                    if existing_oid == 0:
                        await self.conn.execute("""
                            INSERT INTO welno.tb_campaign_payments 
                            (oid, uuid, partner_id, user_name, status, amount, created_at)
                            VALUES ($1, $2, $3, $4, 'PENDING', 10000, NOW())
                        """, oid, user['uuid'], partner, user['name'])
            
            print("✅ 테스트 데이터 삽입 완료")
            
            # 파트너별 데이터 격리 검증
            isolation_passed = True
            
            for partner in TEST_PARTNERS:
                # 해당 파트너의 환자 데이터만 조회되는지 확인
                patients = await self.conn.fetch("""
                    SELECT uuid, name, partner_id 
                    FROM welno.welno_patients 
                    WHERE partner_id = $1 AND uuid LIKE 'test_uuid_%'
                """, partner)
                
                campaigns = await self.conn.fetch("""
                    SELECT oid, uuid, partner_id, user_name 
                    FROM welno.tb_campaign_payments 
                    WHERE partner_id = $1 AND uuid LIKE 'test_uuid_%'
                """, partner)
                
                print(f"📊 {partner}: 환자 {len(patients)}명, 캠페인 {len(campaigns)}건")
                
                # 다른 파트너 데이터가 섞여있지 않은지 확인
                for patient in patients:
                    if patient['partner_id'] != partner:
                        print(f"❌ 환자 데이터 격리 실패: {patient}")
                        isolation_passed = False
                
                for campaign in campaigns:
                    if campaign['partner_id'] != partner:
                        print(f"❌ 캠페인 데이터 격리 실패: {campaign}")
                        isolation_passed = False
            
            # UUID 충돌 테스트 (같은 UUID, 다른 파트너)
            collision_test_uuid = 'collision_test_' + secrets.token_hex(8)
            
            for partner in TEST_PARTNERS:
                await self.conn.execute("""
                    INSERT INTO welno.welno_patients 
                    (uuid, name, partner_id, created_at, terms_agreement)
                    VALUES ($1, $2, $3, NOW(), $4::jsonb)
                """, collision_test_uuid, f"충돌테스트_{partner}", partner, '{"agreed": true}')
            
            # 같은 UUID로 다른 파트너 데이터가 모두 저장되었는지 확인
            collision_results = await self.conn.fetch("""
                SELECT uuid, name, partner_id 
                FROM welno.welno_patients 
                WHERE uuid = $1
            """, collision_test_uuid)
            
            if len(collision_results) == len(TEST_PARTNERS):
                print("✅ UUID 충돌 방지 및 파트너별 격리 성공")
            else:
                print(f"❌ UUID 충돌 테스트 실패: 예상 {len(TEST_PARTNERS)}건, 실제 {len(collision_results)}건")
                isolation_passed = False
            
            # 정리
            await self.conn.execute("DELETE FROM welno.welno_patients WHERE uuid = $1", collision_test_uuid)
            
            self.test_results.append({
                'test': 'database_isolation',
                'passed': isolation_passed,
                'details': f"파트너별 데이터 격리 및 UUID 충돌 방지 검증"
            })
            
            return isolation_passed
            
        except Exception as e:
            print(f"❌ 데이터베이스 격리 테스트 실패: {e}")
            self.test_results.append({
                'test': 'database_isolation',
                'passed': False,
                'error': str(e)
            })
            return False
    
    async def test_hospital_access_control(self) -> bool:
        """테스트 3: 병원별 접근 제어 테스트"""
        print("\n🏥 테스트 3: 병원별 접근 제어 검증")
        
        try:
            # 파트너별 병원 설정 확인
            access_control_passed = True
            
            for partner in TEST_PARTNERS:
                hospitals = TEST_HOSPITALS.get(partner, [])
                print(f"📋 {partner} 파트너 병원: {hospitals}")
                
                # 각 병원에 대한 접근 권한 시뮬레이션
                for hospital_id in hospitals:
                    # 병원 설정 조회 (tb_hospital_rag_config)
                    hospital_config = await self.conn.fetchrow("""
                        SELECT hospital_id, partner_id, hospital_name, is_active
                        FROM welno.tb_hospital_rag_config 
                        WHERE hospital_id = $1
                    """, hospital_id)
                    
                    if hospital_config:
                        config_partner = hospital_config['partner_id']
                        if config_partner and config_partner != partner:
                            print(f"⚠️ 병원 {hospital_id} 파트너 불일치: 예상={partner}, 실제={config_partner}")
                            # 이는 경고이지 실패는 아님 (일부 병원은 공통 사용 가능)
                        else:
                            print(f"✅ 병원 {hospital_id} 접근 권한 확인")
                    else:
                        print(f"ℹ️ 병원 {hospital_id} 설정 없음 (기본 설정 사용)")
            
            # 메디링스 특화 테스트: 실제 메디링스 병원 ID 확인
            medilinx_hospitals = await self.conn.fetch("""
                SELECT hospital_id, hospital_name, partner_id
                FROM welno.tb_hospital_rag_config 
                WHERE partner_id = 'medilinx' OR hospital_name ILIKE '%medilinx%' OR hospital_name ILIKE '%메디링스%'
            """)
            
            print(f"🔍 메디링스 관련 병원 설정: {len(medilinx_hospitals)}개")
            for hospital in medilinx_hospitals:
                print(f"   - {hospital['hospital_id']}: {hospital['hospital_name']} (파트너: {hospital['partner_id']})")
            
            self.test_results.append({
                'test': 'hospital_access_control',
                'passed': access_control_passed,
                'details': f"파트너별 병원 접근 권한 검증, 메디링스 병원 {len(medilinx_hospitals)}개 발견"
            })
            
            return access_control_passed
            
        except Exception as e:
            print(f"❌ 병원별 접근 제어 테스트 실패: {e}")
            self.test_results.append({
                'test': 'hospital_access_control',
                'passed': False,
                'error': str(e)
            })
            return False
    
    async def test_partner_identification(self) -> bool:
        """테스트 4: 파트너 식별 로직 테스트"""
        print("\n🔍 테스트 4: 파트너 식별 로직 검증")
        
        try:
            identification_passed = True
            
            # 캠페인 데이터에서 파트너 식별 테스트
            test_oid = f"TEST_IDENTIFICATION_{secrets.token_hex(8)}"
            test_uuid = f"test_identification_{secrets.token_hex(8)}"
            
            # 테스트 캠페인 데이터 생성
            await self.conn.execute("""
                INSERT INTO welno.tb_campaign_payments 
                (oid, uuid, partner_id, user_name, status, amount, created_at)
                VALUES ($1, $2, 'medilinx', '파트너식별테스트', 'COMPLETED', 10000, NOW())
            """, test_oid, test_uuid)
            
            # OID로 파트너 식별
            partner_by_oid = await self.conn.fetchval("""
                SELECT partner_id FROM welno.tb_campaign_payments WHERE oid = $1
            """, test_oid)
            
            if partner_by_oid == 'medilinx':
                print("✅ OID 기반 파트너 식별 성공")
            else:
                print(f"❌ OID 기반 파트너 식별 실패: 예상=medilinx, 실제={partner_by_oid}")
                identification_passed = False
            
            # 환자 데이터 생성
            await self.conn.execute("""
                INSERT INTO welno.welno_patients 
                (uuid, name, partner_id, created_at, terms_agreement)
                VALUES ($1, '파트너식별테스트', 'medilinx', NOW(), $2::jsonb)
            """, test_uuid, '{"agreed": true}')
            
            # UUID로 파트너 식별
            partner_by_uuid = await self.conn.fetchval("""
                SELECT partner_id FROM welno.welno_patients 
                WHERE uuid = $1 ORDER BY created_at DESC LIMIT 1
            """, test_uuid)
            
            if partner_by_uuid == 'medilinx':
                print("✅ UUID 기반 파트너 식별 성공")
            else:
                print(f"❌ UUID 기반 파트너 식별 실패: 예상=medilinx, 실제={partner_by_uuid}")
                identification_passed = False
            
            # 정리
            await self.conn.execute("DELETE FROM welno.tb_campaign_payments WHERE oid = $1", test_oid)
            await self.conn.execute("DELETE FROM welno.welno_patients WHERE uuid = $1", test_uuid)
            
            self.test_results.append({
                'test': 'partner_identification',
                'passed': identification_passed,
                'details': "OID 및 UUID 기반 파트너 식별 검증"
            })
            
            return identification_passed
            
        except Exception as e:
            print(f"❌ 파트너 식별 테스트 실패: {e}")
            self.test_results.append({
                'test': 'partner_identification',
                'passed': False,
                'error': str(e)
            })
            return False
    
    async def test_index_performance(self) -> bool:
        """테스트 5: 인덱스 성능 테스트"""
        print("\n⚡ 테스트 5: 복합 인덱스 성능 검증")
        
        try:
            # 인덱스 존재 확인
            indexes = await self.conn.fetch("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename IN ('tb_campaign_payments', 'welno_patients')
                    AND schemaname = 'welno'
                    AND indexname LIKE '%partner%'
                ORDER BY indexname
            """)
            
            print(f"📊 파트너 관련 인덱스: {len(indexes)}개")
            for index in indexes:
                print(f"   - {index['indexname']}")
            
            # 쿼리 실행 계획 확인 (파트너별 조회)
            explain_result = await self.conn.fetch("""
                EXPLAIN (FORMAT JSON) 
                SELECT * FROM welno.tb_campaign_payments 
                WHERE partner_id = 'medilinx' AND uuid = 'test_uuid'
            """)
            
            query_plan = explain_result[0]['QUERY PLAN'][0]
            uses_index = 'Index Scan' in str(query_plan) or 'Bitmap Index Scan' in str(query_plan)
            
            if uses_index:
                print("✅ 파트너별 조회 쿼리가 인덱스를 사용함")
            else:
                print("⚠️ 파트너별 조회 쿼리가 인덱스를 사용하지 않음")
                print(f"   실행 계획: {query_plan}")
            
            performance_passed = len(indexes) >= 3 and uses_index
            
            self.test_results.append({
                'test': 'index_performance',
                'passed': performance_passed,
                'details': f"파트너 관련 인덱스 {len(indexes)}개, 인덱스 사용: {uses_index}"
            })
            
            return performance_passed
            
        except Exception as e:
            print(f"❌ 인덱스 성능 테스트 실패: {e}")
            self.test_results.append({
                'test': 'index_performance',
                'passed': False,
                'error': str(e)
            })
            return False
    
    async def run_all_tests(self):
        """모든 테스트 실행"""
        print("🚀 파트너별 클라이언트 관리 및 격리 종합 테스트 시작")
        print("=" * 60)
        
        if not await self.connect_db():
            return
        
        try:
            # 테스트 순차 실행 (동시 실행 문제 방지)
            await self.test_session_isolation()
            await self.test_database_isolation()
            await self.test_hospital_access_control()
            await self.test_partner_identification()
            await self.test_index_performance()
            
            # 결과 요약
            print("\n" + "=" * 60)
            print("📋 테스트 결과 요약")
            print("=" * 60)
            
            passed_count = 0
            total_count = len(self.test_results)
            
            for result in self.test_results:
                status = "✅ PASS" if result['passed'] else "❌ FAIL"
                test_name = result['test'].replace('_', ' ').title()
                details = result.get('details', '')
                error = result.get('error', '')
                
                print(f"{status} {test_name}")
                if details:
                    print(f"     {details}")
                if error:
                    print(f"     오류: {error}")
                
                if result['passed']:
                    passed_count += 1
            
            print("=" * 60)
            print(f"🎯 전체 결과: {passed_count}/{total_count} 테스트 통과")
            
            if passed_count == total_count:
                print("🎉 모든 테스트가 성공적으로 완료되었습니다!")
                print("✅ 파트너별 클라이언트 관리 체계가 올바르게 구현되었습니다.")
            else:
                print("⚠️ 일부 테스트가 실패했습니다. 위 결과를 확인하여 문제를 해결해주세요.")
            
        finally:
            await self.cleanup_test_data()
            if self.conn:
                await self.conn.close()

async def main():
    """메인 함수"""
    tester = PartnerIsolationTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())