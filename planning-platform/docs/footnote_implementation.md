# 각주 형식 참고 자료 구현 보고서

## 📋 구현 개요

논문 기반 자료만 사용하고, 설명 텍스트에 각주 번호([1], [2])를 표시하여 하단 각주로 링크를 연결하는 기능을 구현했습니다.

## ✅ 구현 완료 사항

### 1. 백엔드 - 프롬프트 개선

**파일**: `backend/app/services/checkup_design_prompt.py`

**변경 사항**:
- **논문 기반 자료만 사용** 요구사항 추가
- 각주 형식 사용 지시 추가
- 예시: "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면..."

**요구사항**:
- 의학 논문 (PubMed, Google Scholar 등)
- 공식 의학 가이드라인
- 메타 분석 연구 또는 시스템 리뷰
- 각주 형식: [1], [2], [3] 형식으로 표시

### 2. 프론트엔드 - 각주 파서 유틸리티

**파일**: `frontend/src/utils/footnoteParser.ts`

**기능**:
- 텍스트에서 `[1]`, `[2]` 형식의 각주 패턴 찾기
- 각주 번호와 references 배열 매칭
- React 컴포넌트로 렌더링 (클릭 가능한 각주)

**함수**:
- `parseFootnotes()`: 텍스트 파싱
- `renderTextWithFootnotes()`: React 컴포넌트 렌더링

### 3. 프론트엔드 - UI 표시

**파일**: `frontend/src/pages/CheckupRecommendationsPage.tsx`

**변경 사항**:
- 추천 이유(reason)에 각주 파서 적용
- 의학적 근거(evidence)에 각주 파서 적용
- 각주 리스트 하단 표시
- 각주 번호 클릭 시 링크로 이동

**표시 구조**:
```
추천 이유:
대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면...

[1] https://pubmed.ncbi.nlm.nih.gov/...
[2] https://www.kma.org/...
```

### 4. 프론트엔드 - 스타일

**파일**: `frontend/src/pages/CheckupRecommendationsPage.scss`

**추가된 스타일**:
- `.checkup-recommendations__footnote-link`: 각주 링크 (클릭 가능)
- `.checkup-recommendations__footnote`: 각주 번호
- `.checkup-recommendations__footnotes`: 각주 리스트 컨테이너
- `.checkup-recommendations__footnote-item`: 각주 항목
- `.checkup-recommendations__footnote-number`: 각주 번호 스타일

## 🔍 동작 방식

### 1. AI 응답 생성 시

AI 모델이 다음과 같이 응답:
```json
{
  "reason": "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면...",
  "evidence": "메타 분석 연구[1]에 따르면...",
  "references": [
    "https://pubmed.ncbi.nlm.nih.gov/12345678",
    "https://www.kma.org/health-checkup-guidelines-2023"
  ]
}
```

### 2. 프론트엔드 파싱 시

1. `renderTextWithFootnotes()` 함수 호출
2. 텍스트에서 `[1]`, `[2]` 패턴 찾기
3. 각주 번호와 references 배열 매칭
4. 각주를 클릭 가능한 `<sup>` 태그로 렌더링
5. 하단에 각주 리스트 표시

### 3. 사용자 인터랙션

- 각주 번호 클릭 → 새 탭에서 링크 열기
- 각주 리스트의 링크 클릭 → 새 탭에서 링크 열기

## 📊 예상 응답 구조

```json
{
  "items": [
    {
      "name": "혈압 측정",
      "reason": "가족력에 고혈압이 있는 점을 고려하여[1], 정기적인 혈압 측정이 필요합니다[2].",
      "evidence": "대한의학회 건강검진 가이드라인(2023)[1]에 따르면, 가족력이 있는 경우 연령과 무관하게 정기적인 혈압 측정이 권장됩니다.",
      "references": [
        "https://pubmed.ncbi.nlm.nih.gov/12345678",
        "https://www.kma.org/health-checkup-guidelines-2023"
      ]
    }
  ]
}
```

## ✅ 검증 사항

### 백엔드
- ✅ 프롬프트에 논문 기반 자료 요구사항 추가
- ✅ 각주 형식 사용 지시 추가
- ✅ references 배열 구조 명시

### 프론트엔드
- ✅ 각주 파서 유틸리티 생성
- ✅ 텍스트에서 각주 패턴 파싱
- ✅ 각주를 클릭 가능한 링크로 렌더링
- ✅ 각주 리스트 하단 표시
- ✅ 스타일 적용

## 🎯 다음 단계

1. **실제 테스트**: AI 응답에 각주 형식이 포함되는지 확인
2. **각주 파싱 테스트**: 다양한 각주 패턴 테스트
3. **링크 동작 확인**: 각주 클릭 시 링크가 올바르게 열리는지 확인


