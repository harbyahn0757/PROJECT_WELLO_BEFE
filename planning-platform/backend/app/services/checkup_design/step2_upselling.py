import json
from typing import List, Dict, Any, Optional, Tuple
from .rag_service import init_rag_engine, get_medical_evidence_from_rag
from .prompt_utils import build_bridge_strategy_knowledge, generate_behavior_section, generate_clinical_rules

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

    # [신규] Clinical Rules 생성 (만성질환 퍼스트 & Red Flag)
    clinical_rules = generate_clinical_rules(survey_responses or {})

    # [신규] Step 1 Persona Conflict Summary 추출
    persona_conflict_summary = step1_result.get("persona_conflict_summary", "")
    
    # 프롬프트 조합
    prompt_parts = []
    
    # 1. System Instruction
    prompt_parts.append(f"""
# 🛑 SYSTEM INSTRUCTION (Upselling & Persona)

{clinical_rules}

## 🎯 TARGET PERSONA STRATEGY
{persona_conflict_summary}

위 [CRITICAL CLINICAL RULES]와 [TARGET PERSONA STRATEGY]를 바탕으로 모든 제안을 구성하십시오.

1. **RAG 우선 & 각주 필수**: [Critical Evidence]에 있는 내용을 반드시 인용하고, 문장 끝에 `[1]`, `[2]`와 같이 출처 번호를 표기하세요.
2. **소통 전략: 'Casual & Smart (형/오빠 톤)'**: 
   - **Tone & Manner**: 딱딱한 의사가 아닌, **"건강 챙겨주는 센스 있는 형/오빠/친구"** 톤을 유지하세요.
   - **Key Message**: "안 하면 큰일 납니다(Fear)"가 아니라 **"이거 딱 챙기면 1년 농사 편해집니다(Value/Efficiency)"**로 설득하세요.
   - **만성질환 퍼스트**: 암 검진이라도 '대사 관리'나 '생활 습관'과 연결하여 추천하세요. (예: 폐암 검사 → "흡연으로 지친 폐 상태 점검")
   
3. **페르소나 적용 & 공감**: 환자는 **'{persona_type}' ({persona_desc})** 성향입니다.
   - **Worrier**: 확신과 안심("이 검사 하나로 불안을 끝내십시오.")
   - **Manager**: 효율과 통제("수치를 눈으로 확인하고 관리 기준을 잡으십시오.")
   - **Symptom Solver**: 원인 규명("증상의 뿌리를 찾아 해결합시다.")
   - **Minimalist/Optimizer**: 가치 제안("이것이 가장 확실한 투자입니다.")
   
4. **Safety Guardrail (Hallucination Prevention)**:
   - **체중 감소 시**: 반드시 내시경/CT 등 **구조적 검사**를 1순위로 제안하십시오. 유전자/마커 단독 제안 금지.
   - **심장 가족력 시**: **관상동맥 석회화 CT**를 필수 제안하십시오.

5. **행동 데이터 활용 (Behavioral Signals)**:
   - [Behavioral Signals] 섹션에 있는 진심도/고민 흔적을 Upselling 전략에 활용하세요.
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
# 🎯 Task - Upselling 논리 설계 (4-Step Bridge Strategy)

**[핵심 지시사항]**
STEP 1의 환자 데이터, 페르소나 충돌 정보, 행동 패턴을 바탕으로 **"기본 검사의 한계"**를 지적하며 **"당신의 불안을 해소하고 행동을 교정해 드립니다"**는 화법으로 설득하십시오.

**[논리 작성 규칙 - Must Do]**
strategies 배열 내 각 항목은 다음 4단계 구조를 엄격히 따르십시오:

1. **Target**: 추천할 정밀 검사 항목 (**반드시 제공된 '병원 추천 검진 항목' 리스트 내 명칭만 사용**)
2. **Anchor (Empathy & Behavior)**: `step1_anchor` 필드.
   - Primary Persona의 감정(불안, 귀찮음 등)에 먼저 공감한 뒤,
   - Secondary Persona의 위험한 행동(술, 담배, 방치)이 그 감정과 모순되는 지점을 '하지만(But)' 화법으로 지적하십시오.
   - 예: "가족력 때문에 늘 불안하셨죠?(Primary) 하지만 매일 술을 드시는 건 그 불안을 현실로 만드는 행동입니다.(Secondary)"
3. **Gap (Clinical Reality)**: `step2_gap` 필드.
   - 기본 검사의 물리적 한계(Blind Spot)와 [CRITICAL CLINICAL RULES]의 Red Flag(체중감소 등)를 언급하십시오.
   - 예: "체중 감소는 몸이 보내는 구조적 위험 신호일 수 있습니다. 기본 피검사로는 암의 위치를 알 수 없습니다."
4. **Offer (Hybrid Offer)**: `step3_offer` 필드.
   - 감정을 해소하고 행동을 바꿀 구체적 검사 제안.
   - 예: "간 섬유화 스캔으로 간 상태를 눈으로 확인하고, 술을 줄일 강력한 동기를 만드십시오."

5. **Evidence**: `doctor_recommendation.evidence` 필드에 [Critical Evidence] 텍스트 인용.
6. **Message**: `doctor_recommendation.message` 필드에 **"안심하고(Primary), 관리하세요(Secondary)"** 톤의 최종 제안.
"""

    output_format_section = """
# Output Format (JSON)

**생성 전 주의사항:**
- JSON의 값(Value)에 "가이드라인 활용" 같은 추상적 지시문을 쓰지 마세요.
- **환자의 실제 데이터(수치, 병력)를 채워 넣으세요.**

{
  "_thought_process": "1. Worrier(가족력 불안) vs Manager(음주 지속) 충돌 감지. 2. 체중 감소 Rule 발동 -> 위내시경/복부CT 우선 배정. 3. '술 줄일 명분'으로 간 정밀 검사 제안.",
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
      "target": "<병원 추천 리스트에 있는 정확한 항목명>",
      "step1_anchor": "가족력 때문에 늘 불안하셨죠?(Primary) 하지만 매일 술을 드시는 건 그 불안을 현실로 만드는 행동입니다.(Secondary)",
      "step2_gap": "기본 피검사(AST/ALT)는 간 기능의 30% 정도만 반영하며, 실제 지방간이 얼마나 쌓였는지, 간 표면이 거칠어졌는지는 '눈'으로 보지 않으면 알 수 없습니다.",
      "step3_offer": "복부 초음파가 포함된 정밀 검진으로 간, 췌장 등 주요 장기의 실제 모양을 확인하여 술을 줄일 확실한 계기를 만드십시오.",
      "doctor_recommendation": {
        "reason": "체중 증가와 복부 비만은 지방간의 직접적 원인이 되므로 영상 검사가 필수입니다.",
        "evidence": "40세 이상 비만 소견자 복부 정밀 검사 필요 [2]",
        "references": ["https://..."],
        "message": "살이 찌면 겉만 찌는 게 아니라 간에도 기름이 낍니다. 초음파로 한번 싹 훑어보시죠."
      }
    }
  ],
  "doctor_comment": {
    "overall_assessment": "전체적인 검진 방향에 대한 의사의 종합 평가 (페르소나 반영, 2-3문장, 친근한 톤)",
    "key_recommendations": [
      "핵심 추천사항 1",
      "핵심 추천사항 2"
    ]
  }
}
"""
    prompt_parts.append(task_section + output_format_section)
    
    prompt = "\n".join(prompt_parts)
    return prompt, structured_evidences, rag_evidence_context
