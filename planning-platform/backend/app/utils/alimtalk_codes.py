"""
알림톡 발송 결과 코드 상수
WiseT Agent API 결과 코드 정의

원본: XOG backend/constants/alimtalk_result_codes.py
포팅: WELNO FastAPI (2026-03-25)
"""
from typing import Dict, Optional

ALIMTALK_RESULT_CODES: Dict[str, Dict] = {
    '0000': {'code': '0000', 'message': '발송 성공', 'is_success': True},
    '1001': {'code': '1001', 'message': 'NoJsonBody', 'is_success': False},
    '1003': {'code': '1003', 'message': 'InvalidSenderKey', 'is_success': False},
    '1006': {'code': '1006', 'message': 'DeletedSender', 'is_success': False},
    '1007': {'code': '1007', 'message': 'StoppedSender', 'is_success': False},
    '1020': {'code': '1020', 'message': 'InvalidReceiveUser', 'is_success': False},
    '1021': {'code': '1021', 'message': 'BlockedProfile', 'is_success': False},
    '3000': {'code': '3000', 'message': 'UnexpectedException', 'is_success': False},
    '3005': {'code': '3005', 'message': 'AckTimeout', 'is_success': False},
    '3006': {'code': '3006', 'message': 'FailedToSendMessage', 'is_success': False},
    '3008': {'code': '3008', 'message': 'InvalidPhoneNumber', 'is_success': False},
    '3015': {'code': '3015', 'message': 'TemplateNotFound', 'is_success': False},
    '3016': {'code': '3016', 'message': 'NoMatchedTemplate', 'is_success': False},
    '3019': {'code': '3019', 'message': 'MessageNoUser(톡 유저 아님)', 'is_success': False},
    '3020': {'code': '3020', 'message': '알림톡 수신 차단', 'is_success': False},
}


def get_result_message(code: Optional[str]) -> Dict:
    """결과 코드로 메시지 조회"""
    if not code:
        return {'code': 'UNKNOWN', 'message': '알 수 없음', 'is_success': False}
    return ALIMTALK_RESULT_CODES.get(code, {
        'code': code, 'message': f'알 수 없는 코드: {code}', 'is_success': False,
    })


def is_success(code: Optional[str]) -> bool:
    """성공 여부 확인"""
    return get_result_message(code).get('is_success', False)
