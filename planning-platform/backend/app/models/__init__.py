"""
도메인 모델 패키지

객체지향 도메인 모델 설계:
- Entity: 고유 식별자를 가진 객체
- Value Object: 불변 값 객체
- Aggregate: 일관성 경계를 가진 객체 집합
- Domain Service: 도메인 로직을 캡슐화하는 서비스
"""

from .entities import (
    Patient,
    Hospital,
    CheckupResult,
    CheckupDesign,
    UserSession
)

from .value_objects import (
    PatientInfo,
    HospitalInfo,
    ContactInfo,
    Address,
    CheckupItem
)

__all__ = [
    "Patient",
    "Hospital", 
    "CheckupResult",
    "CheckupDesign",
    "UserSession",
    "PatientInfo",
    "HospitalInfo",
    "ContactInfo",
    "Address",
    "CheckupItem"
]

