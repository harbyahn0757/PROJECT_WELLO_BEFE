"""
값 객체 (Value Objects) 정의

Value Object는 불변하며 식별자가 없는 객체입니다.
동등성은 속성 값으로 판단됩니다.
"""

from datetime import date, datetime
from typing import Optional
from dataclasses import dataclass
from enum import Enum


class Gender(Enum):
    """성별"""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class LayoutType(Enum):
    """레이아웃 타입"""
    VERTICAL = "vertical"      # 세로 스크롤형
    HORIZONTAL = "horizontal"  # 가로 스크롤형


class CheckupType(Enum):
    """검진 타입"""
    BASIC = "basic"              # 기본 검진
    PREMIUM = "premium"          # 프리미엄 검진
    SPECIALIZED = "specialized"  # 특화 검진
    COMPREHENSIVE = "comprehensive"  # 종합 검진
    CANCER = "cancer"            # 암 검진
    CARDIOVASCULAR = "cardiovascular"  # 심혈관 검진
    HEART = "heart"              # 심혈관 검진
    BRAIN = "brain"              # 뇌혈관 검진
    DIABETES = "diabetes"        # 당뇨 검진
    LIVER = "liver"              # 간 기능 검진
    KIDNEY = "kidney"            # 신장 기능 검진
    THYROID = "thyroid"          # 갑상선 검진
    BONE = "bone"                # 골밀도 검진
    EYE = "eye"                  # 안과 검진
    DENTAL = "dental"            # 치과 검진


@dataclass(frozen=True)
class PatientInfo:
    """환자 기본 정보 값 객체"""
    name: str
    birth_date: date
    gender: Gender
    
    def get_age(self) -> int:
        """나이 계산"""
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.get_age()}세, {self.gender.value})"


@dataclass(frozen=True)
class ContactInfo:
    """연락처 정보 값 객체"""
    phone: str
    email: Optional[str] = None
    emergency_contact: Optional[str] = None
    
    def __str__(self) -> str:
        return self.phone


@dataclass(frozen=True)
class Address:
    """주소 정보 값 객체"""
    street: str              # 도로명 주소
    city: str                # 시/도
    district: str            # 구/군
    postal_code: Optional[str] = None
    
    def get_full_address(self) -> str:
        """전체 주소 반환"""
        parts = [self.city, self.district, self.street]
        if self.postal_code:
            parts.insert(0, f"({self.postal_code})")
        return " ".join(parts)
    
    def __str__(self) -> str:
        return self.get_full_address()


@dataclass(frozen=True)
class HospitalInfo:
    """병원 정보 값 객체"""
    name: str
    registration_number: Optional[str] = None  # 사업자 등록번호
    license_number: Optional[str] = None       # 의료기관 허가번호
    
    def __str__(self) -> str:
        return self.name


@dataclass(frozen=True)
class CheckupItem:
    """개별 검진 항목 값 객체"""
    checkup_type: str        # 검진 타입
    item_name: str           # 검진 항목명
    result_value: Optional[str] = None    # 검진 결과값
    normal_range: Optional[str] = None    # 정상 범위
    unit: Optional[str] = None            # 단위
    checkup_date: Optional[date] = None   # 검진 날짜
    cost: Optional[int] = None            # 비용
    description: Optional[str] = None     # 설명
    
    def is_normal(self) -> Optional[bool]:
        """정상 범위 여부 판단 (간단한 로직)"""
        if not self.result_value or not self.normal_range:
            return None
        
        # 숫자형 결과의 경우 간단한 범위 체크
        try:
            result_num = float(self.result_value)
            if "-" in self.normal_range:
                min_val, max_val = map(float, self.normal_range.split("-"))
                return min_val <= result_num <= max_val
        except (ValueError, TypeError):
            pass
        
        # 문자형 결과의 경우 단순 비교
        return self.result_value.lower() in ["정상", "normal", "negative"]
    
    def get_status_text(self) -> str:
        """상태 텍스트 반환"""
        is_normal = self.is_normal()
        if is_normal is None:
            return "판정 불가"
        return "정상" if is_normal else "이상"
    
    def __str__(self) -> str:
        base = f"{self.item_name}"
        if self.result_value:
            base += f": {self.result_value}"
            if self.unit:
                base += f" {self.unit}"
        return base


@dataclass(frozen=True)
class GPTPrompt:
    """GPT 프롬프트 값 객체"""
    system_message: str
    user_message: str
    temperature: float = 0.7
    max_tokens: int = 1000
    
    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "system": self.system_message,
            "user": self.user_message,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }


@dataclass(frozen=True)
class AnalyticsEvent:
    """Google Analytics 이벤트 값 객체"""
    event_name: str
    client_id: str
    timestamp: datetime
    parameters: dict
    
    def to_ga4_format(self) -> dict:
        """GA4 형식으로 변환"""
        return {
            "client_id": self.client_id,
            "events": [{
                "name": self.event_name,
                "params": {
                    **self.parameters,
                    "timestamp_micros": int(self.timestamp.timestamp() * 1000000)
                }
            }]
        }
