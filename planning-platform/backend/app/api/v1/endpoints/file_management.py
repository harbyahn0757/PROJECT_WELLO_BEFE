"""
파일 우선 저장 시스템 관리 API
관리자가 파일 처리 상태를 모니터링하고 제어할 수 있는 엔드포인트
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, List
from datetime import datetime

from app.services.file_first_data_service import FileFirstDataService
from app.tasks.file_to_db_processor import (
    manual_process_files, 
    get_processor_stats,
    file_processor
)

router = APIRouter(prefix="/file-management", tags=["파일 관리"])


@router.get("/status")
async def get_file_system_status() -> Dict[str, Any]:
    """파일 시스템 전체 상태 조회"""
    try:
        file_service = FileFirstDataService()
        
        # 파일 상태 요약
        status = await file_service.get_status_summary()
        
        # 프로세서 통계
        processor_stats = get_processor_stats()
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "file_status": status,
            "processor_stats": processor_stats,
            "system_info": {
                "processor_running": file_processor.is_running,
                "last_check": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {str(e)}")


@router.post("/process-pending")
async def process_pending_files_manually(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """pending 파일들을 수동으로 DB에 처리"""
    try:
        print(f"🔧 [수동처리] 관리자 요청으로 파일 처리 시작")
        
        # 백그라운드에서 처리
        background_tasks.add_task(manual_process_files)
        
        return {
            "success": True,
            "message": "파일 처리가 백그라운드에서 시작되었습니다.",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"수동 처리 실패: {str(e)}")


@router.post("/retry-failed")
async def retry_failed_files() -> Dict[str, Any]:
    """실패한 파일들 재시도"""
    try:
        file_service = FileFirstDataService()
        
        print(f"🔄 [재시도] 관리자 요청으로 실패 파일 재시도 시작")
        results = await file_service.retry_failed_files(max_retries=3)
        
        return {
            "success": True,
            "message": "실패한 파일 재시도가 완료되었습니다.",
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재시도 실패: {str(e)}")


@router.post("/cleanup-old-files")
async def cleanup_old_files(days_old: int = 30) -> Dict[str, Any]:
    """오래된 파일들 정리"""
    try:
        if days_old < 7:
            raise HTTPException(status_code=400, detail="최소 7일 이상된 파일만 정리할 수 있습니다.")
        
        file_service = FileFirstDataService()
        
        print(f"🧹 [정리] 관리자 요청으로 {days_old}일 이상된 파일 정리 시작")
        await file_service.cleanup_old_files(days_old=days_old)
        
        return {
            "success": True,
            "message": f"{days_old}일 이상된 파일 정리가 완료되었습니다.",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 정리 실패: {str(e)}")


@router.get("/file-details/{file_type}")
async def get_file_details(file_type: str) -> Dict[str, Any]:
    """특정 타입의 파일 상세 정보 조회"""
    try:
        if file_type not in ["pending", "completed", "failed"]:
            raise HTTPException(status_code=400, detail="file_type은 pending, completed, failed 중 하나여야 합니다.")
        
        file_service = FileFirstDataService()
        
        if file_type == "pending":
            directory = file_service.pending_dir
        elif file_type == "completed":
            directory = file_service.completed_dir
        else:  # failed
            directory = file_service.failed_dir
        
        files = []
        for file_path in directory.glob("*.json"):
            try:
                import json
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                files.append({
                    "filename": file_path.name,
                    "size_bytes": file_path.stat().st_size,
                    "created_at": datetime.fromtimestamp(file_path.stat().st_ctime).isoformat(),
                    "modified_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                    "metadata": data.get("metadata", {}),
                    "data_type": data.get("metadata", {}).get("data_type"),
                    "session_id": data.get("metadata", {}).get("session_id"),
                    "patient_uuid": data.get("metadata", {}).get("patient_uuid"),
                    "status": data.get("metadata", {}).get("status"),
                    "retry_count": data.get("metadata", {}).get("retry_count", 0)
                })
                
            except Exception as e:
                files.append({
                    "filename": file_path.name,
                    "error": f"파일 읽기 실패: {str(e)}",
                    "size_bytes": file_path.stat().st_size,
                    "created_at": datetime.fromtimestamp(file_path.stat().st_ctime).isoformat(),
                    "modified_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                })
        
        # 최신 순으로 정렬
        files.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "success": True,
            "file_type": file_type,
            "total_files": len(files),
            "files": files[:50],  # 최대 50개만 반환
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 상세 조회 실패: {str(e)}")


@router.get("/statistics")
async def get_detailed_statistics() -> Dict[str, Any]:
    """상세 통계 정보 조회"""
    try:
        file_service = FileFirstDataService()
        
        # 기본 상태
        status = await file_service.get_status_summary()
        
        # 프로세서 통계
        processor_stats = get_processor_stats()
        
        # 데이터 타입별 통계
        data_type_stats = {}
        for file_type in ["pending", "completed", "failed"]:
            if file_type == "pending":
                directory = file_service.pending_dir
            elif file_type == "completed":
                directory = file_service.completed_dir
            else:
                directory = file_service.failed_dir
            
            type_counts = {"patient_data": 0, "health_data": 0, "prescription_data": 0, "unknown": 0}
            
            for file_path in directory.glob("*.json"):
                try:
                    import json
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    data_type = data.get("metadata", {}).get("data_type", "unknown")
                    if data_type in type_counts:
                        type_counts[data_type] += 1
                    else:
                        type_counts["unknown"] += 1
                        
                except Exception:
                    type_counts["unknown"] += 1
            
            data_type_stats[file_type] = type_counts
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "overview": status,
            "processor": processor_stats,
            "data_type_breakdown": data_type_stats,
            "system_health": {
                "processor_running": file_processor.is_running,
                "total_files_in_system": status.get("total_files", 0),
                "success_rate": (
                    processor_stats.get("total_success", 0) / 
                    max(processor_stats.get("total_processed", 1), 1) * 100
                ) if processor_stats.get("total_processed", 0) > 0 else 0
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 실패: {str(e)}")


@router.delete("/file/{file_type}/{filename}")
async def delete_specific_file(file_type: str, filename: str) -> Dict[str, Any]:
    """특정 파일 삭제 (관리자 전용)"""
    try:
        if file_type not in ["pending", "completed", "failed"]:
            raise HTTPException(status_code=400, detail="file_type은 pending, completed, failed 중 하나여야 합니다.")
        
        file_service = FileFirstDataService()
        
        if file_type == "pending":
            directory = file_service.pending_dir
        elif file_type == "completed":
            directory = file_service.completed_dir
        else:  # failed
            directory = file_service.failed_dir
        
        file_path = directory / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # 백업 후 삭제
        backup_path = file_service.backup_dir / f"deleted_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        import shutil
        shutil.copy2(file_path, backup_path)
        
        file_path.unlink()
        
        print(f"🗑️ [파일삭제] 관리자가 파일 삭제: {filename} (백업: {backup_path.name})")
        
        return {
            "success": True,
            "message": f"파일이 삭제되었습니다. 백업: {backup_path.name}",
            "deleted_file": filename,
            "backup_file": backup_path.name,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 삭제 실패: {str(e)}")


@router.get("/health-check")
async def health_check() -> Dict[str, Any]:
    """파일 시스템 헬스 체크"""
    try:
        file_service = FileFirstDataService()
        
        # 디렉토리 접근 가능 여부 확인
        directories_ok = True
        directory_status = {}
        
        for name, directory in [
            ("pending", file_service.pending_dir),
            ("completed", file_service.completed_dir),
            ("failed", file_service.failed_dir),
            ("backup", file_service.backup_dir)
        ]:
            try:
                # 디렉토리 존재 및 쓰기 권한 확인
                directory.mkdir(exist_ok=True)
                test_file = directory / "health_check_test.tmp"
                test_file.write_text("test")
                test_file.unlink()
                
                directory_status[name] = {
                    "status": "ok",
                    "path": str(directory),
                    "exists": True,
                    "writable": True
                }
            except Exception as e:
                directories_ok = False
                directory_status[name] = {
                    "status": "error",
                    "path": str(directory),
                    "error": str(e)
                }
        
        # 프로세서 상태
        processor_ok = file_processor.is_running
        
        # 전체 헬스 상태
        overall_health = "healthy" if directories_ok and processor_ok else "unhealthy"
        
        return {
            "success": True,
            "health_status": overall_health,
            "timestamp": datetime.now().isoformat(),
            "checks": {
                "directories": {
                    "status": "ok" if directories_ok else "error",
                    "details": directory_status
                },
                "processor": {
                    "status": "ok" if processor_ok else "error",
                    "running": processor_ok
                }
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "health_status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

