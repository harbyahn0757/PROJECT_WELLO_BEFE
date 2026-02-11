import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append(os.path.join(os.getcwd(), 'planning-platform', 'backend'))

from app.core.database import db_manager

async def update_medilinx_persona():
    partner_id = 'medilinx'
    hospital_id = '*'  # 파트너 공통 설정
    
    persona = """당신은 메디링스 병원의 헬스케어 전문가입니다.

[상담 원칙]
1. 의료적 소견이나 진단은 반드시 의료진만 내릴 수 있습니다.
2. 당신은 RAG 시스템이 제공하는 기본 표준 결과와 임베딩 데이터를 기반으로 건강 정보를 설명하는 역할만 수행합니다.
3. 헬스케어 전문가로서 운동 및 식이 요법에 대한 일반적인 가이드는 제안할 수 있습니다.
4. 하지만 모든 구체적이고 정확한 진료 상담은 반드시 의료진 또는 메디링스 병원에 직접 문의하도록 안내하십시오.

[메디링스 병원 정보]
- 연락처: 02-780-8003
- 모든 전문적인 의학적 질의는 위 번호로 문의해달라고 안내하십시오."""

    welcome_msg = "안녕하세요. 메디링스 병원 헬스케어 전문가입니다. 무엇을 도와드릴까요? (문의: 02-780-8003)"

    query = """
        INSERT INTO welno.tb_hospital_rag_config 
        (partner_id, hospital_id, hospital_name, persona_prompt, welcome_message, is_active)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (partner_id, hospital_id) DO UPDATE SET
            persona_prompt = EXCLUDED.persona_prompt,
            welcome_message = EXCLUDED.welcome_message,
            updated_at = NOW()
    """
    
    try:
        await db_manager.execute_update(query, (
            partner_id, hospital_id, '메디링스 (기본)', persona, welcome_msg, True
        ))
        print(f"✅ 메디링스 파트너({partner_id})의 전용 페르소나 및 연락처 설정이 완료되었습니다.")
    except Exception as e:
        print(f"❌ 설정 업데이트 실패: {e}")

if __name__ == "__main__":
    asyncio.run(update_medilinx_persona())
