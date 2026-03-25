"""
WiseT Agent 연동 유틸리티
알림톡 발송 시 MZSENDTRAN 테이블에 INSERT하기 위한 공통 함수

원본: XOG backend/utils/wiset_agent_utils.py
포팅: WELNO FastAPI (2026-03-25)
"""
import uuid
import re
from datetime import datetime

# 발신프로필키
SENDER_KEY_MEDILINX = '7ab8024f27d8eed9fa139f21e34d95c490eb08d2'
SENDER_KEY_XOG = 'ef7323d6ed90432976f7d972669a8ad4ed586aee'


def generate_sn() -> str:
    """발송요청ID(SN) 생성 — UUID 기반"""
    return str(uuid.uuid4())


def format_req_dtm(dt=None) -> str:
    """발송요청일시 → yyyymmddhh24miss"""
    if dt is None:
        dt = datetime.now()
    return dt.strftime('%Y%m%d%H%M%S')


def normalize_phone_number(phone) -> str:
    """전화번호 정규화 (하이픈 제거, 10자리 앞 0 추가)"""
    if not phone:
        return ''
    phone_clean = re.sub(r'[^0-9]', '', str(phone))
    if len(phone_clean) == 10 and not phone_clean.startswith('0'):
        phone_clean = '0' + phone_clean
    return phone_clean


def get_sender_key(campaign_id=None, template_code=None, default='xog') -> str:
    """캠페인/템플릿 기반 발신프로필키 자동 선택"""
    if campaign_id and 'medilinx' in campaign_id.lower():
        return SENDER_KEY_MEDILINX
    if template_code and 'medilinx' in template_code.lower():
        return SENDER_KEY_MEDILINX
    if default.lower() == 'medilinx':
        return SENDER_KEY_MEDILINX
    return SENDER_KEY_XOG


def build_mzsend_insert_params(
    sn: str,
    sender_key: str,
    phone_num: str,
    tmpl_cd: str,
    snd_msg: str,
    req_dtm: str = None,
    attachment: str = None,
    subject: str = None,
    title: str = None,
    msg_type: str = 'AT',
) -> dict:
    """
    MZSENDTRAN INSERT 파라미터 딕셔너리 생성

    msg_type: AT(알림톡 텍스트), AI(버튼형 알림톡)
    """
    if req_dtm is None:
        req_dtm = format_req_dtm()

    params = {
        'SN': sn,
        'SENDER_KEY': sender_key,
        'CHANNEL': 'A',
        'SND_TYPE': 'P',
        'PHONE_NUM': normalize_phone_number(phone_num),
        'TMPL_CD': tmpl_cd,
        'SND_MSG': snd_msg,
        'REQ_DTM': req_dtm,
        'REQ_DEPT_CD': 'admin',
        'REQ_USR_ID': 'admin',
        'TRAN_STS': '1',       # 발송대기
        'TR_TYPE_CD': '9',     # 배치발송
        'MSG_TYPE': msg_type,
    }

    if attachment:
        params['ATTACHMENT'] = attachment
    if subject:
        params['SUBJECT'] = subject
    if title is not None:
        params['TITLE'] = title

    return params
