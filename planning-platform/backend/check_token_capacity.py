#!/usr/bin/env python3
"""
GPT 모델 호출 시 토큰 용량 점검 스크립트
각 단계별로 프롬프트/응답 크기와 모델 제한을 비교합니다.
"""
import json
import os
from typing import Dict, Any

# GPT 모델별 토큰 제한 (공식 스펙)
MODEL_LIMITS = {
    "gpt-4o-mini": {
        "context_window": 128000,  # 128K 토큰
        "max_output": 16384,        # 16K 토큰
        "input_cost_per_1m": 0.15,  # $0.15/1M tokens
        "output_cost_per_1m": 0.60  # $0.60/1M tokens
    },
    "gpt-4o": {
        "context_window": 128000,  # 128K 토큰
        "max_output": 16384,        # 16K 토큰
        "input_cost_per_1m": 2.50,  # $2.50/1M tokens
        "output_cost_per_1m": 10.00 # $10.00/1M tokens
    }
}

def estimate_tokens(text: str) -> int:
    """
    토큰 수 추정 (영어: 4자/토큰, 한글: 2.5자/토큰)
    정확한 계산은 tiktoken 필요하지만 여기서는 추정
    """
    # 한글과 영어 비율에 따라 다르지만 평균적으로
    # 한글+영어 혼합 텍스트는 약 3자당 1토큰으로 추정
    return len(text) // 3

def check_step_capacity(step_name: str, log_data: Dict[str, Any], model: str) -> Dict[str, Any]:
    """특정 스텝의 용량 체크"""
    
    system_msg = log_data.get("system_message", "")
    user_msg = log_data.get("user_message", "")
    
    # 토큰 추정
    system_tokens = estimate_tokens(system_msg)
    user_tokens = estimate_tokens(user_msg)
    total_input_tokens = system_tokens + user_tokens
    
    # 모델 제한
    limits = MODEL_LIMITS.get(model, MODEL_LIMITS["gpt-4o"])
    context_limit = limits["context_window"]
    output_limit = limits["max_output"]
    max_tokens_requested = log_data.get("max_tokens", 4096)
    
    # 남은 용량 계산
    remaining_for_output = context_limit - total_input_tokens
    
    # 용량 체크
    is_input_ok = total_input_tokens < context_limit
    is_output_ok = max_tokens_requested <= output_limit
    is_total_ok = total_input_tokens + max_tokens_requested < context_limit
    
    return {
        "step": step_name,
        "model": model,
        "input": {
            "system_tokens": system_tokens,
            "user_tokens": user_tokens,
            "total_tokens": total_input_tokens,
            "system_chars": len(system_msg),
            "user_chars": len(user_msg),
        },
        "output": {
            "requested_max_tokens": max_tokens_requested,
            "model_max_tokens": output_limit,
        },
        "limits": {
            "context_window": context_limit,
            "remaining_for_output": remaining_for_output,
        },
        "status": {
            "input_ok": is_input_ok,
            "output_ok": is_output_ok,
            "total_ok": is_total_ok,
            "usage_percent": round((total_input_tokens / context_limit) * 100, 2)
        }
    }

def check_response_data(step_name: str, response_file: str) -> Dict[str, Any]:
    """응답 데이터가 올바르게 전달되는지 체크"""
    
    if not os.path.exists(response_file):
        return {"error": f"응답 파일 없음: {response_file}"}
    
    with open(response_file, 'r', encoding='utf-8') as f:
        response_data = json.load(f)
    
    response_text = response_data.get("response", "")
    response_tokens = estimate_tokens(response_text)
    
    # JSON 파싱 체크
    try:
        parsed = json.loads(response_text)
        is_valid_json = True
        json_keys = list(parsed.keys())
    except:
        is_valid_json = False
        json_keys = []
    
    return {
        "step": step_name,
        "response_length": len(response_text),
        "response_tokens": response_tokens,
        "is_valid_json": is_valid_json,
        "json_keys": json_keys,
        "has_required_fields": bool(parsed) if is_valid_json else False
    }

def main():
    log_dir = "logs"
    
    # 최신 로그 파일 찾기
    prompt_files = sorted([f for f in os.listdir(log_dir) if f.startswith("gpt_prompt_")])
    response_files = sorted([f for f in os.listdir(log_dir) if f.startswith("gpt_response_")])
    
    if not prompt_files or not response_files:
        print("❌ 로그 파일이 없습니다.")
        return
    
    print("\n" + "="*80)
    print("🔍 GPT 모델 호출 용량 및 데이터 전달 점검")
    print("="*80)
    
    # STEP 1 체크
    print("\n" + "-"*80)
    print("📊 STEP 1: 건강 분석 (Risk Stratification)")
    print("-"*80)
    
    step1_prompt = os.path.join(log_dir, prompt_files[0])
    step1_response = os.path.join(log_dir, response_files[0])
    
    with open(step1_prompt, 'r', encoding='utf-8') as f:
        step1_data = json.load(f)
    
    step1_capacity = check_step_capacity("STEP 1", step1_data, step1_data.get("model", "gpt-4o-mini"))
    step1_response_check = check_response_data("STEP 1", step1_response)
    
    print(f"모델: {step1_capacity['model']}")
    print(f"입력:")
    print(f"  - 시스템 메시지: {step1_capacity['input']['system_chars']:,}자 (~{step1_capacity['input']['system_tokens']:,} 토큰)")
    print(f"  - 사용자 메시지: {step1_capacity['input']['user_chars']:,}자 (~{step1_capacity['input']['user_tokens']:,} 토큰)")
    print(f"  - 총 입력: ~{step1_capacity['input']['total_tokens']:,} 토큰")
    print(f"출력:")
    print(f"  - 요청한 max_tokens: {step1_capacity['output']['requested_max_tokens']:,}")
    print(f"  - 실제 응답: {step1_response_check['response_tokens']:,} 토큰")
    print(f"용량:")
    print(f"  - Context Window: {step1_capacity['limits']['context_window']:,} 토큰")
    print(f"  - 사용률: {step1_capacity['status']['usage_percent']}%")
    print(f"  - 남은 출력 용량: {step1_capacity['limits']['remaining_for_output']:,} 토큰")
    print(f"상태:")
    print(f"  - 입력 용량 OK: {'✅' if step1_capacity['status']['input_ok'] else '❌'}")
    print(f"  - 출력 용량 OK: {'✅' if step1_capacity['status']['output_ok'] else '❌'}")
    print(f"  - 전체 용량 OK: {'✅' if step1_capacity['status']['total_ok'] else '❌'}")
    print(f"응답 데이터:")
    print(f"  - JSON 파싱 성공: {'✅' if step1_response_check['is_valid_json'] else '❌'}")
    if step1_response_check['is_valid_json']:
        print(f"  - JSON 키: {', '.join(step1_response_check['json_keys'])}")
    
    # STEP 2-1 체크
    print("\n" + "-"*80)
    print("📊 STEP 2-1: Priority 1 검진 설계")
    print("-"*80)
    
    step2_1_prompt = os.path.join(log_dir, prompt_files[1])
    step2_1_response = os.path.join(log_dir, response_files[1])
    
    with open(step2_1_prompt, 'r', encoding='utf-8') as f:
        step2_1_data = json.load(f)
    
    step2_1_capacity = check_step_capacity("STEP 2-1", step2_1_data, step2_1_data.get("model", "gpt-4o"))
    step2_1_response_check = check_response_data("STEP 2-1", step2_1_response)
    
    print(f"모델: {step2_1_capacity['model']}")
    print(f"입력:")
    print(f"  - 시스템 메시지: {step2_1_capacity['input']['system_chars']:,}자 (~{step2_1_capacity['input']['system_tokens']:,} 토큰)")
    print(f"  - 사용자 메시지: {step2_1_capacity['input']['user_chars']:,}자 (~{step2_1_capacity['input']['user_tokens']:,} 토큰)")
    print(f"  - 총 입력: ~{step2_1_capacity['input']['total_tokens']:,} 토큰")
    print(f"  - ⚠️ STEP 1 결과 포함됨")
    print(f"출력:")
    print(f"  - 요청한 max_tokens: {step2_1_capacity['output']['requested_max_tokens']:,}")
    print(f"  - 실제 응답: {step2_1_response_check['response_tokens']:,} 토큰")
    print(f"용량:")
    print(f"  - Context Window: {step2_1_capacity['limits']['context_window']:,} 토큰")
    print(f"  - 사용률: {step2_1_capacity['status']['usage_percent']}%")
    print(f"  - 남은 출력 용량: {step2_1_capacity['limits']['remaining_for_output']:,} 토큰")
    print(f"상태:")
    print(f"  - 입력 용량 OK: {'✅' if step2_1_capacity['status']['input_ok'] else '❌'}")
    print(f"  - 출력 용량 OK: {'✅' if step2_1_capacity['status']['output_ok'] else '❌'}")
    print(f"  - 전체 용량 OK: {'✅' if step2_1_capacity['status']['total_ok'] else '❌'}")
    print(f"응답 데이터:")
    print(f"  - JSON 파싱 성공: {'✅' if step2_1_response_check['is_valid_json'] else '❌'}")
    if step2_1_response_check['is_valid_json']:
        print(f"  - JSON 키: {', '.join(step2_1_response_check['json_keys'])}")
    
    # STEP 2-2 체크
    print("\n" + "-"*80)
    print("📊 STEP 2-2: Priority 2,3 + Upselling")
    print("-"*80)
    
    step2_2_prompt = os.path.join(log_dir, prompt_files[2])
    step2_2_response = os.path.join(log_dir, response_files[2])
    
    with open(step2_2_prompt, 'r', encoding='utf-8') as f:
        step2_2_data = json.load(f)
    
    step2_2_capacity = check_step_capacity("STEP 2-2", step2_2_data, step2_2_data.get("model", "gpt-4o"))
    step2_2_response_check = check_response_data("STEP 2-2", step2_2_response)
    
    print(f"모델: {step2_2_capacity['model']}")
    print(f"입력:")
    print(f"  - 시스템 메시지: {step2_2_capacity['input']['system_chars']:,}자 (~{step2_2_capacity['input']['system_tokens']:,} 토큰)")
    print(f"  - 사용자 메시지: {step2_2_capacity['input']['user_chars']:,}자 (~{step2_2_capacity['input']['user_tokens']:,} 토큰)")
    print(f"  - 총 입력: ~{step2_2_capacity['input']['total_tokens']:,} 토큰")
    print(f"  - ⚠️ STEP 1 + STEP 2-1 결과 포함됨")
    print(f"출력:")
    print(f"  - 요청한 max_tokens: {step2_2_capacity['output']['requested_max_tokens']:,}")
    print(f"  - 실제 응답: {step2_2_response_check['response_tokens']:,} 토큰")
    print(f"용량:")
    print(f"  - Context Window: {step2_2_capacity['limits']['context_window']:,} 토큰")
    print(f"  - 사용률: {step2_2_capacity['status']['usage_percent']}%")
    print(f"  - 남은 출력 용량: {step2_2_capacity['limits']['remaining_for_output']:,} 토큰")
    print(f"상태:")
    print(f"  - 입력 용량 OK: {'✅' if step2_2_capacity['status']['input_ok'] else '❌'}")
    print(f"  - 출력 용량 OK: {'✅' if step2_2_capacity['status']['output_ok'] else '❌'}")
    print(f"  - 전체 용량 OK: {'✅' if step2_2_capacity['status']['total_ok'] else '❌'}")
    print(f"응답 데이터:")
    print(f"  - JSON 파싱 성공: {'✅' if step2_2_response_check['is_valid_json'] else '❌'}")
    if step2_2_response_check['is_valid_json']:
        print(f"  - JSON 키: {', '.join(step2_2_response_check['json_keys'])}")
    
    # 데이터 전달 체크
    print("\n" + "="*80)
    print("🔗 데이터 전달 흐름 검증")
    print("="*80)
    
    # STEP 1 → STEP 2-1 전달 체크
    print("\n✅ STEP 1 → STEP 2-1 전달:")
    with open(step2_1_prompt, 'r', encoding='utf-8') as f:
        step2_1_full = json.load(f)
    
    step1_in_step2_1 = "STEP 1 분석 결과" in step2_1_full.get("user_message", "")
    print(f"  - STEP 1 결과 포함: {'✅' if step1_in_step2_1 else '❌'}")
    
    if step1_in_step2_1:
        # STEP 1 결과가 정확히 포함되었는지 확인
        with open(step1_response, 'r', encoding='utf-8') as f:
            step1_resp = json.load(f)
            step1_parsed = json.loads(step1_resp["response"])
            
        print(f"  - patient_summary 전달: {'✅' if 'patient_summary' in str(step2_1_full['user_message']) else '❌'}")
        print(f"  - analysis 전달: {'✅' if 'analysis' in str(step2_1_full['user_message']) else '❌'}")
    
    # STEP 2-1 → STEP 2-2 전달 체크
    print("\n✅ STEP 2-1 → STEP 2-2 전달:")
    with open(step2_2_prompt, 'r', encoding='utf-8') as f:
        step2_2_full = json.load(f)
    
    step2_1_in_step2_2 = "STEP 2-1 결과" in step2_2_full.get("user_message", "")
    step1_in_step2_2 = "STEP 1 분석 결과" in step2_2_full.get("user_message", "")
    
    print(f"  - STEP 1 결과 포함: {'✅' if step1_in_step2_2 else '❌'}")
    print(f"  - STEP 2-1 결과 포함: {'✅' if step2_1_in_step2_2 else '❌'}")
    
    if step2_1_in_step2_2:
        print(f"  - priority_1 데이터 전달: {'✅' if 'priority_1' in str(step2_2_full['user_message']) else '❌'}")
    
    # 요약
    print("\n" + "="*80)
    print("📋 요약")
    print("="*80)
    
    total_steps_ok = (
        step1_capacity['status']['total_ok'] and
        step2_1_capacity['status']['total_ok'] and
        step2_2_capacity['status']['total_ok']
    )
    
    total_responses_ok = (
        step1_response_check['is_valid_json'] and
        step2_1_response_check['is_valid_json'] and
        step2_2_response_check['is_valid_json']
    )
    
    data_flow_ok = step1_in_step2_1 and step2_1_in_step2_2 and step1_in_step2_2
    
    print(f"1. 모든 스텝 용량 적합: {'✅' if total_steps_ok else '❌'}")
    print(f"2. 모든 응답 JSON 파싱 성공: {'✅' if total_responses_ok else '❌'}")
    print(f"3. 데이터 전달 흐름 정상: {'✅' if data_flow_ok else '❌'}")
    
    if total_steps_ok and total_responses_ok and data_flow_ok:
        print("\n🎉 모든 체크 항목 통과! 시스템이 정상적으로 작동하고 있습니다.")
    else:
        print("\n⚠️ 일부 문제가 발견되었습니다. 위의 상세 내용을 확인하세요.")
    
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    main()

