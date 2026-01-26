# 스크립트 가이드

이 폴더는 프로젝트의 테스트 및 유틸리티 스크립트를 포함합니다.

---

## 📂 폴더 구조

```
scripts/
├── test_scripts/          # 테스트 스크립트
└── utility_scripts/       # 유틸리티 스크립트
```

---

## 🧪 테스트 스크립트 (test_scripts/)

### 성능 테스트

#### `test_checkup_design_performance.py`
**목적**: 검진 설계 API 기본 성능 측정

**기능**:
- 단일 환자 데이터로 API 호출
- 응답 시간 측정
- 간단한 성능 벤치마크

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_checkup_design_performance.py
```

**요구사항**:
- API 서버 실행 중 (localhost:8082)
- 환자 UUID 설정

---

#### `test_all_phases_performance.py`
**목적**: Phase 1-4 전체 성능 개선 효과 검증

**기능**:
- Phase 1: 기본 검진 설계 성능
- Phase 2: 우선순위 로직 최적화
- Phase 3: Context Caching 효과
- Phase 4: 프롬프트 최적화 검증
- 종합 성능 비교 및 리포트

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_all_phases_performance.py --api-url http://localhost:8082
```

**옵션**:
- `--api-url`: API 서버 URL (기본: http://localhost:8082)
- `--patient-uuid`: 테스트할 환자 UUID

**출력**:
- 각 Phase별 응답 시간
- 개선 효과 백분율
- 성능 비교 차트

---

#### `test_phase3_4_performance.py`
**목적**: Phase 3-4 집중 성능 테스트

**기능**:
- Phase 3: Context Caching 효과 측정
- Phase 4: STEP 1 프롬프트 최적화 검증
- 세부 메트릭 수집

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_phase3_4_performance.py
```

---

### RAG (Retrieval-Augmented Generation) 테스트

#### `test_rag_minimal.py`
**목적**: RAG 검색 메서드 직접 비교 (OpenAI 전용)

**기능**:
- `aquery()` vs `retrieve()` 성능 비교
- OpenAI 임베딩 사용
- 최소 의존성으로 순수 비교

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_rag_minimal.py
```

**요구사항**:
- OPENAI_API_KEY 환경 변수
- RAG 인덱스 저장소 경로

---

#### `test_rag_real.py`
**목적**: 실제 백엔드 환경에서 RAG 통합 테스트

**기능**:
- 백엔드 서비스와 통합 테스트
- 실제 환경 설정 사용
- 다중 쿼리 테스트
- API 키 검증

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_rag_real.py
```

**요구사항**:
- `.env.local` 파일 설정
- GOOGLE_GEMINI_API_KEY
- OPENAI_API_KEY

---

#### `test_rag_optimization.py`
**목적**: RAG 검색 최적화 비교

**기능**:
- `aquery()` vs `aretrieve()` 비교
- 검색 품질 평가
- 성능 메트릭 수집
- 결과 상세 분석

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_rag_optimization.py
```

**출력**:
- 각 메서드별 응답 시간
- 검색 결과 비교
- 최적 메서드 추천

---

### API 테스트

#### `test_checkup_design_api.py`
**목적**: 검진 설계 API 엔드포인트 통합 테스트

**기능**:
- API 엔드포인트 검증
- 요청/응답 형식 확인
- 에러 처리 테스트
- 다양한 시나리오 커버

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/test_checkup_design_api.py
```

---

### 유틸리티

#### `find_test_patient.py`
**목적**: 테스트용 환자 데이터 검색

**기능**:
- 데이터베이스에서 환자 검색
- UUID로 환자 정보 조회
- 테스트 데이터 준비

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/test_scripts/find_test_patient.py
```

**옵션**:
- `--uuid`: 특정 환자 UUID 검색
- `--name`: 환자 이름으로 검색

---

## 🛠️ 유틸리티 스크립트 (utility_scripts/)

### `delete_ahn_kwangsu_data.py`
**목적**: 테스트 환자 "안광수" 데이터 삭제

**기능**:
- 안광수 테스트 데이터 완전 삭제
- 관련 테이블 정리
- 안전한 삭제 확인

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/utility_scripts/delete_ahn_kwangsu_data.py
```

**⚠️ 주의**:
- 프로덕션 데이터베이스에서 실행 금지
- 삭제 전 백업 권장
- 실행 전 환경 확인 필수

---

### `test_decryption.py`
**목적**: 데이터 암호화/복호화 테스트

**기능**:
- 암호화 알고리즘 검증
- 복호화 정확성 확인
- 키 관리 테스트

**사용법**:
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
python docs/scripts/utility_scripts/test_decryption.py
```

**요구사항**:
- 암호화 키 환경 변수
- 테스트 데이터

---

## 📋 공통 요구사항

### Python 환경
```bash
# 가상환경 활성화 (필요시)
source venv/bin/activate

# 의존성 설치
pip install -r planning-platform/backend/requirements.txt
```

### 환경 변수
대부분의 스크립트는 다음 환경 변수를 필요로 합니다:

```bash
# .env.local 파일에 설정
OPENAI_API_KEY=your_key_here
GOOGLE_GEMINI_API_KEY=your_key_here
DATABASE_URL=your_database_url
```

### API 서버
일부 테스트는 백엔드 API 서버가 실행 중이어야 합니다:

```bash
# 백엔드 서버 시작
cd planning-platform/backend
uvicorn app.main:app --reload --port 8082
```

---

## 🎯 스크립트 선택 가이드

### "성능을 측정하고 싶다면"
1. **간단한 테스트**: `test_checkup_design_performance.py`
2. **전체 Phase 검증**: `test_all_phases_performance.py`
3. **특정 Phase**: `test_phase3_4_performance.py`

### "RAG를 테스트하고 싶다면"
1. **빠른 비교**: `test_rag_minimal.py`
2. **실제 환경**: `test_rag_real.py`
3. **최적화 분석**: `test_rag_optimization.py`

### "API를 검증하고 싶다면"
- `test_checkup_design_api.py`

### "테스트 데이터를 관리하고 싶다면"
1. **환자 찾기**: `find_test_patient.py`
2. **데이터 삭제**: `delete_ahn_kwangsu_data.py`

---

## 🐛 문제 해결

### 일반적인 오류

#### "ModuleNotFoundError"
```bash
# 프로젝트 경로 확인
export PYTHONPATH="${PYTHONPATH}:/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend"
```

#### "API 연결 실패"
```bash
# 백엔드 서버 상태 확인
curl http://localhost:8082/health
```

#### "환경 변수 없음"
```bash
# .env.local 파일 확인
cat planning-platform/backend/.env.local
```

---

## 📝 스크립트 작성 가이드

### 새 테스트 스크립트 추가

1. **적절한 폴더 선택**
   - 테스트: `test_scripts/`
   - 유틸리티: `utility_scripts/`

2. **파일명 규칙**
   - 테스트: `test_*.py`
   - 유틸리티: 명확한 동사_명사 형식

3. **필수 포함 사항**
   - Docstring (목적, 기능, 사용법)
   - 환경 변수 검증
   - 에러 처리
   - 결과 출력

4. **예시 템플릿**
```python
#!/usr/bin/env python3
"""
스크립트 설명
기능 나열
"""
import sys
import os
from dotenv import load_dotenv

# 환경 설정
load_dotenv()

def main():
    """메인 함수"""
    # 구현
    pass

if __name__ == "__main__":
    main()
```

---

## 🔗 관련 문서

- [문서 인덱스](../INDEX.md)
- [성능 개선 보고서](../2026-01-13_검진설계_성능개선/README.md)
- [RAG API 가이드](../RAG_API_구축_가이드.md)

---

*이 가이드는 프로젝트 문서 정리 작업(2026-01-25)의 일환으로 생성되었습니다.*
