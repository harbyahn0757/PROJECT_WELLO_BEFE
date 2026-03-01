"""
웰로 벡터 DB 관리 스크립트 (pypdf 버전)
- LlamaParse 제거 → pypdf 로컬 파싱
- OpenAI Embedding: text-embedding-ada-002
- 증분 업데이트 지원 (기존 인덱스 로드 후 추가)
- 지원 확장자: .pdf, .xlsx, .csv, .md, .txt
"""

import os
import sys
import time
import gc
import json
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from datetime import datetime

# LlamaIndex
from llama_index.core import Document, VectorStoreIndex, StorageContext, Settings, load_index_from_storage
from llama_index.embeddings.openai import OpenAIEmbedding

# FAISS
import faiss
from llama_index.vector_stores.faiss import FaissVectorStore

# 파싱
from pypdf import PdfReader
import pandas as pd

# 임베딩 상수 (rag_service와 동일)
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536


class WelnoAIVectorDBManager:
    """pypdf 기반 벡터 DB 통합 관리자 (LlamaParse 없음)"""

    def __init__(self, target_folders: Optional[Union[str, List[str]]] = None, batch_size: int = 5):
        self.raw_data_root = Path("/data/raw_data")
        if isinstance(target_folders, str):
            self.target_folders = [target_folders]
        else:
            self.target_folders = target_folders

        self.db_dir = Path("/data/vector_db/welno/faiss_db")
        self.batch_size = batch_size
        self.start_time = time.time()
        self.db_dir.mkdir(parents=True, exist_ok=True)

        self._load_env()

        # 임베딩 모델 (OpenAI만)
        self.embed_model = OpenAIEmbedding(
            model=EMBEDDING_MODEL,
            api_key=self.openai_api_key
        )
        Settings.embed_model = self.embed_model
        Settings.llm = None

        print("\n" + "=" * 80)
        print("🚀 웰로 벡터 DB 관리 시스템 (pypdf 버전)")
        print("=" * 80)
        print(f"⏰ 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 타겟: {self.target_folders or '전체'}")
        print(f"💾 DB: {self.db_dir}")
        print("=" * 80 + "\n")

    def _load_env(self):
        env_path = Path("/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/config.env")
        if env_path.exists():
            import re
            content = env_path.read_text()
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

        self.openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY 미설정")

    def log(self, step: str, message: str, level: str = "INFO"):
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "WARNING": "⚠️",
                 "ERROR": "❌", "PROGRESS": "🔄", "DB": "💾", "SAVE": "💾"}
        icon = icons.get(level, "ℹ️")
        elapsed = time.time() - self.start_time
        print(f"[{elapsed:7.1f}s] {icon} [{step}] {message}", flush=True)

    def normalize_path(self, path_str: str) -> str:
        return unicodedata.normalize('NFC', path_str)

    def find_target_paths(self) -> List[Path]:
        if not self.target_folders:
            return [self.raw_data_root]

        target_paths = []
        normalized_targets = [self.normalize_path(t) for t in self.target_folders]

        for root, dirs, _ in os.walk(self.raw_data_root):
            root_path = Path(root)
            for d in dirs:
                if self.normalize_path(d) in normalized_targets:
                    target_paths.append(root_path / d)

        for t in self.target_folders:
            p = self.raw_data_root / t
            if p.exists() and p not in target_paths:
                target_paths.append(p)

        return list(set(target_paths))

    def get_indexed_files(self) -> set:
        """docstore에서 이미 인덱싱된 파일명 목록 반환"""
        docstore_path = self.db_dir / "docstore.json"
        if not docstore_path.exists():
            return set()
        with open(docstore_path) as f:
            data = json.load(f)
        indexed = set()
        for nid, node in data.get("docstore/data", {}).items():
            meta = node.get("__data__", {}).get("metadata", {})
            fname = meta.get("file_name", "")
            if fname:
                indexed.add(fname)
        return indexed

    def scan_files(self) -> List[Dict[str, Any]]:
        """지정된 타겟 폴더 내 파일 스캔 (.pdf .xlsx .csv .md .txt 지원)"""
        target_paths = self.find_target_paths()
        file_list = []

        if not target_paths:
            self.log("ERROR", f"타겟 폴더를 찾을 수 없음: {self.target_folders}", "ERROR")
            return []

        # 지원 확장자 (이미지 제외, md/txt 추가)
        SUPPORTED_EXTS = {'.pdf', '.xlsx', '.csv', '.md', '.txt'}

        for target_path in target_paths:
            self.log("INFO", f"스캔 중: {target_path}", "INFO")
            for root, _, files in os.walk(target_path):
                try:
                    rel_path = Path(root).relative_to(self.raw_data_root)
                except ValueError:
                    rel_path = Path(root)

                path_parts = rel_path.parts
                main_cat = path_parts[0] if path_parts else target_path.name
                sub_cat = "/".join(path_parts[1:]) if len(path_parts) > 1 else "root"

                for f in files:
                    if f.startswith('.') or f.startswith('~'):
                        continue
                    file_path = Path(root) / f
                    if file_path.suffix.lower() in SUPPORTED_EXTS:
                        file_list.append({
                            'path': str(file_path),
                            'name': f,
                            'ext': file_path.suffix.lower(),
                            'category': f"{main_cat}/{sub_cat}",
                            'main_category': main_cat,
                            'sub_category': sub_cat
                        })

        # 중복 제거
        seen = set()
        unique_files = []
        for f in file_list:
            if f['path'] not in seen:
                unique_files.append(f)
                seen.add(f['path'])

        return unique_files

    def process_batch(self, files: List[Dict[str, Any]], index: VectorStoreIndex):
        """배치 파싱 및 인덱스 추가 (동기)"""
        documents = []

        for file_info in files:
            file_path = Path(file_info['path'])
            self.log("PARSE", f"처리 중: {file_info['name']}", "PROGRESS")

            base_meta = {
                'file_name': file_info['name'],
                'file_path': str(file_path),
                'category': file_info['category'],
                'main_category': file_info['main_category'],
                'sub_category': file_info['sub_category'],
            }

            try:
                ext = file_info['ext']

                # PDF — pypdf 페이지별 추출
                if ext == '.pdf':
                    reader = PdfReader(str(file_path))
                    page_count = 0
                    for page_num, page in enumerate(reader.pages, 1):
                        text = (page.extract_text() or "").strip()
                        if text:
                            documents.append(Document(
                                text=text,
                                metadata={
                                    **base_meta,
                                    'page_label': str(page_num),
                                    'doc_type': 'pypdf_parsed'
                                }
                            ))
                            page_count += 1
                    self.log("PARSE", f"  ✅ {file_info['name']}: {page_count}페이지 추출", "SUCCESS")

                # MD / TXT — 전체 텍스트
                elif ext in ('.md', '.txt'):
                    text = file_path.read_text(encoding='utf-8', errors='ignore').strip()
                    if text:
                        documents.append(Document(
                            text=text,
                            metadata={**base_meta, 'doc_type': 'markdown'}
                        ))
                        self.log("PARSE", f"  ✅ {file_info['name']}: 텍스트 추출", "SUCCESS")

                # XLSX — 시트별 마크다운 테이블
                elif ext == '.xlsx':
                    df_dict = pd.read_excel(file_path, sheet_name=None)
                    for sheet, df in df_dict.items():
                        documents.append(Document(
                            text=f"Sheet: {sheet}\n{df.to_markdown()}",
                            metadata={**base_meta, 'doc_type': 'table', 'sheet_name': sheet}
                        ))
                    self.log("PARSE", f"  ✅ {file_info['name']}: {len(df_dict)}시트 추출", "SUCCESS")

                # CSV
                elif ext == '.csv':
                    df = None
                    for enc in ['utf-8', 'cp949', 'euc-kr']:
                        try:
                            df = pd.read_csv(file_path, encoding=enc)
                            break
                        except Exception:
                            continue
                    if df is not None:
                        documents.append(Document(
                            text=df.to_markdown(),
                            metadata={**base_meta, 'doc_type': 'table'}
                        ))
                        self.log("PARSE", f"  ✅ {file_info['name']}: CSV 추출", "SUCCESS")

            except Exception as e:
                self.log("ERROR", f"실패: {file_info['name']} — {e}", "ERROR")

        # 청킹 + 임베딩 위임 (기존 동일 파일의 이전 노드 삭제 후 삽입 → orphaned node 방지)
        if documents:
            self.log("INDEX", f"임베딩 중 ({len(documents)}개 문서)...", "PROGRESS")
            for doc in documents:
                # 동일 file_name의 기존 문서가 있으면 먼저 삭제 (orphaned node 방지)
                file_name = doc.metadata.get("file_name")
                if file_name:
                    try:
                        existing_ids = [
                            did for did, info in index.docstore.ref_doc_info.items()
                            if info.metadata.get("file_name") == file_name
                        ]
                        for old_doc_id in existing_ids:
                            index.delete_ref_doc(old_doc_id, delete_from_docstore=True)
                            self.log("CLEAN", f"  🗑️ 기존 노드 삭제: {file_name} ({old_doc_id[:12]}...)", "INFO")
                    except Exception as e:
                        self.log("WARNING", f"  ⚠️ 기존 노드 삭제 실패 (무시): {e}", "WARNING")
                index.insert(doc)
            gc.collect()

    def run(self):
        all_files = self.scan_files()
        self.log("START", f"총 {len(all_files)}개 파일 스캔", "INFO")

        if not all_files:
            self.log("DONE", "추가할 파일 없음", "INFO")
            return

        # 이미 인덱싱된 파일 스킵
        indexed = self.get_indexed_files()
        new_files = [f for f in all_files if f['name'] not in indexed]
        skip_files = [f for f in all_files if f['name'] in indexed]

        self.log("START", f"이미 인덱싱: {len(skip_files)}개 스킵", "INFO")
        self.log("START", f"새로 처리할 파일: {len(new_files)}개", "INFO")

        if not new_files:
            self.log("DONE", "모든 파일이 이미 인덱싱되어 있습니다.", "INFO")
            return

        for f in new_files:
            self.log("NEW", f"  + {f['name']}", "INFO")

        # 인덱스 로드 또는 생성
        try:
            if not (self.db_dir / "docstore.json").exists():
                raise FileNotFoundError("기존 인덱스 없음")
            vector_store = FaissVectorStore.from_persist_dir(str(self.db_dir))
            storage_context = StorageContext.from_defaults(
                vector_store=vector_store, persist_dir=str(self.db_dir)
            )
            index = load_index_from_storage(storage_context)
            self.log("DB", f"기존 인덱스 로드 완료 ({len(index.docstore.docs)}개 노드)", "SUCCESS")
        except Exception as e:
            self.log("WARNING", f"새 인덱스 생성 ({e})", "WARNING")
            faiss_index = faiss.IndexFlatL2(EMBEDDING_DIMENSION)
            vector_store = FaissVectorStore(faiss_index=faiss_index)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            index = VectorStoreIndex([], storage_context=storage_context)

        # 배치 처리
        for i in range(0, len(new_files), self.batch_size):
            batch = new_files[i: i + self.batch_size]
            batch_num = i // self.batch_size + 1
            total_batches = (len(new_files) + self.batch_size - 1) // self.batch_size
            self.log("BATCH", f"배치 {batch_num}/{total_batches} 시작", "INFO")

            self.process_batch(batch, index)

            # 저장
            index.storage_context.persist(persist_dir=str(self.db_dir))
            v_store = index.storage_context.vector_store
            f_idx = getattr(v_store, '_faiss_index', None) or getattr(v_store, 'faiss_index', None)
            if f_idx:
                faiss.write_index(f_idx, str(self.db_dir / "faiss.index"))
            self.log("SAVE", f"배치 {batch_num} 저장 완료", "SAVE")

        final_count = len(index.docstore.docs)
        self.log("COMPLETE", f"🎉 완료! 최종 노드: {final_count}개", "SUCCESS")


if __name__ == "__main__":
    # target_folders=None → 전체 raw_data 스캔 (incremental)
    manager = WelnoAIVectorDBManager(target_folders=None, batch_size=5)
    manager.run()
