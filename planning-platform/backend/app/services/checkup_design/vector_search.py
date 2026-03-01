"""
FAISS 벡터 검색 모듈 — llama-index 없이 직접 FAISS + OpenAI 임베딩 사용.

데이터 구조 (llama-index가 생성한 형식과 호환):
  faiss.index       — FAISS 바이너리 인덱스 (IndexFlatL2, dim=1536)
  index_store.json  — FAISS idx(int) → node_id(UUID) 매핑
  docstore.json     — node_id(UUID) → {text, metadata} 매핑
"""
import faiss
import json
import numpy as np
import logging
from pathlib import Path
from openai import OpenAI
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class FAISSVectorSearch:
    """FAISS 인덱스 + docstore를 직접 로드하여 벡터 검색 수행."""

    def __init__(self, faiss_dir: str, openai_api_key: str,
                 embedding_model: str = "text-embedding-ada-002"):
        self.faiss_dir = faiss_dir
        self.client = OpenAI(api_key=openai_api_key)
        self.model = embedding_model

        # 1. FAISS 인덱스 로드
        index_path = f"{faiss_dir}/faiss.index"
        if not Path(index_path).exists():
            raise FileNotFoundError(f"FAISS 인덱스 없음: {index_path}")
        self.index = faiss.read_index(index_path)

        # 2. FAISS idx → node_id 매핑 (index_store.json)
        with open(f"{faiss_dir}/index_store.json") as f:
            ist = json.load(f)
        idx_data = list(ist["index_store/data"].values())[0]
        nodes_dict_raw = idx_data["__data__"]
        if isinstance(nodes_dict_raw, str):
            nodes_dict_raw = json.loads(nodes_dict_raw)
        self.idx_to_node: Dict[str, str] = nodes_dict_raw.get("nodes_dict", {})

        # 3. node_id → {text, metadata} (docstore.json)
        with open(f"{faiss_dir}/docstore.json") as f:
            ds = json.load(f)
        raw = ds.get("docstore/data", ds)
        self.docstore: Dict[str, Dict] = {}
        for node_id, node in raw.items():
            nd = node.get("__data__", node)
            self.docstore[node_id] = {
                "text": nd.get("text", ""),
                "metadata": nd.get("metadata", {}),
            }

        logger.info(
            f"FAISS 인덱스 로드 완료: {self.index.ntotal}개 벡터, "
            f"docstore {len(self.docstore)}개 노드"
        )

    def search(self, query: str, top_k: int = 10) -> List[Dict]:
        """쿼리 임베딩 → FAISS 검색 → 문서 반환."""
        embedding = self._embed(query)
        query_vec = np.array([embedding], dtype=np.float32)
        distances, indices = self.index.search(query_vec, top_k)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0:
                continue
            node_id = self.idx_to_node.get(str(idx))
            if not node_id:
                continue
            doc = self.docstore.get(node_id, {})
            results.append({
                "text": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": float(dist),
                "node_id": node_id,
            })
        return results

    def _embed(self, text: str) -> List[float]:
        """OpenAI 임베딩 API 호출."""
        resp = self.client.embeddings.create(input=text, model=self.model)
        return resp.data[0].embedding
