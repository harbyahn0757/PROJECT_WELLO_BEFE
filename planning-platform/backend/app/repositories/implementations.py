"""
레포지토리 구현 - 실제 PostgreSQL DB 연동
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime
import json

from ..models.entities import (
    Hospital, HospitalInfo, ContactInfo, Address,
    Patient, PatientInfo,
    CheckupResult, CheckupDesign, UserSession
)
from ..models.value_objects import Gender
from ..core.database import db_manager

class HospitalRepository:
    """병원 레포지토리"""
    
    async def get_by_id(self, hospital_id: str) -> Optional[Hospital]:
        """ID로 병원 조회 (DB 기반)"""
        query = """
            SELECT hospital_id, hospital_name, phone, address, layout_type, 
                   brand_color, logo_position, is_active, supported_checkup_types
            FROM p9_mkt_biz.wello_hospitals 
            WHERE hospital_id = %s AND is_active = true
        """
        
        result = await db_manager.execute_one(query, (hospital_id,))
        if result:
            # 주소 파싱 (간단하게 처리)
            address_parts = result['address'].split(' ') if result['address'] else ['서울특별시', '강남구', '']
            city = address_parts[0] if len(address_parts) > 0 else '서울특별시'
            district = address_parts[1] if len(address_parts) > 1 else '강남구'
            detail = ' '.join(address_parts[2:]) if len(address_parts) > 2 else ''
            
            return Hospital(
                hospital_id=result['hospital_id'],
                info=HospitalInfo(name=result['hospital_name']),
                contact=ContactInfo(phone=result['phone']),
                address=Address(city=city, district=district, detail=detail),
                supported_checkup_types=result['supported_checkup_types'],
                layout_type=result['layout_type'],
                brand_color=result['brand_color'],
                logo_position=result['logo_position'],
                is_active=result['is_active']
            )
        return None
    
    async def get_by_name(self, name: str) -> Optional[Hospital]:
        """이름으로 병원 조회 (DB 기반)"""
        query = """
            SELECT hospital_id, hospital_name, phone, address, layout_type, 
                   brand_color, logo_position, is_active, supported_checkup_types
            FROM p9_mkt_biz.wello_hospitals 
            WHERE hospital_name = %s AND is_active = true
        """
        
        result = await db_manager.execute_one(query, (name,))
        if result:
            address_parts = result['address'].split(' ') if result['address'] else ['서울특별시', '강남구', '']
            city = address_parts[0] if len(address_parts) > 0 else '서울특별시'
            district = address_parts[1] if len(address_parts) > 1 else '강남구'
            detail = ' '.join(address_parts[2:]) if len(address_parts) > 2 else ''
            
            return Hospital(
                hospital_id=result['hospital_id'],
                info=HospitalInfo(name=result['hospital_name']),
                contact=ContactInfo(phone=result['phone']),
                address=Address(city=city, district=district, detail=detail),
                supported_checkup_types=result['supported_checkup_types'],
                layout_type=result['layout_type'],
                brand_color=result['brand_color'],
                logo_position=result['logo_position'],
                is_active=result['is_active']
            )
        return None
    
    async def get_all_active(self) -> List[Hospital]:
        """활성화된 모든 병원 조회 (DB 기반)"""
        query = """
            SELECT hospital_id, hospital_name, phone, address, layout_type, 
                   brand_color, logo_position, is_active, supported_checkup_types
            FROM p9_mkt_biz.wello_hospitals 
            WHERE is_active = true
            ORDER BY hospital_name
        """
        
        results = await db_manager.execute_query(query)
        hospitals = []
        for result in results:
            address_parts = result['address'].split(' ') if result['address'] else ['서울특별시', '강남구', '']
            city = address_parts[0] if len(address_parts) > 0 else '서울특별시'
            district = address_parts[1] if len(address_parts) > 1 else '강남구' 
            detail = ' '.join(address_parts[2:]) if len(address_parts) > 2 else ''
            
            hospitals.append(Hospital(
                hospital_id=result['hospital_id'],
                info=HospitalInfo(name=result['hospital_name']),
                contact=ContactInfo(phone=result['phone']),
                address=Address(city=city, district=district, detail=detail),
                supported_checkup_types=result['supported_checkup_types'],
                layout_type=result['layout_type'],
                brand_color=result['brand_color'],
                logo_position=result['logo_position'],
                is_active=result['is_active']
            ))
        return hospitals
    
    async def search_by_address(self, city: str, district: Optional[str] = None) -> List[Hospital]:
        """주소로 병원 검색 (간단 구현)"""
        return await self.get_all_active()  # 일단 모든 병원 반환


class PatientRepository:
    """환자 레포지토리"""
    
    async def get_by_uuid(self, uuid: UUID) -> Optional[Patient]:
        """UUID로 환자 조회 (DB 기반)"""
        query = """
            SELECT uuid, name, birthday, gender, phoneno, hosnm, visitdate, regdate
            FROM p9_mkt_biz.mdx_agr_list 
            WHERE uuid = %s
        """
        
        result = await db_manager.execute_one(query, (str(uuid),))
        if result:
            # 나이 계산
            age = 0
            birth_date = None
            if result['birthday']:
                birth_date = result['birthday']
                age = datetime.now().year - birth_date.year
                if datetime.now().date() < birth_date.replace(year=datetime.now().year):
                    age -= 1
            
            # 성별 변환
            gender_mapping = {'M': Gender.MALE, 'F': Gender.FEMALE}
            gender = gender_mapping.get(result['gender'], Gender.MALE)
            
            # 병원 ID 찾기 (병원명으로 매핑)
            hospital_query = """
                SELECT hospital_id FROM p9_mkt_biz.wello_hospitals 
                WHERE hospital_name = %s LIMIT 1
            """
            hospital_result = await db_manager.execute_one(hospital_query, (result['hosnm'],))
            hospital_id = hospital_result['hospital_id'] if hospital_result else 'UNKNOWN'
            
            return Patient(
                uuid=UUID(result['uuid']),
                info=PatientInfo(
                    name=result['name'],
                    age=age,
                    gender=gender,
                    birth_date=birth_date
                ),
                phone=result['phoneno'],
                hospital_id=hospital_id,
                last_checkup_count=1,
                created_at=result['regdate'] if result['regdate'] else datetime.now()
            )
        return None
    
    async def get_by_phone(self, phone: str) -> Optional[Patient]:
        """전화번호로 환자 조회 (DB 기반)"""
        query = """
            SELECT uuid, name, birthday, gender, phoneno, hosnm, visitdate, regdate
            FROM p9_mkt_biz.mdx_agr_list 
            WHERE phoneno = %s
            LIMIT 1
        """
        
        result = await db_manager.execute_one(query, (phone,))
        if result:
            # 나이 계산
            age = 0
            birth_date = None
            if result['birthday']:
                birth_date = result['birthday']
                age = datetime.now().year - birth_date.year
                if datetime.now().date() < birth_date.replace(year=datetime.now().year):
                    age -= 1
            
            # 성별 변환
            gender_mapping = {'M': Gender.MALE, 'F': Gender.FEMALE}
            gender = gender_mapping.get(result['gender'], Gender.MALE)
            
            # 병원 ID 찾기 (병원명으로 매핑)
            hospital_query = """
                SELECT hospital_id FROM p9_mkt_biz.wello_hospitals 
                WHERE hospital_name = %s LIMIT 1
            """
            hospital_result = await db_manager.execute_one(hospital_query, (result['hosnm'],))
            hospital_id = hospital_result['hospital_id'] if hospital_result else 'UNKNOWN'
            
            return Patient(
                uuid=UUID(result['uuid']),
                info=PatientInfo(
                    name=result['name'],
                    age=age,
                    gender=gender,
                    birth_date=birth_date
                ),
                phone=result['phoneno'],
                hospital_id=hospital_id,
                last_checkup_count=1,
                created_at=result['regdate'] if result['regdate'] else datetime.now()
            )
        return None


class CheckupResultRepository:
    """검진 결과 레포지토리"""
    
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupResult]:
        """환자의 검진 결과 조회"""
        # TODO: 실제 데이터베이스 연동
        return []


class CheckupDesignRepository:
    """검진 설계 레포지토리"""
    
    async def save(self, design: CheckupDesign) -> str:
        """검진 설계 저장"""
        # TODO: 실제 데이터베이스 연동
        return design.design_id
    
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupDesign]:
        """환자의 검진 설계 조회"""
        # TODO: 실제 데이터베이스 연동
        return []


class UserSessionRepository:
    """사용자 세션 레포지토리"""
    
    async def save(self, session: UserSession) -> str:
        """세션 저장"""
        # TODO: 실제 데이터베이스 연동
        return session.session_id
    
    async def get_by_id(self, session_id: str) -> Optional[UserSession]:
        """세션 ID로 조회"""
        # TODO: 실제 데이터베이스 연동
        return None
    
    async def update(self, session: UserSession) -> bool:
        """세션 업데이트"""
        # TODO: 실제 데이터베이스 연동
        return True
    
    async def delete(self, session_id: str) -> bool:
        """세션 삭제"""
        # TODO: 실제 데이터베이스 연동
        return True