"""
병원별 RAG 임베딩 관리 API (백오피스용)

- 파트너/병원 계층 구조
- 병원 목록 및 임베딩 유무
- 병원별 문서 목록·업로드·삭제
- 병원별 인덱스 재구축 트리거
- 병원별 RAG/LLM 설정 CRUD
- 대화 로그 조회
"""

import os
import json
import logging
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Body
from pydantic import BaseModel, Field

from ....core.database import db_manager

router = APIRouter(prefix="/embedding", tags=["embedding-management"])

logger = logging.getLogger(__name__)

# 병원별 FAISS 루트 (전역 faiss_db와 분리)
LOCAL_FAISS_BY_HOSPITAL = os.environ.get("LOCAL_FAISS_BY_HOSPITAL", "/data/vector_db/welno/faiss_db_by_hospital")
UPLOADS_SUBDIR = "uploads"

# 임베딩 모델 설정 (rag_service.py와 동일)
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536

# 재구축 진행 상태 추적 (메모리 딕셔너리)
_rebuild_status: Dict[str, Dict[str, Any]] = {}


def _hospital_base_path(hospital_id: str) -> Path:
    return Path(LOCAL_FAISS_BY_HOSPITAL) / hospital_id


def _hospital_uploads_path(hospital_id: str) -> Path:
    return _hospital_base_path(hospital_id) / UPLOADS_SUBDIR


# ─── Pydantic 모델 ───────────────────────────────────────────────

class HospitalEmbeddingItem(BaseModel):
    partner_id: str
    partner_name: str
    hospital_id: str
    hospital_name: str
    has_embedding: bool = False
    has_uploads: bool = False
    document_count: int = 0


class DocumentItem(BaseModel):
    name: str
    size_bytes: int
    uploaded_at: Optional[str] = None


class HospitalRagConfigUpdate(BaseModel):
    partner_id: str = "welno"
    hospital_name: Optional[str] = None
    contact_phone: Optional[str] = None
    persona_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    llm_config: Optional[Dict[str, Any]] = None
    embedding_config: Optional[Dict[str, Any]] = None
    theme_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True


class HospitalRagConfigResponse(BaseModel):
    """병원 RAG 설정 응답 모델"""
    partner_id: str
    hospital_id: str
    hospital_name: Optional[str] = None
    contact_phone: Optional[str] = None
    persona_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    llm_config: Dict[str, Any]
    embedding_config: Dict[str, Any]
    theme_config: Dict[str, Any]
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PartnerItem(BaseModel):
    partner_id: str
    partner_name: str
    is_active: bool
    hospital_count: int = 0


class PartnerHierarchy(BaseModel):
    """파트너-병원 계층 구조"""
    partner_id: str
    partner_name: str
    is_active: bool
    hospitals: List[HospitalEmbeddingItem]


# ─── 파트너 / 계층 API ───────────────────────────────────────────

@router.get("/partners", response_model=List[PartnerItem])
async def list_partners():
    """파트너 목록 조회 (병원 수 포함)"""
    try:
        query = """
            SELECT
                p.partner_id,
                p.partner_name,
                p.is_active,
                COUNT(h.hospital_id) as hospital_count
            FROM welno.tb_partner_config p
            LEFT JOIN welno.tb_hospital_rag_config h ON p.partner_id = h.partner_id AND h.hospital_id != '*'
            WHERE p.is_active = true
            GROUP BY p.partner_id, p.partner_name, p.is_active
            ORDER BY p.partner_name
        """
        return await db_manager.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파트너 목록 조회 실패: {str(e)}")


@router.get("/hierarchy", response_model=List[PartnerHierarchy])
async def get_partner_hospital_hierarchy():
    """파트너-병원 계층 구조 조회 (Tree 형태)"""
    try:
        partners_query = """
            SELECT partner_id, partner_name, is_active
            FROM welno.tb_partner_config
            WHERE is_active = true
            ORDER BY partner_name
        """
        partners = await db_manager.execute_query(partners_query)

        result = []
        base = Path(LOCAL_FAISS_BY_HOSPITAL)

        for partner in partners:
            hospitals_query = """
                SELECT
                    rc.partner_id,
                    COALESCE(pc.partner_name, rc.partner_id) as partner_name,
                    rc.hospital_id,
                    COALESCE(rc.hospital_name, h.hospital_name, rc.hospital_id) as hospital_name,
                    rc.is_active as config_active
                FROM welno.tb_hospital_rag_config rc
                LEFT JOIN welno.welno_hospitals h ON rc.hospital_id = h.hospital_id
                LEFT JOIN welno.tb_partner_config pc ON rc.partner_id = pc.partner_id
                WHERE rc.partner_id = %s AND rc.hospital_id != '*' AND rc.is_active = true
                ORDER BY hospital_name
            """
            hospitals_data = await db_manager.execute_query(hospitals_query, (partner['partner_id'],))

            hospitals = []
            for h in hospitals_data:
                hid = h['hospital_id']
                base_path = base / hid
                uploads_path = base_path / UPLOADS_SUBDIR
                has_index = (base_path / "faiss.index").exists()
                has_uploads = uploads_path.exists()
                count = len(list(uploads_path.glob("*"))) if has_uploads else 0

                hospitals.append(HospitalEmbeddingItem(
                    partner_id=h['partner_id'],
                    partner_name=h['partner_name'],
                    hospital_id=hid,
                    hospital_name=h['hospital_name'],
                    has_embedding=has_index,
                    has_uploads=has_uploads,
                    document_count=count,
                ))

            result.append(PartnerHierarchy(
                partner_id=partner['partner_id'],
                partner_name=partner['partner_name'],
                is_active=partner['is_active'],
                hospitals=hospitals,
            ))

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계층 구조 조회 실패: {str(e)}")


# ─── 프론트엔드 설정 API ──────────────────────────────────────────

@router.get("/config/frontend")
async def get_frontend_config(partner_id: str = "welno", hospital_id: Optional[str] = None):
    """프론트엔드용 동적 설정 제공"""
    try:
        from ....services.dynamic_config_service import dynamic_config

        default_hospital_id = await dynamic_config.get_default_hospital_id(partner_id)
        mediarc_config = await dynamic_config.get_mediarc_config(partner_id)
        metadata = await dynamic_config.get_partner_metadata(partner_id, hospital_id)

        if not metadata or metadata.get("is_not_found"):
            raise HTTPException(status_code=404, detail="등록되지 않은 파트너 또는 병원입니다.")

        return {
            "partner_id": partner_id,
            "hospital_id": hospital_id,
            "partner_name": metadata["partner_name"],
            "phone_number": metadata["phone_number"],
            "default_hospital_id": default_hospital_id,
            "api_key": mediarc_config["api_key"],
            "mediarc_enabled": mediarc_config["enabled"],
            "welcome_message": metadata["welcome_message"],
            "theme": metadata["theme"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프론트엔드 설정 조회 실패: {str(e)}")


# ─── 대기 병원 등록 API ───────────────────────────────────────────

@router.get("/pending-hospitals")
async def get_pending_hospitals():
    """등록 대기 중인 병원 목록"""
    try:
        query = """
            SELECT id, partner_id, hospital_id, first_seen_at, last_seen_at, request_count, status
            FROM welno.tb_pending_hospital_registration
            WHERE status = 'pending'
            ORDER BY last_seen_at DESC
        """
        return await db_manager.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대기 병원 목록 조회 실패: {str(e)}")


# ─── 대화 로그 API ────────────────────────────────────────────────

@router.get("/hospitals/{hospital_id}/chats")
async def get_hospital_chats(hospital_id: str, partner_id: str):
    """특정 병원의 대화 세션 목록 조회"""
    try:
        query = """
            SELECT
                session_id,
                user_uuid,
                message_count,
                created_at,
                updated_at,
                initial_data->>'name' as user_name,
                initial_data->>'phone' as user_phone
            FROM welno.tb_partner_rag_chat_log
            WHERE partner_id = %s AND hospital_id = %s
            ORDER BY created_at DESC
        """
        return await db_manager.execute_query(query, (partner_id, hospital_id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대화 목록 조회 실패: {str(e)}")


@router.get("/chats/{session_id}")
async def get_chat_detail(session_id: str):
    """특정 세션의 대화 상세 내역 조회"""
    try:
        query = """
            SELECT
                session_id,
                partner_id,
                hospital_id,
                user_uuid,
                conversation,
                initial_data,
                created_at
            FROM welno.tb_partner_rag_chat_log
            WHERE session_id = %s
        """
        result = await db_manager.execute_one(query, (session_id,))
        if not result:
            raise HTTPException(status_code=404, detail="대화 내역을 찾을 수 없습니다.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대화 상세 조회 실패: {str(e)}")


# ─── 병원 목록 API ────────────────────────────────────────────────

@router.get("/hospitals", response_model=List[HospitalEmbeddingItem])
async def list_hospitals_with_embedding_status(partner_id: Optional[str] = None):
    """병원 목록 조회 (파트너 계층 포함, 설정 테이블 기준)"""
    try:
        where_clause = "WHERE rc.hospital_id != '*'"
        params = []

        if partner_id:
            where_clause += " AND rc.partner_id = %s"
            params.append(partner_id)

        query = f"""
            SELECT
                rc.partner_id,
                COALESCE(pc.partner_name, rc.partner_id) as partner_name,
                rc.hospital_id,
                COALESCE(rc.hospital_name, h.hospital_name, rc.hospital_id) as hospital_name,
                rc.is_active as config_active
            FROM welno.tb_hospital_rag_config rc
            LEFT JOIN welno.welno_hospitals h ON rc.hospital_id = h.hospital_id
            LEFT JOIN welno.tb_partner_config pc ON rc.partner_id = pc.partner_id
            {where_clause}
            ORDER BY partner_name, hospital_name
        """
        mappings = await db_manager.execute_query(query, params)

        remaining = []
        if not partner_id:
            query_remaining = """
                SELECT
                    'welno' as partner_id,
                    'Welno (기본)' as partner_name,
                    h.hospital_id,
                    h.hospital_name,
                    true as config_active
                FROM welno.welno_hospitals h
                WHERE h.hospital_id NOT IN (SELECT hospital_id FROM welno.tb_hospital_rag_config WHERE hospital_id != '*')
                AND h.is_active = true
            """
            remaining = await db_manager.execute_query(query_remaining)

        all_hospitals = mappings + remaining

        result = []
        base = Path(LOCAL_FAISS_BY_HOSPITAL)

        for m in all_hospitals:
            hid = m['hospital_id']
            base_path = base / hid
            uploads_path = base_path / UPLOADS_SUBDIR
            has_index = (base_path / "faiss.index").exists()
            has_uploads = uploads_path.exists()
            count = len(list(uploads_path.glob("*"))) if has_uploads else 0

            result.append(HospitalEmbeddingItem(
                partner_id=m['partner_id'],
                partner_name=m['partner_name'],
                hospital_id=hid,
                hospital_name=m['hospital_name'],
                has_embedding=has_index,
                has_uploads=has_uploads,
                document_count=count,
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 목록 조회 실패: {str(e)}")


# ─── 문서 관리 API ────────────────────────────────────────────────

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


@router.delete("/hospitals/{hospital_id}/documents/{filename}")
async def delete_hospital_document(hospital_id: str, filename: str) -> Dict[str, Any]:
    """병원별 업로드 문서 삭제. 삭제 후 인덱스 재구축이 필요할 수 있음."""
    uploads_path = _hospital_uploads_path(hospital_id)
    target = uploads_path / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")
    if not target.is_file():
        raise HTTPException(status_code=400, detail=f"파일이 아닙니다: {filename}")
    # 경로 탐색 공격(path traversal) 방어
    try:
        target.resolve().relative_to(uploads_path.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="잘못된 파일 경로입니다.")
    try:
        size = target.stat().st_size
        target.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")
    return {
        "success": True,
        "hospital_id": hospital_id,
        "filename": filename,
        "deleted_size_bytes": size,
    }


# ─── 아이콘 업로드 API ────────────────────────────────────────────

@router.post("/hospitals/{hospital_id}/icon")
async def upload_hospital_icon(
    hospital_id: str,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """병원/파트너별 커스텀 아이콘 업로드"""
    try:
        icon_dir = Path("static/uploads/icons")
        icon_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename).suffix.lower()
        if ext not in [".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]:
            raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")

        filename = f"{hospital_id}_icon{ext}"
        dest = icon_dir / filename

        content = await file.read()
        dest.write_bytes(content)

        url = f"/static/uploads/icons/{filename}"
        return {"success": True, "url": url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"아이콘 업로드 실패: {str(e)}")


# ─── 임베딩 재구축 API ────────────────────────────────────────────

def _run_rebuild_for_hospital(hospital_id: str) -> None:
    """병원별 FAISS 인덱스 재구축 (백그라운드).

    uploads 폴더의 PDF/텍스트를 파싱 → OpenAI 임베딩 → FAISS 인덱스 저장.
    rag_service.py와 동일한 EMBEDDING_MODEL, EMBEDDING_DIMENSION 사용.
    """
    global _rebuild_status
    _rebuild_status[hospital_id] = {
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "progress": "초기화 중...",
        "error": None,
    }

    base = _hospital_base_path(hospital_id)
    uploads = base / UPLOADS_SUBDIR
    base.mkdir(parents=True, exist_ok=True)

    if not uploads.exists() or not any(uploads.iterdir()):
        _rebuild_status[hospital_id].update({
            "status": "failed",
            "error": "업로드된 문서가 없습니다.",
            "finished_at": datetime.now().isoformat(),
        })
        return

    try:
        # 1. 필수 라이브러리 임포트
        from llama_index.core import (
            Settings,
            VectorStoreIndex,
            StorageContext,
            Document,
        )
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.faiss import FaissVectorStore
        import faiss
        from pypdf import PdfReader

        _rebuild_status[hospital_id]["progress"] = "문서 파싱 중..."

        # 2. uploads 내 파일 → LlamaIndex Document 변환
        documents: list = []
        supported_exts = {".pdf", ".txt", ".md", ".csv"}
        for filepath in sorted(uploads.iterdir()):
            if not filepath.is_file() or filepath.name.startswith("."):
                continue
            ext = filepath.suffix.lower()
            if ext not in supported_exts:
                logger.info(f"[rebuild:{hospital_id}] 건너뜀 (미지원): {filepath.name}")
                continue
            try:
                if ext == ".pdf":
                    reader = PdfReader(str(filepath))
                    for page_num, page in enumerate(reader.pages, 1):
                        text = page.extract_text() or ""
                        text = text.strip()
                        if text:
                            documents.append(Document(
                                text=text,
                                metadata={
                                    "file_name": filepath.name,
                                    "page_label": str(page_num),
                                    "hospital_id": hospital_id,
                                },
                            ))
                else:
                    # txt, md, csv → 전체 텍스트
                    text = filepath.read_text(encoding="utf-8", errors="ignore").strip()
                    if text:
                        documents.append(Document(
                            text=text,
                            metadata={
                                "file_name": filepath.name,
                                "page_label": "1",
                                "hospital_id": hospital_id,
                            },
                        ))
            except Exception as parse_err:
                logger.warning(f"[rebuild:{hospital_id}] 파싱 실패 {filepath.name}: {parse_err}")

        if not documents:
            _rebuild_status[hospital_id].update({
                "status": "failed",
                "error": "파싱 가능한 문서가 없습니다.",
                "finished_at": datetime.now().isoformat(),
            })
            return

        _rebuild_status[hospital_id]["progress"] = f"{len(documents)}개 문서 청크 임베딩 중..."

        # 3. 임베딩 모델 설정
        from ....core.config import settings as app_settings
        openai_api_key = os.environ.get("OPENAI_API_KEY") or app_settings.openai_api_key
        if not openai_api_key or openai_api_key == "dev-openai-key":
            _rebuild_status[hospital_id].update({
                "status": "failed",
                "error": "OPENAI_API_KEY가 설정되지 않았습니다.",
                "finished_at": datetime.now().isoformat(),
            })
            return

        embed_model = OpenAIEmbedding(model=EMBEDDING_MODEL, api_key=openai_api_key)
        Settings.embed_model = embed_model

        # 4. FAISS 인덱스 생성
        _rebuild_status[hospital_id]["progress"] = "FAISS 인덱스 생성 중..."
        faiss_index = faiss.IndexFlatL2(EMBEDDING_DIMENSION)
        vector_store = FaissVectorStore(faiss_index=faiss_index)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        # 5. 인덱스 빌드 (임베딩 + 저장)
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            show_progress=False,
        )

        # 6. 디스크 저장 (rag_service.py가 로드하는 형식과 동일)
        _rebuild_status[hospital_id]["progress"] = "인덱스 저장 중..."
        index.storage_context.persist(persist_dir=str(base))

        _rebuild_status[hospital_id].update({
            "status": "completed",
            "progress": f"완료: {len(documents)}개 청크, 벡터 {faiss_index.ntotal}개",
            "finished_at": datetime.now().isoformat(),
            "document_count": len(documents),
            "vector_count": faiss_index.ntotal,
        })
        logger.info(f"[rebuild:{hospital_id}] 완료 - 문서 {len(documents)}개, 벡터 {faiss_index.ntotal}개")

    except Exception as e:
        logger.error(f"[rebuild:{hospital_id}] 재구축 실패: {e}")
        logger.error(traceback.format_exc())
        _rebuild_status[hospital_id].update({
            "status": "failed",
            "error": str(e),
            "finished_at": datetime.now().isoformat(),
        })


@router.post("/hospitals/{hospital_id}/rebuild")
async def trigger_rebuild(
    hospital_id: str,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """병원별 임베딩 인덱스 재구축 트리거 (비동기)."""
    # 이미 실행 중이면 중복 방지
    current = _rebuild_status.get(hospital_id)
    if current and current.get("status") == "running":
        return {
            "success": False,
            "message": "이미 재구축이 진행 중입니다.",
            "hospital_id": hospital_id,
            "status": current,
        }
    background_tasks.add_task(_run_rebuild_for_hospital, hospital_id)
    return {
        "success": True,
        "message": "재구축이 백그라운드에서 시작되었습니다.",
        "hospital_id": hospital_id,
    }


@router.get("/hospitals/{hospital_id}/rebuild/status")
async def get_rebuild_status(hospital_id: str) -> Dict[str, Any]:
    """재구축 진행 상태 조회"""
    status = _rebuild_status.get(hospital_id)
    if not status:
        return {"hospital_id": hospital_id, "status": "idle", "message": "재구축 이력 없음"}
    return {"hospital_id": hospital_id, **status}


# ─── 병원 RAG 설정 CRUD ──────────────────────────────────────────

@router.get("/hospitals/{hospital_id}/config", response_model=HospitalRagConfigResponse)
async def get_hospital_config(hospital_id: str, partner_id: str = "welno"):
    """병원별 RAG/LLM 설정 조회"""
    try:
        query = """
            SELECT partner_id, hospital_id, hospital_name, contact_phone, persona_prompt, welcome_message,
                   llm_config, embedding_config, theme_config, is_active,
                   created_at, updated_at
            FROM welno.tb_hospital_rag_config
            WHERE partner_id = %s AND hospital_id = %s
        """
        config = await db_manager.execute_one(query, (partner_id, hospital_id))

        if not config:
            hospital_name_query = "SELECT hospital_name FROM welno.welno_hospitals WHERE hospital_id = %s"
            hospital_info = await db_manager.execute_one(hospital_name_query, (hospital_id,))
            hospital_name = hospital_info['hospital_name'] if hospital_info else hospital_id

            return HospitalRagConfigResponse(
                partner_id=partner_id,
                hospital_id=hospital_id,
                hospital_name=hospital_name,
                contact_phone=None,
                persona_prompt="",
                welcome_message="",
                llm_config={"model": "gemini-3-flash-preview", "temperature": 0.7, "max_tokens": 2000},
                embedding_config={"model": "text-embedding-ada-002", "index_name": "faiss_db"},
                theme_config={"theme": "default", "logo_url": None, "primary_color": "#7B5E4F"},
                is_active=True,
            )

        return HospitalRagConfigResponse(
            partner_id=config['partner_id'],
            hospital_id=config['hospital_id'],
            hospital_name=config['hospital_name'],
            contact_phone=config.get('contact_phone'),
            persona_prompt=config['persona_prompt'],
            welcome_message=config['welcome_message'],
            llm_config=config['llm_config'] or {},
            embedding_config=config['embedding_config'] or {},
            theme_config=config['theme_config'] or {},
            is_active=config['is_active'],
            created_at=config['created_at'].isoformat() if config['created_at'] else None,
            updated_at=config['updated_at'].isoformat() if config['updated_at'] else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 조회 실패: {str(e)}")


@router.put("/hospitals/{hospital_id}/config")
async def update_hospital_config(
    hospital_id: str,
    config: HospitalRagConfigUpdate = Body(...),
):
    """병원별 RAG/LLM 설정 저장 (Upsert)"""
    try:
        query = """
            INSERT INTO welno.tb_hospital_rag_config
            (partner_id, hospital_id, hospital_name, contact_phone, persona_prompt, welcome_message, llm_config, embedding_config, theme_config, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (partner_id, hospital_id) DO UPDATE SET
                hospital_name = EXCLUDED.hospital_name,
                contact_phone = EXCLUDED.contact_phone,
                persona_prompt = EXCLUDED.persona_prompt,
                welcome_message = EXCLUDED.welcome_message,
                llm_config = EXCLUDED.llm_config,
                embedding_config = EXCLUDED.embedding_config,
                theme_config = EXCLUDED.theme_config,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
        """
        await db_manager.execute_update(query, (
            config.partner_id, hospital_id, config.hospital_name, config.contact_phone,
            config.persona_prompt, config.welcome_message,
            json.dumps(config.llm_config or {}), json.dumps(config.embedding_config or {}),
            json.dumps(config.theme_config or {}), config.is_active,
        ))

        from ....services.dynamic_config_service import dynamic_config
        dynamic_config.clear_cache()

        return {"success": True, "hospital_id": hospital_id, "partner_id": config.partner_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")


@router.post("/hospitals")
async def create_hospital_config(
    config: HospitalRagConfigUpdate = Body(...),
    hospital_id: Optional[str] = None,
):
    """새 병원 RAG 설정 생성"""
    try:
        if not hospital_id:
            import uuid
            hospital_id = str(uuid.uuid4()).replace('-', '').upper()[:32]

        existing = await db_manager.execute_one(
            "SELECT hospital_id FROM welno.tb_hospital_rag_config WHERE partner_id = %s AND hospital_id = %s",
            (config.partner_id, hospital_id),
        )

        if existing:
            raise HTTPException(status_code=409, detail=f"병원 설정이 이미 존재합니다: {hospital_id}")

        query = """
            INSERT INTO welno.tb_hospital_rag_config
            (partner_id, hospital_id, hospital_name, contact_phone, persona_prompt, welcome_message, llm_config, embedding_config, theme_config, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        await db_manager.execute_update(query, (
            config.partner_id, hospital_id, config.hospital_name, config.contact_phone,
            config.persona_prompt, config.welcome_message,
            json.dumps(config.llm_config or {"model": "gemini-3-flash-preview", "temperature": 0.7, "max_tokens": 2000}),
            json.dumps(config.embedding_config or {"model": "text-embedding-ada-002", "index_name": "faiss_db"}),
            json.dumps(config.theme_config or {"theme": "default", "logo_url": None, "primary_color": "#7B5E4F"}),
            config.is_active,
        ))

        from ....services.dynamic_config_service import dynamic_config
        dynamic_config.clear_cache()

        return {"success": True, "hospital_id": hospital_id, "partner_id": config.partner_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 설정 생성 실패: {str(e)}")


@router.delete("/hospitals/{hospital_id}/config")
async def delete_hospital_config(hospital_id: str, partner_id: str = "welno"):
    """병원 RAG 설정 삭제 (비활성화)"""
    try:
        query = """
            UPDATE welno.tb_hospital_rag_config
            SET is_active = false, updated_at = NOW()
            WHERE partner_id = %s AND hospital_id = %s
        """
        result = await db_manager.execute_update(query, (partner_id, hospital_id))

        if result == 0:
            raise HTTPException(status_code=404, detail=f"병원 설정을 찾을 수 없습니다: {hospital_id}")

        from ....services.dynamic_config_service import dynamic_config
        dynamic_config.clear_cache()

        return {"success": True, "hospital_id": hospital_id, "message": "병원 설정이 비활성화되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 설정 삭제 실패: {str(e)}")
