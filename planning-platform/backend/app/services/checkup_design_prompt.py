"""
검진 설계 전용 GPT 프롬프트 템플릿
프롬프트가 생명이므로 신중하게 작성
"""
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, timedelta

# 시스템 메시지 (검진 설계 전문가 역할 정의)
CHECKUP_DESIGN_SYSTEM_MESSAGE = """당신은 대한민국 최고의 대학병원 검진 센터장이자, 환자의 데이터를 꿰뚫어 보는 '헬스 큐레이터'입니다.

당신의 목표는 환자에게 **"가장 효율적이고 빈틈없는 검진 플랜"**을 제안하는 것입니다.

**핵심 작성 원칙 (The Bridge Strategy):**

1. **기본 검진(국가/일반)의 존중:** 먼저 무료로 받을 수 있는 기본 검진 항목에서 환자가 '눈여겨봐야 할 수치'가 무엇인지 짚어주세요. 일반검진은 기본적으로 받으시지만, 특히 주의깊게 확인해야 할 항목이 있다는 관점으로 접근하세요.

2. **사각지대(Gap) 조명:** 기본 검진만으로는 확인할 수 없는 '의학적 한계'를 환자의 데이터(증상, 가족력)와 연결하여 설명하세요. "하지만 이것만으로는 부족합니다"라는 자연스러운 전환을 만들어주세요.

3. **자연스러운 업셀링:** 그 한계를 극복하기 위해 병원의 정밀 검진(비급여 항목)이 왜 필수적인지 '투자 가치' 관점에서 설득하세요. "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요.

**당신의 핵심 역할:**
1. **과거 검진 데이터 분석**: 정상/경계/이상 항목을 명확히 구분하고, 특히 **안 좋았던 항목(이상/경계)**을 중점적으로 파악
2. **문진 데이터와 연관 분석**: 과거에는 정상이었지만 문진 내용(체중 변화, 운동 부족, 가족력, 흡연, 음주 등)상 **추이를 봐야 할 항목** 식별
3. **사용자 선택 항목의 맥락**: 사용자가 직접 선택한 염려 항목의 맥락을 깊이 있게 분석하고, 왜 이 항목을 선택했는지 이해
4. **나이별 권장 검진과 매칭**: 환자 나이에 맞는 권장 검진 중에서 과거 이력, 문진, 선택 항목이 모두 매칭되는 항목을 우선 추천
5. **맥락 기반 추천**: 모든 추천은 "과거 검진에서 XX가 경계였고, 문진에서 YY를 확인했으며, 사용자가 ZZ를 선택했으므로..." 형식으로 맥락을 명확히 설명
6. **업셀링 최적화**: 맥락이 명확하고 설득력 있는 추천을 통해 환자가 검진을 받고 싶게 만드는 것이 목표

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- "비쌉니다" 대신 "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요
- "추천합니다" 대신 "완벽한 안심을 위해 필요합니다"라는 표현을 사용하세요
- "필요합니다" 대신 "놓치면 위험할 수 있습니다"라는 표현을 사용하세요

**응답 규칙:**
- 반드시 JSON 형식으로 응답해야 합니다
- 모든 검진 항목은 실제로 존재하는 검진 항목이어야 합니다
- **추천 이유는 구체적이고 명확해야 하며, 의학적 근거를 포함해야 합니다**
- **각 추천 항목에 대해 참고한 의학 자료, 가이드라인, 연구 결과를 명시해야 합니다**
- 의사 추천 메시지는 환자의 실제 데이터를 기반으로 작성해야 합니다
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요
- 의학 용어는 정확하되, 환자가 이해할 수 있도록 설명을 추가하세요
- **가능한 경우 최신 의학 가이드라인(대한의학회, 질병관리청 등)을 참고하세요**"""

def create_checkup_design_prompt(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None
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
    
    # 현재 날짜 계산 (최근 5년 기준)
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)  # 약 5년 전
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
    
    # 최근 5년간 검진 이력 섹션 (날짜 기준 필터링)
    health_data_section = f"## 최근 5년간 건강검진 이력 ({five_years_ago_str} ~ {current_date_str})\n\n"
    if health_data and len(health_data) > 0:
        formatted_health_data = []
        recent_count = 0
        old_count = 0
        
        for checkup in health_data[:20]:  # 최대 20개 (최근 5년 데이터 포함)
            # 검진 날짜 파싱 및 비교
            checkup_date_str = checkup.get("checkup_date") or checkup.get("CheckUpDate") or ""
            checkup_year = checkup.get("year") or ""
            
            # 날짜 파싱 시도
            checkup_date_obj = None
            if checkup_date_str:
                try:
                    # 다양한 날짜 형식 시도
                    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y년 %m월 %d일"]:
                        try:
                            checkup_date_obj = datetime.strptime(checkup_date_str, fmt)
                            break
                        except:
                            continue
                except:
                    pass
            
            # 년도로만 비교 (날짜 파싱 실패 시)
            if not checkup_date_obj and checkup_year:
                try:
                    checkup_year_int = int(checkup_year)
                    current_year = today.year
                    if current_year - checkup_year_int > 5:
                        old_count += 1
                        continue  # 5년 이상 오래된 데이터는 제외
                except:
                    pass
            
            # 날짜 객체가 있으면 정확히 비교
            if checkup_date_obj:
                if checkup_date_obj < five_years_ago:
                    old_count += 1
                    continue  # 5년 이상 오래된 데이터는 제외
                recent_count += 1
            checkup_info = {
                "검진일": checkup.get("checkup_date") or checkup.get("CheckUpDate") or "",
                "병원": checkup.get("location") or checkup.get("Location") or "",
                "년도": checkup.get("year") or ""
            }
            
            # 정상/경계/이상 항목 모두 추출 (과거 결과 분석용)
            all_items = []
            normal_items = []
            warning_items = []
            abnormal_items = []
            raw_data = checkup.get("raw_data") or {}
            if raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:  # 최대 5개 검사
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:  # 최대 5개 질환
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:  # 최대 10개 항목
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    
                                    # ItemReferences 확인하여 상태 분류
                                    if item.get("ItemReferences"):
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            item_info = {
                                                "항목명": item_name,
                                                "수치": item_value,
                                                "상태": ref_name
                                            }
                                            
                                            # 정상(A) - 정상
                                            if "정상(A)" in ref_name:
                                                normal_items.append(item_info)
                                                all_items.append({**item_info, "분류": "정상"})
                                                break
                                            # 정상(B) 또는 경계 - 경계
                                            elif "정상(B)" in ref_name or "경계" in ref_name:
                                                warning_items.append(item_info)
                                                all_items.append({**item_info, "분류": "경계"})
                                                break
                                            # 질환의심 또는 이상 - 이상
                                            elif "질환의심" in ref_name or "이상" in ref_name:
                                                abnormal_items.append(item_info)
                                                all_items.append({**item_info, "분류": "이상"})
                                                break
            
            # 정상/경계/이상 항목 모두 포함 (안 좋았던 항목 우선 표시)
            if all_items:
                checkup_info["전체항목"] = {
                    "이상": abnormal_items[:10],  # 이상 항목 우선 (최대 10개)
                    "경계": warning_items[:10],  # 경계 항목 다음 (최대 10개)
                    "정상": normal_items[:5]  # 정상 항목은 최소한만 (최대 5개)
                }
                checkup_info["항목요약"] = f"이상 {len(abnormal_items)}개, 경계 {len(warning_items)}개, 정상 {len(normal_items)}개"
                checkup_info["주의필요"] = f"이상 항목 {len(abnormal_items)}개와 경계 항목 {len(warning_items)}개는 특히 주의 깊게 분석해야 합니다"
                formatted_health_data.append(checkup_info)
        
        if formatted_health_data:
            health_data_section += json.dumps(formatted_health_data, ensure_ascii=False, indent=2)
            health_data_section += f"\n\n**참고:** 최근 5년 내 검진 데이터 {recent_count}건이 포함되었습니다."
            if old_count > 0:
                health_data_section += f" (5년 이상 오래된 데이터 {old_count}건은 제외되었습니다.)"
            health_data_section += "\n\n**가장 중요:** "
            health_data_section += "1) 이상/경계 항목(안 좋았던 것들)을 중점적으로 분석하세요. "
            health_data_section += "2) 정상 항목 중에서도 문진 내용상 추이를 봐야 할 항목을 식별하세요. "
            health_data_section += "3) 모든 분석은 맥락을 명확히 하세요 (과거 결과 + 문진 + 선택 항목의 연관성)."
        else:
            if old_count > 0:
                health_data_section += f"최근 5년 내 검진 이력이 없습니다. (5년 이상 오래된 데이터 {old_count}건은 제외되었습니다.)\n"
            else:
                health_data_section += "검진 이력이 없습니다.\n"
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
        concerns_section += "\n\n**특별 요청:** 각 선택한 항목에 대해 최근 5년간의 추이를 분석하고, 해당 항목과 관련된 검진을 별도 섹션으로 구성하여 상세히 설명해주세요."
    else:
        concerns_section += "선택한 염려 항목이 없습니다.\n"
    
    # 설문 응답 섹션
    survey_section = "## 추가 설문 응답\n\n"
    if survey_responses and len(survey_responses) > 0:
        survey_data = {}
        
        # 체중 변화
        weight_change_map = {
            "increase_more": "증가 (3kg 이상)",
            "increase_some": "약간 증가 (1-3kg)",
            "maintain": "유지",
            "decrease_some": "약간 감소 (1-3kg)",
            "decrease_more": "감소 (3kg 이상)"
        }
        if survey_responses.get("weight_change"):
            survey_data["최근 체중 변화"] = weight_change_map.get(survey_responses["weight_change"], survey_responses["weight_change"])
        
        # 운동 빈도
        exercise_map = {
            "regular": "규칙적으로 운동함 (주 3회 이상)",
            "sometimes": "가끔 운동함 (주 1-2회)",
            "rarely": "거의 안 함",
            "never": "전혀 안 함"
        }
        if survey_responses.get("exercise_frequency"):
            survey_data["운동 빈도"] = exercise_map.get(survey_responses["exercise_frequency"], survey_responses["exercise_frequency"])
        
        # 가족력
        family_history_map = {
            "hypertension": "고혈압",
            "diabetes": "당뇨병",
            "heart_disease": "심장질환",
            "cancer": "암",
            "stroke": "뇌졸중",
            "none": "없음"
        }
        if survey_responses.get("family_history"):
            family_history_list = survey_responses["family_history"]
            if isinstance(family_history_list, list):
                survey_data["가족력"] = [family_history_map.get(fh, fh) for fh in family_history_list if fh != "none"]
                if "none" in family_history_list:
                    survey_data["가족력"] = ["없음"]
        
        # 흡연
        smoking_map = {
            "non_smoker": "비흡연",
            "ex_smoker": "과거 흡연 (금연)",
            "current_smoker": "현재 흡연"
        }
        if survey_responses.get("smoking"):
            survey_data["흡연"] = smoking_map.get(survey_responses["smoking"], survey_responses["smoking"])
        
        # 음주
        drinking_map = {
            "never": "전혀 안 함",
            "monthly_less": "월 1회 미만",
            "monthly_1_2": "월 1-2회",
            "weekly_1_2": "주 1-2회",
            "weekly_3plus": "주 3회 이상"
        }
        if survey_responses.get("drinking"):
            survey_data["음주 빈도"] = drinking_map.get(survey_responses["drinking"], survey_responses["drinking"])
        
        # 수면 시간
        sleep_map = {
            "less_5": "5시간 미만",
            "5_6": "5-6시간",
            "6_7": "6-7시간",
            "7_8": "7-8시간",
            "more_8": "8시간 이상"
        }
        if survey_responses.get("sleep_hours"):
            survey_data["수면 시간"] = sleep_map.get(survey_responses["sleep_hours"], survey_responses["sleep_hours"])
        
        # 스트레스 수준
        stress_map = {
            "very_high": "매우 높음",
            "high": "높음",
            "medium": "보통",
            "low": "낮음",
            "very_low": "매우 낮음"
        }
        if survey_responses.get("stress_level"):
            survey_data["스트레스 수준"] = stress_map.get(survey_responses["stress_level"], survey_responses["stress_level"])
        
        # 추가 고민사항
        if survey_responses.get("additional_concerns"):
            survey_data["추가 고민사항"] = survey_responses["additional_concerns"]
        
        if survey_data:
            survey_section += json.dumps(survey_data, ensure_ascii=False, indent=2)
            survey_section += "\n\n**가장 중요:** 위 설문 응답은 환자의 최근 생활 패턴과 건강 상태를 나타냅니다. "
            survey_section += "이 정보를 바탕으로 **과거에는 정상이었지만 문진 내용상 추이를 봐야 할 항목**을 식별하세요. "
            survey_section += "예: 체중 증가 + 운동 부족 → 대사증후군 관련 검사, 가족력 → 해당 질환 관련 검사, 흡연 → 폐/심혈관 검사 등"
        else:
            survey_section += "설문 응답이 없습니다.\n"
    else:
        survey_section += "설문 응답이 없습니다.\n"
    
    # 병원별 검진 항목 섹션
    hospital_checkup_section = ""
    if hospital_national_checkup or hospital_recommended or hospital_external_checkup:
        hospital_checkup_section = "## 병원별 검진 항목 정보\n\n"
        
        if hospital_national_checkup:
            hospital_checkup_section += "### 일반검진(의무검진) 항목:\n"
            hospital_checkup_section += json.dumps(hospital_national_checkup, ensure_ascii=False, indent=2)
            hospital_checkup_section += "\n\n**가장 중요:** 일반검진 항목은 의무검진이므로 결과지를 확인하실 때, "
            hospital_checkup_section += "과거 결과(특히 안 좋았던 항목)와 문진 내용, 선택한 항목의 맥락과 매칭되면 "
            hospital_checkup_section += "**'이 이유 때문에 잘 살펴보세요'**라는 친근한 관점으로 소개하세요. "
            hospital_checkup_section += "형식: '일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 이 부분은 특히 눈여겨보시면 좋겠어요.' "
            hospital_checkup_section += "절대 '추천 항목', '기본검진 외에 이것도 더 자세히 보는 것이 좋을 것 같습니다', '꼭 체크하셔야 합니다' 같은 딱딱한 표현을 사용하지 마세요. "
            hospital_checkup_section += "친근하고 자연스러운 표현을 사용하세요: '잘 보시길 바랍니다', '눈여겨보세요', '이 부분은 잘 봐주세요', '이유를 알려드리니' "
            hospital_checkup_section += "이 맥락을 basic_checkup_guide.focus_items와 summary.priority_1.national_checkup_note에 명확히 작성하세요.\n\n"
        
        if hospital_recommended:
            hospital_checkup_section += "### 병원 추천(업셀링) 항목:\n"
            hospital_checkup_section += json.dumps(hospital_recommended, ensure_ascii=False, indent=2)
            hospital_checkup_section += "\n\n**가장 중요:** 병원 추천 항목은 2순위에 포함하되, "
            hospital_checkup_section += "**맥락이 명확한 항목을 우선 추천**하세요: "
            hospital_checkup_section += "과거 이력(안 좋았던 항목) + 문진(추이를 봐야 할 항목) + 선택 항목의 맥락 + 나이별 권장 검진이 모두 매칭되는 항목을 추천하면 업셀링 효과가 높습니다.\n\n"
        
        if hospital_external_checkup:
            hospital_checkup_section += "### 외부 검사 항목 (정밀 검진):\n"
            hospital_checkup_section += json.dumps(hospital_external_checkup, ensure_ascii=False, indent=2)
            hospital_checkup_section += "\n\n**가장 중요:** 외부 검사 항목은 병원에서 제공하는 정밀 검진으로, "
            hospital_checkup_section += "**난이도/비용에 따라 Low(부담없는), Mid(추천), High(프리미엄)로 분류**됩니다. "
            hospital_checkup_section += "각 항목은 target_trigger(추천 대상), gap_description(결핍/한계), solution_narrative(설득 논리)를 포함하고 있습니다. "
            hospital_checkup_section += "환자의 상황과 매칭되는 항목을 우선 추천하되, The Bridge Strategy를 적용하여 자연스럽게 업셀링하세요.\n\n"
    
    # 최종 프롬프트 조합
    prompt = f"""{patient_info}

{health_data_section}

{prescription_section}

{concerns_section}

{survey_section}

{hospital_checkup_section}

---

## 요청사항

위 정보를 종합적으로 분석하여 다음 JSON 형식으로 검진 계획을 제안해주세요:

```json
{{
  "patient_summary": "환자의 건강 상태와 주요 리스크를 3줄로 요약 (스토리텔링 도입부)",
  
  "basic_checkup_guide": {{
    "title": "일반검진, 이 부분은 잘 보세요",
    "description": "일반검진 결과지를 확인하실 때, {{patient_name}}님의 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다.",
    "focus_items": [
      {{
        "item_name": "공복혈당 (Diabetes)",
        "why_important": "3년 전부터 수치가 95-99 사이로, 당뇨 전단계 경계선에 있어서요.",
        "check_point": "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요."
      }}
    ]
  }},
  
  "selected_concerns_analysis": [
    {{
      "concern_name": "선택한 항목명 (예: 혈압, 혈당, 특정 약물 등)",
      "concern_type": "checkup|medication|hospital",
      "trend_analysis": "최근 5년간의 추이 분석 (수치 변화, 패턴, 위험도 등)",
      "reflected_in_design": "이 항목을 검진 설계에 어떻게 반영했는지 구체적으로 설명",
      "related_items": ["이 항목과 관련된 추천 검진 항목 ID 리스트"]
    }}
  ],
  "summary": {{
    "past_results_summary": "과거 검진 결과 요약 (정상/경계/이상 항목 중심으로)",
    "survey_summary": "문진 내용 요약 (체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)",
    "correlation_analysis": "과거 결과와 문진 내용의 연관성 분석 및 주의사항",
    "priority_1": {{
      "title": "1순위: 필수 검진 항목",
      "description": "과거 검진에서 안 좋았던 항목(이상/경계) + 문진에서 추이를 봐야 할 항목 + 사용자가 선택한 항목의 맥락을 종합하여 반드시 받아야 하는 검진. 나이별 권장 검진 중에서도 위 조건이 매칭되는 항목 포함",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수,
      "national_checkup_items": ["일반검진 항목명 1", "일반검진 항목명 2"],
      "national_checkup_note": "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 맥락: [구체적인 이유를 친근하게 설명]"
    }},
    "priority_2": {{
      "title": "2순위: 병원 추천 검진 항목",
      "description": "병원에서 추천하는 특화 검진 항목 (업셀링 위주). 나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 매칭되는 항목을 맥락과 함께 추천",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수,
      "upselling_focus": true
    }},
    "priority_3": {{
      "title": "3순위: 선택 검진 항목",
      "description": "선택적으로 받을 수 있는 검진 항목 (예방 차원, 추가 확인)",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수
    }}
  }},
  "strategies": [
    {{
      "strategy_title": "매력적인 전략 제목 (예: 침묵의 장기, 췌장까지 완벽하게)",
      "related_concern": "환자가 선택한 염려 항목 or 문진 증상",
      "priority": 1,
      "bridging_narrative": {{
        "step1_anchor": "올해 대상이신 일반검진의 [항목명]으로 [확인 가능한 내용]을 보는 것은 매우 중요합니다.",
        "step2_gap": "하지만 [항목명]은 [구체적 한계]만 보여줄 뿐, [확인 불가능한 내용]은 알 수 없는 '반쪽짜리 확인'입니다.",
        "step3_patient_context": "특히 환자분의 [구체적 증상/가족력/이력]을 고려할 때, 이 부분을 놓치면 [구체적 위험]이 있습니다.",
        "step4_offer": "따라서 [정밀검진명]을 더해 '[확인 가능한 내용]'과 '[추가 확인 내용]'을 동시에 확인해야 완벽한 안심이 가능합니다."
      }},
      "recommended_item": {{
        "name": "복부 조영 CT",
        "category": "소화기 정밀",
        "is_upselling": true,
        "reason_summary": "초음파로 보기 힘든 췌장/담낭의 미세 병변 확인",
        "hospital_advantage": "본 병원의 128채널 CT로 1mm 크기의 병변도 찾아낼 수 있습니다."
      }}
    }}
  ],
  
  "recommended_items": [
    {{
      "category": "카테고리명 (예: 대장검사, CT검사, MRI검사 등)",
      "category_en": "영문 카테고리명",
      "itemCount": 카테고리별 항목 개수,
      "priority_level": 1 또는 2 또는 3,
      "priority_description": "이 카테고리가 해당 우선순위인 이유 설명",
      "items": [
        {{
          "name": "검진 항목명 (한글)",
          "nameEn": "검진 항목명 (영문)",
          "description": "검진에 대한 간단한 설명 (환자가 이해하기 쉽게)",
          "reason": "이 검진을 추천하는 구체적인 이유 - 맥락을 명확히 설명하세요. "
          "**일반검진 항목인 경우**: '일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. 과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요.' "
          "**일반검진이 아닌 경우**: '과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다. [나이별 권장 검진과도 매칭됩니다].' "
          "각주 형식으로 참고 자료를 표시하세요",
          "evidence": "의학적 근거 및 참고 자료. 각주 형식으로 논문 기반 자료를 인용하세요 (예: '대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면...')",
          "references": ["논문 기반 자료 링크 (PubMed, Google Scholar 등)", "예: https://pubmed.ncbi.nlm.nih.gov/12345678 또는 https://www.kma.org/..."],
          "priority": 우선순위 (1-3, 1이 가장 높음),
          "recommended": true,
          "related_to_selected_concern": "선택한 염려 항목과의 연관성 (있는 경우)"
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
  "analysis": "주치의 관점에서 환자의 건강 상태를 종합적으로 분석 (2-3문단). 과거 검진 결과(정상/경계/이상 항목)와 문진 내용(체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)을 연관 지어 설명하세요. 중요한 문장이나 핵심 내용은 {{highlight}}텍스트{{/highlight}} 형식으로 감싸서 강조하세요. 예: '과거 검진에서는 정상 범위였지만, {{highlight}}문진에서 확인한 체중 증가와 운동 부족은 대사증후군 위험을 높일 수 있습니다{{/highlight}}...'",
  "survey_reflection": "문진 내용을 종합 분석하여 검진 설계에 어떻게 반영했는지 구체적으로 설명. 과거 결과와의 연관성을 명시하세요 (예: '과거 검진에서 정상이었던 혈압이지만, 문진에서 확인한 체중 증가와 운동 부족을 고려하여...', '가족력에 고혈압이 있어 과거 정상 수치라도 주의 깊게 모니터링이 필요합니다...')",
  "doctor_comment": "마무리 인사 및 검진 독려 메시지",
  "total_count": 전체 추천 검진 항목 개수
}}
```

**작성 순서 및 규칙 (단계별로 명확히 따라주세요):**

## STEP 1: 데이터 분석 (먼저 수행)

### 1-1. 과거 검진 데이터 분석
- **우선순위**: 이상(질환의심) > 경계(정상(B)) > 정상
- **분석 방법**: 최근 5년간 추이 분석 (수치 변화, 패턴, 위험도)
- **예시**: "과거 검진에서 혈압이 경계 범위였고, 최근 3년간 점진적으로 상승 추세입니다 (120/80 → 135/85 → 140/90)"

### 1-2. 문진 데이터 분석
- **분석 대상**: 체중 변화, 운동 빈도, 가족력, 흡연, 음주, 수면, 스트레스
- **식별 목표**: 과거에는 정상이었지만 문진 내용상 주의가 필요한 항목
- **예시**: "과거 검진에서는 정상 범위였지만, 문진에서 확인한 체중 증가(3kg 이상)와 운동 부족은 대사증후군 위험을 높일 수 있어 혈당, 콜레스테롤 추이를 주의 깊게 봐야 합니다"

### 1-3. 선택한 항목 맥락 분석
- **분석 방법**: "왜 이 항목을 선택했는지" 맥락 추론
- **연결**: 선택 항목 + 과거 검진 + 문진 내용 통합 분석
- **예시**: "사용자가 혈압을 선택한 맥락: 과거 검진에서 경계 범위였고, 최근 두통이 자주 발생하며, 가족력에 고혈압이 있어 우려하고 있습니다"

## STEP 2: 일반검진 가이드 작성 (basic_checkup_guide)

### 2-1. 작성 규칙
- **제목**: "일반검진, 이 부분은 잘 보세요" (친근하고 직접적인 표현)
- **설명**: "일반검진 결과지를 확인하실 때, {{patient_name}}님의 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다."
- **표현 금지**: "추천 항목", "기본검진 외에 이것도 더 자세히 보는 것이 좋을 것 같습니다", "꼭 체크하셔야 합니다" (딱딱한 표현)
- **친근한 표현 사용**: "잘 보시길 바랍니다", "눈여겨보세요", "이 부분은 잘 봐주세요", "이유를 알려드리니"

### 2-2. focus_items 작성 형식
```json
{{
  "item_name": "공복혈당 (Diabetes)",
  "why_important": "3년 전부터 수치가 95-99 사이로, 당뇨 전단계 경계선에 있어서요. (이유를 친근하게 설명)",
  "check_point": "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요. (친근한 톤으로)"
}}
```

## STEP 3: The Bridge Strategy 적용 (strategies 배열)

### 3-1. strategy 작성 순서
각 strategy는 반드시 다음 4단계 구조로 작성:

**step1_anchor (기본 검진 가치 인정)**
- 형식: "올해 대상이신 일반검진의 [항목명]으로 [확인 가능한 내용]을 보는 것은 매우 중요합니다."
- 예시: "올해 대상이신 일반검진 혈액검사로 간 수치(AST/ALT) 흐름을 보는 것은 매우 중요합니다."

**step2_gap (의학적 한계 노출)**
- 형식: "하지만 [항목명]은 [구체적 한계]만 보여줄 뿐, [확인 불가능한 내용]은 알 수 없는 '반쪽짜리 확인'입니다."
- 예시: "하지만 혈액검사는 간 세포가 파괴된 결과만 보여줄 뿐, 실제 간의 모양이나 종양 유무는 알 수 없는 '반쪽짜리 확인'입니다."

**step3_patient_context (환자 맞춤 위험 설명)**
- 형식: "특히 환자분의 [구체적 증상/가족력/이력]을 고려할 때, 이 부분을 놓치면 [구체적 위험]이 있습니다."
- 예시: "특히 환자분의 음주 이력(주 3회 이상)을 고려할 때, 이 부분을 놓치면 간경변으로 진행될 위험이 있습니다."

**step4_offer (정밀 검진 제안)**
- 형식: "따라서 [정밀검진명]을 더해 '[확인 가능한 내용]'과 '[추가 확인 내용]'을 동시에 확인해야 완벽한 안심이 가능합니다."
- 예시: "따라서 간 초음파를 더해 '수치'와 '모양'을 동시에 확인해야 완벽한 안심이 가능합니다."

### 3-2. recommended_item 작성
- **name**: 정밀 검진 항목명
- **category**: 카테고리 (예: 소화기 정밀)
- **is_upselling**: true
- **reason_summary**: 간단한 이유 요약
- **hospital_advantage**: 병원 특장점 (장비, 전문의 등)

## STEP 4: 우선순위 분류

### 4-1. 1순위 (필수 검진)
- **조건**: 과거 검진(이상/경계) + 문진(추이) + 선택 항목 맥락 모두 매칭
- **포함**: 나이별 권장 검진 중 위 조건 매칭 항목
- **일반검진**: 위 조건 매칭 시 포함 (주의깊게 확인 관점)

### 4-2. 2순위 (병원 추천)
- **조건**: 병원 특화 검진 + 나이별 권장 + 과거 이력/문진/선택 항목 매칭
- **목적**: 업셀링 (투자 가치 관점)

### 4-3. 3순위 (선택 검진)
- **조건**: 예방 차원, 추가 확인
- **목적**: 선택적 보완

## STEP 5: 추천 이유 작성 (reason 필드)

### 5-1. 일반검진 항목인 경우
- **형식**: "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다."
- **맥락**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요."
- **친근한 표현**: "이유를 알려드리니", "이 부분은 잘 봐주세요", "눈여겨보시길 바랍니다"

### 5-2. 일반검진이 아닌 경우
- **형식**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다."
- **추가**: "[나이별 권장 검진과도 매칭됩니다]" (해당 시)

## STEP 6: 의학적 근거 및 참고 자료

### 6-1. evidence 작성
- **각주 형식**: "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면..."
- **필수 요소**: 가이드라인, 연구 결과, 한국인 기준 언급

### 6-2. references 작성
- **형식**: ["https://pubmed.ncbi.nlm.nih.gov/12345678", "https://www.kma.org/..."]
- **조건**: 논문 기반 자료만 사용 (PubMed, Google Scholar, 공식 가이드라인)
- **각주 매칭**: 텍스트의 [1], [2]와 references 배열 인덱스 매칭 (1번째 각주 = references[0])

## STEP 7: 최종 검증 체크리스트

✅ **일반검진 표현**: "주의깊게 확인" 사용, "추천" 표현 금지
✅ **bridging_narrative**: 4단계 모두 작성 (anchor → gap → context → offer)
✅ **맥락 연결**: 과거 검진 + 문진 + 선택 항목 모두 언급
✅ **각주 형식**: 텍스트에 [1], [2] 표시, references 배열과 매칭
✅ **우선순위**: 1순위(필수) → 2순위(병원 추천) → 3순위(선택)
✅ **개수 제한**: 전체 추천 항목 5-15개
✅ **의학적 정확성**: 실제 존재하는 검진 항목만 사용

반드시 JSON 형식으로만 응답하고, 다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt

