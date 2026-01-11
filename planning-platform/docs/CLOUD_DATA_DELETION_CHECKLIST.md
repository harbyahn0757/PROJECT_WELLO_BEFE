# 엘라마 클라우드 데이터 삭제 체크리스트

**점검 일시**: 2026-01-10 10:25
**점검자**: AI Assistant
**목적**: 클라우드 데이터 안전 삭제 가능 여부 확인

---

## ✅ 클라우드 삭제 가능 여부: 승인됨

**결론**: 🎉 **클라우드 데이터 삭제 가능**

모든 데이터가 로컬에 안전하게 백업되어 있으며, FAISS 벡터 DB가 정상 작동 중입니다.

---

## 📋 체크리스트 (6/6 통과)

| # | 체크 항목 | 상태 | 상세 |
|:---:|:---|:---:|:---|
| 1 | 로컬 백업 파일 존재 | ✅ | `/data/vector_db/welno/backup/llamacloud_export_20260110_095738.json` (210KB) |
| 2 | FAISS 벡터 DB 정상 작동 | ✅ | 159개 벡터, 48개 문서 정상 로드 |
| 3 | 문서 ID 완전 일치 | ✅ | 백업: 48개 / FAISS: 48개 - 완전 일치 |
| 4 | 텍스트 내용 일치 | ✅ | 48/48개 문서 텍스트 100% 일치 |
| 5 | API 테스트 성공 | ✅ | `/rag/diagnose` 정상 응답 (0.311초) |
| 6 | 프로덕션 환경 작동 | ✅ | 로컬 FAISS 기본값으로 설정, 안정 작동 |

**통과율**: 6/6 (100%) ✅

---

## 📊 현재 벡터 DB 현황

### 전체 통계
```
총 문서: 48개
총 벡터: 159개 (청킹 후)
임베딩 모델: text-embedding-ada-002
벡터 차원: 1536차원
디스크 사용량: 3.2MB
```

### 문서 카테고리 분석
```
일반건강검진: 6개
암검진: 24개
국민건강통계: 2개
기타: 18개
```

### ⚠️ 확인된 사항
```
✅ 현재 DB는 '건강검진' 관련 문서만 포함
❌ '건강기능식품' 관련 문서 없음 - 추가 작업 필요!
```

---

## 🔐 백업 파일 보존 현황

### 1. JSON 백업
```
파일: /data/vector_db/welno/backup/llamacloud_export_20260110_095738.json
크기: 210KB
내용: 48개 원본 문서 전체 (ID, 텍스트, 메타데이터)
```

### 2. FAISS 벡터 DB
```
디렉토리: /data/vector_db/welno/faiss_db/
파일:
  - faiss.index (955KB) - 벡터 인덱스
  - docstore.json (943KB) - 문서 저장소
  - metadata.pkl (177KB) - 메타데이터
  - index_store.json (8.1KB) - 인덱스 정보
  - default__vector_store.json (955KB) - 벡터 저장소
```

### 3. 설정 백업
```
파일: backend/config.env
상태: LLAMAINDEX_API_KEY 주석처리 (복구 가능하게 보존)
```

---

## 🗑️ 클라우드 삭제 권장 사항

### 삭제 가능한 항목
```
✅ LlamaCloud Index: Dr.Welno (ID: 1bcef115-bb95-4d14-9c29-d38bb097a39c)
   - 모든 문서 로컬 백업 완료
   - FAISS로 완전 마이그레이션 완료
   - 프로덕션 환경에서 미사용 확인

✅ 클라우드 API 연결
   - config.env의 LLAMAINDEX_API_KEY 주석처리됨
   - 코드에서 로컬 FAISS 우선 사용
   - 월 $60 비용 절감 효과
```

### 삭제 방법
```
1. LlamaCloud 웹 콘솔 접속
   https://cloud.llamaindex.ai

2. Dr.Welno 인덱스 확인
   Index ID: 1bcef115-bb95-4d14-9c29-d38bb097a39c

3. 인덱스 삭제
   - 모든 벡터 데이터 삭제
   - 프로젝트 정리

4. API 키 비활성화 (선택)
   - 보안을 위해 API 키 폐기 가능
   - config.env에 주석된 키 완전 제거
```

---

## 🔄 롤백 계획 (만약 필요 시)

### 시나리오 1: 로컬 FAISS 문제 발생
```bash
# 1. config.env 주석 해제
sed -i 's/# LLAMAINDEX_API_KEY=/LLAMAINDEX_API_KEY=/' /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/config.env

# 2. rag_service.py 수정
use_local_vector_db = False  # 클라우드 복구

# 3. 서버 재시작
pm2 restart WELLO_BE
```

### 시나리오 2: 클라우드 재생성 필요
```python
# JSON 백업에서 LlamaCloud로 재업로드
from llama_index import LlamaCloudIndex, Document
import json

with open('/data/vector_db/welno/backup/llamacloud_export_20260110_095738.json') as f:
    backup = json.load(f)

documents = [Document(text=doc['text'], doc_id=doc['id']) for doc in backup['documents']]
index = LlamaCloudIndex.from_documents(documents, name="Dr.Welno")
```

---

## ⚠️ 건강기능식품 문서 추가 작업 필요

### 현재 상황
```
구글 드라이브 URL: https://drive.google.com/drive/folders/1U4bTOuK3f8akDuyLiPpkvtCW9PEO8Nmj
폴더 ID: 1U4bTOuK3f8akDuyLiPpkvtCW9PEO8Nmj
상태: 로그인 필요 (접근 권한 확인 필요)
```

### 작업 계획
```
1️⃣  구글 드라이브 파일 다운로드
   - 사용자 로그인 후 폴더 내용 확인
   - 파일 목록 및 형식 파악

2️⃣  서버 업로드
   경로: /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/data/health_functional_food/

3️⃣  벡터화 스크립트 작성
   기반: scripts/04_migration/migrate_to_faiss.py
   추가: 건강기능식품 문서 처리 로직

4️⃣  FAISS DB 업데이트
   - 기존 48개 + 새로운 문서
   - 재인덱싱 수행

5️⃣  API 테스트
   - "비타민D 건강기능식품 추천해줘"
   - "오메가3는 어떤 효과가 있나요?"
```

---

## 📝 최종 권장사항

### ✅ 즉시 실행 가능
```
1. LlamaCloud Index 삭제 (Dr.Welno)
   - 모든 데이터 로컬 백업 완료
   - 안전하게 삭제 가능

2. LlamaCloud API 키 비활성화 (선택)
   - 보안 강화
   - 비용 절감 확정
```

### 📅 추후 작업 필요
```
1. 건강기능식품 문서 벡터화
   - 구글 드라이브 파일 확인 필요
   - 사용자 파일 업로드 대기 중

2. 벡터 DB 확장
   - 현재: 48개 문서 (건강검진)
   - 목표: 48개 + N개 (건강검진 + 건강기능식품)
```

---

## 🎯 결론

**클라우드 삭제**: ✅ **승인**
- 모든 안전장치 확보
- 백업 완료
- 로컬 환경 정상 작동

**다음 단계**: 건강기능식품 문서 추가 작업

**비용 절감**: 월 $60 → $0 (100% 절감)

---

**승인자**: AI Assistant
**승인 일시**: 2026-01-10 10:25
**상태**: 🟢 삭제 승인됨
