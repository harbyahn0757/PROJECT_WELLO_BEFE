"""
검진 설계 관련 유틸리티 함수들
"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def parse_json_with_recovery(content: str, step_name: str = "STEP", session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    JSON 문자열을 안전하게 파싱하고, 실패 시 복구 시도
    
    Args:
        content: 파싱할 JSON 문자열
        step_name: 단계 이름 (로깅용)
        session_id: 세션 ID (로깅용)
    
    Returns:
        파싱된 딕셔너리
    """
    import re
    
    # 1. 코드블록 제거 (정규식으로 개선)
    cleaned = content.strip()
    
    # ```json ... ``` 제거
    cleaned = re.sub(r'^```json\s*\n?', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'^```\s*\n?', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'\n?```\s*$', '', cleaned, flags=re.MULTILINE | re.DOTALL)
    cleaned = cleaned.strip()
    
    # 2. 응답 길이 체크 (너무 짧으면 불완전한 응답)
    if len(cleaned) < 500:
        logger.error(f"❌ [{step_name}] 응답이 너무 짧음 ({len(cleaned)}자) - Gemini 응답 불완전")
        raise ValueError(f"{step_name} 응답 불완전: 길이 {len(cleaned)}자 (최소 500자 필요)")
    
    # 3. 첫 번째 JSON 파싱 시도
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"⚠️ [{step_name}] JSON 파싱 실패, 복구 시도 중...")
        logger.warning(f"⚠️ [{step_name}] 에러 위치: line {e.lineno}, column {e.colno}, pos {getattr(e, 'pos', 'unknown')}")
        
        # 4. JSON 복구 시도
        error_pos = getattr(e, 'pos', None)
        if not error_pos or error_pos >= len(cleaned):
            error_pos = len(cleaned)
        
        # 에러 위치 이전까지의 텍스트 추출
        fixed = cleaned[:error_pos]
        
        # 불완전한 문자열 찾기 및 닫기 (개선된 로직)
        # 문자열 내부인지 확인 (따옴표 개수 세기)
        quote_count = 0
        in_escape = False
        for char in fixed:
            if char == '\\' and not in_escape:
                in_escape = True
                continue
            if char == '"' and not in_escape:
                quote_count += 1
            in_escape = False
        
        # 홀수 개의 따옴표 = 문자열이 열려있음
        if quote_count % 2 == 1:
            fixed += '"'
        
        # 열린 중괄호/대괄호 닫기
        open_braces = fixed.count('{') - fixed.count('}')
        open_brackets = fixed.count('[') - fixed.count(']')
        
        fixed += '}' * open_braces
        fixed += ']' * open_brackets
        
        # 5. 복구된 JSON 파싱 시도
        try:
            result = json.loads(fixed)
            logger.info(f"✅ [{step_name}] JSON 복구 성공")
            return result
        except json.JSONDecodeError as recovery_error:
            logger.error(f"❌ [{step_name}] JSON 복구도 실패: {recovery_error}")
            
            # 6. 최후 수단: 기본 구조 반환
            logger.warning(f"⚠️ [{step_name}] 기본 구조로 폴백")
            if step_name == "STEP1":
                return {
                    "patient_summary": "환자 정보 분석 중 오류 발생",
                    "analysis": "분석 결과를 생성할 수 없습니다",
                    "survey_reflection": "설문 반영 중 오류 발생",
                    "selected_concerns_analysis": "염려 항목 분석 중 오류 발생",
                    "basic_checkup_guide": "기본 검진 안내를 제공할 수 없습니다"
                }
            elif step_name == "STEP2":
                return {
                    "priority_1": {"items": [], "rationale": "우선순위 1 항목을 생성할 수 없습니다"},
                    "priority_2": {"items": [], "rationale": "우선순위 2 항목을 생성할 수 없습니다"},
                    "priority_3": {"items": [], "rationale": "우선순위 3 항목을 생성할 수 없습니다"},
                    "medical_evidence": "의학적 근거를 제공할 수 없습니다",
                    "summary": "검진 설계 요약을 생성할 수 없습니다"
                }
            else:
                return {"error": f"{step_name} 파싱 실패", "raw_content": content[:500]}


def get_repositories():
    """저장소 인스턴스들을 반환"""
    from ....repositories.implementations import PatientRepository, CheckupDesignRepository
    return PatientRepository(), CheckupDesignRepository()


def normalize_survey_responses(responses: Optional[Any]) -> Dict[str, Any]:
    """설문 응답을 정규화"""
    if not responses:
        return {}
    
    if isinstance(responses, str):
        try:
            return json.loads(responses)
        except json.JSONDecodeError:
            return {}
    
    if isinstance(responses, dict):
        return responses
    
    return {}