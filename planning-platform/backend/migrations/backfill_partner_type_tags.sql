-- 기존 태그 데이터 최소 매핑 (병원 파트너 세션만)
-- risk_level → medical_urgency 간단 매핑
-- 나머지 병원 필드는 NULL 유지 → retag_all_sessions(force=True)로 LLM 재분석

-- Step 1: medilinx 파트너 세션의 medical_urgency만 매핑
UPDATE welno.tb_chat_session_tags t
SET medical_urgency = CASE
        WHEN t.risk_level = 'high' THEN 'urgent'
        WHEN t.risk_level = 'medium' THEN 'borderline'
        ELSE 'normal'
    END
FROM welno.tb_partner_rag_chat_log c
WHERE t.session_id = c.session_id
  AND c.partner_id = 'medilinx'
  AND t.medical_urgency IS NULL;

-- Step 2: 확인 쿼리
-- SELECT medical_urgency, COUNT(*)
-- FROM welno.tb_chat_session_tags t
-- JOIN welno.tb_partner_rag_chat_log c ON t.session_id = c.session_id
-- WHERE c.partner_id = 'medilinx'
-- GROUP BY medical_urgency;

-- Step 3: 정확한 분류는 배포 후 retag_all_sessions(force=True) 실행
-- POST /embedding-management/retag-sessions?force=true
-- LLM이 대화 원문을 재분석하여 medical_tags, lifestyle_tags,
-- anxiety_level, prospect_type, hospital_prospect_score 모두 채움
