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
WELNO_LANDING_PATH = '/welno/campaigns/checkup-design'

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
    if campaign_id == 'WELNO_BASIC_PACKAGE':
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
    """단건 MZSENDTRAN INSERT — 변수 치환 + wello_uuid + URL 치환 통합"""
    phone = normalize_phone_number(recipient.get('phone', ''))
    if not phone or len(phone) < 10:
        return {'phone': recipient.get('phone', ''), 'success': False,
                'error': '유효하지 않은 전화번호'}

    message = recipient.get('message', {})
    template_code = message.get('template_code', '')
    content = message.get('content', '')
    attachment = message.get('attachment', '')
    subject = message.get('subject', '')
    variables = recipient.get('variables', {})

    # msg_type 결정 (button → AI, 그 외 → AT)
    tmpl_info = template_map.get(template_code, {})
    msg_type_db = tmpl_info.get('message_type', '')
    msg_type = 'AI' if msg_type_db == 'button' else 'AT'

    # sender_key
    sender_key = tmpl_info.get('sender_key') or SENDER_KEY_XOG

    # hospital_id — 다중 fallback + hosnm 매핑
    # 매칭 실패 시 빈 문자열 ('*' fallback 폐기 — 카카오 거부 원인)
    hospital_id = (
        campaign.get('client_id')
        or recipient.get('hospital_id')
        or variables.get('hospital_id')
        or ''
    )
    if not hospital_id:
        hosnm = variables.get('병원명', '')
        if hosnm:
            hospital_id = await _resolve_hospital_id(db_manager, hosnm) or ''

    # 병원별 알림톡 변수 (tb_hospital_rag_config.alimtalk_vars[template_code])
    hosp_vars = await _get_hospital_alimtalk_vars(db_manager, hospital_id, template_code)

    # ── BE 통합 변수 치환 — 우선순위: variables > recipient direct > hosp_vars ──
    # FE 위치별 키('고객명_0' 등) 호환 유지
    if content:
        import re as _re
        occurrence_counter: Dict[str, int] = {}

        def _replace_var(match):
            var_name = match.group(1)
            idx = occurrence_counter.get(var_name, 0)
            occurrence_counter[var_name] = idx + 1
            # 1) 페이로드 variables 위치별 키 (고객명_0 등)
            positional_key = f'{var_name}_{idx}'
            if positional_key in variables and variables[positional_key]:
                return str(variables[positional_key])
            # 2) 페이로드 variables 일반 키
            if var_name in variables and variables[var_name]:
                return str(variables[var_name])
            # 3) recipient 직접 필드 (DB 대상자 row 컬럼: name/phoneno 등)
            if var_name in recipient and recipient[var_name]:
                return str(recipient[var_name])
            # 4) 병원 고정값 (alimtalk_vars)
            if var_name in hosp_vars and hosp_vars[var_name]:
                return hosp_vars[var_name]
            # 5) 미해결 → 그대로 둠 (카카오 검수와 매칭되도록)
            return match.group(0)

        content = _re.sub(r'#\{([^}]+)\}', _replace_var, content)

    # wello_uuid 생성 (attachment 또는 content에 wello 변수가 있을 때만)
    all_text = (attachment or '') + (content or '')
    needs_wello_uuid = any(
        v in all_text for v in ('#{wello_uuid}', '#{sub}', '#{URL}')
    )
    # alimtalk_vars 의 sub_button_N 으로 정적 URL 채워질 예정이면 wello_uuid 불필요
    has_static_button_urls = any(
        k.startswith('sub_button_') and v for k, v in hosp_vars.items()
    )
    wello_uuid = None
    if needs_wello_uuid and hospital_id and not has_static_button_urls:
        r_name = (
            variables.get('고객명') or variables.get('이름') or
            variables.get('name') or variables.get('성명') or
            recipient.get('name') or ''
        )
        wello_uuid = await _get_or_create_welno_patient(
            db_manager, phone, r_name or '고객', hospital_id, variables,
        )

    # attachment URL 치환 (정적 URL > 검진데이터 암호화 > TN 전화번호)
    if attachment:
        attachment = await _substitute_attachment_urls(
            db_manager, attachment, wello_uuid, hospital_id, variables,
            hosp_vars=hosp_vars,
        )

    # AT 타입 → TITLE 결정 (카카오 검수 등록값과 일치 필수)
    # 우선순위: kakao_templates.title_sub > alimtalk_vars._title >
    #          hospital_name (단 매칭된 정상 hospital_id 일 때만, PEERNINE default 제외)
    # ('*' fallback 폐기 — 카카오 NoMatchedTemplateTitle 거부 원인)
    title = None
    if msg_type == 'AT':
        tmpl_title_sub = tmpl_info.get('title_sub')
        if tmpl_title_sub:
            title = tmpl_title_sub
        elif hosp_vars.get('_title'):
            title = hosp_vars.get('_title')
        elif hospital_id:
            # hospital_name fallback (기존 정상 발송 템플릿 회귀 방지)
            hosp_name = await _get_hospital_name(db_manager, hospital_id)
            if hosp_name and hosp_name != 'PEERNINE':
                title = hosp_name

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


async def _resolve_hospital_id(db_manager, hosnm: str) -> Optional[str]:
    """hosnm(병원이름) → hospital_id 매핑.
    우선순위: tb_hospital_rag_config (해시 ID, 검진설계/RAG 인증용) > welno_hospitals (일반 ID).
    매칭 실패 시 None 반환 (이전: '*' fallback → 카카오 NoMatchedTemplateTitle 거부 원인)."""
    if not hosnm:
        return None
    try:
        # 1. RAG config 정확 매칭 (해시 ID 우선 — alimtalk_vars 와 일관성 유지)
        rows = await db_manager.execute_query(
            """SELECT hospital_id FROM welno.tb_hospital_rag_config
               WHERE hospital_name = %s AND is_active = true LIMIT 1""",
            (hosnm,),
        )
        if rows:
            return rows[0]['hospital_id']

        # 2. welno_hospitals 정확 매칭 (RAG config 미등록 병원)
        rows = await db_manager.execute_query(
            """SELECT hospital_id FROM welno.welno_hospitals
               WHERE hospital_name = %s AND is_active = true LIMIT 1""",
            (hosnm,),
        )
        if rows:
            return rows[0]['hospital_id']

        # 3. 괄호 접두사 제거 후 부분 매칭 (예: "(서울)메디링스병원" → "메디링스병원")
        import re as _re
        clean = _re.sub(r'^\([^)]+\)', '', hosnm).strip()
        if clean and clean != hosnm:
            rows = await db_manager.execute_query(
                """SELECT hospital_id FROM welno.tb_hospital_rag_config
                   WHERE hospital_name LIKE %s AND is_active = true LIMIT 1""",
                (f"%{clean}%",),
            )
            if rows:
                return rows[0]['hospital_id']
            rows = await db_manager.execute_query(
                """SELECT hospital_id FROM welno.welno_hospitals
                   WHERE hospital_name LIKE %s AND is_active = true LIMIT 1""",
                (f"%{clean}%",),
            )
            if rows:
                return rows[0]['hospital_id']

        # 4. 부분 단어 매칭 (예: "김현우내과" → "김현우내과의원")
        if hosnm and len(hosnm) >= 2:
            rows = await db_manager.execute_query(
                """SELECT hospital_id FROM welno.tb_hospital_rag_config
                   WHERE hospital_name LIKE %s AND is_active = true LIMIT 1""",
                (f"%{hosnm}%",),
            )
            if rows:
                return rows[0]['hospital_id']
            rows = await db_manager.execute_query(
                """SELECT hospital_id FROM welno.welno_hospitals
                   WHERE hospital_name LIKE %s AND is_active = true LIMIT 1""",
                (f"%{hosnm}%",),
            )
            if rows:
                return rows[0]['hospital_id']

        # 매칭 실패 → None (TITLE 자동 채움 차단)
        return None
    except Exception as e:
        logger.warning(f"hospital_id 매핑 실패 ({hosnm}): {e}")
        return None


async def _get_hospital_alimtalk_vars(
    db_manager, hospital_id: Optional[str], template_code: str,
) -> Dict[str, str]:
    """병원별 알림톡 템플릿 변수 조회 (welno.tb_hospital_rag_config.alimtalk_vars).
    구조: {template_code: {var_name: var_value}}.
    hospital_id 빈/None 또는 매칭 row 없으면 빈 dict 반환."""
    if not hospital_id or not template_code:
        return {}
    try:
        rows = await db_manager.execute_query(
            """SELECT alimtalk_vars FROM welno.tb_hospital_rag_config
               WHERE hospital_id = %s AND is_active = true LIMIT 1""",
            (hospital_id,),
        )
        if rows and rows[0].get('alimtalk_vars'):
            all_vars = rows[0]['alimtalk_vars']
            tpl_vars = all_vars.get(template_code) if isinstance(all_vars, dict) else None
            if isinstance(tpl_vars, dict):
                return {k: ('' if v is None else str(v)) for k, v in tpl_vars.items()}
    except Exception as e:
        logger.warning(f"alimtalk_vars 조회 실패 ({hospital_id}/{template_code}): {e}")
    return {}


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
        # 기존 환자 조회 — phone+name 우선 (birth 불일치해도 기존 UUID 재사용)
        rows = await db_manager.execute_query(
            """SELECT uuid::text, birth_date::text FROM welno.welno_patients
               WHERE phone_number = %s AND name = %s
               ORDER BY last_auth_at DESC NULLS LAST, created_at DESC
               LIMIT 5""",
            (phone, name),
        )
        if rows:
            # birth 일치하는 게 있으면 우선
            if birth_date:
                match = next((r for r in rows if r.get('birth_date') == birth_date), None)
                if match:
                    return match['uuid']
            # birth 불일치해도 phone+name으로 찾은 최신 UUID 재사용
            logger.info(f"welno_patient 기존 재사용 (phone+name): {phone} → {rows[0]['uuid']}")
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
    variables: Dict = None,
    hosp_vars: Dict[str, str] = None,
) -> str:
    """attachment JSON의 버튼 URL 변수 치환 + 검진데이터 암호화 + TN tel_number.
    URL 치환 우선순위: hosp_vars[sub_button_N] (정적) > #{sub}/#{URL} (wello link) > 그대로."""
    from ...utils.partner_encryption import encrypt_user_data
    from ...core.config import settings

    if hosp_vars is None:
        hosp_vars = {}

    try:
        att = json.loads(attachment) if isinstance(attachment, str) else attachment
    except (json.JSONDecodeError, TypeError):
        return attachment

    btn_key = 'buttons' if 'buttons' in att else 'button'
    buttons = att.get('buttons', att.get('button', []))
    if not buttons:
        return attachment

    # 검진 데이터를 DB에 저장하고 짧은 lookup_key로 URL 생성
    # (기존 암호화 URL 방식은 카카오 인앱에서 잘림 → CBC 패딩 에러)
    wello_url_full = None
    wello_url_no_proto = None
    if wello_uuid:
        link_payload = {
            'uuid': wello_uuid,
            'hospital': hospital_id,
        }
        KR_TO_FIELD = {
            '고객명': 'name', '환자명': 'name', '이름': 'name',
            '병원명': 'hosnm', '생년월일': 'birthday', '성별': 'gender',
            '신청일자': 'regdate', '방문일': 'visitdate',
        }
        if variables:
            for field in ('name', 'birthday', 'gender', 'bmi', 'bphigh',
                          'bplwst', 'blds', 'totchole', 'hdlchole', 'ldlchole',
                          'triglyceride', 'hmg', 'sgotast', 'sgptalt',
                          'creatinine', 'gfr', 'regdate', 'visitdate',
                          'hosnm', 'hosaddr', 'phoneno'):
                val = variables.get(field, '')
                if not val:
                    for kr, f in KR_TO_FIELD.items():
                        if f == field and variables.get(kr):
                            val = variables[kr]
                            break
                if val:
                    link_payload[field] = str(val)

        # DB에 저장 + lookup_key 생성
        lookup_key = str(uuid_lib.uuid4())[:8]  # 8자리 short key
        try:
            await db_manager.execute_update(
                """INSERT INTO welno.welno_link_data
                   (lookup_key, wello_uuid, hospital_id, data)
                   VALUES (%s, %s, %s, %s)""",
                (lookup_key, wello_uuid, hospital_id,
                 json.dumps(link_payload, ensure_ascii=False)),
            )
            wello_url_full = (
                f"https://{WELNO_DOMAIN}{WELNO_LANDING_PATH}"
                f"?key={lookup_key}"
            )
            wello_url_no_proto = (
                f"{WELNO_DOMAIN}{WELNO_LANDING_PATH}"
                f"?key={lookup_key}"
            )
            logger.info(f"link_data 저장: key={lookup_key}, uuid={wello_uuid}")
        except Exception as e:
            logger.error(f"link_data 저장 실패: {e}, 평문 fallback")
            wello_url_full = (
                f"https://{WELNO_DOMAIN}{WELNO_LANDING_PATH}"
                f"?uuid={wello_uuid}&hospital={hospital_id}"
            )
            wello_url_no_proto = (
                f"{WELNO_DOMAIN}{WELNO_LANDING_PATH}"
                f"?uuid={wello_uuid}&hospital={hospital_id}"
            )

    for idx, btn in enumerate(buttons):
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
        # 우선순위: hosp_vars[sub_button_{idx}] (정적 URL) > 기존 #{sub}/#{URL} 치환
        if btn_type in ('WL', 'MD'):
            static_url_raw = hosp_vars.get(f'sub_button_{idx}', '')
            # 정적 URL 안의 hospital_id 변수 치환
            # (운영자가 "checkup-design?hospital=#{hospital_id}" 같이 등록 가능)
            static_url = static_url_raw
            if static_url and hospital_id:
                static_url = static_url.replace('#{hospital_id}', hospital_id)
                static_url = static_url.replace('#{client_id}', hospital_id)
            for key in ('url_mobile', 'url_pc'):
                url = btn.get(key, '')
                if not url:
                    continue
                # 1) 병원 고정 URL 우선 (#{sub} 변수를 정적 URL로)
                if static_url:
                    url = url.replace('#{sub}', static_url)
                # 2) wello_uuid 기반 link_data URL fallback
                if wello_uuid:
                    url = url.replace('#{wello_uuid}', wello_uuid)
                    url = url.replace('#{client_id}', hospital_id)
                    if wello_url_no_proto:
                        url = url.replace('#{sub}', wello_url_no_proto)
                    if wello_url_full:
                        url = url.replace('#{URL}', wello_url_full)
                # 3) hosp_vars 의 임의 변수 (#{변수명}) 치환
                for vn, vv in hosp_vars.items():
                    if vn.startswith('sub_button_') or vn.startswith('_'):
                        continue
                    if vv:
                        url = url.replace(f'#{{{vn}}}', vv)
                btn[key] = url

    # 카카오 API는 'button' 키 사용 — 통일
    att['button'] = buttons
    if 'buttons' in att and btn_key == 'buttons':
        del att['buttons']

    return json.dumps(att, ensure_ascii=False)
