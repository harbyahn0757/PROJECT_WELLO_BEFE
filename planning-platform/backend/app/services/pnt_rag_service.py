"""
PNT RAG 서비스
벡터 DB에서 검사/건기식/식품 상세 설명 조회 (캐싱 포함)
"""
import asyncio
from typing import Dict, Any, Optional
from app.services.checkup_design.rag_service import init_rag_engine


class PNTRagService:
    def __init__(self):
        """PNT RAG 서비스 초기화"""
        self.query_engine = None
        self._cache = {}  # 메모리 캐시 (실제로는 Redis 사용)
    
    async def initialize(self):
        """RAG 엔진 초기화"""
        if self.query_engine is None:
            self.query_engine = await init_rag_engine(use_local_vector_db=True)
    
    # =============================================
    # 1. 검사 항목 상세 설명
    # =============================================
    
    async def get_test_detailed_explanation(
        self,
        test_code: str,
        patient_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        검사 항목 상세 설명 조회
        
        Args:
            test_code: 검사 코드 (예: CORTISOL_SALIVA)
            patient_context: 환자 컨텍스트 (나이, 증상 등)
        
        Returns:
            상세 설명 텍스트
        """
        await self.initialize()
        
        # 캐시 확인
        cache_key = f"test_detail:{test_code}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # RAG 쿼리 생성
        context_str = ""
        if patient_context:
            context_str = f"\n\n환자 정보:\n- 주요 증상: {patient_context.get('symptoms', '없음')}\n- 나이: {patient_context.get('age', '정보 없음')}세"
        
        query = f"""
        {test_code} 검사에 대해 다음 정보를 자세히 알려주세요:
        
        1. 검사의 임상적 목적과 중요성
        2. 검사 절차와 준비사항 (금식, 시간대 등)
        3. 결과 해석 방법 (정상 범위, 기능적 범위)
        4. 이 검사로 알 수 있는 구체적인 건강 정보
        5. 과학적 근거와 최신 가이드라인
        {context_str}
        """
        
        response = await self.query_engine.aquery(query)
        result = str(response)
        
        # 캐시 저장 (TTL: 7일, 실제로는 Redis 사용)
        self._cache[cache_key] = result
        
        return result
    
    # =============================================
    # 2. 건기식 상세 정보
    # =============================================
    
    async def get_supplement_detailed_info(
        self,
        supplement_code: str
    ) -> str:
        """
        건기식 상세 정보 조회
        
        Args:
            supplement_code: 건기식 코드 (예: LICORICE)
        
        Returns:
            상세 정보 텍스트
        """
        await self.initialize()
        
        # 캐시 확인
        cache_key = f"supplement_info:{supplement_code}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        query = f"""
        {supplement_code} 건강기능식품에 대해 다음 정보를 자세히 알려주세요:
        
        1. 작용 기전 (어떻게 효과가 나타나는가)
        2. 임상적 효과와 연구 결과
        3. 권장 복용량과 최적 복용 시간
        4. 주의사항 및 금기 사항
        5. 약물 상호작용
        6. 과학적 근거와 연구 논문
        """
        
        response = await self.query_engine.aquery(query)
        result = str(response)
        
        # 캐시 저장
        self._cache[cache_key] = result
        
        return result
    
    # =============================================
    # 3. 식품 효능 설명
    # =============================================
    
    async def get_food_benefits_explanation(
        self,
        food_code: str
    ) -> str:
        """
        식품 효능 상세 설명 조회
        
        Args:
            food_code: 식품 코드 (예: AVOCADO)
        
        Returns:
            효능 설명 텍스트
        """
        await self.initialize()
        
        # 캐시 확인
        cache_key = f"food_benefit:{food_code}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        query = f"""
        {food_code} 식품에 대해 다음 정보를 자세히 알려주세요:
        
        1. 주요 영양 성분과 함량
        2. 건강 효과와 치료적 특성
        3. 권장 섭취량과 최적 조리법
        4. 보관 방법과 제철 정보
        5. 과학적 근거와 연구 결과
        """
        
        response = await self.query_engine.aquery(query)
        result = str(response)
        
        # 캐시 저장
        self._cache[cache_key] = result
        
        return result
    
    # =============================================
    # 4. 일괄 조회 (배치)
    # =============================================
    
    async def get_batch_test_explanations(
        self,
        test_codes: list[str],
        patient_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """여러 검사 항목 일괄 조회"""
        tasks = [
            self.get_test_detailed_explanation(code, patient_context)
            for code in test_codes
        ]
        results = await asyncio.gather(*tasks)
        return dict(zip(test_codes, results))
    
    async def get_batch_supplement_info(
        self,
        supplement_codes: list[str]
    ) -> Dict[str, str]:
        """여러 건기식 일괄 조회"""
        tasks = [
            self.get_supplement_detailed_info(code)
            for code in supplement_codes
        ]
        results = await asyncio.gather(*tasks)
        return dict(zip(supplement_codes, results))
    
    # =============================================
    # 5. 캐시 관리
    # =============================================
    
    def clear_cache(self, cache_key: Optional[str] = None):
        """캐시 삭제"""
        if cache_key:
            self._cache.pop(cache_key, None)
        else:
            self._cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """캐시 통계"""
        return {
            "total_cached_items": len(self._cache),
            "test_details": len([k for k in self._cache if k.startswith("test_detail:")]),
            "supplement_info": len([k for k in self._cache if k.startswith("supplement_info:")]),
            "food_benefits": len([k for k in self._cache if k.startswith("food_benefit:")])
        }


# 싱글톤 인스턴스
_pnt_rag_service = None

def get_pnt_rag_service() -> PNTRagService:
    """PNT RAG 서비스 싱글톤"""
    global _pnt_rag_service
    if _pnt_rag_service is None:
        _pnt_rag_service = PNTRagService()
    return _pnt_rag_service
