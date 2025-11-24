"""
검진 설계 전용 GPT 프롬프트 템플릿
프롬프트가 생명이므로 신중하게 작성
"""
from typing import List, Dict, Any, Optional
import json
from datetime import datetime

# 시스템 메시지 (검진 설계 전문가 역할 정의)
CHECKUP_DESIGN_SYSTEM_MESSAGE = """당신은 대한민국의 전문 검진 설계 의료진입니다. 
환자의 건강검진 이력, 약물 복용 이력, 그리고 선택한 염려 항목을 종합적으로 분석하여 
개인 맞춤형 검진 계획을 수립해야 합니다.

**당신의 역할:**
1. 환자의 최근 3년간 검진 결과를 분석하여 정상이 아닌 항목을 파악
2. 약물 복용 이력과 관련된 검진 항목을 추천
3. 환자의 연령, 성별에 따른 권장 검진 항목을 제안
4. 사용자가 선택한 염려 항목에 대한 정밀 검진을 우선 추천
5. 의학적으로 정확하고 환자가 이해하기 쉬운 언어로 설명

**응답 규칙:**
- 반드시 JSON 형식으로 응답해야 합니다
- 모든 검진 항목은 실제로 존재하는 검진 항목이어야 합니다
- 추천 이유는 구체적이고 명확해야 합니다
- 의사 추천 메시지는 환자의 실제 데이터를 기반으로 작성해야 합니다
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요
- 의학 용어는 정확하되, 환자가 이해할 수 있도록 설명을 추가하세요"""

def create_checkup_design_prompt(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]]
) -> str:
    """
    검진 설계를 위한 GPT 프롬프트 생성
    
    Args:
        patient_name: 환자 이름
        patient_age: 환자 나이
        patient_gender: 환자 성별 (M/F)
        health_data: 최근 3년간 건강검진 데이터
        prescription_data: 약물 복용 이력 데이터
        selected_concerns: 사용자가 선택한 염려 항목 리스트
    
    Returns:
        GPT 프롬프트 문자열
    """
    
    # 환자 정보 섹션
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"
    
    # 최근 3년간 검진 이력 섹션
    health_data_section = "## 최근 3년간 건강검진 이력\n\n"
    if health_data and len(health_data) > 0:
        formatted_health_data = []
        for checkup in health_data[:10]:  # 최대 10개만 (토큰 절약)
            checkup_info = {
                "검진일": checkup.get("checkup_date") or checkup.get("CheckUpDate") or "",
                "병원": checkup.get("location") or checkup.get("Location") or "",
                "년도": checkup.get("year") or ""
            }
            
            # 정상이 아닌 항목만 추출 (토큰 절약)
            abnormal_items = []
            raw_data = checkup.get("raw_data") or {}
            if raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:3]:  # 최대 3개 검사만
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:3]:  # 최대 3개 질환만
                            if illness.get("Items"):
                                for item in illness["Items"][:5]:  # 최대 5개 항목만
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    
                                    # 정상이 아닌 항목만 포함 (ItemReferences 확인)
                                    if item.get("ItemReferences"):
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            # 정상(A)이 아닌 경우만 포함
                                            if "정상(A)" not in ref_name and "정상" not in ref_name:
                                                abnormal_items.append({
                                                    "항목명": item_name,
                                                    "수치": item_value,
                                                    "상태": ref_name
                                                })
                                                break
            
            if abnormal_items:
                checkup_info["이상항목"] = abnormal_items
                formatted_health_data.append(checkup_info)
        
        if formatted_health_data:
            health_data_section += json.dumps(formatted_health_data, ensure_ascii=False, indent=2)
        else:
            health_data_section += "정상이 아닌 항목이 없습니다.\n"
    else:
        health_data_section += "검진 이력이 없습니다.\n"
    
    # 약물 복용 이력 섹션
    prescription_section = "## 약물 복용 이력\n\n"
    if prescription_data and len(prescription_data) > 0:
        formatted_prescriptions = []
        for prescription in prescription_data[:10]:  # 최대 10개만
            raw_data = prescription.get("raw_data") or {}
            medications = []
            
            if raw_data.get("Items"):
                for item in raw_data["Items"][:5]:  # 최대 5개 약물만
                    drug_name = item.get("DrugName") or item.get("MedicationName") or ""
                    start_date = item.get("StartDate") or ""
                    end_date = item.get("EndDate") or ""
                    
                    if drug_name:
                        medications.append({
                            "약물명": drug_name,
                            "복용기간": f"{start_date} ~ {end_date if end_date else '현재'}"
                        })
            
            if medications:
                formatted_prescriptions.append({
                    "처방일": prescription.get("PrescriptionDate") or prescription.get("prescription_date") or "",
                    "병원": raw_data.get("Location") or prescription.get("location") or "",
                    "약물": medications
                })
        
        if formatted_prescriptions:
            prescription_section += json.dumps(formatted_prescriptions, ensure_ascii=False, indent=2)
        else:
            prescription_section += "약물 복용 이력이 없습니다.\n"
    else:
        prescription_section += "약물 복용 이력이 없습니다.\n"
    
    # 선택한 염려 항목 섹션 (가장 중요!)
    concerns_section = "## 사용자가 선택한 염려 항목\n\n"
    if selected_concerns and len(selected_concerns) > 0:
        formatted_concerns = []
        for concern in selected_concerns:
            concern_type = concern.get("type") or ""
            if concern_type == "checkup":
                formatted_concerns.append({
                    "유형": "검진 항목",
                    "항목명": concern.get("name") or concern.get("item_name") or "",
                    "검진일": concern.get("date") or concern.get("checkup_date") or "",
                    "수치": f"{concern.get('value') or ''} {concern.get('unit') or ''}",
                    "상태": "경계" if concern.get("status") == "warning" else "이상",
                    "병원": concern.get("location") or ""
                })
            elif concern_type == "hospital":
                formatted_concerns.append({
                    "유형": "병원",
                    "병원명": concern.get("hospitalName") or concern.get("hospital_name") or "",
                    "검진일": concern.get("checkupDate") or concern.get("checkup_date") or "",
                    "이상항목수": concern.get("abnormalCount") or 0,
                    "경계항목수": concern.get("warningCount") or 0
                })
            elif concern_type == "medication":
                formatted_concerns.append({
                    "유형": "약물",
                    "약물명": concern.get("medicationName") or concern.get("medication_name") or "",
                    "복용기간": concern.get("period") or "",
                    "병원": concern.get("hospitalName") or concern.get("hospital_name") or ""
                })
        
        concerns_section += json.dumps(formatted_concerns, ensure_ascii=False, indent=2)
        concerns_section += "\n\n**중요:** 위 염려 항목들은 사용자가 직접 선택한 항목입니다. 이 항목들과 관련된 정밀 검진을 우선적으로 추천해야 합니다."
    else:
        concerns_section += "선택한 염려 항목이 없습니다.\n"
    
    # 최종 프롬프트 조합
    prompt = f"""{patient_info}

{health_data_section}

{prescription_section}

{concerns_section}

---

## 요청사항

위 정보를 종합적으로 분석하여 다음 JSON 형식으로 검진 계획을 제안해주세요:

```json
{{
  "recommended_items": [
    {{
      "category": "카테고리명 (예: 대장검사, CT검사, MRI검사 등)",
      "category_en": "영문 카테고리명",
      "itemCount": 카테고리별 항목 개수,
      "items": [
        {{
          "name": "검진 항목명 (한글)",
          "nameEn": "검진 항목명 (영문)",
          "description": "검진에 대한 간단한 설명 (환자가 이해하기 쉽게)",
          "reason": "이 검진을 추천하는 구체적인 이유 (환자의 실제 데이터를 기반으로)",
          "priority": 우선순위 (1-5, 1이 가장 높음),
          "recommended": true
        }}
      ],
      "doctor_recommendation": {{
        "has_recommendation": true/false,
        "message": "의사 추천 메시지 (환자의 실제 데이터를 기반으로 구체적으로 작성)",
        "highlighted_text": "강조할 텍스트 (메시지 내에서)"
      }},
      "defaultExpanded": true/false
    }}
  ],
  "analysis": "환자의 건강 상태에 대한 종합적인 의학적 분석 (2-3문단)",
  "total_count": 전체 추천 검진 항목 개수
}}
```

**응답 규칙:**
1. **카테고리 분류**: 검진 항목을 논리적으로 카테고리별로 분류하세요 (예: 대장검사, CT검사, MRI검사, 초음파검사, 혈액검사 등)
2. **우선순위**: 사용자가 선택한 염려 항목과 직접 관련된 검진을 우선순위 1로 설정하세요
3. **추천 이유**: 각 검진 항목의 추천 이유는 반드시 환자의 실제 데이터(검진 결과, 약물 이력, 선택한 염려 항목)를 언급해야 합니다
4. **의사 추천 메시지**: 카테고리별로 의사 추천 메시지를 작성하되, 환자의 실제 검진 결과나 약물 이력을 구체적으로 언급해야 합니다
5. **의학적 정확성**: 모든 검진 항목은 실제로 존재하는 검진이어야 하며, 의학적으로 타당한 추천이어야 합니다
6. **이해하기 쉬운 언어**: 의학 용어를 사용하되, 환자가 이해할 수 있도록 설명을 추가하세요
7. **개수 제한**: 전체 추천 항목은 5-15개 정도로 제한하세요 (너무 많으면 부담스러움)

반드시 JSON 형식으로만 응답하고, 다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt

