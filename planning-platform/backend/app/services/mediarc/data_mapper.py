"""
Tilko 검진 데이터를 Mediarc/Twobecon 형식으로 변환
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid
from .constants import (
    CHECKUP_FIELD_MAPPING,
    GENDER_MAP,
    DEFAULT_TID_PREFIX,
    DRINK_CODES,
    SMOKE_CODES,
    FAMILY_CODES,
    DISEASE_CODES,
    CANCER_CODES,
)


def map_checkup_to_twobecon(
    checkup_data: Dict[str, Any],
    patient_info: Dict[str, Any],
    questionnaire_data: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Tilko 검진 데이터를 Twobecon 형식으로 변환
    
    Args:
        checkup_data: Tilko 검진 데이터 (단일 검진 기록)
        patient_info: 환자 정보 (name, birth_date, gender)
        questionnaire_data: 문진 응답 데이터 (선택)
        
    Returns:
        Twobecon 형식 데이터
    """
    
    # 1. Transaction ID 생성
    tid = f"{DEFAULT_TID_PREFIX}{uuid.uuid4().hex[:8]}"
    
    # 2. 생년월일 변환
    birth_date = patient_info.get('birth_date', '')
    birth = None
    
    if birth_date:
        if isinstance(birth_date, str):
            if len(birth_date) == 10 and '-' in birth_date:
                birth = birth_date  # YYYY-MM-DD 형식
            elif len(birth_date) == 8 and birth_date.isdigit():
                # YYYYMMDD 형식을 YYYY-MM-DD로 변환
                birth = f"{birth_date[:4]}-{birth_date[4:6]}-{birth_date[6:8]}"
        elif hasattr(birth_date, 'isoformat'):
            # date 객체인 경우
            birth = birth_date.isoformat()
        else:
            try:
                birth = str(birth_date)
            except:
                pass
    
    # 생년월일이 여전히 없거나 "None" 문자열인 경우 기본값 사용 안 함 (메디아크 API 에러 방지)
    if not birth or birth == "None" or birth == "null":
        birth = None  # 기본값 대신 None으로 설정하여 메디아크 API에서 에러 발생시키기
    
    # 3. 성별 변환
    gender_str = patient_info.get('gender', 'M')
    gender = GENDER_MAP.get(gender_str, 1)  # 기본값: 남성
    
    # 4. 검진 데이터 변환
    inspections = checkup_data.get('Inspections', [])
    checkup_dict = _extract_checkup_values(inspections)
    
    # 검진 날짜 추출
    checkup_date = checkup_data.get('CheckUpDate', '')
    year = checkup_data.get('Year', '')
    
    # YYYY-MM-DD 형식으로 변환
    if year and checkup_date:
        # Year: "2021년", CheckUpDate: "09/28" 형태
        year_num = year.replace('년', '').strip()
        month_day = checkup_date.strip()
        try:
            checkup_date_formatted = f"{year_num}-{month_day.replace('/', '-')}"
        except:
            checkup_date_formatted = datetime.now().strftime('%Y-%m-%d')
    else:
        checkup_date_formatted = datetime.now().strftime('%Y-%m-%d')
    
    checkup_dict['date'] = checkup_date_formatted
    
    # 5. Twobecon 데이터 구조 생성
    twobecon_data = {
        "tid": tid,
        "birth": birth,
        "gender": gender,
        "checkup": checkup_dict,
    }
    
    # 6. 문진 데이터 추가 (없으면 기본값 사용)
    if questionnaire_data:
        # 음주
        twobecon_data['drink'] = questionnaire_data.get('drink', 'DRK0002')  # 기본: 아니요
        
        # 흡연
        twobecon_data['smoke'] = questionnaire_data.get('smoke', 'SMK0003')  # 기본: 아니요
        
        # 가족력
        twobecon_data['family'] = questionnaire_data.get('family', ['FH0001'])  # 기본: 없음
        
        # 질환
        twobecon_data['disease'] = questionnaire_data.get('disease', ['DIS0001'])  # 기본: 없음
        
        # 암
        twobecon_data['cancer'] = questionnaire_data.get('cancer', ['CNR0001'])  # 기본: 없음
    else:
        # 문진 데이터 없음 → 기본값 (없음) 사용
        twobecon_data['drink'] = 'DRK0002'  # 아니요
        twobecon_data['smoke'] = 'SMK0003'  # 아니요
        twobecon_data['family'] = ['FH0001']  # 없음
        twobecon_data['disease'] = ['DIS0001']  # 없음
        twobecon_data['cancer'] = ['CNR0001']  # 없음
    
    return twobecon_data


def _extract_checkup_values(inspections: List[Dict]) -> Dict[str, Any]:
    """
    Tilko Inspections 배열에서 검진 수치 추출
    
    Args:
        inspections: Tilko Inspections 배열
        
    Returns:
        Twobecon checkup 형식 딕셔너리
    """
    
    checkup = {
        # 필수 필드 (기본값 설정)
        "height": 0.0,
        "weight": 0.0,
        "waist": 0.0,
        "bmi": 0.0,
        "sbp": 0.0,
        "dbp": 0.0,
        "fbs": 0.0,
        "scr": 0.0,
        "ast": 0.0,
        "alt": 0.0,
        "gpt": 0.0,
        # 선택 필드
        "tc": 0.0,
        "hdl": 0.0,
        "tg": 0.0,
        "ldl": 0.0,
        "gfr": 0.0,
        "hgb": 0.0,
        "up": "",
        "tb": "정상",
    }
    
    # Inspections 배열에서 값 추출 (중첩 구조 파싱)
    for inspection in inspections:
        illnesses = inspection.get('Illnesses', [])
        
        for illness in illnesses:
            items = illness.get('Items', [])
            
            for item in items:
                name = item.get('Name', '')
                value_str = item.get('Value', '')
                
                # 혈압 특수 처리 (최고/최저가 하나의 항목)
                if '혈압' in name and '/' in value_str:
                    try:
                        parts = value_str.split('/')
                        if len(parts) >= 2:
                            checkup['sbp'] = float(parts[0].strip())
                            checkup['dbp'] = float(parts[1].strip())
                    except (ValueError, IndexError):
                        pass
                    continue  # 혈압은 매핑 체크 건너뛰기
                
                # CHECKUP_FIELD_MAPPING에서 Tilko → Twobecon 필드명 매핑 확인
                for tilko_name, twobecon_name in CHECKUP_FIELD_MAPPING.items():
                    if tilko_name in name or tilko_name.lower() in name.lower():
                        try:
                            # 일반 숫자 변환
                            value = float(value_str) if value_str else 0.0
                            checkup[twobecon_name] = value
                        except ValueError:
                            # 변환 실패 시 0.0 유지
                            pass
                        break
    
    # BMI 자동 계산 (없으면)
    if checkup['bmi'] == 0.0 and checkup['height'] > 0 and checkup['weight'] > 0:
        height_m = checkup['height'] / 100  # cm → m
        checkup['bmi'] = round(checkup['weight'] / (height_m ** 2), 2)
    
    return checkup


def map_questionnaire_to_codes(questionnaire_answers: Dict[str, Any]) -> Dict[str, Any]:
    """
    사용자 문진 응답을 Mediarc 코드로 변환
    
    Args:
        questionnaire_answers: 문진 응답 데이터
        
    Returns:
        Mediarc 코드 형식 데이터
    """
    
    codes = {}
    
    # 음주 코드 변환
    if 'drink_frequency' in questionnaire_answers:
        freq = questionnaire_answers['drink_frequency']
        codes['drink'] = DRINK_CODES.get(freq, DRINK_CODES['none'])
    
    # 흡연 코드 변환
    if 'smoke_status' in questionnaire_answers:
        status = questionnaire_answers['smoke_status']
        codes['smoke'] = SMOKE_CODES.get(status, SMOKE_CODES['never'])
    
    # 가족력 코드 변환
    if 'family_history' in questionnaire_answers:
        family_list = questionnaire_answers['family_history']
        codes['family'] = [FAMILY_CODES.get(item, item) for item in family_list]
    
    # 질환 코드 변환
    if 'current_diseases' in questionnaire_answers:
        disease_list = questionnaire_answers['current_diseases']
        codes['disease'] = [DISEASE_CODES.get(item, item) for item in disease_list]
    
    # 암 코드 변환
    if 'cancer_history' in questionnaire_answers:
        cancer_list = questionnaire_answers['cancer_history']
        codes['cancer'] = [CANCER_CODES.get(item, item) for item in cancer_list]
    
    return codes


def map_partner_data_to_twobecon(
    partner_data: Dict[str, Any],
    partner_id: str
) -> Dict[str, Any]:
    """
    파트너 암호화 데이터를 Twobecon 형식으로 변환 (MediLinx 약어 필드 지원)
    
    Args:
        partner_data: 복호화된 파트너 데이터 (약어 필드 포함)
        partner_id: 파트너 ID
        
    Returns:
        Twobecon 형식 데이터
    """
    
    # 1. Transaction ID 생성
    tid = f"{partner_id}_{uuid.uuid4().hex[:8]}"
    
    # 2. 기본 정보 (생년월일, 성별 정규화)
    birth = partner_data.get('birth', partner_data.get('birth_date', '1990-01-01'))
    
    # 성별 정규화 (1/M/m -> 1, 2/F/f -> 2)
    gender_raw = str(partner_data.get('gender', '1')).upper()
    if gender_raw in ['1', 'M']:
        gender = 1
    elif gender_raw in ['2', 'F']:
        gender = 2
    else:
        gender = 1 # 기본값 남성
    
    # 3. 수치 데이터 변환 유틸
    def to_float(val, default=0.0):
        try:
            if val is None or val == '': return default
            return float(val)
        except (ValueError, TypeError):
            return default

    # 4. 검진 데이터 매핑 (MediLinx 약어 필드 우선 대응)
    checkup = {
        "date": partner_data.get('checkup_date', datetime.now().strftime('%Y-%m-%d')),
        "height": to_float(partner_data.get('height')),
        "weight": to_float(partner_data.get('weight')),
        "waist": to_float(partner_data.get('waist', partner_data.get('waist_circumference'))),
        "sbp": to_float(partner_data.get('bphigh', partner_data.get('bpHigh', partner_data.get('blood_pressure_high')))),
        "dbp": to_float(partner_data.get('bplwst', partner_data.get('bpLwst', partner_data.get('blood_pressure_low')))),
        "fbs": to_float(partner_data.get('blds', partner_data.get('blood_sugar'))),
        "tc": to_float(partner_data.get('totchole', partner_data.get('totChole', partner_data.get('cholesterol')))),
        "hdl": to_float(partner_data.get('hdlchole', partner_data.get('hdlChole', partner_data.get('hdl_cholesterol')))),
        "ldl": to_float(partner_data.get('ldlchole', partner_data.get('ldlChole', partner_data.get('ldl_cholesterol')))),
        "tg": to_float(partner_data.get('triglyceride', partner_data.get('tg'))),
        "scr": to_float(partner_data.get('creatinine', partner_data.get('scr'))),
        "ast": to_float(partner_data.get('sgotast', partner_data.get('sgotAst', partner_data.get('ast')))),
        "alt": to_float(partner_data.get('sgptalt', partner_data.get('sgptAlt', partner_data.get('alt')))),
        "gpt": to_float(partner_data.get('gammagtp', partner_data.get('gammaGtp', partner_data.get('gpt')))),
        "gfr": to_float(partner_data.get('gfr')),
        "hgb": to_float(partner_data.get('hmg', partner_data.get('hemoglobin'))),
        "up": str(partner_data.get('oligProteCd', partner_data.get('up', ''))),
        "tb": str(partner_data.get('tuberculosis', partner_data.get('tb', '정상'))),
    }
    
    # BMI 자동 계산 (높이/몸무게 있을 때)
    if to_float(checkup.get('bmi')) == 0.0 and checkup['height'] > 0 and checkup['weight'] > 0:
        height_m = checkup['height'] / 100
        checkup['bmi'] = round(checkup['weight'] / (height_m ** 2), 2)
    else:
        checkup['bmi'] = to_float(partner_data.get('bmi'))
    
    # 5. Twobecon 데이터 구조 조립
    twobecon_data = {
        "tid": tid,
        "birth": birth,
        "gender": gender,
        "checkup": checkup,
        # 문진 데이터 Fallback 처리
        "drink": partner_data.get('drink', 'DRK0002'),
        "smoke": partner_data.get('smoke', 'SMK0003'),
        "family": partner_data.get('family', ['FH0001']),
        "disease": partner_data.get('disease', ['DIS0001']),
        "cancer": partner_data.get('cancer', ['CNR0001'])
    }
    
    return twobecon_data
