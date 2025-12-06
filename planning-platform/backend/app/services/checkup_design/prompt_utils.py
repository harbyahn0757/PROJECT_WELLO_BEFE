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
