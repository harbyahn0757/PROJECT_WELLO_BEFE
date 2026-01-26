# 프로젝트 문서 및 스크립트 인덱스

> 최종 업데이트: 2026-01-25

이 문서는 PROJECT_WELNO_BEFE 프로젝트의 모든 문서와 스크립트를 정리한 인덱스입니다.

---

## 📚 목차

1. [작업 내역 문서](#작업-내역-문서)
2. [기술 문서](#기술-문서)
3. [테스트 스크립트](#테스트-스크립트)
4. [유틸리티 스크립트](#유틸리티-스크립트)

---

## 작업 내역 문서

### 2026-01-10 작업

#### 📁 데이터 수집 및 플로우 분석
- **위치**: `docs/2026-01-10_데이터_수집_및_플로우_분석/`
- **파일**:
  - `DATA_COLLECTION_FLOW.md` - 데이터 수집 플로우 분석
  - `FLOW_ANALYSIS.md` - 플로우 상세 분석

#### 📁 마이그레이션 계획
- **위치**: `docs/2026-01-10_마이그레이션_계획/`
- **파일**:
  - `raw_to_mdx_migration_plan.md` - raw 데이터를 mdx로 마이그레이션 계획

#### 📁 배포 가이드
- **위치**: `docs/2026-01-10_배포_가이드/`
- **파일**:
  - `PROJECT_DEPLOYMENT_GUIDE.md` - 프로젝트 배포 가이드
  - `WELLO_TESTING_GUIDE.md` - 웰로 테스팅 가이드

#### 📁 비밀번호 시스템 개선
- **위치**: `docs/2026-01-10_비밀번호_시스템_개선/`
- **파일**:
  - `WELLO_PASSWORD_SYSTEM_IMPROVEMENT.md` - 비밀번호 시스템 개선 사항

#### 📁 인증 디버깅
- **위치**: `docs/2026-01-10_인증_디버깅/`
- **파일**:
  - `debug_auth_flow.md` - 인증 플로우 디버깅 내역

#### 📁 테이블 비교
- **위치**: `docs/2026-01-10_테이블_비교/`
- **파일**:
  - `table_comparison_summary.md` - 데이터베이스 테이블 비교 요약

#### 📁 환자 분석
- **위치**: `docs/2026-01-10_환자_분석/`
- **파일**:
  - `WELLO_PATIENTS_ANALYSIS.md` - 웰로 환자 데이터 분석

---

### 2026-01-12 작업

#### 📁 진행 보고서
- **위치**: `docs/2026-01-12_진행_보고서/`
- **파일**:
  - `PROGRESS_REPORT.md` - 프로젝트 진행 상황 보고

---

### 2026-01-13 작업

#### 📁 검진설계 DB 구조
- **위치**: `docs/2026-01-13_검진설계_DB_구조/`
- **파일**:
  - `검진설계_DB_구조.md` - 검진 설계 데이터베이스 구조 문서

#### 📁 검진설계 성능개선
- **위치**: `docs/2026-01-13_검진설계_성능개선/`
- **파일**:
  - `README.md` - 성능 개선 프로젝트 개요
  - **검증결과/**
    - `테스트_결과_요약.md` - 테스트 결과 요약
    - `테스트_실행_로그.txt` - 테스트 실행 로그
  - **보고서/**
    - `Phase3_4_완료보고서.md` - Phase 3-4 완료 보고
    - `검진설계_성능개선_진행보고서.md` - 진행 상황 보고
    - `전체_Phase_완료보고서.md` - 전체 Phase 완료 보고

#### 📁 폐 관련 버그 수정
- **위치**: `docs/2026-01-13_폐_관련_버그_수정/`
- **파일**:
  - `폐_관련_문제_분석_결과.md` - 문제 분석 결과
  - `폐_관련_문제_원인_보고서.md` - 문제 원인 상세 보고
  - `폐_관련_버그_수정_방안.md` - 버그 수정 방안

---

### 2026-01-25 작업

#### 📁 약관 동의 파이프라인
- **위치**: `docs/2026-01-25_약관_동의_파이프라인/`
- **파일**:
  - `2026-01-25 - 약관_동의_파이프라인_구현_완료.md` - 약관 동의 파이프라인 구현 완료 보고

#### 📁 질병예측리포트 분석
- **위치**: `docs/2026-01-25_질병예측리포트_분석/`
- **파일**:
  - `2026-01-25 - 질병예측리포트_웰노_접근_케이스_분석.md` - 질병 예측 리포트 웰노 접근 케이스 분석

---

## 기술 문서

### RAG (Retrieval-Augmented Generation)
- **위치**: `docs/`
- **파일**:
  - `RAG_API_구축_가이드.md` - RAG API 구축 가이드
  - `RAG_테스트_결과_요약.md` - RAG 테스트 결과 요약

### 블록체인
- **위치**: `docs/`
- **파일**:
  - `Web3.0_Blockchain_Integration_Plan.md` - Web3.0 블록체인 통합 계획

### 기타
- **위치**: `docs/`
- **파일**:
  - `약관_동의_파이프라인_설계.md` - 약관 동의 파이프라인 설계
  - `Mediarc_report` - Mediarc 리포트

### 프롬프트 엔지니어링
- **위치**: `docs/prompt_engineering_refactoring/`
- **파일**:
  - `02_Step2_개선전략_및_결과.md` - Step 2 개선 전략 및 결과
  - `03_Step2_구현결과_보고.md` - Step 2 구현 결과 보고
  - `04_MasterPlan_Confidnece_Logic.md` - Master Plan Confidence Logic

---

## 테스트 스크립트

**위치**: `docs/scripts/test_scripts/`

### 성능 테스트
| 스크립트 | 설명 | 용도 |
|---------|------|------|
| `test_checkup_design_performance.py` | 검진 설계 API 성능 테스트 (간단 버전) | 기본 성능 측정 |
| `test_all_phases_performance.py` | 전체 Phase 1-4 성능 개선 테스트 | 포괄적 성능 검증 |
| `test_phase3_4_performance.py` | Phase 3-4 성능 개선 테스트 | Context Caching 효과 측정 |

### RAG 테스트
| 스크립트 | 설명 | 용도 |
|---------|------|------|
| `test_rag_minimal.py` | 최소한의 RAG 테스트 (OpenAI만) | aquery vs retrieve 직접 비교 |
| `test_rag_real.py` | RAG 실제 환경 테스트 | 백엔드 환경 통합 테스트 |
| `test_rag_optimization.py` | RAG 검색 최적화 테스트 | aquery vs aretrieve 비교 |

### API 테스트
| 스크립트 | 설명 | 용도 |
|---------|------|------|
| `test_checkup_design_api.py` | 검진 설계 API 테스트 | API 엔드포인트 검증 |

### 유틸리티
| 스크립트 | 설명 | 용도 |
|---------|------|------|
| `find_test_patient.py` | 테스트용 환자 찾기 | 테스트 데이터 검색 |

---

## 유틸리티 스크립트

**위치**: `docs/scripts/utility_scripts/`

| 스크립트 | 설명 | 용도 |
|---------|------|------|
| `delete_ahn_kwangsu_data.py` | 안광수 테스트 데이터 삭제 | 테스트 데이터 정리 |
| `test_decryption.py` | 복호화 테스트 | 암호화/복호화 검증 |

---

## 활성 스크립트 (프로젝트 루트)

**위치**: `scripts/`

### 백엔드
- `backend/start_wello.sh` - 웰로 백엔드 시작 스크립트

### 프론트엔드
- `frontend/frontend_dev.sh` - 프론트엔드 개발 서버 시작

### 배포
- `deploy_improved.sh` - 개선된 배포 스크립트

---

## 📝 문서 작성 가이드

### 명명 규칙
- 날짜별 폴더: `YYYY-MM-DD_작업명/`
- 마크다운 파일: `UPPERCASE_WITH_UNDERSCORES.md` 또는 `kebab-case.md`
- Python 스크립트: `snake_case.py`

### 폴더 구조
```
docs/
├── YYYY-MM-DD_작업명/        # 날짜별 작업 내역
│   ├── README.md              # 작업 개요
│   ├── 상세_문서.md           # 상세 문서
│   └── 하위폴더/              # 필요시 하위 분류
├── scripts/                   # 스크립트 모음
│   ├── test_scripts/          # 테스트 스크립트
│   └── utility_scripts/       # 유틸리티 스크립트
└── INDEX.md                   # 이 파일
```

---

## 🔍 검색 팁

### 날짜로 찾기
```bash
ls docs/ | grep 2026-01-13
```

### 키워드로 찾기
```bash
find docs/ -name "*.md" -exec grep -l "RAG" {} \;
```

### 스크립트 찾기
```bash
find docs/scripts/ -name "*.py" -type f
```

---

## 📌 참고사항

1. **작업 내역 추가 시**: `docs/YYYY-MM-DD_작업명/` 폴더를 생성하고 관련 문서를 저장
2. **스크립트 추가 시**: 용도에 따라 `test_scripts/` 또는 `utility_scripts/`에 저장
3. **문서 업데이트 시**: 이 INDEX.md 파일도 함께 업데이트
4. **레거시 참조**: 원본 `작업내역/` 폴더는 백업용으로 보관

---

## 🔗 관련 링크

- [리팩토링 마스터 플랜](.cursor/plans/refactoring_master_plan.md)
- [질병 리포트 상세 계획](.cursor/plans/disease_report_day1_detailed.md)
- [통합 상태 파이프라인](.cursor/plans/welno-unified-status-pipeline.md)

---

*이 인덱스는 프로젝트 문서 정리 작업(2026-01-25)의 일환으로 생성되었습니다.*
