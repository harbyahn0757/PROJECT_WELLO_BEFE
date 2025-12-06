"""
검진 설계 프롬프트 모듈
단계별 프롬프트 생성 및 페르소나 판정 로직
"""

# 1. 페르소나 및 설문 매핑
from .persona import determine_persona
from .survey_mapping import generate_survey_section

# 2. RAG 서비스
from .rag_service import init_rag_engine, get_medical_evidence_from_rag

# 3. 단계별 프롬프트 생성 함수
# 외부에서는 create_checkup_design_prompt_step1 등으로 호출하므로 alias 유지
from .step1_prompt import create_step1_prompt as create_checkup_design_prompt_step1
from .step2_priority1 import create_checkup_design_prompt_step2_priority1
from .step2_upselling import create_checkup_design_prompt_step2_upselling

# 4. 상수 데이터
from .constants import (
    RISK_ANALYSIS_LOGIC_JSON,
    PROFILE_GUIDELINE_JSON,
    BRIDGE_STRATEGY_JSON
)

# 5. 시스템 메시지 (Step 2용 - 상수로 정의되어 있었음)
# prompt.py가 삭제되므로 여기서 직접 정의하거나 상수로 이동해야 함.
# 일단 하위 호환성을 위해 간단한 문자열로 정의
CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2 = """
당신은 베테랑 헬스 큐레이터입니다.
환자의 데이터를 분석하여 최적의 건강검진을 설계해주세요.
"""

__all__ = [
    'determine_persona',
    'generate_survey_section',
    'create_checkup_design_prompt_step1',
    'create_checkup_design_prompt_step2_priority1',
    'create_checkup_design_prompt_step2_upselling',
    'init_rag_engine',
    'get_medical_evidence_from_rag',
    'CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2',
    'RISK_ANALYSIS_LOGIC_JSON',
    'PROFILE_GUIDELINE_JSON',
    'BRIDGE_STRATEGY_JSON'
]
