import asyncio
import httpx
import json
import time
from datetime import datetime

async def run_trace_test():
    url = "http://localhost:8000/welno-api/v1/rag-chat/partner/message"
    headers = {
        "X-API-Key": "welno_5a9bb40b5108ecd8ef864658d5a2d5ab",
        "Content-Type": "application/json",
        "Referer": "https://welno.kindhabit.com"
    }
    
    payload = {
        "uuid": "bbfba40ee649d172c1cee9471249a535",
        "hospital_id": "CEBFB480143B6F24BEB0870567EBF05C9C3E6B2E8616461A9269E9C818D3F2B0",
        "message": "안녕? 내 검진 결과에 대해 알려줘.",
        "partner_data": {
            "checkup_results": {
                "height": 157, 
                "weight": 54.3, 
                "bmi": 22, 
                "exam_date": "2026-01-15 "
            },
            "patient": {
                "name": "최안안", 
                "birth_date": "1911-11-11", 
                "sex": "F", 
                "phone": "01056180757"
            }
        }
    }
    
    print(f"🚀 [테스트] '최안안'님 데이터 송신 시작: {datetime.now().isoformat()}")
    start_time = time.time()
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                print(f"📡 [상태] HTTP {response.status_code}")
                full_answer = ""
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        if "answer" in data:
                            print(data["answer"], end="", flush=True)
                            full_answer += data["answer"]
                        if data.get("done"):
                            print("\n\n✅ [완료] 응답 수신 완료")
        except Exception as e:
            print(f"\n❌ [오류] {e}")
            
    print(f"\n⏱️  [테스트] 전체 소요 시간: {time.time() - start_time:.2f}초")

if __name__ == "__main__":
    asyncio.run(run_trace_test())
