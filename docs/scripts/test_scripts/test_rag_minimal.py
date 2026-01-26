#!/usr/bin/env python3
"""
최소한의 RAG 테스트 - OpenAI만 사용
aquery vs retrieve 직접 비교
"""
import asyncio
import time
import sys
import os
from pathlib import Path

# 환경 변수 설정
from dotenv import load_dotenv
load_dotenv('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env.local')

# 백엔드 경로
sys.path.insert(0, '/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

async def test_with_openai():
    """OpenAI로 직접 테스트"""
    
    print("=" * 80)
    print("🧪 RAG 성능 테스트 (OpenAI 임베딩)")
    print("=" * 80)
    print()
    
    # LlamaIndex 임포트
    try:
        from llama_index.core import load_index_from_storage, StorageContext, Settings
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.llms.openai import OpenAI
        import faiss
        from pathlib import Path as PathLib
        
        # FAISS 벡터 스토어
        from llama_index.vector_stores.faiss import FaissVectorStore
        from llama_index.core.storage.docstore import SimpleDocumentStore
        from llama_index.core.storage.index_store import SimpleIndexStore
        
    except ImportError as e:
        print(f"❌ 필수 라이브러리 없음: {e}")
        return False
    
    # 설정
    LOCAL_FAISS_DIR = "/data/vector_db/welno/faiss_db"
    LOCAL_FAISS_INDEX_PATH = f"{LOCAL_FAISS_DIR}/faiss.index"
    
    print("📚 FAISS 인덱스 로드...")
    
    try:
        # FAISS 인덱스 로드
        faiss_index = faiss.read_index(LOCAL_FAISS_INDEX_PATH)
        print(f"✅ FAISS 인덱스: {faiss_index.ntotal}개 벡터")
        
        # 벡터 스토어 생성
        vector_store = FaissVectorStore(faiss_index=faiss_index)
        docstore = SimpleDocumentStore.from_persist_dir(LOCAL_FAISS_DIR)
        index_store = SimpleIndexStore.from_persist_dir(LOCAL_FAISS_DIR)
        
        storage_context = StorageContext.from_defaults(
            vector_store=vector_store,
            docstore=docstore,
            index_store=index_store
        )
        
        # 인덱스 로드
        try:
            index = load_index_from_storage(storage_context)
        except ValueError:
            # 여러 인덱스가 있으면 첫 번째 사용
            index_structs = storage_context.index_store.index_structs()
            if isinstance(index_structs, dict):
                index_id = list(index_structs.keys())[0]
            else:
                index_id = index_structs[0].index_id
            print(f"   인덱스 ID: {index_id}")
            index = load_index_from_storage(storage_context, index_id=index_id)
        
        print("✅ 인덱스 로드 완료")
        
        # OpenAI 설정
        Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0.0)
        Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
        
        # Query Engine 생성
        query_engine = index.as_query_engine(
            similarity_top_k=5,
            response_mode="compact"
        )
        
        print("✅ Query Engine 생성 완료")
        print()
        
    except Exception as e:
        print(f"❌ 초기화 실패: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 테스트 쿼리
    test_query = "44세 남성 고혈압 관련 권장 검진"
    
    print(f"🔍 테스트 쿼리: {test_query}")
    print()
    
    # ========================================
    # Test 1: aquery()
    # ========================================
    print("-" * 80)
    print("1️⃣  aquery() - LLM 응답 생성 포함")
    print("-" * 80)
    
    try:
        start = time.time()
        response = await query_engine.aquery(test_query)
        elapsed_aquery = time.time() - start
        
        sources = response.source_nodes if hasattr(response, 'source_nodes') else []
        
        print(f"⏱️  시간: {elapsed_aquery:.3f}초")
        print(f"📝 응답: {len(str(response))}자")
        print(f"📚 문서: {len(sources)}개")
        
        if sources:
            print(f"   첫 문서: {sources[0].text[:80]}...")
        print()
        
    except Exception as e:
        print(f"❌ 실패: {e}")
        return False
    
    # ========================================
    # Test 2: retrieve()
    # ========================================
    print("-" * 80)
    print("2️⃣  retrieve() - 벡터 검색만")
    print("-" * 80)
    
    try:
        start = time.time()
        nodes = await query_engine.aretrieve(test_query)
        elapsed_retrieve = time.time() - start
        
        print(f"⏱️  시간: {elapsed_retrieve:.3f}초")
        print(f"📚 문서: {len(nodes)}개")
        
        if nodes:
            print(f"   첫 문서: {nodes[0].text[:80]}...")
        print()
        
    except Exception as e:
        print(f"❌ 실패: {e}")
        return False
    
    # ========================================
    # 결과
    # ========================================
    print("=" * 80)
    print("📊 결과")
    print("=" * 80)
    print()
    print(f"⏱️  aquery():   {elapsed_aquery:.3f}초")
    print(f"⏱️  retrieve(): {elapsed_retrieve:.3f}초")
    print(f"📈 개선:       {elapsed_aquery - elapsed_retrieve:.3f}초 ({(1-elapsed_retrieve/elapsed_aquery)*100:.1f}%)")
    print(f"📚 문서:       aquery {len(sources)}개 vs retrieve {len(nodes)}개")
    print()
    
    if elapsed_retrieve < elapsed_aquery * 0.5:
        print("✅ retrieve()가 50% 이상 빠름!")
        print("✅ 검진 설계에 즉시 적용 가능")
        return True
    else:
        print(f"⚠️  개선 효과: {(1-elapsed_retrieve/elapsed_aquery)*100:.1f}%")
        return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_with_openai())
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"\n❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
