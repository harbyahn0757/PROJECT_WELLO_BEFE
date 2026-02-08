# 병원별 RAG 임베딩 저장 정책·스키마

**목적:** 병원별 임베드 문서 저장 방식과 메타데이터 스키마를 정의하여, 전역 RAG와 병 공존하며 병원 RAG가 우선 사용되도록 한다.

**백오피스 접속:** [https://welno.kindhabit.com/backoffice](https://welno.kindhabit.com/backoffice) (병원별 RAG 임베딩 관리)

---

## 1. 원칙

- **전역 인덱스:** 기존 `/data/vector_db/welno/faiss_db` 는 그대로 유지. 검진/지침서 등 공통 지식용.
- **병원별 인덱스:** 병원 전용 문서는 **별도 디렉터리**에 저장 (전역 덮어쓰기 금지).
- **우선순위:** 해당 `hospital_id` 요청 시 **병원별 인덱스 검색 결과를 우선** 반영한 뒤, 필요 시 전역 인덱스 결과를 보조로 병합.

---

## 2. 저장 방식 (옵션 A 채택)

**병원별 디렉터리 + 별도 FAISS 인덱스**

| 항목 | 값 |
|------|-----|
| 루트 | `/data/vector_db/welno/faiss_db_by_hospital` |
| 병원별 경로 | `{루트}/{hospital_id}/` |
| 디렉터리 내 파일 | `faiss.index`, `docstore.json`, `index_store.json`, `metadata.pkl` (선택) |

- **차원:** 전역과 동일 `EMBEDDING_DIMENSION = 1536`, `EMBEDDING_MODEL = "text-embedding-ada-002"` (rag_service 상수와 동일).
- **생성/갱신:** 백오피스에서 해당 병원 문서 업로드·재구축 시 위 경로에만 쓰기. 전역 `faiss_db` 는 건드리지 않음.

---

## 3. 메타데이터 스키마 (병원별 문서 노드)

병원별 인덱스에 넣는 노드(문서) 메타데이터 권장 필드:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `hospital_id` | str | O | 병원 ID (welno_hospitals.hospital_id 또는 파트너 약속값) |
| `file_name` | str | - | 원본 파일명 |
| `file_path` | str | - | 업로드 시점 경로 또는 스토리지 키 |
| `title` | str | - | 문서 제목 (표시용) |
| `category` | str | - | 예: clinic_guideline, faq |
| `uploaded_at` | str | - | ISO 8601 |
| `doc_type` | str | - | 예: hospital_uploaded |

전역 인덱스 노드에는 `hospital_id` 없음 (기존 유지).

---

## 4. 검색 시 동작 (추후 구현)

- `hospital_id` 가 주어지고, 해당 병원 디렉터리가 존재하면:
  1. 해당 병원 FAISS로 먼저 검색 (top_k).
  2. 필요 시 전역 FAISS로 추가 검색.
  3. 병원 결과를 컨텍스트 앞쪽에, 전역 결과를 뒤쪽에 배치하여 LLM에 전달.
- `hospital_id` 가 없거나 병원 인덱스가 없으면: **현재와 동일**하게 전역 FAISS만 사용.

---

## 5. 참고

- 상수 정의: `planning-platform/backend/app/services/checkup_design/rag_service.py` — `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`, `LOCAL_FAISS_DIR`.
- 전역 인덱스 재구축: `planning-platform/backend/scripts/database/rebuild_welno_vector_db_ai.py` (병원별 재구축 스크립트는 별도 추가).
