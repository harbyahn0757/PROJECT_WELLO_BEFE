-- ============================================================
-- 병원 해시 ID → 실명 마이그레이션
--
-- 자동등록된 병원 중 hospital_name이 hospital_id와 동일하거나
-- 해시값인 경우, 채팅 로그(tb_partner_rag_chat_log.client_info)에서
-- 실제 병원명을 추출하여 업데이트
-- ============================================================

-- 1) 확인용: 해시 이름인 병원 목록 + 채팅 로그에서 매핑 가능한 이름
-- (실행 전 검증용 — DRY RUN)
SELECT
    cfg.partner_id,
    cfg.hospital_id,
    cfg.hospital_name AS current_name,
    mapped.real_name
FROM welno.tb_hospital_rag_config cfg
LEFT JOIN LATERAL (
    SELECT DISTINCT ON (partner_id, hospital_id)
        client_info->>'hospital_name' AS real_name
    FROM welno.tb_partner_rag_chat_log
    WHERE partner_id = cfg.partner_id
      AND hospital_id = cfg.hospital_id
      AND client_info->>'hospital_name' IS NOT NULL
      AND client_info->>'hospital_name' != ''
    ORDER BY partner_id, hospital_id, created_at DESC
) mapped ON true
WHERE cfg.hospital_id != '*'
  AND (
      cfg.hospital_name = cfg.hospital_id           -- 이름 == ID (해시)
      OR LENGTH(cfg.hospital_name) >= 64             -- 매우 긴 자동생성 이름
      OR cfg.hospital_name LIKE '(미확인%'           -- 자동생성 접두사
      OR cfg.hospital_name LIKE '(병원코드%'         -- 자동생성 접두사
      OR cfg.hospital_name LIKE '병원_%'             -- FK 마이그레이션 자동생성
  );


-- 2) 실제 업데이트: tb_hospital_rag_config
UPDATE welno.tb_hospital_rag_config AS cfg
SET hospital_name = sub.real_name
FROM (
    SELECT DISTINCT ON (log.partner_id, log.hospital_id)
        log.partner_id,
        log.hospital_id,
        log.client_info->>'hospital_name' AS real_name
    FROM welno.tb_partner_rag_chat_log log
    INNER JOIN welno.tb_hospital_rag_config c
        ON c.partner_id = log.partner_id AND c.hospital_id = log.hospital_id
    WHERE log.client_info->>'hospital_name' IS NOT NULL
      AND log.client_info->>'hospital_name' != ''
      AND c.hospital_id != '*'
      AND (
          c.hospital_name = c.hospital_id
          OR LENGTH(c.hospital_name) >= 64
          OR c.hospital_name LIKE '(미확인%'
          OR c.hospital_name LIKE '(병원코드%'
          OR c.hospital_name LIKE '병원_%'
      )
    ORDER BY log.partner_id, log.hospital_id, log.created_at DESC
) sub
WHERE cfg.partner_id = sub.partner_id
  AND cfg.hospital_id = sub.hospital_id;


-- 3) 실제 업데이트: welno_hospitals
UPDATE welno.welno_hospitals AS h
SET hospital_name = sub.real_name
FROM (
    SELECT DISTINCT ON (log.partner_id, log.hospital_id)
        log.hospital_id,
        log.client_info->>'hospital_name' AS real_name
    FROM welno.tb_partner_rag_chat_log log
    INNER JOIN welno.welno_hospitals wh
        ON wh.hospital_id = log.hospital_id
    WHERE log.client_info->>'hospital_name' IS NOT NULL
      AND log.client_info->>'hospital_name' != ''
      AND (
          wh.hospital_name = wh.hospital_id
          OR LENGTH(wh.hospital_name) >= 64
          OR wh.hospital_name LIKE '(미확인%'
          OR wh.hospital_name LIKE '(병원코드%'
          OR wh.hospital_name LIKE '병원_%'
      )
    ORDER BY log.partner_id, log.hospital_id, log.created_at DESC
) sub
WHERE h.hospital_id = sub.hospital_id;
