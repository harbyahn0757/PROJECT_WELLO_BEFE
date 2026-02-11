"""
Mediarc/Twobecon API 상수 및 코드 매핑
"""

# Mediarc API 설정 (기본값 - 동적 조회로 대체됨)
# 실제 사용 시에는 dynamic_config_service에서 파트너별로 조회
MEDIARC_API_URL = "https://xogxog.com/api/external/mediarc/report/"
MEDIARC_API_KEY = "welno_5a9bb40b5108ecd8ef864658d5a2d5ab"  # 기본값

# 음주 코드 (Drink Codes)
DRINK_CODES = {
    "none": "DRK0001",  # 안마심
    "1-2_week": "DRK0002",  # 주 1~2회
    "3-4_week": "DRK0003",  # 주 3~4회
    "almost_daily": "DRK0004",  # 거의매일
}

# 흡연 코드 (Smoke Codes)
SMOKE_CODES = {
    "never": "SMK0001",  # 비흡연
    "past": "SMK0002",  # 과거흡연
    "current": "SMK0003",  # 현재흡연
}

# 가족력 코드 (Family History Codes)
FAMILY_CODES = {
    "hypertension": "FH0001",  # 고혈압
    "diabetes": "FH0002",  # 당뇨병
    "cancer": "FH0003",  # 암
    "heart_disease": "FH0004",  # 심장질환
    "stroke": "FH0005",  # 뇌졸중
}

# 질환 코드 (Disease Codes)
DISEASE_CODES = {
    "hypertension": "DIS0001",  # 고혈압
    "diabetes": "DIS0002",  # 당뇨병
    "dyslipidemia": "DIS0003",  # 이상지질혈증
    "heart_disease": "DIS0004",  # 심장질환
    "stroke": "DIS0005",  # 뇌졸중
    "tuberculosis": "DIS0006",  # 폐결핵
    "kidney_disease": "DIS0007",  # 신장질환
    "liver_disease": "DIS0008",  # 간질환
}

# 암 코드 (Cancer Codes)
CANCER_CODES = {
    "stomach": "CNR0001",  # 위암
    "liver": "CNR0002",  # 간암
    "colon": "CNR0003",  # 대장암
    "breast": "CNR0004",  # 유방암
    "cervical": "CNR0005",  # 자궁경부암
    "lung": "CNR0006",  # 폐암
}

# 성별 매핑
GENDER_MAP = {
    "M": 1,  # 남성
    "F": 0,  # 여성
    "male": 1,
    "female": 0,
}

# 검진 항목 필드 매핑 (Tilko → Twobecon)
# 한글 이름과 영어 이름 모두 지원
CHECKUP_FIELD_MAPPING = {
    # 신장
    "Height": "height",
    "신장": "height",
    
    # 체중
    "Weight": "weight",
    "체중": "weight",
    
    # 허리둘레
    "WaistCircumference": "waist",
    "허리둘레": "waist",
    "복부둘레": "waist",
    
    # 체질량지수
    "BMI": "bmi",
    "체질량지수": "bmi",
    
    # 혈압 (최고 - 수축기)
    "BloodPressureHigh": "sbp",
    "혈압(최고": "sbp",
    "수축기": "sbp",
    
    # 혈압 (최저 - 이완기)  
    "BloodPressureLow": "dbp",
    "혈압(최저": "dbp",
    "이완기": "dbp",
    
    # 공복혈당
    "FastingBloodSugar": "fbs",
    "공복혈당": "fbs",
    "혈당": "fbs",
    
    # 총콜레스테롤
    "TotalCholesterol": "tc",
    "총콜레스테롤": "tc",
    
    # HDL콜레스테롤
    "HDLCholesterol": "hdl",
    "HDL": "hdl",
    
    # LDL콜레스테롤
    "LDLCholesterol": "ldl",
    "LDL": "ldl",
    
    # 중성지방
    "Triglyceride": "tg",
    "중성지방": "tg",
    "트리글리세라이드": "tg",
    
    # 혈청크레아티닌
    "SerumCreatinine": "scr",
    "크레아티닌": "scr",
    "혈청크레아티닌": "scr",
    
    # 신사구체여과율
    "GFR": "gfr",
    "신사구체여과율": "gfr",
    
    # AST
    "AST": "ast",
    
    # ALT
    "ALT": "alt",
    
    # 감마지티피
    "GGT": "gpt",
    "r-GTP": "gpt",
    "감마지티피": "gpt",
    
    # 혈색소
    "Hemoglobin": "hgb",
    "혈색소": "hgb",
    "헤모글로빈": "hgb",
}

# 기본값
DEFAULT_TID_PREFIX = "TM_WELNO_"
DEFAULT_RETURN_TYPE = "both"  # pdf, data, both
