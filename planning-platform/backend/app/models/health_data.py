"""
건강 데이터 관련 모델
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class TilkoAuthRequest(BaseModel):
    """틸코 인증 요청"""
    user_name: str
    phone_number: str
    birth_date: str
    gender: str

class TilkoAuthResponse(BaseModel):
    """틸코 인증 응답"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str

class TilkoHealthScreeningRequest(BaseModel):
    """건강검진 데이터 요청"""
    token: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class TilkoHealthScreeningResponse(BaseModel):
    """건강검진 데이터 응답"""
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    message: str

class TilkoPrescriptionRequest(BaseModel):
    """처방전 데이터 요청"""
    token: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class TilkoPrescriptionResponse(BaseModel):
    """처방전 데이터 응답"""
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    message: str

class HealthData(BaseModel):
    """통합 건강 데이터"""
    checkup_results: List[Dict[str, Any]]
    prescriptions: List[Dict[str, Any]]

class HealthConnectResponse(BaseModel):
    """건강 데이터 연동 응답"""
    success: bool
    data: Optional[HealthData] = None
    message: str
    error_code: Optional[str] = None

class ErrorResponse(BaseModel):
    """에러 응답"""
    success: bool = False
    message: str
    error_code: str