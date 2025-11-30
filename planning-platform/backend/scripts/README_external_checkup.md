# 외부 검사 항목 관리 가이드

## 개요

외부 검사 종류를 기준 테이블로 관리하고, 병원별로 매핑하는 시스템입니다.

## 설치 및 초기화

### 1. 테이블 생성

```bash
psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f backend/scripts/create_external_checkup_items_table.sql
```

### 2. 데이터 입력

```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform
python backend/scripts/insert_external_checkup_items.py
```

이 스크립트는 제공된 30개 외부 검사 항목을 기준 테이블에 입력합니다.

## 병원별 매핑

### 전체 목록 보기

```bash
python backend/scripts/map_hospital_external_checkup.py list
```

### 병원에 검사 항목 매핑

```bash
# 예시: 김현우내과에 외부 검사 항목 추가
python backend/scripts/map_hospital_external_checkup.py map KIM_HW_CLINIC \
  '얼리텍 (대장암)' \
  '아이파인더/아이스크린' \
  '마스토체크 (유방암)' \
  '알츠온/OAβ (아밀로이드)'
```

## 데이터 구조

### 기준 테이블: `wello_external_checkup_items`

- **카테고리**: 암 정밀, 뇌/신경, 심혈관, 기능의학, 면역/항노화, 호르몬, 소화기, 영양, 감염, 기타, 영상의학, 내시경
- **난이도/비용**: Low(부담없는), Mid(추천), High(프리미엄)
- **추가 정보**: target_trigger, gap_description, solution_narrative

### 매핑 테이블: `wello_hospital_external_checkup_mapping`

- 병원별로 외부 검사 항목을 매핑
- `display_order`로 표시 순서 제어

## API 통합

병원 정보 조회 시 자동으로 외부 검사 항목이 포함됩니다:

```python
hospital_info = await wello_data_service.get_hospital_by_id("KIM_HW_CLINIC")
external_checkup_items = hospital_info.get("external_checkup_items", [])

# 응답 구조
{
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

## 프론트엔드 뱃지 표시

난이도/비용에 따라 자동으로 뱃지가 표시됩니다:

- **Low**: "부담없는" (초록색)
- **Mid**: "추천" (주황색)
- **High**: "프리미엄" (빨간색)

## 프롬프트 통합

외부 검사 항목은 GPT 프롬프트에 자동으로 포함되어 검진 설계에 반영됩니다.

## 관리 명령어 요약

```bash
# 1. 테이블 생성
psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f backend/scripts/create_external_checkup_items_table.sql

# 2. 데이터 입력
python backend/scripts/insert_external_checkup_items.py

# 3. 목록 확인
python backend/scripts/map_hospital_external_checkup.py list

# 4. 병원 매핑
python backend/scripts/map_hospital_external_checkup.py map <hospital_id> <item_name1> <item_name2> ...
```

