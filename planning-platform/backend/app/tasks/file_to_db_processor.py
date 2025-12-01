"""
파일에서 DB로 데이터 처리하는 백그라운드 태스크
주기적으로 실행되어 pending 파일들을 DB에 저장
"""

import asyncio
import schedule
import time
from datetime import datetime, timedelta
from typing import Dict, Any
import threading

from app.services.file_first_data_service import FileFirstDataService


class FileToDbProcessor:
    """파일 → DB 처리 백그라운드 프로세서"""
    
    def __init__(self):
        self.file_service = FileFirstDataService()
        self.is_running = False
        self.stats = {
            "last_run": None,
            "total_processed": 0,
            "total_success": 0,
            "total_failed": 0,
            "last_batch_results": {}
        }
    
    async def process_pending_files(self) -> Dict[str, Any]:
        """pending 파일들을 DB에 처리"""
        try:
            # 먼저 상태 확인 - 처리할 파일이 없으면 조용히 리턴
            status = await self.file_service.get_status_summary()
            if status.get("pending_files", 0) == 0 and status.get("failed_files", 0) == 0:
                # 처리할 파일이 없으면 로그 없이 리턴
                return {
                    "success": True,
                    "results": {"success": 0, "failed": 0, "skipped": 0},
                    "retry_results": {"retry_success": 0, "retry_failed": 0, "max_retries_exceeded": 0},
                    "status": status,
                    "stats": self.stats
                }
            
            print(f"🔄 [배치처리] 파일 → DB 처리 시작: {datetime.now()}")
            
            # 1. pending 파일들 처리
            results = await self.file_service.process_pending_files_to_db(max_files=50)
            
            # 2. 실패한 파일들 재시도 (최대 3회)
            retry_results = await self.file_service.retry_failed_files(max_retries=3)
            
            # 3. 통계 업데이트
            self.stats["last_run"] = datetime.now().isoformat()
            self.stats["total_processed"] += results["success"] + results["failed"]
            self.stats["total_success"] += results["success"] + retry_results["retry_success"]
            self.stats["total_failed"] += results["failed"] + retry_results["retry_failed"]
            self.stats["last_batch_results"] = {
                "pending_processed": results,
                "retry_processed": retry_results,
                "timestamp": datetime.now().isoformat()
            }
            
            # 4. 상태 요약 (업데이트)
            status = await self.file_service.get_status_summary()
            
            # 실제로 처리한 파일이 있을 때만 완료 로그 출력
            total_processed = results["success"] + results["failed"] + retry_results["retry_success"] + retry_results["retry_failed"]
            if total_processed > 0:
                print(f"✅ [배치처리] 완료 - 성공: {results['success'] + retry_results['retry_success']}건, "
                      f"실패: {results['failed'] + retry_results['retry_failed']}건")
                print(f"📊 [배치처리] 현재 상태 - pending: {status['pending_files']}개, "
                      f"completed: {status['completed_files']}개, failed: {status['failed_files']}개")
            
            return {
                "success": True,
                "results": results,
                "retry_results": retry_results,
                "status": status,
                "stats": self.stats
            }
            
        except Exception as e:
            print(f"❌ [배치처리] 오류: {e}")
            return {
                "success": False,
                "error": str(e),
                "stats": self.stats
            }
    
    async def cleanup_old_files(self):
        """오래된 파일들 정리 (주 1회)"""
        try:
            print(f"🧹 [정리작업] 오래된 파일 정리 시작: {datetime.now()}")
            await self.file_service.cleanup_old_files(days_old=30)
            print(f"✅ [정리작업] 완료")
            
        except Exception as e:
            print(f"❌ [정리작업] 오류: {e}")
    
    def start_scheduler(self):
        """스케줄러 시작"""
        if self.is_running:
            print("⚠️ [스케줄러] 이미 실행 중입니다.")
            return
        
        print("🚀 [스케줄러] 파일 → DB 처리 스케줄러 시작")
        
        # 스케줄 설정
        schedule.every(2).minutes.do(self._run_async_task, self.process_pending_files)  # 2분마다 처리
        schedule.every().hour.at(":30").do(self._run_async_task, self.process_pending_files)  # 매시 30분에도 처리
        schedule.every().sunday.at("02:00").do(self._run_async_task, self.cleanup_old_files)  # 주일 새벽 2시 정리
        
        self.is_running = True
        
        # 별도 스레드에서 스케줄러 실행
        def run_scheduler():
            while self.is_running:
                schedule.run_pending()
                time.sleep(30)  # 30초마다 스케줄 확인
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        
        print("✅ [스케줄러] 시작 완료")
        print("   - 파일 처리: 2분마다 + 매시 30분")
        print("   - 파일 정리: 매주 일요일 새벽 2시")
    
    def stop_scheduler(self):
        """스케줄러 중지"""
        self.is_running = False
        schedule.clear()
        print("🛑 [스케줄러] 중지됨")
    
    def _run_async_task(self, async_func):
        """비동기 함수를 동기 스케줄러에서 실행"""
        try:
            # 새로운 이벤트 루프 생성하여 실행
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(async_func())
            loop.close()
        except Exception as e:
            print(f"❌ [스케줄러] 태스크 실행 오류: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """현재 통계 반환"""
        return self.stats.copy()


# 전역 프로세서 인스턴스
file_processor = FileToDbProcessor()


async def manual_process_files():
    """수동으로 파일 처리 실행 (API 엔드포인트용)"""
    return await file_processor.process_pending_files()


def start_file_processor():
    """파일 프로세서 시작 (앱 시작 시 호출)"""
    file_processor.start_scheduler()


def stop_file_processor():
    """파일 프로세서 중지 (앱 종료 시 호출)"""
    file_processor.stop_scheduler()


def get_processor_stats():
    """프로세서 통계 조회"""
    return file_processor.get_stats()

