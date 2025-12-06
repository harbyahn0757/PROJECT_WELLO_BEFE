"""
STEP 2-1: Priority 1 (일반검진 주의 항목) 전용 프롬프트 생성 모듈
"""
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from .rag_service import init_rag_engine, get_medical_evidence_from_rag
from .prompt_utils import remove_html_tags, generate_behavior_section
from .constants import (
    RISK_ANALYSIS_LOGIC_JSON,
    PROFILE_GUIDELINE_JSON,
    BRIDGE_STRATEGY_JSON
)

# 마스터 지식 베이스 구축 함수 (내부 사용)
def build_master_knowledge_section():
    """
    RAG 검색이 실패하거나 보완이 필요할 때 사용할 Master Knowledge 섹션 생성
    constants.py의 데이터를 기반으로 구축
    """
    section = """
# [Master Knowledge Base] ⭐ 보조 지식
(RAG 검색 결과가 없을 경우 이 지식을 참고하세요)

## 1. 위험도 분석 로직 (Risk Logic)
"""
    section += json.dumps(RISK_ANALYSIS_LOGIC_JSON, ensure_ascii=False, indent=2)
    
    section += "\n\n## 2. 프로필별 가이드라인\n"
    section += json.dumps(PROFILE_GUIDELINE_JSON, ensure_ascii=False, indent=2)
    
    return section


async def create_checkup_design_prompt_step2_priority1(
    step1_result: Dict[str, Any],
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> tuple[str, List[Dict[str, Any]], str]:
    """
    STEP 2-1: Priority 1 (일반검진 주의 항목) 전용 프롬프트 생성
    
    Returns:
        tuple: (프롬프트 문자열, 구조화된 에비던스 리스트, RAG 컨텍스트 원문)
    """
    # 💾 로그: 함수 시작
    print(f"[INFO] 🎯 STEP 2-1 (Priority 1) 프롬프트 생성 시작...")
    
    # STEP 1 결과를 JSON 문자열로 변환
    step1_result_json = json.dumps(step1_result, ensure_ascii=False, indent=2)
    
    # RAG 검색 수행 (구조화된 에비던스 반환)
    rag_evidence_context = ""
    structured_evidences = []
    try:
        # RAG 엔진 초기화
        query_engine = await init_rag_engine()
        
        if query_engine:
            # 환자 컨텍스트 구성
            patient_context = {
                "age": patient_age or 40,
                "gender": "male" if patient_gender and patient_gender.upper() == "M" else "female",
                "family_history": [],
                "abnormal_items": []
            }
            
            # 설문 응답에서 가족력 추출
            if survey_responses:
                family_history_raw = survey_responses.get('family_history', '')
                if isinstance(family_history_raw, str) and family_history_raw:
                    patient_context['family_history'] = [fh.strip() for fh in family_history_raw.split(',') if fh.strip()]
                elif isinstance(family_history_raw, list):
                    patient_context['family_history'] = family_history_raw
            
            # STEP 1 결과에서 과거 검진 이상 항목 추출
            risk_profile = step1_result.get("risk_profile") or []
            for risk in risk_profile:
                if isinstance(risk, dict):
                    factor = risk.get("factor", "")
                    level = risk.get("level", "")
                    if level in ['주의', '경계', '이상']:
                        patient_context['abnormal_items'].append({
                            "name": factor,
                            "status": level
                        })
            
            # RAG 검색 실행
            rag_result = await get_medical_evidence_from_rag(
                query_engine=query_engine,
                patient_context=patient_context,
                concerns=selected_concerns
            )
            
            rag_evidence_context = rag_result.get("context_text", "")
            structured_evidences = rag_result.get("structured_evidences", [])
            
            print(f"[INFO] RAG 검색 완료 - {len(structured_evidences)}개 에비던스, {len(rag_evidence_context)}자")
        else:
            print("[WARN] RAG 엔진을 사용할 수 없어 하드코딩된 지식을 사용합니다.")
    except Exception as e:
        print(f"[ERROR] RAG 검색 중 오류 발생: {str(e)}")
        # import traceback
        # traceback.print_exc()
    
    # 현재 날짜 계산
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)
    current_date_str = today.strftime("%Y년 %m월 %d일")
    five_years_ago_str = five_years_ago.strftime("%Y년 %m월 %d일")
    
    # 환자 정보 섹션
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 현재 날짜: {current_date_str}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"

    # STEP 1 분석 결과 섹션 (기존과 동일)
    step1_context = f"""
## STEP 1 분석 결과 (컨텍스트)

앞서 진행된 환자 분석 결과는 다음과 같습니다:

```json
{step1_result_json}
```
"""

    # 건강 데이터 섹션
    health_data_section = ""
    if health_data:
        health_data_section = "\n## 과거 건강검진 데이터 (참고용)\n"
        health_data_section += f"분석 기간: {five_years_ago_str} ~ {current_date_str}\n\n"
        recent_data = sorted(health_data, key=lambda x: x.get('checkup_date', '') or x.get('year', ''), reverse=True)[:3]
        for idx, record in enumerate(recent_data, 1):
            checkup_date = record.get('checkup_date') or record.get('CheckUpDate') or '날짜 미상'
            checkup_year = record.get('year', '')
            hospital_name = record.get('location') or record.get('Location') or record.get('hospital_name', '병원명 미상')
            
            if checkup_year and checkup_date != '날짜 미상':
                date_display = f"{checkup_year}년 {checkup_date}"
            elif checkup_year:
                date_display = f"{checkup_year}년"
            else:
                date_display = checkup_date
            
            health_data_section += f"### {idx}. {date_display} - {hospital_name}\n"
            
            # 이상/경계 항목 추출
            abnormal_items = []
            warning_items = []
            raw_data = record.get('raw_data') or {}
            
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            
            if isinstance(raw_data, dict) and raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    item_unit = item.get("Unit") or ""
                                    
                                    if item.get("ItemReferences"):
                                        item_status = None  # None = 정상, "abnormal" = 이상, "warning" = 경계
                                        
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            
                                            # 정상(A) 항목은 제외 (정상이므로 리스트에 추가하지 않음)
                                            if "정상(A)" in ref_name:
                                                item_status = "normal"
                                                break
                                            # 이상 항목
                                            elif "질환의심" in ref_name or "이상" in ref_name:
                                                item_status = "abnormal"
                                                break
                                            # 경계 항목
                                            elif "정상(B)" in ref_name or "경계" in ref_name:
                                                item_status = "warning"
                                                break
                                        
                                        # 정상이 아닌 항목만 추가
                                        if item_status == "abnormal":
                                            abnormal_items.append(f"- {item_name}: {item_value} {item_unit} (이상)")
                                        elif item_status == "warning":
                                            warning_items.append(f"- {item_name}: {item_value} {item_unit} (경계)")
            
            if abnormal_items:
                health_data_section += "**이상 항목:**\n" + "\n".join(abnormal_items) + "\n\n"
            if warning_items:
                health_data_section += "**경계 항목:**\n" + "\n".join(warning_items) + "\n\n"
            if not abnormal_items and not warning_items:
                health_data_section += "이상 소견 없음\n\n"

    # 처방전 데이터 섹션
    prescription_section = ""
    if prescription_analysis_text:
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section = "\n## 약물 복용 이력 분석\n" + clean_analysis_text + "\n"
    elif prescription_data:
        prescription_section = "\n## 약물 복용 이력\n"
        recent_prescriptions = sorted(prescription_data, key=lambda x: x.get('prescription_date', ''), reverse=True)[:5]
        medication_summary = []
        for rx in recent_prescriptions:
            med_name = rx.get('medication_name', '')
            period = rx.get('period', '')
            if med_name:
                medication_summary.append(f"- {med_name} ({period})")
        if medication_summary:
            prescription_section += "\n".join(medication_summary) + "\n"

    # 선택한 염려 항목 섹션
    concerns_section = ""
    if selected_concerns:
        concerns_section = "\n## 사용자가 선택한 염려 항목\n"
        for idx, concern in enumerate(selected_concerns, 1):
            concern_name = concern.get('name', '')
            concern_date = concern.get('date', '')
            concern_value = concern.get('value', '')
            concern_unit = concern.get('unit', '')
            concern_status = concern.get('status', '')
            
            concerns_section += f"{idx}. {concern_name}"
            if concern_date:
                concerns_section += f" ({concern_date})"
            if concern_value:
                concerns_section += f": {concern_value} {concern_unit}"
            if concern_status:
                concerns_section += f" [{concern_status}]"
            concerns_section += "\n"

    # 문진 응답 섹션
    survey_section = ""
    if survey_responses:
        survey_section = "\n## 문진 응답\n"
        key_items = ['weight_change', 'exercise_frequency', 'family_history', 'smoking', 'drinking', 
                     'sleep_hours', 'stress_level', 'cancer_history', 'hepatitis_carrier']
        for key in key_items:
            value = survey_responses.get(key)
            if value:
                key_name_map = {
                    'weight_change': '체중 변화',
                    'exercise_frequency': '운동 빈도',
                    'family_history': '가족력',
                    'smoking': '흡연',
                    'drinking': '음주',
                    'sleep_hours': '수면 시간',
                    'stress_level': '스트레스 수준',
                    'cancer_history': '암 병력',
                    'hepatitis_carrier': '간염 보균자 여부'
                }
                survey_section += f"- {key_name_map.get(key, key)}: {value}\n"
    
    # [신규] 행동 기반 진심도 분석 (Behavioral Signals)
    behavior_section = ""
    user_attributes = (survey_responses or {}).get('user_attributes', [])
    if user_attributes:
        behavior_section = generate_behavior_section(user_attributes)

    # 일반검진 항목 섹션만 포함 (Priority 1 전용)
    hospital_items_section = ""
    if hospital_national_checkup:
        hospital_items_section = "\n## 병원 기본 검진 항목\n"
        hospital_items_section += "다음 항목들은 기본 검진에 포함되어 있습니다:\n"
        item_names = []
        for item in hospital_national_checkup:
            if isinstance(item, dict):
                item_names.append(item.get('item_name', ''))
            elif isinstance(item, str):
                item_names.append(item)
            else:
                item_names.append(str(item))
        hospital_items_section += ", ".join(item_names[:20])
        if len(hospital_national_checkup) > 20:
            hospital_items_section += f" 외 {len(hospital_national_checkup) - 20}개"
        hospital_items_section += "\n"
    
    # 프롬프트 조합
    prompt_parts = []
    
    # 0-1. System Instruction (절대 규칙)
    system_instruction = """
# 🛑 SYSTEM INSTRUCTION (절대 규칙)

1. **역할 정의 (Summary & Guide)**: 당신은 진단을 내리는 의사가 아니라, **검진 결과지를 해석해주는 코디네이터**입니다.
   - ❌ 금지: "심각한 상태입니다", "치료가 시급합니다", "수치가 엉망입니다" (판단/평가 금지)
   - ✅ 권장: "이 항목은 간 건강을 나타내므로 주의 깊게 보셔야 합니다", "과거에 높게 나왔으니 이번에도 확인해보세요" (가이드)

2. **재분석 금지**: 제공된 [STEP 1 분석 결과]는 이미 확정된 사실(Fact)입니다. 이를 다시 분석하거나 비판하지 말고, 오직 **검진 항목 매핑**에만 집중하세요.

3. **한국 검진 기준 엄수**:
   - ❌ 금지: 미국질병예방서비스위원회(USPSTF), FDA, CDC 등 해외 기준 인용 절대 금지.
   - ✅ 필수: 오직 **[Critical Evidence]**에 있는 **한국 국가건강검진 가이드라인**과 **대한의학회 기준**만 사용하세요.

4. **Evidence 인용 규칙**:
   - '미국...', '해외...' 같은 단어가 나오면 즉시 삭제하고 한국 기준으로 대체하세요.
   - 만약 한국 기준이 없다면, 일반적인 의학 상식("간 수치는 간 손상 여부를 나타냅니다")으로 서술하세요.

5. **행동 데이터 활용 (Behavioral Context)**:
   - [Behavioral Signals] 섹션에 있는 사용자의 진심도(Sincerity)와 고민 흔적(Hesitation)을 참고하여, **사용자가 진지하게 고민한 항목(가족력, 특정 질환 등)을 Priority 1 추천 사유에 자연스럽게 녹여내세요.**
   - 예: "특히 가족력 부분에서 깊이 고민하신 점을 고려하여..."
"""
    prompt_parts.append(system_instruction)

    # 0-2. RAG Evidence (Critical Evidence)
    if rag_evidence_context:
        rag_evidence_section = f"""
# [Critical Evidence: 검색된 의학 가이드라인] ⭐ 최우선 근거

**⚠️ 매우 중요: 아래 인용구를 그대로 사용하세요. "Level A 에비던스" 같은 메타 정보만 나열 금지!**

{rag_evidence_context}

**Evidence & Citation Rules (RAG Mode - 인용구 필수):**

1. **위 인용구를 그대로 복사하여 사용하세요.**
   - ✅ 올바른 예: "2025 당뇨병 진료지침에 따르면 '직계 가족(부모, 형제자매)에 당뇨병이 있는 경우 19세 이상의 모든 성인은 당뇨병 선별검사를 받아야 한다'고 명시되어 있습니다."
   - ❌ 잘못된 예: "※ 대한당뇨학회 가이드라인, Level A 에비던스"

2. **[문서명]에 따르면 '인용구' 형식을 반드시 사용하세요.**

3. **절대 금지 표현:**
   - "Level A", "Level B" 등 에비던스 레벨만 나열
   - "42페이지", "제3장" 등 페이지/섹션 번호만 언급

4. **외부 지식보다 위 인용구가 최우선입니다.**

---
"""
        prompt_parts.append(rag_evidence_section)
    else:
        # RAG 실패 시 Master Knowledge 사용
        master_knowledge_section = build_master_knowledge_section()
        prompt_parts.append(master_knowledge_section)

    # 1. Role & Tone
    prompt_parts.append("""

# 🎯 Role (당신의 역할)

당신은 대학병원 검진센터장이자 예방의학 전문의입니다.
단순히 검사를 파는 것이 아니라, 환자의 **'생애 주기별 건강 자산 관리자'**로서 행동합니다.

---

# 🚫 Tone & Manner (화법 및 금지어) - 매우 중요 ⭐

## 1. 공포 마케팅 절대 금지
❌ 금지어: "돌연사", "급사", "사망 위험", "죽을 수 있습니다"
✅ 대체어: "조기 발견의 골든타임", "숨은 위험 확인", "예방적 투자"

## 2. 단조로움 타파 ⭐ 핵심
🚫 문장 구조 반복 금지: "A검사는 기본입니다. 하지만 B검사가 필요합니다."

✅ 5가지 스타일을 순환 적용하세요:
1. 통계/팩트시트형: "2025 통계를 보면..."
2. 환자 문진 연결형: "아까 말씀하신 두통 증세는..."
3. 최신 트렌드형: "요즘은 단순 초음파 대신..."
4. 질문형: "알고 계셨나요?"
5. 시나리오형: "40대 남성 A씨는..."

## 3. 스토리텔링 (Connect the Dots) ⭐
장기별 독립 설명 금지 → 연결고리 중심 설명 필수

---

# 📋 Context (이전 단계 분석 결과)

""")
    
    prompt_parts.append(step1_context)
    prompt_parts.append("\n---\n")
    
    # 데이터 섹션들 추가
    prompt_parts.append(patient_info)
    prompt_parts.append(health_data_section)
    prompt_parts.append(prescription_section)
    prompt_parts.append(concerns_section)
    prompt_parts.append(survey_section)
    prompt_parts.append(behavior_section) # 행동 데이터 추가
    prompt_parts.append(hospital_items_section)
    
    # Priority 1 전용 Task 및 JSON 스키마
    prompt_parts.append("""

# 🎯 Task - Priority 1 항목 선정 (매핑 작업)

**이번 프롬프트는 Priority 1 (일반검진 주의 항목)만 생성합니다.**

STEP 1에서 분석된 위험 요인과 **사용자의 행동 패턴(Behavioral Signals)**을 고려하여, **최우선 검진 항목 1~3개**를 선정하세요.
(주의: 새로운 검사를 추가하는 게 아니라, **기본 검진표에 있는 항목 중** 무엇을 눈여겨봐야 하는지 짚어주는 것입니다.)

## ⚠️ 필수 검증 리스트
1. **한국 기준**: 미국/해외 기준이 포함되지 않았는가?
2. **가족력 확인**: 당뇨/고혈압/암 가족력이 있다면 해당 검사가 포함되었는가?
3. **증거 인용**: 모든 항목의 `why_important`에 [Critical Evidence]의 문장이 그대로 인용되었는가?
4. **행동 반영**: 사용자가 진심으로 고민한 흔적(Sincerity High)이 있다면, 해당 항목 설명에 "고민하신 부분"임을 언급했는가?

---

# Output Format (JSON) - Priority 1 전용

**오직 아래 JSON만 생성하세요:**

{
  "summary": {
    "key_health_issues": ["혈압 경계", "허리둘레 증가"],
    "family_history_concerns": ["당뇨", "심장질환"],
    "lifestyle_factors": ["흡연 중", "음주 주 2회"]
  },
  "priority_1": {
    "title": "이번 검진 시 유의 깊게 보실 항목이에요",
    "description": "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다.",
    "items": ["혈압측정", "혈당검사"],
    "count": 2,
    "focus_items": [
      {
        "name": "혈압측정",
        "why_important": "고혈압 가족력이 있고 과거 검진에서 경계 수치를 보였으므로, 이번 검진에서도 수치 변화를 확인해야 합니다. (설문 작성 시 이 부분에서 고민하신 흔적도 반영했습니다.)",
        "check_point": "수축기 140mmHg, 이완기 90mmHg 미만인지 확인하세요."
      }
    ]
  }
}

**중요:**
- Priority 2, 3, strategies, doctor_comment 등은 생성하지 마세요
- 오직 summary와 priority_1만 생성하세요
- priority_1.items와 focus_items의 항목명은 정확히 일치해야 합니다

---

**반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요.**
다른 설명이나 주석은 포함하지 마세요.
""")
    
    prompt = "\n".join(prompt_parts)
    
    print(f"[INFO] ✅ STEP 2-1 프롬프트 생성 완료 - 길이: {len(prompt):,}자")
    
    # RAG Context 원문도 함께 반환하여 Step 2-2에서 재사용
    return prompt, structured_evidences, rag_evidence_context
