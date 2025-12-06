import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv(".env")

# 프로젝트 경로 설정
sys.path.append(os.getcwd())

# 로그 파일 경로 (절대 경로로 변경하여 안전하게 접근)
LOG_DIR = "/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/logs/planning_20251206/190558_e3471a9a"
STEP1_RESULT_PATH = os.path.join(LOG_DIR, "step1_result.json")
STEP2_1_PROMPT_PATH = os.path.join(LOG_DIR, "step2_1_prompt.json")
STEP2_1_RESULT_PATH = os.path.join(LOG_DIR, "step2_1_result.json")

def load_json_log(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        # prompt.json의 경우 content 안에 실제 JSON이 문자열로 들어있을 수 있음
        if "content" in data and isinstance(data["content"], str):
             try:
                 return json.loads(data["content"])
             except:
                 pass
        return data

def extract_rag_evidence(prompt_json_path):
    """Step 2-1 프롬프트에서 [Critical Evidence] 섹션을 추출합니다."""
    with open(prompt_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        prompt_text = data.get("prompt", "")
        
        start_marker = "# [Critical Evidence: 검색된 의학 가이드라인]"
        end_marker = "**Evidence & Citation Rules" # 혹은 다음 섹션 시작 부분
        
        if start_marker in prompt_text:
            start_idx = prompt_text.find(start_marker)
            # 다음 섹션 찾기 (대충 Evidence 섹션이 끝나는 지점)
            end_idx = prompt_text.find("# 🎯 Role", start_idx)
            if end_idx == -1:
                end_idx = len(prompt_text)
            
            evidence_section = prompt_text[start_idx:end_idx]
            print(f"[INFO] RAG Evidence 추출 성공 ({len(evidence_section)}자)")
            return evidence_section
        else:
            print("[WARN] RAG Evidence 섹션을 찾을 수 없습니다.")
            return ""

def simulate_step2_prompt_creation(step1_result, step2_1_result, rag_evidence_text):
    """
    Step 2-2 프롬프트 생성을 시뮬레이션합니다. (RAG 주입 버전)
    기존 코드를 수정하지 않고, 로직을 가져와서 테스트합니다.
    """
    print("\n[INFO] Step 2-2 프롬프트 시뮬레이션 시작...")
    
    # 1. System Instruction (수정된 버전 시뮬레이션)
    system_instruction = """
# 🛑 SYSTEM INSTRUCTION (절대 규칙)

1. **RAG 우선 원칙**: 제공된 [Critical Evidence]의 가이드라인을 최우선으로 적용하세요.
   - 만약 Evidence가 "심혈관 위험"을 경고한다면, 암 검진보다 심혈관 정밀검사를 Priority 2로 올리세요.
   - Evidence에 없는 내용을 억지로 지어내지 마세요.

2. **만성질환 우선 원칙**: 
   - 환자의 Risk Profile에 '고혈압/당뇨/비만' 등 만성질환 위험이 있다면, 이를 해결하기 위한 합병증 검사를 '암 검진'보다 먼저 추천하세요.
   - **Bridge Strategy 적용 시**: 암 관련 예시보다 '혈관/대사/활력' 관련 논리를 우선 사용하세요.

3. **Tone & Manner (진료실 대화체)**:
   - "권장됩니다" (X) -> "제가 보기엔 이 검사가 꼭 필요해 보입니다" (O)
   - 딱딱한 기계적 말투를 버리고, 환자를 걱정하는 '주치의'의 따뜻하지만 단호한 말투를 사용하세요.
"""

    # 2. RAG Evidence 주입 (여기가 핵심!)
    rag_section = ""
    if rag_evidence_text:
        rag_section = f"""
{rag_evidence_text}

**⚠️ 이 섹션의 인용구를 'strategies'의 'reason'과 'evidence' 필드에 그대로 사용하세요.**
"""
    else:
        rag_section = "\n# [Critical Evidence]\n(검색된 증거 없음 - 일반 의학 지식 사용)\n"

    # 3. Context 조립
    prompt_parts = [
        system_instruction,
        rag_section,
        "\n# 🎯 Role (당신의 역할)\n당신은 대학병원 검진센터장이자 예방의학 전문의입니다.\n",
        "\n# 📋 Context\n",
        f"## STEP 1 분석 결과\n{json.dumps(step1_result, ensure_ascii=False, indent=2)}\n",
        f"## STEP 2-1 결과 (Priority 1)\n{json.dumps(step2_1_result, ensure_ascii=False, indent=2)}\n"
    ]
    
    # 4. Task 및 Output Format (Anchor 지시문 보강 시뮬레이션)
    task_section = """
# 🎯 Task - Upselling 전략 수립

STEP 1의 위험 요인과 STEP 2-1의 기본 검사를 연결하여, **"왜 정밀 검사가 필요한지"** 설득하는 논리(Bridge Strategy)를 완성하세요.

## ⚠️ Bridge Strategy 작성 규칙 (Few-shot Examples)

**잘못된 예 (단순 나열):**
- anchor: "고혈압이 있습니다."
- gap: "더 자세히 봐야 합니다."
- offer: "초음파를 하세요."

**✅ 올바른 예 1 (임상적 연결):**
- anchor: "현재 혈압이 140/90으로 높게 측정되었습니다. 이는 혈관벽에 높은 압력이 가해지고 있다는 신호입니다."
- gap: "하지만 혈압 수치만으로는 혈관 내부가 얼마나 두꺼워졌는지, 찌꺼기(플라크)가 쌓여 뇌졸중 위험이 얼마나 높은지는 알 수 없습니다."
- offer: "경동맥 초음파를 통해 혈관 속을 직접 들여다보고, 뇌졸중을 예방할 골든타임을 잡아야 합니다."

**✅ 올바른 예 2 (증상 연결):**
- anchor: "문진에서 '가끔 가슴이 답답하다'고 하셨고, 가족력에 심근경색이 있습니다."
- gap: "기본 심전도 검사는 '검사하는 순간'의 이상만 잡아낼 뿐, 혈관이 70% 이상 막히기 전까지는 정상으로 나오는 경우가 많습니다."
- offer: "관상동맥 석회화 CT로 심장 혈관의 '진짜 나이'를 확인해보는 것이 가장 확실한 방법입니다."

---

# Output Format (JSON)
(기존 JSON 포맷 유지)
"""
    prompt_parts.append(task_section)
    
    return "\n".join(prompt_parts)

    
    return "\n".join(prompt_parts)

async def call_llm_with_prompt(prompt_text):
    """생성된 프롬프트로 실제 LLM을 호출하여 결과를 확인합니다."""
    print("\n[INFO] LLM 호출 시작 (Gemini-2.0-flash)...")
    
    try:
        # 백엔드 서비스 모듈 로드
        from app.services.gemini_service import gemini_service, GeminiRequest
        
        # 서비스 초기화
        await gemini_service.initialize()
        
        # 요청 객체 생성
        request = GeminiRequest(
            prompt=prompt_text,
            model="gemini-2.0-flash",
            temperature=0.5,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        
        # API 호출 (로깅 없이 직접 호출)
        # GeminiService.generate_content 메서드를 직접 사용하거나 call_api 사용
        # 여기서는 call_api 모의 호출 대신 직접 genai 라이브러리 사용이 어려우므로
        # 기존 서비스의 call_api를 활용하되, 로깅은 최소화
        
        response = await gemini_service.call_api(
            request,
            save_log=False,
            step_name="Simulation"
        )
        
        if response.success:
            print("[INFO] LLM 응답 수신 성공")
            return response.content
        else:
            print(f"[ERROR] LLM 호출 실패: {response.error}")
            return None
            
    except Exception as e:
        print(f"[ERROR] LLM 호출 중 예외 발생: {str(e)}")
        # import traceback
        # traceback.print_exc()
        return None

# --- 메인 실행 ---
import asyncio

async def main():
    print("=== RAG Evidence 주입 및 LLM 응답 품질 검증 시뮬레이션 ===")

    # 1. 데이터 로드
    step1_data = load_json_log(STEP1_RESULT_PATH)
    step2_1_result = load_json_log(STEP2_1_RESULT_PATH)

    # 2. RAG Evidence 추출 (로그에서)
    rag_evidence = extract_rag_evidence(STEP2_1_PROMPT_PATH)

    if not rag_evidence:
        print("❌ RAG Evidence 추출 실패. 시뮬레이션 중단.")
        return

    # 3. 프롬프트 생성 시뮬레이션 (함수 직접 호출로 변경)
    print("\n[INFO] 백엔드 함수 직접 호출 테스트 시작...")
    
    try:
        from app.services.checkup_design.step2_upselling import create_checkup_design_prompt_step2_upselling
        
        # Step 1 데이터 준비 (Dict로 변환 필요)
        if isinstance(step1_data, str):
             step1_data = json.loads(step1_data)
             
        # 🔥 페르소나 데이터 강제 주입 (테스트용)
        step1_data["persona"] = {
            "type": "Worrier",
            "description": "건강염려형",
            "strategy_key": "reassurance"
        }
        
        # 가짜 데이터 준비
        patient_name = "테스트환자"
        patient_age = 55
        patient_gender = "M"
        selected_concerns = []
        
        # 함수 호출
        prompt, _ = await create_checkup_design_prompt_step2_upselling(
            step1_result=step1_data,
            step2_1_result=step2_1_result,
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            selected_concerns=selected_concerns,
            prev_rag_context=rag_evidence  # 핵심: RAG Evidence 주입!
        )
        
        simulated_prompt = prompt
        print(f"✅ 백엔드 함수 호출 성공! 프롬프트 길이: {len(prompt)}자")
        
    except ImportError:
        print("⚠️ 백엔드 모듈 임포트 실패, 기존 시뮬레이션 로직 사용")
        simulated_prompt = simulate_step2_prompt_creation(step1_data, step2_1_result, rag_evidence)
    except Exception as e:
        print(f"❌ 백엔드 함수 호출 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return

    # 4. 결과 저장
    output_path = "simulated_step2_prompt_real.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(simulated_prompt)
    print(f"\n✅ 프롬프트 생성 완료: {output_path}")

    # 5. LLM 실제 호출 및 결과 검증 (NEW)
    llm_response = await call_llm_with_prompt(simulated_prompt)
    
    if llm_response:
        # JSON 파싱 및 저장
        try:
            # 마크다운 제거 처리
            content = llm_response.strip()
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
            
            result_json = json.loads(content.strip())
            
            result_path = "simulated_step2_result.json"
            with open(result_path, "w", encoding="utf-8") as f:
                json.dump(result_json, f, ensure_ascii=False, indent=2)
                
            print(f"\n✅ LLM 응답 저장 완료: {result_path}")
            
            # 6. 품질 검증 리포트
            print("\n🔍 [품질 검증 리포트]")
            
            strategies = result_json.get("strategies", [])
            print(f"- 생성된 전략 개수: {len(strategies)}개")
            
            for idx, strategy in enumerate(strategies):
                print(f"\n[전략 {idx+1}: {strategy.get('target', 'Target 없음')}]")
                
                # Anchor 검증
                anchor = strategy.get('step1_anchor', '')
                print(f"  - Anchor: {anchor[:50]}...")
                if "작성" in anchor and "분석" in anchor:
                    print("    ❌ FAIL: 지시문을 그대로 복사함")
                else:
                    print("    ✅ PASS: 구체적 내용 생성됨")
                    
                # Evidence 검증
                rec = strategy.get('doctor_recommendation', {})
                evidence = rec.get('evidence', '')
                print(f"  - Evidence: {evidence[:50]}...")
                if "따르면" in evidence or "명시되어" in evidence:
                    print("    ✅ PASS: 인용구 형식 준수")
                else:
                    print("    ⚠️ WARN: 인용구 형식 미준수 가능성")

        except Exception as e:
            print(f"❌ 응답 파싱 실패: {str(e)}")
            print(f"원본 응답: {llm_response[:200]}...")

if __name__ == "__main__":
    asyncio.run(main())

