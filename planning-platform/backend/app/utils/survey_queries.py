"""서베이 테이블 UNION 쿼리 유틸리티.

tb_hospital_survey_responses + tb_survey_responses_dynamic 을
UNION ALL 하는 패턴이 여러 엔드포인트에서 반복되므로 공통화.
"""

SURVEY_TABLES = [
    "welno.tb_hospital_survey_responses",
    "welno.tb_survey_responses_dynamic",
]


def survey_union_count_today(partner_id: str = None) -> tuple:
    """오늘 서베이 건수 SQL + params 반환.

    Returns:
        (sql, params) tuple
    """
    if partner_id:
        sql = """SELECT COALESCE(SUM(cnt), 0) AS today_surveys FROM (
            SELECT COUNT(*) AS cnt FROM welno.tb_hospital_survey_responses
            WHERE created_at::date = CURRENT_DATE AND partner_id = %s
          UNION ALL
            SELECT COUNT(*) AS cnt FROM welno.tb_survey_responses_dynamic
            WHERE created_at::date = CURRENT_DATE AND partner_id = %s
        ) sub"""
        return sql, (partner_id, partner_id)
    else:
        sql = """SELECT COALESCE(SUM(cnt), 0) AS today_surveys FROM (
            SELECT COUNT(*) AS cnt FROM welno.tb_hospital_survey_responses
            WHERE created_at::date = CURRENT_DATE
          UNION ALL
            SELECT COUNT(*) AS cnt FROM welno.tb_survey_responses_dynamic
            WHERE created_at::date = CURRENT_DATE
        ) sub"""
        return sql, ()


def survey_union_count_today_simple() -> str:
    """오늘 서베이 건수 (단순 서브쿼리 형태, params 없음).

    Returns:
        SQL string
    """
    return """SELECT
        COALESCE((SELECT COUNT(*) FROM welno.tb_hospital_survey_responses WHERE created_at::date = CURRENT_DATE), 0)
        + COALESCE((SELECT COUNT(*) FROM welno.tb_survey_responses_dynamic WHERE created_at::date = CURRENT_DATE), 0)
    as cnt"""


def survey_union_daily(date_from: str, date_to: str) -> tuple:
    """일별 서베이 건수 SQL + params.

    Returns:
        (sql, params) tuple
    """
    sql = """SELECT d::date AS date, SUM(cnt) AS cnt FROM (
           SELECT created_at::date AS d, COUNT(*) AS cnt
           FROM welno.tb_hospital_survey_responses
           WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
           GROUP BY created_at::date
         UNION ALL
           SELECT created_at::date AS d, COUNT(*) AS cnt
           FROM welno.tb_survey_responses_dynamic
           WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
           GROUP BY created_at::date
       ) sub GROUP BY d ORDER BY d"""
    return sql, (date_from, date_to, date_from, date_to)


def survey_union_by_respondent(hospital_id: str = None) -> tuple:
    """respondent_uuid별 서베이 집계 SQL + params.

    Returns:
        (sql, params) tuple
    """
    survey_where = ""
    survey_params: tuple = ()
    if hospital_id:
        survey_where = "WHERE hospital_id = %s"
        survey_params = (hospital_id,)

    sql = f"""SELECT sub.respondent_uuid AS web_app_key,
               SUM(sub.cnt) AS survey_count,
               MAX(sub.last_survey) AS last_survey,
               MAX(h.hospital_name) AS hospital_name,
               MAX(sub.respondent_name) AS respondent_name
        FROM (
            SELECT respondent_uuid, hospital_id, respondent_name,
                   COUNT(*) AS cnt, MAX(created_at) AS last_survey
            FROM welno.tb_hospital_survey_responses
            {survey_where}
            GROUP BY respondent_uuid, hospital_id, respondent_name
          UNION ALL
            SELECT respondent_uuid, hospital_id, respondent_name,
                   COUNT(*) AS cnt, MAX(created_at) AS last_survey
            FROM welno.tb_survey_responses_dynamic
            {survey_where}
            GROUP BY respondent_uuid, hospital_id, respondent_name
        ) sub
        LEFT JOIN welno.tb_hospital_rag_config h
          ON h.hospital_id = sub.hospital_id AND h.is_active = true
        GROUP BY sub.respondent_uuid"""
    return sql, survey_params + survey_params


def survey_union_detail_for_user(web_app_key: str) -> tuple:
    """특정 사용자의 전체 서베이 응답 목록 SQL + params.

    Returns:
        (sql, params) tuple
    """
    sql = """SELECT id AS response_id, hospital_id, created_at,
               reservation_process, facility_cleanliness, staff_kindness,
               waiting_time, overall_satisfaction,
               free_comment, 'legacy' AS template_name,
               NULL AS answers
        FROM welno.tb_hospital_survey_responses
        WHERE respondent_uuid = %s
      UNION ALL
        SELECT d.id AS response_id, d.hospital_id, d.created_at,
               NULL, NULL, NULL, NULL, NULL,
               d.free_comment,
               COALESCE(t.template_name, 'dynamic') AS template_name,
               d.answers::text AS answers
        FROM welno.tb_survey_responses_dynamic d
        LEFT JOIN welno.tb_survey_templates t ON t.id = d.template_id
        WHERE d.respondent_uuid = %s
        ORDER BY created_at DESC"""
    return sql, (web_app_key, web_app_key)


def survey_union_by_hospital_today(partner_id: str) -> tuple:
    """파트너 소속 병원별 오늘 서베이 건수 SQL + params.

    Returns:
        (sql, params) tuple
    """
    sql = """SELECT hospital_id, COUNT(*) as cnt FROM (
        SELECT hospital_id FROM welno.tb_hospital_survey_responses WHERE partner_id = %s AND created_at::date = CURRENT_DATE
        UNION ALL
        SELECT hospital_id FROM welno.tb_survey_responses_dynamic WHERE partner_id = %s AND created_at::date = CURRENT_DATE
    ) t GROUP BY hospital_id"""
    return sql, (partner_id, partner_id)
