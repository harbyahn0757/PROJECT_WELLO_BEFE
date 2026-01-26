"""
WELNO 건강정보 데이터 저장 및 관리 서비스
"""

import json
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal
import asyncpg

class WelnoDataService:
    """WELNO 건강정보 데이터 관리 서비스"""
    
    def __init__(self):
        self.db_config = {
            "host": "10.0.1.10",
            "port": "5432", 
            "database": "p9_mkt_biz",
            "user": "peernine",
            "password": "autumn3334!"
        }
    
    # ========================================
    # 공통 헬퍼 함수들
    # ========================================
    
    async def _fetch_patient_base(
        self,
        conn: asyncpg.Connection,
        uuid: Optional[str] = None,
        hospital_id: Optional[str] = None,
        phone_number: Optional[str] = None,
        birth_date: Optional[date] = None,
        name: Optional[str] = None,
        include_timestamps: bool = False
    ) -> Optional[asyncpg.Record]:
        """
        공통 환자 정보 조회 헬퍼
        
        조회 모드:
        1. uuid + hospital_id: 특정 환자 조회 (login, check_existing_data)
        2. uuid only: 병원 무관 조회 (get_patient_by_uuid)
        3. phone + birth + name: 복합키 조회 (get_patient_by_combo)
        
        Args:
            conn: asyncpg 연결 객체
            uuid: 환자 UUID
            hospital_id: 병원 ID
            phone_number: 전화번호
            birth_date: 생년월일 (date 객체)
            name: 환자 이름
            include_timestamps: True면 created_at, updated_at 포함
            
        Returns:
            환자 정보 Record 또는 None
        """
        # 기본 컬럼 (모든 함수 공통)
        base_columns = """
            id, uuid, hospital_id, name, phone_number, birth_date, gender,
            has_health_data, has_prescription_data, has_mediarc_report,
            last_data_update, last_auth_at, last_access_at
        """
        
        # 타임스탬프 추가 (일부 함수만 필요)
        full_columns = f"{base_columns}, created_at, updated_at" if include_timestamps else base_columns
        
        # WHERE 조건 동적 생성
        if uuid and hospital_id:
            query = f"SELECT {full_columns} FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2"
            return await conn.fetchrow(query, uuid, hospital_id)
        elif uuid:
            query = f"SELECT {full_columns} FROM welno.welno_patients WHERE uuid = $1"
            return await conn.fetchrow(query, uuid)
        elif phone_number and birth_date and name:
            query = f"""
                SELECT {full_columns} FROM welno.welno_patients
                WHERE phone_number = $1 AND birth_date = $2 AND name = $3
                ORDER BY last_auth_at DESC NULLS LAST, created_at DESC
                LIMIT 1
            """
            return await conn.fetchrow(query, phone_number, birth_date, name)
        
        return None
    
    def _serialize_patient_dates(self, patient_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        환자 정보의 날짜 필드를 ISO 형식 문자열로 변환
        
        Args:
            patient_dict: 환자 정보 딕셔너리
            
        Returns:
            날짜가 변환된 환자 정보 딕셔너리
        """
        date_fields = [
            'birth_date', 'last_data_update', 'last_auth_at',
            'last_access_at', 'created_at', 'updated_at'
        ]
        
        for field in date_fields:
            if patient_dict.get(field):
                value = patient_dict[field]
                if isinstance(value, (datetime, date)):
                    patient_dict[field] = value.isoformat()
        
        return patient_dict
    
    async def _fetch_patient_data_counts(
        self,
        conn: asyncpg.Connection,
        uuid: str,
        hospital_id: str
    ) -> Dict[str, int]:
        """
        환자의 건강검진/처방전/Mediarc 리포트 개수 조회
        
        Args:
            conn: asyncpg 연결 객체
            uuid: 환자 UUID
            hospital_id: 병원 ID
            
        Returns:
            데이터 개수 딕셔너리 (health_data_count, prescription_data_count, mediarc_report_count)
        """
        health_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        prescription_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        mediarc_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_mediarc_reports WHERE patient_uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        return {
            "health_data_count": health_count,
            "prescription_data_count": prescription_count,
            "mediarc_report_count": mediarc_count
        }
    
    # ========================================
    # 기존 서비스 함수들
    # ========================================
    
    async def check_existing_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """기존 데이터 존재 여부 확인 (리팩토링 완료 - 헬퍼 함수 사용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 헬퍼 함수로 환자 정보 조회
            patient_row = await self._fetch_patient_base(conn, uuid=uuid, hospital_id=hospital_id)
            
            if not patient_row:
                await conn.close()
                return {
                    "exists": False,
                    "patient": None,
                    "health_data_count": 0,
                    "prescription_data_count": 0,
                    "mediarc_report_count": 0,
                    "last_update": None
                }
            
            # 헬퍼 함수로 데이터 개수 조회 (health, prescription, mediarc)
            counts = await self._fetch_patient_data_counts(conn, uuid, hospital_id)
            await conn.close()
            
            # 헬퍼 함수로 날짜 변환
            patient_dict = self._serialize_patient_dates(dict(patient_row))
            
            return {
                "exists": True,
                "patient": patient_dict,
                **counts,  # health_data_count, prescription_data_count, mediarc_report_count
                "has_mediarc_report": patient_row['has_mediarc_report'],
                "last_update": patient_dict.get('last_data_update')
            }
            
        except Exception as e:
            print(f"❌ [데이터확인] 오류: {e}")
            return {
                "exists": False,
                "error": str(e)
            }

    async def login_patient(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자 로그인 처리 (리팩토링 완료 - 헬퍼 함수 사용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 헬퍼 함수로 환자 정보 조회
            patient_row = await self._fetch_patient_base(conn, uuid=uuid, hospital_id=hospital_id)
            
            if not patient_row:
                await conn.close()
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 마지막 로그인 시간 업데이트
            await conn.execute(
                "UPDATE welno.welno_patients SET last_auth_at = NOW() WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            await conn.close()
            
            # 헬퍼 함수로 날짜 변환
            patient_dict = self._serialize_patient_dates(dict(patient_row))
            
            return {
                "patient": patient_dict,
                "login_time": datetime.now().isoformat(),
                "message": "로그인 성공"
            }
            
        except Exception as e:
            print(f"❌ 로그인 처리 실패: {e}")
            return {"error": f"로그인 처리 중 오류가 발생했습니다: {str(e)}"}

    async def get_patient_by_uuid(self, uuid: str) -> Dict[str, Any]:
        """UUID로 환자 정보 조회 (캠페인 임시 유저 지원 보완)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 1. 정식 환자 정보 조회
            patient_row = await self._fetch_patient_base(
                conn,
                uuid=uuid,
                include_timestamps=True
            )
            
            # 2. 정식 환자가 없을 경우 캠페인 결제 테이블에서 임시 정보 확인
            if not patient_row:
                print(f"🔍 [get_patient_by_uuid] 정식 회원 없음, 캠페인 테이블 확인: {uuid}")
                campaign_row = await conn.fetchrow("""
                    SELECT oid, uuid, partner_id, user_name, user_data, email, status, created_at, updated_at
                    FROM welno.tb_campaign_payments
                    WHERE uuid = $1
                    ORDER BY created_at DESC LIMIT 1
                """, uuid)
                
                if campaign_row:
                    # 가상의 환자 정보 생성
                    user_data = campaign_row.get('user_data') or {}
                    if isinstance(user_data, str):
                        try:
                            user_data = json.loads(user_data)
                        except:
                            user_data = {}
                            
                    patient_dict = {
                        "id": -1, # 가상 ID
                        "uuid": uuid,
                        "hospital_id": "PEERNINE", # 캠페인 기본 병원
                        "name": campaign_row.get('user_name') or user_data.get('name', '고객'),
                        "phone_number": user_data.get('phone') or user_data.get('phone_number', ''),
                        "birth_date": user_data.get('birth') or user_data.get('birth_date'),
                        "gender": user_data.get('gender', 'M'),
                        "has_health_data": False,
                        "has_prescription_data": False,
                        "has_mediarc_report": campaign_row.get('status') == 'COMPLETED',
                        "registration_source": "PARTNER",
                        "partner_id": campaign_row.get('partner_id'),
                        "created_at": campaign_row.get('created_at'),
                        "updated_at": campaign_row.get('updated_at')
                    }
                    await conn.close()
                    return self._serialize_patient_dates(patient_dict)

            await conn.close()
            
            if not patient_row:
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 헬퍼 함수로 날짜 변환
            patient_dict = self._serialize_patient_dates(dict(patient_row))
            
            # 🔍 생년월일 데이터 확인 로그
            print(f"🔍 [get_patient_by_uuid] 환자 정보 조회 성공: {uuid}")
            return patient_dict
            
        except Exception as e:
            print(f"❌ 환자 정보 조회 실패: {e}")
            return {"error": f"환자 정보 조회 중 오류가 발생했습니다: {str(e)}"}

    async def get_patient_by_combo(
        self,
        phone_number: str,
        birth_date: str,  # YYYYMMDD 또는 YYYY-MM-DD 형식
        name: str
    ) -> Optional[Dict[str, Any]]:
        """전화번호, 생년월일, 이름으로 기존 환자 조회 (리팩토링 완료 - 헬퍼 함수 사용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 생년월일 형식 정규화 및 date 객체 변환
            try:
                if len(birth_date) == 8:  # YYYYMMDD
                    birth_date_obj = datetime.strptime(birth_date, "%Y%m%d").date()
                elif len(birth_date) == 10:  # YYYY-MM-DD
                    birth_date_obj = datetime.strptime(birth_date, "%Y-%m-%d").date()
                else:
                    print(f"⚠️ [환자조회] 생년월일 형식 오류: {birth_date}")
                    await conn.close()
                    return None
            except ValueError:
                print(f"⚠️ [환자조회] 잘못된 날짜 형식: {birth_date}")
                await conn.close()
                return None
            
            # 헬퍼 함수로 환자 정보 조회 (복합키, 타임스탬프 포함)
            patient_row = await self._fetch_patient_base(
                conn,
                phone_number=phone_number,
                birth_date=birth_date_obj,
                name=name,
                include_timestamps=True
            )
            await conn.close()
            
            if patient_row:
                # 헬퍼 함수로 날짜 변환
                patient_dict = self._serialize_patient_dates(dict(patient_row))
                print(f"✅ [환자조회] 기존 환자 발견: {patient_dict['uuid']} @ {patient_dict['hospital_id']}")
                return patient_dict
            
            print(f"📭 [환자조회] 기존 환자 없음: {phone_number}, {birth_date}, {name}")
            return None
            
        except Exception as e:
            print(f"❌ [환자조회] 오류: {e}")
            return None

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
                FROM welno.welno_hospitals 
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
                hospital_dict['supported_checkup_types'] = ['basic', 'comprehensive', 'optional']
            
            # 날짜 객체를 문자열로 변환
            if hospital_dict.get('created_at'):
                hospital_dict['created_at'] = hospital_dict['created_at'].isoformat()
            
            # ✅ [수정] 병원별 프리미엄 항목(설계용) 조회 로직 제거
            # 일반 병원 정보 조회 시에는 불필요하며, 로그를 어지럽힘. 
            # 필요한 경우 전용 설계 API를 통해 조회하도록 분리함.
            hospital_dict['external_checkup_items'] = []
            
            await conn.close()
            return hospital_dict
            
        except Exception as e:
            print(f"❌ 병원 정보 조회 실패: {e}")
            return {"error": f"병원 정보 조회 중 오류가 발생했습니다: {str(e)}"}

    async def collect_tilko_data(self, session_id: str) -> Dict[str, Any]:
        """Tilko 세션으로부터 데이터 수집"""
        try:
            print(f"📊 [데이터수집] 세션 {session_id}로부터 데이터 수집 시작")
            
            # 임시 데이터 (실제 연동 전)
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
            
            prescription_data = {
                "ResultList": [
                    {
                        "prescription_date": "2024-10-15",
                        "hospital_name": "김현우내과의원",
                        "medications": [
                            {
                                "drug_name": "아스피린", "dosage": "100mg", "frequency": "1일 1회", "duration": "30일"
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
            import datetime
            conn = await asyncpg.connect(**self.db_config)
            
            # 디버그: user_info 확인
            print(f"🔍 [환자저장] user_info 확인: {list(user_info.keys())}")
            print(f"   - name: {user_info.get('name')}")
            print(f"   - phone_number: {user_info.get('phone_number')}")
            print(f"   - birth_date: {user_info.get('birth_date')}")
            print(f"   - gender: {user_info.get('gender')}")
            
            birth_date = None
            if user_info.get('birth_date'):
                birth_str = user_info['birth_date']
                try:
                    if len(birth_str) == 8:
                        birth_date = datetime.date(int(birth_str[:4]), int(birth_str[4:6]), int(birth_str[6:8]))
                    elif '-' in birth_str:
                        parts = birth_str.split('-')
                        birth_date = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
                    print(f"✅ [환자저장] 생년월일 파싱 성공: {birth_date}")
                except Exception as e:
                    print(f"❌ [환자저장] 생년월일 파싱 실패: {e}, 원본: {birth_str}")
            
            phone_number = user_info.get('phone_number')
            name = user_info.get('name')
            gender = user_info.get('gender')
            
            print(f"🔍 [환자저장] 저장할 값: name={name}, phone_number={phone_number}, birth_date={birth_date}, gender={gender}")
            
            upsert_query = """
                INSERT INTO welno.welno_patients (uuid, hospital_id, name, phone_number, birth_date, gender, 
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
                uuid, hospital_id, name, phone_number,
                birth_date, gender, session_id
            )
            
            await conn.close()
            print(f"✅ [환자저장] 환자 정보 저장 완료 - ID: {patient_id}, 이름: {name}, 전화번호: {phone_number}, 생년월일: {birth_date}")
            return patient_id
            
        except Exception as e:
            print(f"❌ [환자저장] 오류: {e}")
            return None
    
    async def save_health_data(self, patient_uuid: str, hospital_id: str, health_data: Dict[str, Any], 
                              session_id: str, data_source: str = 'tilko', 
                              partner_id: Optional[str] = None, partner_oid: Optional[str] = None) -> bool:
        """건강검진 데이터 저장
        
        Args:
            patient_uuid: 환자 UUID
            hospital_id: 병원 ID
            health_data: 건강검진 데이터
            session_id: 세션 ID
            data_source: 데이터 출처 ('tilko', 'indexeddb', 'partner')
            partner_id: 파트너사 ID (partner 출처인 경우)
            partner_oid: 파트너사 주문번호 (partner 출처인 경우)
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 데이터 출처 검증
            if data_source not in ('tilko', 'indexeddb', 'partner'):
                data_source = 'tilko'  # 기본값
            
            # IndexedDB 동기화 시간 설정
            indexeddb_synced_at = None
            if data_source == 'indexeddb':
                indexeddb_synced_at = datetime.now()
            
            await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", 
                             patient_uuid, hospital_id)
            
            result_list = health_data.get('ResultList', [])
            saved_count = 0
            
            for item in result_list:
                year = item.get('Year')
                checkup_date = item.get('CheckUpDate')
                location = item.get('Location')
                code = item.get('Code')
                description = item.get('Description', '')
                
                # 수치 추출 (생략 가능)
                height = weight = bmi = bp_high = blood_sugar = cholesterol = None
                
                insert_query = """
                    INSERT INTO welno.welno_checkup_data 
                    (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                     data_source, indexeddb_synced_at, partner_id, partner_oid)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    year, checkup_date, location, code, description,
                    data_source, indexeddb_synced_at, partner_id, partner_oid
                )
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
            
            await conn.close()
            print(f"✅ [건강검진저장] {saved_count}건 저장 완료 (출처: {data_source})")
            return True
            
        except Exception as e:
            print(f"❌ [건강검진저장] 오류: {e}")
            return False
    
    async def save_prescription_data(self, patient_uuid: str, hospital_id: str, prescription_data: Dict[str, Any], 
                                   session_id: str, data_source: str = 'tilko',
                                   partner_id: Optional[str] = None, partner_oid: Optional[str] = None) -> bool:
        """처방전 데이터 저장
        
        Args:
            patient_uuid: 환자 UUID
            hospital_id: 병원 ID
            prescription_data: 처방전 데이터
            session_id: 세션 ID
            data_source: 데이터 출처 ('tilko', 'indexeddb', 'partner')
            partner_id: 파트너사 ID (partner 출처인 경우)
            partner_oid: 파트너사 주문번호 (partner 출처인 경우)
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 데이터 출처 검증
            if data_source not in ('tilko', 'indexeddb', 'partner'):
                data_source = 'tilko'  # 기본값
            
            # IndexedDB 동기화 시간 설정
            indexeddb_synced_at = None
            if data_source == 'indexeddb':
                indexeddb_synced_at = datetime.now()
            
            await conn.execute("DELETE FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2", 
                             patient_uuid, hospital_id)
            
            result_list = prescription_data.get('ResultList', [])
            saved_count = 0
            
            for item in result_list:
                idx = item.get('Idx')
                page = item.get('Page')
                hospital_name = item.get('ByungEuiwonYakGukMyung')
                address = item.get('Address')
                treatment_date_str = item.get('JinRyoGaesiIl')
                treatment_type = item.get('JinRyoHyungTae')
                
                treatment_date = None
                if treatment_date_str:
                    try:
                        treatment_date = datetime.strptime(treatment_date_str, '%Y-%m-%d').date()
                    except:
                        pass
                
                insert_query = """
                    INSERT INTO welno.welno_prescription_data 
                    (patient_uuid, hospital_id, raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                     data_source, indexeddb_synced_at, partner_id, partner_oid)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    idx, page, hospital_name, address, treatment_date, treatment_type,
                    data_source, indexeddb_synced_at, partner_id, partner_oid
                )
                saved_count += 1
            
            # 환자 테이블 업데이트 (데이터 출처 및 동기화 시간 포함)
            update_patient_query = """
                UPDATE welno.welno_patients 
                SET has_prescription_data = TRUE, 
                    last_data_update = NOW(),
                    data_source = $3,
                    last_indexeddb_sync_at = CASE WHEN $3 = 'indexeddb' THEN NOW() ELSE last_indexeddb_sync_at END,
                    last_partner_sync_at = CASE WHEN $3 = 'partner' THEN NOW() ELSE last_partner_sync_at END
                WHERE uuid = $1 AND hospital_id = $2
            """
            await conn.execute(update_patient_query, patient_uuid, hospital_id, data_source)
            
            await conn.close()
            print(f"✅ [처방전저장] {saved_count}건 저장 완료 (출처: {data_source})")
            return True
            
        except Exception as e:
            print(f"❌ [처방전저장] 오류: {e}")
            return False
    
    async def load_checkup_design_survey(
        self, 
        patient_uuid: str, 
        hospital_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        환자의 가장 최근 검진설계 문진 데이터 조회
        
        ## 용도
        질병예측 리포트 생성 시 검진설계에서 수집한 문진 데이터를 자동으로 반영하여
        더 정확한 예측 리포트를 생성합니다.
        
        ## 데이터 출처
        - **테이블**: `welno.welno_checkup_design_requests`
        - **컬럼**: `survey_responses` (JSONB)
        - **정렬**: `created_at DESC` (가장 최근 데이터)
        
        ## 반환 데이터 형식
        ```json
        {
            "smoking": "current_smoker",
            "drinking": "weekly_1_2",
            "family_history": ["heart_disease", "diabetes"],
            "exercise_frequency": "sometimes",
            "sleep_hours": "6_7",
            "daily_routine": ["physical_job", "mental_stress"],
            "weight_change": "decrease_bad",
            "additional_concerns": ""
        }
        ```
        
        ## 사용 예시
        ```python
        # Mediarc 리포트 생성 전 문진 조회
        survey = await service.load_checkup_design_survey(uuid, hospital_id)
        
        if survey:
            # 문진 데이터 변환
            from app.services.mediarc.questionnaire_mapper import map_checkup_design_survey_to_mediarc
            questionnaire_codes = map_checkup_design_survey_to_mediarc(survey)
            
            # Mediarc 생성 시 포함
            await generate_mediarc_report_async(..., questionnaire_data=questionnaire_codes)
        ```
        
        Args:
            patient_uuid: 환자 UUID
            hospital_id: 병원 ID
            
        Returns:
            Optional[Dict]: 문진 응답 데이터 (없으면 None)
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 가장 최근 검진설계 문진 조회
            result = await conn.fetchrow("""
                SELECT cdr.survey_responses
                FROM welno.welno_checkup_design_requests cdr
                JOIN welno.welno_patients p ON cdr.patient_id = p.id
                WHERE p.uuid = $1 AND p.hospital_id = $2
                  AND cdr.survey_responses IS NOT NULL
                ORDER BY cdr.created_at DESC
                LIMIT 1
            """, patient_uuid, hospital_id)
            
            await conn.close()
            
            if not result or not result['survey_responses']:
                print(f"ℹ️ [문진조회] 검진설계 문진 없음: {patient_uuid}")
                return None
            
            # JSONB 파싱 (asyncpg는 문자열로 반환할 수 있음)
            survey_data = result['survey_responses']
            if isinstance(survey_data, str):
                import json
                survey_data = json.loads(survey_data)
            
            print(f"✅ [문진조회] 검진설계 문진 발견: {patient_uuid}")
            print(f"   - 흡연: {survey_data.get('smoking')}")
            print(f"   - 음주: {survey_data.get('drinking')}")
            print(f"   - 가족력: {survey_data.get('family_history')}")
            
            return survey_data
            
        except Exception as e:
            print(f"❌ [문진조회] 오류: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def save_mediarc_report(
        self, 
        patient_uuid: str, 
        hospital_id: str, 
        mediarc_response: Dict[str, Any],
        has_questionnaire: bool = False,
        questionnaire_data: Optional[Dict] = None
    ) -> bool:
        """
        Mediarc 질병예측 리포트 저장
        
        Args:
            patient_uuid: 환자 UUID
            hospital_id: 병원 ID
            mediarc_response: Mediarc API 원본 응답
            has_questionnaire: 문진 데이터 포함 여부
            questionnaire_data: 문진 응답 데이터
            
        Returns:
            bool: 저장 성공 여부
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 1. 기존 리포트 삭제 (UNIQUE 제약조건: patient_uuid, hospital_id)
            await conn.execute(
                "DELETE FROM welno.welno_mediarc_reports WHERE patient_uuid = $1 AND hospital_id = $2", 
                patient_uuid, hospital_id
            )
            print(f"🗑️ [Mediarc저장] 기존 리포트 삭제 완료")
            
            # 2. 응답에서 핵심 필드 추출
            response_data = mediarc_response.get('data', {})
            
            mkt_uuid = response_data.get('mkt_uuid')
            report_url = response_data.get('report_url')
            provider = response_data.get('provider', 'twobecon')
            analyzed_at_str = response_data.get('analyzed_at')
            bodyage = response_data.get('bodyage')
            rank = response_data.get('rank')
            disease_data = response_data.get('disease_data')
            cancer_data = response_data.get('cancer_data')
            
            # analyzed_at 파싱
            analyzed_at = None
            if analyzed_at_str:
                try:
                    analyzed_at = datetime.fromisoformat(analyzed_at_str.replace('Z', '+00:00'))
                except:
                    pass
            
            # 3. 새 리포트 삽입
            insert_query = """
                INSERT INTO welno.welno_mediarc_reports 
                (patient_uuid, hospital_id, raw_response, mkt_uuid, report_url, provider,
                 analyzed_at, bodyage, rank, disease_data, cancer_data, 
                 has_questionnaire, questionnaire_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """
            
            await conn.execute(
                insert_query,
                patient_uuid,
                hospital_id,
                json.dumps(mediarc_response, ensure_ascii=False),  # raw_response
                mkt_uuid,
                report_url,
                provider,
                analyzed_at,
                bodyage,
                rank,
                json.dumps(disease_data, ensure_ascii=False) if disease_data else None,
                json.dumps(cancer_data, ensure_ascii=False) if cancer_data else None,
                has_questionnaire,
                json.dumps(questionnaire_data, ensure_ascii=False) if questionnaire_data else None
            )
            
            print(f"✅ [Mediarc저장] 리포트 저장 완료 - bodyage: {bodyage}, rank: {rank}")
            
            # 4. 환자 테이블 플래그 업데이트
            update_query = """
                UPDATE welno.welno_patients 
                SET has_mediarc_report = TRUE, 
                    has_questionnaire_data = $3,
                    last_data_update = NOW() 
                WHERE uuid = $1 AND hospital_id = $2
            """
            await conn.execute(update_query, patient_uuid, hospital_id, has_questionnaire)
            
            print(f"✅ [Mediarc저장] 환자 플래그 업데이트 완료 - has_questionnaire: {has_questionnaire}")
            
            await conn.close()
            return True
            
        except Exception as e:
            print(f"❌ [Mediarc저장] 오류: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def get_patient_health_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 모든 건강정보 조회 (hospital_id가 없으면 UUID만으로 조회)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 먼저 UUID와 hospital_id로 조회 시도
            patient_query = "SELECT * FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2"
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            # 없으면 UUID만으로 조회 (hospital_id가 다를 수 있음)
            if not patient_row:
                print(f"⚠️ [get_patient_health_data] UUID+hospital_id 조합으로 환자를 찾을 수 없음. UUID만으로 재시도: uuid={uuid}, hospital_id={hospital_id}")
                patient_query_uuid_only = "SELECT * FROM welno.welno_patients WHERE uuid = $1 ORDER BY last_auth_at DESC NULLS LAST, created_at DESC LIMIT 1"
                patient_row = await conn.fetchrow(patient_query_uuid_only, uuid)
                
                if patient_row:
                    # 실제 DB의 hospital_id로 업데이트
                    actual_hospital_id = dict(patient_row).get('hospital_id')
                    print(f"✅ [get_patient_health_data] UUID만으로 환자 찾음. 실제 hospital_id: {actual_hospital_id} (요청한 hospital_id: {hospital_id})")
                    hospital_id = actual_hospital_id  # 실제 hospital_id로 업데이트
            
            if not patient_row:
                await conn.close()
                return {"error": "환자를 찾을 수 없습니다"}
            
            # 🔍 생년월일 데이터 확인 로그
            patient_dict_temp = dict(patient_row)
            print(f"🔍 [get_patient_health_data] 환자 정보 조회:")
            print(f"  - uuid: {uuid}")
            print(f"  - hospital_id: {hospital_id}")
            print(f"  - name: {patient_dict_temp.get('name')}")
            print(f"  - birth_date (DB): {patient_dict_temp.get('birth_date')}")
            print(f"  - birth_date 타입: {type(patient_dict_temp.get('birth_date'))}")
            print(f"  - birth_date NULL 여부: {patient_dict_temp.get('birth_date') is None}")
            
            health_query = """
                SELECT * FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
            """
            health_rows = await conn.fetch(health_query, uuid, hospital_id)
            
            prescription_query = """
                SELECT * FROM welno.welno_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY treatment_date DESC
            """
            prescription_rows = await conn.fetch(prescription_query, uuid, hospital_id)
            
            await conn.close()
            
            # 🔍 [DB 로그] 조회된 데이터 개수 확인
            print(f"🔍 [get_patient_health_data] 조회 결과:")
            print(f"  - 건강검진 데이터: {len(health_rows)}건")
            print(f"  - 처방전 데이터: {len(prescription_rows)}건")
            
            # Decimal 변환 헬퍼
            def convert(obj):
                if isinstance(obj, Decimal): return float(obj)
                if isinstance(obj, (datetime, date)): return obj.isoformat()
                if isinstance(obj, dict): return {k: convert(v) for k, v in obj.items()}
                if isinstance(obj, list): return [convert(i) for i in obj]
                return obj

            # raw_data JSON 파싱 (에러 처리 추가)
            health_data_formatted = []
            for idx, r in enumerate(health_rows):
                try:
                    # asyncpg Record를 dict로 변환
                    row_dict = dict(r)
                    
                    raw_data = None
                    if row_dict.get('raw_data'):
                        if isinstance(row_dict['raw_data'], str):
                            try:
                                raw_data = json.loads(row_dict['raw_data'])
                                print(f"✅ [건강검진데이터 JSON 파싱 성공] ID: {row_dict.get('id')}, raw_data 키 수: {len(raw_data) if isinstance(raw_data, dict) else 'N/A'}")
                            except json.JSONDecodeError as json_err:
                                print(f"⚠️ [건강검진데이터 JSON 파싱 오류] ID: {row_dict.get('id')}, 오류: {json_err}")
                                print(f"   raw_data 타입: {type(row_dict['raw_data'])}, 길이: {len(row_dict['raw_data']) if isinstance(row_dict['raw_data'], str) else 'N/A'}")
                                raw_data = None
                        elif isinstance(row_dict['raw_data'], dict):
                            raw_data = row_dict['raw_data']
                    
                    # raw_data를 포함한 dict 생성
                    formatted_dict = {**row_dict, "raw_data": raw_data}
                    formatted_item = convert(formatted_dict)
                    health_data_formatted.append(formatted_item)
                    print(f"✅ [건강검진데이터 파싱 성공] ID: {row_dict.get('id')}, year: {row_dict.get('year')}, checkup_date: {row_dict.get('checkup_date')}, 배열크기: {len(health_data_formatted)}")
                except Exception as e:
                    print(f"❌ [건강검진데이터 파싱 오류] ID: {r.get('id') if hasattr(r, 'get') else 'unknown'}, 인덱스: {idx}, 오류: {e}")
                    import traceback
                    traceback.print_exc()
                    # 파싱 실패해도 기본 데이터는 포함
                    try:
                        row_dict = dict(r) if hasattr(r, 'keys') else {}
                        health_data_formatted.append(convert({**row_dict, "raw_data": None}))
                    except Exception as convert_err:
                        print(f"❌ [건강검진데이터 변환 실패] 인덱스: {idx}, 오류: {convert_err}")
            
            prescription_data_formatted = []
            for idx, r in enumerate(prescription_rows):
                try:
                    raw_data = None
                    if r.get('raw_data'):
                        if isinstance(r['raw_data'], str):
                            try:
                                raw_data = json.loads(r['raw_data'])
                            except json.JSONDecodeError as json_err:
                                print(f"⚠️ [처방전데이터 JSON 파싱 오류] ID: {r.get('id')}, 오류: {json_err}")
                                raw_data = None
                        elif isinstance(r['raw_data'], dict):
                            raw_data = r['raw_data']
                    
                    formatted_item = convert({**dict(r), "raw_data": raw_data})
                    prescription_data_formatted.append(formatted_item)
                except Exception as e:
                    print(f"❌ [처방전데이터 파싱 오류] ID: {r.get('id')}, 인덱스: {idx}, 오류: {e}")
                    import traceback
                    traceback.print_exc()
                    # 파싱 실패해도 기본 데이터는 포함
                    try:
                        prescription_data_formatted.append(convert({**dict(r), "raw_data": None}))
                    except Exception as convert_err:
                        print(f"❌ [처방전데이터 변환 실패] ID: {r.get('id')}, 오류: {convert_err}")

            print(f"🔍 [get_patient_health_data] 변환 완료:")
            print(f"  - 건강검진 데이터: {len(health_data_formatted)}건")
            print(f"  - 처방전 데이터: {len(prescription_data_formatted)}건")

            return {
                "patient": convert(dict(patient_row)),
                "health_data": health_data_formatted,
                "prescription_data": prescription_data_formatted
            }
            
        except Exception as e:
            print(f"❌ [데이터조회] 오류: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def search_patients(self, name: str) -> List[Dict[str, Any]]:
        """이름으로 환자 목록 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            query = "SELECT * FROM welno.welno_patients WHERE name LIKE $1"
            rows = await conn.fetch(query, f"%{name}%")
            await conn.close()
            
            results = []
            for r in rows:
                d = dict(r)
                if d.get('birth_date'): d['birth_date'] = d['birth_date'].isoformat()
                results.append(d)
            return results
        except Exception as e:
            print(f"❌ [환자검색] 오류: {e}")
            return []

    async def get_patient_prescription_data(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """환자의 처방전 데이터 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 처방전 데이터 조회
            prescription_query = """
                SELECT raw_data, idx, page, hospital_name, address, treatment_date, treatment_type,
                       collected_at, created_at
                FROM welno.welno_prescription_data 
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
                    "collected_at": row.get('collected_at').isoformat() if row.get('collected_at') else None,
                    "created_at": row.get('created_at').isoformat() if row.get('created_at') else None
                })
            
            await conn.close()
            return {"prescription_data": prescription_data_list}
            
        except Exception as e:
            print(f"❌ [처방전 데이터 조회] 오류: {e}")
            return {"error": f"처방전 데이터 조회 중 오류가 발생했습니다: {str(e)}"}

    async def get_latest_checkup_design(self, uuid: str, hospital_id: str) -> Optional[Dict[str, Any]]:
        """최신 검진 설계 결과 조회"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            patient_id = await conn.fetchval("SELECT id FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2", uuid, hospital_id)
            if not patient_id:
                await conn.close()
                return None
            
            row = await conn.fetchrow("""
                SELECT * FROM welno.welno_checkup_design_requests
                WHERE patient_id = $1 AND design_result IS NOT NULL
                ORDER BY created_at DESC LIMIT 1
            """, patient_id)
            await conn.close()
            
            if row:
                return {
                    "id": row['id'],
                    "design_result": json.loads(row['design_result']) if row['design_result'] else {},
                    "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
                }
            return None
        except Exception as e:
            print(f"❌ [검진설계조회] 오류: {e}")
            return None

    async def update_patient_chat_persona(self, uuid: str, persona_data: Dict[str, Any]) -> bool:
        """환자의 채팅 기반 페르소나 데이터 업데이트"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            query = """
                UPDATE welno.welno_patients 
                SET chat_persona_data = $1,
                    updated_at = NOW()
                WHERE uuid = $2
            """
            await conn.execute(query, json.dumps(persona_data, ensure_ascii=False), uuid)
            await conn.close()
            print(f"✅ [페르소나] 환자 페르소나 업데이트 완료: {uuid}")
            return True
        except Exception as e:
            print(f"❌ [페르소나] 업데이트 오류: {e}")
            return False

    async def save_checkup_design_request(
        self,
        uuid: str,
        hospital_id: str,
        selected_concerns: List[Dict[str, Any]],
        survey_responses: Optional[Dict[str, Any]] = None,
        design_result: Optional[Dict[str, Any]] = None,
        step1_result: Optional[Dict[str, Any]] = None,
        step2_result: Optional[Dict[str, Any]] = None,
        prescription_analysis_text: Optional[str] = None,
        selected_medication_texts: Optional[List[str]] = None,
        additional_info: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        status: str = 'pending',
        error_stage: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """검진 설계 요청 및 결과 저장 (재시도 가능하도록 모든 파라미터 저장)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 ID 조회
            patient_query = """
                SELECT id FROM welno.welno_patients 
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
            
            # 검진 설계 요청 저장 (확장된 컬럼 포함)
            insert_query = """
                INSERT INTO welno.welno_checkup_design_requests 
                (patient_id, uuid, hospital_id,
                 selected_concerns, survey_responses, additional_concerns, 
                 step1_result, step2_result, design_result,
                 prescription_analysis_text, selected_medication_texts, additional_info,
                 session_id, status, error_stage, error_message,
                 created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
                RETURNING id
            """
            
            request_id = await conn.fetchval(
                insert_query,
                patient_id,
                uuid,
                hospital_id,
                json.dumps(selected_concerns, ensure_ascii=False),
                json.dumps(survey_responses, ensure_ascii=False) if survey_responses else None,
                additional_concerns,
                json.dumps(step1_result, ensure_ascii=False) if step1_result else None,
                json.dumps(step2_result, ensure_ascii=False) if step2_result else None,
                json.dumps(design_result, ensure_ascii=False) if design_result else None,
                prescription_analysis_text,
                json.dumps(selected_medication_texts, ensure_ascii=False) if selected_medication_texts else None,
                json.dumps(additional_info, ensure_ascii=False) if additional_info else None,
                session_id,
                status,
                error_stage,
                error_message
            )
            
            await conn.close()
            
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"✅ [검진설계요청] 저장 완료 - ID: {request_id}, 환자: {uuid} @ {hospital_id}, 상태: {status}")
            logger.info(f"   - 선택 항목: {len(selected_concerns)}개")
            logger.info(f"   - 설문 응답: {'있음' if survey_responses else '없음'}")
            logger.info(f"   - STEP1 결과: {'있음' if step1_result else '없음'}")
            logger.info(f"   - STEP2 결과: {'있음' if step2_result else '없음'}")
            logger.info(f"   - 설계 결과: {'있음' if design_result else '없음'}")
            
            return {
                "success": True,
                "request_id": request_id
            }
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [검진설계요청] 저장 오류: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_checkup_design_request(
        self,
        request_id: int,
        step2_result: Optional[Dict[str, Any]] = None,
        design_result: Optional[Dict[str, Any]] = None,
        status: Optional[str] = None,
        error_stage: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """검진 설계 요청 업데이트 (재시도용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            update_query = """
                UPDATE welno.welno_checkup_design_requests 
                SET 
                    step2_result = COALESCE($2, step2_result),
                    design_result = COALESCE($3, design_result),
                    status = COALESCE($4, status),
                    error_stage = $5,
                    error_message = $6,
                    retry_count = retry_count + 1,
                    last_retry_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, retry_count
            """
            
            result = await conn.fetchrow(
                update_query,
                request_id,
                json.dumps(step2_result, ensure_ascii=False) if step2_result else None,
                json.dumps(design_result, ensure_ascii=False) if design_result else None,
                status,
                error_stage,
                error_message
            )
            
            await conn.close()
            
            if result:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"✅ [검진설계업데이트] 완료 - ID: {result['id']}, 재시도: {result['retry_count']}회")
                return {
                    "success": True,
                    "request_id": result['id'],
                    "retry_count": result['retry_count']
                }
            else:
                return {
                    "success": False,
                    "error": "요청을 찾을 수 없습니다."
                }
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [검진설계업데이트] 오류: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_incomplete_checkup_design(
        self,
        uuid: str,
        hospital_id: str
    ) -> Optional[Dict[str, Any]]:
        """미완료 검진 설계 요청 조회 (step1_completed 상태)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    id, uuid, hospital_id, patient_id,
                    selected_concerns, survey_responses, additional_concerns,
                    step1_result, prescription_analysis_text, selected_medication_texts,
                    additional_info, session_id, status, error_stage, error_message,
                    retry_count, created_at, last_retry_at
                FROM welno.welno_checkup_design_requests
                WHERE uuid = $1 AND hospital_id = $2 
                  AND status = 'step1_completed'
                ORDER BY created_at DESC
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, uuid, hospital_id)
            await conn.close()
            
            if row:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"✅ [미완료조회] 발견 - ID: {row['id']}, 환자: {uuid}")
                return dict(row)
            
            return None
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [미완료조회] 오류: {e}", exc_info=True)
            return None
    
    async def get_latest_checkup_design(
        self,
        uuid: str,
        hospital_id: str
    ) -> Optional[Dict[str, Any]]:
        """최신 완료된 검진 설계 조회 (step2_completed 상태)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT design_result
                FROM welno.welno_checkup_design_requests
                WHERE uuid = $1 AND hospital_id = $2 
                  AND status = 'step2_completed'
                  AND design_result IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, uuid, hospital_id)
            await conn.close()
            
            if row and row['design_result']:
                return json.loads(row['design_result'])
            
            return None
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [완료된설계조회] 오류: {e}", exc_info=True)
            return None
    
    # ========================================
    # 통합 상태 관리 (Unified Status Pipeline)
    # ========================================
    
    async def get_unified_status(
        self,
        uuid: str,
        hospital_id: str,
        partner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        통합 상태 반환 (데이터 출처 포함)
        
        환자의 건강검진/처방/리포트 데이터 상태를 통합 조회하고,
        데이터 출처(Tilko/IndexedDB/파트너)별 정보를 제공합니다.
        
        Args:
            uuid: 환자 UUID
            hospital_id: 병원 ID
            partner_id: 파트너 ID (선택, 결제 상태 확인용)
            
        Returns:
            {
                "status": "ACTION_REQUIRED" | "PAYMENT_REQUIRED" | "REPORT_PENDING" | "REPORT_READY" | "REPORT_EXPIRED",
                "data_sources": {
                    "tilko": {"count": int, "last_synced_at": str | None},
                    "indexeddb": {"count": int, "last_synced_at": str | None},
                    "partner": {"count": int, "last_synced_at": str | None}
                },
                "primary_source": "tilko" | "indexeddb" | "partner" | None,
                "has_checkup_data": bool,
                "has_prescription_data": bool,
                "has_report": bool,
                "has_payment": bool,
                "requires_payment": bool,
                "metric_count": int,
                "is_sufficient": bool,
                "total_checkup_count": int,
                "prescription_count": int
            }
        """
        import logging
        from app.utils.health_metrics import get_metric_count
        from app.utils.partner_utils import requires_payment as check_payment_required
        from app.utils.partner_config import get_partner_config
        from datetime import datetime, timedelta
        
        logger = logging.getLogger(__name__)
        
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 1. 환자 정보 조회
            patient_row = await self._fetch_patient_base(conn, uuid=uuid, hospital_id=hospital_id)
            if not patient_row:
                await conn.close()
                logger.warning(f"[통합상태] 환자 정보 없음: {uuid}")
                return {
                    "status": "ACTION_REQUIRED",
                    "data_sources": {"tilko": {"count": 0, "last_synced_at": None}, "indexeddb": {"count": 0, "last_synced_at": None}, "partner": {"count": 0, "last_synced_at": None}},
                    "primary_source": None,
                    "has_checkup_data": False,
                    "has_prescription_data": False,
                    "has_report": False,
                    "has_payment": False,
                    "requires_payment": True,
                    "metric_count": 0,
                    "is_sufficient": False,
                    "total_checkup_count": 0,
                    "prescription_count": 0,
                    "terms_agreed": False,
                    "terms_agreed_at": None,
                    "terms_details": {},
                    "missing_terms": ['terms_service', 'terms_privacy', 'terms_sensitive']
                }
            
            # 2. 데이터 출처별 건수 및 타임스탬프 조회 (data_source 컬럼 사용)
            data_sources_query = """
                SELECT 
                    data_source, 
                    COUNT(*) as count, 
                    MAX(updated_at) as last_synced_at
                FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                GROUP BY data_source
            """
            source_rows = await conn.fetch(data_sources_query, uuid, hospital_id)
            
            # 기본 구조 초기화 (welno_patients의 타임스탬프 사용)
            data_sources = {
                "tilko": {
                    "count": 0, 
                    "last_synced_at": patient_row.get('last_data_update')
                },
                "indexeddb": {
                    "count": 0, 
                    "last_synced_at": patient_row.get('last_indexeddb_sync_at')
                },
                "partner": {
                    "count": 0, 
                    "last_synced_at": patient_row.get('last_partner_sync_at')
                }
            }
            
            # welno_checkup_data의 집계 결과 반영
            total_checkup_count = 0
            for row in source_rows:
                source = row['data_source']
                count = row['count']
                total_checkup_count += count
                
                if source in data_sources:
                    data_sources[source]['count'] = count
                    # 더 최신 타임스탬프 사용 (welno_checkup_data vs welno_patients)
                    if row['last_synced_at']:
                        existing_ts = data_sources[source]['last_synced_at']
                        if not existing_ts or row['last_synced_at'] > existing_ts:
                            data_sources[source]['last_synced_at'] = row['last_synced_at']
            
            # 3. 주 출처 결정 (우선순위: Tilko > IndexedDB > 파트너)
            primary_source = None
            if data_sources['tilko']['count'] > 0:
                primary_source = 'tilko'
            elif data_sources['indexeddb']['count'] > 0:
                primary_source = 'indexeddb'
            elif data_sources['partner']['count'] > 0:
                primary_source = 'partner'
            
            # 4. 데이터 충족 여부 판단
            has_checkup_data = total_checkup_count > 0
            metric_count = 0
            
            if has_checkup_data:
                latest_checkup_query = """
                    SELECT raw_data, height, weight, bmi, blood_pressure_high, blood_pressure_low,
                           blood_sugar, cholesterol, hdl_cholesterol, ldl_cholesterol, triglyceride
                    FROM welno.welno_checkup_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                    ORDER BY checkup_date DESC, updated_at DESC
                    LIMIT 1
                """
                latest_row = await conn.fetchrow(latest_checkup_query, uuid, hospital_id)
                
                if latest_row:
                    # raw_data에서 지표 개수 계산
                    if latest_row['raw_data']:
                        # raw_data가 JSON 문자열인 경우 파싱
                        raw_data = latest_row['raw_data']
                        if isinstance(raw_data, str):
                            import json
                            raw_data = json.loads(raw_data)
                        metric_count = get_metric_count(raw_data)
                    
                    # raw_data가 없거나 metric_count가 0인 경우, 직접 컬럼에서 확인
                    if metric_count == 0:
                        column_count = sum(
                            1 for field in ['height', 'weight', 'bmi', 'blood_pressure_high', 'blood_pressure_low',
                                          'blood_sugar', 'cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'triglyceride']
                            if latest_row.get(field) not in [None, 0, 0.0]
                        )
                        
                        if column_count == 0:
                            logger.warning(f"[데이터품질] UUID={uuid}: 검진 레코드는 있지만 모든 지표가 NULL")
                            has_checkup_data = False  # 실질적으로 데이터 없음으로 처리
                        else:
                            metric_count = column_count
            
            is_sufficient = metric_count >= 5
            
            # 5. 처방전 데이터 확인
            prescription_count_query = """
                SELECT COUNT(*) FROM welno.welno_prescription_data
                WHERE patient_uuid = $1 AND hospital_id = $2
            """
            prescription_count = await conn.fetchval(prescription_count_query, uuid, hospital_id) or 0
            has_prescription_data = prescription_count > 0
            
            # 6. 리포트 존재 여부 확인 (+ 플래그 검증)
            report_query = """
                SELECT report_url, analyzed_at, updated_at
                FROM welno.welno_mediarc_reports
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY created_at DESC
                LIMIT 1
            """
            report_row = await conn.fetchrow(report_query, uuid, hospital_id)
            has_report_actual = bool(report_row and report_row['report_url'])
            
            # ✅ 플래그 검증 및 자동 보정
            if patient_row['has_mediarc_report'] != has_report_actual:
                logger.warning(
                    f"[플래그불일치] UUID={uuid}: has_mediarc_report={patient_row['has_mediarc_report']} "
                    f"but actual_report={has_report_actual}. 자동 보정 중..."
                )
                
                # 플래그 자동 보정
                await conn.execute("""
                    UPDATE welno.welno_patients
                    SET has_mediarc_report = $1, updated_at = NOW()
                    WHERE uuid = $2 AND hospital_id = $3
                """, has_report_actual, uuid, hospital_id)
            
            has_report = has_report_actual  # 실제 데이터 기준 사용
            
            # 리포트 만료 여부 확인 (S3 presigned URL은 7일)
            report_expired = False
            if has_report and report_row:
                updated_at = report_row['updated_at']
                if isinstance(updated_at, datetime):
                    if updated_at < datetime.now(updated_at.tzinfo) - timedelta(days=7):
                        report_expired = True
                        logger.info(f"[리포트만료] UUID={uuid}: updated_at={updated_at}")
            
            # 7. 결제 상태 확인 (파트너만)
            has_payment = False
            requires_payment_flag = False
            
            if partner_id:
                payment_query = """
                    SELECT status FROM welno.tb_campaign_payments
                    WHERE uuid = $1 AND partner_id = $2
                    ORDER BY created_at DESC
                    LIMIT 1
                """
                payment_row = await conn.fetchrow(payment_query, uuid, partner_id)
                has_payment = payment_row and payment_row['status'] == 'COMPLETED'
                
                # 파트너 설정에서 결제 필요 여부 확인 (asyncpg 사용)
                partner_row = await conn.fetchrow("""
                    SELECT config
                    FROM welno.tb_partner_config
                    WHERE partner_id = $1 AND is_active = true
                    LIMIT 1
                """, partner_id)
                partner_config = dict(partner_row) if partner_row else None
                requires_payment_flag = check_payment_required(partner_config)
            
            # 8. 약관 동의 상태 확인 (✨ 추가)
            from app.utils.terms_agreement import verify_terms_agreement
            
            terms_status = await verify_terms_agreement(uuid, hospital_id, conn)
            
            await conn.close()
            
            # 9. 최종 상태 판단 (약관 우선순위 최상위)
            # 약관 미동의 시 다른 상태와 무관하게 최우선 처리
            if not terms_status['is_agreed']:
                if has_report:
                    status = "TERMS_REQUIRED_WITH_REPORT"  # 리포트 있지만 약관 필요
                elif is_sufficient:
                    status = "TERMS_REQUIRED_WITH_DATA"   # 데이터 있지만 약관 필요
                else:
                    status = "TERMS_REQUIRED"             # 약관 필요 + 데이터 없음
            elif has_report:
                # 리포트 존재
                if report_expired:
                    status = "REPORT_EXPIRED"
                else:
                    status = "REPORT_READY"
            elif not is_sufficient:
                # 데이터 부족
                if requires_payment_flag and has_payment:
                    status = "ACTION_REQUIRED_PAID"  # 결제 완료했지만 데이터 부족 (자동 인증 유도)
                else:
                    status = "ACTION_REQUIRED"
            elif requires_payment_flag and not has_payment:
                status = "PAYMENT_REQUIRED"  # 결제 필요
            else:
                status = "REPORT_PENDING"  # 리포트 생성 대기
            
            logger.info(
                f"[통합상태] UUID={uuid}: status={status}, terms={terms_status['is_agreed']}, "
                f"data={is_sufficient}({metric_count}), report={has_report}, payment={has_payment}/{requires_payment_flag}"
            )
            
            # 10. 응답 생성
            return {
                "status": status,
                "data_sources": {
                    k: {
                        "count": v['count'],
                        "last_synced_at": v['last_synced_at'].isoformat() if v['last_synced_at'] and isinstance(v['last_synced_at'], datetime) else None
                    }
                    for k, v in data_sources.items()
                },
                "primary_source": primary_source,
                "has_checkup_data": has_checkup_data,
                "has_prescription_data": has_prescription_data,
                "has_report": has_report,
                "has_payment": has_payment,
                "requires_payment": requires_payment_flag,
                "metric_count": metric_count,
                "is_sufficient": is_sufficient,
                "total_checkup_count": total_checkup_count,
                "prescription_count": prescription_count,
                
                # ✨ 약관 상태 추가
                "terms_agreed": terms_status['is_agreed'],
                "terms_agreed_at": terms_status['agreed_at'].isoformat() if terms_status['agreed_at'] and isinstance(terms_status['agreed_at'], datetime) else None,
                "terms_details": terms_status['terms_details'],
                "missing_terms": terms_status['missing_terms']
            }
            
        except Exception as e:
            logger.error(f"[통합상태] 오류: {e}", exc_info=True)
            raise
    
    async def merge_partner_and_tilko_data(
        self,
        uuid: str,
        hospital_id: str,
        partner_id: str
    ) -> Dict[str, Any]:
        """
        파트너 데이터와 Tilko 데이터 병합
        
        파트너사에서 제공한 데이터가 부족한 경우, Tilko 인증 후
        두 데이터를 병합합니다. (Tilko 데이터 우선)
        
        Args:
            uuid: 환자 UUID
            hospital_id: 병원 ID
            partner_id: 파트너 ID
            
        Returns:
            {
                "merged_count": int,  # 병합 후 지표 개수
                "tilko_count": int,   # Tilko 데이터 건수
                "partner_data": bool, # 파트너 데이터 존재 여부
                "data_source": "tilko"  # 최종 출처
            }
        """
        import logging
        from app.utils.health_metrics import get_metric_count
        
        logger = logging.getLogger(__name__)
        
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 1. 파트너 데이터 조회
            partner_data_query = """
                SELECT user_data FROM welno.tb_campaign_payments
                WHERE uuid = $1 AND partner_id = $2
                ORDER BY created_at DESC
                LIMIT 1
            """
            partner_row = await conn.fetchrow(partner_data_query, uuid, partner_id)
            partner_data = partner_row['user_data'] if partner_row and partner_row['user_data'] else {}
            
            # 2. Tilko 데이터 조회
            tilko_data_query = """
                SELECT * FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY checkup_date DESC
            """
            tilko_rows = await conn.fetch(tilko_data_query, uuid, hospital_id)
            
            # 3. 데이터 병합 (Tilko 우선, 파트너 데이터로 보완)
            health_metrics = [
                'height', 'weight', 'waist', 'bmi', 'sbp', 'dbp', 'fbs',
                'tc', 'hdl', 'ldl', 'tg', 'ast', 'alt', 'scr'
            ]
            
            merged_data = {}
            for metric in health_metrics:
                # Tilko 데이터 우선
                tilko_value = tilko_rows[0][metric] if tilko_rows and tilko_rows[0].get(metric) else None
                partner_value = partner_data.get(metric)
                merged_data[metric] = tilko_value if tilko_value is not None else partner_value
            
            # 4. 병합 결과 저장 (metric_count 계산)
            metric_count = sum(1 for v in merged_data.values() if v not in [None, '', 0, 0.0])
            
            # 5. 환자 테이블 업데이트 (Tilko가 주 출처)
            update_query = """
                UPDATE welno.welno_patients
                SET has_health_data = TRUE,
                    last_data_update = NOW(),
                    updated_at = NOW()
                WHERE uuid = $1 AND hospital_id = $2
            """
            await conn.execute(update_query, uuid, hospital_id)
            
            await conn.close()
            
            logger.info(f"[데이터병합] UUID={uuid}: Tilko={len(tilko_rows)}건 + 파트너={bool(partner_data)} → 지표={metric_count}개")
            
            return {
                'merged_count': metric_count,
                'tilko_count': len(tilko_rows),
                'partner_data': bool(partner_data),
                'data_source': 'tilko'  # 최종 출처
            }
            
        except Exception as e:
            logger.error(f"[데이터병합] 오류: {e}", exc_info=True)
            raise
    
    async def save_terms_agreement(self, uuid: str, hospital_id: str, terms_agreement: Dict[str, Any]) -> Dict[str, Any]:
        """약관 동의 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 약관 동의 정보를 JSONB로 저장
            # welno_patients 테이블에 terms_agreement 필드가 있는지 확인하고 업데이트
            # 없으면 ALTER TABLE로 추가 필요 (스키마 마이그레이션)
            
            # 먼저 환자 존재 확인
            patient_check = await conn.fetchrow(
                "SELECT id FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
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
                    UPDATE welno.welno_patients 
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
                    "ALTER TABLE welno.welno_patients ADD COLUMN IF NOT EXISTS terms_agreement JSONB"
                )
                await conn.execute(
                    "ALTER TABLE welno.welno_patients ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ"
                )
                # 다시 업데이트
                update_query = """
                    UPDATE welno.welno_patients 
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
    
    async def save_terms_agreement_detail(
        self, 
        uuid: str, 
        hospital_id: str, 
        terms_agreement_detail: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        약관 동의 상세 정보 저장 (각 약관별 개별 타임스탬프)
        
        Args:
            uuid: 환자 UUID
            hospital_id: 병원 ID
            terms_agreement_detail: 각 약관별 동의 정보
                {
                    "terms_service": {"agreed": true, "agreed_at": "2026-01-25T10:30:00Z"},
                    "terms_privacy": {"agreed": true, "agreed_at": "2026-01-25T10:30:00Z"},
                    "terms_sensitive": {"agreed": true, "agreed_at": "2026-01-25T10:30:00Z"},
                    "terms_marketing": {"agreed": false, "agreed_at": null}
                }
        """
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 환자 존재 확인
            patient_check = await conn.fetchrow(
                "SELECT id FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
                uuid, hospital_id
            )
            
            if not patient_check:
                await conn.close()
                return {
                    "success": False,
                    "error": "환자 정보를 찾을 수 없습니다."
                }
            
            # 필수 약관 모두 동의했는지 확인
            all_required_agreed = (
                terms_agreement_detail.get('terms_service', {}).get('agreed', False) and
                terms_agreement_detail.get('terms_privacy', {}).get('agreed', False) and
                terms_agreement_detail.get('terms_sensitive', {}).get('agreed', False)
            )
            
            # 약관 동의 상세 정보 저장
            update_query = """
                UPDATE welno.welno_patients 
                SET terms_agreement_detail = $1,
                    terms_all_required_agreed_at = CASE 
                        WHEN $2 THEN NOW() 
                        ELSE terms_all_required_agreed_at 
                    END,
                    updated_at = NOW()
                WHERE uuid = $3 AND hospital_id = $4
            """
            
            await conn.execute(
                update_query,
                json.dumps(terms_agreement_detail, ensure_ascii=False),
                all_required_agreed,
                uuid, 
                hospital_id
            )
            
            await conn.close()
            
            print(f"✅ [약관동의상세] 저장 완료: {uuid} @ {hospital_id}")
            print(f"   - 서비스 이용약관: {terms_agreement_detail.get('terms_service', {}).get('agreed', False)}")
            print(f"   - 개인정보 수집/이용: {terms_agreement_detail.get('terms_privacy', {}).get('agreed', False)}")
            print(f"   - 민감정보 수집/이용: {terms_agreement_detail.get('terms_sensitive', {}).get('agreed', False)}")
            print(f"   - 마케팅 활용: {terms_agreement_detail.get('terms_marketing', {}).get('agreed', False)}")
            print(f"   - 모든 필수 약관 동의: {all_required_agreed}")
            
            return {
                "success": True,
                "terms_agreement_detail": terms_agreement_detail,
                "all_required_agreed": all_required_agreed
            }
            
        except Exception as e:
            print(f"❌ [약관동의상세] 저장 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# 싱글톤 인스턴스
welno_data_service = WelnoDataService()
