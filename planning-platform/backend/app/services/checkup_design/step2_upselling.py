import json
from typing import List, Dict, Any, Optional, Tuple
from .rag_service import init_rag_engine, get_medical_evidence_from_rag
from .prompt_utils import build_bridge_strategy_knowledge, generate_behavior_section

async def create_checkup_design_prompt_step2_upselling(
    request: Any,
    step1_result: Dict[str, Any],
    step2_1_summary: str,
    rag_service_instance: Any = None,
    prev_rag_context: Optional[str] = None
) -> Tuple[str, List[Dict[str, Any]], str]:
    """
    STEP 2-2: Upselling (정밀 검사) 및 Bridge Strategy 제안 프롬프트 생성
    """
    
    # 기본 정보 추출
    patient_name = request.patient_name
    patient_age = request.birth_date  # 나이 계산 로직 필요 시 추가
    patient_gender = request.gender
    selected_concerns = request.selected_concerns or []
    survey_responses = request.survey_responses or {}
    
    # Step 1 결과 JSON 문자열 변환
    step1_result_json = json.dumps(step1_result, ensure_ascii=False, indent=2)
    
    # 병원 추천 항목 (DB에서 가져온 것)
    hospital_recommended = request.hospital_recommended_items or []
    hospital_external_checkup = request.hospital_external_checkup_items or []
    
    # 페르소나 정보 추출
    persona_info = step1_result.get("persona")
    # 방어 코드: persona가 문자열(JSON string)로 넘어온 경우 파싱 시도
    if isinstance(persona_info, str):
        try:
            print(f"[INFO] ⚠️ persona가 문자열로 감지됨, JSON 파싱 시도: {persona_info[:50]}...")
            persona_info = json.loads(persona_info)
        except json.JSONDecodeError:
            print(f"[ERROR] ❌ persona 문자열 파싱 실패: {persona_info}")
            persona_info = {}
            
    if not persona_info:
        persona_info = {}

    persona_type = persona_info.get("type") or persona_info.get("primary_persona", "General")
    persona_desc = persona_info.get("description", "일반적인 환자")

    # 병원 추천 항목 이름 추출 (검색용)
    hospital_items_names = []
    
    # [방어 코드] 문자열로 들어온 경우 JSON 파싱
    if isinstance(hospital_recommended, str):
        try:
            hospital_recommended = json.loads(hospital_recommended)
        except json.JSONDecodeError:
            hospital_recommended = []
            
    for item in hospital_recommended:
        if isinstance(item, str):
            hospital_items_names.append(item)
        elif isinstance(item, dict):
            name = item.get('name') or item.get('item_name')
            if name: hospital_items_names.append(name)
            
    # 외부 검사 항목도 이름 추출
    if isinstance(hospital_external_checkup, str):
        try:
            hospital_external_checkup = json.loads(hospital_external_checkup)
        except json.JSONDecodeError:
            hospital_external_checkup = []
            
    for item in hospital_external_checkup:
        if isinstance(item, str):
            hospital_items_names.append(item)
        elif isinstance(item, dict):
            name = item.get('name') or item.get('item_name')
            if name: hospital_items_names.append(name)

    # RAG 검색 (Upselling 전용)
    new_rag_result = {}
    structured_evidences = []
    rag_evidence_context = ""
    
    if rag_service_instance:
        try:
            # 검색 쿼리: Upselling에 필요한 "정밀 검사" 위주
            upselling_concerns = [{"name": item} for item in hospital_items_names]
            # Step 1의 염려 항목도 포함
            upselling_concerns.extend(selected_concerns)
            
            # 환자 컨텍스트 구성
            patient_context = {
                "age": patient_age or 40,
                "gender": "male" if patient_gender and patient_gender.upper() == "M" else "female",
                "family_history": [],
                "abnormal_items": []
            }
            
            # 가족력 추출
            if survey_responses:
                fh = survey_responses.get('family_history', '')
                if isinstance(fh, str) and fh:
                     patient_context['family_history'] = [x.strip() for x in fh.split(',')]
                elif isinstance(fh, list):
                     patient_context['family_history'] = fh

            # 이상 항목 추출
            risk_profile = step1_result.get("risk_profile") or []
            for risk in risk_profile:
                if isinstance(risk, dict) and risk.get("level") in ['주의', '경계', '이상']:
                    patient_context['abnormal_items'].append({
                        "name": risk.get("factor"), "status": risk.get("level")
                    })

            new_rag_result = await get_medical_evidence_from_rag(
                rag_service_instance,
                patient_context,
                upselling_concerns
            )
            structured_evidences = new_rag_result.get("structured_evidences", [])
            
        except Exception as e:
            print(f"[ERROR] RAG 검색 중 오류: {str(e)}")

    # [CRITICAL] RAG Evidence Context 조립 (번호 매김)
    rag_evidence_context = ""
    
    # 1. Step 2-1 Context (기본 검진 근거)
    if prev_rag_context:
        rag_evidence_context += f"## 기본 검진 관련 근거 (참고용)\n{prev_rag_context}\n\n"
        
    # 2. Step 2-2 New Evidence (정밀 검사 근거) - 번호 매김 필수
    if structured_evidences:
        rag_evidence_context += "## 정밀/추가 검사 관련 근거 (인용 필수) ⭐\n"
        for idx, ev in enumerate(structured_evidences, 1):
            full_text = ev.get('full_text', '')[:400].replace('\n', ' ') # 너무 길면 자름
            source = ev.get('source_document', 'Unknown')
            page = ev.get('page', 'Unknown')
            rag_evidence_context += f"[{idx}] {full_text} (출처: {source}, p.{page})\n"
    elif new_rag_result.get("context_text"):
        # 구조화된 데이터가 없으면 텍스트라도 사용
        rag_evidence_context += f"## 추가 근거\n{new_rag_result.get('context_text')}\n"

    # 환자 정보
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 성별/나이: {"남성" if patient_gender == "M" else "여성"}/{patient_age}세
"""

    # [신규] 행동 기반 진심도 분석 (Behavioral Signals)
    behavior_section = ""
    user_attributes = (survey_responses or {}).get('user_attributes', [])
    if user_attributes:
        behavior_section = generate_behavior_section(user_attributes)

    # 병원 추천 항목 섹션 구성
    hospital_items_section = ""
    if hospital_recommended:
        hospital_items_section += "\n## 병원 추천 검진 항목 (우선 고려)\n"
        for item in hospital_recommended[:30]:
            if isinstance(item, str):
                name = item
                cat = "기타"
                desc = ""
            else:
                name = item.get('name') or item.get('item_name')
                cat = item.get('category', '')
                desc = item.get('description', '') or item.get('summary', '') or ''
                
            if name: 
                hospital_items_section += f"- {name} ({cat})"
                if desc:
                    hospital_items_section += f": {desc}"
                hospital_items_section += "\n"
            
    if hospital_external_checkup:
        hospital_items_section += "\n## 외부 검사 항목 (선택 고려)\n"
        for item in hospital_external_checkup[:30]:
            if isinstance(item, str):
                name = item
                cat = "기타"
                desc = ""
            else:
                name = item.get('name') or item.get('item_name')
                cat = item.get('category', '')
                desc = item.get('description', '') or item.get('summary', '') or ''
                
            if name: 
                hospital_items_section += f"- {name} ({cat})"
                if desc:
                    hospital_items_section += f": {desc}"
                hospital_items_section += "\n"

    # 프롬프트 조합
    prompt_parts = []
    
    # 1. System Instruction
    prompt_parts.append(f"""
# 🛑 SYSTEM INSTRUCTION (Upselling & Persona)

1. **RAG 우선 & 각주 필수**: [Critical Evidence]에 있는 내용을 반드시 인용하고, 문장 끝에 `[1]`, `[2]`와 같이 출처 번호를 표기하세요. (예: ...권고됩니다 [1].)
2. **소통 전략: '활력과 관리(Vitality & Care)' 중심 접근**: 
   - **핵심 철학**: "암"이라는 단어는 고객에게 공포감과 거부감을 줄 수 있습니다. 모든 검사 제안의 입구(Hook)는 **'현재의 컨디션 관리'**와 **'만성질환 예방'**이어야 합니다.
   - **프레이밍(Framing) 규칙**:
     - ❌ **공포 소구 (지양)**: "이 검사 안 하면 위암으로 죽을 수 있습니다." (너무 무거움)
     - ✅ **관리 소구 (지향)**: "속쓰림이나 소화불량이 반복된다면, 위 내시경으로 **위장 점막 상태(염증)**를 확인해서 편안한 속을 되찾아야 합니다." (가볍고 실용적)
     - ✅ **연결 고리**: 암 검진 항목이라도 '대사 질환'이나 '생활 습관'과 연결하여 추천하세요. (예: 폐암 검사 → "흡연으로 지친 폐의 회복 상태 확인")
   - **우선순위**: 고객이 당장 체감하는 **혈압, 혈당, 비만, 피로** 문제를 해결하는 검사를 최우선으로 배치하고, 암 검진은 이를 확인하는 과정에서의 '안심 옵션'으로 제안하세요.
3. **페르소나 적용 & 공감**: 환자는 **'{persona_type}' ({persona_desc})** 성향입니다.
   - **가장 먼저 할 일**: 환자가 선택한 '염려 항목(selected_concerns)'에 대해 공감하는 멘트로 시작하세요.
   - **Worrier (불안형)**: "가족력 때문에 걱정이 많으시죠? 이 검사로 확실하게 확인하고 안심하세요."
   - **Validator (확인형)**: "최신 가이드라인 [1]에 따르면, 이 수치에서는 정밀 검사가 필수적입니다."
   - **Efficient (효율형)**: "가성비가 가장 높은 핵심 검사만 선별했습니다."
   - **General (일반)**: 친근하고 알기 쉽게 설명하세요.
4. **행동 데이터 활용 (Behavioral Signals)**:
   - [Behavioral Signals] 섹션에 있는 진심도/고민 흔적을 Upselling 전략에 활용하세요.
   - 예: "이 항목에서 특히 망설이신 것 같은데, 이 검사로 확실하게 확인해보시죠."

5. **앵무새 금지**: 예시 문구("환자 데이터 활용" 등)를 그대로 복사하지 말고, 실제 환자 데이터와 의학적 내용을 채워 넣으세요.
""")

    # 2. RAG Evidence
    if rag_evidence_context:
        prompt_parts.append(f"""
# [Critical Evidence] ⭐
이 내용을 근거로 사용하세요:
{rag_evidence_context}
---
""")
    else:
        prompt_parts.append(f"""
# [Bridge Strategy Knowledge]
{build_bridge_strategy_knowledge()}
---
""")

    # 3. Contexts
    prompt_parts.append(f"""
# 📋 Context
## STEP 2-1 (기본 검진) 결과
**[중요]** 아래 항목들은 환자의 과거 이력(Step 1)과 임상 가이드라인에 따라 선정된 **'필수 점검 항목(Anchor)'**입니다.
정밀 검사(Upselling)를 제안할 때, 이 기본 검사만으로는 확인하기 어려운 한계점(Gap)을 지적하는 근거로 활용하세요.
(예: "기본 혈액검사로는 간 수치만 알 수 있으니, 간 초음파로 실제 모양을 봐야 합니다")

```json
{step2_1_summary}
```

## STEP 1 (위험도) 분석 결과
```json
{step1_result_json}
```

{patient_info}
{behavior_section}
{hospital_items_section}
""")

    # 4. Task & Output Format
    task_section = f"""
# 🎯 Task - Upselling 논리 설계 (Gap Analysis)

**[핵심 지시사항]**
STEP 1의 환자 데이터(걱정/위험요소)와 **행동 패턴(Behavioral Signals)**을 추천 검사와 연결하되, **반드시 "기본 검사의 한계(Blind Spot)"를 지적하며 설득**하세요.
단순히 "좋다"고 하지 말고, **"기본 검사(A)로는 X를 볼 수 없지만, 이 정밀 검사(B)는 Y를 볼 수 있다"**는 **대조(Contrast) 구조**를 사용하세요.

**[논리 작성 규칙 - Must Do]**
1. **Target**: 추천할 정밀 검사 항목 (**반드시 제공된 '병원 추천 검진 항목' 리스트 내 명칭만 사용. 절대 지어내지 말 것.**)
   - ⚠️ **중요**: priority_2와 priority_3에 있는 모든 항목에 대해 반드시 strategies를 생성하세요. priority_3에 '온코캐치-E'가 있다면 반드시 strategies에 포함하세요.
2. **Anchor (수진자 데이터)**: 환자의 2021년 수치(혈압, 허리둘레 등)나 구체적 가족력, **그리고 설문 시 고민했던 행동(Hesitation)**을 명시.
3. **Gap (결핍 지적)**: 기본 공단 검진(혈액검사, X-ray, 신체계측)이 가진 물리적 한계를 지적하고, **구체적으로 어떤 문제가 발생할 수 있는지 명시**하세요. (Not A)
   - (나쁜 예) "정밀한 검사가 필요합니다."
   - (좋은 예) "기본 혈액 검사로는 간 효소 수치만 알 수 있고, 실제 간이 딱딱해졌는지(모양)는 볼 수 없습니다."
   - (좋은 예) "흉부 X-ray는 뼈에 가려진 작은 초기 암을 놓칠 확률이 높습니다."
   - (좋은 예) "일반 검진의 혈압 측정은 '혈관의 압력'만 잴 뿐, 심장이 불규칙하게 뛰는 '부정맥(심방세동, 조기박동 등)'이나 '허혈성 변화(심근경색 전조)'는 잡아낼 수 없습니다. 부정맥이나 허혈성 변화가 있으면 심장 건강 관리가 필요합니다."
4. **Offer (해결책)**: 위 한계를 정밀 검사가 어떻게 해결하는지 설명. (But B)
5. **Evidence (의학적 근거)**: doctor_recommendation.evidence 필드에 [Critical Evidence] 섹션의 실제 텍스트를 그대로 복사하세요. [1], [2] 같은 번호만 쓰지 말고, 해당 번호의 실제 문장을 포함하세요.
   - (나쁜 예) "2025 고혈압 진료지침 [1]에 따르면..."
   - (좋은 예) "고혈압 가족력이 있는 경우, 매년 고혈압 선별검사를 받는 것이 좋습니다 [1]"
6. **References (참고 자료 배열)**: doctor_recommendation.references 필드에 evidence에 사용된 각주 번호 순서대로 URL 배열을 포함하세요.
   - evidence에 "[1]"이 있으면 references[0]에 해당 URL
   - evidence에 "[2]"가 있으면 references[1]에 해당 URL
   - [Critical Evidence] 섹션에서 각 번호에 해당하는 출처 URL을 찾아서 포함하세요.
   - 예: "evidence": "... [1] ... [2]" → "references": ["https://...", "https://..."]

**[사고 과정 (Thinking Process)]**
JSON 생성 전, `_thought_process` 필드에 위 논리(Anchor -> Gap -> Offer)를 구성하는 과정을 먼저 서술하세요.
"""

    output_format_section = """
# Output Format (JSON)

**생성 전 주의사항:**
- JSON의 값(Value)에 "가이드라인 활용" 같은 추상적 지시문을 쓰지 마세요.
- **환자의 실제 데이터(수치, 병력)를 채워 넣으세요.**

{
  "_thought_process": "1. 환자는 고혈압 경계(140/90) 및 부친 뇌졸중 가족력 보유. 2. 기본 혈압계는 '압력'만 잴 뿐, '리듬(부정맥)'은 못 봄. 3. 병원 추천 리스트의 '심전도 검사'가 이를 해결. 4. 따라서 '혈압약 먹기 전 리듬 확인' 논리로 제안.",
  "priority_2": {
    "title": "병원에서 추천하는 정밀 검진",
    "description": "40대 남성 필수 가이드라인 및 가족력 기반 추천",
    "items": ["<병원 추천 리스트에 있는 정확한 항목명1>", "<병원 추천 리스트에 있는 정확한 항목명2>"],
    "count": 2,
    "health_context": "심혈관 및 소화기 정밀 확인"
  },
  "priority_3": {
    "title": "선택해서 받아보실 수 있는 항목",
    "description": "더 정밀한 검사를 원하신다면 고려해보세요.",
    "items": ["<병원 추천 리스트에 있는 정확한 항목명3>"],
    "count": 1,
    "health_context": "암 정밀 검진"
  },
  "strategies": [
    {
      "target": "<병원 추천 리스트에 있는 정확한 항목명 (예: 심전도 검사)>",
      "⚠️ 중요: priority_2와 priority_3에 있는 모든 항목에 대해 반드시 strategies를 생성하세요. priority_3에 '온코캐치-E'가 있다면 반드시 strategies에 포함하세요.",
      "step1_anchor": "부친의 뇌졸중 가족력 및 2021년 혈압 경계(140/90mmHg) 소견 (설문 시 이 부분에서 고민하심)",
      "step2_gap": "일반 검진의 혈압 측정은 '혈관의 압력'만 잴 뿐, 심장이 불규칙하게 뛰는 '부정맥(심방세동, 조기박동 등)'이나 '허혈성 변화(심근경색 전조)'는 잡아낼 수 없습니다. 부정맥이나 허혈성 변화가 있으면 심장 건강 관리가 필요합니다.",
      "step3_offer": "심전도 검사로 심장 전기 신호의 파형을 직접 확인하여 심장 컨디션을 체크하고 관리하시죠.",
      "doctor_recommendation": {
        "reason": "가족력이 있고 혈압이 높은 안광수님에게는 단순 수치 확인보다 리듬 확인이 시급합니다.",
        "evidence": "[Critical Evidence] 섹션의 [1] 번호에 해당하는 실제 텍스트를 그대로 복사하세요. 예: '고혈압 가족력이 있는 경우, 매년 고혈압 선별검사를 받는 것이 좋습니다 [1]'",
        "references": ["https://...", "https://..."],  // evidence에 사용된 각주 번호 순서대로 URL 배열
        "message": "안광수님, 혈압약 드시기 전에 심장 리듬부터 확실히 체크하고 넘어갑시다."
      }
    },
    {
      "target": "<병원 추천 리스트에 있는 정확한 항목명 (예: 복부 초음파)>",
      "step1_anchor": "최근 체중 3kg 증가 및 허리둘레 89cm(복부비만 위험)",
      "step2_gap": "기본 피검사(AST/ALT)는 간 기능의 30% 정도만 반영하며, 실제 지방간이 얼마나 쌓였는지, 간 표면이 거칠어졌는지는 '눈'으로 보지 않으면 알 수 없습니다.",
      "step3_offer": "복부 초음파가 포함된 정밀 검진으로 간, 췌장 등 주요 장기의 실제 모양을 확인합니다.",
      "doctor_recommendation": {
        "reason": "체중 증가와 복부 비만은 지방간의 직접적 원인이 되므로 영상 검사가 필수입니다.",
        "evidence": "40세 이상 비만 소견자 복부 정밀 검사 필요 [2]",
        "references": ["https://..."],  // evidence에 사용된 각주 번호 순서대로 URL 배열
        "message": "살이 찌면 겉만 찌는 게 아니라 간에도 기름이 낍니다. 초음파로 한번 싹 훑어보시죠."
      }
    }
  ],
  "doctor_comment": {
    "overall_assessment": "전체적인 검진 방향에 대한 의사의 종합 평가 (페르소나 반영, 2-3문장으로 작성)",
    "key_recommendations": [
      "핵심 추천사항 1 (구체적 검사명 포함, 예: '심전도 검사로 심장 리듬을 확인하세요')",
      "핵심 추천사항 2 (예: '정밀 검진으로 폐 상태를 세밀하게 점검하세요')",
      "핵심 추천사항 3 (선택적, priority_3 항목이 있으면 포함)"
    ]
  }
}
"""
    prompt_parts.append(task_section + output_format_section)
    
    prompt = "\n".join(prompt_parts)
    return prompt, structured_evidences, rag_evidence_context
