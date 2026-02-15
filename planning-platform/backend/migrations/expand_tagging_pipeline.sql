-- ═══════════════════════════════════════════════════════════
-- WELNO DS 파이프라인 확장 마이그레이션
-- 실행: psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f expand_tagging_pipeline.sql
-- ═══════════════════════════════════════════════════════════

-- ═══ 1) tb_chat_session_tags 확장 ═══
ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS commercial_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS buying_signal VARCHAR DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conversion_flag BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_tags_commercial
  ON welno.tb_chat_session_tags USING gin (commercial_tags);
CREATE INDEX IF NOT EXISTS idx_chat_tags_buying_signal
  ON welno.tb_chat_session_tags (buying_signal);

-- ═══ 2) 분석용 뷰: 상담+설문(legacy+dynamic UNION)+검진 교차 ═══
CREATE OR REPLACE VIEW welno.v_analysis_cross AS
WITH survey_merged AS (
  -- Legacy survey (고정 컬럼 — revisit_intention 없음)
  SELECT respondent_uuid,
         overall_satisfaction,
         waiting_time,
         facility_cleanliness,
         staff_kindness,
         NULL::smallint AS revisit_intention,
         created_at AS survey_date
  FROM welno.tb_hospital_survey_responses
  UNION ALL
  -- Dynamic survey (JSONB에서 추출)
  SELECT respondent_uuid,
         (answers->>'overall_satisfaction')::smallint AS overall_satisfaction,
         (answers->>'waiting_time')::smallint AS waiting_time,
         (answers->>'facility_cleanliness')::smallint AS facility_cleanliness,
         (answers->>'staff_kindness')::smallint AS staff_kindness,
         (answers->>'revisit_intention')::smallint AS revisit_intention,
         created_at AS survey_date
  FROM welno.tb_survey_responses_dynamic
)
SELECT
  c.user_uuid AS web_app_key,
  c.session_id,
  c.hospital_id,
  h.hospital_name,
  c.created_at AS chat_date,
  -- 태깅 필드
  t.risk_level, t.sentiment, t.action_intent, t.engagement_score,
  t.interest_tags, t.key_concerns, t.follow_up_needed,
  t.counselor_recommendations, t.conversation_summary,
  t.commercial_tags, t.buying_signal, t.conversion_flag,
  t.data_quality_score, t.nutrition_tags,
  -- 설문 교차 (최신 1건, legacy+dynamic 통합)
  sv.overall_satisfaction AS survey_satisfaction,
  sv.revisit_intention AS survey_revisit,
  sv.waiting_time AS survey_waiting_time,
  sv.survey_date,
  -- 파생: VIP 위험 점수
  CASE
    WHEN t.risk_level = 'high' AND (sv.overall_satisfaction IS NULL OR sv.overall_satisfaction <= 3)
      THEN 'red_alert'
    WHEN t.risk_level = 'high' AND sv.overall_satisfaction > 3
      THEN 'watch'
    WHEN t.risk_level = 'medium' AND (sv.overall_satisfaction IS NULL OR sv.overall_satisfaction <= 3)
      THEN 'watch'
    ELSE 'normal'
  END AS vip_risk_score,
  -- 파생: Pain Point (설문 낮은 항목)
  CASE WHEN sv.waiting_time IS NOT NULL AND sv.waiting_time <= 2 THEN true ELSE false END AS pp_waiting_time,
  CASE WHEN sv.facility_cleanliness IS NOT NULL AND sv.facility_cleanliness <= 2 THEN true ELSE false END AS pp_facility,
  CASE WHEN sv.staff_kindness IS NOT NULL AND sv.staff_kindness <= 2 THEN true ELSE false END AS pp_staff
FROM welno.tb_partner_rag_chat_log c
LEFT JOIN welno.tb_chat_session_tags t ON t.session_id = c.session_id
LEFT JOIN welno.tb_hospital_rag_config h ON h.hospital_id = c.hospital_id AND h.is_active = true
LEFT JOIN LATERAL (
  SELECT overall_satisfaction, revisit_intention, waiting_time,
         facility_cleanliness, staff_kindness, survey_date
  FROM survey_merged
  WHERE respondent_uuid = c.user_uuid
  ORDER BY survey_date DESC LIMIT 1
) sv ON true
WHERE c.user_uuid IS NOT NULL;
