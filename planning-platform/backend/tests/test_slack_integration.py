#!/usr/bin/env python3
"""
슬랙 알림 시스템 테스트 스크립트

사용법:
1. 환경변수 설정:
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
   export SLACK_ENABLED=true

2. 실행:
   python test_slack_integration.py
"""

import asyncio
import os
import sys
from datetime import datetime

# 프로젝트 루트 경로 추가
sys.path.insert(0, '/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend')

from app.services.slack_service import SlackService, AlertType
from app.utils.logging.structured_logger import StructuredLogger
from app.utils.logging.domain_log_builders import (
    PaymentLogBuilder, 
    ReportLogBuilder, 
    ErrorLogBuilder
)


async def test_slack_service():
    """슬랙 서비스 기본 테스트"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("❌ SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.")
        return False
    
    print("슬랙 서비스 테스트 시작...")
    
    async with SlackService(webhook_url, "C0ADYBAN9PA") as slack:
        # 테스트 메시지 전송
        success = await slack.send_test_message()
        if success:
            print("SUCCESS: 테스트 메시지 전송 성공")
        else:
            print("ERROR: 테스트 메시지 전송 실패")
            return False
    
    return True


async def test_payment_alerts():
    """결제 관련 알림 테스트"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return False
    
    print("결제 알림 테스트 시작...")
    
    async with SlackService(webhook_url, "C0ADYBAN9PA") as slack:
        structured_logger = StructuredLogger(slack)
        
        # 1. 결제 시작 알림
        payment_start = PaymentLogBuilder.build_payment_start_log(
            oid="TEST_OID_001",
            uuid="test-uuid-12345",
            partner_id="TEST_PARTNER",
            amount=7900
        )
        await structured_logger.log_payment_event(payment_start)
        print("SUCCESS: 결제 시작 알림 전송")
        
        await asyncio.sleep(2)  # 메시지 간격
        
        # 2. 결제 성공 알림
        payment_success = PaymentLogBuilder.build_payment_success_log(
            oid="TEST_OID_001",
            uuid="test-uuid-12345",
            amount=7900,
            branch_type="리포트생성",
            partner_id="TEST_PARTNER"
        )
        await structured_logger.log_payment_event(payment_success)
        print("SUCCESS: 결제 성공 알림 전송")
        
        await asyncio.sleep(2)
        
        # 3. 결제 실패 알림
        payment_failed = PaymentLogBuilder.build_payment_failed_log(
            oid="TEST_OID_002",
            uuid="test-uuid-67890",
            error_message="카드 승인 거절",
            partner_id="TEST_PARTNER"
        )
        await structured_logger.log_payment_event(payment_failed)
        print("SUCCESS: 결제 실패 알림 전송")
        
        await asyncio.sleep(2)
        
        # 4. 결제 이탈 알림
        payment_dropout = PaymentLogBuilder.build_payment_dropout_log(
            uuid="test-uuid-99999",
            dropout_point="약관동의",
            reason="약관 미동의 후 페이지 이탈",
            partner_id="TEST_PARTNER"
        )
        await structured_logger.log_payment_event(payment_dropout)
        print("SUCCESS: 결제 이탈 알림 전송")


async def test_report_alerts():
    """리포트 관련 알림 테스트"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return False
    
    print("리포트 알림 테스트 시작...")
    
    async with SlackService(webhook_url, "C0ADYBAN9PA") as slack:
        structured_logger = StructuredLogger(slack)
        
        # 1. 리포트 생성 성공 알림
        report_success = ReportLogBuilder.build_report_success_log(
            oid="TEST_OID_001",
            uuid="test-uuid-12345",
            duration=45,
            data_source="Tilko"
        )
        await structured_logger.log_report_event(report_success)
        print("SUCCESS: 리포트 생성 성공 알림 전송")
        
        await asyncio.sleep(2)
        
        # 2. 리포트 생성 실패 알림
        report_failed = ReportLogBuilder.build_report_failed_log(
            oid="TEST_OID_003",
            uuid="test-uuid-11111",
            error_message="Mediarc API 응답 오류: 500 Internal Server Error",
            duration=30
        )
        await structured_logger.log_report_event(report_failed)
        print("SUCCESS: 리포트 생성 실패 알림 전송")


async def test_error_alerts():
    """에러 관련 알림 테스트"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return False
    
    print("에러 알림 테스트 시작...")
    
    async with SlackService(webhook_url, "C0ADYBAN9PA") as slack:
        structured_logger = StructuredLogger(slack)
        
        # 1. API 에러 알림
        api_error = ErrorLogBuilder.build_api_error_log(
            error_message="API 호출 타임아웃 (30초 초과)",
            location="mediarc/report_service.py:call_mediarc_api",
            uuid="test-uuid-22222",
            error_code="API_TIMEOUT"
        )
        await structured_logger.log_error_event(api_error)
        print("SUCCESS: API 에러 알림 전송")
        
        await asyncio.sleep(2)
        
        # 2. 시스템 에러 알림
        system_error = ErrorLogBuilder.build_system_error_log(
            error_message="데이터베이스 연결 실패",
            location="core/database.py:get_connection",
            uuid="test-uuid-33333",
            stack_trace="Traceback (most recent call last):\n  File..."
        )
        await structured_logger.log_error_event(system_error)
        print("SUCCESS: 시스템 에러 알림 전송")


async def main():
    """메인 테스트 함수"""
    print("WELNO 슬랙 알림 시스템 테스트")
    print("=" * 50)
    
    # 환경변수 확인
    slack_enabled = os.getenv("SLACK_ENABLED", "false").lower() == "true"
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    
    if not slack_enabled:
        print("ERROR: SLACK_ENABLED=true로 설정해주세요.")
        return
    
    if not webhook_url:
        print("ERROR: SLACK_WEBHOOK_URL 환경변수를 설정해주세요.")
        print("예시: export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'")
        return
    
    print(f"타겟 채널: C0ADYBAN9PA")
    print(f"웹훅 URL: {webhook_url[:50]}...")
    print()
    
    try:
        # 1. 기본 슬랙 서비스 테스트
        success = await test_slack_service()
        if not success:
            return
        
        await asyncio.sleep(3)
        
        # 2. 결제 알림 테스트
        await test_payment_alerts()
        
        await asyncio.sleep(3)
        
        # 3. 리포트 알림 테스트
        await test_report_alerts()
        
        await asyncio.sleep(3)
        
        # 4. 에러 알림 테스트
        await test_error_alerts()
        
        print()
        print("모든 테스트 완료!")
        print("슬랙 채널에서 알림 메시지를 확인해보세요.")
        
    except Exception as e:
        print(f"ERROR: 테스트 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())