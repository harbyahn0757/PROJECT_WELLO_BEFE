"""
알림톡 서비스 — 템플릿 조회 + 캠페인 발송

원본: XOG wello_alimtalk_service.py (Django + psycopg2 직접)
포팅: WELNO FastAPI + DatabaseManager (2026-03-25)
"""
import json
import re
import logging
import uuid as uuid_lib
from typing import List, Dict, Optional, Tuple

import pymysql

from ...utils.wiset_agent import (
    generate_sn, format_req_dtm, normalize_phone_number,
    get_sender_key, build_mzsend_insert_params,
    SENDER_KEY_XOG,
)

logger = logging.getLogger(__name__)

# WELNO 도메인 (버튼 URL 생성용)
WELNO_DOMAIN = 'welno.kindhabit.com'
WELNO_WELLO_PATH = '/wello/'

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

    # wello_uuid 생성 + URL 치환
    needs_wello_uuid = (
        attachment and
        any(v in attachment for v in ('#{wello_uuid}', '#{sub}', '#{URL}'))
    )
    wello_uuid = None
    if needs_wello_uuid and hospital_id:
        variables = recipient.get('variables', {})
        r_name = (
            variables.get('고객명') or variables.get('이름') or
            variables.get('name') or variables.get('성명') or ''
        )
        wello_uuid = await _get_or_create_welno_patient(
            db_manager, phone, r_name or '고객', hospital_id, variables,
        )

    if attachment:
        attachment = await _substitute_attachment_urls(
            db_manager, attachment, wello_uuid, hospital_id,
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
    """welno_hospitals에서 병원명 조회"""
    try:
        rows = await db_manager.execute_query(
            """SELECT hospital_name FROM welno.welno_hospitals
               WHERE hospital_id = %s AND is_active = true LIMIT 1""",
            (hospital_id,),
        )
        if rows and rows[0].get('hospital_name'):
            return rows[0]['hospital_name'].strip()
    except Exception as e:
        logger.warning(f"병원명 조회 실패 ({hospital_id}): {e}")
    return 'PEERNINE'


async def _get_or_create_welno_patient(
    db_manager, phone: str, name: str, hospital_id: str,
    variables: Dict = None,
) -> Optional[str]:
    """welno_patients에서 기존 환자 조회 or 신규 생성 → uuid 반환"""
    if not variables:
        variables = {}
    phone = normalize_phone_number(phone)

    # 생년월일 파싱
    birth_raw = (
        variables.get('생년월일') or variables.get('birth_date') or
        variables.get('birthday') or variables.get('생일') or ''
    )
    birth_date = None
    if birth_raw:
        digits = re.sub(r'[^0-9]', '', str(birth_raw))
        if len(digits) == 8:
            birth_date = f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
        elif len(digits) == 6:
            yy = int(digits[:2])
            prefix = '19' if yy > 30 else '20'
            birth_date = f"{prefix}{digits[:2]}-{digits[2:4]}-{digits[4:6]}"

    # 성별 정규화
    gender_raw = (
        variables.get('성별') or variables.get('gender') or ''
    )
    gender = None
    if gender_raw:
        g = gender_raw.strip().upper()
        if g in ('M', '남', '남성', 'MALE'):
            gender = 'M'
        elif g in ('F', '여', '여성', 'FEMALE'):
            gender = 'F'

    try:
        # 기존 환자 조회
        if birth_date:
            rows = await db_manager.execute_query(
                """SELECT uuid::text FROM welno.welno_patients
                   WHERE phone_number = %s AND name = %s
                     AND birth_date = %s LIMIT 1""",
                (phone, name, birth_date),
            )
        else:
            rows = await db_manager.execute_query(
                """SELECT uuid::text FROM welno.welno_patients
                   WHERE phone_number = %s AND name = %s LIMIT 1""",
                (phone, name),
            )

        if rows:
            return rows[0]['uuid']

        # 신규 생성
        new_uuid = str(uuid_lib.uuid4())
        await db_manager.execute_one(
            """INSERT INTO welno.welno_patients
               (uuid, hospital_id, name, phone_number, birth_date,
                gender, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
               RETURNING uuid::text""",
            (new_uuid, hospital_id, name, phone,
             birth_date, gender),
        )
        logger.info(f"welno_patient 생성: {phone} ({name}) → {new_uuid}")
        return new_uuid

    except Exception as e:
        logger.error(f"welno_patient 조회/생성 실패 ({phone}): {e}")
        return None


async def _substitute_attachment_urls(
    db_manager, attachment: str,
    wello_uuid: Optional[str], hospital_id: str,
) -> str:
    """attachment JSON의 버튼 URL 변수 치환 + TN tel_number 설정"""
    try:
        att = json.loads(attachment) if isinstance(attachment, str) else attachment
    except (json.JSONDecodeError, TypeError):
        return attachment

    buttons = att.get('button', [])
    if not buttons:
        return attachment

    # WELNO URL 생성
    wello_url_full = None
    wello_url_no_proto = None
    if wello_uuid:
        wello_url_full = (
            f"https://{WELNO_DOMAIN}{WELNO_WELLO_PATH}"
            f"?uuid={wello_uuid}&hospital={hospital_id}"
        )
        wello_url_no_proto = (
            f"{WELNO_DOMAIN}{WELNO_WELLO_PATH}"
            f"?uuid={wello_uuid}&hospital={hospital_id}"
        )

    for btn in buttons:
        btn_type = btn.get('type', '')

        # TN 타입: tel_number 비어있으면 병원 전화번호 조회
        if btn_type == 'TN':
            tel = btn.get('tel_number', '')
            if not tel or not str(tel).strip():
                try:
                    rows = await db_manager.execute_query(
                        """SELECT phone FROM welno.welno_hospitals
                           WHERE hospital_id = %s AND is_active = true
                           LIMIT 1""",
                        (hospital_id,),
                    )
                    if rows and rows[0].get('phone'):
                        btn['tel_number'] = rows[0]['phone']
                    else:
                        btn['tel_number'] = '02-780-8003'
                except Exception:
                    btn['tel_number'] = '02-780-8003'
            continue

        # WL/MD 타입: URL 변수 치환
        if btn_type in ('WL', 'MD') and wello_uuid:
            for key in ('url_mobile', 'url_pc'):
                url = btn.get(key, '')
                if not url:
                    continue
                url = url.replace('#{wello_uuid}', wello_uuid)
                url = url.replace('#{client_id}', hospital_id)
                if wello_url_no_proto:
                    url = url.replace('#{sub}', wello_url_no_proto)
                if wello_url_full:
                    url = url.replace('#{URL}', wello_url_full)
                btn[key] = url

    return json.dumps(att, ensure_ascii=False)
