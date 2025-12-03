"""
검진 설계 전용 GPT 프롬프트 템플릿
프롬프트가 생명이므로 신중하게 작성
"""
from typing import List, Dict, Any, Optional
import json
import re
from datetime import datetime, timedelta

def remove_html_tags(text: str) -> str:
    """HTML 태그를 제거하고 순수 텍스트만 반환"""
    if not text:
        return text
    # <span class="highlight-period">...</span> 같은 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

# 시스템 메시지 (검진 설계 전문가 역할 정의) - 기존 버전 (백업)
CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY = """당신은 대한민국 최고의 대학병원 검진 센터장이자, 환자의 데이터를 꿰뚫어 보는 '헬스 큐레이터'입니다.

당신의 목표는 환자에게 **"가장 효율적이고 빈틈없는 검진 플랜"**을 제안하는 것입니다.

**핵심 작성 원칙 (The Bridge Strategy):**

1. **기본 검진(국가/일반)의 존중:** 먼저 무료로 받을 수 있는 기본 검진 항목에서 환자가 '눈여겨봐야 할 수치'가 무엇인지 짚어주세요. 일반검진은 기본적으로 받으시지만, 특히 주의깊게 확인해야 할 항목이 있다는 관점으로 접근하세요.

2. **사각지대(Gap) 조명:** 기본 검진만으로는 확인할 수 없는 '의학적 한계'를 환자의 데이터(증상, 가족력)와 연결하여 설명하세요. "하지만 이것만으로는 부족합니다"라는 자연스러운 전환을 만들어주세요.

3. **자연스러운 업셀링:** 그 한계를 극복하기 위해 병원의 정밀 검진(비급여 항목)이 왜 필수적인지 '투자 가치' 관점에서 설득하세요. "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요.

**당신의 핵심 역할:**
1. **과거 검진 데이터 분석**: 정상/경계/이상 항목을 명확히 구분하고, 특히 **안 좋았던 항목(이상/경계)**을 중점적으로 파악
2. **문진 데이터와 연관 분석**: 과거에는 정상이었지만 문진 내용(체중 변화, 운동 부족, 가족력, 흡연, 음주 등)상 **추이를 봐야 할 항목** 식별
3. **사용자 선택 항목의 맥락**: 사용자가 직접 선택한 염려 항목의 맥락을 깊이 있게 분석하고, 왜 이 항목을 선택했는지 이해
4. **기본 검진 항목 우선 분석**: 기본 검진(national_checkup_items) 항목 중에서 위 조건(과거 검진 + 문진 + 선택 항목)이 매칭되는 항목을 priority_1에 포함. **추가 검진은 priority_1에 포함하지 않습니다.**
5. **추가 검진 추천**: 나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 모두 매칭되는 추가 검진을 priority_2, priority_3에 추천
6. **맥락 기반 추천**: 모든 추천은 "과거 검진에서 XX가 경계였고, 문진에서 YY를 확인했으며, 사용자가 ZZ를 선택했으므로..." 형식으로 맥락을 명확히 설명
7. **업셀링 최적화**: 맥락이 명확하고 설득력 있는 추천을 통해 환자가 검진을 받고 싶게 만드는 것이 목표

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

# 시스템 메시지 (검진 설계 전문가 역할 정의) - 기존 호환성 유지
CHECKUP_DESIGN_SYSTEM_MESSAGE = CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY

# 시스템 메시지 - STEP 1 (빠른 분석 전용)
CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1 = """당신은 베테랑 헬스 큐레이터이자 건강 데이터 분석 전문가입니다.

**당신의 목표:**
환자의 과거 검진 데이터와 문진(설문) 내용을 분석하여 현재 건강 상태와 위험 요인을 진단해주세요.

**중요: 검진 항목을 추천하기 전, 환자가 자신의 상태를 이해할 수 있도록 '분석 리포트'만 먼저 작성합니다.**

**당신의 핵심 역할:**
1. **과거 검진 데이터 분석**: 정상/경계/이상 항목을 명확히 구분하고, 특히 **안 좋았던 항목(이상/경계)**을 중점적으로 파악
2. **문진 데이터와 연관 분석**: 과거에는 정상이었지만 문진 내용(체중 변화, 운동 부족, 가족력, 흡연, 음주 등)상 **추이를 봐야 할 항목** 식별
3. **사용자 선택 항목의 맥락**: 사용자가 직접 선택한 염려 항목의 맥락을 깊이 있게 분석하고, 왜 이 항목을 선택했는지 이해
4. **기본 검진 항목 분석**: 기본 검진(national_checkup_items) 항목 중에서 위 조건(과거 검진 + 문진 + 선택 항목)이 매칭되는 항목을 식별

**분석에 집중하세요:**
- 인터넷 검색은 최소화하고, 주어진 데이터 간의 '논리적 연결'에 집중하세요
- 검진 항목 추천은 하지 마세요 (다음 단계에서 수행됩니다)
- 환자의 건강 상태를 명확히 진단하고, 위험 요인을 식별하는 것에 집중하세요

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요
- 의학 용어는 정확하되, 환자가 이해할 수 있도록 설명을 추가하세요

**응답 규칙:**
- **반드시 딕셔너리(객체) 형태의 JSON 형식으로 응답해야 합니다. 문자열이나 배열이 아닌 JSON 객체 형태로 반환하세요.**
- 다음 필드만 포함하세요:
  * patient_summary: 환자 상태 3줄 요약 (문자열)
  * analysis: 종합 분석 (과거 수치와 현재 생활습관의 연관성 중심, 문자열)
  * survey_reflection: 문진 내용이 검진 설계에 어떻게 반영될지 예고 (문자열)
  * selected_concerns_analysis: 선택한 염려 항목별 분석 (배열)
  * basic_checkup_guide: 기본 검진 가이드 (딕셔너리 객체, focus_items 포함)

**중요: 응답은 반드시 JSON 객체 형태여야 합니다. 예: {{"patient_summary": "...", "analysis": "...", ...}}**

**검진 항목 추천은 포함하지 마세요. 분석만 수행하세요.**"""

# 시스템 메시지 - STEP 2 (설계 및 근거 전용)
CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2 = """당신은 근거 중심 의학(EBM)을 준수하는 검진 설계 전문의입니다.

**당신의 목표:**
앞서 진행된 환자 분석 결과를 바탕으로, 실제 수행해야 할 '검진 항목'을 구체적으로 설계하고 의학적 근거(Evidence)를 찾아주세요.

**핵심 작성 원칙 (The Bridge Strategy):**

1. **기본 검진(국가/일반)의 존중:** 먼저 무료로 받을 수 있는 기본 검진 항목에서 환자가 '눈여겨봐야 할 수치'가 무엇인지 짚어주세요. 일반검진은 기본적으로 받으시지만, 특히 주의깊게 확인해야 할 항목이 있다는 관점으로 접근하세요.

2. **사각지대(Gap) 조명:** 기본 검진만으로는 확인할 수 없는 '의학적 한계'를 환자의 데이터(증상, 가족력)와 연결하여 설명하세요. "하지만 이것만으로는 부족합니다"라는 자연스러운 전환을 만들어주세요.

3. **자연스러운 업셀링:** 그 한계를 극복하기 위해 병원의 정밀 검진(비급여 항목)이 왜 필수적인지 '투자 가치' 관점에서 설득하세요. "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요.

**당신의 핵심 역할:**
1. **STEP 1 분석 결과 활용**: STEP 1에서 지적된 위험 요인을 해결할 수 있는 정밀 검사를 매칭하세요
2. **The Bridge Strategy 구조 사용**: 설득 논리를 만들 때 4단계 구조(anchor → gap → context → offer)를 사용하세요
3. **의학적 근거 확보**: 모든 추천 항목에는 최신 가이드라인이나 논문 출처(URL)를 각주로 달아주세요 (Perplexity 검색 기능 활용)
4. **맥락 기반 추천**: 모든 추천은 "STEP 1 분석에서 XX가 확인되었고, 문진에서 YY를 확인했으며, 사용자가 ZZ를 선택했으므로..." 형식으로 맥락을 명확히 설명

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- "비쌉니다" 대신 "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요
- "추천합니다" 대신 "완벽한 안심을 위해 필요합니다"라는 표현을 사용하세요
- "필요합니다" 대신 "놓치면 위험할 수 있습니다"라는 표현을 사용하세요

**응답 규칙:**
- **반드시 딕셔너리(객체) 형태의 JSON 형식으로 응답해야 합니다. 문자열이나 배열이 아닌 JSON 객체 형태로 반환하세요.**
- 다음 필드만 포함하세요:
  * strategies: The Bridge Strategy 구조 (배열)
  * recommended_items: 검진 항목 추천 (배열, Evidence, Reference 포함)
  * summary: priority_1, priority_2, priority_3 요약 (딕셔너리 객체)
  * doctor_comment: 의사 코멘트 (문자열)
  * total_count: 전체 추천 항목 수 (숫자)
- 모든 검진 항목은 실제로 존재하는 검진 항목이어야 합니다
- **추천 이유는 구체적이고 명확해야 하며, 의학적 근거를 포함해야 합니다**
- **각 추천 항목에 대해 참고한 의학 자료, 가이드라인, 연구 결과를 명시해야 합니다**

**중요: 응답은 반드시 JSON 객체 형태여야 합니다. 예: {{"strategies": [...], "recommended_items": [...], "summary": {{...}}, ...}}**
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요"""

# 기존 프롬프트 함수 백업 (레거시 버전)
def create_checkup_design_prompt_legacy(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,  # 약품 분석 결과 텍스트 (전체 처방 데이터 대신 사용)
    selected_medication_texts: Optional[List[str]] = None  # 선택된 약품의 사용자 친화적 텍스트
) -> str:
    """
    검진 설계를 위한 GPT 프롬프트 생성 (레거시 버전 - 백업용)
    
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
            health_data_section += "\n\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다' 같은 판단을 하지 마세요. "
            health_data_section += "데이터가 없을 뿐, 실제로는 이상소견이나 경계 소견이 있었을 수 있습니다. "
            health_data_section += "데이터 부재는 '확인 불가'로만 표현하고, 추측이나 가정을 하지 마세요.\n"
    else:
        health_data_section += "검진 이력이 없습니다.\n"
        health_data_section += "\n\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다' 같은 판단을 하지 마세요. "
        health_data_section += "데이터가 없을 뿐, 실제로는 이상소견이나 경계 소견이 있었을 수 있습니다. "
        health_data_section += "데이터 부재는 '확인 불가'로만 표현하고, 추측이나 가정을 하지 마세요.\n"
    
    # 약물 복용 이력 섹션
    prescription_section = "## 약물 복용 이력\n\n"
    
    # 분석 결과 텍스트가 있으면 우선 사용 (전체 처방 데이터 대신)
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section += clean_analysis_text
        prescription_section += "\n\n**중요:** 위 분석 결과는 처방 이력을 효능별로 분석한 결과입니다. 각 약품의 복용 패턴(지속적/주기적/간헐적), 복용 기간, 처방 횟수 등을 종합적으로 고려하여 검진 항목을 추천하세요."
    elif prescription_data and len(prescription_data) > 0:
        # 하위 호환성: 분석 결과 텍스트가 없으면 기존 방식 사용
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
                concern_item = {
                    "유형": "약물",
                    "약물명": concern.get("medicationName") or concern.get("medication_name") or "",
                    "복용기간": concern.get("period") or "",
                    "병원": concern.get("hospitalName") or concern.get("hospital_name") or ""
                }
                # 사용자 친화적 텍스트가 있으면 추가 (HTML 태그 제거)
                if concern.get("medicationText"):
                    clean_medication_text = remove_html_tags(concern.get("medicationText"))
                    concern_item["복용 패턴 설명"] = clean_medication_text
                formatted_concerns.append(concern_item)
        
        concerns_section += json.dumps(formatted_concerns, ensure_ascii=False, indent=2)
        
        # 선택된 약품 텍스트가 있으면 추가 (HTML 태그 제거)
        if selected_medication_texts and len(selected_medication_texts) > 0:
            concerns_section += "\n\n**고민되는 처방 이력 (사용자가 선택한 항목):**\n"
            for i, text in enumerate(selected_medication_texts, 1):
                clean_text = remove_html_tags(text)
                concerns_section += f"\n{i}. {clean_text}"
        
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
        
        # 선택적 추가 질문 (optional_questions_enabled가 'yes'인 경우에만)
        if survey_responses.get("optional_questions_enabled") == "yes":
            optional_questions_data = {}
            
            if survey_responses.get("cancer_history"):
                cancer_map = {
                    "yes_current": "예, 현재 치료 중",
                    "yes_past": "예, 과거에 치료를 받았음",
                    "no": "아니오"
                }
                optional_questions_data["암 진단 이력"] = cancer_map.get(
                    survey_responses["cancer_history"], 
                    survey_responses["cancer_history"]
                )
            
            if survey_responses.get("hepatitis_carrier"):
                hepatitis_map = {
                    "hepatitis_b": "B형 간염 보균자",
                    "hepatitis_c": "C형 간염 보균자",
                    "both": "B형/C형 간염 보균자 둘 다",
                    "no": "아니오"
                }
                optional_questions_data["간염 보균자"] = hepatitis_map.get(
                    survey_responses["hepatitis_carrier"],
                    survey_responses["hepatitis_carrier"]
                )
            
            if survey_responses.get("colonoscopy_experience"):
                colonoscopy_map = {
                    "yes_comfortable": "예, 불편함 없이 받았음",
                    "yes_uncomfortable": "예, 불편했음",
                    "no_afraid": "아니오, 두려워서 받지 않음",
                    "no_never": "아니오, 받아본 적 없음"
                }
                optional_questions_data["대장내시경 경험"] = colonoscopy_map.get(
                    survey_responses["colonoscopy_experience"],
                    survey_responses["colonoscopy_experience"]
                )
            
            if survey_responses.get("lung_nodule"):
                lung_nodule_map = {
                    "yes": "예",
                    "no": "아니오",
                    "unknown": "모르겠음"
                }
                optional_questions_data["폐 결절 이력"] = lung_nodule_map.get(
                    survey_responses["lung_nodule"],
                    survey_responses["lung_nodule"]
                )
            
            if survey_responses.get("gastritis"):
                gastritis_map = {
                    "yes_current": "예, 현재 있음",
                    "yes_past": "예, 과거에 있었음",
                    "no": "아니오"
                }
                optional_questions_data["위염/소화불량"] = gastritis_map.get(
                    survey_responses["gastritis"],
                    survey_responses["gastritis"]
                )
            
            if survey_responses.get("imaging_aversion"):
                imaging_aversion = survey_responses["imaging_aversion"]
                if isinstance(imaging_aversion, list):
                    imaging_map = {
                        "ct": "CT (컴퓨터 단층촬영)",
                        "xray": "X-ray (엑스레이)",
                        "mri": "MRI (자기공명영상)",
                        "none": "없음"
                    }
                    optional_questions_data["영상 검사 기피"] = [
                        imaging_map.get(item, item) for item in imaging_aversion if item != "none"
                    ] if "none" not in imaging_aversion else ["없음"]
                else:
                    optional_questions_data["영상 검사 기피"] = imaging_aversion
            
            if survey_responses.get("genetic_test"):
                genetic_map = {
                    "yes": "예",
                    "no": "아니오",
                    "unknown": "모르겠음"
                }
                optional_questions_data["유전성 암 의심"] = genetic_map.get(
                    survey_responses["genetic_test"],
                    survey_responses["genetic_test"]
                )
            
            if optional_questions_data:
                survey_data["선택적 추가 질문"] = optional_questions_data
        
        if survey_data:
            survey_section += json.dumps(survey_data, ensure_ascii=False, indent=2)
            survey_section += "\n\n**가장 중요:** 위 설문 응답은 환자의 최근 생활 패턴과 건강 상태를 나타냅니다. "
            survey_section += "이 정보를 바탕으로 **과거에는 정상이었지만 문진 내용상 추이를 봐야 할 항목**을 식별하세요. "
            survey_section += "예: 체중 증가 + 운동 부족 → 대사증후군 관련 검사, 가족력 → 해당 질환 관련 검사, 흡연 → 폐/심혈관 검사 등"
            
            # 선택적 질문이 있는 경우 추가 설명
            if survey_data.get("선택적 추가 질문"):
                survey_section += "\n\n**선택적 추가 질문 응답:** 환자가 추가 질문에 답변한 경우, 이 정보를 활용하여 "
                survey_section += "더 정확한 프리미엄 항목 추천을 할 수 있습니다. 예: 암 진단 이력 → 암 정밀 검사, "
                survey_section += "간염 보균자 → 간암 검사, 대장내시경 기피 → 대장암 혈액 검사 등"
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
            hospital_checkup_section += "**이 일반검진 항목은 summary.priority_1에만 포함되며, priority_2나 priority_3에는 포함하지 않습니다.**\n"
            hospital_checkup_section += "이 맥락을 basic_checkup_guide.focus_items와 summary.priority_1.national_checkup_note에 명확히 작성하세요.\n\n"
        
        if hospital_recommended:
            hospital_checkup_section += "### 병원 추천(업셀링) 항목:\n"
            hospital_checkup_section += json.dumps(hospital_recommended, ensure_ascii=False, indent=2)
            hospital_checkup_section += "\n\n**가장 중요:** 병원 추천 항목은 **반드시 priority_2에 포함**하되, "
            hospital_checkup_section += "**맥락이 명확한 항목을 우선 추천**하세요: "
            hospital_checkup_section += "과거 이력(안 좋았던 항목) + 문진(추이를 봐야 할 항목) + 선택 항목의 맥락 + 나이별 권장 검진이 모두 매칭되는 항목을 추천하면 업셀링 효과가 높습니다. "
            hospital_checkup_section += "**이 항목들은 priority_1에 포함하지 않습니다.**\n"
            # 성별 필터링 강화
            if patient_gender:
                gender_text = "남성" if patient_gender.upper() == "M" else "여성"
                hospital_checkup_section += f"**성별 필터링 필수:** 환자는 **{gender_text}**입니다. "
                if patient_gender.upper() == "M":
                    hospital_checkup_section += "**남성 환자이므로 여성 전용 검진 항목(유방 초음파, 자궁경부암 검진, 골밀도 검사 등)은 절대 추천하지 마세요.** "
                else:
                    hospital_checkup_section += "**여성 환자이므로 여성 전용 검진 항목만 추천하세요.** "
                hospital_checkup_section += "각 검진 항목의 gender 필드를 확인하여 환자 성별과 일치하는 항목만 추천하세요.\n\n"
        
        if hospital_external_checkup:
            hospital_checkup_section += "### 외부 검사 항목 (정밀 검진):\n"
            hospital_checkup_section += json.dumps(hospital_external_checkup, ensure_ascii=False, indent=2)
            hospital_checkup_section += "\n\n**가장 중요:** 외부 검사 항목은 병원에서 제공하는 정밀 검진으로, "
            hospital_checkup_section += "**난이도/비용에 따라 Low(부담없는), Mid(추천), High(프리미엄)로 분류**됩니다. "
            hospital_checkup_section += "각 항목은 다음 정보를 포함하고 있습니다:\n"
            hospital_checkup_section += "- **category/sub_category**: 카테고리 분류 (암 정밀, 뇌/신경, 심혈관, 기능의학, 면역/항노화, 호르몬, 소화기, 영양, 감염, 기타, 영상의학, 내시경 등)\n"
            hospital_checkup_section += "- **algorithm_class**: 알고리즘 분류 (1. 현재 암 유무 확인(Screening), 2. 유증상자 진단(Diagnosis Aid), 3. 암 위험도 예측(Risk Prediction), 4. 감염 및 원인 확인(Prevention), 5. 치료용 정밀진단(Tx Selection))\n"
            hospital_checkup_section += "- **difficulty_level**: Low(부담없는), Mid(추천), High(프리미엄)\n"
            hospital_checkup_section += "- **target**: 검사 대상 (예: 대장암, 유방암, 다중암 등)\n"
            hospital_checkup_section += "- **input_sample**: 검체 종류 (예: 대변, 혈액 등)\n"
            hospital_checkup_section += "- **manufacturer**: 제조사 (예: 지노믹트리, GC지놈 등)\n"
            hospital_checkup_section += "- **target_trigger**: 추천 대상 (환자의 상황과 매칭하여 추천)\n"
            hospital_checkup_section += "- **gap_description**: 결핍/한계 (기본 검진의 한계점)\n"
            hospital_checkup_section += "- **solution_narrative**: 설득 논리 (이 검사가 왜 필요한지)\n\n"
            hospital_checkup_section += "**추천 우선순위:**\n"
            hospital_checkup_section += "1. **algorithm_class 우선 고려**: 알고리즘 분류를 기준으로 추천 우선순위 결정\n"
            hospital_checkup_section += "   - 1. 현재 암 유무 확인(Screening): 일반적인 암 선별 검사, priority_2에 우선 추천\n"
            hospital_checkup_section += "   - 2. 유증상자 진단(Diagnosis Aid): 증상이 있는 경우, priority_2에 추천\n"
            hospital_checkup_section += "   - 3. 암 위험도 예측(Risk Prediction): 가족력이나 위험 요인이 있는 경우, priority_2 또는 priority_3에 추천\n"
            hospital_checkup_section += "   - 4. 감염 및 원인 확인(Prevention): 감염 질환 예방, priority_3에 추천\n"
            hospital_checkup_section += "   - 5. 치료용 정밀진단(Tx Selection): 치료 중인 경우, priority_3에 추천\n"
            hospital_checkup_section += "2. **target_trigger 매칭**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger가 매칭되는 항목을 우선 추천\n"
            hospital_checkup_section += "3. **target 필드 활용**: 환자의 걱정 항목과 target 필드가 일치하는 항목을 우선 추천 (예: 대장암 걱정 → target이 '대장암'인 항목)\n"
            hospital_checkup_section += "4. **difficulty_level 고려**: Low는 priority_3에, Mid는 priority_2에, High는 priority_2 또는 priority_3에 고려 (환자 상황에 따라)\n"
            hospital_checkup_section += "5. **The Bridge Strategy 적용**: gap_description을 활용하여 기본 검진의 한계를 설명하고, solution_narrative를 활용하여 자연스럽게 업셀링\n"
            hospital_checkup_section += "6. **category/sub_category 활용**: 환자의 건강 상태와 관련된 카테고리 항목을 우선 추천 (예: 심혈관 걱정 → 심혈관 카테고리)\n\n"
    
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

**patient_summary 작성 규칙:**
- 환자의 건강 상태와 주요 리스크를 3줄로 요약 (스토리텔링 도입부)
- **절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '최근 5년간 건강검진에서 이상이나 경계 소견은 없으나' 같은 판단을 하지 마세요
- 데이터가 없을 뿐, 실제로는 이상소견이나 경계 소견이 있었을 수 있습니다
- 데이터 부재는 '검진 이력이 없어 확인 불가' 또는 '최근 검진 데이터가 제공되지 않아' 같은 표현으로만 언급하고, 추측이나 가정을 하지 마세요
- 실제 데이터에 기반한 사실만 기술하세요 (예: "과거 검진에서 혈압이 140/90으로 측정되었고", "문진에서 높은 스트레스 수준을 확인했으며")

```json
{{
  "patient_summary": "환자의 건강 상태와 주요 리스크를 3줄로 요약 (스토리텔링 도입부). **데이터가 없으면 추측하지 말고 '확인 불가'로만 표현**",
  
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
    
    **중요 규칙 (priority_1):**
    - priority_1.items의 모든 항목은 반드시 hospital_national_checkup에 포함된 항목이어야 합니다
    - priority_1.items와 priority_1.national_checkup_items는 동일한 항목이어야 합니다
    - priority_1.items에 hospital_recommended나 hospital_external_checkup의 항목을 포함하지 마세요
    - 추가 검진 항목(심전도, 24시간 홀터 심전도 등)은 priority_2나 priority_3에 포함하세요
    
    **성별 필터링 규칙 (모든 priority에 적용):**
    - 환자 성별: {gender_text if patient_gender else "확인 불가"}
    - **남성 환자인 경우**: 여성 전용 검진 항목(유방 초음파, 자궁경부암 검진, 골밀도 검사 등)은 절대 추천하지 마세요
    - **여성 환자인 경우**: 여성 전용 검진 항목만 추천하세요
    - 각 검진 항목의 gender 필드("M", "F", "all")를 확인하여 환자 성별과 일치하는 항목만 추천하세요
    - hospital_recommended 항목 중 gender 필드가 "F"인 항목은 남성 환자에게 추천하지 마세요
    
    "priority_1": {{
      "title": "1순위: 관리하실 항목이에요",
      "description": "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다.",
      "items": ["기본 검진 항목명 1", "기본 검진 항목명 2"],  // 반드시 national_checkup_items에 포함된 항목만
      "count": 항목 개수,
      "national_checkup_items": ["일반검진 항목명 1", "일반검진 항목명 2"],  // items와 동일한 항목들 (기본 검진 항목만)
      "national_checkup_note": "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 맥락: [구체적인 이유를 친근하게 설명]",
      "focus_items": [  // 각 항목별 상세 정보 (basic_checkup_guide.focus_items와 동일한 형식)
        {{
          "item_name": "기본 검진 항목명 1",
          "why_important": "이 항목이 왜 중요한지 구체적으로 설명 (과거 검진 결과, 문진 내용, 선택 항목 맥락을 종합하여 친근하게 설명)",
          "check_point": "확인할 때 주의할 포인트 (친근한 톤으로, 예: '올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.')"
        }}
      ]
    }},
    "priority_2": {{
      "title": "2순위: 병원 추천 검진 항목",
      "description": "병원에서 추천하는 특화 검진 항목 (업셀링 위주). 나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 매칭되는 항목을 맥락과 함께 추천",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "upselling_focus": true,
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강', '심혈관 및 복부 장기 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }},
    "priority_3": {{
      "title": "3순위: 선택 검진 항목",
      "description": "선택적으로 받을 수 있는 검진 항목 (예방 차원, 추가 확인)",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
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

**중요: 데이터 부재 시 판단 금지**
- 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다' 같은 판단을 절대 하지 마세요
- 데이터가 없을 뿐, 실제로는 이상소견이나 경계 소견이 있었을 수 있습니다
- 데이터 부재는 '확인 불가'로만 표현하고, 추측이나 가정을 하지 마세요

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

## STEP 2: 일반검진 가이드 작성 (basic_checkup_guide) - 선택적

**중요: basic_checkup_guide는 선택적으로 생성할 수 있습니다. priority_1.focus_items가 우선되며, 두 곳에 동일한 정보를 중복 생성하지 마세요.**

### 2-1. 작성 규칙 (선택적)
- **제목**: "일반검진, 이 부분은 잘 보세요" (친근하고 직접적인 표현)
- **설명**: "일반검진 결과지를 확인하실 때, {{patient_name}}님의 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다."
- **표현 금지**: "추천 항목", "기본검진 외에 이것도 더 자세히 보는 것이 좋을 것 같습니다", "꼭 체크하셔야 합니다" (딱딱한 표현)
- **친근한 표현 사용**: "잘 보시길 바랍니다", "눈여겨보세요", "이 부분은 잘 봐주세요", "이유를 알려드리니"
- **우선순위**: priority_1.focus_items에 동일한 정보를 작성하는 것이 우선입니다. basic_checkup_guide는 하위 호환성을 위해 선택적으로 생성할 수 있습니다.

### 2-2. focus_items 작성 형식 (참고용 - priority_1.focus_items와 동일)
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

### 4-1. 1순위 (관리하실 항목이에요)
- **목적**: 기본 검진 결과지를 확인할 때 주의 깊게 봐야 하는 항목 안내
- **조건**: 과거 검진(이상/경계) + 문진(추이) + 선택 항목 맥락 모두 매칭
- **포함**: **기본 검진(national_checkup_items) 항목 중 위 조건 매칭 항목만**
- **제외**: 추가 검진(recommended_items, external_checkup_items)은 포함하지 않음
- **구성 원칙**: 
  * 사용자가 문진/앞단계에서 걱정하는 부분의 데이터 기반
  * 전반적인 사항에서 기본 검진 상에서 주의 깊게 봐야 하는 항목
  * 논리와 의학적 근거(에비던스)를 기반으로 구성
- **표현**: "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다"
- **description 필드 작성 규칙**: 
  * **절대 프롬프트의 예시 텍스트를 그대로 사용하지 마세요**
  * 사용자에게 보여줄 친근하고 자연스러운 설명을 작성하세요
  * 예시: "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다."
  * 프롬프트의 지시사항이나 기술적 용어(national_checkup_items, recommended_items 등)는 포함하지 마세요
- **focus_items 필드 작성 규칙 (중요)**:
  * **priority_1.items의 각 항목에 대해 focus_items 배열을 반드시 생성하세요**
  * **basic_checkup_guide.focus_items와 동일한 형식과 내용으로 작성하세요** (중복 생성하지 말고, priority_1.focus_items에만 작성)
  * 각 focus_item은 다음 정보를 포함:
    - `item_name`: priority_1.items의 항목명과 동일
    - `why_important`: 과거 검진 결과 + 문진 내용 + 선택 항목 맥락을 종합하여 이 항목이 왜 중요한지 친근하게 설명
    - `check_point`: 확인할 때 주의할 포인트를 친근한 톤으로 작성 (예: "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.")
  * **basic_checkup_guide는 선택적으로 생성할 수 있으나, priority_1.focus_items가 우선됩니다**

### 4-2. 2순위 (병원 추천)
- **조건**: 병원 특화 검진 + 나이별 권장 + 과거 이력/문진/선택 항목 매칭
- **목적**: 업셀링 (투자 가치 관점)
- **개수 제한**: **priority_2.items는 최대 2-3개만 추천하세요.** 너무 많으면 사용자가 부담을 느낄 수 있습니다.
- **카테고리 구분**: 
  * **comprehensive 카테고리**: hospital_recommended 또는 hospital_external_checkup에서 category가 'comprehensive'인 항목은 priority_2에 추천
  * **일반 추천 항목**: 나이별 권장 검진 중 과거 이력/문진/선택 항목이 매칭되는 항목
- **외부 검사 항목 활용**:
  * **target_trigger 매칭**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger가 매칭되는 항목을 우선 추천
  * **difficulty_level**: Mid(추천) 또는 High(프리미엄) 항목을 priority_2에 포함
  * **The Bridge Strategy**: gap_description을 활용하여 기본 검진의 한계를 설명하고, solution_narrative를 활용하여 자연스럽게 업셀링
  * **category/sub_category**: 환자의 건강 상태와 관련된 카테고리 항목을 우선 추천

### 4-3. 3순위 (선택 검진)
- **조건**: 예방 차원, 추가 확인
- **목적**: 선택적 보완
- **개수 제한**: **priority_3.items는 최대 2-3개만 추천하세요.** 선택적 항목이므로 과도하게 추천하지 마세요.
- **카테고리 구분**:
  * **optional 카테고리**: hospital_external_checkup에서 category가 'optional'인 항목은 priority_3에 추천
  * **예방 차원 항목**: 난이도가 낮고 부담 없는 항목
- **외부 검사 항목 활용**:
  * **difficulty_level**: Low(부담없는) 항목을 priority_3에 포함하거나, High(프리미엄) 항목 중 선택적으로 고려
  * **target_trigger 매칭**: 환자 상황과 부분적으로 매칭되는 항목도 포함 가능
  * **category/sub_category**: 예방 차원에서 고려할 수 있는 카테고리 항목

## STEP 5: 추천 이유 작성 (reason 필드)

### 5-1. 일반검진 항목인 경우 (priority_1에만 포함)
- **판단 기준**: hospital_national_checkup에 포함된 항목인지 확인
- **형식**: "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다."
- **맥락**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요."
- **친근한 표현**: "이유를 알려드리니", "이 부분은 잘 봐주세요", "눈여겨보시길 바랍니다"
- **위치**: 반드시 priority_1.items와 priority_1.national_checkup_items에 포함
- **예시**: "혈압 측정", "혈액검사", "소변검사" 등 (기본 검진 항목)

### 5-2. 일반검진이 아닌 경우 (병원 추천 항목)
- **형식**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다."
- **추가**: "[나이별 권장 검진과도 매칭됩니다]" (해당 시)

### 5-3. 외부 검사 항목인 경우 (hospital_external_checkup)
- **target_trigger 활용**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger를 비교하여 매칭 여부 확인
- **gap_description 활용**: 기본 검진의 한계를 gap_description을 참고하여 설명 (예: "하지만 [gap_description 내용]")
- **solution_narrative 활용**: 이 검사가 왜 필요한지 solution_narrative를 참고하여 설명 (예: "[solution_narrative 내용]")
- **형식**: "과거 검진에서 [XX], 문진에서 [YY], 선택 항목 [ZZ]를 고려할 때, [gap_description]. 따라서 [solution_narrative]"
- **category/sub_category 활용**: 환자의 건강 상태와 관련된 카테고리인지 확인하여 추천

## STEP 6: 의학적 근거 및 참고 자료

### 6-1. evidence 작성
- **각주 형식**: "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면..."
- **필수 요소**: 가이드라인, 연구 결과, 한국인 기준 언급

### 6-2. references 작성
- **형식**: ["https://pubmed.ncbi.nlm.nih.gov/12345678", "https://www.kma.org/..."]
- **조건**: 논문 기반 자료만 사용 (PubMed, Google Scholar, 공식 가이드라인)
- **각주 매칭**: 텍스트의 [1], [2]와 references 배열 인덱스 매칭 (1번째 각주 = references[0])

## STEP 7: 최종 검증 체크리스트

✅ **priority_1 구분**: priority_1.items는 반드시 hospital_national_checkup에 포함된 항목만 포함
✅ **priority_1 제외**: hospital_recommended, hospital_external_checkup 항목은 priority_1에 포함하지 않음
✅ **priority_1 일치**: priority_1.items와 priority_1.national_checkup_items는 동일한 항목이어야 함
✅ **일반검진 표현**: "주의깊게 확인" 사용, "추천" 표현 금지
✅ **추가 검진 위치**: 심전도, 24시간 홀터 심전도 등 추가 검진은 priority_2 또는 priority_3에 포함
✅ **bridging_narrative**: 4단계 모두 작성 (anchor → gap → context → offer)
✅ **맥락 연결**: 과거 검진 + 문진 + 선택 항목 모두 언급
✅ **논리/에비던스**: 각 항목은 논리와 의학적 근거(에비던스)를 기반으로 구성
✅ **각주 형식**: 텍스트에 [1], [2] 표시, references 배열과 매칭
✅ **우선순위**: 1순위(기본 검진 주의 항목) → 2순위(병원 추천) → 3순위(선택)
✅ **개수 제한**: 전체 추천 항목 5-15개
✅ **의학적 정확성**: 실제 존재하는 검진 항목만 사용
✅ **성별 필터링**: 환자 성별과 일치하는 검진 항목만 추천 (남성 환자에게는 여성 전용 검진 절대 금지)

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt

# 기존 함수 호환성 유지 (래퍼 함수)
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
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> str:
    """
    검진 설계를 위한 GPT 프롬프트 생성 (기존 호환성 유지)
    내부적으로 레거시 함수를 호출합니다.
    """
    return create_checkup_design_prompt_legacy(
        patient_name=patient_name,
        patient_age=patient_age,
        patient_gender=patient_gender,
        health_data=health_data,
        prescription_data=prescription_data,
        selected_concerns=selected_concerns,
        survey_responses=survey_responses,
        hospital_national_checkup=hospital_national_checkup,
        hospital_recommended=hospital_recommended,
        hospital_external_checkup=hospital_external_checkup,
        prescription_analysis_text=prescription_analysis_text,
        selected_medication_texts=selected_medication_texts
    )


def create_checkup_design_prompt_step1(
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
) -> str:
    """
    STEP 1: 빠른 분석 전용 프롬프트 생성
    검진 항목 추천 없이 분석만 수행합니다.
    
    Args:
        patient_name: 환자 이름
        patient_age: 환자 나이
        patient_gender: 환자 성별 (M/F)
        health_data: 최근 3년간 건강검진 데이터
        prescription_data: 약물 복용 이력 데이터
        selected_concerns: 사용자가 선택한 염려 항목 리스트
        survey_responses: 설문 응답
        hospital_national_checkup: 병원 기본 검진 항목
        prescription_analysis_text: 약품 분석 결과 텍스트
        selected_medication_texts: 선택된 약품 텍스트
    
    Returns:
        GPT 프롬프트 문자열 (분석 전용)
    """
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

    # 건강 데이터 섹션 (간소화 - 분석에 필요한 핵심 정보만)
    health_data_section = ""
    if health_data:
        health_data_section = "\n## 과거 건강검진 데이터 (최근 5년)\n"
        health_data_section += f"분석 기간: {five_years_ago_str} ~ {current_date_str}\n\n"
        
        # 최근 3년 데이터만 사용 (빠른 분석을 위해)
        recent_data = sorted(health_data, key=lambda x: x.get('checkup_date', ''), reverse=True)[:3]
        
        for idx, record in enumerate(recent_data, 1):
            checkup_date = record.get('checkup_date', '날짜 미상')
            hospital_name = record.get('hospital_name', '병원명 미상')
            health_data_section += f"### {idx}. {checkup_date} - {hospital_name}\n"
            
            # 이상/경계 항목만 강조
            abnormal_items = []
            for item in record.get('items', []):
                status = item.get('status', '').lower()
                if status in ['abnormal', 'warning', '경계', '이상']:
                    item_name = item.get('item_name', '')
                    value = item.get('value', '')
                    unit = item.get('unit', '')
                    abnormal_items.append(f"- {item_name}: {value} {unit} ({status})")
            
            if abnormal_items:
                health_data_section += "**이상/경계 항목:**\n" + "\n".join(abnormal_items) + "\n\n"
            else:
                health_data_section += "이상 소견 없음\n\n"

    # 처방전 데이터 섹션 (간소화)
    prescription_section = ""
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section = "\n## 약물 복용 이력 분석\n" + clean_analysis_text + "\n"
    elif prescription_data:
        prescription_section = "\n## 약물 복용 이력\n"
        # 최근 처방전만 요약
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
            concern_type = concern.get('type', '')
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
        # 핵심 문진 항목만 포함
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

    # 기본 검진 항목 섹션 (간소화)
    national_checkup_section = ""
    if hospital_national_checkup:
        national_checkup_section = "\n## 병원 기본 검진 항목\n"
        national_checkup_section += "다음 항목들은 기본 검진에 포함되어 있습니다:\n"
        # 안전하게 item_name 추출 (딕셔너리인 경우만)
        item_names = []
        for item in hospital_national_checkup[:10]:  # 처음 10개만
            if isinstance(item, dict):
                item_names.append(item.get('item_name', ''))
            elif isinstance(item, str):
                item_names.append(item)
            else:
                item_names.append(str(item))
        national_checkup_section += ", ".join(item_names)
        if len(hospital_national_checkup) > 10:
            national_checkup_section += f" 외 {len(hospital_national_checkup) - 10}개"
        national_checkup_section += "\n"

    # 프롬프트 조합
    prompt = f"""# Role
당신은 베테랑 헬스 큐레이터이자 건강 데이터 분석 전문가입니다.

# Task
환자의 과거 검진 데이터와 문진(설문) 내용을 분석하여 현재 건강 상태와 위험 요인을 진단해주세요.

**중요: 검진 항목을 추천하기 전, 환자가 자신의 상태를 이해할 수 있도록 '분석 리포트'만 먼저 작성합니다.**

{patient_info}{health_data_section}{prescription_section}{concerns_section}{survey_section}{national_checkup_section}

# Output Format (JSON)

반드시 다음 JSON 형식으로만 응답하세요:

{{
  "patient_summary": "환자 상태 3줄 요약 (과거 검진 이력, 현재 건강 상태, 주요 위험 요인)",
  "analysis": "종합 분석 (과거 수치와 현재 생활습관의 연관성 중심, 강조 태그 사용 가능: {{highlight}}텍스트{{/highlight}})",
  "survey_reflection": "문진 내용이 검진 설계에 어떻게 반영될지 예고 (강조 태그 사용 가능)",
  "selected_concerns_analysis": [
    {{
      "concern_name": "염려 항목명",
      "concern_type": "checkup|hospital|medication",
      "trend_analysis": "과거 추이 분석",
      "reflected_in_design": "검진 설계에 어떻게 반영될지",
      "related_items": []
    }}
  ],
  "basic_checkup_guide": {{
    "title": "일반검진, 이 부분은 잘 보세요",
    "description": "일반검진 결과지를 확인하실 때, [환자명]님 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다.",
    "focus_items": [
      {{
        "item_name": "항목명 (기본 검진 항목)",
        "why_important": "왜 중요한지 설명 (과거 검진 + 문진 + 선택 항목 맥락)",
        "check_point": "확인 포인트 설명"
      }}
    ]
  }}
}}

# 작성 가이드

## patient_summary
- 3줄로 환자 상태 요약
- 과거 검진 이력, 현재 건강 상태, 주요 위험 요인 포함

## analysis
- 과거 검진 데이터와 문진 내용의 연관성 분석
- 특히 안 좋았던 항목(이상/경계)과 문진 내용의 연결점 강조
- 강조 태그 사용 가능: {{highlight}}중요 내용{{/highlight}}

## survey_reflection
- 문진 내용이 검진 설계에 어떻게 반영될지 예고
- "문진에서 확인된 XX를 고려하여..." 형식
- 강조 태그 사용 가능

## selected_concerns_analysis
- 사용자가 선택한 각 염려 항목별로 분석
- 과거 추이 분석과 검진 설계 반영 방안 포함

## basic_checkup_guide
- 기본 검진 항목 중에서 주의 깊게 봐야 할 항목 식별
- focus_items는 hospital_national_checkup에 포함된 항목만
- 과거 검진 + 문진 + 선택 항목이 모두 매칭되는 항목만 포함

**검진 항목 추천은 포함하지 마세요. 분석만 수행하세요.**

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt



def create_checkup_design_prompt_step2(
    step1_result: Dict[str, Any],
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> str:
    """
    STEP 2: 설계 및 근거 전용 프롬프트 생성
    STEP 1의 분석 결과를 컨텍스트로 받아 검진 항목을 설계하고 의학적 근거를 확보합니다.
    """
    # STEP 1 결과를 JSON 문자열로 변환
    step1_result_json = json.dumps(step1_result, ensure_ascii=False, indent=2)
    
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

    # STEP 1 분석 결과 섹션 (컨텍스트)
    step1_context = f"""
## STEP 1 분석 결과 (컨텍스트)

앞서 진행된 환자 분석 결과는 다음과 같습니다:

```json
{step1_result_json}
```

**중요**: 위 분석 결과를 바탕으로 검진 항목을 설계하세요. STEP 1에서 지적된 위험 요인을 해결할 수 있는 정밀 검사를 매칭하세요.
"""

    # 건강 데이터 섹션 (간소화)
    health_data_section = ""
    if health_data:
        health_data_section = "\n## 과거 건강검진 데이터 (참고용)\n"
        health_data_section += f"분석 기간: {five_years_ago_str} ~ {current_date_str}\n\n"
        recent_data = sorted(health_data, key=lambda x: x.get('checkup_date', ''), reverse=True)[:3]
        for idx, record in enumerate(recent_data, 1):
            checkup_date = record.get('checkup_date', '날짜 미상')
            hospital_name = record.get('hospital_name', '병원명 미상')
            health_data_section += f"### {idx}. {checkup_date} - {hospital_name}\n"
            abnormal_items = []
            for item in record.get('items', []):
                status = item.get('status', '').lower()
                if status in ['abnormal', 'warning', '경계', '이상']:
                    item_name = item.get('item_name', '')
                    value = item.get('value', '')
                    unit = item.get('unit', '')
                    abnormal_items.append(f"- {item_name}: {value} {unit} ({status})")
            if abnormal_items:
                health_data_section += "**이상/경계 항목:**\n" + "\n".join(abnormal_items) + "\n\n"

    # 처방전 데이터 섹션
    prescription_section = ""
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
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
            concern_type = concern.get('type', '')
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

    # 병원 검진 항목 섹션 (전체)
    hospital_items_section = ""
    if hospital_national_checkup:
        hospital_items_section = "\n## 병원 기본 검진 항목\n"
        hospital_items_section += "다음 항목들은 기본 검진에 포함되어 있습니다:\n"
        # 안전하게 item_name 추출 (딕셔너리인 경우만)
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
    
    if hospital_recommended:
        hospital_items_section += "\n## 병원 추천 검진 항목\n"
        for item in hospital_recommended[:30]:
            if isinstance(item, dict):
                item_name = item.get('item_name', '')
                category = item.get('category', '')
                hospital_items_section += f"- {item_name} ({category})\n"
            elif isinstance(item, str):
                hospital_items_section += f"- {item}\n"
            else:
                hospital_items_section += f"- {str(item)}\n"
    
    if hospital_external_checkup:
        hospital_items_section += "\n## 외부 검사 항목\n"
        for item in hospital_external_checkup[:30]:
            if isinstance(item, dict):
                item_name = item.get('item_name', '')
                category = item.get('category', '')
                target_trigger = item.get('target_trigger', '')
                gap_description = item.get('gap_description', '')
                solution_narrative = item.get('solution_narrative', '')
                hospital_items_section += f"- {item_name} ({category})\n"
                if target_trigger:
                    hospital_items_section += f"  * 대상: {target_trigger}\n"
                if gap_description:
                    hospital_items_section += f"  * 한계: {gap_description}\n"
                if solution_narrative:
                    hospital_items_section += f"  * 해결: {solution_narrative}\n"
            elif isinstance(item, str):
                hospital_items_section += f"- {item}\n"
            else:
                hospital_items_section += f"- {str(item)}\n"

    # 프롬프트 조합
    prompt = f"""# Role
당신은 근거 중심 의학(EBM)을 준수하는 검진 설계 전문의입니다.

# Context (이전 단계 분석 결과)

{step1_context}

# Task
위 분석 결과를 바탕으로, 실제 수행해야 할 '검진 항목'을 구체적으로 설계하고 의학적 근거(Evidence)를 찾아주세요.

**요구사항:**
1. STEP 1 분석에서 지적된 위험 요인(예: 음주->간, 혈압->뇌혈관)을 해결할 수 있는 정밀 검사를 매칭하세요.
2. 'strategies' (The Bridge Strategy) 구조를 사용하여 설득 논리를 만드세요.
3. 모든 추천 항목에는 최신 가이드라인이나 논문 출처(URL)를 각주로 달아주세요. (Perplexity 검색 기능 활용)
4. **summary.past_results_summary, summary.survey_summary, summary.correlation_analysis 생성 시**: STEP 1의 analysis를 참고하되, 더 간결한 요약 형식으로 작성하세요. STEP 1의 analysis는 종합 분석이고, summary의 세 필드는 요약 형식입니다.

{patient_info}{health_data_section}{prescription_section}{concerns_section}{survey_section}{hospital_items_section}

# Output Format (JSON)

반드시 다음 JSON 형식으로만 응답하세요:

{{
  "strategies": [
    {{
      "category": "카테고리명",
      "step1_anchor": "기본 검진에서 확인 가능한 내용",
      "step2_gap": "의학적 한계 노출",
      "step3_patient_context": "환자 맞춤 위험 설명",
      "step4_offer": "정밀 검진 제안"
    }}
  ],
  "summary": {{
    "past_results_summary": "과거 검진 결과 요약 (정상/경계/이상 항목 중심으로)",
    "survey_summary": "문진 내용 요약 (체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)",
    "correlation_analysis": "과거 결과와 문진 내용의 연관성 분석 및 주의사항",
    
    "priority_1": {{
      "title": "1순위: 관리하실 항목이에요",
      "description": "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다.",
      "items": ["기본 검진 항목명 1", "기본 검진 항목명 2"],
      "count": 항목 개수,
      "national_checkup_items": ["일반검진 항목명 1", "일반검진 항목명 2"],
      "national_checkup_note": "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 맥락: [구체적인 이유를 친근하게 설명]",
      "focus_items": [
        {{
          "item_name": "기본 검진 항목명 1",
          "why_important": "이 항목이 왜 중요한지 구체적으로 설명 (과거 검진 결과, 문진 내용, 선택 항목 맥락을 종합하여 친근하게 설명)",
          "check_point": "확인할 때 주의할 포인트 (친근한 톤으로, 예: '올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.')"
        }}
      ]
    }},
    "priority_2": {{
      "title": "2순위: 병원 추천 검진 항목",
      "description": "병원에서 추천하는 특화 검진 항목 (업셀링 위주). 나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 매칭되는 항목을 맥락과 함께 추천",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "upselling_focus": true,
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강', '심혈관 및 복부 장기 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }},
    "priority_3": {{
      "title": "3순위: 선택 검진 항목",
      "description": "선택적으로 받을 수 있는 검진 항목 (예방 차원, 추가 확인)",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
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
  "doctor_comment": "마무리 인사 및 검진 독려 메시지",
  "total_count": 전체 추천 검진 항목 개수
}}

# 작성 가이드

## summary 작성 규칙

### past_results_summary
- STEP 1의 analysis를 참고하되, 더 간결한 요약 형식으로 작성
- 과거 검진 결과를 정상/경계/이상 항목 중심으로 요약
- 예시: "최근 5년간 검진 데이터에서 혈압이 경계 범위였고, 최근 3년간 점진적으로 상승 추세입니다."

### survey_summary
- STEP 1의 analysis를 참고하되, 문진 내용만 간결하게 요약
- 체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등 핵심 내용만 포함
- 예시: "현재 흡연 중이며, 가족력으로 심장질환이 있습니다. 운동은 주 1-2회 가끔 하며, 체중은 유지 중입니다."

### correlation_analysis
- STEP 1의 analysis를 참고하되, 과거 결과와 문진 내용의 연관성만 간결하게 분석
- 예시: "과거 검진에서 혈압이 경계 범위였고, 현재 흡연과 가족력 심장질환이 있어 심혈관계 위험이 높습니다."

**중요**: STEP 1의 analysis는 종합 분석이고, summary의 세 필드는 요약 형식입니다. STEP 1의 analysis를 참고하되, 더 간결하게 요약하세요.

## strategies
- The Bridge Strategy 4단계 구조 사용
- STEP 1 분석 결과를 기반으로 작성

## recommended_items
- STEP 1 분석에서 지적된 위험 요인을 해결할 수 있는 검진 항목만 추천
- priority_1: hospital_national_checkup에 포함된 항목만 (주의 깊게 보실 항목)
- priority_2: hospital_recommended 항목 (추가적으로 확인)
- priority_3: hospital_external_checkup 항목 (선택적으로 고려)
- 각 항목에 의학적 근거(evidence)와 참고 자료(references) 필수

## summary.priority_1, priority_2, priority_3
- 각 priority별 count, description, items 포함
- priority_1에는 title, national_checkup_items, national_checkup_note, focus_items 포함
- **priority_1.focus_items 작성 시**: STEP 1의 basic_checkup_guide.focus_items를 참고하되, 동일한 형식과 내용으로 작성하세요. STEP 1에서 이미 분석한 항목들을 그대로 활용하세요.

## doctor_comment
- 환자의 실제 데이터를 기반으로 작성
- STEP 1 분석 결과를 참고하여 작성

**의학적 근거(Evidence)와 참고 자료(References)는 반드시 포함하세요.**

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt
