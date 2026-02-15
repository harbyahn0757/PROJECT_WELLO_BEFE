"""공통 WHERE 절 빌더."""
from typing import Optional


def build_filter(
    table_alias: str = "t",
    partner_id: Optional[str] = None,
    hospital_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> tuple:
    """WHERE 절 문자열 + params 튜플 반환.

    Returns:
        (where_clause, params) — where_clause는 AND로 연결된 조건 문자열,
        params는 %s에 대응하는 값 튜플.
    """
    prefix = f"{table_alias}." if table_alias else ""
    clauses: list = []
    params: list = []
    if partner_id:
        clauses.append(f"{prefix}partner_id = %s")
        params.append(partner_id)
    if hospital_id:
        clauses.append(f"{prefix}hospital_id = %s")
        params.append(hospital_id)
    if date_from:
        clauses.append(f"{prefix}created_at >= %s::date")
        params.append(date_from)
    if date_to:
        clauses.append(f"{prefix}created_at < (%s::date + interval '1 day')")
        params.append(date_to)
    return " AND ".join(clauses), tuple(params)
