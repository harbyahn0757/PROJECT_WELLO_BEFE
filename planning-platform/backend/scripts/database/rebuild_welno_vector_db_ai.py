"""
웰로 벡터 DB AI 모델 기반 통합 관리 스크립트 (LlamaParse 버전)
- LlamaParse: AI 기반 문서 파싱 (표, 이미지, 레이아웃 완벽 지원)
- OpenAI Embedding: text-embedding-ada-002
- 증분 업데이트 지원 (기존 인덱스 로드 후 추가)
- 특정 폴더 타겟팅 지원 (NFD/NFC 정규화 대응)
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

# LlamaIndex & LlamaParse
from llama_index.core import Document, VectorStoreIndex, StorageContext, Settings, load_index_from_storage
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_parse import LlamaParse

# FAISS
import faiss
from llama_index.vector_stores.faiss import FaissVectorStore

# Excel/CSV
import pandas as pd

# 임베딩 상수 (rag_service와 동일 유지)
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536


class WelnoAIVectorDBManager:
    """AI 모델 기반 벡터 DB 통합 관리자"""
    
    def __init__(self, target_folders: Optional[Union[str, List[str]]] = None, batch_size: int = 3):
        # 경로 설정 (기본값: 전체 raw_data)
        self.raw_data_root = Path("/data/raw_data")
        if isinstance(target_folders, str):
            self.target_folders = [target_folders]
        else:
            self.target_folders = target_folders
            
        self.db_dir = Path("/data/vector_db/welno/faiss_db")
        self.batch_size = batch_size
        self.start_time = time.time()
        
        self.db_dir.mkdir(parents=True, exist_ok=True)
        
        # API 키 및 설정
        self._load_env()
        
        # LlamaParse 초기화 (고성능 옵션 적용)
        self.parser = LlamaParse(
            api_key=self.llamaindex_api_key,
            result_type="markdown",
            language="ko",
            num_workers=4,
            verbose=True,
            # 표와 이미지 추출 품질을 높이기 위한 추가 지침
            parsing_instruction="This document contains medical guidelines and health data tables. Please extract all tables accurately in markdown format and describe images or charts if possible."
        )
        
        # 임베딩 모델 설정 (차원 호환 유지)
        self.embed_model = OpenAIEmbedding(
            model=EMBEDDING_MODEL,
            api_key=self.openai_api_key
        )
        Settings.embed_model = self.embed_model
        
        print("\n" + "="*80)
        print("🚀 웰로 AI 벡터 DB 통합 관리 시스템")
        print("="*80)
        print(f"⏰ 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 타겟 폴더들: {self.target_folders or '전체'}")
        print(f"💾 DB 경로: {self.db_dir}")
        print("="*80 + "\n")

    def _load_env(self):
        """환경변수 로드"""
        env_path = Path(os.environ.get("PROJECT_ROOT", "/home/workspace/PROJECT_WELNO_BEFE")) / "planning-platform/backend/config.env"
        if env_path.exists():
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'): continue
                    if '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value
        
        # 주석 처리된 키 강제 로드 시도
        if not os.environ.get('LLAMAINDEX_API_KEY'):
            with open(env_path, 'r') as f:
                content = f.read()
                import re
                match = re.search(r'#?LLAMAINDEX_API_KEY=(.+)', content)
                if match:
                    os.environ['LLAMAINDEX_API_KEY'] = match.group(1).strip()
        
        if not os.environ.get('OPENAI_API_KEY'):
            with open(env_path, 'r') as f:
                content = f.read()
                import re
                match = re.search(r'#?OPENAI_API_KEY=(.+)', content)
                if match:
                    os.environ['OPENAI_API_KEY'] = match.group(1).strip()

        self.openai_api_key = os.environ.get('OPENAI_API_KEY')
        self.llamaindex_api_key = os.environ.get('LLAMAINDEX_API_KEY')
        
        if not self.openai_api_key: raise ValueError("OPENAI_API_KEY 미설정")
        if not self.llamaindex_api_key: raise ValueError("LLAMAINDEX_API_KEY 미설정")

    def log(self, step: str, message: str, level: str = "INFO"):
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "WARNING": "⚠️", "ERROR": "❌", "PROGRESS": "🔄", "DB": "💾"}
        icon = icons.get(level, "ℹ️")
        elapsed = time.time() - self.start_time
        print(f"[{elapsed:7.1f}s] {icon} [{step}] {message}", flush=True)

    def normalize_path(self, path_str: str) -> str:
        """NFC 정규화"""
        return unicodedata.normalize('NFC', path_str)

    def find_target_paths(self) -> List[Path]:
        """타겟 폴더 이름들로 실제 경로 리스트 찾기 (정규화 대응)"""
        if not self.target_folders:
            return [self.raw_data_root]
            
        target_paths = []
        normalized_targets = [self.normalize_path(t) for t in self.target_folders]
        
        # 전체를 재귀적으로 돌며 일치하는 폴더 찾기
        for root, dirs, _ in os.walk(self.raw_data_root):
            root_path = Path(root)
            for d in dirs:
                if self.normalize_path(d) in normalized_targets:
                    target_paths.append(root_path / d)
        
        # 직접 경로로도 확인
        for t in self.target_folders:
            p = self.raw_data_root / t
            if p.exists() and p not in target_paths:
                target_paths.append(p)
                
        return list(set(target_paths))

    def scan_files(self) -> List[Dict[str, Any]]:
        """지정된 타겟 폴더 내 파일 스캔"""
        target_paths = self.find_target_paths()
        file_list = []
        
        if not target_paths:
            self.log("ERROR", f"타겟 폴더를 찾을 수 없음: {self.target_folders}", "ERROR")
            return []

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
                    if f.startswith('.') or f.startswith('~'): continue
                    file_path = Path(root) / f
                    if file_path.suffix.lower() in ['.pdf', '.xlsx', '.csv', '.png', '.jpg', '.jpeg']:
                        file_list.append({
                            'path': str(file_path),
                            'name': f,
                            'ext': file_path.suffix.lower(),
                            'category': f"{main_cat}/{sub_cat}",
                            'main_category': main_cat,
                            'sub_category': sub_cat
                        })
        
        # 중복 제거 (경로 기준)
        seen = set()
        unique_files = []
        for f in file_list:
            if f['path'] not in seen:
                unique_files.append(f)
                seen.add(f['path'])
                
        return unique_files

    async def process_batch(self, files: List[Dict[str, Any]], index: VectorStoreIndex):
        """배치 단위 파싱 및 인덱스 추가"""
        documents = []
        for file_info in files:
            file_path = Path(file_info['path'])
            self.log("PARSE", f"처리 중: {file_info['name']}", "PROGRESS")
            
            try:
                if file_info['ext'] in ['.pdf', '.png', '.jpg', '.jpeg']:
                    llama_docs = await self.parser.aload_data(str(file_path))
                    for doc in llama_docs:
                        doc.metadata.update({
                            'file_name': file_info['name'],
                            'file_path': str(file_path),
                            'category': file_info['category'],
                            'main_category': file_info['main_category'],
                            'sub_category': file_info['sub_category'],
                            'doc_type': 'ai_parsed'
                        })
                        documents.append(doc)
                    self.log("PARSE", f"  ✅ {file_info['name']}: {len(llama_docs)}개 문서 추출", "SUCCESS")
                
                elif file_info['ext'] in ['.xlsx', '.csv']:
                    if file_info['ext'] == '.xlsx':
                        df_dict = pd.read_excel(file_path, sheet_name=None)
                        for sheet, df in df_dict.items():
                            doc = Document(
                                text=f"Sheet: {sheet}\n{df.to_markdown()}", 
                                metadata={
                                    'file_name': file_info['name'], 
                                    'file_path': str(file_path),
                                    'category': file_info['category'], 
                                    'main_category': file_info['main_category'],
                                    'sub_category': file_info['sub_category'],
                                    'doc_type': 'table',
                                    'sheet_name': sheet
                                }
                            )
                            documents.append(doc)
                    else:
                        df = None
                        for enc in ['utf-8', 'cp949', 'euc-kr']:
                            try:
                                df = pd.read_csv(file_path, encoding=enc)
                                break
                            except: continue
                        if df is not None:
                            documents.append(Document(
                                text=df.to_markdown(),
                                metadata={
                                    'file_name': file_info['name'], 
                                    'file_path': str(file_path),
                                    'category': file_info['category'], 
                                    'main_category': file_info['main_category'],
                                    'sub_category': file_info['sub_category'],
                                    'doc_type': 'table'
                                }
                            ))
                    self.log("PARSE", f"  ✅ {file_info['name']}: 표 데이터 추출 완료", "SUCCESS")
            except Exception as e:
                self.log("ERROR", f"실패: {file_info['name']} - {str(e)}", "ERROR")

        if documents:
            self.log("INDEX", f"임베딩 및 인덱스 추가 중 ({len(documents)}개 문서)...", "PROGRESS")
            # Settings.node_parser를 명시적으로 설정하거나 기본값 사용
            node_parser = getattr(Settings, 'node_parser', SimpleNodeParser.from_defaults())
            nodes = node_parser.get_nodes_from_documents(documents)
            index.insert_nodes(nodes)
            gc.collect()

    async def run(self):
        all_files = self.scan_files()
        self.log("START", f"총 {len(all_files)}개 파일 스캔 완료", "INFO")
        
        if not all_files:
            self.log("DONE", "추가할 파일이 없습니다.", "INFO")
            return

        # 인덱스 로드 또는 생성
        try:
            self.log("DB", f"기존 인덱스 로드 시도: {self.db_dir}", "PROGRESS")
            if not (self.db_dir / "docstore.json").exists():
                raise FileNotFoundError("기존 인덱스 파일이 없습니다.")
                
            vector_store = FaissVectorStore.from_persist_dir(str(self.db_dir))
            storage_context = StorageContext.from_defaults(vector_store=vector_store, persist_dir=str(self.db_dir))
            index = load_index_from_storage(storage_context)
            self.log("DB", f"기존 인덱스 로드 성공 (노드 수: {len(index.docstore.docs)})", "SUCCESS")
        except Exception as e:
            self.log("WARNING", f"기존 인덱스 로드 실패({e}), 새로 생성합니다.", "WARNING")
            faiss_index = faiss.IndexFlatL2(EMBEDDING_DIMENSION)
            vector_store = FaissVectorStore(faiss_index=faiss_index)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            index = VectorStoreIndex([], storage_context=storage_context)

        # 배치 처리 및 저장
        for i in range(0, len(all_files), self.batch_size):
            batch = all_files[i : i + self.batch_size]
            self.log("BATCH", f"배치 {i//self.batch_size + 1} 시작 ({len(batch)}개 파일)", "INFO")
            await self.process_batch(batch, index)
            
            # 저장 (AttributeError 방지 위해 내부 구조 접근 개선)
            index.storage_context.persist(persist_dir=str(self.db_dir))
            
            # FAISS 인덱스 추출 및 저장
            v_store = index.storage_context.vector_store
            f_idx = None
            if hasattr(v_store, '_faiss_index'):
                f_idx = v_store._faiss_index
            elif hasattr(v_store, 'faiss_index'):
                f_idx = v_store.faiss_index
            
            if f_idx:
                faiss.write_index(f_idx, str(self.db_dir / "faiss.index"))
                self.log("SAVE", f"배치 {i//self.batch_size + 1} 저장 완료", "SUCCESS")
            else:
                self.log("ERROR", "FAISS 인덱스 객체를 찾을 수 없어 저장에 실패했습니다.", "ERROR")

        self.log("COMPLETE", f"🎉 작업 완료! (최종 노드 수: {len(index.docstore.docs)})", "SUCCESS")


if __name__ == "__main__":
    import asyncio
    # 타겟 폴더 리스트 설정
    target_list = ["지침서", "추가", "데이터셋"]
    manager = WelnoAIVectorDBManager(target_folders=target_list, batch_size=3)
    asyncio.run(manager.run())
