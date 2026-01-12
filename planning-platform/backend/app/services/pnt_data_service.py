"""
PNT 데이터 서비스
PostgreSQL에서 PNT 매트릭스 조회, 사용자 응답 저장, 점수 계산 담당
"""
import asyncpg
import json
from typing import Dict, List, Any, Optional
from datetime import datetime


class PNTDataService:
    def __init__(self, db_config: Dict[str, Any]):
        """
        PNT 데이터 서비스 초기화
        
        Args:
            db_config: PostgreSQL 연결 설정
        """
        self.db_config = db_config
    
    # =============================================
    # 1. 그룹 및 질문 조회
    # =============================================
    
    async def get_all_groups(self) -> List[Dict[str, Any]]:
        """모든 PNT 그룹 조회"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT group_id, group_name, target_symptoms, description, display_order
                FROM welno.welno_pnt_groups
                WHERE is_active = TRUE
                ORDER BY display_order
            """
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    
    async def get_questions_by_group(self, group_id: str) -> List[Dict[str, Any]]:
        """그룹별 질문 조회"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT q.question_id, q.question_text, q.question_type, q.display_order,
                       q.is_required, q.helper_text,
                       json_agg(
                           json_build_object(
                               'option_id', o.option_id,
                               'option_value', o.option_value,
                               'option_label', o.option_label,
                               'score', o.score,
                               'display_order', o.display_order
                           ) ORDER BY o.display_order
                       ) as options
                FROM welno.welno_pnt_questions q
                LEFT JOIN welno.welno_pnt_answer_options o ON q.question_id = o.question_id
                WHERE q.group_id = $1
                GROUP BY q.question_id
                ORDER BY q.display_order
            """
            rows = await conn.fetch(query, group_id)
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    
    # =============================================
    # 2. 사용자 응답 저장
    # =============================================
    
    async def save_user_response(
        self,
        patient_uuid: str,
        hospital_id: str,
        session_id: str,
        question_id: str,
        answer_value: str,
        answer_score: int
    ) -> int:
        """사용자 문진 응답 저장"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                INSERT INTO welno.welno_pnt_user_responses
                (patient_uuid, hospital_id, session_id, question_id, answer_value, answer_score)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING response_id
            """
            response_id = await conn.fetchval(
                query, patient_uuid, hospital_id, session_id, 
                question_id, answer_value, answer_score
            )
            return response_id
        finally:
            await conn.close()
    
    async def save_batch_responses(
        self,
        patient_uuid: str,
        hospital_id: str,
        session_id: str,
        responses: List[Dict[str, Any]]
    ) -> List[int]:
        """여러 응답 일괄 저장"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                INSERT INTO welno.welno_pnt_user_responses
                (patient_uuid, hospital_id, session_id, question_id, answer_value, answer_score)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING response_id
            """
            response_ids = []
            for resp in responses:
                response_id = await conn.fetchval(
                    query, patient_uuid, hospital_id, session_id,
                    resp['question_id'], resp['answer_value'], resp.get('answer_score', 0)
                )
                response_ids.append(response_id)
            return response_ids
        finally:
            await conn.close()
    
    # =============================================
    # 3. 점수 계산
    # =============================================
    
    async def calculate_group_scores(
        self,
        patient_uuid: str,
        session_id: str
    ) -> Dict[str, int]:
        """그룹별 점수 집계"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT q.group_id, SUM(r.answer_score) as total_score
                FROM welno.welno_pnt_user_responses r
                JOIN welno.welno_pnt_questions q ON r.question_id = q.question_id
                WHERE r.patient_uuid = $1 AND r.session_id = $2
                GROUP BY q.group_id
                ORDER BY total_score DESC
            """
            rows = await conn.fetch(query, patient_uuid, session_id)
            return {row['group_id']: row['total_score'] for row in rows}
        finally:
            await conn.close()
    
    # =============================================
    # 4. 추천 생성 (매트릭스 기반)
    # =============================================
    
    async def get_recommendations_by_answer(
        self,
        question_id: str,
        answer_value: str
    ) -> Dict[str, Any]:
        """답변별 추천 조회 (매트릭스)"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT 
                    m.matrix_id,
                    m.group_id,
                    m.recommended_tests,
                    m.recommended_supplements,
                    m.recommended_foods,
                    m.recommendation_priority,
                    m.brief_rationale,
                    
                    -- 검사 항목 상세
                    (
                        SELECT json_agg(json_build_object(
                            'test_id', t.test_id,
                            'test_code', t.test_code,
                            'test_name_ko', t.test_name_ko,
                            'test_category', t.test_category,
                            'specimen_type', t.specimen_type,
                            'brief_reason', t.brief_reason,
                            'is_advanced', t.is_advanced,
                            'estimated_cost', t.estimated_cost
                        ))
                        FROM welno.welno_pnt_test_items t
                        WHERE t.test_id = ANY(m.recommended_tests)
                    ) as test_details,
                    
                    -- 건기식 상세
                    (
                        SELECT json_agg(json_build_object(
                            'supplement_id', s.supplement_id,
                            'supplement_code', s.supplement_code,
                            'supplement_name_ko', s.supplement_name_ko,
                            'category', s.category,
                            'recommended_dosage', s.recommended_dosage,
                            'brief_reason', s.brief_reason
                        ))
                        FROM welno.welno_pnt_supplements s
                        WHERE s.supplement_id = ANY(m.recommended_supplements)
                    ) as supplement_details,
                    
                    -- 식품 상세
                    (
                        SELECT json_agg(json_build_object(
                            'food_id', f.food_id,
                            'food_code', f.food_code,
                            'food_name_ko', f.food_name_ko,
                            'food_category', f.food_category,
                            'key_nutrients', f.key_nutrients,
                            'brief_reason', f.brief_reason
                        ))
                        FROM welno.welno_pnt_foods f
                        WHERE f.food_id = ANY(m.recommended_foods)
                    ) as food_details
                    
                FROM welno.welno_pnt_recommendation_matrix m
                WHERE m.question_id = $1 AND m.option_value = $2
                ORDER BY m.recommendation_priority DESC
            """
            row = await conn.fetchrow(query, question_id, answer_value)
            return dict(row) if row else None
        finally:
            await conn.close()
    
    async def generate_final_recommendations(
        self,
        patient_uuid: str,
        hospital_id: str,
        session_id: str,
        checkup_design_request_id: Optional[int] = None
    ) -> int:
        """최종 추천 결과 생성 및 저장"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            # 1. 그룹별 점수 계산
            group_scores = await self.calculate_group_scores(patient_uuid, session_id)
            total_score = sum(group_scores.values())
            
            # 2. 사용자 응답 기반 추천 수집
            responses_query = """
                SELECT question_id, answer_value
                FROM welno.welno_pnt_user_responses
                WHERE patient_uuid = $1 AND session_id = $2
            """
            responses = await conn.fetch(responses_query, patient_uuid, session_id)
            
            # 3. 각 응답별 추천 조회 및 병합
            all_tests = []
            all_supplements = []
            all_foods = []
            
            for resp in responses:
                recommendations = await self.get_recommendations_by_answer(
                    resp['question_id'], resp['answer_value']
                )
                if recommendations:
                    if recommendations['test_details']:
                        all_tests.extend(recommendations['test_details'])
                    if recommendations['supplement_details']:
                        all_supplements.extend(recommendations['supplement_details'])
                    if recommendations['food_details']:
                        all_foods.extend(recommendations['food_details'])
            
            # 4. 중복 제거 및 우선순위 정렬
            unique_tests = self._deduplicate_by_id(all_tests, 'test_id')
            unique_supplements = self._deduplicate_by_id(all_supplements, 'supplement_id')
            unique_foods = self._deduplicate_by_id(all_foods, 'food_id')
            
            # 5. 최종 추천 저장
            insert_query = """
                INSERT INTO welno.welno_pnt_final_recommendations
                (patient_uuid, hospital_id, session_id, checkup_design_request_id,
                 recommended_tests, recommended_supplements, recommended_foods,
                 total_pnt_score, group_scores)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING recommendation_id
            """
            recommendation_id = await conn.fetchval(
                insert_query,
                patient_uuid, hospital_id, session_id, checkup_design_request_id,
                json.dumps(unique_tests), json.dumps(unique_supplements), json.dumps(unique_foods),
                total_score, json.dumps(group_scores)
            )
            
            return recommendation_id
        finally:
            await conn.close()
    
    # =============================================
    # 5. 유틸리티
    # =============================================
    
    def _deduplicate_by_id(self, items: List[Dict], id_key: str) -> List[Dict]:
        """ID 기반 중복 제거"""
        seen = set()
        unique = []
        for item in items:
            if item[id_key] not in seen:
                seen.add(item[id_key])
                unique.append(item)
        return unique
    
    async def get_user_responses(
        self,
        patient_uuid: str,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """사용자 응답 조회"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT r.response_id, r.question_id, r.answer_value, r.answer_score,
                       r.answered_at, q.question_text, q.group_id
                FROM welno.welno_pnt_user_responses r
                JOIN welno.welno_pnt_questions q ON r.question_id = q.question_id
                WHERE r.patient_uuid = $1 AND r.session_id = $2
                ORDER BY r.answered_at
            """
            rows = await conn.fetch(query, patient_uuid, session_id)
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    
    async def get_final_recommendation(
        self,
        patient_uuid: str,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """최종 추천 결과 조회"""
        conn = await asyncpg.connect(**self.db_config)
        try:
            query = """
                SELECT recommendation_id, patient_uuid, hospital_id, session_id,
                       checkup_design_request_id,
                       recommended_tests, recommended_supplements, recommended_foods,
                       total_pnt_score, group_scores, created_at
                FROM welno.welno_pnt_final_recommendations
                WHERE patient_uuid = $1 AND session_id = $2
                ORDER BY created_at DESC
                LIMIT 1
            """
            row = await conn.fetchrow(query, patient_uuid, session_id)
            return dict(row) if row else None
        finally:
            await conn.close()


# 싱글톤 인스턴스 (config.env에서 DB 설정 로드)
_pnt_data_service = None

def get_pnt_data_service(db_config: Dict[str, Any]) -> PNTDataService:
    """PNT 데이터 서비스 싱글톤"""
    global _pnt_data_service
    if _pnt_data_service is None:
        _pnt_data_service = PNTDataService(db_config)
    return _pnt_data_service
