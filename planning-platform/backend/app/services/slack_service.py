"""
슬랙 알림 서비스

질병예측 서비스의 결제 및 에러 이벤트를 슬랙으로 전송하는 서비스입니다.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AlertType(str, Enum):
    """알림 타입"""
    PAYMENT_START = "payment_start"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_CANCELLED = "payment_cancelled"
    PAYMENT_DROPOUT = "payment_dropout"
    REPORT_SUCCESS = "report_success"
    REPORT_FAILED = "report_failed"
    SYSTEM_ERROR = "system_error"
    API_ERROR = "api_error"


class SlackColor(str, Enum):
    """슬랙 메시지 색상"""
    GOOD = "good"      # 녹색 (성공)
    WARNING = "warning"  # 노란색 (경고)
    DANGER = "danger"   # 빨간색 (에러)


class SlackField(BaseModel):
    """슬랙 메시지 필드"""
    title: str
    value: str
    short: bool = True


class SlackAttachment(BaseModel):
    """슬랙 메시지 첨부"""
    color: SlackColor
    fields: List[SlackField]
    footer: Optional[str] = None
    ts: Optional[int] = None


class SlackMessage(BaseModel):
    """슬랙 메시지"""
    channel: str
    text: str
    attachments: List[SlackAttachment]


class SlackService:
    """슬랙 알림 서비스"""
    
    def __init__(self, webhook_url: str, channel_id: str = "C0ADYBAN9PA"):
        """
        슬랙 서비스 초기화
        
        Args:
            webhook_url: 슬랙 웹훅 URL
            channel_id: 대상 채널 ID (기본: C0ADYBAN9PA)
        """
        self.webhook_url = webhook_url
        self.channel_id = channel_id
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.client.aclose()
    
    def _get_alert_config(self, alert_type: AlertType) -> Dict[str, Any]:
        """알림 타입별 설정 반환"""
        configs = {
            AlertType.PAYMENT_START: {
                "emoji": "💳",
                "title": "결제 시작",
                "color": SlackColor.WARNING
            },
            AlertType.PAYMENT_SUCCESS: {
                "emoji": "✓",
                "title": "결제 완료",
                "color": SlackColor.GOOD
            },
            AlertType.PAYMENT_FAILED: {
                "emoji": "✗",
                "title": "결제 실패",
                "color": SlackColor.DANGER
            },
            AlertType.PAYMENT_CANCELLED: {
                "emoji": "⊘",
                "title": "결제 취소",
                "color": SlackColor.WARNING
            },
            AlertType.PAYMENT_DROPOUT: {
                "emoji": "⚠",
                "title": "결제 이탈",
                "color": SlackColor.WARNING
            },
            AlertType.REPORT_SUCCESS: {
                "emoji": "📊",
                "title": "리포트 생성 완료",
                "color": SlackColor.GOOD
            },
            AlertType.REPORT_FAILED: {
                "emoji": "✗",
                "title": "리포트 생성 실패",
                "color": SlackColor.DANGER
            },
            AlertType.SYSTEM_ERROR: {
                "emoji": "⚠",
                "title": "시스템 에러",
                "color": SlackColor.DANGER
            },
            AlertType.API_ERROR: {
                "emoji": "⚠",
                "title": "API 에러",
                "color": SlackColor.DANGER
            }
        }
        return configs.get(alert_type, {
            "emoji": "ℹ️",
            "title": "알림",
            "color": SlackColor.WARNING
        })
    
    async def send_payment_alert(self, alert_type: AlertType, data: Dict[str, Any]) -> bool:
        """
        결제 관련 알림 전송
        
        Args:
            alert_type: 알림 타입
            data: 결제 데이터
                - oid: 주문번호
                - uuid: 사용자 UUID
                - partner_id: 파트너 ID
                - amount: 결제 금액
                - status: 결제 상태
                - error_message: 에러 메시지 (실패 시)
                - branch_type: 분기 타입 (리포트생성/틸코인증)
        
        Returns:
            bool: 전송 성공 여부
        """
        config = self._get_alert_config(alert_type)
        
        # 기본 필드 구성
        fields = [
            SlackField(title="이벤트", value=config["title"], short=True),
            SlackField(title="사용자", value=data.get("uuid", "N/A")[:8], short=True)
        ]
        
        # 주문번호 (있는 경우)
        if data.get("oid"):
            fields.append(SlackField(title="주문번호", value=data["oid"], short=True))
        
        # 파트너 정보
        if data.get("partner_id"):
            fields.append(SlackField(title="파트너", value=data["partner_id"], short=True))
        
        # 결제 금액
        if data.get("amount"):
            fields.append(SlackField(title="금액", value=f"{data['amount']:,}원", short=True))
        
        # 분기 타입 (성공 시)
        if alert_type == AlertType.PAYMENT_SUCCESS and data.get("branch_type"):
            fields.append(SlackField(title="분기", value=data["branch_type"], short=True))
        
        # 에러 메시지 (실패 시)
        if data.get("error_message"):
            fields.append(SlackField(title="에러", value=data["error_message"], short=False))
        
        message = SlackMessage(
            channel=self.channel_id,
            text=f"{config['emoji']} {config['title']}",
            attachments=[
                SlackAttachment(
                    color=config["color"],
                    fields=fields,
                    footer="WELNO 질병예측 시스템",
                    ts=int(datetime.now().timestamp())
                )
            ]
        )
        
        return await self._send_message(message)
    
    async def send_report_alert(self, alert_type: AlertType, data: Dict[str, Any]) -> bool:
        """
        리포트 생성 관련 알림 전송
        
        Args:
            alert_type: 알림 타입 (REPORT_SUCCESS, REPORT_FAILED)
            data: 리포트 데이터
                - oid: 주문번호
                - uuid: 사용자 UUID
                - duration: 소요 시간 (초)
                - data_source: 데이터 소스 (Tilko/파트너)
                - error_message: 에러 메시지 (실패 시)
        
        Returns:
            bool: 전송 성공 여부
        """
        config = self._get_alert_config(alert_type)
        
        fields = [
            SlackField(title="상태", value=config["title"], short=True),
            SlackField(title="주문번호", value=data.get("oid", "N/A"), short=True),
            SlackField(title="사용자", value=data.get("uuid", "N/A")[:8], short=True)
        ]
        
        # 소요 시간
        if data.get("duration"):
            fields.append(SlackField(title="소요시간", value=f"{data['duration']}초", short=True))
        
        # 데이터 소스
        if data.get("data_source"):
            fields.append(SlackField(title="데이터소스", value=data["data_source"], short=True))
        
        # 에러 메시지 (실패 시)
        if data.get("error_message"):
            fields.append(SlackField(title="에러", value=data["error_message"], short=False))
        
        message = SlackMessage(
            channel=self.channel_id,
            text=f"{config['emoji']} {config['title']}",
            attachments=[
                SlackAttachment(
                    color=config["color"],
                    fields=fields,
                    footer="WELNO 질병예측 시스템",
                    ts=int(datetime.now().timestamp())
                )
            ]
        )
        
        return await self._send_message(message)
    
    async def send_error_alert(self, alert_type: AlertType, data: Dict[str, Any]) -> bool:
        """
        에러 관련 알림 전송
        
        Args:
            alert_type: 알림 타입 (SYSTEM_ERROR, API_ERROR)
            data: 에러 데이터
                - error_type: 에러 타입
                - location: 에러 위치 (파일명:라인)
                - uuid: 사용자 UUID
                - error_message: 에러 메시지
                - stack_trace: 스택 트레이스 (선택)
        
        Returns:
            bool: 전송 성공 여부
        """
        config = self._get_alert_config(alert_type)
        
        fields = [
            SlackField(title="에러타입", value=data.get("error_type", "UNKNOWN"), short=True),
            SlackField(title="위치", value=data.get("location", "N/A"), short=True)
        ]
        
        # 사용자 정보 (있는 경우)
        if data.get("uuid"):
            fields.append(SlackField(title="사용자", value=data["uuid"][:8], short=True))
        
        # 에러 메시지
        if data.get("error_message"):
            fields.append(SlackField(title="에러메시지", value=data["error_message"], short=False))
        
        message = SlackMessage(
            channel=self.channel_id,
            text=f"{config['emoji']} {config['title']}",
            attachments=[
                SlackAttachment(
                    color=config["color"],
                    fields=fields,
                    footer="WELNO 질병예측 시스템",
                    ts=int(datetime.now().timestamp())
                )
            ]
        )
        
        return await self._send_message(message)
    
    async def _send_message(self, message: SlackMessage) -> bool:
        """
        슬랙 메시지 전송
        
        Args:
            message: 전송할 메시지
            
        Returns:
            bool: 전송 성공 여부
        """
        if not self.webhook_url:
            logger.warning("슬랙 웹훅 URL이 설정되지 않았습니다.")
            return False
        
        try:
            # 메시지를 JSON으로 변환
            payload = message.model_dump(exclude_none=True)
            
            # 웹훅으로 전송
            response = await self.client.post(
                self.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                logger.info(f"✅ 슬랙 메시지 전송 성공: {message.text}")
                return True
            else:
                logger.error(f"❌ 슬랙 메시지 전송 실패: {response.status_code} - {response.text}")
                return False
                
        except httpx.TimeoutException:
            logger.error("⏰ 슬랙 메시지 전송 타임아웃")
            return False
        except httpx.RequestError as e:
            logger.error(f"🔌 슬랙 메시지 전송 네트워크 에러: {e}")
            return False
        except Exception as e:
            logger.error(f"🚨 슬랙 메시지 전송 예외: {e}")
            return False
    
    async def send_test_message(self) -> bool:
        """
        테스트 메시지 전송
        
        Returns:
            bool: 전송 성공 여부
        """
        test_data = {
            "uuid": "test-uuid-1234",
            "message": "슬랙 연동 테스트 메시지입니다."
        }
        
        message = SlackMessage(
            channel=self.channel_id,
            text="테스트: 슬랙 연동 확인",
            attachments=[
                SlackAttachment(
                    color=SlackColor.GOOD,
                    fields=[
                        SlackField(title="테스트", value="슬랙 서비스 연동", short=True),
                        SlackField(title="시간", value=datetime.now().strftime("%Y-%m-%d %H:%M:%S"), short=True),
                        SlackField(title="채널", value=self.channel_id, short=True)
                    ],
                    footer="WELNO 질병예측 시스템 - 테스트",
                    ts=int(datetime.now().timestamp())
                )
            ]
        )
        
        return await self._send_message(message)


# 싱글톤 인스턴스 생성을 위한 팩토리 함수
_slack_service_instance: Optional[SlackService] = None

def get_slack_service(webhook_url: str, channel_id: str = "C0ADYBAN9PA") -> SlackService:
    """
    슬랙 서비스 싱글톤 인스턴스 반환
    
    Args:
        webhook_url: 슬랙 웹훅 URL
        channel_id: 채널 ID
        
    Returns:
        SlackService: 슬랙 서비스 인스턴스
    """
    global _slack_service_instance
    
    if _slack_service_instance is None:
        _slack_service_instance = SlackService(webhook_url, channel_id)
    
    return _slack_service_instance


# 비동기 컨텍스트 매니저를 위한 헬퍼 함수
async def with_slack_service(webhook_url: str, channel_id: str = "C0ADYBAN9PA"):
    """
    슬랙 서비스 비동기 컨텍스트 매니저
    
    Args:
        webhook_url: 슬랙 웹훅 URL
        channel_id: 채널 ID
        
    Returns:
        SlackService: 슬랙 서비스 인스턴스
    """
    async with SlackService(webhook_url, channel_id) as service:
        yield service