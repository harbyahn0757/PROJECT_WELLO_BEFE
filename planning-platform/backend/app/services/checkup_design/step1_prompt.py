"""
STEP 1 프롬프트 생성 (페르소나 기반 개선 + 행동 데이터 반영)
기존 create_checkup_design_prompt_step1 함수를 가져와서 페르소나 판정 및 행동 데이터 주입 추가
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
from .persona import determine_persona
from .survey_mapping import generate_survey_section


def remove_html_tags(text: str) -> str:
    """HTML 태그를 제거하고 순수 텍스트만 반환"""
    if not text:
        return text
    import re
    # <span class="highlight-period">...</span> 같은 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def build_master_knowledge_section():
    """마스터 지식 베이스 섹션 생성"""
    # prompt.py에서 가져온 로직
    from .prompt import RISK_ANALYSIS_LOGIC_JSON, PROFILE_GUIDELINE_JSON, BRIDGE_STRATEGY_JSON
    
    return f"""
# Master Knowledge Base (시스템 지식)

## 1. 위험도 분석 로직 (Risk Stratification)
{RISK_ANALYSIS_LOGIC_JSON}

## 2. 생애주기 및 만성질환 가이드
{PROFILE_GUIDELINE_JSON}

## 3. 브릿지 전략 및 근거 DB
{BRIDGE_STRATEGY_JSON}
"""


def create_step1_prompt(
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
) -> Dict[str, Any]:
    """
    STEP 1: 빠른 분석 전용 프롬프트 생성 (페르소나 판정 포함)
    검진 항목 추천 없이 분석만 수행합니다.
    
    Args:
        patient_name: 환자 이름
        patient_age: 환자 나이
        patient_gender: 환자 성별 (M/F)
        health_data: 최근 3년간 건강검진 데이터
        prescription_data: 약물 복용 이력 데이터
        selected_concerns: 사용자가 선택한 염려 항목 리스트
        survey_responses: 설문 응답 (user_attributes 포함)
        hospital_national_checkup: 병원 기본 검진 항목
        prescription_analysis_text: 약품 분석 결과 텍스트
        selected_medication_texts: 선택된 약품 텍스트
    
    Returns:
        {
            "prompt": "GPT에 전달할 전체 프롬프트",
            "persona_result": {...}  # 페르소나 판정 결과
        }
    """
    
    # ==========================================
    # 1. 페르소나 판정 (Phase 1 Logic 적용)
    # ==========================================
    persona_result = determine_persona(
        survey_responses=survey_responses or {},
        patient_age=patient_age or 0,
        health_history=health_data or [],         # [신규] 과거 검진 기록
        selected_concerns=selected_concerns or [],# [신규] 채팅 선택 항목
        prescription_data=prescription_data or [] # [신규] 처방 이력
    )
    
    # 페르소나 섹션 생성 (하이브리드 정보 확장)
    primary_persona = persona_result.get('primary_persona', 'General')
    secondary_persona = persona_result.get('secondary_persona', 'None')
    combined_type = persona_result.get('combined_type', primary_persona)
    
    persona_section = f"""
# Patient Persona Analysis (Hybrid Model)
- **Primary Type**: {primary_persona} (본심/감정)
- **Secondary Type**: {secondary_persona} (행동/습관 - Primary와 충돌 가능성 분석 대상)
- **Combined Type**: {combined_type} (LLM Analysis Context)
- **Communication Tone**: {persona_result.get('tone', 'Casual & Smart')}
- **Bridge Strategy**: {persona_result.get('bridge_strategy', '공감과 현실적 대안 제시')}
"""

    # ==========================================
    # 2. 기존 로직: 날짜 계산
    # ==========================================
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)
    current_date_str = today.strftime("%Y년 %m월 %d일")
    five_years_ago_str = five_years_ago.strftime("%Y년 %m월 %d일")
    
    # ==========================================
    # 3. 기존 로직: 환자 정보 섹션
    # ==========================================
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 현재 날짜: {current_date_str}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"

    # ==========================================
    # 4. 기존 로직: 건강 데이터 섹션
    # ==========================================
    health_data_section = ""
    has_recent_data = False
    
    if health_data:
        # 최근 5년 데이터 모두 사용 (정확한 추이 분석을 위해)
        # 날짜 기준으로 정렬 (최신순)
        recent_data = sorted(health_data, key=lambda x: (
            x.get('year', ''),
            x.get('checkup_date', '') or x.get('CheckUpDate', '')
        ), reverse=True)
        
        # 데이터 개수에 따라 헤더 조정
        if len(recent_data) == 1:
            health_data_section = "\n## 과거 건강검진 데이터 (1건)\n"
            data_date = recent_data[0].get('checkup_date', '') or recent_data[0].get('CheckUpDate', '') or recent_data[0].get('year', '')
            health_data_section += f"분석 대상: {data_date} 검진 데이터\n\n"
        elif len(recent_data) > 1:
            health_data_section = f"\n## 과거 건강검진 데이터 ({len(recent_data)}건)\n"
            start_date = recent_data[-1].get('checkup_date', '') or recent_data[-1].get('CheckUpDate', '') or recent_data[-1].get('year', '')
            end_date = recent_data[0].get('checkup_date', '') or recent_data[0].get('CheckUpDate', '') or recent_data[0].get('year', '')
            health_data_section += f"분석 기간: {start_date} ~ {end_date}\n\n"
        else:
            health_data_section = "\n## 과거 건강검진 데이터\n"
            health_data_section += "검진 이력이 확인되지 않습니다.\n"

        # 최근 2년 이내 데이터 확인
        two_years_ago = today - timedelta(days=2*365)
        latest_date_str = recent_data[0].get('checkup_date', '') or recent_data[0].get('CheckUpDate', '')
        if latest_date_str:
            try:
                # 다양한 날짜 형식 처리 시도
                if len(latest_date_str) == 4: # YYYY
                     latest_date = datetime.strptime(latest_date_str, "%Y")
                elif '-' in latest_date_str:
                     latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d")
                elif '/' in latest_date_str:
                     latest_date = datetime.strptime(latest_date_str, "%Y/%m/%d") # 2021/09/28 형식
                elif '년' in latest_date_str: # 2021년 09월 28일
                     latest_date_str_clean = latest_date_str.replace('년', '-').replace('월', '-').replace('일', '').replace(' ', '')
                     latest_date = datetime.strptime(latest_date_str_clean, "%Y-%m-%d")
                else:
                     latest_date = None
                
                if latest_date and latest_date >= two_years_ago:
                    has_recent_data = True
            except:
                pass # 날짜 파싱 실패 시 recent 데이터 없다고 가정

        if not has_recent_data:
            health_data_section += "⚠️ **주의: 제공된 데이터는 최근 2년 이내의 것이 아닙니다.**\n"
            health_data_section += "과거의 건강 상태가 현재까지 유지되고 있다고 가정하지 마세요. "
            health_data_section += "노화, 생활습관 변화 등으로 인해 상태가 달라졌을 가능성이 매우 높습니다. "
            health_data_section += "분석 시 '과거에는 이러했으나 현재 상태 확인이 필요함'을 강조하세요.\n\n"
        
        for idx, record in enumerate(recent_data, 1):
            # 날짜 및 병원명 추출
            checkup_date = record.get('checkup_date') or record.get('CheckUpDate') or '날짜 미상'
            checkup_year = record.get('year', '')
            hospital_name = record.get('location') or record.get('Location') or record.get('hospital_name', '병원명 미상')
            
            # 년도와 날짜 조합
            if checkup_year and checkup_date != '날짜 미상':
                date_display = f"{checkup_year}년 {checkup_date}"
            elif checkup_year:
                date_display = f"{checkup_year}년"
            else:
                date_display = checkup_date
            
            health_data_section += f"### {idx}. {date_display} - {hospital_name}\n"
            
            # 이상/경계 항목 추출 (raw_data.Inspections에서)
            abnormal_items = []
            warning_items = []
            raw_data = record.get('raw_data') or {}
            
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            
            if isinstance(raw_data, dict) and raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:  # 최대 5개 검사
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:  # 최대 5개 질환
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:  # 최대 10개 항목
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    item_unit = item.get("Unit") or ""
                                    
                                    # ItemReferences 확인하여 상태 분류
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
    else:
        health_data_section = "\n## 과거 건강검진 데이터\n"
        health_data_section += "검진 이력이 확인되지 않습니다.\n"
        health_data_section += "\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '검진을 하지 않아서' 같은 판단을 하지 마세요. "
        health_data_section += "우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다. "
        health_data_section += "정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아' "
        health_data_section += "절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서' "
        health_data_section += "데이터 부재는 '확인 불가' 또는 '확인되지 않음'으로만 표현하고, 추측이나 가정을 하지 마세요.\n"

    # ==========================================
    # 5. 기존 로직: 처방전 데이터 섹션
    # ==========================================
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

    # ==========================================
    # 6. 개선: 선택한 항목 (Selected Concerns) 섹션
    # ==========================================
    concerns_section = ""
    if selected_concerns:
        concerns_section = "\n## 1. [Selected Concerns] 환자가 선택한 항목 (채팅 선택)\n"
        concerns_section += "**환자가 채팅창에서 직접 선택한 항목들입니다:**\n"
        for idx, concern in enumerate(selected_concerns, 1):
            concern_type = concern.get('type', '')
            concern_name = concern.get('name', '')
            concern_date = concern.get('date', '')
            concern_value = concern.get('value', '')
            concern_unit = concern.get('unit', '')
            concern_status = concern.get('status', '')
            concern_details = concern.get('detailItems', []) # 프론트엔드에서 보낸 상세 항목
            concern_level = concern.get('concernLevel', 'implicit') # 관심 강도 (explicit/implicit)
            
            concerns_section += f"- {concern_name}"
            if concern_date:
                concerns_section += f" ({concern_date})"
            if concern_value:
                concerns_section += f": {concern_value} {concern_unit}"
            if concern_status:
                concerns_section += f" [{concern_status}]"
            
            # 상세 선택 항목 및 강도 표시
            if concern_details and isinstance(concern_details, list) and len(concern_details) > 0:
                details_str = ", ".join(concern_details)
                if concern_level == 'explicit':
                    concerns_section += f"\n  * 🔥 [High Interest] 환자가 직접 선택한 항목: {details_str}"
                else:
                    concerns_section += f"\n  * ⚠️ [General Check] 검진 결과 중 주의 항목: {details_str}"
                
            concerns_section += "\n"
    else:
        concerns_section = "\n## 1. [Selected Concerns] 환자가 선택한 항목\n(선택된 항목 없음)\n"

    # ==========================================
    # 7. 개선: 객관적 현실 (Objective Reality) 섹션
    # ==========================================
    reality_section = "\n## 2. [Objective Reality] 객관적 팩트 (데이터 & 문진)\n"
    reality_section += generate_survey_section(survey_responses or {})
    
    # ==========================================
    # 8. [신규] 행동 기반 진심도 분석 (Behavioral Signals)
    # ==========================================
    behavior_section = ""
    user_attributes = (survey_responses or {}).get('user_attributes', [])
    
    if user_attributes:
        behavior_section = "\n## 3. [Behavioral Signals] 행동 패턴 및 진심도 분석\n"
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
            behavior_section += "### 🔥 높은 관심도 신호 (High Interest Level)\n" + "\n".join(worry_items) + "\n\n"
        
        if sincerity_items:
            behavior_section += "### 👁️ 진심도 및 관심 신호 (Sincerity & Engagement)\n" + "\n".join(sincerity_items) + "\n\n"
            
        if management_items:
            behavior_section += "### 🏃 자가 관리 상태 (Management Status)\n" + "\n".join(management_items) + "\n\n"
            
        behavior_section += "**해석 가이드:**\n"
        behavior_section += "- **Sincerity High (진심도 높음)**: 체류 시간이 길거나 수정을 반복한 항목입니다. 사용자가 이 부분에 대해 깊게 고민하고 있음을 의미하므로, 분석 시 비중 있게 다뤄주세요.\n"
        behavior_section += "- **Hesitation (망설임)**: 답변을 선택했다가 취소하거나 페이지를 앞뒤로 이동한 흔적입니다. 확신이 없거나 민감한 주제일 수 있으니 조심스럽게 접근하세요.\n"
        behavior_section += "- **High Interest**: 사용자가 구체적으로 서술한 관심 항목입니다. 검진 설계 시 반드시 반영해야 합니다.\n"

    # ==========================================
    # 9. 기본 검진 항목 (참조용)
    # ==========================================
    national_checkup_section = ""
    if hospital_national_checkup:
        national_checkup_section = "\n## [Reference] 병원 기본 검진 항목 (참조용)\n"
        items_list = []
        for item in hospital_national_checkup:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("item_name")
            if name:
                items_list.append(name)
        national_checkup_section += ", ".join(items_list[:20])  # 너무 길지 않게 상위 20개만
        if len(items_list) > 20:
            national_checkup_section += f" 외 {len(items_list)-20}개"
        national_checkup_section += "\n"

    # ==========================================
    # 10. 프롬프트 조합
    # ==========================================
    prompt = f"""
{persona_section}

# Role
당신은 '센스 있고 현실적인 건강 멘토'이자, 베테랑 헬스 큐레이터입니다.
딱딱한 의사가 아닌, "건강을 챙겨주는 믿음직한 형/오빠/친구" 같은 톤으로, 전문성을 갖추되 쉽고 명쾌하게 설명합니다.

# Task
환자의 **[Primary/Secondary 페르소나 충돌]**, **[선택한 항목(Concerns)]**, **[객관적 데이터(Reality)]**, **[행동 신호(Behavior)]**를 종합 분석하여, 
단순한 건강 상태 나열이 아닌 **"환자의 마음(심리)과 몸(행동) 사이의 간극"**을 짚어주는 입체적인 분석 리포트를 작성하십시오.

**핵심 목표:**
1. **만성질환 퍼스트**: 분석의 **80%**는 '대사증후군 5대 지표(혈압, 공복혈당, 중성지방, HDL, 허리둘레)'와 '생활 습관(술, 담배, 수면, 스트레스)'에 집중하십시오.
   - 암/희귀질환은 20% 비중으로, '확인 차원의 옵션'으로만 다루십시오.
2. **생활 언어 사용**: 의학 용어 대신 '술배', '만성 피로', '뒷목 당김', '기름진 피', '혈관 찌꺼기' 등 환자가 직관적으로 이해하는 **일상 용어(Layman's Terms)**를 사용하십시오.
3. **가성비/효율 강조**: "안 하면 큰일 납니다"보다 **"이거 딱 챙기면 1년 농사 편해집니다"**, **"지금 잡으면 나중에 큰돈 깨질 일 막습니다"**라는 톤을 유지하십시오.
4. **페르소나 충돌 분석**: 겉으로 드러난 걱정(Primary)과 실제 행동(Secondary) 사이의 모순을 짚어주십시오.

**중요: "걱정", "불안" 표현 가이드**
- **허용**: 환자의 감정에 공감하는 맥락(Empathy Context)에서는 사용 가능합니다. (예: "가족력 때문에 늘 불안한 마음, 충분히 이해합니다.")
- **금지**: 훈계조("지나친 걱정은 병이 됩니다")나 진단적 표현("불안 장애가 의심됩니다")은 절대 금지합니다.


{patient_info}
{concerns_section}
{reality_section}
{behavior_section}
{health_data_section}
{prescription_section}
{national_checkup_section}

# Analysis Guidelines (분석 지침 & Clinical Guardrails)

## 1. 3D 입체 분석 및 페르소나 충돌 해석 (핵심)
다음 요소들을 조합하여 분석의 깊이를 더하세요.
- **Persona Conflict**: Primary(본심)와 Secondary(행동)가 충돌하는 지점을 찾으십시오.
  - *Example*: "가족력 때문에 암 공포는 크지만(Worrier), 잦은 회식과 음주를 지속하며 검사를 미루는(Manager) 모순적 패턴"
- **Behavior Signal**: 문항 체류 시간이나 수정 이력(Hesitation)을 통해 환자의 '숨겨진 진심'을 읽어내십시오.
  - *Example*: "음주 문항에서 오래 머뭇거리신 것은, 본인도 줄여야 한다는 걸 알지만 쉽지 않다는 방증입니다."
- **Data Reality**: 실제 수치(검진결과)와 환자의 주관적 인식 차이를 짚어주십시오.

## 2. 팩트 체크 및 만성질환 중심 해석
- **만성질환 우선**: 혈압/혈당/간수치/비만 등 '관리 가능한 영역'을 최우선으로 분석하십시오.
- **수치 해석**:
  - eGFR 60 이상, 혈압 120/80 미만 등 정상 범위 데이터에 대해 절대 '위험'이나 '저하' 표현을 쓰지 마십시오.
  - 정상이면 "엔진 상태 아주 좋습니다", "혈관 탄력 훌륭합니다"와 같이 긍정적이고 비유적인 표현으로 칭찬하십시오.

## 3. 데이터 최신성 확인
- 제공된 건강검진 데이터가 최근 2년 이내가 아니라면, "과거 데이터이므로 현재 상태와 다를 수 있음"을 반드시 명시하세요.

# Output Format (JSON)

반드시 다음 JSON 형식으로만 응답하세요:

{{
  "persona": {{
    "type": "{persona_result.get('primary_persona', 'General')}",
    "primary_type": "{primary_persona}",
    "secondary_type": "{secondary_persona if secondary_persona else 'None'}",
    "combined_type": "{combined_type}",
    "description": "{primary_persona}의 성향이 강하지만, 실제 행동 패턴은 {secondary_persona if secondary_persona else 'None'}에 가까운 복합적 성향",
    "strategy_key": "{persona_result.get('bridge_strategy', 'Standard')}",
    "risk_flags": {json.dumps(persona_result.get('risk_flags', []))}
  }},
  "persona_conflict_summary": "Step 2 전략 수립용 내부 요약. (예: 가족력 때문에 Worrier 성향이 강하지만, 음주/흡연 패턴은 Manager에 가깝습니다. 불안을 줄이기 위해 행동 교정형 전략이 필요합니다.)",
  "concern_vs_reality": {{
    "summary": "선택한 항목과 현실, 그리고 행동 패턴을 종합한 요약",
    "match_type": "Match(일치) / Over_Concern(과도한관심) / Hidden_Risk(숨겨진위험)",
    "message": "환자에게 전할 핵심 메시지 (친근하고 현실적인 톤)"
  }},
  "patient_summary": "환자 상태 3줄 요약 (과거 검진 이력, 현재 건강 상태, 주요 행동 패턴) - 명쾌한 톤 사용",
  "analysis": "종합 분석 (Persona Conflict + Behavior + Data Reality). **80%는 생활습관/만성질환, 20%는 암/특이사항 위주로 작성.** 어려운 용어 대신 '생활 언어(술배, 기름진 피 등)' 사용. 문단 구분: 1. 팩트/생활습관 요약, 2. 심리적 모순과 행동 데이터 해석.",
  "risk_profile": [
    {{
      "organ_system": "대상 장기 (예: 위, 간, 심뇌혈관)",
      "risk_level": "Low / Moderate / High / Very High (시스템 지식 베이스 기준)",
      "reason": "판단 근거 (데이터+문진+행동). (예: 가족력 문항에서 망설이신 점을 보아 우려가 크신 것으로 보입니다)"
    }}
  ],
  "chronic_analysis": {{
    "has_chronic_disease": true/false,
    "disease_list": ["고혈압", "당뇨" 등],
    "complication_risk": "만성질환으로 인해 확인해야 할 합병증 타겟 (예: 고혈압이 있어 눈/콩팥/심장 확인 필요)"
  }},

  "survey_reflection": "문진 내용 및 행동 패턴이 검진 설계에 어떻게 반영될지 예고. **'내 몸의 대사 엔진(간, 혈관, 콩팥) 상태 점검'**과 같은 생활 밀착형 목표 제시.",
  "selected_concerns_analysis": [
    {{
      "concern_name": "염려 항목명 (예: 건강검진 (2020년 09/28) [이상])",
      "concern_type": "checkup|hospital|medication",
      "trend_analysis": "과거 추이 분석",
      "reflected_in_design": "검진 설계에 어떻게 반영될지",
      "related_items": []
    }}
  ],
  
  **중요 규칙 (concern_name):**
  - concern_name에는 반드시 년도가 포함되어야 합니다
  - status는 한글로 표시하세요: "[이상]", "[경계]"
  
  "loading_messages": [
    "메시지 1: 데이터 확인 및 인사 (친근한 톤)",
    "메시지 2: 문진 내용 반영 (핵심 키워드 포함)",
    "메시지 3: 설계 방향 예고 (안심/기대감 부여)"
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

## analysis & risk_profile
- eGFR 60 이상인 경우, 절대 신장 관련 'High Risk'를 주지 마세요.
- 문진에서 '신장' 관련 항목을 선택했더라도, 수치가 정상이면 "콩팥 필터 기능 아주 깨끗합니다"라고 안심시키는 분석을 작성하세요.
- **행동 데이터 활용**: "설문 작성 시 오래 고민하신 점을 보아..."와 같이 사용자의 행동을 읽어주면 신뢰도가 높아집니다.
- **페르소나 톤앤매너 적용**: Casual & Smart (친근한 멘토, 형/오빠/친구 톤)

## basic_checkup_guide
- 기본 검진 항목 중에서 주의 깊게 봐야 할 항목 식별
- focus_items는 hospital_national_checkup에 포함된 항목만

**검진 항목 추천은 포함하지 마세요. 분석만 수행하세요.**

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return {
        "prompt": prompt,
        "persona_result": persona_result
    }
