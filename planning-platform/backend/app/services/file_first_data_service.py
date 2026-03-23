"""
파일 우선 저장 후 DB 입력 전략을 위한 데이터 서비스
안정성과 데이터 무결성을 보장하는 2단계 저장 방식
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import asyncio
import shutil

from .welno_data_service import WelnoDataService


class FileFirstDataService:
    """파일 우선 저장 후 DB 입력 서비스"""
    
    def __init__(self):
        self.base_dir = Path("/home/workspace/PROJECT_WELNO_BEFE/tilko_data")
        self.pending_dir = self.base_dir / "pending"  # DB 입력 대기 중
        self.completed_dir = self.base_dir / "completed"  # DB 입력 완료
        self.failed_dir = self.base_dir / "failed"  # DB 입력 실패
        self.backup_dir = self.base_dir / "backup"  # 백업
        
        # 디렉토리 생성
        for directory in [self.pending_dir, self.completed_dir, self.failed_dir, self.backup_dir]:
            directory.mkdir(parents=True, exist_ok=True)
        
        self.welno_service = WelnoDataService()
    
    def _generate_file_hash(self, data: Dict[str, Any]) -> str:
        """데이터의 해시값 생성 (무결성 검증용)"""
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()
    
    def _create_data_package(self, session_id: str, data_type: str, raw_data: Dict[str, Any], 
                           patient_uuid: str = None, hospital_id: str = None) -> Dict[str, Any]:
        """데이터 패키지 생성 (메타데이터 포함)"""
        timestamp = datetime.now()
        
        package = {
            "metadata": {
                "session_id": session_id,
                "data_type": data_type,  # 'health_data', 'prescription_data', 'patient_data'
                "patient_uuid": patient_uuid,
                "hospital_id": hospital_id,
                "created_at": timestamp.isoformat(),
                "file_version": "1.0",
                "status": "pending"  # pending, processing, completed, failed
            },
            "raw_data": raw_data,
            "checksum": None  # 아래에서 계산
        }
        
        # 체크섬 계산 (메타데이터 + raw_data)
        package["checksum"] = self._generate_file_hash(package)
        
        return package
    
    async def save_data_to_file_first(self, session_id: str, data_type: str, raw_data: Dict[str, Any],
                                    patient_uuid: str = None, hospital_id: str = None) -> Tuple[bool, str]:
        """
        1단계: 데이터를 파일로 먼저 저장
        Returns: (성공여부, 파일경로)
        """
        try:
            # 데이터 패키지 생성
            data_package = self._create_data_package(session_id, data_type, raw_data, patient_uuid, hospital_id)
            
            # 파일명 생성: timestamp_sessionId_dataType.json
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # 밀리초 포함
            filename = f"{timestamp}_{session_id}_{data_type}.json"
            file_path = self.pending_dir / filename
            
            # 파일 저장
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data_package, f, ensure_ascii=False, indent=2)
            
            print(f"✅ [파일저장] {data_type} 데이터 파일 저장 완료: {filename}")
            print(f"   📁 경로: {file_path}")
            print(f"   🔒 체크섬: {data_package['checksum'][:16]}...")
            
            return True, str(file_path)
            
        except Exception as e:
            print(f"❌ [파일저장] {data_type} 데이터 파일 저장 실패: {e}")
            return False, ""
    
    async def process_pending_files_to_db(self, max_files: int = 10) -> Dict[str, int]:
        """
        2단계: pending 폴더의 파일들을 DB에 저장
        Returns: 처리 결과 통계
        """
        results = {"success": 0, "failed": 0, "skipped": 0}
        
        try:
            # pending 폴더의 JSON 파일들 가져오기 (오래된 순서대로)
            pending_files = sorted(
                [f for f in self.pending_dir.glob("*.json")],
                key=lambda x: x.stat().st_mtime
            )[:max_files]
            
            # 처리할 파일이 없으면 조용히 리턴
            if len(pending_files) == 0:
                return results
            
            print(f"🔄 [DB저장] pending 파일 {len(pending_files)}개 처리 시작")
            
            for file_path in pending_files:
                try:
                    # 파일 읽기 및 검증
                    success, data_package = await self._load_and_validate_file(file_path)
                    if not success:
                        results["skipped"] += 1
                        continue
                    
                    # DB 저장 시도
                    db_success = await self._save_package_to_db(data_package)
                    
                    if db_success:
                        # 성공: completed 폴더로 이동
                        await self._move_file_to_completed(file_path, data_package)
                        results["success"] += 1
                        print(f"✅ [DB저장] 파일 처리 성공: {file_path.name}")
                    else:
                        # 실패: failed 폴더로 이동
                        await self._move_file_to_failed(file_path, data_package)
                        results["failed"] += 1
                        print(f"❌ [DB저장] 파일 처리 실패: {file_path.name}")
                        
                except Exception as e:
                    print(f"❌ [DB저장] 파일 처리 중 오류 ({file_path.name}): {e}")
                    results["failed"] += 1
            
            # 실제로 처리한 파일이 있을 때만 완료 로그 출력
            total_processed = results['success'] + results['failed'] + results['skipped']
            if total_processed > 0:
                print(f"🏁 [DB저장] 처리 완료 - 성공: {results['success']}, 실패: {results['failed']}, 건너뜀: {results['skipped']}")
            
        except Exception as e:
            print(f"❌ [DB저장] pending 파일 처리 중 전체 오류: {e}")
        
        return results
    
    async def _load_and_validate_file(self, file_path: Path) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """파일 로드 및 무결성 검증"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data_package = json.load(f)
            
            # 필수 필드 확인
            if not all(key in data_package for key in ["metadata", "raw_data", "checksum"]):
                print(f"⚠️ [파일검증] 필수 필드 누락: {file_path.name}")
                return False, None
            
            # 체크섬 검증
            original_checksum = data_package["checksum"]
            data_package_copy = data_package.copy()
            data_package_copy["checksum"] = None
            calculated_checksum = self._generate_file_hash(data_package_copy)
            
            if original_checksum != calculated_checksum:
                print(f"❌ [파일검증] 체크섬 불일치: {file_path.name}")
                print(f"   원본: {original_checksum[:16]}...")
                print(f"   계산: {calculated_checksum[:16]}...")
                return False, None
            
            print(f"✅ [파일검증] 무결성 확인 완료: {file_path.name}")
            return True, data_package
            
        except Exception as e:
            print(f"❌ [파일검증] 파일 로드 실패 ({file_path.name}): {e}")
            return False, None
    
    async def _save_package_to_db(self, data_package: Dict[str, Any]) -> bool:
        """데이터 패키지를 DB에 저장"""
        try:
            metadata = data_package["metadata"]
            raw_data = data_package["raw_data"]
            
            data_type = metadata["data_type"]
            patient_uuid = metadata.get("patient_uuid")
            hospital_id = metadata.get("hospital_id")
            session_id = metadata["session_id"]
            
            if data_type == "patient_data":
                # 환자 정보 저장
                result = await self.welno_service.save_patient_data(
                    uuid=patient_uuid,
                    hospital_id=hospital_id,
                    user_info=raw_data,
                    session_id=session_id
                )
                return result is not None
                
            elif data_type == "health_data":
                # 건강검진 데이터 저장
                result = await self.welno_service.save_health_data(
                    patient_uuid=patient_uuid,
                    hospital_id=hospital_id,
                    health_data=raw_data,
                    session_id=session_id
                )
                return result
                
            elif data_type == "prescription_data":
                # 처방전 데이터 저장
                result = await self.welno_service.save_prescription_data(
                    patient_uuid=patient_uuid,
                    hospital_id=hospital_id,
                    prescription_data=raw_data,
                    session_id=session_id
                )
                return result
                
            else:
                print(f"⚠️ [DB저장] 알 수 없는 데이터 타입: {data_type}")
                return False
                
        except Exception as e:
            print(f"❌ [DB저장] 데이터베이스 저장 실패: {e}")
            return False
    
    async def _move_file_to_completed(self, file_path: Path, data_package: Dict[str, Any]):
        """성공한 파일을 completed 폴더로 이동"""
        try:
            # 메타데이터 업데이트
            data_package["metadata"]["status"] = "completed"
            data_package["metadata"]["completed_at"] = datetime.now().isoformat()
            
            # 새 파일 경로
            new_path = self.completed_dir / file_path.name
            
            # 업데이트된 데이터로 저장
            with open(new_path, 'w', encoding='utf-8') as f:
                json.dump(data_package, f, ensure_ascii=False, indent=2)
            
            # 원본 파일 삭제
            file_path.unlink()
            
        except Exception as e:
            print(f"❌ [파일이동] completed 이동 실패: {e}")
    
    async def _move_file_to_failed(self, file_path: Path, data_package: Dict[str, Any]):
        """실패한 파일을 failed 폴더로 이동"""
        try:
            # 메타데이터 업데이트
            data_package["metadata"]["status"] = "failed"
            data_package["metadata"]["failed_at"] = datetime.now().isoformat()
            data_package["metadata"]["retry_count"] = data_package["metadata"].get("retry_count", 0) + 1
            
            # 새 파일 경로
            new_path = self.failed_dir / file_path.name
            
            # 업데이트된 데이터로 저장
            with open(new_path, 'w', encoding='utf-8') as f:
                json.dump(data_package, f, ensure_ascii=False, indent=2)
            
            # 원본 파일 삭제
            file_path.unlink()
            
        except Exception as e:
            print(f"❌ [파일이동] failed 이동 실패: {e}")
    
    async def retry_failed_files(self, max_retries: int = 3) -> Dict[str, int]:
        """실패한 파일들 재시도"""
        results = {"retry_success": 0, "retry_failed": 0, "max_retries_exceeded": 0}
        
        try:
            failed_files = list(self.failed_dir.glob("*.json"))
            
            # 재시도할 파일이 없으면 조용히 리턴
            if len(failed_files) == 0:
                return results
            
            print(f"🔄 [재시도] 실패 파일 {len(failed_files)}개 재시도 시작")
            
            for file_path in failed_files:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data_package = json.load(f)
                    
                    retry_count = data_package["metadata"].get("retry_count", 0)
                    
                    if retry_count >= max_retries:
                        results["max_retries_exceeded"] += 1
                        continue
                    
                    # DB 저장 재시도
                    db_success = await self._save_package_to_db(data_package)
                    
                    if db_success:
                        # 성공: completed로 이동
                        await self._move_file_to_completed(file_path, data_package)
                        results["retry_success"] += 1
                    else:
                        # 실패: 재시도 카운트 증가
                        data_package["metadata"]["retry_count"] = retry_count + 1
                        data_package["metadata"]["last_retry_at"] = datetime.now().isoformat()
                        
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(data_package, f, ensure_ascii=False, indent=2)
                        
                        results["retry_failed"] += 1
                        
                except Exception as e:
                    print(f"❌ [재시도] 파일 처리 오류 ({file_path.name}): {e}")
                    results["retry_failed"] += 1
            
            # 실제로 처리한 파일이 있을 때만 완료 로그 출력
            total_retried = results['retry_success'] + results['retry_failed'] + results['max_retries_exceeded']
            if total_retried > 0:
                print(f"🏁 [재시도] 완료 - 성공: {results['retry_success']}, 실패: {results['retry_failed']}, 최대재시도초과: {results['max_retries_exceeded']}")
            
        except Exception as e:
            print(f"❌ [재시도] 전체 처리 오류: {e}")
        
        return results
    
    async def get_status_summary(self) -> Dict[str, Any]:
        """현재 상태 요약"""
        try:
            pending_count = len(list(self.pending_dir.glob("*.json")))
            completed_count = len(list(self.completed_dir.glob("*.json")))
            failed_count = len(list(self.failed_dir.glob("*.json")))
            
            return {
                "pending_files": pending_count,
                "completed_files": completed_count,
                "failed_files": failed_count,
                "total_files": pending_count + completed_count + failed_count,
                "directories": {
                    "pending": str(self.pending_dir),
                    "completed": str(self.completed_dir),
                    "failed": str(self.failed_dir),
                    "backup": str(self.backup_dir)
                }
            }
        except Exception as e:
            print(f"❌ [상태조회] 오류: {e}")
            return {"error": str(e)}
    
    async def cleanup_old_files(self, days_old: int = 30):
        """오래된 파일 정리 (completed, backup 폴더)"""
        try:
            from datetime import timedelta
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            cleaned_count = 0
            
            for directory in [self.completed_dir, self.backup_dir]:
                for file_path in directory.glob("*.json"):
                    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_time < cutoff_date:
                        file_path.unlink()
                        cleaned_count += 1
            
            print(f"🧹 [정리] {days_old}일 이상 된 파일 {cleaned_count}개 삭제 완료")
            
        except Exception as e:
            print(f"❌ [정리] 파일 정리 오류: {e}")

