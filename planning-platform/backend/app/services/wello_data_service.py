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
        """UUID로 환자 정보 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                       has_health_data, has_prescription_data, last_data_update, last_auth_at,
                       created_at, updated_at
                FROM wello_patients 
                WHERE uuid = $1
            """
            patient_row = await conn.fetchrow(patient_query, uuid)
            
            if not patient_row:
                await conn.close()
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 환자 정보를 딕셔너리로 변환
            patient_dict = dict(patient_row)
            
            # 날짜 객체를 문자열로 변환
            if patient_dict.get('birth_date'):
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
            
            # 병원 정보 조회
            hospital_query = """
                SELECT hospital_id, hospital_name, layout_type, brand_color, logo_position, 
                       is_active, created_at
                FROM wello_hospitals 
                WHERE hospital_id = $1 AND is_active = true
            """
            hospital_row = await conn.fetchrow(hospital_query, hospital_id)
            
            if not hospital_row:
                await conn.close()
                return {"error": "병원 정보를 찾을 수 없습니다"}
            
            # 병원 정보를 딕셔너리로 변환
            hospital_dict = dict(hospital_row)
            
            # 날짜 객체를 문자열로 변환
            if hospital_dict.get('created_at'):
                hospital_dict['created_at'] = hospital_dict['created_at'].isoformat()
            
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
                                elif 'HDL' in name and '콜레스테롤' in name and value:
                                    hdl_cholesterol = int(float(value))
                                elif 'LDL' in name and '콜레스테롤' in name and value:
                                    ldl_cholesterol = int(float(value))
                                elif '중성지방' in name and value:
                                    triglyceride = int(float(value))
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
                
                # 데이터 저장 (모든 필드 포함)
                insert_query = """
                    INSERT INTO wello.wello_prescription_data 
                    (patient_uuid, hospital_id, raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                     visit_count, prescription_count, medication_count, detail_records_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    idx, page, hospital_name, address, treatment_date, treatment_type,
                    visit_count, prescription_count, medication_count, detail_records_count
                )
                saved_count += 1
            
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
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 정보 조회
            patient_query = """
                SELECT * FROM wello.wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                return {"error": "환자를 찾을 수 없습니다"}
            
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
            
            return {
                "patient": patient_dict,
                "health_data": [
                    {
                        **dict(row),
                        "raw_data": json.loads(row['raw_data']) if row['raw_data'] else None
                    } for row in health_rows
                ],
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

# 싱글톤 인스턴스
wello_data_service = WelloDataService()
