"""
Service Layer 패턴 구현

비즈니스 로직을 캡슐화하고 도메인 모델과 Repository를 조합합니다.

주요 서비스:
- PatientService: 환자 관련 비즈니스 로직
- HospitalService: 병원 관련 비즈니스 로직  
- CheckupDesignService: GPT 기반 검진 설계
- SessionService: 세션 관리
- AnalyticsService: Google Analytics 연동
"""

from .patient_service import PatientService
from .hospital_service import HospitalService
from .checkup_design_service import CheckupDesignService
from .session_service import SessionService
from .analytics_service import AnalyticsService

__all__ = [
    "PatientService",
    "HospitalService", 
    "CheckupDesignService",
    "SessionService",
    "AnalyticsService"
]

