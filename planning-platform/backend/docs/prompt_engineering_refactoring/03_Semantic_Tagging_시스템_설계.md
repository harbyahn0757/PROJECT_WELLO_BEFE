# Semantic Tagging 시스템 설계

## 📋 목표
건강검진 수치에 임상적 의미를 부여하여 GPT가 더 정확한 판단을 할 수 있도록 함

---

## 🔴 현재 문제점

### 현재 데이터 전달 방식
```
**경계 항목:**
- 혈압(수축기): 135 mmHg (경계)
- 공복혈당: 110 mg/dL (경계)
- 총콜레스테롤: 240 mg/dL (이상)
```

**GPT의 과제**:
1. 135가 "고혈압 1기"인지 "전단계"인지 판단
2. 110이 "당뇨 전단계"인지 확인
3. 240이 "높음(High)"인지 "매우 높음(Very High)"인지 구분
4. 각 수치의 치료 시급성 판단

**결과**: GPT가 의학 지식을 활용해야 하므로 부정확할 가능성 ↑

---

## 🟢 개선 방안: Semantic Tagging

### 1. 임상 기준 매핑 테이블

```python
CLINICAL_REFERENCE_RANGES = {
    "혈압(수축기)": {
        "ranges": [
            {"min": 0, "max": 120, "level": "정상", "tag": "[정상]", "action": "유지"},
            {"min": 120, "max": 130, "level": "주의", "tag": "[주의]", "action": "생활습관 개선"},
            {"min": 130, "max": 140, "level": "경계", "tag": "[고혈압 1기, 생활습관 개선 필요]", "action": "3개월 후 재검"},
            {"min": 140, "max": 180, "level": "이상", "tag": "[고혈압 2기, 즉시 관리 필요]", "action": "약물 치료 고려"},
            {"min": 180, "max": 999, "level": "위험", "tag": "[고혈압 위기, 응급 조치 필요]", "action": "즉시 의료기관 방문"}
        ],
        "guideline": "2022 대한고혈압학회 진료지침",
        "related_complications": ["뇌졸중", "심근경색", "신부전", "망막병증"]
    },
    
    "공복혈당": {
        "ranges": [
            {"min": 0, "max": 100, "level": "정상", "tag": "[정상]", "action": "유지"},
            {"min": 100, "max": 126, "level": "경계", "tag": "[당뇨 전단계, 3-6개월 후 재검 권장]", "action": "생활습관 개선 + 추적"},
            {"min": 126, "max": 200, "level": "이상", "tag": "[당뇨 진단 기준, 정밀 검사 필요]", "action": "당화혈색소 추가 검사"},
            {"min": 200, "max": 999, "level": "위험", "tag": "[고혈당, 합병증 위험]", "action": "즉시 치료 필요"}
        ],
        "guideline": "2025 당뇨병 진료지침",
        "related_complications": ["망막병증", "신부전", "신경병증", "심혈관질환"]
    },
    
    "총콜레스테롤": {
        "ranges": [
            {"min": 0, "max": 200, "level": "정상", "tag": "[정상]", "action": "유지"},
            {"min": 200, "max": 240, "level": "경계", "tag": "[경계, 심혈관 위험도 주의]", "action": "LDL 세분화 검사"},
            {"min": 240, "max": 999, "level": "이상", "tag": "[높음, 심혈관 위험도 상승]", "action": "지질 프로필 정밀 검사"}
        ],
        "guideline": "2022 이상지질혈증 진료지침",
        "related_complications": ["관상동맥질환", "뇌졸중", "말초혈관질환"]
    },
    
    "LDL콜레스테롤": {
        "ranges": [
            {"min": 0, "max": 100, "level": "정상", "tag": "[목표 범위]", "action": "유지"},
            {"min": 100, "max": 130, "level": "경계", "tag": "[경계]", "action": "위험도 평가 필요"},
            {"min": 130, "max": 160, "level": "이상", "tag": "[높음]", "action": "생활습관 개선 또는 약물"},
            {"min": 160, "max": 999, "level": "위험", "tag": "[매우 높음, 즉시 치료 필요]", "action": "스타틴 시작"}
        ],
        "risk_specific": {
            "초고위험군": {"target": 55, "note": "심혈관질환 병력 있는 경우"},
            "고위험군": {"target": 70, "note": "당뇨 + 다른 위험인자"},
            "중등도위험군": {"target": 100, "note": "위험인자 1-2개"}
        }
    },
    
    "허리둘레": {
        "ranges": {
            "male": [
                {"min": 0, "max": 90, "level": "정상", "tag": "[정상]"},
                {"min": 90, "max": 102, "level": "경계", "tag": "[복부비만 경계, 대사증후군 주의]"},
                {"min": 102, "max": 999, "level": "이상", "tag": "[복부비만, 대사증후군 위험]"}
            ],
            "female": [
                {"min": 0, "max": 85, "level": "정상", "tag": "[정상]"},
                {"min": 85, "max": 102, "level": "경계", "tag": "[복부비만 경계, 대사증후군 주의]"},
                {"min": 102, "max": 999, "level": "이상", "tag": "[복부비만, 대사증후군 위험]"}
            ]
        },
        "metabolic_impact": "허리둘레는 내장지방의 지표. 지방간, 인슐린 저항성, 고혈압의 공통 원인"
    },
    
    "AST": {
        "ranges": [
            {"min": 0, "max": 40, "level": "정상", "tag": "[정상]"},
            {"min": 40, "max": 80, "level": "경계", "tag": "[경도 상승, 원인 확인 필요]"},
            {"min": 80, "max": 200, "level": "이상", "tag": "[중등도 상승, 간질환 의심]"},
            {"min": 200, "max": 999, "level": "위험", "tag": "[고도 상승, 즉시 정밀 검사]"}
        ],
        "limitation": "⚠️ AST 정상이어도 지방간/섬유화 가능. 영상 검사 필수"
    },
    
    "ALT": {
        "ranges": [
            {"min": 0, "max": 40, "level": "정상", "tag": "[정상]"},
            {"min": 40, "max": 80, "level": "경계", "tag": "[경도 상승, 원인 확인 필요]"},
            {"min": 80, "max": 200, "level": "이상", "tag": "[중등도 상승, 간질환 의심]"},
            {"min": 200, "max": 999, "level": "위험", "tag": "[고도 상승, 즉시 정밀 검사]"}
        ],
        "limitation": "⚠️ ALT 정상이어도 지방간/섬유화 가능. 영상 검사 필수"
    },
    
    "크레아티닌": {
        "ranges": {
            "male": [
                {"min": 0, "max": 1.2, "level": "정상", "tag": "[정상]"},
                {"min": 1.2, "max": 2.0, "level": "경계", "tag": "[신기능 저하 의심]"},
                {"min": 2.0, "max": 999, "level": "이상", "tag": "[신기능 장애]"}
            ],
            "female": [
                {"min": 0, "max": 1.0, "level": "정상", "tag": "[정상]"},
                {"min": 1.0, "max": 1.5, "level": "경계", "tag": "[신기능 저하 의심]"},
                {"min": 1.5, "max": 999, "level": "이상", "tag": "[신기능 장애]"}
            ]
        },
        "limitation": "⚠️ 크레아티닌 정상이어도 미세알부민뇨 가능. UACR 검사 필요"
    }
}
```

---

### 2. Semantic Tag 적용 함수

```python
def apply_semantic_tag(
    item_name: str,
    value: str,
    unit: str,
    status: str,  # 병원 판정: "이상", "경계", "정상"
    patient_gender: str = "M"
) -> Dict[str, Any]:
    """
    검사 항목에 임상적 의미 태그 부여
    
    Returns:
        {
            "formatted_text": "혈압(수축기): 135 mmHg [고혈압 1기, 생활습관 개선 필요]",
            "clinical_level": "경계",
            "action_required": "3개월 후 재검",
            "guideline": "2022 대한고혈압학회",
            "related_complications": ["뇌졸중", "심근경색"],
            "limitation": None  // 있는 경우만
        }
    """
    
    # 수치 파싱
    try:
        numeric_value = float(value.replace(',', ''))
    except:
        return {
            "formatted_text": f"- {item_name}: {value} {unit} ({status})",
            "clinical_level": status,
            "action_required": "확인 필요",
            "guideline": None,
            "related_complications": [],
            "limitation": None
        }
    
    # 기준 테이블 조회
    if item_name not in CLINICAL_REFERENCE_RANGES:
        return {
            "formatted_text": f"- {item_name}: {value} {unit} ({status})",
            "clinical_level": status,
            "action_required": "확인 필요",
            "guideline": None,
            "related_complications": [],
            "limitation": None
        }
    
    ref = CLINICAL_REFERENCE_RANGES[item_name]
    
    # 성별 구분 (필요 시)
    if isinstance(ref['ranges'], dict):  # 허리둘레, 크레아티닌
        ranges = ref['ranges'].get(patient_gender.lower(), ref['ranges']['male'])
    else:
        ranges = ref['ranges']
    
    # 매칭
    matched = None
    for r in ranges:
        if r['min'] <= numeric_value < r['max']:
            matched = r
            break
    
    if not matched:
        matched = ranges[-1]  # 범위 초과 시 마지막 (가장 위험)
    
    # 결과 생성
    formatted_text = f"- {item_name}: {value} {unit} {matched['tag']}"
    
    # 한계점 추가 (AST/ALT 같은 경우)
    if ref.get('limitation'):
        formatted_text += f"\n  {ref['limitation']}"
    
    return {
        "formatted_text": formatted_text,
        "clinical_level": matched['level'],
        "action_required": matched.get('action', '확인 필요'),
        "guideline": ref.get('guideline'),
        "related_complications": ref.get('related_complications', []),
        "limitation": ref.get('limitation')
    }
```

---

### 3. 프롬프트 적용 예시

#### Before (현재)
```
## 과거 건강검진 데이터
### 1. 2023년 09/15 - 서울대병원

**경계 항목:**
- 혈압(수축기): 135 mmHg (경계)
- 공복혈당: 110 mg/dL (경계)

**이상 항목:**
- 총콜레스테롤: 240 mg/dL (이상)
```

#### After (개선)
```
## 과거 건강검진 데이터
### 1. 2023년 09/15 - 서울대병원 [Current - 1년 전]

**경계 항목 (주의 필요):**
- 혈압(수축기): 135 mmHg [고혈압 1기 범위, 생활습관 개선 필요]
  📌 가이드라인: 2022 대한고혈압학회
  🎯 조치: 3개월 후 재검 권장
  ⚠️ 합병증 위험: 뇌졸중, 심근경색, 신부전, 망막병증
  
- 공복혈당: 110 mg/dL [당뇨 전단계, 3-6개월 후 재검 권장]
  📌 가이드라인: 2025 당뇨병 진료지침
  🎯 조치: 당화혈색소(HbA1c) 추가 검사 권장
  ⚠️ 합병증 위험: 망막병증, 신부전, 신경병증, 심혈관질환

**이상 항목 (시급):**
- 총콜레스테롤: 240 mg/dL [높음, 심혈관 위험도 상승]
  📌 가이드라인: 2022 이상지질혈증 진료지침
  🎯 조치: LDL 세분화 검사 필요
  ⚠️ 합병증 위험: 관상동맥질환, 뇌졸중

**🔗 시너지 분석:**
혈압(135) + 혈당(110) + 콜레스테롤(240)이 동시 경계/이상 → 대사증후군 가능성 높음
→ 심뇌혈관 위험도 2-3배 증폭. 단독 관리보다 통합 관리 필요.
```

---

### 4. 구현 구조

```python
def format_health_data_with_semantic_tags(
    health_data: List[Dict[str, Any]],
    patient_age: int,
    patient_gender: str
) -> str:
    """
    건강검진 데이터를 Semantic Tag와 함께 포맷팅
    """
    
    health_data_section = "## 과거 건강검진 데이터\n\n"
    
    # 최근 데이터 정렬
    recent_data = sorted(
        health_data, 
        key=lambda x: x.get('checkup_date', ''), 
        reverse=True
    )[:3]
    
    all_abnormal_items = []  # 시너지 분석용
    
    for idx, record in enumerate(recent_data, 1):
        # 날짜 정보
        checkup_date = record.get('checkup_date')
        year = record.get('year')
        hospital_name = record.get('location')
        
        # 시점 분류
        time_tag, time_meaning = classify_data_by_recency(checkup_date)
        
        health_data_section += f"### {idx}. {year}년 - {hospital_name} {time_tag}\n"
        health_data_section += f"**시점 해석**: {time_meaning}\n\n"
        
        # 검사 항목 추출
        raw_data = record.get('raw_data', {})
        if isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        
        abnormal_items = []
        warning_items = []
        
        for inspection in raw_data.get("Inspections", []):
            for illness in inspection.get("Illnesses", []):
                for item in illness.get("Items", []):
                    item_name = item.get("Name")
                    item_value = item.get("Value")
                    item_unit = item.get("Unit")
                    
                    # 병원 판정
                    hospital_status = "정상"
                    for ref in item.get("ItemReferences", []):
                        ref_name = ref.get("Name", "")
                        if "질환의심" in ref_name or "이상" in ref_name:
                            hospital_status = "이상"
                        elif "정상(B)" in ref_name or "경계" in ref_name:
                            hospital_status = "경계"
                    
                    # Semantic Tag 적용
                    tagged = apply_semantic_tag(
                        item_name, item_value, item_unit, hospital_status, patient_gender
                    )
                    
                    # 분류
                    if hospital_status == "이상":
                        abnormal_items.append(tagged)
                        all_abnormal_items.append(tagged)  # 시너지 분석용
                    elif hospital_status == "경계":
                        warning_items.append(tagged)
                        all_abnormal_items.append(tagged)  # 시너지 분석용
        
        # 출력
        if warning_items:
            health_data_section += "**경계 항목 (주의 필요):**\n"
            for item in warning_items:
                health_data_section += item['formatted_text'] + "\n"
                health_data_section += f"  📌 가이드라인: {item['guideline']}\n"
                health_data_section += f"  🎯 조치: {item['action_required']}\n"
                if item['related_complications']:
                    health_data_section += f"  ⚠️ 합병증 위험: {', '.join(item['related_complications'])}\n"
                health_data_section += "\n"
        
        if abnormal_items:
            health_data_section += "**이상 항목 (시급):**\n"
            for item in abnormal_items:
                health_data_section += item['formatted_text'] + "\n"
                health_data_section += f"  📌 가이드라인: {item['guideline']}\n"
                health_data_section += f"  🎯 조치: {item['action_required']}\n"
                if item['related_complications']:
                    health_data_section += f"  ⚠️ 합병증 위험: {', '.join(item['related_complications'])}\n"
                health_data_section += "\n"
        
        if not warning_items and not abnormal_items:
            health_data_section += "이상 소견 없음\n\n"
    
    # 시너지 분석
    if len(all_abnormal_items) >= 2:
        synergy_section = analyze_metabolic_synergy(all_abnormal_items, patient_age)
        health_data_section += f"\n**🔗 시너지 분석:**\n{synergy_section}\n"
    
    return health_data_section


def analyze_metabolic_synergy(items: List[Dict], age: int) -> str:
    """대사증후군 시너지 분석"""
    
    item_names = [item.get('item_name') for item in items]
    
    # 대사증후군 5가지 요소
    metabolic_factors = {
        '혈압': any('혈압' in name for name in item_names),
        '혈당': any('혈당' in name for name in item_names),
        '콜레스테롤': any('콜레스테롤' in name or 'LDL' in name or 'HDL' in name for name in item_names),
        '허리둘레': any('허리' in name for name in item_names),
        '중성지방': any('중성지방' in name or 'TG' in name for name in item_names)
    }
    
    count = sum(metabolic_factors.values())
    
    if count >= 3:
        return f"""
{count}개 대사 요인이 동시 이상 → **대사증후군 가능성 높음**

**악순환 고리**:
복부비만 → 인슐린 저항성 ↑ → 혈당 ↑ → 혈압 ↑ → 혈관 손상 → 심혈관질환

**증폭 효과**: 단독 위험보다 2-3배 위험도 증가. 하나만 관리해도 다른 요인이 다시 악화시킴.

**권장**: 혈당 + 혈압 + 지질 + 체중을 동시에 관리해야 효과적. 
         → 대사 정밀 패키지 검진 권장 (간 섬유화 스캔, 인슐린 저항성, 심혈관 평가)
"""
    elif count == 2:
        return f"""
2개 대사 요인 이상 → 대사증후군 진행 가능성. 조기 관리 필요.
"""
    else:
        return ""
```

---

## 🎯 적용 효과 예측

### GPT 판단 부담 감소
- **Before**: GPT가 135가 위험한지 스스로 판단 (부정확 가능)
- **After**: 시스템이 "[고혈압 1기]" 태그 제공 (정확도 ↑)

### 추천 논리 강화
- **Before**: "혈압이 경계이므로 경동맥 초음파를 권장합니다"
- **After**: "혈압 135 [고혈압 1기] + 당뇨 가족력 → 뇌졸중 위험 2배 ↑ → 경동맥 초음파로 혈관 상태 확인 필요"

### 시너지 분석 자동화
- 대사증후군 3가지 이상 → 자동으로 "통합 관리" 메시지
- 만성질환 연쇄 → 합병증 검사 자동 추천

---

## 📍 코드 수정 위치

### 1. 새 파일 생성
`app/services/semantic_tagging.py`
- `CLINICAL_REFERENCE_RANGES` 상수
- `apply_semantic_tag()` 함수
- `analyze_metabolic_synergy()` 함수
- `classify_data_by_recency()` 함수

### 2. 기존 파일 수정
`app/services/checkup_design_prompt.py`
- `create_checkup_design_prompt_step1()` (line 2095-2161)
  - 기존 단순 포맷팅 → `format_health_data_with_semantic_tags()` 호출

---

## 🧪 테스트 시나리오

### 테스트 1: 대사증후군 패턴
**입력**:
- 혈압 135, 혈당 110, 총콜레스테롤 240, 허리둘레 92

**기대 출력**:
```
4개 대사 요인이 동시 이상 → 대사증후군 진단 기준 충족
악순환 고리: 복부비만 → 인슐린 저항성 → 혈당 상승 → 혈압 상승
권장: 대사 정밀 패키지 (간 섬유화, 인슐린, 심혈관)
```

### 테스트 2: 간수치 정상 + 복부비만
**입력**:
- AST 30 (정상), ALT 35 (정상), 허리둘레 95

**기대 출력**:
```
- AST: 30 U/L [정상]
  ⚠️ AST 정상이어도 지방간/섬유화 가능. 영상 검사 필수
  
- 허리둘레: 95 cm [복부비만 경계, 대사증후군 주의]
  
**권장**: 간수치가 정상이어도 복부비만이 있으므로 간 초음파 + 섬유화 스캔 필요
```

---

## 📅 구현 일정

- **설계 완료**: 2024-12-06 (오늘)
- **구현 예정**: 2024-12-07 (내일)
- **테스트**: 2024-12-08
- **적용**: 2024-12-09

---

**작성자**: AI Assistant  
**최종 수정**: 2024-12-06 15:20

