import os
import json
import asyncio
import sys
from typing import Dict, Any, List
from dotenv import load_dotenv

# 환경 설정
LOG_DIR = "/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/logs/planning_20251206/20251206_225425_e3471a9a"
STEP1_RESULT_PATH = os.path.join(LOG_DIR, "step1_result.json")
STEP2_1_PROMPT_PATH = os.path.join(LOG_DIR, "step2_1_prompt.json") # JSON 로그 사용

# 백엔드 모듈 경로 추가
sys.path.append("/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend")

# 환경변수 로드
load_dotenv("/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env")

# Mock Request 클래스 정의
class MockRequest:
    def __init__(self):
        self.patient_name = "안광수"
        self.birth_date = 19700101 # 55세 가정
        self.gender = "M"
        self.selected_concerns = [
            {"name": "고혈압", "priority": "high"},
            {"name": "당뇨병", "priority": "medium"}
        ]
        self.survey_responses = {
            "family_history": "고혈압,당뇨병"
        }
        self.hospital_recommended_items = [
            {"name": "심전도 검사", "category": "심혈관", "description": "심장의 전기적 활동을 기록하여 부정맥 등을 진단합니다."},
            {"name": "간 초음파", "category": "소화기", "description": "간의 형태적 이상 유무를 확인합니다."}
        ]
        self.hospital_external_checkup_items = []

def load_json_log(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        print(f"[WARN] 로그 파일 없음: {path}")
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

async def main():
    print("=== RAG Evidence 주입 및 LLM 응답 품질 검증 시뮬레이션 ===")
    
    # 1. 로그 데이터 로드
    step1_data = load_json_log(STEP1_RESULT_PATH)
    step2_1_prompt_data = load_json_log(STEP2_1_PROMPT_PATH)
    
    # 2. RAG Evidence 추출 (Step 2-1 로그에서)
    # 실제 로그 구조에 따라 다를 수 있음. 여기서는 가상으로 추출
    rag_evidence_text = step2_1_prompt_data.get("rag_evidence_context", "")
    if not rag_evidence_text and "prompt" in step2_1_prompt_data:
        # 프롬프트 텍스트에서 추출 시도 (복잡함)
        pass
        
    # 테스트용 가짜 RAG Evidence
    if not rag_evidence_text:
        rag_evidence_text = """
1. 고혈압 환자의 심전도 검사 권고안
고혈압 환자는 심비대 및 부정맥 위험이 높으므로 매년 심전도 검사가 권장됩니다 (대한고혈압학회 진료지침 2024).

2. 간 초음파 검사 적응증
간효소 수치 이상이나 비만, 당뇨병이 동반된 경우 지방간 선별을 위해 복부 초음파 검사가 필요합니다.
"""

    print(f"[INFO] RAG Evidence 준비 완료 ({len(rag_evidence_text)}자)")

    # 3. 백엔드 함수 호출
    print("\n[INFO] 백엔드 함수 직접 호출 테스트 시작...")
    try:
        from app.services.checkup_design.step2_upselling import create_checkup_design_prompt_step2_upselling
        
        request = MockRequest()
        
        # Step 1 데이터에 페르소나 강제 주입 (테스트용)
        if not step1_data.get("persona"):
            step1_data["persona"] = {
                "type": "Worrier",
                "description": "건강 염려형",
                "primary_persona": "Worrier"
            }
            
        step2_1_summary_mock = json.dumps({
            "priority_1": {
                "items": ["혈압측정", "혈당검사"],
                "reason": "기본적인 대사 질환 확인 필요"
            }
        }, ensure_ascii=False)

        # 함수 호출
        prompt, evidences, context = await create_checkup_design_prompt_step2_upselling(
            request=request,
            step1_result=step1_data,
            step2_1_summary=step2_1_summary_mock,
            rag_service_instance=None, # RAG 엔진은 None으로 두고 context만 주입
            prev_rag_context=rag_evidence_text
        )
        
        print(f"✅ 백엔드 함수 호출 성공! 프롬프트 길이: {len(prompt)}자")
        
        # 4. 프롬프트 검증
        print("\n=== 생성된 프롬프트 검증 ===")
        
        # 4-1. RAG Evidence 포함 여부
        if "[Critical Evidence]" in prompt and rag_evidence_text[:20] in prompt:
             print("✅ [Critical Evidence] 섹션 포함됨")
        else:
             print("⚠️ [Critical Evidence] 섹션 확인 필요")
             
        # 4-2. 병원 추천 항목 상세 정보 포함 여부
        if "심전도 검사 (심혈관): 심장의 전기적 활동" in prompt:
             print("✅ 병원 추천 항목 상세 설명(description) 포함됨")
        else:
             print("⚠️ 병원 추천 항목 상세 설명 누락됨")
             
        # 4-3. 각주 지시사항 포함 여부
        if "출처 번호를 표기하세요" in prompt:
             print("✅ 각주 표기 지시사항 포함됨")
        else:
             print("⚠️ 각주 표기 지시사항 누락됨")
             
        # 파일로 저장해서 확인
        with open("simulated_step2_prompt_real.txt", "w", encoding="utf-8") as f:
            f.write(prompt)
        print("\n✅ 프롬프트가 'simulated_step2_prompt_real.txt'에 저장되었습니다.")
        
    except Exception as e:
        print(f"❌ 백엔드 함수 호출 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
