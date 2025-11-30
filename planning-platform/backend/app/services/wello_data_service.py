"""
WELLO 건강정보 데이터 저장 및 관리 서비스
"""

import json
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
import asyncpg

class WelloDataService:
    """WELLO 건강정보 데이터 관리 서비스"""
    
    def __init__(self):
        self.db_config = {
            "host": "10.0.1.10",
            "port": "5432", 
            "database": "p9_mkt_biz",
            "user": "peernine",
            "password": "autumn3334!"
        }
    
    async def check_existing_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """기존 데이터 존재 여부 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                       has_health_data, has_prescription_data, last_data_update, last_auth_at
                FROM wello.wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                return {
                    "exists": False,
                    "patient": None,
                    "health_data_count": 0,
                    "prescription_data_count": 0,
                    "last_update": None
                }
            
            # 건강검진 데이터 개수 조회 (patient_uuid 기준)
            health_count_query = "SELECT COUNT(*) FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2"
            health_count = await conn.fetchval(health_count_query, uuid, hospital_id)
            
            # 처방전 데이터 개수 조회 (patient_uuid 기준)
            prescription_count_query = "SELECT COUNT(*) FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2"
            prescription_count = await conn.fetchval(prescription_count_query, uuid, hospital_id)
            
            await conn.close()
            
            return {
                "exists": True,
                "patient": dict(patient_row),
                "health_data_count": health_count,
                "prescription_data_count": prescription_count,
                "last_update": patient_row['last_data_update']
            }
            
        except Exception as e:
            print(f"❌ [데이터확인] 오류: {e}")
            return {
                "exists": False,
                "error": str(e)
            }

    async def login_patient(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자 로그인 처리"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                       has_health_data, has_prescription_data, last_data_update, last_auth_at
                FROM wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 마지막 로그인 시간 업데이트
            update_query = """
                UPDATE wello_patients 
                SET last_auth_at = NOW()
                WHERE uuid = $1 AND hospital_id = $2
            """
            await conn.execute(update_query, uuid, hospital_id)
            
            # 환자 정보를 딕셔너리로 변환
            patient_dict = dict(patient_row)
            
            # 날짜 객체를 문자열로 변환
            if patient_dict.get('birth_date'):
                patient_dict['birth_date'] = patient_dict['birth_date'].isoformat()
            if patient_dict.get('last_data_update'):
                patient_dict['last_data_update'] = patient_dict['last_data_update'].isoformat()
            if patient_dict.get('last_auth_at'):
                patient_dict['last_auth_at'] = patient_dict['last_auth_at'].isoformat()
            
            await conn.close()
            
            return {
                "patient": patient_dict,
                "login_time": datetime.now().isoformat(),
                "message": "로그인 성공"
            }
            
        except Exception as e:
            print(f"❌ 로그인 처리 실패: {e}")
            return {"error": f"로그인 처리 중 오류가 발생했습니다: {str(e)}"}

    async def get_patient_by_uuid(self, uuid: str) -> Dict[str, Any]:
        """UUID로 환자 정보 조회 (wello.wello_patients 테이블만 조회)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                       has_health_data, has_prescription_data, last_data_update, last_auth_at,
                       created_at, updated_at
                FROM wello.wello_patients 
                WHERE uuid = $1
            """
            patient_row = await conn.fetchrow(patient_query, uuid)
            await conn.close()
            
            if not patient_row:
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 환자 정보를 딕셔너리로 변환
            patient_dict = dict(patient_row)
            
            # 날짜 객체를 문자열로 변환
            if patient_dict.get('birth_date'):
                if isinstance(patient_dict['birth_date'], date):
                    patient_dict['birth_date'] = patient_dict['birth_date'].isoformat()
            if patient_dict.get('last_data_update'):
                patient_dict['last_data_update'] = patient_dict['last_data_update'].isoformat()
            if patient_dict.get('last_auth_at'):
                patient_dict['last_auth_at'] = patient_dict['last_auth_at'].isoformat()
            if patient_dict.get('created_at'):
                patient_dict['created_at'] = patient_dict['created_at'].isoformat()
            if patient_dict.get('updated_at'):
                patient_dict['updated_at'] = patient_dict['updated_at'].isoformat()
            
            await conn.close()
            
            return patient_dict
            
        except Exception as e:
            print(f"❌ 환자 정보 조회 실패: {e}")
            return {"error": f"환자 정보 조회 중 오류가 발생했습니다: {str(e)}"}

    async def get_hospital_by_id(self, hospital_id: str) -> Dict[str, Any]:
        """병원 ID로 병원 정보 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 병원 정보 조회 (검진 항목 포함)
            hospital_query = """
                SELECT hospital_id, hospital_name, phone, address, 
                       supported_checkup_types, layout_type, brand_color, logo_position, 
                       checkup_items, national_checkup_items, recommended_items,
                       is_active, created_at
                FROM wello.wello_hospitals 
                WHERE hospital_id = $1 AND is_active = true
            """
            hospital_row = await conn.fetchrow(hospital_query, hospital_id)
            
            if not hospital_row:
                await conn.close()
                return {"error": "병원 정보를 찾을 수 없습니다"}
            
            # 병원 정보를 딕셔너리로 변환
            hospital_dict = dict(hospital_row)
            
            # 프론트엔드 호환성을 위해 name 필드 추가 (hospital_name의 별칭)
            if 'hospital_name' in hospital_dict:
                hospital_dict['name'] = hospital_dict['hospital_name']
            
            # phone과 address가 없으면 기본값 설정
            if not hospital_dict.get('phone'):
                hospital_dict['phone'] = '02-1234-5678'
            if not hospital_dict.get('address'):
                hospital_dict['address'] = '서울특별시 강남구 테헤란로 123'
            if not hospital_dict.get('supported_checkup_types'):
                hospital_dict['supported_checkup_types'] = ['basic', 'comprehensive', 'premium']
            
            # 날짜 객체를 문자열로 변환
            if hospital_dict.get('created_at'):
                hospital_dict['created_at'] = hospital_dict['created_at'].isoformat()
            
            # 외부 검사 항목 매핑 조회 (테이블이 존재하는 경우에만)
            try:
                external_checkup_items = await conn.fetch("""
                    SELECT 
                        e.id,
                        e.category,
                        e.sub_category,
                        e.item_name,
                        e.item_name_en,
                        e.difficulty_level,
                        e.target_trigger,
                        e.gap_description,
                        e.solution_narrative,
                        e.description,
                        m.display_order
                    FROM wello.wello_hospital_external_checkup_mapping m
                    JOIN wello.wello_external_checkup_items e ON m.external_checkup_item_id = e.id
                    WHERE m.hospital_id = $1 AND m.is_active = true AND e.is_active = true
                    ORDER BY m.display_order
                """, hospital_id)
                
                if external_checkup_items:
                    hospital_dict['external_checkup_items'] = [
                        {
                            'id': item['id'],
                            'category': item['category'],
                            'sub_category': item['sub_category'],
                            'item_name': item['item_name'],
                            'item_name_en': item['item_name_en'],
                            'difficulty_level': item['difficulty_level'],
                            'difficulty_badge': {
                                'Low': '부담없는',
                                'Mid': '추천',
                                'High': '프리미엄'
                            }.get(item['difficulty_level'], item['difficulty_level']),
                            'target_trigger': item['target_trigger'],
                            'gap_description': item['gap_description'],
                            'solution_narrative': item['solution_narrative'],
                            'description': item['description'],
                            'display_order': item['display_order']
                        }
                        for item in external_checkup_items
                    ]
                else:
                    hospital_dict['external_checkup_items'] = []
            except Exception as e:
                # 테이블이 없거나 조회 실패 시 빈 배열 반환
                print(f"⚠️ 외부 검사 항목 조회 실패 (무시): {e}")
                hospital_dict['external_checkup_items'] = []
            
            await conn.close()
            
            return hospital_dict
            
        except Exception as e:
            print(f"❌ 병원 정보 조회 실패: {e}")
            return {"error": f"병원 정보 조회 중 오류가 발생했습니다: {str(e)}"}

    async def collect_tilko_data(self, session_id: str) -> Dict[str, Any]:
        """Tilko 세션으로부터 데이터 수집"""
        try:
            # 실제 Tilko API 호출 대신 임시 데이터 생성
            # TODO: 실제 Tilko API 연동 시 이 부분을 수정
            
            print(f"📊 [데이터수집] 세션 {session_id}로부터 데이터 수집 시작")
            
            # 임시 건강검진 데이터
            health_data = {
                "ResultList": [
                    {
                        "inspection_date": "2024-10-15",
                        "hospital_name": "김현우내과의원",
                        "inspection": [
                            {
                                "inspection_name": "일반혈액검사",
                                "illness": [
                                    {
                                        "illness_name": "혈압",
                                        "item": [
                                            {"item_name": "수축기혈압", "result_value": "120", "unit": "mmHg", "reference_value": "90-140"},
                                            {"item_name": "이완기혈압", "result_value": "80", "unit": "mmHg", "reference_value": "60-90"}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
            
            # 임시 처방전 데이터
            prescription_data = {
                "ResultList": [
                    {
                        "prescription_date": "2024-10-15",
                        "hospital_name": "김현우내과의원",
                        "medications": [
                            {
                                "drug_name": "아스피린",
                                "dosage": "100mg",
                                "frequency": "1일 1회",
                                "duration": "30일"
                            }
                        ]
                    }
                ]
            }
            
            return {
                "session_id": session_id,
                "health_data": health_data,
                "prescription_data": prescription_data,
                "collected_at": datetime.now().isoformat(),
                "message": "데이터 수집 완료"
            }
            
        except Exception as e:
            print(f"❌ 데이터 수집 실패: {e}")
            return {"error": f"데이터 수집 중 오류가 발생했습니다: {str(e)}"}
    
    async def save_patient_data(self, uuid: str, hospital_id: str, user_info: Dict[str, Any], 
                               session_id: str) -> Optional[int]:
        """환자 기본정보 저장 또는 업데이트"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 생년월일 파싱
            birth_date = None
            if user_info.get('birth_date'):
                birth_str = user_info['birth_date']
                if len(birth_str) == 8:  # YYYYMMDD
                    birth_date = f"{birth_str[:4]}-{birth_str[4:6]}-{birth_str[6:8]}"
            
            # UPSERT 쿼리
            upsert_query = """
                INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender, 
                                          last_auth_at, tilko_session_id, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())
                ON CONFLICT (uuid, hospital_id) 
                DO UPDATE SET 
                    name = EXCLUDED.name,
                    phone_number = EXCLUDED.phone_number,
                    birth_date = EXCLUDED.birth_date,
                    gender = EXCLUDED.gender,
                    last_auth_at = NOW(),
                    tilko_session_id = EXCLUDED.tilko_session_id,
                    updated_at = NOW()
                RETURNING id
            """
            
            patient_id = await conn.fetchval(
                upsert_query,
                uuid, hospital_id, user_info.get('name'), user_info.get('phone_number'),
                birth_date, user_info.get('gender'), session_id
            )
            
            await conn.close()
            print(f"✅ [환자저장] 환자 정보 저장 완료 - ID: {patient_id}")
            return patient_id
            
        except Exception as e:
            print(f"❌ [환자저장] 오류: {e}")
            return None
    
    async def save_health_data(self, patient_uuid: str, hospital_id: str, health_data: Dict[str, Any], 
                              session_id: str) -> bool:
        """건강검진 데이터 저장 - 모든 필드 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 기존 데이터 삭제 (새로운 데이터로 교체)
            await conn.execute("DELETE FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", 
                             patient_uuid, hospital_id)
            
            result_list = health_data.get('ResultList', [])
            saved_count = 0
            
            for item in result_list:
                # 기본 검색용 필드 추출 (실제 데이터 구조에 맞게 수정)
                year = item.get('Year')  # "2021년" 형식
                checkup_date = item.get('CheckUpDate')  # "09/28" 형식
                location = item.get('Location')  # "이루탄메디케어의원"
                code = item.get('Code')  # "의심"
                description = item.get('Description', '')
                
                # Inspections 배열에서 주요 검사 결과 추출
                height = None
                weight = None
                bmi = None
                waist_circumference = None
                blood_pressure_high = None
                blood_pressure_low = None
                blood_sugar = None
                cholesterol = None
                hdl_cholesterol = None
                ldl_cholesterol = None
                triglyceride = None
                hemoglobin = None
                
                inspections = item.get('Inspections', [])
                for inspection in inspections:
                    illnesses = inspection.get('Illnesses', [])
                    for illness in illnesses:
                        items = illness.get('Items', [])
                        for test_item in items:
                            name = test_item.get('Name', '')
                            value = test_item.get('Value', '')
                            
                            try:
                                if '신장' in name and value:
                                    height = float(value)
                                elif '체중' in name and value:
                                    weight = float(value)
                                elif '체질량지수' in name and value:
                                    bmi = float(value)
                                elif '허리둘레' in name and value:
                                    waist_circumference = float(value)
                                elif ('혈압' in name or '최고/최저' in name) and value:
                                    # "140/90" 형태 파싱
                                    if '/' in value:
                                        parts = value.split('/')
                                        if len(parts) == 2:
                                            try:
                                                blood_pressure_high = int(float(parts[0]))
                                                blood_pressure_low = int(float(parts[1]))
                                            except (ValueError, TypeError):
                                                pass
                                elif '공복혈당' in name and value:
                                    blood_sugar = int(float(value))
                                elif '총콜레스테롤' in name and value:
                                    cholesterol = int(float(value))
                                    print(f"✅ [총콜레스테롤] 파싱 성공: {name} = {value}")
                                elif ('HDL' in name or '고밀도' in name) and '콜레스테롤' in name and value:
                                    hdl_cholesterol = int(float(value))
                                    print(f"✅ [HDL 콜레스테롤] 파싱 성공: {name} = {value}")
                                elif ('LDL' in name or '저밀도' in name) and '콜레스테롤' in name and value:
                                    ldl_cholesterol = int(float(value))
                                    print(f"✅ [LDL 콜레스테롤] 파싱 성공: {name} = {value}")
                                elif '중성지방' in name and value:
                                    triglyceride = int(float(value))
                                    print(f"✅ [중성지방] 파싱 성공: {name} = {value}")
                                elif '혈색소' in name and value:
                                    hemoglobin = float(value)
                            except (ValueError, TypeError):
                                # 숫자 변환 실패 시 무시
                                pass
                
                # 데이터 저장 (모든 필드 포함)
                insert_query = """
                    INSERT INTO wello.wello_checkup_data 
                    (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                     height, weight, bmi, waist_circumference, blood_pressure_high, blood_pressure_low,
                     blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride, hemoglobin)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    year, checkup_date, location, code, description,
                    height, weight, bmi, waist_circumference, blood_pressure_high, blood_pressure_low,
                    blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride, hemoglobin
                )
                saved_count += 1
            
            # 환자 테이블 업데이트 (patient_uuid 기준)
            await conn.execute(
                "UPDATE wello.wello_patients SET has_health_data = TRUE, last_data_update = NOW() WHERE uuid = $1 AND hospital_id = $2",
                patient_uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [건강검진저장] {saved_count}건 저장 완료 (모든 필드 포함)")
            return True
            
        except Exception as e:
            print(f"❌ [건강검진저장] 오류: {e}")
            return False
    
    async def save_prescription_data(self, patient_uuid: str, hospital_id: str, prescription_data: Dict[str, Any], 
                                   session_id: str) -> bool:
        """처방전 데이터 저장 - 모든 필드 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 기존 데이터 삭제 (새로운 데이터로 교체)
            await conn.execute("DELETE FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2", 
                             patient_uuid, hospital_id)
            
            result_list = prescription_data.get('ResultList', [])
            saved_count = 0
            
            for item in result_list:
                # 기본 검색용 필드 추출
                idx = item.get('Idx')
                page = item.get('Page')
                hospital_name = item.get('ByungEuiwonYakGukMyung')
                address = item.get('Address')
                treatment_date_str = item.get('JinRyoGaesiIl')
                treatment_type = item.get('JinRyoHyungTae')
                
                # 추가 필드 추출
                visit_count = None
                prescription_count = None
                medication_count = None
                detail_records_count = 0
                
                try:
                    if item.get('BangMoonIpWonIlsoo'):
                        visit_count = int(item.get('BangMoonIpWonIlsoo'))
                except (ValueError, TypeError):
                    pass
                    
                try:
                    if item.get('CheoBangHoiSoo'):
                        prescription_count = int(item.get('CheoBangHoiSoo'))
                except (ValueError, TypeError):
                    pass
                    
                try:
                    if item.get('TuYakYoYangHoiSoo'):
                        medication_count = int(item.get('TuYakYoYangHoiSoo'))
                except (ValueError, TypeError):
                    pass
                
                # 처방 상세 정보 개수 계산
                detail_list = item.get('RetrieveTreatmentInjectionInformationPersonDetailList', [])
                if isinstance(detail_list, list):
                    detail_records_count = len(detail_list)
                
                # 날짜 파싱
                treatment_date = None
                if treatment_date_str:
                    try:
                        treatment_date = datetime.strptime(treatment_date_str, '%Y-%m-%d').date()
                    except:
                        pass
                
                # 🚨 중복 체크: 동일한 처방전이 이미 존재하는지 확인
                duplicate_check_query = """
                    SELECT COUNT(*) FROM wello.wello_prescription_data 
                    WHERE patient_uuid = $1 AND hospital_id = $2 
                    AND hospital_name = $3 AND treatment_date = $4 AND treatment_type = $5
                """
                
                existing_count = await conn.fetchval(
                    duplicate_check_query,
                    patient_uuid, hospital_id, hospital_name, treatment_date, treatment_type
                )
                
                if existing_count > 0:
                    print(f"⚠️ [처방전저장] 중복 데이터 스킵 - {hospital_name} / {treatment_date} / {treatment_type}")
                    continue  # 중복 데이터는 저장하지 않고 다음으로
                
                # 데이터 저장 (중복이 없는 경우만)
                insert_query = """
                    INSERT INTO wello.wello_prescription_data 
                    (patient_uuid, hospital_id, raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                     visit_count, prescription_count, medication_count, detail_records_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (patient_uuid, hospital_id, hospital_name, treatment_date, treatment_type) 
                    DO NOTHING
                """
                
                try:
                    await conn.execute(
                        insert_query,
                        patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                        idx, page, hospital_name, address, treatment_date, treatment_type,
                        visit_count, prescription_count, medication_count, detail_records_count
                    )
                    saved_count += 1
                    print(f"✅ [처방전저장] 새 데이터 저장 - {hospital_name} / {treatment_date} / {treatment_type}")
                except Exception as insert_error:
                    if "duplicate key value violates unique constraint" in str(insert_error):
                        print(f"⚠️ [처방전저장] UNIQUE 제약조건으로 중복 방지됨 - {hospital_name} / {treatment_date}")
                    else:
                        print(f"❌ [처방전저장] 개별 저장 실패: {insert_error}")
                        raise
            
            # 환자 테이블 업데이트 (patient_uuid 기준)
            await conn.execute(
                "UPDATE wello.wello_patients SET has_prescription_data = TRUE, last_data_update = NOW() WHERE uuid = $1 AND hospital_id = $2",
                patient_uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [처방전저장] {saved_count}건 저장 완료 (모든 필드 포함)")
            return True
            
        except Exception as e:
            print(f"❌ [처방전저장] 오류: {e}")
            return False
    
    async def save_collection_history(self, patient_id: int, session_id: str, 
                                    collection_type: str, success: bool,
                                    health_count: int = 0, prescription_count: int = 0,
                                    error_message: str = None) -> bool:
        """데이터 수집 이력 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            insert_query = """
                INSERT INTO wello_collection_history 
                (patient_id, collection_type, tilko_session_id, success, 
                 health_records_count, prescription_records_count, error_message, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            """
            
            await conn.execute(
                insert_query,
                patient_id, collection_type, session_id, success,
                health_count, prescription_count, error_message
            )
            
            await conn.close()
            print(f"✅ [이력저장] 수집 이력 저장 완료")
            return True
            
        except Exception as e:
            print(f"❌ [이력저장] 오류: {e}")
            return False
    
    async def get_patient_health_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 모든 건강정보 조회"""
        try:
            # 🔍 [DB 로그] 조회 파라미터 확인
            print(f"\n{'='*80}")
            print(f"🔍 [DB 원본 데이터 확인] 조회 시작")
            print(f"  - uuid: {uuid}")
            print(f"  - hospital_id: {hospital_id}")
            print(f"{'='*80}\n")
            
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT * FROM wello.wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                print(f"❌ [DB 원본 데이터 확인] 환자를 찾을 수 없음: uuid={uuid}, hospital_id={hospital_id}")
                return {"error": "환자를 찾을 수 없습니다"}
            
            patient_dict = dict(patient_row)
            print(f"✅ [DB 원본 데이터 확인] 환자 정보:")
            print(f"  - 이름: {patient_dict.get('name', 'N/A')}")
            print(f"  - UUID: {patient_dict.get('uuid', 'N/A')}")
            print(f"  - 병원 ID: {patient_dict.get('hospital_id', 'N/A')}\n")
            
            # 건강검진 데이터 조회 (patient_uuid 기준)
            health_query = """
                SELECT raw_data, year, checkup_date, location, code, 
                       height, weight, bmi, waist_circumference, blood_pressure_high, blood_pressure_low,
                       blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride, hemoglobin,
                       collected_at, created_at
                FROM wello.wello_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
            """
            health_rows = await conn.fetch(health_query, uuid, hospital_id)
            
            print(f"📊 [DB 원본 데이터 확인] 건강검진 데이터 총 개수: {len(health_rows)}개\n")
            
            # 🔍 [DB 원본 데이터 확인] 모든 년도 수집
            all_years = set()
            year_data_map = {}
            for row in health_rows:
                year = row.get('year')
                if year:
                    all_years.add(year)
                    if year not in year_data_map:
                        year_data_map[year] = []
                    year_data_map[year].append(row)
            
            print(f"📅 [DB 원본 데이터 확인] 전체 년도 목록:")
            for year in sorted(all_years):
                count = len(year_data_map[year])
                print(f"  - {year}: {count}개 검진 데이터")
            print()
            
            # 🔍 [DB 원본 데이터 확인] 각 년도별 상세 데이터 확인
            for year in sorted(all_years, reverse=True):  # 최신 년도부터
                year_data = year_data_map[year]
                print(f"{'─'*80}")
                print(f"📋 [DB 원본 데이터 확인] {year}년 데이터 ({len(year_data)}개):")
                print(f"{'─'*80}")
                
                for idx, row in enumerate(year_data, 1):
                    print(f"\n  [{idx}/{len(year_data)}] {year}년 {row.get('checkup_date', 'N/A')} 검진:")
                    print(f"    - location: {row.get('location', 'N/A')}")
                    print(f"    - code: {row.get('code', 'N/A')}")
                    print(f"    - 파싱된 필드:")
                    print(f"      * height: {row.get('height')}")
                    print(f"      * weight: {row.get('weight')}")
                    print(f"      * bmi: {row.get('bmi')}")
                    print(f"      * blood_pressure: {row.get('blood_pressure_high')}/{row.get('blood_pressure_low')}")
                    print(f"      * blood_sugar: {row.get('blood_sugar')}")
                    print(f"      * cholesterol: {row.get('cholesterol')}")
                    print(f"      * hdl_cholesterol: {row.get('hdl_cholesterol')}")
                    print(f"      * ldl_cholesterol: {row.get('ldl_cholesterol')}")
                    print(f"      * triglyceride: {row.get('triglyceride')}")
                    print(f"      * hemoglobin: {row.get('hemoglobin')}")
                    
                    # raw_data 원본 확인
                    raw_data = row.get('raw_data')
                    print(f"    - raw_data 존재: {bool(raw_data)}")
                    
                    if raw_data:
                        try:
                            raw_data_parsed = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                            print(f"    - raw_data 타입: {type(raw_data_parsed)}")
                            
                            if isinstance(raw_data_parsed, dict):
                                print(f"    - raw_data 최상위 키: {list(raw_data_parsed.keys())[:15]}")
                                
                                # Inspections 확인
                                if 'Inspections' in raw_data_parsed:
                                    inspections = raw_data_parsed.get('Inspections', [])
                                    print(f"    - Inspections 개수: {len(inspections) if isinstance(inspections, list) else 0}")
                                    
                                    if isinstance(inspections, list) and len(inspections) > 0:
                                        # 각 Inspection의 Items와 ItemReferences 확인
                                        total_items = 0
                                        items_with_refs = 0
                                        refs_summary = {}
                                        
                                        for insp_idx, inspection in enumerate(inspections):
                                            if isinstance(inspection, dict) and 'Illnesses' in inspection:
                                                illnesses = inspection.get('Illnesses', [])
                                                if isinstance(illnesses, list):
                                                    for illness in illnesses:
                                                        if isinstance(illness, dict) and 'Items' in illness:
                                                            items = illness.get('Items', [])
                                                            if isinstance(items, list):
                                                                total_items += len(items)
                                                                for item in items:
                                                                    if isinstance(item, dict):
                                                                        if item.get('ItemReferences'):
                                                                            items_with_refs += 1
                                                                            refs = item.get('ItemReferences', [])
                                                                            if isinstance(refs, list):
                                                                                for ref in refs:
                                                                                    if isinstance(ref, dict):
                                                                                        ref_name = ref.get('Name', 'Unknown')
                                                                                        if ref_name not in refs_summary:
                                                                                            refs_summary[ref_name] = 0
                                                                                        refs_summary[ref_name] += 1
                                        
                                        print(f"    - 총 Items 개수: {total_items}")
                                        print(f"    - ItemReferences를 가진 Items: {items_with_refs}개")
                                        if refs_summary:
                                            print(f"    - ItemReferences 종류:")
                                            for ref_name, count in sorted(refs_summary.items()):
                                                print(f"      * {ref_name}: {count}개")
                                        
                                        # 첫 번째 Inspection의 첫 번째 Illness의 첫 번째 Item 상세 확인
                                        if len(inspections) > 0:
                                            first_inspection = inspections[0]
                                            if isinstance(first_inspection, dict) and 'Illnesses' in first_inspection:
                                                illnesses = first_inspection.get('Illnesses', [])
                                                if isinstance(illnesses, list) and len(illnesses) > 0:
                                                    first_illness = illnesses[0]
                                                    if isinstance(first_illness, dict) and 'Items' in first_illness:
                                                        items = first_illness.get('Items', [])
                                                        if isinstance(items, list) and len(items) > 0:
                                                            print(f"\n    - 첫 번째 Item 샘플:")
                                                            for item_idx, item in enumerate(items[:5]):  # 처음 5개만
                                                                if isinstance(item, dict):
                                                                    print(f"      [{item_idx+1}] {item.get('Name', 'N/A')}: {item.get('Value', 'N/A')} {item.get('Unit', '')}")
                                                                    if item.get('ItemReferences'):
                                                                        refs = item.get('ItemReferences', [])
                                                                        if isinstance(refs, list):
                                                                            print(f"          ItemReferences:")
                                                                            for ref in refs[:3]:  # 처음 3개만
                                                                                if isinstance(ref, dict):
                                                                                    print(f"            - {ref.get('Name', 'N/A')}: {ref.get('Value', 'N/A')}")
                        except Exception as e:
                            print(f"    - raw_data 파싱 실패: {e}")
                    print()
            
            print(f"{'='*80}\n")
            
            # 처방전 데이터 조회 (patient_uuid 기준)
            prescription_query = """
                SELECT raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                       visit_count, prescription_count, medication_count, detail_records_count,
                       collected_at, created_at
                FROM wello.wello_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY treatment_date DESC
            """
            prescription_rows = await conn.fetch(prescription_query, uuid, hospital_id)
            
            # 수집 이력 조회 (patient_uuid 기준으로 수정 필요 시)
            # 현재는 wello_collection_history 테이블이 없으므로 빈 배열 반환
            history_rows = []
            
            await conn.close()
            
            # 환자 정보에 last_update 필드 추가
            patient_dict = dict(patient_row)
            
            # 🔍 [DB 로그] 반환 데이터 구조 확인
            health_data_formatted = [
                {
                    **dict(row),
                    "raw_data": json.loads(row['raw_data']) if row['raw_data'] else None
                } for row in health_rows
            ]
            
            print(f"🔍 [DB get_patient_health_data] 반환 데이터 구조:")
            print(f"  - health_data 개수: {len(health_data_formatted)}")
            print(f"  - 년도별 데이터 분포:")
            year_distribution = {}
            for item in health_data_formatted:
                year = item.get('year')
                if year:
                    year_distribution[year] = year_distribution.get(year, 0) + 1
            for year, count in sorted(year_distribution.items()):
                print(f"    - {year}: {count}개")
            
            if health_data_formatted:
                first_health = health_data_formatted[0]
                print(f"  - 첫 번째 health_data:")
                print(f"    - year: {first_health.get('year')}")
                print(f"    - checkup_date: {first_health.get('checkup_date')}")
                print(f"    - location: {first_health.get('location')}")
                print(f"    - height: {first_health.get('height')}")
                print(f"    - weight: {first_health.get('weight')}")
                print(f"    - raw_data 존재: {bool(first_health.get('raw_data'))}")
                if first_health.get('raw_data'):
                    raw_data = first_health.get('raw_data')
                    if isinstance(raw_data, dict) and 'Inspections' in raw_data:
                        print(f"    - raw_data.Inspections 존재: True")
                        inspections = raw_data.get('Inspections', [])
                        if isinstance(inspections, list) and len(inspections) > 0:
                            print(f"    - Inspections 개수: {len(inspections)}")
                            # 각 Inspection의 Items에서 ItemReferences 확인
                            item_refs_found = 0
                            for inspection in inspections:
                                if isinstance(inspection, dict) and 'Illnesses' in inspection:
                                    illnesses = inspection.get('Illnesses', [])
                                    if isinstance(illnesses, list):
                                        for illness in illnesses:
                                            if isinstance(illness, dict) and 'Items' in illness:
                                                items = illness.get('Items', [])
                                                if isinstance(items, list):
                                                    for item in items:
                                                        if isinstance(item, dict) and item.get('ItemReferences'):
                                                            item_refs_found += 1
                            print(f"    - ItemReferences를 가진 Items 개수: {item_refs_found}")
            
            return {
                "patient": patient_dict,
                "health_data": health_data_formatted,
                "prescription_data": [
                    {
                        **dict(row),
                        "raw_data": json.loads(row['raw_data']) if row['raw_data'] else None
                    } for row in prescription_rows
                ],
                "collection_history": [dict(row) for row in history_rows],
                "last_update": patient_dict.get('last_data_update')  # 마지막 업데이트 시간 추가
            }
            
        except Exception as e:
            print(f"❌ [데이터조회] 오류: {e}")
            return {"error": str(e)}
    
    async def get_patient_prescription_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 처방전 데이터 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 처방전 데이터 조회
            prescription_query = """
                SELECT raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                       visit_count, prescription_count, medication_count, detail_records_count,
                       collected_at, created_at
                FROM wello.wello_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY treatment_date DESC
            """
            prescription_rows = await conn.fetch(prescription_query, uuid, hospital_id)
            
            prescription_data_list = []
            for row in prescription_rows:
                raw_data = row.get('raw_data')
                raw_data_parsed = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                
                prescription_data_list.append({
                    "raw_data": raw_data_parsed,
                    "prescription_date": row.get('treatment_date').isoformat() if row.get('treatment_date') else "",
                    "location": row.get('hospital_name', ''),
                    "idx": row.get('idx'),
                    "page": row.get('page'),
                    "address": row.get('address'),
                    "treatment_type": row.get('treatment_type'),
                    "visit_count": row.get('visit_count'),
                    "prescription_count": row.get('prescription_count'),
                    "medication_count": row.get('medication_count'),
                    "detail_records_count": row.get('detail_records_count'),
                    "collected_at": row.get('collected_at').isoformat() if row.get('collected_at') else None,
                    "created_at": row.get('created_at').isoformat() if row.get('created_at') else None
                })
            
            await conn.close()
            
            return {
                "prescription_data": prescription_data_list
            }
            
        except Exception as e:
            print(f"❌ [처방전 데이터 조회] 오류: {e}")
            return {"error": f"처방전 데이터 조회 중 오류가 발생했습니다: {str(e)}"}
    
    async def get_drug_detail(self, drug_code: str) -> Optional[Dict[str, Any]]:
        """약품 상세정보 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 처방전 데이터에서 약품 상세정보 조회
            query = """
                SELECT DISTINCT 
                    raw_data->'RetrieveTreatmentInjectionInformationPersonDetailList' as medication_list
                FROM wello.wello_prescription_data 
                WHERE raw_data ? 'RetrieveTreatmentInjectionInformationPersonDetailList'
                  AND jsonb_typeof(raw_data->'RetrieveTreatmentInjectionInformationPersonDetailList') = 'array'
                  AND jsonb_array_length(raw_data->'RetrieveTreatmentInjectionInformationPersonDetailList') > 0
            """
            
            rows = await conn.fetch(query)
            await conn.close()
            
            # 모든 약품 데이터에서 해당 약품코드 찾기
            for row in rows:
                if row['medication_list']:
                    medications = json.loads(row['medication_list']) if isinstance(row['medication_list'], str) else row['medication_list']
                    
                    for med in medications:
                        if isinstance(med, dict) and med.get('DrugCode') == drug_code:
                            # RetrieveMdsupDtlInfo에서 상세정보 추출
                            detail_info = med.get('RetrieveMdsupDtlInfo', {})
                            
                            if detail_info:
                                return {
                                    "DrugCode": drug_code,
                                    "MediPrdcNm": detail_info.get('MediPrdcNm', med.get('ChoBangYakPumMyung', '약품명 미상')),
                                    "DrugImage": detail_info.get('DrugImage'),
                                    "EfftEftCnte": detail_info.get('EfftEftCnte'),
                                    "UsagCpctCnte": detail_info.get('UsagCpctCnte'),
                                    "UseAtntMttCnte": detail_info.get('UseAtntMttCnte'),
                                    "CmnTmdcGdncCnte": detail_info.get('CmnTmdcGdncCnte'),
                                    "MdctPathXplnCnte": detail_info.get('MdctPathXplnCnte'),
                                    "MohwClsfNoXplnCnte": detail_info.get('MohwClsfNoXplnCnte'),
                                    "UpsoName": detail_info.get('UpsoName'),
                                    "CmpnInfo": detail_info.get('CmpnInfo'),
                                    "AtcInfo": detail_info.get('AtcInfo'),
                                    "FomlCdXplnCnte": detail_info.get('FomlCdXplnCnte'),
                                    "TmsgGnlSpcd": detail_info.get('TmsgGnlSpcd')
                                }
            
            return None
            
        except Exception as e:
            print(f"❌ [약품정보조회] 오류: {e}")
            return None

    async def delete_patient_health_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 건강검진 및 처방전 데이터 삭제"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 삭제 전 데이터 확인
            health_count_before = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            prescription_count_before = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            # 트랜잭션 시작
            async with conn.transaction():
                # 건강검진 데이터 삭제
                if health_count_before > 0:
                    await conn.execute(
                        "DELETE FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, hospital_id
                    )
                    print(f"✅ [데이터삭제] 건강검진 데이터 삭제: {health_count_before}건")
                
                # 처방전 데이터 삭제
                if prescription_count_before > 0:
                    await conn.execute(
                        "DELETE FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                        uuid, hospital_id
                    )
                    print(f"✅ [데이터삭제] 처방전 데이터 삭제: {prescription_count_before}건")
                
                # 환자 정보 플래그 업데이트
                # 약관 동의 컬럼이 존재하는지 확인
                try:
                    # terms_agreement 컬럼 존재 여부 확인
                    column_exists = await conn.fetchval("""
                        SELECT EXISTS (
                            SELECT 1 
                            FROM information_schema.columns 
                            WHERE table_schema = 'wello' 
                            AND table_name = 'wello_patients' 
                            AND column_name = 'terms_agreement'
                        )
                    """)
                    
                    if column_exists:
                        # 약관 동의 컬럼이 있으면 함께 삭제
                        await conn.execute(
                            """UPDATE wello.wello_patients 
                               SET has_health_data = FALSE,
                                   has_prescription_data = FALSE,
                                   last_data_update = NULL,
                                   terms_agreement = NULL,
                                   terms_agreed_at = NULL
                               WHERE uuid = $1 AND hospital_id = $2""",
                            uuid, hospital_id
                        )
                        print(f"✅ [데이터삭제] 환자 정보 플래그 및 약관 동의 데이터 삭제 완료")
                    else:
                        # 약관 동의 컬럼이 없으면 플래그만 업데이트
                        await conn.execute(
                            """UPDATE wello.wello_patients 
                               SET has_health_data = FALSE,
                                   has_prescription_data = FALSE,
                                   last_data_update = NULL
                               WHERE uuid = $1 AND hospital_id = $2""",
                            uuid, hospital_id
                        )
                        print(f"✅ [데이터삭제] 환자 정보 플래그 업데이트 완료 (약관 동의 컬럼 없음)")
                except Exception as e:
                    # 컬럼 확인 실패 시 기본 업데이트만 수행
                    print(f"⚠️ [데이터삭제] 약관 동의 컬럼 확인 실패, 기본 업데이트만 수행: {e}")
                    await conn.execute(
                        """UPDATE wello.wello_patients 
                           SET has_health_data = FALSE,
                               has_prescription_data = FALSE,
                               last_data_update = NULL
                           WHERE uuid = $1 AND hospital_id = $2""",
                        uuid, hospital_id
                    )
                    print(f"✅ [데이터삭제] 환자 정보 플래그 업데이트 완료")
            
            # 삭제 후 확인
            health_count_after = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            prescription_count_after = await conn.fetchval(
                "SELECT COUNT(*) FROM wello.wello_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            await conn.close()
            
            return {
                "success": True,
                "deleted": {
                    "health_data": health_count_before,
                    "prescription_data": prescription_count_before
                },
                "remaining": {
                    "health_data": health_count_after,
                    "prescription_data": prescription_count_after
                }
            }
            
        except Exception as e:
            print(f"❌ [데이터삭제] 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def save_terms_agreement(self, uuid: str, hospital_id: str, terms_agreement: Dict[str, Any]) -> Dict[str, Any]:
        """약관 동의 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 약관 동의 정보를 JSONB로 저장
            # wello_patients 테이블에 terms_agreement 필드가 있는지 확인하고 업데이트
            # 없으면 ALTER TABLE로 추가 필요 (스키마 마이그레이션)
            
            # 먼저 환자 존재 확인
            patient_check = await conn.fetchrow(
                "SELECT id FROM wello.wello_patients WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            if not patient_check:
                await conn.close()
                return {
                    "success": False,
                    "error": "환자 정보를 찾을 수 없습니다."
                }
            
            # 약관 동의 정보 저장 (JSONB 필드)
            # terms_agreement 필드가 없으면 추가해야 함
            try:
                update_query = """
                    UPDATE wello.wello_patients 
                    SET terms_agreement = $1,
                        terms_agreed_at = NOW(),
                        updated_at = NOW()
                    WHERE uuid = $2 AND hospital_id = $3
                """
                await conn.execute(
                    update_query,
                    json.dumps(terms_agreement),
                    uuid, hospital_id
                )
            except asyncpg.exceptions.UndefinedColumnError:
                # terms_agreement 컬럼이 없으면 추가
                await conn.execute(
                    "ALTER TABLE wello.wello_patients ADD COLUMN IF NOT EXISTS terms_agreement JSONB"
                )
                await conn.execute(
                    "ALTER TABLE wello.wello_patients ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ"
                )
                # 다시 업데이트
                update_query = """
                    UPDATE wello.wello_patients 
                    SET terms_agreement = $1,
                        terms_agreed_at = NOW(),
                        updated_at = NOW()
                    WHERE uuid = $2 AND hospital_id = $3
                """
                await conn.execute(
                    update_query,
                    json.dumps(terms_agreement),
                    uuid, hospital_id
                )
            
            await conn.close()
            
            print(f"✅ [약관동의] 약관 동의 저장 완료: {uuid} @ {hospital_id}")
            print(f"   - 서비스 이용약관: {terms_agreement.get('terms_service', False)}")
            print(f"   - 개인정보 수집/이용: {terms_agreement.get('terms_privacy', False)}")
            print(f"   - 민감정보 수집/이용: {terms_agreement.get('terms_sensitive', False)}")
            print(f"   - 마케팅 활용: {terms_agreement.get('terms_marketing', False)}")
            
            return {
                "success": True,
                "terms_agreement": terms_agreement
            }
            
        except Exception as e:
            print(f"❌ [약관동의] 저장 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def save_checkup_design_request(
        self,
        uuid: str,
        hospital_id: str,
        selected_concerns: List[Dict[str, Any]],
        survey_responses: Optional[Dict[str, Any]] = None,
        design_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """검진 설계 요청 저장 (업셀링용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 ID 조회
            patient_query = """
                SELECT id FROM wello.wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                return {
                    "success": False,
                    "error": "환자 정보를 찾을 수 없습니다."
                }
            
            patient_id = patient_row['id']
            
            # 설문 응답에서 추가 고민사항 추출
            additional_concerns = None
            if survey_responses and survey_responses.get("additional_concerns"):
                additional_concerns = survey_responses.get("additional_concerns")
            
            # 검진 설계 요청 저장
            insert_query = """
                INSERT INTO wello.wello_checkup_design_requests 
                (patient_id, selected_concerns, survey_responses, additional_concerns, design_result, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING id
            """
            
            request_id = await conn.fetchval(
                insert_query,
                patient_id,
                json.dumps(selected_concerns, ensure_ascii=False),
                json.dumps(survey_responses, ensure_ascii=False) if survey_responses else None,
                additional_concerns,
                json.dumps(design_result, ensure_ascii=False) if design_result else None
            )
            
            await conn.close()
            
            print(f"✅ [검진설계요청] 저장 완료 - ID: {request_id}, 환자: {uuid} @ {hospital_id}")
            print(f"   - 선택 항목: {len(selected_concerns)}개")
            print(f"   - 설문 응답: {'있음' if survey_responses else '없음'}")
            
            return {
                "success": True,
                "request_id": request_id
            }
            
        except Exception as e:
            print(f"❌ [검진설계요청] 저장 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# 싱글톤 인스턴스
wello_data_service = WelloDataService()
