"""
구조화된 로거

기존 로깅 시스템과 슬랙 알림을 통합하는 구조화된 로거입니다.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from ...services.slack_service import SlackService, AlertType

logger = logging.getLogger(__name__)


class StructuredLogger:
    """구조화된 로거 클래스"""
    
    def __init__(self, slack_service: Optional[SlackService] = None, log_dir: str = "/data/wello_logs"):
        """
        구조화된 로거 초기화
        
        Args:
            slack_service: 슬랙 서비스 인스턴스
            log_dir: 로그 저장 디렉토리
        """
        self.slack_service = slack_service
        self.log_dir = Path(log_dir)
        self.slack_log_dir = self.log_dir / "slack_alerts"
        
        # 로그 디렉토리 생성
        self.slack_log_dir.mkdir(parents=True, exist_ok=True)
    
    async def log_payment_event(self, event_data: Dict[str, Any]) -> bool:
        """
        결제 이벤트 로깅
        
        Args:
            event_data: 결제 이벤트 데이터
                - event_type: 이벤트 타입 (start, success, failed, cancelled, dropout)
                - oid: 주문번호
                - uuid: 사용자 UUID
                - partner_id: 파트너 ID
                - amount: 결제 금액
                - status: 결제 상태
                - error_message: 에러 메시지
                - branch_type: 분기 타입
                - location: 발생 위치
        
        Returns:
            bool: 로깅 성공 여부
        """
        try:
            # 이벤트 타입에 따른 AlertType 매핑
            event_type_mapping = {
                "start": AlertType.PAYMENT_START,
                "success": AlertType.PAYMENT_SUCCESS,
                "failed": AlertType.PAYMENT_FAILED,
                "cancelled": AlertType.PAYMENT_CANCELLED,
                "dropout": AlertType.PAYMENT_DROPOUT
            }
            
            event_type = event_data.get("event_type", "unknown")
            alert_type = event_type_mapping.get(event_type)
            
            if not alert_type:
                logger.warning(f"알 수 없는 결제 이벤트 타입: {event_type}")
                return False
            
            # 구조화된 로그 생성
            structured_log = {
                "timestamp": datetime.now().isoformat(),
                "log_type": "payment_event",
                "event_type": event_type,
                "data": event_data,
                "context": {
                    "service": "welno_disease_prediction",
                    "component": "payment_system"
                }
            }
            
            # 파일 로그 저장
            await self._save_log_to_file(structured_log)
            
            # 표준 로거에도 기록
            logger.info(f"💳 결제 이벤트: {event_type} - OID: {event_data.get('oid', 'N/A')}")
            
            # 슬랙 알림 전송
            if self.slack_service:
                success = await self.slack_service.send_payment_alert(alert_type, event_data)
                if not success:
                    logger.warning("슬랙 결제 알림 전송 실패")
                return success
            
            return True
            
        except Exception as e:
            logger.error(f"결제 이벤트 로깅 실패: {e}", exc_info=True)
            return False
    
    async def log_report_event(self, event_data: Dict[str, Any]) -> bool:
        """
        리포트 이벤트 로깅
        
        Args:
            event_data: 리포트 이벤트 데이터
                - event_type: 이벤트 타입 (success, failed)
                - oid: 주문번호
                - uuid: 사용자 UUID
                - duration: 소요 시간
                - data_source: 데이터 소스
                - error_message: 에러 메시지
                - location: 발생 위치
        
        Returns:
            bool: 로깅 성공 여부
        """
        try:
            # 이벤트 타입에 따른 AlertType 매핑
            event_type_mapping = {
                "success": AlertType.REPORT_SUCCESS,
                "failed": AlertType.REPORT_FAILED
            }
            
            event_type = event_data.get("event_type", "unknown")
            alert_type = event_type_mapping.get(event_type)
            
            if not alert_type:
                logger.warning(f"알 수 없는 리포트 이벤트 타입: {event_type}")
                return False
            
            # 구조화된 로그 생성
            structured_log = {
                "timestamp": datetime.now().isoformat(),
                "log_type": "report_event",
                "event_type": event_type,
                "data": event_data,
                "context": {
                    "service": "welno_disease_prediction",
                    "component": "report_system"
                }
            }
            
            # 파일 로그 저장
            await self._save_log_to_file(structured_log)
            
            # 표준 로거에도 기록
            logger.info(f"📊 리포트 이벤트: {event_type} - OID: {event_data.get('oid', 'N/A')}")
            
            # 슬랙 알림 전송
            if self.slack_service:
                success = await self.slack_service.send_report_alert(alert_type, event_data)
                if not success:
                    logger.warning("슬랙 리포트 알림 전송 실패")
                return success
            
            return True
            
        except Exception as e:
            logger.error(f"리포트 이벤트 로깅 실패: {e}", exc_info=True)
            return False
    
    async def log_error_event(self, event_data: Dict[str, Any]) -> bool:
        """
        에러 이벤트 로깅
        
        Args:
            event_data: 에러 이벤트 데이터
                - error_type: 에러 타입 (system_error, api_error)
                - error_code: 에러 코드
                - location: 에러 위치
                - uuid: 사용자 UUID
                - error_message: 에러 메시지
                - stack_trace: 스택 트레이스
        
        Returns:
            bool: 로깅 성공 여부
        """
        try:
            # 에러 타입에 따른 AlertType 매핑
            error_type_mapping = {
                "system_error": AlertType.SYSTEM_ERROR,
                "api_error": AlertType.API_ERROR
            }
            
            error_type = event_data.get("error_type", "system_error")
            alert_type = error_type_mapping.get(error_type, AlertType.SYSTEM_ERROR)
            
            # 구조화된 로그 생성
            structured_log = {
                "timestamp": datetime.now().isoformat(),
                "log_type": "error_event",
                "error_type": error_type,
                "data": event_data,
                "context": {
                    "service": "welno_disease_prediction",
                    "component": "error_system"
                }
            }
            
            # 파일 로그 저장
            await self._save_log_to_file(structured_log)
            
            # 표준 로거에도 기록
            logger.error(f"🚨 에러 이벤트: {error_type} - {event_data.get('error_message', 'N/A')}")
            
            # 슬랙 알림 전송
            if self.slack_service:
                success = await self.slack_service.send_error_alert(alert_type, event_data)
                if not success:
                    logger.warning("슬랙 에러 알림 전송 실패")
                return success
            
            return True
            
        except Exception as e:
            logger.error(f"에러 이벤트 로깅 실패: {e}", exc_info=True)
            return False
    
    async def _save_log_to_file(self, log_data: Dict[str, Any]) -> None:
        """
        로그를 파일에 저장
        
        Args:
            log_data: 저장할 로그 데이터
        """
        try:
            # 날짜별 폴더 생성
            today = datetime.now().strftime("%Y-%m-%d")
            daily_log_dir = self.slack_log_dir / today
            daily_log_dir.mkdir(parents=True, exist_ok=True)
            
            # 로그 파일 경로
            log_file = daily_log_dir / f"slack_alerts_{today}.jsonl"
            
            # JSONL 형식으로 저장
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_data, ensure_ascii=False) + "\n")
                
        except Exception as e:
            logger.error(f"로그 파일 저장 실패: {e}", exc_info=True)


# 전역 로거 인스턴스
_structured_logger_instance: Optional[StructuredLogger] = None

def get_structured_logger(slack_service: Optional[SlackService] = None) -> StructuredLogger:
    """
    구조화된 로거 싱글톤 인스턴스 반환
    
    Args:
        slack_service: 슬랙 서비스 인스턴스
        
    Returns:
        StructuredLogger: 구조화된 로거 인스턴스
    """
    global _structured_logger_instance
    
    if _structured_logger_instance is None:
        _structured_logger_instance = StructuredLogger(slack_service)
    
    return _structured_logger_instance