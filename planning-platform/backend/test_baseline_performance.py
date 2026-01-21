import asyncio
import time
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.welno_rag_chat_service import WelnoRagChatService

async def test_baseline():
    service = WelnoRagChatService()
    
    uuid = "baseline-test"
    hospital_id = "default"
    message = "당뇨병 관리 방법은?"
    session_id = f"baseline-{int(time.time())}"
    
    print("=" * 60)
    print("개선 전 성능 측정 (Baseline)")
    print("=" * 60)
    
    start = time.time()
    first_chunk_time = None
    chunk_count = 0
    
    async for chunk_json in service.handle_user_message_stream(uuid, hospital_id, message, session_id):
        if first_chunk_time is None:
            first_chunk_time = time.time() - start
            print(f"✅ 첫 chunk 수신: {first_chunk_time:.3f}초")
        chunk_count += 1
        
        import json
        try:
            data = json.loads(chunk_json)
            if data.get("done"):
                break
        except:
            pass
    
    total = time.time() - start
    print(f"✅ 총 응답 완료: {total:.3f}초")
    print(f"✅ 총 chunk 수: {chunk_count}개")
    print("=" * 60)
    
    return first_chunk_time, total

if __name__ == "__main__":
    first, total = asyncio.run(test_baseline())
    print(f"\n📊 Baseline 결과:")
    print(f"   - 첫 chunk: {first:.3f}초")
    print(f"   - 총 시간: {total:.3f}초")
