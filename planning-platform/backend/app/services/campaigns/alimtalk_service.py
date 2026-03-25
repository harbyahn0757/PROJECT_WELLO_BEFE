"""
알림톡 서비스 — 템플릿 조회 + 캠페인 발송

원본: XOG wello_alimtalk_service.py (Django + psycopg2 직접)
포팅: WELNO FastAPI + DatabaseManager (2026-03-25)
"""
import json
import re
import logging
from typing import List, Dict, Optional, Tuple

import pymysql

from ...utils.wiset_agent import (
    generate_sn, format_req_dtm, normalize_phone_number,
    get_sender_key, build_mzsend_insert_params,
    SENDER_KEY_XOG,
)

logger = logging.getLogger(__name__)

# MariaDB (WiseT Agent) 연결 정보
MYSQL_CONFIG = {
    'host': '10.0.1.10',
    'port': 3306,
    'user': 'root',
    'password': 'dksrhkdtn!23',
    'database': 'p9_mkt_ata',
    'charset': 'utf8mb4',
    'autocommit': False,
}


def _connect_mysql():
    """MariaDB 연결 (WiseT Agent MZSENDTRAN)"""
    try:
        return pymysql.connect(**MYSQL_CONFIG)
    except Exception as e:
        logger.error(f"MySQL 연결 실패: {e}")
        return None


async def get_kakao_templates(db_manager) -> Tuple[bool, any]:
    """
    활성 알림톡 템플릿 목록 조회

    Returns: (success, data_or_error)
    """
    try:
        rows = await db_manager.execute_query(
            """SELECT template_id, template_code, template_name,
                      channel, message_type, template_content,
                      button_config, url_pattern, sender_key,
                      callback_number, title, title_sub,
                      is_active, created_at, updated_at, notes, options
               FROM public.kakao_templates
               WHERE is_active = true
               ORDER BY created_at DESC"""
        )
        for r in rows:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()
            if r.get('updated_at'):
                r['updated_at'] = r['updated_at'].isoformat()
        return True, rows
    except Exception as e:
        logger.error(f"템플릿 목록 조회 실패: {e}")
        return False, str(e)


async def get_template_variables(
    db_manager, template_code: str
) -> Tuple[bool, any]:
    """
    템플릿 변수 추출 — #{변수명} 패턴 파싱

    Returns: (success, {template_code, template_name, variables, ...})
    """
    try:
        rows = await db_manager.execute_query(
            """SELECT template_code, template_name, template_content
               FROM public.kakao_templates
               WHERE template_code = %s AND is_active = true""",
            (template_code,),
        )
        if not rows:
            return False, f'템플릿 없음: {template_code}'

        content = rows[0].get('template_content') or ''
        variables = sorted(set(re.findall(r'#\{([^}]+)\}', content)))

        return True, {
            'template_code': rows[0]['template_code'],
            'template_name': rows[0]['template_name'],
            'template_content': content,
            'variables': variables,
            'variable_count': len(variables),
        }
    except Exception as e:
        logger.error(f"템플릿 변수 추출 실패: {e}")
        return False, str(e)


async def send_campaign_messages(
    db_manager,
    campaign_id: str,
    recipients: List[Dict],
) -> Tuple[bool, any]:
    """
    캠페인 알림톡 발송 — MZSENDTRAN INSERT

    recipients 형식:
    [
      {
        "phone": "010-1234-5678",
        "hospital_id": "optional",
        "variables": {"name": "...", ...},
        "message": {
          "template_code": "tmpl_001",
          "content": "치환 완료된 본문",
          "attachment": '{"button": [...]}',
          "subject": "...",
          "msg_type": "AI"
        }
      }
    ]
    """
    if not recipients:
        return False, '발송 대상이 없습니다.'

    # 1. 캠페인 정보 조회
    campaign = await _get_campaign_info(db_manager, campaign_id)
    if not campaign:
        return False, f'캠페인 없음: {campaign_id}'

    # 2. 사용 템플릿 정보 일괄 조회
    template_codes = {
        r.get('message', {}).get('template_code')
        for r in recipients if r.get('message', {}).get('template_code')
    }
    template_map = await _get_template_info_map(db_manager, template_codes)

    first_tmpl = recipients[0].get('message', {}).get('template_code', '')
    if first_tmpl not in template_map:
        return False, f'템플릿 없음: {first_tmpl}'

    # 3. MySQL 연결
    mysql_conn = _connect_mysql()
    if not mysql_conn:
        return False, 'MySQL 연결 실패'
    mysql_cursor = mysql_conn.cursor()

    success_count = 0
    fail_count = 0
    results = []

    try:
        for recipient in recipients:
            result = await _send_one(
                db_manager, mysql_cursor,
                campaign, template_map, recipient,
            )
            results.append(result)
            if result['success']:
                success_count += 1
            else:
                fail_count += 1

        mysql_conn.commit()
    except Exception as e:
        mysql_conn.rollback()
        logger.error(f"발송 중 오류: {e}")
        return False, str(e)
    finally:
        mysql_cursor.close()
        mysql_conn.close()

    return True, {
        'total': len(recipients),
        'success_count': success_count,
        'fail_count': fail_count,
        'results': results,
    }


# ── 내부 헬퍼 ────────────────────────────────────

async def _get_campaign_info(db_manager, campaign_id: str) -> Optional[Dict]:
    """캠페인 정보 조회 (order_campaigns / orders)"""
    if campaign_id == 'WELLO_BASIC_PACKAGE':
        rows = await db_manager.execute_query(
            """SELECT campaign_id, campaign_name, order_name,
                      '' AS partner_id, '' AS client_id,
                      COALESCE(template_code, '') AS template_code
               FROM p9_mkt_biz.order_campaigns
               WHERE campaign_id = %s""",
            (campaign_id,),
        )
    else:
        rows = await db_manager.execute_query(
            """SELECT o.campaign_id, o.campaign_name, o.order_name,
                      o.partner_id, o.client_id,
                      COALESCE(oc.template_code, '') AS template_code
               FROM p9_mkt_biz.orders o
               LEFT JOIN p9_mkt_biz.order_campaigns oc
                 ON o.order_name = oc.order_name
                    AND o.campaign_id = oc.campaign_id
               WHERE o.campaign_id = %s""",
            (campaign_id,),
        )
    return rows[0] if rows else None


async def _get_template_info_map(
    db_manager, template_codes: set
) -> Dict[str, Dict]:
    """템플릿 코드 → {sender_key, message_type, title, ...} 맵"""
    if not template_codes:
        return {}
    placeholders = ','.join(['%s'] * len(template_codes))
    rows = await db_manager.execute_query(
        f"""SELECT template_code, sender_key, callback_number,
                   message_type, title, title_sub
            FROM public.kakao_templates
            WHERE template_code IN ({placeholders}) AND is_active = true""",
        tuple(template_codes),
    )
    return {r['template_code']: r for r in rows}


async def _send_one(
    db_manager, mysql_cursor,
    campaign: Dict, template_map: Dict, recipient: Dict,
) -> Dict:
    """단건 MZSENDTRAN INSERT"""
    phone = normalize_phone_number(recipient.get('phone', ''))
    if not phone or len(phone) < 10:
        return {'phone': recipient.get('phone', ''), 'success': False,
                'error': '유효하지 않은 전화번호'}

    message = recipient.get('message', {})
    template_code = message.get('template_code', '')
    content = message.get('content', '')
    attachment = message.get('attachment', '')
    subject = message.get('subject', '')

    # msg_type 결정 (button → AI, 그 외 → AT)
    tmpl_info = template_map.get(template_code, {})
    msg_type_db = tmpl_info.get('message_type', '')
    msg_type = 'AI' if msg_type_db == 'button' else 'AT'

    # sender_key
    sender_key = tmpl_info.get('sender_key') or SENDER_KEY_XOG

    # hospital_id (WELNO 기본형 지원)
    hospital_id = (
        campaign.get('client_id')
        or recipient.get('hospital_id')
        or recipient.get('variables', {}).get('hospital_id')
        or ''
    )

    # AT 타입 → title에 병원명
    title = None
    if msg_type == 'AT' and hospital_id:
        title = await _get_hospital_name(db_manager, hospital_id)

    # MZSENDTRAN INSERT
    sn = generate_sn()
    params = build_mzsend_insert_params(
        sn=sn, sender_key=sender_key, phone_num=phone,
        tmpl_cd=template_code, snd_msg=content,
        attachment=attachment if attachment else None,
        subject=subject if subject else None,
        title=title, msg_type=msg_type,
    )

    try:
        cols = list(params.keys())
        vals = [params[c] for c in cols]
        placeholders = ', '.join(['%s'] * len(cols))
        col_str = ', '.join(cols)

        mysql_cursor.execute(
            f"INSERT INTO MZSENDTRAN ({col_str}) VALUES ({placeholders})",
            vals,
        )
        return {'phone': phone, 'success': True, 'sn': sn}
    except Exception as e:
        logger.error(f"MZSENDTRAN INSERT 실패 ({phone}): {e}")
        return {'phone': phone, 'success': False, 'error': str(e)}


async def _get_hospital_name(db_manager, hospital_id: str) -> str:
    """wello_hospitals에서 병원명 조회"""
    try:
        rows = await db_manager.execute_query(
            """SELECT hospital_name FROM wello.wello_hospitals
               WHERE hospital_id = %s AND is_active = true LIMIT 1""",
            (hospital_id,),
        )
        if rows and rows[0].get('hospital_name'):
            return rows[0]['hospital_name'].strip()
    except Exception as e:
        logger.warning(f"병원명 조회 실패 ({hospital_id}): {e}")
    return 'PEERNINE'
