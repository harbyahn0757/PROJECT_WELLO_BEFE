"""
검진설계 문진 → Mediarc 코드 매핑 로직 검증 스크립트
====================================================

## 목적
questionnaire_mapper.py의 매핑 로직이 올바르게 동작하는지 검증합니다.

## 테스트 케이스

1. **완전한 문진 데이터**: 모든 필드가 채워진 경우
2. **부분 문진 데이터**: 일부 필드만 있는 경우
3. **빈 문진 데이터**: 모든 필드가 비어있는 경우
4. **실제 DB 데이터**: 실제 저장된 문진 데이터로 테스트

## 실행 방법
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
python scripts/test_questionnaire_mapping.py
```
"""

import sys
sys.path.insert(0, '.')

from app.services.mediarc.questionnaire_mapper import map_checkup_design_survey_to_mediarc
from app.services.mediarc.questionnaire_constants import (
    SMOKING_MAP,
    DRINKING_MAP,
    FAMILY_HISTORY_MAP,
    DEFAULT_CODES
)


def test_complete_survey():
    """
    테스트 1: 완전한 문진 데이터
    
    실제 검진설계에서 수집 가능한 모든 필드를 포함한 테스트
    """
    print("=" * 80)
    print("테스트 1: 완전한 문진 데이터")
    print("=" * 80)
    
    survey = {
        "smoking": "current_smoker",
        "drinking": "weekly_1_2",
        "family_history": ["heart_disease", "diabetes", "hypertension"],
        "exercise_frequency": "sometimes",
        "sleep_hours": "6_7",
        "daily_routine": ["physical_job", "mental_stress"],
        "weight_change": "decrease_bad",
        "additional_concerns": "최근 두통이 자주 발생합니다"
    }
    
    result = map_checkup_design_survey_to_mediarc(survey)
    
    # 검증
    assert result["smoke"] == "SMK0003", f"흡연 매핑 오류: expected SMK0003, got {result['smoke']}"
    assert result["drink"] == "DRK0002", f"음주 매핑 오류: expected DRK0002, got {result['drink']}"
    assert "FH0006" in result["family"], f"가족력 심혈관질환 누락"
    assert "FH0004" in result["family"], f"가족력 당뇨 누락"
    assert "FH0002" in result["family"], f"가족력 고혈압 누락"
    assert result["disease"] == ["DIS0001"], f"질환 기본값 오류"
    assert result["cancer"] == ["CNR0001"], f"암 기본값 오류"
    
    print("✅ 입력:")
    print(f"   - smoking: {survey['smoking']}")
    print(f"   - drinking: {survey['drinking']}")
    print(f"   - family_history: {survey['family_history']}")
    print("\n✅ 출력:")
    print(f"   - smoke: {result['smoke']}")
    print(f"   - drink: {result['drink']}")
    print(f"   - family: {result['family']}")
    print(f"   - disease: {result['disease']}")
    print(f"   - cancer: {result['cancer']}")
    print("\n✅ 테스트 1 통과!\n")


def test_minimal_survey():
    """
    테스트 2: 최소한의 문진 데이터
    
    흡연, 음주만 있고 나머지는 비어있는 경우
    """
    print("=" * 80)
    print("테스트 2: 최소한의 문진 데이터")
    print("=" * 80)
    
    survey = {
        "smoking": "non_smoker",
        "drinking": "never"
    }
    
    result = map_checkup_design_survey_to_mediarc(survey)
    
    # 검증
    assert result["smoke"] == "SMK0001", f"비흡연 매핑 오류"
    assert result["drink"] == "DRK0001", f"안마심 매핑 오류"
    assert result["family"] == ["FH0001"], f"가족력 기본값 오류"
    assert result["disease"] == ["DIS0001"], f"질환 기본값 오류"
    assert result["cancer"] == ["CNR0001"], f"암 기본값 오류"
    
    print("✅ 모든 기본값이 올바르게 설정됨")
    print(f"   - family: {result['family']}")
    print(f"   - disease: {result['disease']}")
    print(f"   - cancer: {result['cancer']}")
    print("\n✅ 테스트 2 통과!\n")


def test_none_in_family_history():
    """
    테스트 3: 가족력에 "없음" 포함
    
    "none"이 포함되면 다른 값은 무시해야 함
    """
    print("=" * 80)
    print("테스트 3: 가족력 '없음' 처리")
    print("=" * 80)
    
    survey = {
        "smoking": "ex_smoker",
        "drinking": "monthly_1_2",
        "family_history": ["none", "diabetes"]  # "none"과 "diabetes" 동시 선택
    }
    
    result = map_checkup_design_survey_to_mediarc(survey)
    
    # 검증: "none"이 있으면 다른 값 무시
    assert result["family"] == ["FH0001"], f"가족력 'none' 처리 오류: {result['family']}"
    
    print("✅ 'none' 포함 시 다른 값 무시됨")
    print(f"   - 입력: {survey['family_history']}")
    print(f"   - 출력: {result['family']}")
    print("\n✅ 테스트 3 통과!\n")


def test_drinking_approximation():
    """
    테스트 4: 음주 빈도 근사 매핑
    
    월 단위 빈도를 주 단위로 근사하는 로직 검증
    """
    print("=" * 80)
    print("테스트 4: 음주 빈도 근사 매핑")
    print("=" * 80)
    
    test_cases = [
        ("never", "DRK0001", "전혀 안 함"),
        ("monthly_less", "DRK0001", "월 1회 미만 → 안마심"),
        ("monthly_1_2", "DRK0002", "월 1-2회 → 주 1-2회로 근사"),
        ("weekly_1_2", "DRK0002", "주 1-2회 → 정확 매칭"),
        ("weekly_3plus", "DRK0003", "주 3회 이상 → 주 3-4회로 근사")
    ]
    
    for drinking_val, expected_code, description in test_cases:
        survey = {"drinking": drinking_val}
        result = map_checkup_design_survey_to_mediarc(survey)
        
        assert result["drink"] == expected_code, f"{drinking_val} 매핑 오류: expected {expected_code}, got {result['drink']}"
        print(f"✅ {drinking_val} → {expected_code} ({description})")
    
    print("\n✅ 테스트 4 통과!\n")


def test_real_db_data():
    """
    테스트 5: 실제 DB 데이터
    
    환자 701c1959-d39b-452f-9f1e-ddcc9a483d29의 실제 검진설계 문진 데이터
    """
    print("=" * 80)
    print("테스트 5: 실제 DB 데이터")
    print("=" * 80)
    
    # 실제 DB에서 조회한 데이터 (2026-01-21 23:10:49)
    real_survey = {
        "smoking": "current_smoker",
        "drinking": "weekly_1_2",
        "sleep_hours": "6_7",
        "daily_routine": ["physical_job", "mental_stress"],
        "weight_change": "decrease_bad",
        "family_history": ["heart_disease", "diabetes"],
        "exercise_frequency": "sometimes",
        "additional_concerns": ""
    }
    
    result = map_checkup_design_survey_to_mediarc(real_survey)
    
    # 검증
    assert result["smoke"] == "SMK0003", "흡연 매핑 오류"
    assert result["drink"] == "DRK0002", "음주 매핑 오류"
    assert "FH0006" in result["family"], "심혈관질환 누락"
    assert "FH0004" in result["family"], "당뇨 누락"
    assert len(result["family"]) == 2, f"가족력 개수 오류: expected 2, got {len(result['family'])}"
    
    print("✅ 실제 DB 데이터 매핑 성공:")
    print(f"   - 흡연: current_smoker → {result['smoke']}")
    print(f"   - 음주: weekly_1_2 → {result['drink']}")
    print(f"   - 가족력: {real_survey['family_history']} → {result['family']}")
    print("\n✅ 테스트 5 통과!\n")


def test_empty_survey():
    """
    테스트 6: 빈 문진 데이터
    
    모든 필드가 없는 경우 기본값 처리 확인
    """
    print("=" * 80)
    print("테스트 6: 빈 문진 데이터 (기본값 테스트)")
    print("=" * 80)
    
    survey = {}
    
    result = map_checkup_design_survey_to_mediarc(survey)
    
    # 모든 필드가 기본값이어야 함
    assert result["smoke"] == DEFAULT_CODES["smoke"], "흡연 기본값 오류"
    assert result["drink"] == DEFAULT_CODES["drink"], "음주 기본값 오류"
    assert result["family"] == DEFAULT_CODES["family"], "가족력 기본값 오류"
    assert result["disease"] == DEFAULT_CODES["disease"], "질환 기본값 오류"
    assert result["cancer"] == DEFAULT_CODES["cancer"], "암 기본값 오류"
    
    print("✅ 모든 기본값이 올바르게 설정됨:")
    print(f"   - smoke: {result['smoke']}")
    print(f"   - drink: {result['drink']}")
    print(f"   - family: {result['family']}")
    print(f"   - disease: {result['disease']}")
    print(f"   - cancer: {result['cancer']}")
    print("\n✅ 테스트 6 통과!\n")


if __name__ == "__main__":
    print("\n")
    print("🧪 " + "=" * 74)
    print("🧪 검진설계 문진 → Mediarc 코드 매핑 로직 검증")
    print("🧪 " + "=" * 74)
    print("\n")
    
    try:
        test_complete_survey()
        test_minimal_survey()
        test_none_in_family_history()
        test_drinking_approximation()
        test_real_db_data()
        test_empty_survey()
        
        print("=" * 80)
        print("🎉 모든 테스트 통과!")
        print("=" * 80)
        print("\n✅ 매핑 로직 검증 완료")
        print("   - 상수 기반 매핑: 정상 작동")
        print("   - 기본값 처리: 정상 작동")
        print("   - 예외 처리: 정상 작동")
        print("   - 실제 DB 데이터: 정상 작동")
        print("\n")
        
    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
