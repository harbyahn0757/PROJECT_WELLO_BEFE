"""
세션 기반 로깅 시스템
날짜별/세션별 폴더 구조로 로그 저장
구조: logs/planning_YYYYMMDD/{HHMMSS}_{UUID}/step{N}_prompt.json, step{N}_result.json
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import threading

class SessionLogger:
    """환자별 세션 로깅 관리"""
    
    def __init__(self, logs_dir: str = "/data/wello_logs"):
        self.logs_dir = Path(logs_dir)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()  # 파일 쓰기 동시성 제어
        
    def _get_patient_log_file(self, patient_uuid: str) -> Path:
        """환자별 통합 로그 파일 경로 반환 (이력 관리용)"""
        short_uuid = patient_uuid.split('-')[0]
        return self.logs_dir / f"patient_{short_uuid}.json"
    
    def _load_patient_log(self, patient_uuid: str) -> Dict[str, Any]:
        """환자 로그 파일 로드"""
        log_file = self._get_patient_log_file(patient_uuid)
        
        if log_file.exists():
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ [SessionLogger] 로그 파일 로드 실패: {e}")
                return self._create_empty_log_structure(patient_uuid)
        else:
            return self._create_empty_log_structure(patient_uuid)
    
    def _create_empty_log_structure(self, patient_uuid: str) -> Dict[str, Any]:
        """빈 로그 구조 생성"""
        return {
            "patient_uuid": patient_uuid,
            "patient_name": "",
            "hospital_id": "",
            "sessions": []
        }
    
    def _save_patient_log(self, patient_uuid: str, log_data: Dict[str, Any]):
        """환자 로그 파일 저장"""
        log_file = self._get_patient_log_file(patient_uuid)
        
        with self._lock:
            try:
                with open(log_file, 'w', encoding='utf-8') as f:
                    json.dump(log_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"❌ [SessionLogger] 저장 실패: {e}")
    
    def start_session(
        self, 
        patient_uuid: str, 
        patient_name: str = "",
        hospital_id: str = ""
    ) -> str:
        """
        새 세션 시작 및 폴더 생성
        Returns: session_id (YYYYMMDD_HHMMSS_SHORTUUID)
        """
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H%M%S")
        short_uuid = patient_uuid.split('-')[0]
        
        # 세션 ID 포맷 통일 (날짜_시간_UUID)
        session_id = f"{date_str}_{time_str}_{short_uuid}"
        
        # 1. 세션 폴더 생성: logs/planning_YYYYMMDD/YYYYMMDD_HHMMSS_UUID/
        # (날짜 폴더 하위에 두되, 세션 ID를 그대로 사용)
        date_dir = self.logs_dir / f"planning_{date_str}"
        session_dir = date_dir / session_id
        
        try:
            session_dir.mkdir(parents=True, exist_ok=True)
            print(f"📁 [SessionLogger] 세션 폴더 생성: {session_dir}")
        except Exception as e:
            print(f"❌ [SessionLogger] 세션 폴더 생성 실패: {e}")
        
        # 2. 환자 통합 로그 업데이트 (이력 관리용)
        log_data = self._load_patient_log(patient_uuid)
        
        if not log_data.get("patient_name"):
            log_data["patient_name"] = patient_name
            log_data["hospital_id"] = hospital_id
        
        new_session = {
            "session_id": session_id,
            "started_at": now.isoformat(),
            "completed_at": None,
            "session_dir": str(session_dir), # 폴더 경로 저장
            "steps": []
        }
        
        log_data["sessions"].append(new_session)
        self._save_patient_log(patient_uuid, log_data)
        
        print(f"🎬 [SessionLogger] 세션 시작: {patient_name} ({session_id})")
        return session_id
    
    def log_step(
        self,
        patient_uuid: str,
        session_id: str,
        step_number: str,
        step_name: str,
        request_data: Dict[str, Any],
        response_data: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None
    ):
        """
        세션 내 스텝 로깅 - 개별 파일로 저장
        Args:
            step_number: "1", "2-1", "2-2" 등 -> 파일명에 사용 (step1, step2_1)
        """
        # 1. 세션 경로 찾기
        log_data = self._load_patient_log(patient_uuid)
        session = None
        for s in log_data["sessions"]:
            if s["session_id"] == session_id:
                session = s
                break
        
        if not session:
            print(f"⚠️ [SessionLogger] 세션을 찾을 수 없음: {session_id}")
            return

        session_dir = Path(session.get("session_dir", ""))
        if not session_dir.exists():
            # 폴더가 없으면 재구성 시도 (하위 호환성 또는 오류 복구)
            # session_id형식: YYYYMMDD_HHMMSS_UUID (신규) 또는 YYYYMMDD_HHMMSS (구형)
            try:
                parts = session_id.split('_')
                if len(parts) >= 2:
                    date_part = parts[0] # YYYYMMDD
                    
                    if len(parts) >= 3:
                        # 신규 포맷: YYYYMMDD_HHMMSS_UUID -> 폴더명과 동일
                        session_dir = self.logs_dir / f"planning_{date_part}" / session_id
                    else:
                        # 구형 포맷: YYYYMMDD_HHMMSS -> HHMMSS_UUID 추정 (UUID 필요)
                        # UUID를 모르면 정확한 복구 어려움, 날짜 폴더까지만 시도
                        time_part = parts[1]
                        short_uuid = patient_uuid.split('-')[0]
                        session_dir = self.logs_dir / f"planning_{date_part}" / f"{time_part}_{short_uuid}"
                    
                    session_dir.mkdir(parents=True, exist_ok=True)
            except:
                print(f"❌ [SessionLogger] 세션 폴더 경로 복구 실패")
                return

        # 2. 파일명 생성용 step suffix 정리 (2-1 -> 2_1)
        file_suffix = step_number.replace("-", "_")
        
        # 3. 프롬프트 파일 저장 (JSON 제거, txt만 저장)
        # JSON 저장 제거됨 - txt 파일만 사용
        if request_data.get("user_message"):
            txt_file = session_dir / f"step{file_suffix}_prompt.txt"
            try:
                with open(txt_file, 'w', encoding='utf-8') as f:
                    f.write(request_data["user_message"])
                print(f"📝 [SessionLogger] 프롬프트 텍스트 저장: {txt_file.name}")
            except Exception as e:
                print(f"❌ [SessionLogger] 프롬프트 저장 실패: {e}")
            
        # 4. 결과 파일 저장 (JSON 제거, txt만 저장)
        # JSON 저장 제거됨 - txt 파일만 사용
        # 결과는 checkup_design.py에서 직접 txt로 저장하므로 여기서는 저장하지 않음

        # 5. 통합 로그 업데이트 (요약 정보만)
        step_summary = {
            "step": step_number,
            "name": step_name,
            "timestamp": datetime.now().isoformat(),
            "duration_ms": duration_ms,
            "files": {
                "prompt_txt": str(session_dir / f"step{file_suffix}_prompt.txt") if request_data.get("user_message") else None,
                "result_txt": str(session_dir / f"step{file_suffix}_result.txt") if response_data else None
            }
        }
        
        # 기존 스텝이 있으면 업데이트, 없으면 추가
        existing_step_idx = next((i for i, s in enumerate(session["steps"]) if s["step"] == step_number), -1)
        if existing_step_idx >= 0:
            session["steps"][existing_step_idx] = step_summary
        else:
            session["steps"].append(step_summary)
            
        self._save_patient_log(patient_uuid, log_data)

    def complete_session(self, patient_uuid: str, session_id: str):
        """세션 완료 마킹"""
        log_data = self._load_patient_log(patient_uuid)
        for session in log_data["sessions"]:
            if session["session_id"] == session_id:
                session["completed_at"] = datetime.now().isoformat()
                # 총 소요 시간 계산
                if session["steps"]:
                    total_duration = sum(
                        step.get("duration_ms", 0) 
                        for step in session["steps"] 
                        if step.get("duration_ms")
                    )
                    session["total_duration_ms"] = total_duration
                break
        self._save_patient_log(patient_uuid, log_data)
        print(f"🏁 [SessionLogger] 세션 완료: {session_id}")

    def get_patient_sessions(self, patient_uuid: str) -> List[Dict[str, Any]]:
        log_data = self._load_patient_log(patient_uuid)
        return log_data.get("sessions", [])
    
    def get_latest_session(self, patient_uuid: str) -> Optional[Dict[str, Any]]:
        sessions = self.get_patient_sessions(patient_uuid)
        return sessions[-1] if sessions else None

# 싱글톤 인스턴스
_session_logger = None

def get_session_logger() -> SessionLogger:
    global _session_logger
    if _session_logger is None:
        _session_logger = SessionLogger()
    return _session_logger
