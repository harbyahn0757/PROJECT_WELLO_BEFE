"""
DB 터널을 통한 검증 쿼리 헬퍼.

SSH 터널 경로:
  로컬 → 223.130.142.105 (root / dksrhkdtn!23) → 10.0.1.10:5432
  DB: p9_mkt_biz, user: peernine, password: autumn3334!

expect를 사용하여 SSH 접속 → psql 실행.
"""

import subprocess
import json
import re
from typing import Optional


def query_db(sql: str, timeout: int = 15) -> str:
    """
    SSH 터널을 통해 WELNO DB에 쿼리 실행.

    Args:
        sql: 실행할 SQL 쿼리 (세미콜론 포함 가능)
        timeout: expect 타임아웃 (초)

    Returns:
        psql 출력 문자열 (헤더 + 행)
    """
    # SQL에서 줄바꿈 제거 (expect send에서 문제 방지)
    sql_oneline = " ".join(sql.strip().split())

    expect_script = f"""
spawn ssh -o StrictHostKeyChecking=no root@223.130.142.105
expect "password:"
send "dksrhkdtn!23\\r"
expect "# "
send "PGPASSWORD='autumn3334!' psql -h 10.0.1.10 -p 5432 -U peernine -d p9_mkt_biz -t -A -F '|' -c \\"{sql_oneline}\\"\\r"
expect -timeout {timeout} "# "
send "exit\\r"
expect eof
"""

    try:
        result = subprocess.run(
            ["expect", "-c", expect_script],
            capture_output=True,
            text=True,
            timeout=timeout + 10,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""
    except FileNotFoundError:
        return "[ERROR] expect command not found"


def check_terms_saved(uuid: str) -> bool:
    """약관 동의가 DB에 저장되었는지 확인."""
    sql = (
        f"SELECT COUNT(*) FROM welno.terms_agreements "
        f"WHERE patient_uuid = '{uuid}';"
    )
    output = query_db(sql)

    # expect 출력에서 숫자 추출
    for line in output.splitlines():
        line = line.strip()
        if line.isdigit():
            return int(line) > 0
    return False


def get_patient_data(uuid: str) -> Optional[dict]:
    """환자 기본 정보 조회. 없으면 None."""
    sql = (
        f"SELECT uuid, name, phone, birthday, partner_id "
        f"FROM welno.patients "
        f"WHERE uuid = '{uuid}' LIMIT 1;"
    )
    output = query_db(sql)

    for line in output.splitlines():
        line = line.strip()
        if "|" in line:
            parts = line.split("|")
            if len(parts) >= 5:
                return {
                    "uuid": parts[0].strip(),
                    "name": parts[1].strip(),
                    "phone": parts[2].strip(),
                    "birthday": parts[3].strip(),
                    "partner_id": parts[4].strip(),
                }
    return None


def get_campaign_link_data(lookup_key: str) -> Optional[dict]:
    """캠페인 링크 데이터 조회."""
    sql = (
        f"SELECT lookup_key, uuid, partner_id, hospital_id "
        f"FROM welno.campaign_links "
        f"WHERE lookup_key = '{lookup_key}' LIMIT 1;"
    )
    output = query_db(sql)

    for line in output.splitlines():
        line = line.strip()
        if "|" in line:
            parts = line.split("|")
            if len(parts) >= 4:
                return {
                    "lookup_key": parts[0].strip(),
                    "uuid": parts[1].strip(),
                    "partner_id": parts[2].strip(),
                    "hospital_id": parts[3].strip(),
                }
    return None
