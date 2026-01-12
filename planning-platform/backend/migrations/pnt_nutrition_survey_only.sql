-- PNT 영양상태평가 16개 질문만 우선 INSERT
-- 작성일: 2026-01-12
-- 목적: 확보된 영양상태평가 질문 먼저 DB에 저장

-- 1. 그룹 INSERT (2개)
INSERT INTO welno.welno_pnt_groups (group_id, group_name, target_symptoms, description, display_order) VALUES
('nutrition_weight', '체중조절 평가', ARRAY['체중 관리', '식사 조절', '외식 관리', '신체활동'], '건강체중 유지 및 체중조절 능력 평가', 1),
('nutrition_health', '건강식생활 평가', ARRAY['균형 식사', '위생 관리', '영양 상태'], '건강한 식생활 실천 능력 평가', 2)
ON CONFLICT (group_id) DO NOTHING;


-- 2. 질문 INSERT (16개)
-- 체중조절 평가 (8개)
INSERT INTO welno.welno_pnt_questions (question_id, group_id, question_text, question_type, display_order, is_required) VALUES
('nq01', 'nutrition_weight', '나는 나의 건강체중을 알고 일정하게 유지할 수 있다', 'scale_5', 1, true),
('nq02', 'nutrition_weight', '나는 체중조절에 도움이 되는 식품을 선택할 수 있다', 'scale_5', 2, true),
('nq03', 'nutrition_weight', '나는 건강체중을 위한 균형 잡힌 상차림을 할 수 있다', 'scale_5', 3, true),
('nq04', 'nutrition_weight', '나는 나에게 맞는 적정 식사섭취량을 조절할 수 있다', 'scale_5', 4, true),
('nq05', 'nutrition_weight', '나는 올바른 외식 방법을 실천할 수 있다', 'scale_5', 5, true),
('nq06', 'nutrition_weight', '나는 정기적인 신체활동을 통하여 체중관리를 할 수 있다', 'scale_5', 6, true),
('nq07', 'nutrition_weight', '나는 과식이나 폭식 하기 쉬운 상황을 피할 수 있다', 'scale_5', 7, true),
('nq08', 'nutrition_weight', '나는 건강기능식품을 올바로 이용할 수 있다', 'scale_5', 8, true),

-- 건강식생활 평가 (8개)
('nq09', 'nutrition_health', '나는 건강한 식생활을 실천할 수 있다', 'scale_5', 9, true),
('nq10', 'nutrition_health', '나는 균형 잡힌 상차림을 할 수 있다', 'scale_5', 10, true),
('nq11', 'nutrition_health', '나는 식품을 위생적으로 다룰 수 있다', 'scale_5', 11, true),
('nq12', 'nutrition_health', '나는 체중을 건강하게 유지할 수 있다', 'scale_5', 12, true),
('nq13', 'nutrition_health', '나는 영양불량을 예방하는 식사법을 실천할 수 있다', 'scale_5', 13, true),
('nq14', 'nutrition_health', '나는 필요할 때 영양보충음료를 이용할 수 있다', 'scale_5', 14, true),
('nq15', 'nutrition_health', '나는 건강기능식품을 올바로 이용할 수 있다', 'scale_5', 15, true),
('nq16', 'nutrition_health', '나는 나의 영양상태를 좋게 유지할 수 있다', 'scale_5', 16, true)
ON CONFLICT (question_id) DO NOTHING;


-- 3. 답변 옵션 INSERT (5점 척도 공통)
INSERT INTO welno.welno_pnt_answer_options (question_id, option_value, option_label, score, display_order) VALUES
-- nq01 옵션
('nq01', '1', '매우 자신 없다', 1, 1),
('nq01', '2', '자신 없다', 2, 2),
('nq01', '3', '보통이다', 3, 3),
('nq01', '4', '자신 있다', 4, 4),
('nq01', '5', '매우 자신 있다', 5, 5),

-- nq02 옵션
('nq02', '1', '매우 자신 없다', 1, 1),
('nq02', '2', '자신 없다', 2, 2),
('nq02', '3', '보통이다', 3, 3),
('nq02', '4', '자신 있다', 4, 4),
('nq02', '5', '매우 자신 있다', 5, 5),

-- nq03 옵션
('nq03', '1', '매우 자신 없다', 1, 1),
('nq03', '2', '자신 없다', 2, 2),
('nq03', '3', '보통이다', 3, 3),
('nq03', '4', '자신 있다', 4, 4),
('nq03', '5', '매우 자신 있다', 5, 5),

-- nq04 옵션
('nq04', '1', '매우 자신 없다', 1, 1),
('nq04', '2', '자신 없다', 2, 2),
('nq04', '3', '보통이다', 3, 3),
('nq04', '4', '자신 있다', 4, 4),
('nq04', '5', '매우 자신 있다', 5, 5),

-- nq05 옵션
('nq05', '1', '매우 자신 없다', 1, 1),
('nq05', '2', '자신 없다', 2, 2),
('nq05', '3', '보통이다', 3, 3),
('nq05', '4', '자신 있다', 4, 4),
('nq05', '5', '매우 자신 있다', 5, 5),

-- nq06 옵션
('nq06', '1', '매우 자신 없다', 1, 1),
('nq06', '2', '자신 없다', 2, 2),
('nq06', '3', '보통이다', 3, 3),
('nq06', '4', '자신 있다', 4, 4),
('nq06', '5', '매우 자신 있다', 5, 5),

-- nq07 옵션
('nq07', '1', '매우 자신 없다', 1, 1),
('nq07', '2', '자신 없다', 2, 2),
('nq07', '3', '보통이다', 3, 3),
('nq07', '4', '자신 있다', 4, 4),
('nq07', '5', '매우 자신 있다', 5, 5),

-- nq08 옵션
('nq08', '1', '매우 자신 없다', 1, 1),
('nq08', '2', '자신 없다', 2, 2),
('nq08', '3', '보통이다', 3, 3),
('nq08', '4', '자신 있다', 4, 4),
('nq08', '5', '매우 자신 있다', 5, 5),

-- nq09 옵션
('nq09', '1', '매우 자신 없다', 1, 1),
('nq09', '2', '자신 없다', 2, 2),
('nq09', '3', '보통이다', 3, 3),
('nq09', '4', '자신 있다', 4, 4),
('nq09', '5', '매우 자신 있다', 5, 5),

-- nq10 옵션
('nq10', '1', '매우 자신 없다', 1, 1),
('nq10', '2', '자신 없다', 2, 2),
('nq10', '3', '보통이다', 3, 3),
('nq10', '4', '자신 있다', 4, 4),
('nq10', '5', '매우 자신 있다', 5, 5),

-- nq11 옵션
('nq11', '1', '매우 자신 없다', 1, 1),
('nq11', '2', '자신 없다', 2, 2),
('nq11', '3', '보통이다', 3, 3),
('nq11', '4', '자신 있다', 4, 4),
('nq11', '5', '매우 자신 있다', 5, 5),

-- nq12 옵션
('nq12', '1', '매우 자신 없다', 1, 1),
('nq12', '2', '자신 없다', 2, 2),
('nq12', '3', '보통이다', 3, 3),
('nq12', '4', '자신 있다', 4, 4),
('nq12', '5', '매우 자신 있다', 5, 5),

-- nq13 옵션
('nq13', '1', '매우 자신 없다', 1, 1),
('nq13', '2', '자신 없다', 2, 2),
('nq13', '3', '보통이다', 3, 3),
('nq13', '4', '자신 있다', 4, 4),
('nq13', '5', '매우 자신 있다', 5, 5),

-- nq14 옵션
('nq14', '1', '매우 자신 없다', 1, 1),
('nq14', '2', '자신 없다', 2, 2),
('nq14', '3', '보통이다', 3, 3),
('nq14', '4', '자신 있다', 4, 4),
('nq14', '5', '매우 자신 있다', 5, 5),

-- nq15 옵션
('nq15', '1', '매우 자신 없다', 1, 1),
('nq15', '2', '자신 없다', 2, 2),
('nq15', '3', '보통이다', 3, 3),
('nq15', '4', '자신 있다', 4, 4),
('nq15', '5', '매우 자신 있다', 5, 5),

-- nq16 옵션
('nq16', '1', '매우 자신 없다', 1, 1),
('nq16', '2', '자신 없다', 2, 2),
('nq16', '3', '보통이다', 3, 3),
('nq16', '4', '자신 있다', 4, 4),
('nq16', '5', '매우 자신 있다', 5, 5)
ON CONFLICT (option_id) DO NOTHING;


-- 완료 메시지
SELECT '✅ 영양상태평가 16개 질문 INSERT 완료' AS status;
SELECT COUNT(*) AS total_groups FROM welno.welno_pnt_groups WHERE group_id LIKE 'nutrition_%';
SELECT COUNT(*) AS total_questions FROM welno.welno_pnt_questions WHERE question_id LIKE 'nq%';
SELECT COUNT(*) AS total_options FROM welno.welno_pnt_answer_options WHERE question_id LIKE 'nq%';
