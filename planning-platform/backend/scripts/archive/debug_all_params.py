#!/usr/bin/env python3
"""
WelnoDataService의 모든 파라미터 값 확인
"""
import asyncio
import json
import os
import sys
from dotenv import load_dotenv

# 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

# WelnoDataService를 수정해서 파라미터를 출력하도록 임시 패치
class DebugWelnoDataService:
    def __init__(self):
        import os
        self.db_config = {
            'host': os.getenv('DB_HOST', '10.0.1.10'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
            'user': os.getenv('DB_USER', 'peernine'),
            'password': os.getenv('DB_PASSWORD', 'autumn3334!')
        }
    
    def _extract_key_value_mapping(self, item):
        """키값 매핑 생성 (더미)"""
        return {"height": 181.3, "weight": 82.2}
    
    async def save_health_data(self, patient_uuid: str, hospital_id: str, health_data: dict, 
                              session_id: str, data_source: str = 'tilko', 
                              partner_id=None, partner_oid=None) -> bool:
        """디버깅용 save_health_data"""
        import asyncpg
        from datetime import datetime
        
        conn = None
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 데이터 출처 검증
            if data_source not in ('tilko', 'indexeddb', 'partner'):
                data_source = 'tilko'  # 기본값
            
            # IndexedDB 동기화 시간 설정
            indexeddb_synced_at = None
            if data_source == 'indexeddb':
                indexeddb_synced_at = datetime.now()
            
            # 트랜잭션 시작 - 데이터 안전성 보장
            async with conn.transaction():
                await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", 
                                 patient_uuid, hospital_id)
                
                result_list = health_data.get('ResultList', [])
                saved_count = 0
                
                # 스키마에 맞춰 모든 컬럼 포함 + JSONB 명시적 캐스팅
                insert_query = """
                    INSERT INTO welno.welno_checkup_data 
                    (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                     data_source, indexeddb_synced_at, partner_id, partner_oid)
                    VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                """
                
                for item in result_list:
                    year = item.get('Year')
                    checkup_date = item.get('CheckUpDate')
                    location = item.get('Location')
                    code = item.get('Code')
                    description = item.get('Description', '')
                    
                    # 타입 변환 (None 처리 및 문자열 변환)
                    year = str(year) if year else None
                    checkup_date = str(checkup_date) if checkup_date else None
                    location = str(location) if location else ''  # None 대신 빈 문자열
                    code = str(code) if code else ''  # None 대신 빈 문자열
                    description = str(description) if description else ''  # None 대신 빈 문자열
                    
                    # raw_data를 JSONB로 변환 (asyncpg 호환)
                    raw_data_json = json.dumps(item, ensure_ascii=False)  # dict -> JSON 문자열
                    
                    # 키값 매핑 구조 생성 (인덱스 기반 → 키값 매핑 변환)
                    key_value_mapping = self._extract_key_value_mapping(item)
                    
                    # 수치 추출 (생략 가능) - 기존 방식 유지
                    height = weight = bmi = bp_high = blood_sugar = cholesterol = None
                    
                    # 🔍 모든 파라미터 값 출력
                    print("\\n=== 🔍 모든 파라미터 값 확인 ===")
                    params = [
                        patient_uuid, hospital_id, raw_data_json,
                        year, checkup_date, location, code, description,
                        data_source, indexeddb_synced_at, partner_id, partner_oid
                    ]
                    
                    for i, param in enumerate(params, 1):
                        param_type = type(param).__name__
                        param_len = len(str(param)) if param is not None else 0
                        print(f"${i:2d}: {param_type:12} | 길이: {param_len:4d} | 값: {str(param)[:50]}{'...' if param and len(str(param)) > 50 else ''}")
                    
                    print("\\n🔄 conn.execute 실행...")
                    await conn.execute(
                        insert_query,
                        patient_uuid, hospital_id, raw_data_json,
                        year, checkup_date, location, code, description,
                        data_source, indexeddb_synced_at, partner_id, partner_oid
                    )
                    
                    print("✅ conn.execute 성공!")
                    saved_count += 1
                
                # 환자 테이블 업데이트 (데이터 출처 및 동기화 시간 포함)
                update_patient_query = """
                    UPDATE welno.welno_patients 
                    SET has_health_data = TRUE, 
                        last_data_update = NOW(),
                        data_source = $3,
                        last_indexeddb_sync_at = CASE WHEN $3 = 'indexeddb' THEN NOW() ELSE last_indexeddb_sync_at END,
                        last_partner_sync_at = CASE WHEN $3 = 'partner' THEN NOW() ELSE last_partner_sync_at END
                    WHERE uuid = $1 AND hospital_id = $2
                """
                await conn.execute(update_patient_query, patient_uuid, hospital_id, data_source)
            
            print(f"✅ [건강검진저장] {saved_count}건 저장 완료 (출처: {data_source})")
            return True
            
        except Exception as e:
            print(f"❌ [건강검진저장] 오류: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            if conn and not conn.is_closed():
                await conn.close()

async def debug_all_params():
    """모든 파라미터 값 확인"""
    
    print("=== 모든 파라미터 값 확인 ===")
    
    # 실제 파일에서 데이터 로드
    health_file_path = '/home/workspace/PROJECT_WELLO_BEFE/tilko_data/failed/20260131_021152_350_db94260e-5e97-41c8-89f1-ddaf2ca43a7d_health_data.json'
    
    with open(health_file_path, 'r', encoding='utf-8') as f:
        file_data = json.load(f)
    
    # 메타데이터에서 정보 추출
    metadata = file_data.get('metadata', {})
    raw_data = file_data.get('raw_data', {})
    
    patient_uuid = metadata.get('patient_uuid')
    hospital_id = metadata.get('hospital_id')
    session_id = metadata.get('session_id')
    
    # 디버깅용 서비스 사용
    service = DebugWelnoDataService()
    
    try:
        result = await service.save_health_data(
            patient_uuid=patient_uuid,
            hospital_id=hospital_id,
            health_data=raw_data,
            session_id=session_id
        )
        
        if result:
            print("\\n✅ 디버깅용 save_health_data 성공!")
        else:
            print("\\n❌ 디버깅용 save_health_data 실패!")
            
    except Exception as e:
        print(f"\\n❌ 디버깅용 예외 발생: {e}")

if __name__ == "__main__":
    asyncio.run(debug_all_params())