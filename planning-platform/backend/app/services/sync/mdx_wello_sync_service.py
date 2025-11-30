"""
mdx_agr_list ↔ wello 스키마 양방향 동기화 서비스
"""

import json
from datetime import datetime, date
from typing import Dict, Any, Optional, List
import asyncpg
import os


class MdxWelloSyncService:
    """mdx_agr_list ↔ wello 동기화 서비스"""
    
    def __init__(self):
        self.db_config = {
            "host": os.getenv("DB_HOST", "10.0.1.10"),
            "port": os.getenv("DB_PORT", "5432"),
            "database": os.getenv("DB_NAME", "p9_mkt_biz"),
            "user": os.getenv("DB_USER", "peernine"),
            "password": os.getenv("DB_PASSWORD", "autumn3334!")
        }
    
    async def get_mdx_patients_by_combo(
        self,
        phoneno: str,
        birthday: date,
        name: str
    ) -> List[Dict[str, Any]]:
        """
        wello → mdx: 전화번호, 생년월일, 이름으로 mdx 환자 조회
        여러 년도 데이터가 있을 수 있으므로 리스트 반환
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    uuid, reg_year, hosnm, hosaddr, name, birthday, gender, phoneno,
                    height, weight, waist, bmi, bphigh, bplwst,
                    totchole, hdlchole, ldlchole, triglyceride, blds,
                    regdate, visitdate, rpt_mkt_ts, mkt_idx, sentto, remarks
                FROM p9_mkt_biz.mdx_agr_list 
                WHERE phoneno = $1 
                  AND birthday = $2 
                  AND name = $3
                ORDER BY regdate DESC NULLS LAST, visitdate DESC NULLS LAST
            """
            
            rows = await conn.fetch(query, phoneno, birthday, name)
            await conn.close()
            
            result = []
            for row in rows:
                result.append(dict(row))
            
            return result
            
        except Exception as e:
            print(f"❌ [MDX 조회] 오류: {e}")
            return []
    
    async def get_wello_patient_by_combo(
        self,
        phone_number: str,
        birth_date: date,
        name: str
    ) -> Optional[Dict[str, Any]]:
        """
        mdx → wello: 전화번호, 생년월일, 이름으로 wello 환자 조회
        단일 환자 레코드 반환
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    id, uuid, hospital_id, name, phone_number, birth_date, gender,
                    has_health_data, has_prescription_data, last_data_update, last_auth_at,
                    created_at, updated_at
                FROM wello.wello_patients 
                WHERE phone_number = $1 
                  AND birth_date = $2 
                  AND name = $3
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, phone_number, birth_date, name)
            await conn.close()
            
            if row:
                return dict(row)
            return None
            
        except Exception as e:
            print(f"❌ [WELLO 조회] 오류: {e}")
            return None
    
    async def get_wello_checkup_data(
        self,
        patient_uuid: str,
        hospital_id: str
    ) -> List[Dict[str, Any]]:
        """
        wello 검진 데이터 조회
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    id, patient_uuid, hospital_id, raw_data,
                    year, checkup_date, location, code, description,
                    height, weight, bmi, waist_circumference,
                    blood_pressure_high, blood_pressure_low,
                    blood_sugar, cholesterol, hdl_cholesterol,
                    ldl_cholesterol, triglyceride, hemoglobin,
                    collected_at, created_at, updated_at
                FROM wello.wello_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
            """
            
            rows = await conn.fetch(query, patient_uuid, hospital_id)
            await conn.close()
            
            result = []
            for row in rows:
                result.append(dict(row))
            
            return result
            
        except Exception as e:
            print(f"❌ [WELLO 검진데이터 조회] 오류: {e}")
            return []





