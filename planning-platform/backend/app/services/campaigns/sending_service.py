"""
캠페인 발송 서비스 — 개별/대량 발송, 이력 관리

원본: XOG sending_service.py (Django)
포팅: WELNO FastAPI + DatabaseManager (2026-03-25)
"""
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pymysql

from ...utils.wiset_agent import (
    generate_sn, format_req_dtm, normalize_phone_number,
    get_sender_key, build_mzsend_insert_params,
)

logger = logging.getLogger(__name__)

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
    try:
        return pymysql.connect(**MYSQL_CONFIG)
    except Exception as e:
        logger.error(f"MySQL 연결 실패: {e}")
        return None


async def save_order_log(db_manager, order_name: str, sent_count: int,
                         execution_date: str = None) -> bool:
    """order_logs 테이블에 발송 기록 저장/갱신"""
    if not execution_date:
        execution_date = datetime.now().strftime('%Y-%m-%d')
    try:
        existing = await db_manager.execute_query(
            """SELECT log_id, sent_count FROM p9_mkt_biz.order_logs
               WHERE order_name = %s AND execution_date = %s
               ORDER BY log_id DESC LIMIT 1""",
            (order_name, execution_date),
        )
        if existing:
            new_count = (existing[0]['sent_count'] or 0) + sent_count
            await db_manager.execute_update(
                """UPDATE p9_mkt_biz.order_logs
                   SET sent_count = %s, execution_time = NOW()
                   WHERE log_id = %s""",
                (new_count, existing[0]['log_id']),
            )
        else:
            await db_manager.execute_update(
                """INSERT INTO p9_mkt_biz.order_logs
                   (order_name, execution_date, sent_count, execution_time, status)
                   VALUES (%s, %s, %s, NOW(), 'completed')""",
                (order_name, execution_date, sent_count),
            )
        return True
    except Exception as e:
        logger.error(f"발송 기록 저장 오류: {e}")
        return False


async def send_test_message(
    phone: str, name: str, template_code: str,
    content: str, attachment: str = None,
) -> Tuple[bool, str]:
    """테스트 알림톡 직접 MySQL INSERT"""
    mysql_conn = _connect_mysql()
    if not mysql_conn:
        return False, 'MySQL 연결 실패'

    try:
        cur = mysql_conn.cursor()
        sn = generate_sn()
        sender_key = get_sender_key(template_code=template_code)

        params = build_mzsend_insert_params(
            sn=sn, sender_key=sender_key,
            phone_num=phone, tmpl_cd=template_code,
            snd_msg=content, attachment=attachment,
            subject=template_code,
        )

        cols = list(params.keys())
        vals = [params[c] for c in cols]
        placeholders = ', '.join(['%s'] * len(cols))
        col_str = ', '.join(cols)

        cur.execute(
            f"INSERT INTO MZSENDTRAN ({col_str}) VALUES ({placeholders})",
            vals,
        )
        mysql_conn.commit()
        cur.close()
        mysql_conn.close()

        logger.info(f"테스트 발송 성공: {phone} ({name}), SN={sn}")
        return True, sn

    except Exception as e:
        logger.error(f"테스트 발송 실패: {e}")
        if mysql_conn:
            mysql_conn.close()
        return False, str(e)


async def get_alimtalk_history(
    db_manager, campaign_id: str = None,
    phone: str = None, limit: int = 50,
) -> List[Dict]:
    """알림톡 발송 이력 조회 — MZSENDLOG (완료) + MZSENDTRAN (대기)"""
    mysql_conn = _connect_mysql()
    if not mysql_conn:
        return []

    try:
        cur = mysql_conn.cursor(pymysql.cursors.DictCursor)

        where = []
        params = []

        if phone:
            where.append("PHONE_NUM = %s")
            params.append(normalize_phone_number(phone))
        if campaign_id:
            where.append("SUBJECT LIKE %s")
            params.append(f"%{campaign_id}%")

        where_clause = (" WHERE " + " AND ".join(where)) if where else ""
        params_log = list(params) + [limit]
        params_tran = list(params) + [limit]

        # 완료건 (MZSENDLOG) + 대기건 (MZSENDTRAN) UNION
        cur.execute(
            f"""(SELECT SN, PHONE_NUM AS phone, TMPL_CD AS template_code,
                        SND_MSG AS message_content, REQ_DTM AS request_datetime,
                        SUBJECT AS subject, ATTACHMENT AS attachment,
                        MSG_TYPE AS msg_type, RSLT_CD AS result_code,
                        RCPT_MSG AS result_message, 'LOG' AS source
                 FROM MZSENDLOG {where_clause}
                 ORDER BY REQ_DTM DESC LIMIT %s)
                UNION ALL
                (SELECT SN, PHONE_NUM AS phone, TMPL_CD AS template_code,
                        SND_MSG AS message_content, REQ_DTM AS request_datetime,
                        SUBJECT AS subject, ATTACHMENT AS attachment,
                        MSG_TYPE AS msg_type, RSLT_CD AS result_code,
                        RCPT_MSG AS result_message, 'TRAN' AS source
                 FROM MZSENDTRAN {where_clause}
                 ORDER BY REQ_DTM DESC LIMIT %s)
                ORDER BY request_datetime DESC LIMIT %s""",
            params_log + params_tran + [limit],
        )
        rows = cur.fetchall()
        cur.close()
        mysql_conn.close()

        for row in rows:
            row['is_success'] = row.get('result_code') == '0000'

        return rows

    except Exception as e:
        logger.error(f"알림톡 이력 조회 실패: {e}")
        if mysql_conn:
            mysql_conn.close()
        return []


async def get_alimtalk_status(sn: str) -> Optional[Dict]:
    """알림톡 개별 발송 상태 조회 — MZSENDLOG(완료) 우선, 없으면 MZSENDTRAN(대기)"""
    mysql_conn = _connect_mysql()
    if not mysql_conn:
        return None

    try:
        cur = mysql_conn.cursor(pymysql.cursors.DictCursor)

        # 1) MZSENDLOG (완료건)
        cur.execute(
            """SELECT SN, PHONE_NUM AS phone, TMPL_CD AS template_code,
                      SND_MSG AS message_content, REQ_DTM AS request_datetime,
                      TRAN_STS AS send_status, RSLT_CD AS result_code,
                      RCPT_MSG AS result_message, 'LOG' AS source
               FROM MZSENDLOG WHERE SN = %s""",
            (sn,),
        )
        row = cur.fetchone()

        # 2) 없으면 MZSENDTRAN (대기건)
        if not row:
            cur.execute(
                """SELECT SN, PHONE_NUM AS phone, TMPL_CD AS template_code,
                          SND_MSG AS message_content, REQ_DTM AS request_datetime,
                          TRAN_STS AS send_status, RSLT_CD AS result_code,
                          RCPT_MSG AS result_message, 'TRAN' AS source
                   FROM MZSENDTRAN WHERE SN = %s""",
                (sn,),
            )
            row = cur.fetchone()

        cur.close()
        mysql_conn.close()

        if row:
            row['is_success'] = row.get('result_code') == '0000'
        return row

    except Exception as e:
        logger.error(f"알림톡 상태 조회 실패 ({sn}): {e}")
        if mysql_conn:
            mysql_conn.close()
        return None
