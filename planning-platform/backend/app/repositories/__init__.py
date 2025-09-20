"""
Repository 패턴 구현

Repository 패턴의 이점:
- 데이터 접근 로직을 캡슐화
- 테스트 가능성 향상 (Mock 객체 사용 가능)
- 데이터베이스 의존성 분리
- SOLID 원칙 준수
"""

from .interfaces import (
    IPatientRepository,
    IHospitalRepository,
    ICheckupResultRepository,
    ICheckupDesignRepository,
    IUserSessionRepository
)

from .implementations import (
    PatientRepository,
    HospitalRepository,
    CheckupResultRepository,
    CheckupDesignRepository,
    UserSessionRepository
)

__all__ = [
    "IPatientRepository",
    "IHospitalRepository", 
    "ICheckupResultRepository",
    "ICheckupDesignRepository",
    "IUserSessionRepository",
    "PatientRepository",
    "HospitalRepository",
    "CheckupResultRepository", 
    "CheckupDesignRepository",
    "UserSessionRepository"
]

