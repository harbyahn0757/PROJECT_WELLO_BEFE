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
        """UUID로 환자 정보 조회 (리팩토링 완료 - 헬퍼 함수 사용)"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 헬퍼 함수로 환자 정보 조회 (타임스탬프 포함)
            patient_row = await self._fetch_patient_base(
                conn,
                uuid=uuid,
                include_timestamps=True
            )
            await conn.close()
            
            if not patient_row:
                return {"error": "환자 정보를 찾을 수 없습니다"}
            
            # 헬퍼 함수로 날짜 변환
            patient_dict = self._serialize_patient_dates(dict(patient_row))
            
            # 🔍 생년월일 데이터 확인 로그
            print(f"🔍 [get_patient_by_uuid] 환자 정보 조회:")
            print(f"  - uuid: {uuid}")
            print(f"  - name: {patient_dict.get('name')}")
            print(f"  - birth_date (원본): {dict(patient_row).get('birth_date')}")
            print(f"  - birth_date (변환 후): {patient_dict.get('birth_date')}")
            print(f"  - birth_date NULL 여부: {dict(patient_row).get('birth_date') is None}")
            
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
            
            # 외부 검사 항목 매핑 조회 (테이블이 존재하는 경우에만)
            try:
                print(f"🔍 [병원별 프리미엄 항목] 조회 시작 - hospital_id: {hospital_id}")
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
                        e.manufacturer,
                        e.target,
                        e.input_sample,
                        e.algorithm_class,
                        m.display_order
                    FROM welno.welno_hospital_external_checkup_mapping m
                    JOIN welno.welno_external_checkup_items e ON m.external_checkup_item_id = e.id
                    WHERE m.hospital_id = $1 AND m.is_active = true AND e.is_active = true
                    ORDER BY m.display_order
                """, hospital_id)
                
                if external_checkup_items:
                    print(f"✅ [병원별 프리미엄 항목] 조회 성공 - {len(external_checkup_items)}개 항목 발견")
                    # 난이도별 통계
                    difficulty_stats = {}
                    for item in external_checkup_items:
                        level = item['difficulty_level']
                        difficulty_stats[level] = difficulty_stats.get(level, 0) + 1
                    print(f"📊 [병원별 프리미엄 항목] 난이도별 통계: {difficulty_stats}")
                    
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
                            'manufacturer': item['manufacturer'],
                            'target': item['target'],
                            'input_sample': item['input_sample'],
                            'algorithm_class': item['algorithm_class'],
                            'display_order': item['display_order']
                        }
                        for item in external_checkup_items
                    ]
                    # 처음 3개 항목만 로그 출력
                    for idx, item in enumerate(external_checkup_items[:3]):
                        algorithm_info = f" [{item.get('algorithm_class', 'N/A')}]" if item.get('algorithm_class') else ""
                        target_info = f" - {item.get('target', 'N/A')}" if item.get('target') else ""
                        print(f"  [{idx+1}] {item['item_name']} ({item['difficulty_level']}){algorithm_info}{target_info} - {item['category']}")
                    if len(external_checkup_items) > 3:
                        print(f"  ... 외 {len(external_checkup_items) - 3}개 항목")
                else:
                    print(f"⚠️ [병원별 프리미엄 항목] 매핑된 항목 없음 - hospital_id: {hospital_id}")
                    hospital_dict['external_checkup_items'] = []
            except Exception as e:
                print(f"❌ [병원별 프리미엄 항목] 조회 실패 (무시): {e}")
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
                              session_id: str) -> bool:
        """건강검진 데이터 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
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
                    (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    year, checkup_date, location, code, description
                )
                saved_count += 1
            
            await conn.execute(
                "UPDATE welno.welno_patients SET has_health_data = TRUE, last_data_update = NOW() WHERE uuid = $1 AND hospital_id = $2",
                patient_uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [건강검진저장] {saved_count}건 저장 완료")
            return True
            
        except Exception as e:
            print(f"❌ [건강검진저장] 오류: {e}")
            return False
    
    async def save_prescription_data(self, patient_uuid: str, hospital_id: str, prescription_data: Dict[str, Any], 
                                   session_id: str) -> bool:
        """처방전 데이터 저장"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
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
                    (patient_uuid, hospital_id, raw_data, idx, page, hospital_name, address, treatment_date, treatment_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """
                
                await conn.execute(
                    insert_query,
                    patient_uuid, hospital_id, json.dumps(item, ensure_ascii=False),
                    idx, page, hospital_name, address, treatment_date, treatment_type
                )
                saved_count += 1
            
            await conn.execute(
                "UPDATE welno.welno_patients SET has_prescription_data = TRUE, last_data_update = NOW() WHERE uuid = $1 AND hospital_id = $2",
                patient_uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [처방전저장] {saved_count}건 저장 완료")
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

# 싱글톤 인스턴스
welno_data_service = WelnoDataService()
