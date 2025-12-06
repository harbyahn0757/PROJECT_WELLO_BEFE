"""
검진 설계 프롬프트 상수
- 위험도 분석 로직
- 생애주기 가이드라인
- 브릿지 전략 (Gap-Fill 세일즈 논리)
"""

# 1. 위험도 분석 로직 (Risk Stratification)
RISK_ANALYSIS_LOGIC_JSON = """
{
  "organs": {
    "stomach": {
      "name": "위 (Stomach)",
      "baseline_conditions": ["위축성 위염", "헬리코박터 보균", "가족력 (부모 형제)"],
      "smoking": { "weight": 1.5, "description": "흡연은 위암 위험을 1.5배 증가" },
      "age_threshold": 40,
      "logic": {
        "Very High Risk": "baseline + 흡연 or 가족력",
        "High Risk": "baseline 1개 이상",
        "Moderate Risk": "40세 이상 or 음주/짠음식",
        "Low Risk": "40세 미만 + 위험 요인 없음"
      }
    },
    "liver": {
      "name": "간 (Liver)",
      "baseline_conditions": ["B형/C형 간염", "지방간", "간경화 초기"],
      "alcohol": { "weight": 2.0, "description": "주 3회 이상 음주는 간암 위험 2배" },
      "age_threshold": 40,
      "logic": {
        "Very High Risk": "baseline + 알코올",
        "High Risk": "baseline 1개 이상",
        "Moderate Risk": "40세 이상 + 음주 or 비만",
        "Low Risk": "위험 요인 없음"
      }
    },
    "lung": {
      "name": "폐 (Lung)",
      "baseline_conditions": ["직계 가족력", "20갑년 이상 흡연"],
      "smoking": { "weight": 10.0, "description": "흡연은 폐암 1차 위험 요인" },
      "age_threshold": 50,
      "logic": {
        "Very High Risk": "흡연 20갑년 이상 + 50세 이상",
        "High Risk": "현재 흡연자 or 가족력",
        "Moderate Risk": "과거 흡연자 or 간접흡연",
        "Low Risk": "비흡연 + 가족력 없음"
      }
    },
    "cardiovascular": {
      "name": "심뇌혈관 (Cardiovascular)",
      "baseline_conditions": ["고혈압", "당뇨", "고지혈증", "비만 (BMI 25 이상)"],
      "family_history": { "weight": 2.0, "description": "직계 가족력 있으면 위험 2배" },
      "age_threshold": 40,
      "logic": {
        "Very High Risk": "baseline 2개 이상 + 흡연",
        "High Risk": "baseline 1개 이상",
        "Moderate Risk": "40세 이상 + 스트레스/운동부족",
        "Low Risk": "위험 요인 없음"
      }
    },
    "colon": {
      "name": "대장 (Colon)",
      "baseline_conditions": ["대장 용종 이력", "가족력 (부모 형제)", "크론병/궤양성 대장염"],
      "age_threshold": 45,
      "logic": {
        "Very High Risk": "가족력 + 대장 용종 이력",
        "High Risk": "가족력 or 용종 이력",
        "Moderate Risk": "45세 이상 + 비만 or 음주/흡연",
        "Low Risk": "45세 미만 + 위험 요인 없음"
      }
    },
    "breast": {
      "name": "유방 (Breast)",
      "applicable_gender": "F",
      "baseline_conditions": ["가족력 (직계 여성)", "조기 초경 (12세 이전)", "늦은 폐경 (55세 이후)", "출산 경험 없음"],
      "age_threshold": 40,
      "logic": {
        "Very High Risk": "가족력 + baseline 1개 이상",
        "High Risk": "가족력 or baseline 2개",
        "Moderate Risk": "40세 이상 여성",
        "Low Risk": "40세 미만 + 가족력 없음"
      }
    },
    "prostate": {
      "name": "전립선 (Prostate)",
      "applicable_gender": "M",
      "baseline_conditions": ["가족력 (직계 남성)", "전립선비대증"],
      "age_threshold": 50,
      "logic": {
        "Very High Risk": "가족력 + 50세 이상",
        "High Risk": "가족력 or 전립선비대증",
        "Moderate Risk": "50세 이상 남성",
        "Low Risk": "50세 미만 + 가족력 없음"
      }
    },
    "thyroid": {
      "name": "갑상선 (Thyroid)",
      "baseline_conditions": ["가족력", "결절 이력", "방사선 노출 이력"],
      "gender_weight": { "F": 1.5, "description": "여성이 남성보다 1.5배 위험" },
      "logic": {
        "Very High Risk": "가족력 + 결절 이력",
        "High Risk": "가족력 or 결절",
        "Moderate Risk": "30세 이상 여성",
        "Low Risk": "위험 요인 없음"
      }
    }
  }
}
"""

# 2. 생애주기 및 만성질환 가이드
PROFILE_GUIDELINE_JSON = """
{
  "life_stage_priorities": {
    "30s": ["대사 체크 (당뇨/고지혈증)", "갑상선", "간 기능"],
    "40s": ["5대 암 검진 시작", "심혈관 위험도 평가"],
    "50s": ["뇌혈관 정밀 검사", "골다공증 (여성)", "전립선 (남성)"],
    "60s": ["인지기능 평가", "폐기능 정밀", "복합 합병증 관리"]
  },
  "chronic_disease_complications": {
    "고혈압": ["뇌졸중 위험 (뇌 MRA)", "신장 기능 (크레아티닌)", "심비대 (심초음파)"],
    "당뇨": ["망막병증 (안저검사)", "신장병증 (미세알부민뇨)", "신경병증 (말초신경전도)"],
    "고지혈증": ["동맥경화 (경동맥 초음파)", "심근경색 위험 (칼슘 스코어)", "간 지방 축적"]
  }
}
"""

# 3. 브릿지 전략 및 근거 DB (Step 2용 - 세일즈 논리)
BRIDGE_STRATEGY_JSON = """
[
  {
    "target": "혈관 관리 (고혈압/고지혈증)",
    "anchor": "혈압 수치와 콜레스테롤 수치는 혈관 건강의 기본 지표입니다.",
    "gap": "하지만 수치만으로는 혈관벽이 실제로 얼마나 두꺼워졌는지(동맥경화), 혈관 찌꺼기(플라크)가 쌓여있는지는 알 수 없습니다.",
    "offer": "경동맥 초음파를 통해 혈관 내부 상태를 눈으로 직접 확인하여, 뇌졸중 위험을 선제적으로 차단해야 합니다."
  },
  {
    "target": "대사증후군 (비만/지방간)",
    "anchor": "체중(BMI)과 간 수치(AST/ALT) 확인은 건강 관리의 시작입니다.",
    "gap": "하지만 간 수치가 정상이라도, 간이 지방으로 인해 딱딱하게 굳어가는 '섬유화' 진행 여부는 혈액검사로 알 수 없습니다.",
    "offer": "간 섬유화 스캔으로 간의 '탄력성'을 정밀 측정하여, 돌이킬 수 없는 간경변 변화를 막아야 합니다."
  },
  {
    "target": "만성염증/활력",
    "anchor": "기본 검진으로 빈혈이나 염증 수치를 확인하셨습니다.",
    "gap": "하지만 '병이 없는 상태'와 '최상의 활력 상태'는 다릅니다. 세포 내 에너지 대사 기능이나 미세 염증은 기본 검진에서 놓치기 쉽습니다.",
    "offer": "정밀 대사 검사(유기산 등)를 통해 내 몸의 에너지 효율을 확인해보세요."
  },
  {
    "target": "위암/소화기",
    "anchor": "위내시경으로 위 내부 표면을 확인하는 것은 기본입니다.",
    "gap": "하지만 내시경만으로는 위벽 안쪽으로 자라는 암이나, 췌장/담낭 같은 주변 장기의 미세 병변은 볼 수 없습니다.",
    "offer": "복부 조영 CT나 정밀 초음파를 더해 '겉'과 '속'을 동시에 확인해야 완벽합니다."
  },
  {
    "target": "폐암",
    "anchor": "기본 흉부 X-ray는 폐 건강 확인의 기초입니다.",
    "gap": "하지만 심장 뒤나 뼈에 가려진 '사각지대'의 초기 암이나, 1cm 미만의 미세 결절은 X-ray에서 보이지 않을 확률이 높습니다.",
    "offer": "저선량 흉부 CT로 폐의 구석구석을 단층 촬영하여 사각지대를 없애야 합니다."
  },
  {
    "target": "뇌혈관",
    "anchor": "혈압 관리를 잘 하고 계시지만, 혈관 속 사정은 알 수 없습니다.",
    "gap": "뇌 MRI는 '구조(종양)'를 보지만, 뇌졸중의 원인인 '혈관(꽈리, 막힘)'은 MRA나 경동맥 초음파로만 확인 가능합니다.",
    "offer": "뇌 MRA 또는 경동맥 초음파를 통해 뇌로 가는 혈관길이 안전한지 직접 눈으로 확인하세요."
  },
  {
    "target": "대장암",
    "anchor": "분변잠혈검사는 대장암 선별의 기본입니다.",
    "gap": "하지만 분변잠혈검사는 정확도가 낮고, 내시경은 준비 과정이 고통스러워 기피하는 경우가 많습니다.",
    "offer": "분변 속 암세포 DNA만 정밀 분석하여 90% 정확도로 대장암을 찾아내는 정밀 검사가 필요합니다."
  }
]
"""

