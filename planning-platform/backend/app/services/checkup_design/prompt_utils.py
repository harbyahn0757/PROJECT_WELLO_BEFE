"""
검진 설계 프롬프트 생성을 위한 유틸리티 함수 모음
"""
import re
import json
from typing import Dict, Any, List
from .constants import BRIDGE_STRATEGY_JSON

def remove_html_tags(text: str) -> str:
    """HTML 태그를 제거하고 순수 텍스트만 반환"""
    if not text:
        return text
    # <span class="highlight-period">...</span> 같은 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def parse_json_safely(data: Any) -> Dict[str, Any]:
    """JSON 문자열 또는 딕셔너리를 안전하게 파싱하여 딕셔너리 반환"""
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {}
    return {}

def build_bridge_strategy_knowledge() -> str:
    """Bridge Strategy 지식 베이스 텍스트 생성"""
    knowledge = ""
    for idx, strategy in enumerate(BRIDGE_STRATEGY_JSON, 1):
        knowledge += f"{idx}. {strategy['target']} 전략\n"
        knowledge += f"   - Anchor: {strategy['anchor']}\n"
        knowledge += f"   - Gap: {strategy['gap']}\n"
        knowledge += f"   - Offer: {strategy['offer']}\n"
    return knowledge

def generate_behavior_section(user_attributes: List[Dict[str, Any]]) -> str:
    """사용자 행동 속성(UserAttribute)을 기반으로 행동 분석 섹션 텍스트 생성"""
    if not user_attributes:
        return ""
        
    behavior_section = "\n## [Behavioral Signals] 행동 패턴 및 진심도 분석\n"
    behavior_section += "사용자의 설문 응답 과정에서 수집된 비언어적 행동 데이터입니다. 이 정보를 통해 사용자의 '진심도'와 '숨겨진 니즈'를 파악하세요.\n\n"
    
    # 속성을 그룹화하여 표시
    worry_items = []
    sincerity_items = []
    management_items = []
    
    for attr in user_attributes:
        if not isinstance(attr, dict):
            continue
            
        target = attr.get('target', '')
        attribute = attr.get('attribute', '')
        level = attr.get('level', '')
        reason = attr.get('reason', '')
        
        item_str = f"- **{target}**: {attribute.upper()} = {level} ({reason})"
        
        if attribute == 'worry_level':
            worry_items.append(item_str)
        elif attribute in ['sincerity', 'engagement', 'hesitation']:
            sincerity_items.append(item_str)
        elif attribute in ['management_status', 'risk_factor']:
            management_items.append(item_str)
        else:
            sincerity_items.append(item_str)
    
    if worry_items:
        behavior_section += "### 🔥 걱정/불안 신호 (Worry Level)\n" + "\n".join(worry_items) + "\n\n"
    
    if sincerity_items:
        behavior_section += "### 👁️ 진심도 및 관심 신호 (Sincerity & Engagement)\n" + "\n".join(sincerity_items) + "\n\n"
        
    if management_items:
        behavior_section += "### 🏃 자가 관리 상태 (Management Status)\n" + "\n".join(management_items) + "\n\n"
        
    behavior_section += "**해석 가이드:**\n"
    behavior_section += "- **Sincerity High (진심도 높음)**: 체류 시간이 길거나 수정을 반복한 항목입니다. 사용자가 이 부분에 대해 깊게 고민하고 있음을 의미하므로, 분석 시 비중 있게 다뤄주세요.\n"
    behavior_section += "- **Hesitation (망설임)**: 답변을 선택했다가 취소하거나 페이지를 앞뒤로 이동한 흔적입니다. 확신이 없거나 민감한 주제일 수 있으니 조심스럽게 접근하세요.\n"
    behavior_section += "- **Critical Worry**: 사용자가 구체적으로 서술한 걱정입니다. 반드시 해소해줘야 합니다.\n"
    
    return behavior_section

def generate_clinical_rules(survey_responses: Dict[str, Any]) -> str:
    """
    문진 데이터 기반 임상 우선순위 규칙(Clinical Rules) 생성
    만성질환(대사/혈관/간/폐) 퍼스트 전략 적용
    """
    rules = []
    
    weight_change = survey_responses.get("weight_change", "")
    family_history = survey_responses.get("family_history", [])
    smoking = survey_responses.get("smoking", "")
    drinking = survey_responses.get("drinking", "")
    # daily_routine = survey_responses.get("daily_routine", []) # 필요시 활용

    # Rule 1: 의도치 않은 체중 감소 (Red Flag)
    if weight_change == "decrease_bad":
        rules.append(
            "1. ⚠️ **RED FLAG (체중 감소)**: 환자는 의도치 않은 체중 감소(3kg 이상)가 있습니다.\n"
            "   - **Action**: 위/대장 내시경, 복부 CT/초음파, 갑상선 검사 등 **'구조적 이상'을 확인하는 검사**를 최우선(Priority 2)으로 제안하십시오.\n"
            "   - **Restriction**: 원인 규명용으로 유전자 검사나 종양 표지자만 단독 제안하는 것을 금지합니다. 반드시 눈으로 보는 검사가 메인이어야 합니다."
        )

    # Rule 2: 심장 가족력 (Heart Risk)
    if "heart_disease" in family_history:
        rules.append(
            "2. ⚠️ **Heart Risk (심장 가족력)**: 심장 질환 가족력이 확인됩니다.\n"
            "   - **Action**: 혈관 상태를 직접 확인할 수 있는 **'관상동맥 석회화 CT'**를 Priority 2 필수 항목으로 포함하십시오.\n"
            "   - **Message**: '가족력이 있으니, 혈관이 얼마나 딱딱해졌는지 눈으로 확인하고 관리 기준을 잡으셔야 합니다'라는 톤으로 설득하십시오."
        )

    # Rule 3: 흡연 (Lung Risk -> Chronic Care)
    if smoking == "current_smoker":
        rules.append(
            "3. 🚬 **Smoker Care (흡연)**: 현재 흡연 중입니다.\n"
            "   - **Action**: **'저선량 폐 CT'**를 만성 흡연 관리 패키지의 일환으로 제안하십시오.\n"
            "   - **Tone**: 폐암 공포를 조장하기보다, '흡연으로 지친 폐 상태를 점검하고 관리하자'는 현실적인 톤을 유지하십시오."
        )

    # Rule 4: 만성질환/대사 관리 기본 (General Metabolic Rule)
    # 특별한 Red Flag가 없더라도 기본적으로 깔고 가야 할 규칙
    rules.append(
        "4. 🛡️ **Metabolic First (만성질환 우선)**: 모든 제안의 80%는 **혈압/혈당/지질/비만/간/수면/스트레스** 관리에 집중하십시오.\n"
        "   - 암이나 희귀질환은 '혹시 모를 위험을 닫아두는 옵션'으로 20% 비중만 할애하십시오.\n"
        "   - '안 하면 죽습니다'가 아니라 **'이거 딱 챙기면 1년이 편해집니다'**라는 가성비/효율 톤으로 제안하십시오."
    )

    if not rules:
        return ""

    return "\n[CRITICAL CLINICAL RULES]\n" + "\n".join(rules) + "\n"
