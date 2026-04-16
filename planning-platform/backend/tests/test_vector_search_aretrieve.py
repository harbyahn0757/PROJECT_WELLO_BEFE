"""
vector_search.py FAISSVectorSearch.aretrieve() 회귀 테스트.

감사 결과 재확인: aretrieve()는 vector_search.py:84에 실존.
이 테스트는 실제 FAISS 인덱스 없이 mock으로 aretrieve 계약을 검증한다.

실행:
    cd backend && python -m pytest tests/test_vector_search_aretrieve.py -v
"""

import asyncio
import importlib
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, List
from unittest.mock import MagicMock, patch

import pytest

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

# faiss / numpy 가 없는 환경(로컬 macOS)에서 픽스처 기반 테스트 스킵
_FAISS_AVAILABLE = importlib.util.find_spec("faiss") is not None
_NUMPY_AVAILABLE = importlib.util.find_spec("numpy") is not None
_DEPS_AVAILABLE = _FAISS_AVAILABLE and _NUMPY_AVAILABLE
requires_faiss = pytest.mark.skipif(
    not _DEPS_AVAILABLE,
    reason="faiss/numpy 미설치 — 서버 환경에서 실행 필요",
)


# ─── FAISS mock 픽스처 ────────────────────────────────────────────────────────

@pytest.fixture
def faiss_dir(tmp_path: Path) -> str:
    """임시 FAISS 디렉토리 — 최소 유효 구조 생성. faiss/numpy 미설치 시 skip."""
    if not _DEPS_AVAILABLE:
        pytest.skip("faiss/numpy 미설치")
    import faiss
    import numpy as np

    dim = 4

    # faiss.index (IndexFlatL2, 2 벡터)
    index = faiss.IndexFlatL2(dim)
    vecs = np.array([[0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8]], dtype=np.float32)
    index.add(vecs)
    faiss.write_index(index, str(tmp_path / "faiss.index"))

    # index_store.json — FAISS idx → node_id
    index_store = {
        "index_store/data": {
            "default": {
                "__data__": json.dumps({
                    "nodes_dict": {"0": "node-aaa", "1": "node-bbb"}
                })
            }
        }
    }
    (tmp_path / "index_store.json").write_text(json.dumps(index_store))

    # docstore.json — node_id → {text, metadata}
    docstore = {
        "docstore/data": {
            "node-aaa": {
                "__data__": {
                    "text": "고혈압 관련 건강 정보입니다.",
                    "metadata": {"source": "health_guide", "page": 1}
                }
            },
            "node-bbb": {
                "__data__": {
                    "text": "혈압 조절을 위한 생활 습관 안내.",
                    "metadata": {"source": "health_guide", "page": 2}
                }
            }
        }
    }
    (tmp_path / "docstore.json").write_text(json.dumps(docstore))

    return str(tmp_path)


# ─── 테스트 ───────────────────────────────────────────────────────────────────

def test_aretrieve_method_exists_via_source():
    """aretrieve가 vector_search.py 소스에 실존하는지 확인 (faiss import 없이 소스 grep).
    감사 재확인: vector_search.py:84 async def aretrieve()
    """
    source_path = Path(__file__).parent.parent / "app/services/checkup_design/vector_search.py"
    assert source_path.exists(), f"vector_search.py 파일 없음: {source_path}"
    source = source_path.read_text()
    assert "async def aretrieve" in source, (
        "FAISSVectorSearch에 aretrieve() 없음 — vector_search.py:84 확인 필요"
    )
    assert "asyncio.to_thread" in source, (
        "aretrieve가 asyncio.to_thread 패턴이 아님 — 이벤트 루프 블로킹 위험"
    )


@pytest.mark.asyncio
async def test_aretrieve_returns_list(faiss_dir: str):
    """aretrieve()가 리스트를 반환하는지 확인."""
    from app.services.checkup_design.vector_search import FAISSVectorSearch

    # OpenAI 클라이언트 mock — 4차원 임베딩 반환
    mock_embedding = MagicMock()
    mock_embedding.data = [MagicMock(embedding=[0.1, 0.2, 0.3, 0.4])]

    with patch("app.services.checkup_design.vector_search.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.embeddings.create.return_value = mock_embedding
        mock_openai_cls.return_value = mock_client

        vs = FAISSVectorSearch(
            faiss_dir=faiss_dir,
            openai_api_key="test-key",
        )
        results = await vs.aretrieve("고혈압", top_k=2)

    assert isinstance(results, list), "aretrieve() 반환값이 list가 아님"
    assert len(results) > 0, "aretrieve() 결과가 빈 리스트 — FAISS 검색 실패"


@pytest.mark.asyncio
async def test_aretrieve_result_schema(faiss_dir: str):
    """aretrieve() 결과 각 항목이 필수 키(text, metadata, score, node_id)를 포함하는지 확인."""
    from app.services.checkup_design.vector_search import FAISSVectorSearch

    mock_embedding = MagicMock()
    mock_embedding.data = [MagicMock(embedding=[0.1, 0.2, 0.3, 0.4])]

    with patch("app.services.checkup_design.vector_search.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.embeddings.create.return_value = mock_embedding
        mock_openai_cls.return_value = mock_client

        vs = FAISSVectorSearch(faiss_dir=faiss_dir, openai_api_key="test-key")
        results = await vs.aretrieve("고혈압", top_k=3)

    for item in results:
        assert "text" in item, f"결과 항목에 'text' 키 없음: {item}"
        assert "metadata" in item, f"결과 항목에 'metadata' 키 없음: {item}"
        assert "score" in item, f"결과 항목에 'score' 키 없음: {item}"
        assert "node_id" in item, f"결과 항목에 'node_id' 키 없음: {item}"
        assert isinstance(item["score"], float), "score가 float이 아님"


@pytest.mark.asyncio
async def test_aretrieve_top_k_respected(faiss_dir: str):
    """top_k=1이면 결과 1건만 반환하는지 확인."""
    from app.services.checkup_design.vector_search import FAISSVectorSearch

    mock_embedding = MagicMock()
    mock_embedding.data = [MagicMock(embedding=[0.1, 0.2, 0.3, 0.4])]

    with patch("app.services.checkup_design.vector_search.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_client.embeddings.create.return_value = mock_embedding
        mock_openai_cls.return_value = mock_client

        vs = FAISSVectorSearch(faiss_dir=faiss_dir, openai_api_key="test-key")
        results = await vs.aretrieve("혈압", top_k=1)

    assert len(results) == 1, f"top_k=1인데 결과 {len(results)}건 반환됨"
