import asyncio
import json
import os
import sys
from datetime import datetime
from unittest.mock import MagicMock, patch
from dotenv import load_dotenv

# 1. Load Environment Variables
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../planning-platform/backend"))
config_path = os.path.join(backend_path, "config.env")
load_dotenv(config_path)

# Verify API Keys
if not os.getenv("GOOGLE_GEMINI_API_KEY") and not os.getenv("OPENAI_API_KEY"):
    print("❌ Error: API Keys not found in config.env")
    sys.exit(1)

# Add backend root to sys.path
sys.path.append(backend_path)

# Import Backend Modules
from app.api.v1.endpoints.checkup_design import CheckupDesignRequest, CheckupDesignStep2Request, Step1Result
from app.services.checkup_design.step1_prompt import create_step1_prompt

# Mock Data (DB Bypass)
MOCK_HOSPITAL_INFO = {
    "hospital_name": "테스트 병원 (Real LLM Test)",
    "national_checkup_items": [
        {"name": "신체계측", "category": "기초"},
        {"name": "혈압측정", "category": "기초"},
        {"name": "흉부방사선촬영", "category": "영상의학"},
        {"name": "요검사", "category": "진단검사"},
        {"name": "혈액검사", "category": "진단검사"},
        {"name": "구강검진", "category": "치과"}
    ],
    "recommended_items": [
        {"name": "위 내시경", "category": "소화기", "description": "위암 조기 발견"},
        {"name": "대장 내시경", "category": "소화기", "description": "대장암 및 용종 발견"},
        {"name": "복부 초음파", "category": "소화기", "description": "간/담낭/췌장 확인"},
        {"name": "저선량 폐 CT", "category": "호흡기", "description": "폐암 조기 발견"},
        {"name": "뇌 MRA", "category": "뇌신경", "description": "뇌혈관 상태 확인"},
        {"name": "경동맥 초음파", "category": "심혈관", "description": "동맥경화도 측정"},
        {"name": "관상동맥 석회화 CT", "category": "심혈관", "description": "심장 혈관 석회화 확인"},
        {"name": "갑상선 초음파", "category": "내분비", "description": "갑상선 결절/암 확인"}
    ],
    "external_checkup_items": [
        {"name": "NK세포 활성도 검사", "category": "면역", "description": "면역력 측정"},
        {"name": "마스트 알레르기 검사", "category": "면역", "description": "알레르기 원인 규명"},
        {"name": "유전자 검사 (DTC)", "category": "유전자", "description": "타고난 유전적 특성 파악"}
    ]
}

async def run_real_test_case(idx, case_data):
    print(f"\n[{idx+1}] 🧪 Testing Case (Real LLM): {case_data['patient_name']} ({case_data['case_description']})")
    
    # Request Data Setup
    request_data = {
        "uuid": case_data['uuid'],
        "hospital_id": case_data['hospital_id'],
        "selected_concerns": case_data.get('selected_concerns', []),
        "survey_responses": case_data.get('survey_responses', {}),
        "additional_info": {},
        "events": case_data.get('user_attributes', [])
    }
    
    # Mock Only Data Service (DB Access)
    with patch("app.services.wello_data_service.WelloDataService.get_patient_by_uuid") as mock_get_patient, \
         patch("app.services.wello_data_service.WelloDataService.get_hospital_by_id") as mock_get_hospital, \
         patch("app.services.wello_data_service.WelloDataService.get_patient_health_data") as mock_get_health, \
         patch("app.services.wello_data_service.WelloDataService.get_patient_prescription_data") as mock_get_presc, \
         patch("app.services.wello_data_service.WelloDataService.save_checkup_design_request") as mock_save:

        # Setup Mock Returns
        mock_get_patient.return_value = {
            "name": case_data['patient_name'],
            "birth_date": f"{datetime.now().year - case_data['age']}-01-01T00:00:00Z",
            "gender": case_data['gender']
        }
        mock_get_hospital.return_value = MOCK_HOSPITAL_INFO
        mock_get_health.return_value = {"health_data": case_data.get('health_history', [])}
        mock_get_presc.return_value = {"prescription_data": []}
        mock_save.return_value = {"success": True, "request_id": f"real_test_{idx}"}

        # ------------------------------------------------------------------
        # STEP 1: Analysis (Actual LLM Call)
        # ------------------------------------------------------------------
        from app.api.v1.endpoints.checkup_design import create_checkup_design_step1
        
        step1_result = {}
        try:
            print("   ⏳ Step 1 Analyzing (Calling Gemini)...")
            req_model = CheckupDesignRequest(**request_data)
            step1_response = await create_checkup_design_step1(req_model)
            step1_result = step1_response.data
            
            # Log Result
            persona = step1_result.get("persona", {})
            print(f"   ✅ [Step 1] Persona: {persona.get('primary_persona')} (Score: {persona.get('persona_score', {}).get(persona.get('primary_persona', ''))})")
            print(f"   ✅ [Step 1] Combined: {persona.get('combined_type')}")
            print(f"   ✅ [Step 1] Risk Flags: {persona.get('risk_flags')}")

        except Exception as e:
            print(f"   ❌ Step 1 Failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return

        # ------------------------------------------------------------------
        # STEP 2: Design (Actual LLM Call)
        # ------------------------------------------------------------------
        from app.api.v1.endpoints.checkup_design import create_checkup_design_step2
        
        try:
            print("   ⏳ Step 2 Designing (Calling Gemini/GPT)...")
            step2_req_model = CheckupDesignStep2Request(
                uuid=request_data['uuid'],
                hospital_id=request_data['hospital_id'],
                step1_result=Step1Result(**step1_result),
                selected_concerns=req_model.selected_concerns,
                survey_responses=req_model.survey_responses
            )
            
            step2_response = await create_checkup_design_step2(step2_req_model)
            final_result = step2_response.data
            
            # Save Result
            output_dir = "tests/integration_data/results"
            os.makedirs(output_dir, exist_ok=True)
            output_file = f"{output_dir}/result_{idx+1}_{case_data['patient_name']}.json"
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(final_result, f, indent=2, ensure_ascii=False)
            
            # Validation Check
            priority_2 = final_result.get('priority_2', {}).get('items', [])
            print(f"   ✅ [Step 2] Recommended: {priority_2}")
            print(f"   💾 Saved to {output_file}")
            
        except Exception as e:
            print(f"   ❌ Step 2 Failed: {str(e)}")
            import traceback
            traceback.print_exc()

async def main():
    # Load Dataset
    try:
        with open('tests/integration_data/qa_dataset.json', 'r', encoding='utf-8') as f:
            dataset = json.load(f)
    except FileNotFoundError:
        print("❌ qa_dataset.json not found. Run generate_test_dataset.py first.")
        return
    
    print(f"🚀 Starting Real Integration Test for {len(dataset)} cases...")
    print("⚠️  Warning: This will consume API credits.")
    
    # Run only first 5 cases (Edge Cases) to save time/cost, unless user wants all
    # User said "20개 정도", so we run all.
    for i, case in enumerate(dataset):
        await run_real_test_case(i, case)
        
    print("\n✅ All Real Tests Completed.")

if __name__ == "__main__":
    asyncio.run(main())


