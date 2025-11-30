# 외부 검사 항목 구조 설계 문서

## 개요

외부 검사 종류를 기준 테이블로 관리하고, 병원별로 매핑하는 구조를 설계했습니다.

## 데이터베이스 구조

### 1. 기준 테이블: `wello_external_checkup_items`

외부 검사 종류의 기준 정보를 저장하는 테이블입니다.

**컬럼 구조:**
- `id` (SERIAL PRIMARY KEY): 고유 ID
- `category` (VARCHAR(50)): 카테고리 (암 정밀, 뇌/신경, 심혈관 등)
- `sub_category` (VARCHAR(100)): 세부 분류 (소화기암, 다중암, 여성암 등)
- `item_name` (VARCHAR(200)): 검사명/상품명
- `item_name_en` (VARCHAR(200)): 영문명 (선택)
- `difficulty_level` (VARCHAR(10)): 난이도/비용 (Low, Mid, High)
- `target_trigger` (TEXT): 추천 대상 (Trigger)
- `gap_description` (TEXT): 결핍/한계 (Gap)
- `solution_narrative` (TEXT): 설득 논리 (Solution/Narrative)
- `description` (TEXT): 상세 설명 (선택)
- `is_active` (BOOLEAN): 활성화 여부
- `created_at`, `updated_at`: 생성/수정 시간

**난이도/비용 분류:**
- `Low`: 부담없는
- `Mid`: 추천
- `High`: 프리미엄

### 2. 매핑 테이블: `wello_hospital_external_checkup_mapping`

병원별로 외부 검사 항목을 매핑하는 테이블입니다.

**컬럼 구조:**
- `id` (SERIAL PRIMARY KEY): 고유 ID
- `hospital_id` (VARCHAR(50)): 병원 ID (FK)
- `external_checkup_item_id` (INTEGER): 외부 검사 항목 ID (FK)
- `is_active` (BOOLEAN): 활성화 여부
- `display_order` (INTEGER): 표시 순서
- `created_at`, `updated_at`: 생성/수정 시간

**제약조건:**
- `UNIQUE(hospital_id, external_checkup_item_id)`: 병원별 동일 검사 중복 방지

## 데이터 흐름

### 1. 기준 테이블 데이터 입력

```bash
# 테이블 생성
psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f backend/scripts/create_external_checkup_items_table.sql

# 데이터 입력
python backend/scripts/insert_external_checkup_items.py
```

### 2. 병원별 매핑

```bash
# 전체 목록 보기
python backend/scripts/map_hospital_external_checkup.py list

# 병원에 검사 항목 매핑
python backend/scripts/map_hospital_external_checkup.py map KIM_HW_CLINIC '얼리텍 (대장암)' '아이파인더/아이스크린'
```

### 3. API에서 조회

`wello_data_service.get_hospital_by_id()` 함수에서 자동으로 외부 검사 항목을 조회하여 반환합니다.

**응답 구조:**
```json
{
  "hospital_id": "KIM_HW_CLINIC",
  "hospital_name": "김현우내과의원",
  "external_checkup_items": [
    {
      "id": 1,
      "category": "암 정밀",
      "sub_category": "소화기암",
      "item_name": "얼리텍 (대장암)",
      "difficulty_level": "High",
      "difficulty_badge": "프리미엄",
      "target_trigger": "50대 이상, 대장내시경 약 복용 거부감",
      "gap_description": "분변잠혈검사는 정확도가 낮고, 내시경은 준비 과정이 고통스러움",
      "solution_narrative": "분변 속 암세포 DNA만 정밀 분석하여 90% 정확도로 대장암을 찾아냅니다.",
      "display_order": 0
    }
  ]
}
```

## 프롬프트 통합

외부 검사 항목은 프롬프트의 `hospital_external_checkup` 섹션에 포함되어 GPT에게 전달됩니다.

**프롬프트 구조:**
```
### 외부 검사 항목 (정밀 검진):
[
  {
    "item_name": "얼리텍 (대장암)",
    "category": "암 정밀",
    "difficulty_level": "High",
    "target_trigger": "50대 이상, 대장내시경 약 복용 거부감",
    "gap_description": "분변잠혈검사는 정확도가 낮고, 내시경은 준비 과정이 고통스러움",
    "solution_narrative": "분변 속 암세포 DNA만 정밀 분석하여 90% 정확도로 대장암을 찾아냅니다."
  }
]
```

## 프론트엔드 뱃지 표시

난이도/비용에 따라 다음과 같이 뱃지를 표시합니다:

- **Low**: "부담없는" (회색 또는 연한 색상)
- **Mid**: "추천" (주황색 또는 강조 색상)
- **High**: "프리미엄" (빨간색 또는 프리미엄 색상)

## 기존 데이터와의 통합

기존 `wello_hospitals.recommended_items` (JSONB)와 함께 사용할 수 있습니다:

1. **기존 recommended_items**: 병원별로 자유롭게 정의된 추천 항목
2. **새로운 external_checkup_items**: 표준화된 외부 검사 항목 기준 테이블

두 가지를 모두 프롬프트에 전달하여 GPT가 종합적으로 검진 설계를 생성할 수 있습니다.

## 사용 예시

### 1. 병원에 외부 검사 항목 추가

```python
# Python 스크립트로 매핑
from backend.scripts.map_hospital_external_checkup import map_hospital_external_checkup
import asyncio

asyncio.run(map_hospital_external_checkup(
    hospital_id="KIM_HW_CLINIC",
    item_names=["얼리텍 (대장암)", "아이파인더/아이스크린", "마스토체크 (유방암)"],
    display_order=0
))
```

### 2. API에서 조회

```python
hospital_info = await wello_data_service.get_hospital_by_id("KIM_HW_CLINIC")
external_checkup_items = hospital_info.get("external_checkup_items", [])

for item in external_checkup_items:
    print(f"{item['item_name']} - {item['difficulty_badge']}")
    print(f"  추천 대상: {item['target_trigger']}")
    print(f"  한계: {item['gap_description']}")
    print(f"  해결책: {item['solution_narrative']}")
```

## 다음 단계

1. 프론트엔드에서 뱃지 표시 로직 추가
2. 검진 설계 결과에 외부 검사 항목 포함
3. UI에서 난이도별 필터링 기능 추가

