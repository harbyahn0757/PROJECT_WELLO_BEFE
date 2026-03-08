"""
에이전트 설문 토큰 검증 API
PJT_P9_API가 발급한 JWT를 검증하고 생년월일 매칭
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

import jwt as pyjwt

logger = logging.getLogger(__name__)
router = APIRouter()

# PJT_P9_API와 동일한 시크릿 키
AGENT_JWT_SECRET = "p9_marketing_api_secret_key_2025"


@router.post("/agent-survey/verify")
async def verify_agent_survey_token(request: Dict[str, Any]):
    """에이전트 설문 토큰 검증 + 생년월일 확인"""
    token = request.get("token", "")
    birth_date = request.get("birth_date", "")

    if not token:
        raise HTTPException(status_code=400, detail="토큰은 필수입니다.")

    try:
        payload = pyjwt.decode(token, AGENT_JWT_SECRET, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="링크가 만료되었습니다.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 링크입니다.")

    if payload.get("type") != "agent_survey":
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰 유형입니다.")

    # 생년월일 매칭: birth_date 미제공 시 토큰 내 birth_date로 자동 인증
    if birth_date:
        token_birth = payload.get("birth_date", "").replace("-", "")
        input_birth = birth_date.replace("-", "")
        if token_birth != input_birth:
            raise HTTPException(status_code=403, detail="생년월일이 일치하지 않습니다.")

    return {
        "success": True,
        "data": {
            "uuid": payload.get("uuid"),
            "name": payload.get("name", ""),
            "birth_date": payload.get("birth_date", ""),
            "link_type": payload.get("link_type", "landing"),
            "survey_id": "agent-health-survey",
        },
    }
