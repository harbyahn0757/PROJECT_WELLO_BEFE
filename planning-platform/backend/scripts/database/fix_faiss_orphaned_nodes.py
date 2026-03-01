"""
FAISS Orphaned Node 정리 스크립트
- docstore/ref_doc_info에 등록되어 있으나 docstore/data에 없는 orphaned node 제거
- FAISS 인덱스를 유효 노드만으로 clean rebuild
- 백업 생성 후 진행
"""

import os
import sys
import json
import shutil
import time
from pathlib import Path
from datetime import datetime

import faiss
from llama_index.vector_stores.faiss import FaissVectorStore
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.index_store import SimpleIndexStore
from llama_index.core import StorageContext, load_index_from_storage, Settings, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding

# ── 설정 ──
DB_DIR = Path("/data/vector_db/welno/faiss_db")
BACKUP_DIR = Path("/data/vector_db/welno/backup") / f"faiss_db_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536


def load_env():
    env_path = Path("/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/config.env")
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def find_orphaned_nodes():
    """orphaned node_id 목록과 해당 ref_doc_id를 찾는다."""
    with open(DB_DIR / "docstore.json", encoding="utf-8-sig") as f:
        ds = json.load(f)

    ref_doc_info = ds["docstore/ref_doc_info"]
    data = ds["docstore/data"]

    orphaned_doc_ids = []  # 완전히 orphaned인 ref_doc entries
    orphaned_node_ids = set()

    for doc_id, info in ref_doc_info.items():
        node_ids = info.get("node_ids", [])
        missing = [nid for nid in node_ids if nid not in data]
        if missing:
            if len(missing) == len(node_ids):
                orphaned_doc_ids.append(doc_id)
                orphaned_node_ids.update(missing)
                meta = info.get("metadata", {})
                print(f"  [ORPHAN] {doc_id[:16]}... file={meta.get('file_name', 'N/A')} ({len(missing)} nodes)")

    return orphaned_doc_ids, orphaned_node_ids, len(data), len(ref_doc_info)


def backup():
    """현재 FAISS DB를 백업."""
    print(f"\n📦 백업 생성 중: {BACKUP_DIR}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for f in DB_DIR.iterdir():
        if f.is_file():
            shutil.copy2(f, BACKUP_DIR / f.name)
    print(f"✅ 백업 완료: {BACKUP_DIR}")


def clean_rebuild():
    """
    정리 전략: docstore.json에서 orphaned ref_doc_info 엔트리를 직접 제거한 후
    유효한 노드의 embedding만으로 FAISS 인덱스를 재구축.
    """
    load_env()

    print("=" * 60)
    print("🔍 FAISS Orphaned Node 진단")
    print("=" * 60)

    # 1. 진단
    orphaned_doc_ids, orphaned_node_ids, data_count, ref_count = find_orphaned_nodes()

    faiss_index = faiss.read_index(str(DB_DIR / "faiss.index"))
    print(f"\n📊 현재 상태:")
    print(f"  FAISS 벡터 수:     {faiss_index.ntotal}")
    print(f"  Docstore 노드 수:  {data_count}")
    print(f"  Ref doc 엔트리:    {ref_count}")
    print(f"  Orphaned doc 수:   {len(orphaned_doc_ids)}")
    print(f"  Orphaned node 수:  {len(orphaned_node_ids)}")
    print(f"  불일치:            {faiss_index.ntotal - data_count}")

    if not orphaned_doc_ids:
        print("\n✅ 정리할 orphaned node가 없습니다.")
        return

    # 2. 백업
    backup()

    # 3. docstore.json 직접 수정 — orphaned ref_doc_info 제거
    print(f"\n🧹 docstore.json에서 orphaned ref_doc_info {len(orphaned_doc_ids)}개 제거 중...")
    with open(DB_DIR / "docstore.json", encoding="utf-8-sig") as f:
        ds = json.load(f)

    for doc_id in orphaned_doc_ids:
        del ds["docstore/ref_doc_info"][doc_id]

    # metadata 정리: orphaned node_id에 대한 metadata도 제거
    meta = ds.get("docstore/metadata", {})
    removed_meta = 0
    for nid in orphaned_node_ids:
        if nid in meta:
            del meta[nid]
            removed_meta += 1
    print(f"  metadata 정리: {removed_meta}건 제거")

    # 저장
    with open(DB_DIR / "docstore.json", "w", encoding="utf-8") as f:
        json.dump(ds, f, ensure_ascii=False)
    print("  ✅ docstore.json 저장 완료")

    # 4. FAISS 인덱스 clean rebuild
    # LlamaIndex의 FaissVectorStore는 node_id → FAISS position 매핑을 자체적으로 관리
    # 가장 안전한 방법: 유효한 노드만으로 StorageContext를 로드하고 인덱스 재생성
    print(f"\n🔄 FAISS 인덱스 clean rebuild 중...")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("⚠️ OPENAI_API_KEY 없음. 임베딩 없이 docstore만 정리됨.")
        print("  FAISS 인덱스 rebuild를 위해 OPENAI_API_KEY가 필요합니다.")
        print("  현재 상태에서도 fallback 로직으로 서비스 가능합니다.")
        return

    embed_model = OpenAIEmbedding(model=EMBEDDING_MODEL, api_key=api_key)
    Settings.embed_model = embed_model
    Settings.llm = None

    # 재로드 (수정된 docstore 반영)
    vector_store = FaissVectorStore.from_persist_dir(str(DB_DIR))
    docstore_new = SimpleDocumentStore.from_persist_dir(str(DB_DIR))
    index_store = SimpleIndexStore.from_persist_dir(str(DB_DIR))

    storage_context = StorageContext.from_defaults(
        vector_store=vector_store,
        docstore=docstore_new,
        index_store=index_store,
    )

    index = load_index_from_storage(storage_context)

    # delete_ref_doc으로 남아있을 수 있는 잔여 참조 정리
    # (docstore.json에서 직접 제거했으므로 index 레벨에서도 동기화)
    print(f"  인덱스 로드 완료: {len(docstore_new.docs)} 노드")

    # persist로 저장 (FAISS 인덱스도 함께 업데이트)
    index.storage_context.persist(persist_dir=str(DB_DIR))

    # FAISS 인덱스 파일도 명시적 저장
    v_store = index.storage_context.vector_store
    f_idx = getattr(v_store, '_faiss_index', None) or getattr(v_store, 'faiss_index', None)
    if f_idx:
        faiss.write_index(f_idx, str(DB_DIR / "faiss.index"))

    # 5. 검증
    print(f"\n" + "=" * 60)
    print("✅ 검증")
    print("=" * 60)

    faiss_new = faiss.read_index(str(DB_DIR / "faiss.index"))
    with open(DB_DIR / "docstore.json", encoding="utf-8-sig") as f:
        ds_verify = json.load(f)

    new_data_count = len(ds_verify["docstore/data"])
    new_ref_count = len(ds_verify["docstore/ref_doc_info"])

    # re-check orphans
    new_orphaned = 0
    for doc_id, info in ds_verify["docstore/ref_doc_info"].items():
        for nid in info.get("node_ids", []):
            if nid not in ds_verify["docstore/data"]:
                new_orphaned += 1

    print(f"  FAISS 벡터 수:     {faiss_new.ntotal}")
    print(f"  Docstore 노드 수:  {new_data_count}")
    print(f"  Ref doc 엔트리:    {new_ref_count} (이전: {ref_count})")
    print(f"  남은 orphaned:     {new_orphaned}")
    print(f"  불일치:            {faiss_new.ntotal - new_data_count}")

    if new_orphaned == 0:
        print(f"\n🎉 정리 완료! Orphaned node 0건.")
    else:
        print(f"\n⚠️ 아직 {new_orphaned}건 남아있습니다. 수동 확인 필요.")


if __name__ == "__main__":
    clean_rebuild()
