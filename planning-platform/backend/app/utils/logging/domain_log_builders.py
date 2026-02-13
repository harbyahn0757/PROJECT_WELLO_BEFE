"""
도메인 로그 빌더

질병예측 서비스의 다양한 도메인 이벤트에 대한 구조화된 로그를 생성합니다.
"""

import inspect
from datetime import datetime
from typing import Dict, Any, Optional


class InfraErrorLogBuilder:
    """인프라 에러 로그 빌더"""
    
    @staticmethod
    def build_payment_log(payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        결제 관련 로그 생성
        
        Args:
            payment_data: 결제 데이터
                - event_type: 이벤트 타입 (start, success, failed, cancelled, dropout)
                - oid: 주문번호
                - uuid: 사용자 UUID
                - partner_id: 파트너 ID
                - amount: 결제 금액
                - status: 결제 상태
                - error_message: 에러 메시지
                - branch_type: 분기 타입 (리포트생성/틸코인증)
                - location: 발생 위치
        
        Returns:
            Dict[str, Any]: 구조화된 결제 로그
        """
        # 호출자 정보 자동 추출
        caller_frame = inspect.currentframe().f_back
        caller_info = f"{caller_frame.f_code.co_filename}:{caller_frame.f_lineno}"
        
        result = {
            "event_type": payment_data.get("event_type", "unknown"),
            "oid": payment_data.get("oid"),
            "uuid": payment_data.get("uuid"),
            "partner_id": payment_data.get("partner_id"),
            "amount": payment_data.get("amount"),
            "status": payment_data.get("status"),
            "error_message": payment_data.get("error_message"),
            "branch_type": payment_data.get("branch_type"),
            "location": payment_data.get("location", caller_info),
            "timestamp": datetime.now().isoformat(),
            "context": {
                "domain": "payment",
                "service": "welno_disease_prediction",
                "component": "payment_system"
            }
        }
        # 환자 정보 전달
        if payment_data.get("user_name"):
            result["user_name"] = payment_data["user_name"]
        if payment_data.get("user_phone"):
            result["user_phone"] = payment_data["user_phone"]
        if payment_data.get("hospital_name"):
            result["hospital_name"] = payment_data["hospital_name"]
        return result
    
    @staticmethod
    def build_report_log(report_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        리포트 관련 로그 생성
        
        Args:
            report_data: 리포트 데이터
                - event_type: 이벤트 타입 (success, failed)
                - oid: 주문번호
                - uuid: 사용자 UUID
                - duration: 소요 시간 (초)
                - data_source: 데이터 소스 (Tilko/파트너)
                - error_message: 에러 메시지
                - location: 발생 위치
        
        Returns:
            Dict[str, Any]: 구조화된 리포트 로그
        """
        # 호출자 정보 자동 추출
        caller_frame = inspect.currentframe().f_back
        caller_info = f"{caller_frame.f_code.co_filename}:{caller_frame.f_lineno}"
        
        return {
            "event_type": report_data.get("event_type", "unknown"),
            "oid": report_data.get("oid"),
            "uuid": report_data.get("uuid"),
            "duration": report_data.get("duration"),
            "data_source": report_data.get("data_source"),
            "error_message": report_data.get("error_message"),
            "location": report_data.get("location", caller_info),
            "timestamp": datetime.now().isoformat(),
            "context": {
                "domain": "report",
                "service": "welno_disease_prediction",
                "component": "report_system"
            }
        }
    
    @staticmethod
    def build_error_log(error_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        에러 관련 로그 생성
        
        Args:
            error_data: 에러 데이터
                - error_type: 에러 타입 (system_error, api_error)
                - error_code: 에러 코드
                - location: 에러 위치
                - uuid: 사용자 UUID
                - error_message: 에러 메시지
                - stack_trace: 스택 트레이스
        
        Returns:
            Dict[str, Any]: 구조화된 에러 로그
        """
        # 호출자 정보 자동 추출
        caller_frame = inspect.currentframe().f_back
        caller_info = f"{caller_frame.f_code.co_filename}:{caller_frame.f_lineno}"
        
        return {
            "error_type": error_data.get("error_type", "system_error"),
            "error_code": error_data.get("error_code"),
            "location": error_data.get("location", caller_info),
            "uuid": error_data.get("uuid"),
            "error_message": error_data.get("error_message"),
            "stack_trace": error_data.get("stack_trace"),
            "timestamp": datetime.now().isoformat(),
            "context": {
                "domain": "error",
                "service": "welno_disease_prediction",
                "component": "error_system"
            }
        }
    
    @staticmethod
    def build_application_log(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        애플리케이션 로그 생성 (기존 코드와의 호환성을 위한 메서드)
        
        Args:
            data: 애플리케이션 로그 데이터
                - req: Express Request 객체 (선택적)
                - context: 로그 컨텍스트
                - message: 로그 메시지
                - error: 에러 메시지
                - error_code: 에러 코드
        
        Returns:
            Dict[str, Any]: 구조화된 애플리케이션 로그
        """
        # 호출자 정보 자동 추출
        caller_frame = inspect.currentframe().f_back
        caller_info = f"{caller_frame.f_code.co_filename}:{caller_frame.f_lineno}"
        
        # 에러 여부 판단
        is_error = data.get("error") is not None or data.get("error_code") == "APPLICATION_ERROR"
        
        log_data = {
            "context": data.get("context", "application"),
            "message": data.get("message"),
            "error": data.get("error"),
            "error_code": data.get("error_code", "SYSTEM_NOTIFICATION"),
            "location": caller_info,
            "timestamp": datetime.now().isoformat(),
            "log_level": "error" if is_error else "info",
            "context_info": {
                "service": "welno_disease_prediction",
                "component": "application"
            }
        }
        
        # Request 정보 추가 (있는 경우)
        if data.get("req"):
            req = data["req"]
            log_data["request_info"] = {
                "method": getattr(req, "method", None),
                "url": getattr(req, "url", None),
                "user_agent": getattr(req, "headers", {}).get("user-agent"),
                "ip": getattr(req, "ip", None)
            }
        
        return log_data


class PaymentLogBuilder:
    """결제 전용 로그 빌더"""
    
    @staticmethod
    def build_payment_start_log(oid: str, uuid: str, partner_id: Optional[str] = None,
                               amount: Optional[int] = None,
                               user_name: Optional[str] = None,
                               user_phone: Optional[str] = None,
                               hospital_name: Optional[str] = None) -> Dict[str, Any]:
        """결제 시작 로그 생성"""
        log_data = {
            "event_type": "start",
            "oid": oid,
            "uuid": uuid,
            "partner_id": partner_id,
            "amount": amount
        }
        if user_name: log_data["user_name"] = user_name
        if user_phone: log_data["user_phone"] = user_phone
        if hospital_name: log_data["hospital_name"] = hospital_name
        return InfraErrorLogBuilder.build_payment_log(log_data)

    @staticmethod
    def build_payment_success_log(oid: str, uuid: str, amount: int, branch_type: str,
                                 partner_id: Optional[str] = None,
                                 user_name: Optional[str] = None,
                                 user_phone: Optional[str] = None,
                                 hospital_name: Optional[str] = None) -> Dict[str, Any]:
        """결제 성공 로그 생성"""
        log_data = {
            "event_type": "success",
            "oid": oid,
            "uuid": uuid,
            "partner_id": partner_id,
            "amount": amount,
            "branch_type": branch_type,
            "status": "COMPLETED"
        }
        if user_name: log_data["user_name"] = user_name
        if user_phone: log_data["user_phone"] = user_phone
        if hospital_name: log_data["hospital_name"] = hospital_name
        return InfraErrorLogBuilder.build_payment_log(log_data)
    
    @staticmethod
    def build_payment_failed_log(oid: str, uuid: str, error_message: str,
                                partner_id: Optional[str] = None) -> Dict[str, Any]:
        """결제 실패 로그 생성"""
        return InfraErrorLogBuilder.build_payment_log({
            "event_type": "failed",
            "oid": oid,
            "uuid": uuid,
            "partner_id": partner_id,
            "error_message": error_message,
            "status": "FAILED"
        })
    
    @staticmethod
    def build_payment_cancelled_log(oid: str, uuid: str, reason: str,
                                   partner_id: Optional[str] = None) -> Dict[str, Any]:
        """결제 취소 로그 생성"""
        return InfraErrorLogBuilder.build_payment_log({
            "event_type": "cancelled",
            "oid": oid,
            "uuid": uuid,
            "partner_id": partner_id,
            "error_message": reason,
            "status": "CANCELLED"
        })
    
    @staticmethod
    def build_payment_dropout_log(uuid: str, dropout_point: str, reason: str,
                                 oid: Optional[str] = None, partner_id: Optional[str] = None) -> Dict[str, Any]:
        """결제 이탈 로그 생성"""
        return InfraErrorLogBuilder.build_payment_log({
            "event_type": "dropout",
            "oid": oid,
            "uuid": uuid,
            "partner_id": partner_id,
            "error_message": f"{dropout_point}: {reason}",
            "status": "DROPOUT"
        })


class ReportLogBuilder:
    """리포트 전용 로그 빌더"""
    
    @staticmethod
    def build_report_success_log(oid: str, uuid: str, duration: int, data_source: str) -> Dict[str, Any]:
        """리포트 생성 성공 로그 생성"""
        return InfraErrorLogBuilder.build_report_log({
            "event_type": "success",
            "oid": oid,
            "uuid": uuid,
            "duration": duration,
            "data_source": data_source
        })
    
    @staticmethod
    def build_report_failed_log(oid: str, uuid: str, error_message: str,
                               duration: Optional[int] = None) -> Dict[str, Any]:
        """리포트 생성 실패 로그 생성"""
        return InfraErrorLogBuilder.build_report_log({
            "event_type": "failed",
            "oid": oid,
            "uuid": uuid,
            "duration": duration,
            "error_message": error_message
        })


class ErrorLogBuilder:
    """에러 전용 로그 빌더"""
    
    @staticmethod
    def build_api_error_log(error_message: str, location: str, uuid: Optional[str] = None,
                           error_code: Optional[str] = None) -> Dict[str, Any]:
        """API 에러 로그 생성"""
        return InfraErrorLogBuilder.build_error_log({
            "error_type": "api_error",
            "error_code": error_code or "API_ERROR",
            "location": location,
            "uuid": uuid,
            "error_message": error_message
        })
    
    @staticmethod
    def build_system_error_log(error_message: str, location: str, uuid: Optional[str] = None,
                              stack_trace: Optional[str] = None) -> Dict[str, Any]:
        """시스템 에러 로그 생성"""
        return InfraErrorLogBuilder.build_error_log({
            "error_type": "system_error",
            "error_code": "SYSTEM_ERROR",
            "location": location,
            "uuid": uuid,
            "error_message": error_message,
            "stack_trace": stack_trace
        })