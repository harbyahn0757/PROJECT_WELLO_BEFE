"""
로그 파일의 프롬프트를 OpenAI API로 테스트하는 스크립트
"""
import json
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.services.gpt_service import GPTService, GPTRequest
from app.core.config import settings

async def test_from_log():
    """로그 파일의 프롬프트로 OpenAI API 테스트"""
    
    # GPT 서비스 초기화
    gpt_service = GPTService()
    await gpt_service.initialize()
    
    # 로그 파일 읽기 (최신 Perplexity 로그)
    log_file = 'logs/perplexity_prompt_20251205_004808.json'
    
    print(f"=== 로그 파일 읽기: {log_file} ===")
    with open(log_file, 'r', encoding='utf-8') as f:
        log_data = json.load(f)
    
    print(f"원본 모델: {log_data.get('model')} (Perplexity)")
    print(f"시스템 메시지 길이: {len(log_data.get('system_message', ''))}")
    print(f"사용자 메시지 길이: {len(log_data.get('user_message', ''))}")
    print(f"Max Tokens: {log_data.get('max_tokens')}")
    print(f"Temperature: {log_data.get('temperature')}")
    
    # GPTRequest 생성
    gpt_request = GPTRequest(
        system_message=log_data.get('system_message', ''),
        user_message=log_data.get('user_message', ''),
        model=settings.openai_model,  # gpt-4o
        temperature=log_data.get('temperature', 0.3),
        max_tokens=log_data.get('max_tokens', 16384),
        response_format={"type": "json_object"}
    )
    
    print(f"\n=== OpenAI API 호출 시작 ===")
    print(f"모델: {gpt_request.model}")
    print(f"Max Tokens: {gpt_request.max_tokens}")
    
    # API 호출
    try:
        response = await gpt_service.call_api(
            gpt_request,
            save_log=True
        )
        
        print(f"\n=== 응답 결과 ===")
        print(f"성공: {response.success}")
        print(f"응답 길이: {len(response.content) if response.content else 0}")
        print(f"토큰 사용: {response.usage}")
        
        if response.success and response.content:
            # JSON 파싱 시도
            try:
                parsed = gpt_service.parse_json_response(response.content)
                print(f"JSON 파싱 성공: {type(parsed)}")
                print(f"응답 키: {list(parsed.keys()) if isinstance(parsed, dict) else 'N/A'}")
                
                # 응답 일부 출력
                if isinstance(parsed, dict):
                    print(f"\n=== 응답 구조 ===")
                    for key in list(parsed.keys())[:5]:
                        value = parsed[key]
                        if isinstance(value, list):
                            print(f"  {key}: 리스트 ({len(value)}개 항목)")
                        elif isinstance(value, dict):
                            print(f"  {key}: 딕셔너리 ({len(value)}개 키)")
                        else:
                            print(f"  {key}: {type(value).__name__}")
            except Exception as e:
                print(f"JSON 파싱 실패: {str(e)}")
                print(f"응답 처음 500자:\n{response.content[:500]}")
        else:
            print(f"오류: {response.error}")
            
    except Exception as e:
        print(f"\n❌ API 호출 실패: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_from_log())

