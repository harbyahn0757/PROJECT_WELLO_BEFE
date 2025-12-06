"""
프롬프트 테스트 스크립트
기존 시스템의 GPT 서비스와 설정을 재사용하여 프롬프트를 테스트합니다.
"""
import asyncio
import json
import sys
import os
from pathlib import Path
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.gpt_service import GPTService, GPTRequest
from app.services.session_logger import get_session_logger
from app.core.config import settings

# RAG 시스템 임포트
try:
    from app.services.checkup_design import (
        init_rag_engine,
        generate_specific_queries,
        get_medical_evidence_from_rag
    )
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    print("[WARN] RAG 시스템을 임포트할 수 없습니다.")


class PromptTester:
    """프롬프트 테스트 클래스"""
    
    def __init__(self):
        self.gpt_service = GPTService()
        self.session_logger = get_session_logger()
        self.rag_engine = None
        
    async def test_prompt(
        self,
        system_message: str,
        user_message: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.5,
        max_tokens: int = 2000,
        json_mode: bool = False,
        save_log: bool = True,
        patient_uuid: str = "test_user",
        session_id: str = None
    ):
        """
        프롬프트 테스트 실행
        
        Args:
            system_message: 시스템 메시지
            user_message: 사용자 메시지 (프롬프트)
            model: GPT 모델 (기본: gpt-4o-mini)
            temperature: 온도 (0.0-1.0)
            max_tokens: 최대 토큰 수
            json_mode: JSON 응답 모드 사용 여부
            save_log: 로그 저장 여부
            patient_uuid: 환자 UUID (로깅용)
            session_id: 세션 ID (없으면 자동 생성)
        """
        print("\n" + "="*80)
        print("🧪 프롬프트 테스트 시작")
        print("="*80)
        
        # GPT 서비스 초기화
        await self.gpt_service.initialize()
        
        # 세션 ID 생성 (제공되지 않은 경우)
        if not session_id:
            session_id = self.session_logger.start_session(
                patient_uuid=patient_uuid,
                patient_name="테스트 환자",
                hospital_id="test_hospital"
            )
            print(f"🎬 세션 ID 생성: {session_id}")
        
        # 요청 정보 출력
        print(f"\n📋 요청 정보:")
        print(f"  - 모델: {model}")
        print(f"  - 온도: {temperature}")
        print(f"  - 최대 토큰: {max_tokens}")
        print(f"  - JSON 모드: {json_mode}")
        print(f"  - 로그 저장: {save_log}")
        print(f"\n📝 시스템 메시지 길이: {len(system_message)} 자")
        print(f"📝 사용자 메시지 길이: {len(user_message)} 자")
        
        # 프롬프트 미리보기
        print(f"\n{'─'*80}")
        print("🔍 시스템 메시지 미리보기 (처음 500자):")
        print(f"{'─'*80}")
        print(system_message[:500] + "..." if len(system_message) > 500 else system_message)
        
        print(f"\n{'─'*80}")
        print("🔍 사용자 메시지 미리보기 (처음 500자):")
        print(f"{'─'*80}")
        print(user_message[:500] + "..." if len(user_message) > 500 else user_message)
        
        # GPT 요청 생성
        gpt_request = GPTRequest(
            system_message=system_message,
            user_message=user_message,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"} if json_mode else None
        )
        
        # API 호출
        print(f"\n{'─'*80}")
        print("🚀 GPT API 호출 중...")
        print(f"{'─'*80}")
        
        start_time = datetime.now()
        
        try:
            response = await self.gpt_service.call_api(
                request=gpt_request,
                save_log=save_log,
                patient_uuid=patient_uuid,
                session_id=session_id,
                step_number="TEST",
                step_name="프롬프트 테스트"
            )
            
            elapsed_time = (datetime.now() - start_time).total_seconds()
            
            if response.success:
                print(f"\n✅ API 호출 성공 (소요 시간: {elapsed_time:.2f}초)")
                print(f"\n{'─'*80}")
                print("📊 응답 정보:")
                print(f"{'─'*80}")
                print(f"  - 모델: {response.model}")
                print(f"  - 프롬프트 토큰: {response.usage.get('prompt_tokens', 0):,}")
                print(f"  - 완료 토큰: {response.usage.get('completion_tokens', 0):,}")
                print(f"  - 총 토큰: {response.usage.get('total_tokens', 0):,}")
                
                print(f"\n{'='*80}")
                print("💬 GPT 응답:")
                print(f"{'='*80}")
                
                # JSON 모드인 경우 포맷팅
                if json_mode:
                    try:
                        parsed = json.loads(response.content)
                        print(json.dumps(parsed, ensure_ascii=False, indent=2))
                    except json.JSONDecodeError:
                        print(response.content)
                else:
                    print(response.content)
                
                print(f"\n{'='*80}")
                
                # 로그 저장 위치 안내
                if save_log:
                    log_path = f"logs/patient_{patient_uuid[:8]}.json"
                    print(f"\n💾 로그 저장됨: {log_path}")
                    print(f"   세션 ID: {session_id}")
                
                return {
                    "success": True,
                    "response": response.content,
                    "usage": response.usage,
                    "elapsed_time": elapsed_time,
                    "session_id": session_id
                }
                
            else:
                print(f"\n❌ API 호출 실패")
                print(f"에러: {response.error}")
                return {
                    "success": False,
                    "error": response.error,
                    "session_id": session_id
                }
                
        except Exception as e:
            elapsed_time = (datetime.now() - start_time).total_seconds()
            print(f"\n❌ 예외 발생 (소요 시간: {elapsed_time:.2f}초)")
            print(f"에러: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }


async def test_simple_prompt():
    """간단한 프롬프트 테스트 예시"""
    tester = PromptTester()
    
    system_message = """당신은 건강 검진 전문가입니다. 
환자의 정보를 분석하여 적절한 검진 항목을 추천해주세요."""
    
    user_message = """
환자 정보:
- 나이: 45세
- 성별: 남성
- 과거 검진: 혈압 경계, 혈당 정상
- 가족력: 당뇨, 고혈압

위 환자에게 추천할 검진 항목 3가지를 설명과 함께 알려주세요.
"""
    
    result = await tester.test_prompt(
        system_message=system_message,
        user_message=user_message,
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=1000,
        json_mode=False,
        save_log=True
    )
    
    return result


async def test_json_response():
    """JSON 응답 테스트 예시"""
    tester = PromptTester()
    
    system_message = """당신은 건강 검진 전문가입니다. 
반드시 JSON 형식으로 응답해주세요."""
    
    user_message = """
환자 정보:
- 나이: 45세
- 성별: 남성
- 과거 검진: 혈압 경계
- 가족력: 당뇨

다음 JSON 형식으로 응답하세요:
{
  "recommended_items": [
    {
      "name": "검진 항목명",
      "reason": "추천 이유",
      "priority": 1-3
    }
  ],
  "summary": "종합 의견"
}
"""
    
    result = await tester.test_prompt(
        system_message=system_message,
        user_message=user_message,
        model="gpt-4o",
        temperature=0.5,
        max_tokens=2000,
        json_mode=True,
        save_log=True
    )
    
    return result


async def test_custom_prompt(system_msg: str, user_msg: str, **kwargs):
    """커스텀 프롬프트 테스트"""
    tester = PromptTester()
    
    result = await tester.test_prompt(
        system_message=system_msg,
        user_message=user_msg,
        **kwargs
    )
    
    return result


async def test_rag_search():
    """RAG 검색 테스트 예시"""
    if not RAG_AVAILABLE:
        print("❌ RAG 시스템을 사용할 수 없습니다.")
        return {"success": False, "error": "RAG not available"}
    
    print("\n" + "="*80)
    print("🔍 RAG 검색 테스트")
    print("="*80)
    
    try:
        # RAG 엔진 초기화
        print("\n🚀 RAG 엔진 초기화 중...")
        query_engine = await init_rag_engine()
        
        if not query_engine:
            print("❌ RAG 엔진 초기화 실패")
            return {"success": False, "error": "RAG engine initialization failed"}
        
        print("✅ RAG 엔진 초기화 성공")
        
        # 환자 컨텍스트 설정
        patient_context = {
            "age": 45,
            "gender": "male",
            "family_history": ["diabetes", "hypertension"],
            "abnormal_items": ["혈압 경계", "혈당 경계"]
        }
        
        # 염려 항목
        concerns = [
            {"type": "checkup", "name": "혈압", "value": "135", "status": "경계"},
            {"type": "checkup", "name": "혈당", "value": "110", "status": "경계"}
        ]
        
        print("\n📋 검색 컨텍스트:")
        print(f"  - 나이: {patient_context['age']}세")
        print(f"  - 성별: {'남성' if patient_context['gender'] == 'male' else '여성'}")
        print(f"  - 가족력: {', '.join(patient_context['family_history'])}")
        print(f"  - 염려 항목: {len(concerns)}개")
        
        # 검색 쿼리 생성
        print("\n🔍 검색 쿼리 생성 중...")
        queries = generate_specific_queries(patient_context, concerns)
        print(f"✅ {len(queries)}개 쿼리 생성됨")
        
        for i, q in enumerate(queries[:3], 1):  # 처음 3개만 출력
            print(f"  {i}. [{q['category']}] {q['query']}")
        
        # RAG 검색 실행
        print("\n🚀 RAG 검색 실행 중...")
        start_time = datetime.now()
        
        rag_result = await get_medical_evidence_from_rag(
            query_engine=query_engine,
            patient_context=patient_context,
            concerns=concerns
        )
        
        elapsed_time = (datetime.now() - start_time).total_seconds()
        
        context_text = rag_result.get("context_text", "")
        structured_evidences = rag_result.get("structured_evidences", [])
        
        print(f"\n✅ RAG 검색 완료 (소요 시간: {elapsed_time:.2f}초)")
        print(f"\n📊 검색 결과:")
        print(f"  - 에비던스 개수: {len(structured_evidences)}개")
        print(f"  - 컨텍스트 길이: {len(context_text):,}자")
        
        if structured_evidences:
            print(f"\n📚 에비던스 미리보기:")
            for i, ev in enumerate(structured_evidences[:3], 1):
                print(f"\n  [{i}] 카테고리: {ev.get('category', 'N/A')}")
                print(f"      문서: {ev.get('document_name', 'N/A')}")
                citation = ev.get('citation', '')
                preview = citation[:150] + "..." if len(citation) > 150 else citation
                print(f"      인용: {preview}")
        
        if context_text:
            print(f"\n{'='*80}")
            print("💬 전체 컨텍스트 (처음 1000자):")
            print(f"{'='*80}")
            print(context_text[:1000] + "..." if len(context_text) > 1000 else context_text)
        
        return {
            "success": True,
            "evidence_count": len(structured_evidences),
            "context_length": len(context_text),
            "elapsed_time": elapsed_time,
            "evidences": structured_evidences
        }
        
    except Exception as e:
        print(f"\n❌ RAG 검색 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def main():
    """메인 실행 함수"""
    print("\n" + "="*80)
    print("🧪 프롬프트 테스트 도구")
    print("="*80)
    print("\n사용 가능한 테스트:")
    print("  1. 간단한 프롬프트 테스트 (test_simple_prompt)")
    print("  2. JSON 응답 테스트 (test_json_response)")
    print("  3. RAG 검색 테스트 (test_rag_search)")
    print("  4. 커스텀 프롬프트 테스트 (test_custom_prompt)")
    print("\n환경 변수:")
    print(f"  - OpenAI API Key: {'설정됨' if settings.openai_api_key and not settings.openai_api_key.startswith('sk-proj-your-') else '미설정'}")
    print(f"  - 기본 모델: {getattr(settings, 'openai_model', 'gpt-4o-mini')}")
    print(f"  - RAG 시스템: {'사용 가능' if RAG_AVAILABLE else '사용 불가'}")
    if RAG_AVAILABLE:
        llamaindex_key = getattr(settings, 'llamaindex_api_key', None)
        gemini_key = getattr(settings, 'google_gemini_api_key', None)
        print(f"    * LlamaIndex API Key: {'설정됨' if llamaindex_key and not llamaindex_key.startswith('dev-') else '미설정'}")
        print(f"    * Gemini API Key: {'설정됨' if gemini_key and not gemini_key.startswith('dev-') else '미설정'}")
    print("\n" + "="*80)
    
    # 예시 1: 간단한 테스트
    print("\n🔹 예시 1: 간단한 프롬프트 테스트 실행")
    asyncio.run(test_simple_prompt())
    
    # 예시 2: JSON 응답 테스트
    # print("\n🔹 예시 2: JSON 응답 테스트 실행")
    # asyncio.run(test_json_response())
    
    # 예시 3: RAG 검색 테스트
    # print("\n🔹 예시 3: RAG 검색 테스트 실행")
    # asyncio.run(test_rag_search())


if __name__ == "__main__":
    main()

