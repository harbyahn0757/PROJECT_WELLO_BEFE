"""
WELLO 건강정보 데이터 저장 및 관리 서비스
"""

import json
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from ..models.wello_models import WelloPatient, WelloCheckupData, WelloPrescriptionData, WelloCollectionHistory
from ..core.database import get_db
import asyncpg
from ..core.config import settings

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
                FROM wello_patients 
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
            
            patient_id = patient_row['id']
            
            # 건강검진 데이터 개수 조회
            health_count_query = "SELECT COUNT(*) FROM wello_checkup_data WHERE patient_id = $1"
            health_count = await conn.fetchval(health_count_query, patient_id)
            
            # 처방전 데이터 개수 조회
            prescription_count_query = "SELECT COUNT(*) FROM wello_prescription_data WHERE patient_id = $1"
            prescription_count = await conn.fetchval(prescription_count_query, patient_id)
            
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
                INSERT INTO wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender, 
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
    
    async def save_health_data(self, patient_id: int, health_data: Dict[str, Any], 
                              session_id: str) -> bool:
        """건강검진 데이터 저장 - 모든 필드 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 기존 데이터 삭제 (새로운 데이터로 교체)
            await conn.execute("DELETE FROM wello_checkup_data WHERE patient_id = $1", patient_id)
            
            result_list = health_data.get('ResultList', [])
            saved_count = 0
            
            for item in result_list:
                # 기본 검색용 필드 추출
                year = item.get('Year')
                checkup_date = item.get('CheckUpDate')
                location = item.get('Location')
                code = item.get('Code')
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
                                elif '혈압' in name and value:
                                    # "140/90" 형태 파싱
                                    if '/' in value:
                                        parts = value.split('/')
                                        if len(parts) == 2:
                                            blood_pressure_high = int(parts[0])
                                            blood_pressure_low = int(parts[1])
                                elif '공복혈당' in name and value:
                                    blood_sugar = int(value)
                                elif '총콜레스테롤' in name and value:
                                    cholesterol = int(value)
                                elif 'HDL' in name and '콜레스테롤' in name and value:
                                    hdl_cholesterol = int(value)
                                elif 'LDL' in name and '콜레스테롤' in name and value:
                                    ldl_cholesterol = int(value)
                                elif '중성지방' in name and value:
                                    triglyceride = int(value)
                                elif '혈색소' in name and value:
                                    hemoglobin = float(value)
                            except (ValueError, TypeError):
                                # 숫자 변환 실패 시 무시
                                pass
                
                # 데이터 저장 (모든 필드 포함)
                insert_query = """
                    INSERT INTO wello_checkup_data 
                    (patient_id, raw_data, year, checkup_date, location, code, description,
                     height, weight, bmi, waist_circumference, blood_pressure_high, blood_pressure_low,
                     blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride, hemoglobin,
                     collected_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                """
                
                await conn.execute(
                    insert_query,
                    patient_id, json.dumps(item, ensure_ascii=False),
                    year, checkup_date, location, code, description,
                    height, weight, bmi, waist_circumference, blood_pressure_high, blood_pressure_low,
                    blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride, hemoglobin
                )
                saved_count += 1
            
            # 환자 테이블 업데이트
            await conn.execute(
                "UPDATE wello_patients SET has_health_data = TRUE, last_data_update = NOW() WHERE id = $1",
                patient_id
            )
            
            await conn.close()
            print(f"✅ [건강검진저장] {saved_count}건 저장 완료 (모든 필드 포함)")
            return True
            
        except Exception as e:
            print(f"❌ [건강검진저장] 오류: {e}")
            return False
    
    async def save_prescription_data(self, patient_id: int, prescription_data: Dict[str, Any], 
                                   session_id: str) -> bool:
        """처방전 데이터 저장 - 모든 필드 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 기존 데이터 삭제 (새로운 데이터로 교체)
            await conn.execute("DELETE FROM wello_prescription_data WHERE patient_id = $1", patient_id)
            
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
                    INSERT INTO wello_prescription_data 
                    (patient_id, raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                     visit_count, prescription_count, medication_count, detail_records_count, collected_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                """
                
                await conn.execute(
                    insert_query,
                    patient_id, json.dumps(item, ensure_ascii=False),
                    idx, page, hospital_name, address, treatment_date, treatment_type,
                    visit_count, prescription_count, medication_count, detail_records_count
                )
                saved_count += 1
            
            # 환자 테이블 업데이트
            await conn.execute(
                "UPDATE wello_patients SET has_prescription_data = TRUE, last_data_update = NOW() WHERE id = $1",
                patient_id
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
                SELECT * FROM wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                await conn.close()
                return {"error": "환자를 찾을 수 없습니다"}
            
            patient_id = patient_row['id']
            
            # 건강검진 데이터 조회
            health_query = """
                SELECT raw_data, year, checkup_date, location, code, collected_at
                FROM wello_checkup_data 
                WHERE patient_id = $1 
                ORDER BY year DESC, checkup_date DESC
            """
            health_rows = await conn.fetch(health_query, patient_id)
            
            # 처방전 데이터 조회
            prescription_query = """
                SELECT raw_data, hospital_name, address, treatment_date, treatment_type, collected_at
                FROM wello_prescription_data 
                WHERE patient_id = $1 
                ORDER BY treatment_date DESC
            """
            prescription_rows = await conn.fetch(prescription_query, patient_id)
            
            # 수집 이력 조회
            history_query = """
                SELECT collection_type, success, health_records_count, prescription_records_count,
                       error_message, started_at, completed_at
                FROM wello_collection_history 
                WHERE patient_id = $1 
                ORDER BY started_at DESC
                LIMIT 10
            """
            history_rows = await conn.fetch(history_query, patient_id)
            
            await conn.close()
            
            return {
                "patient": dict(patient_row),
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
                "collection_history": [dict(row) for row in history_rows]
            }
            
        except Exception as e:
            print(f"❌ [데이터조회] 오류: {e}")
            return {"error": str(e)}

# 싱글톤 인스턴스
wello_data_service = WelloDataService()
