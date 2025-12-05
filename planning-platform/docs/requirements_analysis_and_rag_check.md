# 요구사항 분석 및 RAG 시스템 점검 리포트

## 📋 사용자 요구사항 정리

### 1. 발견된 문제점

#### 1.1 priority_1 항목 문제
- **문제**: 혈압측정, 혈당검사 항목으로 바꿨는데 혈압만 나옴
- **원인 추정**: 
  - GPT가 여러 항목을 선택하지 않음
  - 프롬프트에서 "최대 3개"라고 했지만 실제로는 1개만 선택
  - 혈당 관련 데이터가 부족하여 혈압만 선택

#### 1.2 검진 데이터 처리 문제
- **문제**: 검진 데이터 클릭했는데 확인 필요 - 최근 검진을 더 의미있게 다뤄야 함
- **문제**: 몇년 전 검진만 있고 최근 이력이 없을 때의 코멘트가 없음
- **원인 추정**:
  - 과거 검진 데이터가 있으면 최근 이력 부재를 언급하지 않음
  - "데이터가 확인되지 않아 현재 상태 확인을 위해 검사가 필요합니다" 논리 미적용

#### 1.3 의학적 근거 부족
- **문제**: 의학적 근거 부분이 약함
- **요구사항**: 
  - 가이드라인에 따르면 어떤 사례, 어떤 실험, 어떤 것 때문에 머머한다
  - 그에 대한 에비던스가 작게 표시되어야 함
- **현재 상태**: 단순히 "가이드라인에 따르면..." 수준

#### 1.4 옵션 검사 투입 확인
- **문제**: 옵션 검사가 투입되었는지 궁금
- **문제**: 종류는 들어갔는데 에비던스가 없거나 RAG에 없는 검사인지 확인 필요
- **원인 추정**:
  - RAG 벡터 DB에 해당 검사 자료가 부족
  - 프롬프트에서 에비던스 요구가 약함

#### 1.5 업셀링 기법 미작동
- **문제**: 업셀링 기법이 전혀 작동 안함
- **요구사항**: Bridge Strategy (Anchor-Gap-Offer) 적용 필요
- **현재 상태**: 단순 추천만 하고, 기본 검진의 한계를 지적하지 않음

---

### 2. 컨설팅 내용 반영 필요 사항

#### 2.1 Bridge Strategy (Anchor-Gap-Offer) 적용
```
- Anchor (인정): "국가 검진 항목인 [A]검사는 ~한 점에서 필수적입니다."
- Gap (한계 지적): "하지만 [A]검사는 [B]라는 한계가 있어, 미세 병변이나 초기 징후를 놓칠 위험이 있습니다."
- Offer (제안): "따라서 [C] 정밀 검사를 통해 [B]까지 확인하시는 것이 완벽한 안심을 위해 필요합니다."
```

#### 2.2 데이터 부재 처리
- **현재**: "데이터가 없어 정상이다"라고 가정
- **변경 필요**: "데이터가 확인되지 않아, 현재 상태 확인을 위해 검사가 필요합니다"

#### 2.3 RAG 기반 고도화 프롬프트
- Context (RAG Retrieved)를 근거로 판단
- 하드코딩 금지: 나이/성별에 따른 검진 기준은 Context를 근거로 판단

#### 2.4 벡터 DB에 추가 필요 자료
1. **병원 특화 검사(비급여) 설명 자료**
   - 최신 영상 진단 장비 설명서 (MRI, CT)
   - 신규 바이오마커 및 액체생검 자료
   
2. **통계 및 공포/안심 마케팅 근거 자료**
   - 연령별/성별 질환 통계
   - 질환 진행 시 치료 비용/삶의 질 저하 데이터
   
3. **영양 및 기능 의학 자료**
   - 기능 의학 검사 가이드
   - 생활습관 교정 가이드

---

## 🔍 RAG 시스템 점검 결과

### 1. 환경 설정 확인

| 항목 | 상태 | 값 |
|------|------|-----|
| LlamaIndex API Key | ✅ 설정됨 | llx-p0BD62YS6JGAwv0Ky3kiWckagsgakClZeGQbl04WbhBpT3pr |
| Gemini API Key | ✅ 설정됨 | AIzaSyCkgLtKtZxpu6xKtpdiGfs9JGhYCLrU0bg |
| LlamaCloud Index ID | ✅ 설정됨 | cb77bf6b-02a9-486f-9718-4ffac0d30e73 |
| LlamaCloud Project ID | ✅ 설정됨 | 45c4d9d4-ce6b-4f62-ad88-9107fe6de8cc |
| LlamaCloud Organization ID | ✅ 설정됨 | e4024539-3d26-48b5-8051-9092380c84d2 |

### 2. RAG 엔진 초기화 문제

**에러 메시지**:
```
[ERROR] RAG 엔진 초기화 실패: Exactly one of `name`, `id`, `pipeline_id` or `index_id` must be provided to identify the index.
```

**원인 분석**:
- `LlamaCloudIndex` 초기화 시 `name`, `index_id`, `project_id`를 모두 제공하고 있음
- API가 정확히 하나의 식별자만 요구함
- `index_id`만 사용하거나 `pipeline_id`만 사용해야 함

**DeprecationWarning**:
- `llama-index-indices-managed-llama-cloud` 패키지가 deprecated됨
- `llama-cloud-services` 패키지로 마이그레이션 필요

**해결 방안**:
1. `LlamaCloudIndex` 초기화 파라미터 수정
2. `llama-cloud-services` 패키지로 업그레이드 검토

---

## 📊 문제점 진단 테이블

| 문제 영역 | 문제점 | 원인 추정 | 해결 방안 | 우선순위 |
|----------|--------|----------|----------|---------|
| **priority_1 항목** | 혈압만 나옴 (혈당 누락) | GPT가 여러 항목 선택 안함 | 프롬프트에서 "최소 2-3개" 명시 | 높음 |
| **검진 데이터** | 최근 이력 부재 코멘트 없음 | 데이터 부재 처리 로직 미적용 | "데이터 확인 불가 → 검사 필요" 논리 추가 | 높음 |
| **의학적 근거** | 단순 "가이드라인에 따르면" | 에비던스 요구가 약함 | 구체적 사례, 실험, 통계 요구 | 높음 |
| **옵션 검사** | 에비던스 없음 | RAG 벡터 DB 부족 | 벡터 DB에 업셀링 검사 자료 추가 | 중간 |
| **업셀링** | Bridge Strategy 미작동 | 프롬프트에 명시 안됨 | Anchor-Gap-Offer 구조 명시 | 높음 |
| **RAG 엔진** | 초기화 실패 | 파라미터 충돌 | `index_id`만 사용하도록 수정 | 긴급 |

---

## 🔧 즉시 수정 필요 사항

### 1. RAG 엔진 초기화 수정 (긴급)

**현재 코드**:
```python
index = LlamaCloudIndex(
    name=LLAMACLOUD_INDEX_NAME,
    project_name=LLAMACLOUD_PROJECT_NAME,
    organization_id=LLAMACLOUD_ORGANIZATION_ID,
    api_key=llamaindex_api_key,
    index_id=LLAMACLOUD_INDEX_ID,
    project_id=LLAMACLOUD_PROJECT_ID
)
```

**수정 필요**:
```python
# index_id만 사용 (또는 pipeline_id만 사용)
index = LlamaCloudIndex(
    index_id=LLAMACLOUD_INDEX_ID,  # pipeline_id로도 사용 가능
    api_key=llamaindex_api_key
)
```

### 2. 프롬프트 수정: Bridge Strategy 명시

**추가 필요**:
- Anchor-Gap-Offer 구조를 명시적으로 요구
- 각 추천 항목에 3단계 논리 구조 필수

### 3. 데이터 부재 처리 로직 추가

**추가 필요**:
- 과거 검진 데이터가 없을 때: "데이터가 확인되지 않아 현재 상태 확인을 위해 검사가 필요합니다"
- 최근 이력이 없을 때: "몇년 전 검진만 있고 최근 이력이 없는 상황에서..."

### 4. 의학적 근거 강화

**추가 필요**:
- 구체적 사례 요구
- 실험/연구 인용 요구
- 통계 데이터 인용 요구
- 에비던스 작게 표시 요구

---

## 📝 다음 단계

1. **RAG 엔진 초기화 수정** (긴급)
2. **프롬프트 Bridge Strategy 적용**
3. **데이터 부재 처리 로직 추가**
4. **의학적 근거 강화**
5. **벡터 DB 추가 자료 검토**

---

이 리포트를 바탕으로 단계별로 수정을 진행하겠습니다.

