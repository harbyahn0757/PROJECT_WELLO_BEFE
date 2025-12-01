# 검진 설계 시스템 개선 계획

## 현재 상황 분석

### 1. DB 저장 현황 (민감 정보 검토)

**저장되는 데이터:**
- `wello_checkup_design_requests` 테이블에 저장
- `selected_concerns`: 선택한 염려 항목 (JSONB)
- `survey_responses`: 설문 응답 (JSONB) - 체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등
- `design_result`: AI 생성 검진 설계 결과 (JSONB)
- `additional_concerns`: 추가 고민사항 (TEXT)

**민감 정보 포함 여부:**
- ✅ 개인 건강 정보 포함 (선택한 염려 항목)
- ✅ 생활습관 정보 포함 (설문 응답)
- ✅ AI 생성 검진 설계 결과 포함
- ⚠️ 업셀링 목적으로 저장되므로 민감 정보 관리 필요

**권장사항:**
- 개인정보 보호 정책 준수
- 데이터 보관 기간 정책 수립
- 접근 권한 관리 강화

### 2. 병원 테이블 구조

**현재 구조:**
- `wello_hospitals` 테이블
- `supported_checkup_types`: 배열 ['basic', 'comprehensive', 'premium']
- 병원별 검진 항목 상세 정보 없음

**필요한 개선:**
- 병원별 검진 항목 상세 정보 저장 필드 추가
- 일반검진(의무검진) 항목 구분
- 병원별 추천(업셀링) 항목 관리

## 개선 계획

### Phase 1: DB 스키마 확장

1. **병원 테이블에 검진 항목 필드 추가**
   ```sql
   ALTER TABLE wello.wello_hospitals 
   ADD COLUMN checkup_items JSONB; -- 병원별 검진 항목 상세 정보
   ADD COLUMN national_checkup_items JSONB; -- 일반검진(의무검진) 항목
   ADD COLUMN recommended_items JSONB; -- 병원 추천(업셀링) 항목
   ```

2. **검진 항목 구조**
   ```json
   {
     "national_checkup": [
       {
         "name": "일반검진 항목명",
         "category": "기본검진",
         "description": "설명",
         "age_range": "40-64",
         "gender": "all",
         "frequency": "2년마다"
       }
     ],
     "recommended": [
       {
         "name": "병원 추천 항목명",
         "category": "특화검진",
         "description": "설명",
         "target_conditions": ["고혈압", "당뇨"],
         "upselling_priority": 1
       }
     ]
   }
   ```

### Phase 2: 프롬프트 개선

1. **과거 결과와 문진 내용 연관**
   - 정상/경계/이상 항목 분석
   - 문진 내용과 연관성 분석
   - 주치의처럼 종합 설명

2. **일반검진 구분**
   - 대한민국 의무검진 항목 식별
   - 일반검진 항목은 접어두기
   - 병원 추천 항목 우선 표시

3. **우선순위 재정의**
   - 1순위: 과거 결과 + 문진 연관, 일반검진 항목이지만 주의 깊게 볼 항목
   - 2순위: 병원 추천 항목 (업셀링)
   - 3순위: 기타 권장 항목

### Phase 3: 서머리 개선

1. **폰트 크기 조정**
   - 서머리 제목 폰트 줄이기
   - 카드 제목 폰트 줄이기

2. **서머리 내용 개선**
   - 과거 결과 요약
   - 문진 내용 요약
   - 연관성 설명
   - 각 순위별 설명

### Phase 4: UI/UX 개선

1. **일반검진 항목 접기/펼치기**
2. **병원 추천 항목 강조**
3. **과거 결과와 문진 연관성 시각화**


