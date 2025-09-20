"""
카카오 인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import uuid
import os
from datetime import datetime

router = APIRouter()

# 카카오 인증 더미 데이터
KAKAO_USERS_DATA = {}

@router.get("/login-url")
async def get_kakao_login_url() -> Dict[str, Any]:
    """
    카카오 로그인 URL 생성 (환경변수 사용)
    """
    kakao_client_id = os.getenv("KAKAO_CLIENT_ID", "dummy_kakao_client_id")
    redirect_uri = os.getenv("KAKAO_REDIRECT_URI", "http://localhost:9283/auth/kakao/callback")
    
    login_url = f"https://kauth.kakao.com/oauth/authorize?client_id={kakao_client_id}&redirect_uri={redirect_uri}&response_type=code"
    
    return {
        "success": True,
        "data": {
            "loginUrl": login_url,
            "clientId": kakao_client_id,
            "redirectUri": redirect_uri,
            "isDummy": kakao_client_id == "dummy_kakao_client_id"
        },
        "message": "카카오 로그인 URL을 생성했습니다."
    }

@router.post("/callback")
async def kakao_callback(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    카카오 로그인 콜백 처리 (현아 프로젝트 방식)
    """
    try:
        kakao_user_info = request.get("kakaoUserInfo", {})
        access_token = request.get("accessToken")
        refresh_token = request.get("refreshToken")
        expires_in = request.get("expiresIn")
        
        if not kakao_user_info or not access_token:
            raise HTTPException(
                status_code=400,
                detail="카카오 사용자 정보와 액세스 토큰이 필요합니다."
            )
        
        # 카카오 사용자 ID로 기존 사용자 확인
        kakao_id = str(kakao_user_info.get("id"))
        existing_user = None
        
        # 기존 사용자 찾기
        for user_id, user_data in KAKAO_USERS_DATA.items():
            if user_data.get("loginId") == kakao_id:
                existing_user = user_data
                break
        
        if existing_user:
            # 기존 사용자 정보 업데이트
            user_id = existing_user["id"]
            KAKAO_USERS_DATA[user_id].update({
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
                "lastLoginAt": datetime.now().isoformat(),
                "name": kakao_user_info.get("nickname", existing_user.get("name")),
                "email": kakao_user_info.get("email", existing_user.get("email")),
                "profileImage": kakao_user_info.get("profileImage", existing_user.get("profileImage"))
            })
            web_app_key = existing_user.get("webAppKey")
        else:
            # 새 사용자 생성 (현아 방식)
            user_id = str(uuid.uuid4())
            web_app_key = f"webapp_{user_id}"
            
            user_info = {
                "id": user_id,
                "webAppKey": web_app_key,
                "loginType": "kakao",
                "loginId": kakao_id,
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
                "name": kakao_user_info.get("nickname", "사용자"),
                "email": kakao_user_info.get("email", ""),
                "profileImage": kakao_user_info.get("profileImage", ""),
                "phoneNumber": kakao_user_info.get("phoneNumber", ""),
                "connectedAt": kakao_user_info.get("connectedAt", datetime.now().isoformat()),
                "createdAt": datetime.now().isoformat(),
                "lastLoginAt": datetime.now().isoformat(),
                "active": True,
                "isFirstLogin": True
            }
            
            # 더미 데이터에 저장
            KAKAO_USERS_DATA[user_id] = user_info
        
        # 현아 방식의 응답 형식
        return {
            "success": True,
            "data": {
                "user": KAKAO_USERS_DATA[user_id],
                "webAppKey": web_app_key,
                "needProfile": False,  # 프로필 추가 입력 필요 여부
                "isFirstLogin": not existing_user
            },
            "message": "카카오 로그인이 완료되었습니다."
        }
        
    except Exception as e:
        print(f"카카오 로그인 처리 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"카카오 로그인 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/user/{user_id}")
async def get_kakao_user(user_id: str) -> Dict[str, Any]:
    """
    카카오 사용자 정보 조회
    """
    if user_id not in KAKAO_USERS_DATA:
        raise HTTPException(
            status_code=404,
            detail="사용자를 찾을 수 없습니다."
        )
    
    return {
        "success": True,
        "data": KAKAO_USERS_DATA[user_id],
        "message": "사용자 정보를 조회했습니다."
    }

@router.post("/logout")
async def kakao_logout(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    카카오 로그아웃
    """
    try:
        user_id = request.get("userId")
        
        if user_id and user_id in KAKAO_USERS_DATA:
            # 실제로는 카카오 API로 로그아웃 요청
            del KAKAO_USERS_DATA[user_id]
        
        return {
            "success": True,
            "data": None,
            "message": "로그아웃이 완료되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"로그아웃 처리 중 오류가 발생했습니다: {str(e)}"
        )
