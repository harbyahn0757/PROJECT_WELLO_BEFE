"""
LLM 모델별 단가 (USD per 1M tokens, 2026-05 기준 Google AI Studio + OpenAI 공식)

5/3~5/4 점검 결과 정상 트래픽 1일 비용 ~$0.009. 4월 100만원 사고 ($23/일) = 정상의 2,500배 폭주.
비용 cap 으로 폭주 메커니즘 무관 차단 (분당/일별 cell 무효화).

trigger 변경 시 본 파일만 수정 + cap 임계는 settings 환경변수.
"""

from typing import Tuple

# (input_per_1m, output_per_1m) USD
PRICING: dict = {
    # Google Gemini
    "gemini-3-flash-preview": (0.075, 0.30),
    "gemini-2.5-flash": (0.075, 0.30),
    "gemini-2.5-flash-lite": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    "gemini-1.5-flash": (0.075, 0.30),
    # OpenAI (폴백)
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "openai-fallback": (0.15, 0.60),  # 라우터 표기명
    "openai-degraded": (0.15, 0.60),
    # 무비용 placeholder
    "(quota_blocked)": (0.0, 0.0),
    "(down)": (0.0, 0.0),
    "manual_test": (0.0, 0.0),
    "sanity_check": (0.0, 0.0),
}

# 매칭 실패 시 보수적 폴백 (gpt-4o 단가 = 가장 비쌈 → 보수 추정)
DEFAULT_PRICE: Tuple[float, float] = (2.50, 10.00)


def get_rate(model: str) -> Tuple[float, float]:
    """모델명 → (in_rate, out_rate) per 1M tokens."""
    if not model:
        return DEFAULT_PRICE
    # 정확 매칭
    if model in PRICING:
        return PRICING[model]
    # prefix 매칭 (gemini-3-flash-preview-001 등 변형 대응)
    for k, v in PRICING.items():
        if k != "openai-fallback" and k != "openai-degraded" and model.startswith(k):
            return v
    return DEFAULT_PRICE


def estimate_usd(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    """단일 호출 비용 추산 USD. cached_tokens 는 input 단가 25% 로 가정 (Gemini Context Caching 일반치)."""
    in_rate, out_rate = get_rate(model)
    # cached 는 input 의 25% 단가 (Gemini Context Caching 정책)
    fresh_in = max(0, (input_tokens or 0) - (cached_tokens or 0))
    cached_cost = (cached_tokens or 0) * in_rate * 0.25 / 1_000_000
    in_cost = fresh_in * in_rate / 1_000_000
    out_cost = (output_tokens or 0) * out_rate / 1_000_000
    return round(in_cost + cached_cost + out_cost, 6)
