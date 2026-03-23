"""
디버그 전용 API 엔드포인트
개발자 전용 로그 다운로드 등
"""

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
import os
import zipfile
import io
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel
import json

router = APIRouter()


class FrontendStateLog(BaseModel):
    """프론트엔드 상태 로그 모델"""
    page_path: str
    user_agent: Optional[str] = None
    localStorage_state: Dict[str, Any]
    session_storage_state: Optional[Dict[str, Any]] = None
    url_params: Optional[Dict[str, str]] = None
    timestamp: Optional[str] = None

@router.get("/download-logs")
async def download_recent_logs(
    log_type: str = Query("session", description="로그 타입: session (세션 로그) 또는 legacy (기존 개별 로그)"),
    count: int = Query(10, description="다운로드할 파일 개수")
) -> StreamingResponse:
    """
    최근 GPT 로그 파일을 ZIP으로 다운로드
    
    Args:
        log_type: "session" (세션 기반 로그) 또는 "legacy" (기존 개별 로그)
        count: 다운로드할 파일 개수
    
    Returns:
        ZIP 파일 스트림
    """
    try:
        logs_dir = Path("/home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/logs")
        
        if not logs_dir.exists():
            raise HTTPException(status_code=404, detail="로그 디렉토리를 찾을 수 없습니다")
        
        # ZIP 파일 생성 (메모리에서)
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            if log_type == "session":
                # 세션 로그 파일들 (patient_*.json)
                session_files = sorted(
                    logs_dir.glob("patient_*.json"),
                    key=lambda x: x.stat().st_mtime,
                    reverse=True
                )[:count]
                
                for file_path in session_files:
                    arcname = f"sessions/{file_path.name}"
                    zip_file.write(file_path, arcname)
                
                readme_content = f"""# GPT 세션 로그 다운로드

## 다운로드 시간
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 포함된 파일
- 세션 로그: {len(session_files)}개

## 파일 구조
sessions/patient_XXXXXXXX.json - 환자별 모든 세션 기록

## 세션 로그 구조
{{
  "patient_uuid": "환자 UUID",
  "patient_name": "환자 이름",
  "hospital_id": "병원 ID",
  "sessions": [
    {{
      "session_id": "YYYYMMDD_HHMMSS",
      "started_at": "시작 시간",
      "steps": [
        {{
          "step": "1",
          "name": "건강 분석",
          "request": {{}},
          "response": {{}},
          "duration_ms": 3200
        }}
      ]
    }}
  ]
}}

한 환자의 모든 세션이 하나의 파일에 시간순으로 기록됩니다.
"""
            else:  # legacy
                # 기존 개별 로그 파일들
                prompt_files = sorted(
                    logs_dir.glob("gpt_prompt_*.json"),
                    key=lambda x: x.stat().st_mtime,
                    reverse=True
                )[:count]
                
                response_files = sorted(
                    logs_dir.glob("gpt_response_*.json"),
                    key=lambda x: x.stat().st_mtime,
                    reverse=True
                )[:count]
                
                for file_path in prompt_files:
                    arcname = f"prompts/{file_path.name}"
                    zip_file.write(file_path, arcname)
                
                for file_path in response_files:
                    arcname = f"responses/{file_path.name}"
                    zip_file.write(file_path, arcname)
                
                readme_content = f"""# GPT 로그 파일 다운로드 (레거시)
            
## 다운로드 시간
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 포함된 파일
- 프롬프트 파일: {len(prompt_files)}개
- 응답 파일: {len(response_files)}개

## 파일 구조
- prompts/: GPT에 전송한 프롬프트 파일들
- responses/: GPT로부터 받은 응답 파일들

타임스탬프로 프롬프트와 응답을 매칭할 수 있습니다.
"""
            
            zip_file.writestr("README.md", readme_content)
        
        # ZIP 파일 포인터를 처음으로 이동
        zip_buffer.seek(0)
        
        # 파일명 생성
        filename = f"gpt_logs_{log_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        print(f"❌ [로그 다운로드] 오류: {e}")
        raise HTTPException(status_code=500, detail=f"로그 다운로드 실패: {str(e)}")


@router.get("/log-stats")
async def get_log_statistics() -> Dict[str, Any]:
    """
    로그 파일 통계 정보 조회
    """
    try:
        logs_dir = Path("/home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/logs")
        
        if not logs_dir.exists():
            return {
                "success": False,
                "message": "로그 디렉토리를 찾을 수 없습니다"
            }
        
        prompt_files = list(logs_dir.glob("gpt_prompt_*.json"))
        response_files = list(logs_dir.glob("gpt_response_*.json"))
        
        # 최근 파일 정보
        recent_prompts = sorted(
            prompt_files,
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )[:5]
        
        recent_responses = sorted(
            response_files,
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )[:5]
        
        return {
            "success": True,
            "total_prompts": len(prompt_files),
            "total_responses": len(response_files),
            "recent_prompts": [
                {
                    "filename": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 2),
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                }
                for f in recent_prompts
            ],
            "recent_responses": [
                {
                    "filename": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 2),
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                }
                for f in recent_responses
            ]
        }
        
    except Exception as e:
        print(f"❌ [로그 통계] 오류: {e}")
        raise HTTPException(status_code=500, detail=f"로그 통계 조회 실패: {str(e)}")


@router.post("/frontend-state")
async def log_frontend_state(
    state_data: FrontendStateLog,
    request: Request
) -> Dict[str, Any]:
    """
    프론트엔드 상태를 서버 로그에 기록
    모바일 디버깅용
    """
    try:
        # 클라이언트 IP 가져오기
        client_ip = request.client.host
        
        # User-Agent 헤더에서 가져오기 (요청 데이터에 없으면)
        if not state_data.user_agent:
            state_data.user_agent = request.headers.get("user-agent", "Unknown")
        
        # 타임스탬프 설정 (요청 데이터에 없으면)
        if not state_data.timestamp:
            state_data.timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # 로그 메시지 구성
        log_data = {
            "type": "FRONTEND_STATE_DEBUG",
            "timestamp": state_data.timestamp,
            "client_ip": client_ip,
            "user_agent": state_data.user_agent,
            "page_path": state_data.page_path,
            "url_params": state_data.url_params,
            "localStorage": state_data.localStorage_state,
            "sessionStorage": state_data.session_storage_state
        }
        
        # 플로팅 버튼 관련 핵심 상태값들 추출
        floating_button_states = {}
        ls = state_data.localStorage_state
        
        # 플로팅 버튼 숨김 관련 상태들
        floating_related_keys = [
            'collectingStatus', 'passwordModalOpen', 'tilko_auth_waiting',
            'isDataCollectionCompleted', 'showPasswordModal', 'authFlow',
            'welno_patient_uuid', 'welno_hospital_id', 'campaign_mode'
        ]
        
        for key in floating_related_keys:
            if key in ls:
                floating_button_states[key] = ls[key]
        
        # 상세 로그 출력
        print(f"\n🔍 [FRONTEND_DEBUG] {state_data.timestamp}")
        print(f"📍 페이지: {state_data.page_path}")
        print(f"🌐 IP: {client_ip}")
        print(f"📱 UA: {state_data.user_agent[:100]}...")
        
        if state_data.url_params:
            print(f"🔗 URL 파라미터: {json.dumps(state_data.url_params, ensure_ascii=False)}")
        
        print(f"🎯 플로팅 버튼 관련 상태:")
        for key, value in floating_button_states.items():
            print(f"   - {key}: {value}")
        
        # localStorage 전체 키 목록
        all_keys = list(ls.keys()) if ls else []
        print(f"💾 localStorage 전체 키 ({len(all_keys)}개): {all_keys}")
        
        # 특별히 주의깊게 봐야 할 상태들
        critical_states = []
        if ls.get('collectingStatus') == 'true':
            critical_states.append("⚠️ collectingStatus=true (데이터 수집 중)")
        if ls.get('passwordModalOpen') == 'true':
            critical_states.append("⚠️ passwordModalOpen=true (패스워드 모달 열림)")
        if ls.get('tilko_auth_waiting') == 'true':
            critical_states.append("⚠️ tilko_auth_waiting=true (틸코 인증 대기)")
        
        if critical_states:
            print(f"🚨 주의 상태:")
            for state in critical_states:
                print(f"   {state}")
        else:
            print(f"✅ 플로팅 버튼 숨김 상태 없음")
        
        print(f"─" * 80)
        
        return {
            "success": True,
            "message": "프론트엔드 상태가 서버 로그에 기록되었습니다",
            "logged_keys": len(all_keys),
            "floating_button_states": floating_button_states,
            "critical_states": critical_states
        }
        
    except Exception as e:
        print(f"❌ [프론트엔드 상태 로깅] 오류: {e}")
        raise HTTPException(status_code=500, detail=f"상태 로깅 실패: {str(e)}")

