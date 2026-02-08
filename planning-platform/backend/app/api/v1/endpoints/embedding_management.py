"""
병원별 RAG 임베딩 관리 API (백오피스용)

- 병원 목록 및 임베딩 유무
- 병원별 문서 목록·업로드
- 병원별 인덱스 재구축 트리거
"""

import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, Field

from ....repositories.implementations import HospitalRepository

router = APIRouter(prefix="/embedding", tags=["embedding-management"])

# 병원별 FAISS 루트 (전역 faiss_db와 분리)
LOCAL_FAISS_BY_HOSPITAL = os.environ.get("LOCAL_FAISS_BY_HOSPITAL", "/data/vector_db/welno/faiss_db_by_hospital")
UPLOADS_SUBDIR = "uploads"


def _hospital_base_path(hospital_id: str) -> Path:
    return Path(LOCAL_FAISS_BY_HOSPITAL) / hospital_id


def _hospital_uploads_path(hospital_id: str) -> Path:
    return _hospital_base_path(hospital_id) / UPLOADS_SUBDIR


class HospitalEmbeddingItem(BaseModel):
    hospital_id: str
    hospital_name: str
    has_embedding: bool = False
    has_uploads: bool = False
    document_count: int = 0


class DocumentItem(BaseModel):
    name: str
    size_bytes: int
    uploaded_at: Optional[str] = None


@router.get("/hospitals", response_model=List[HospitalEmbeddingItem])
async def list_hospitals_with_embedding_status():
    """병원 목록 조회 (임베딩 유무·업로드 유무 포함)"""
    try:
        repo = HospitalRepository()
        hospitals = await repo.get_all_active()
        result = []
        base = Path(LOCAL_FAISS_BY_HOSPITAL)
        for h in hospitals:
            hid = h.hospital_id
            base_path = base / hid
            uploads_path = base_path / UPLOADS_SUBDIR
            has_index = (base_path / "faiss.index").exists()
            has_uploads = uploads_path.exists()
            count = len(list(uploads_path.glob("*"))) if has_uploads else 0
            result.append(HospitalEmbeddingItem(
                hospital_id=hid,
                hospital_name=h.info.name,
                has_embedding=has_index,
                has_uploads=has_uploads,
                document_count=count,
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 목록 조회 실패: {str(e)}")


@router.get("/hospitals/{hospital_id}/documents", response_model=List[DocumentItem])
async def list_hospital_documents(hospital_id: str):
    """병원별 업로드 문서 목록"""
    uploads_path = _hospital_uploads_path(hospital_id)
    if not uploads_path.exists():
        return []
    items = []
    for f in uploads_path.iterdir():
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            items.append(DocumentItem(
                name=f.name,
                size_bytes=stat.st_size,
                uploaded_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
            ))
    items.sort(key=lambda x: x.uploaded_at or "", reverse=True)
    return items


@router.post("/hospitals/{hospital_id}/documents")
async def upload_hospital_document(
    hospital_id: str,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """병원별 문서 업로드 (PDF 등). 재구축은 별도 rebuild 호출 필요."""
    uploads_path = _hospital_uploads_path(hospital_id)
    uploads_path.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c for c in file.filename or "upload" if c.isalnum() or c in "._- ").strip() or "upload"
    dest = uploads_path / safe_name
    try:
        content = await file.read()
        dest.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"저장 실패: {str(e)}")
    return {
        "success": True,
        "hospital_id": hospital_id,
        "filename": safe_name,
        "size_bytes": len(content),
    }


def _run_rebuild_for_hospital(hospital_id: str) -> None:
    """병원별 인덱스 재구축 (백그라운드). 현재는 디렉터리 생성만; 실제 임베딩은 추후 연동."""
    base = _hospital_base_path(hospital_id)
    uploads = base / UPLOADS_SUBDIR
    base.mkdir(parents=True, exist_ok=True)
    if uploads.exists():
        # TODO: 여기서 uploads 내 파일을 읽어 임베딩 후 base에 faiss.index 등 저장
        # 동일 EMBEDDING_DIMENSION, EMBEDDING_MODEL 사용
        pass


@router.post("/hospitals/{hospital_id}/rebuild")
async def trigger_rebuild(
    hospital_id: str,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """병원별 임베딩 인덱스 재구축 트리거 (비동기)."""
    background_tasks.add_task(_run_rebuild_for_hospital, hospital_id)
    return {
        "success": True,
        "message": "재구축이 백그라운드에서 시작되었습니다.",
        "hospital_id": hospital_id,
    }
