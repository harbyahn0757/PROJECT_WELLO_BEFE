"""
서버 모니터링 서비스

PM2 프로세스 상태, 메모리 사용량, 에러율 등을 주기적으로 확인하고
이상 발생 시 Slack으로 알림을 전송합니다.
"""

import asyncio
import logging
import os
import subprocess
import json
import psutil
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from .slack_service import SlackService, SlackMessage, SlackAttachment, SlackField, SlackColor

logger = logging.getLogger(__name__)


class MonitoringService:
    """서버 모니터링 서비스"""

    def __init__(self, slack_service: Optional[SlackService] = None):
        self.slack_service = slack_service
        self._task: Optional[asyncio.Task] = None
        self._running = False
        # 알림 쿨다운 (같은 알림 반복 방지)
        self._last_alerts: Dict[str, datetime] = {}
        self._alert_cooldown = timedelta(minutes=10)
        # PM2 재시작 횟수 추적 (이전 값과 비교하여 증가 시에만 알림)
        self._last_restarts: Dict[str, int] = {}

    def _should_alert(self, alert_key: str) -> bool:
        """쿨다운 기간 내에 동일 알림을 보냈는지 확인"""
        now = datetime.now()
        last = self._last_alerts.get(alert_key)
        if last and (now - last) < self._alert_cooldown:
            return False
        self._last_alerts[alert_key] = now
        return True

    async def check_pm2_status(self) -> Dict[str, Any]:
        """PM2 프로세스 상태 확인"""
        try:
            result = subprocess.run(
                ["pm2", "jlist"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return {"status": "error", "message": "PM2 명령 실패"}

            processes = json.loads(result.stdout)
            status = {}
            for proc in processes:
                name = proc.get("name", "unknown")
                pm2_env = proc.get("pm2_env", {})
                status[name] = {
                    "status": pm2_env.get("status", "unknown"),
                    "cpu": proc.get("monit", {}).get("cpu", 0),
                    "memory": proc.get("monit", {}).get("memory", 0),
                    "restarts": pm2_env.get("restart_time", 0),
                    "uptime": pm2_env.get("pm_uptime", 0),
                }

                # 프로세스가 online이 아닌 경우 알림
                if pm2_env.get("status") != "online" and self._should_alert(f"pm2_{name}_down"):
                    await self._send_alert(
                        color=SlackColor.DANGER,
                        title=f"PM2 프로세스 다운: {name}",
                        fields=[
                            SlackField(title="프로세스", value=name, short=True),
                            SlackField(title="상태", value=pm2_env.get("status", "unknown"), short=True),
                            SlackField(title="재시작 횟수", value=str(pm2_env.get("restart_time", 0)), short=True),
                        ]
                    )

                # 재시작 횟수가 실제로 증가한 경우에만 알림
                restarts = pm2_env.get("restart_time", 0)
                prev_restarts = self._last_restarts.get(name, restarts)
                self._last_restarts[name] = restarts
                restart_delta = restarts - prev_restarts
                if restart_delta > 0 and self._should_alert(f"pm2_{name}_restarts"):
                    await self._send_alert(
                        color=SlackColor.WARNING,
                        title=f"PM2 재시작 감지: {name}",
                        fields=[
                            SlackField(title="프로세스", value=name, short=True),
                            SlackField(title="새 재시작", value=f"+{restart_delta}", short=True),
                            SlackField(title="누적 횟수", value=str(restarts), short=True),
                        ]
                    )

            return {"status": "ok", "processes": status}

        except subprocess.TimeoutExpired:
            return {"status": "error", "message": "PM2 명령 타임아웃"}
        except Exception as e:
            logger.error(f"PM2 상태 확인 실패: {e}")
            return {"status": "error", "message": str(e)}

    async def check_system_resources(self) -> Dict[str, Any]:
        """시스템 리소스 (CPU, 메모리, 디스크) 확인"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            result = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_used_gb": round(memory.used / (1024**3), 2),
                "memory_total_gb": round(memory.total / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_used_gb": round(disk.used / (1024**3), 2),
                "disk_total_gb": round(disk.total / (1024**3), 2),
            }

            # 메모리 90% 이상
            if memory.percent > 90 and self._should_alert("memory_high"):
                await self._send_alert(
                    color=SlackColor.DANGER,
                    title="메모리 사용량 경고",
                    fields=[
                        SlackField(title="사용률", value=f"{memory.percent}%", short=True),
                        SlackField(title="사용/전체", value=f"{result['memory_used_gb']}GB / {result['memory_total_gb']}GB", short=True),
                    ]
                )
            # 메모리 80% 이상
            elif memory.percent > 80 and self._should_alert("memory_warn"):
                await self._send_alert(
                    color=SlackColor.WARNING,
                    title="메모리 사용량 주의",
                    fields=[
                        SlackField(title="사용률", value=f"{memory.percent}%", short=True),
                        SlackField(title="사용/전체", value=f"{result['memory_used_gb']}GB / {result['memory_total_gb']}GB", short=True),
                    ]
                )

            # 디스크 90% 이상
            if disk.percent > 90 and self._should_alert("disk_high"):
                await self._send_alert(
                    color=SlackColor.DANGER,
                    title="디스크 용량 경고",
                    fields=[
                        SlackField(title="사용률", value=f"{disk.percent}%", short=True),
                        SlackField(title="사용/전체", value=f"{result['disk_used_gb']}GB / {result['disk_total_gb']}GB", short=True),
                    ]
                )

            # CPU 90% 이상
            if cpu_percent > 90 and self._should_alert("cpu_high"):
                await self._send_alert(
                    color=SlackColor.WARNING,
                    title="CPU 사용량 경고",
                    fields=[
                        SlackField(title="CPU", value=f"{cpu_percent}%", short=True),
                    ]
                )

            return result

        except Exception as e:
            logger.error(f"시스템 리소스 확인 실패: {e}")
            return {"status": "error", "message": str(e)}

    async def check_api_health(self) -> Dict[str, Any]:
        """API 헬스체크"""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("http://localhost:8082/api/v1/health/status")
                if resp.status_code == 200:
                    return {"status": "ok", "response_time_ms": resp.elapsed.total_seconds() * 1000}
                else:
                    if self._should_alert("api_unhealthy"):
                        await self._send_alert(
                            color=SlackColor.DANGER,
                            title="API 헬스체크 실패",
                            fields=[
                                SlackField(title="HTTP 상태", value=str(resp.status_code), short=True),
                            ]
                        )
                    return {"status": "error", "http_status": resp.status_code}
        except Exception as e:
            if self._should_alert("api_unreachable"):
                await self._send_alert(
                    color=SlackColor.DANGER,
                    title="API 서버 응답 없음",
                    fields=[
                        SlackField(title="에러", value=str(e)[:200], short=False),
                    ]
                )
            return {"status": "error", "message": str(e)}

    async def get_full_status(self) -> Dict[str, Any]:
        """전체 모니터링 상태 반환"""
        pm2 = await self.check_pm2_status()
        resources = await self.check_system_resources()
        api = await self.check_api_health()

        return {
            "timestamp": datetime.now().isoformat(),
            "pm2": pm2,
            "system": resources,
            "api": api,
        }

    async def _send_alert(self, color: SlackColor, title: str, fields: list):
        """Slack 알림 전송"""
        if not self.slack_service:
            logger.warning(f"[모니터링] Slack 미설정, 알림 건너뜀: {title}")
            return

        message = SlackMessage(
            channel=self.slack_service.channel_id,
            text=f"🖥️ {title}",
            attachments=[
                SlackAttachment(
                    color=color,
                    fields=fields,
                    footer="WELNO 서버 모니터링",
                    ts=int(datetime.now().timestamp())
                )
            ]
        )
        await self.slack_service._send_message(message)

    async def _monitoring_loop(self, interval_seconds: int = 300):
        """모니터링 루프 (기본 5분 간격)"""
        logger.info(f"[모니터링] 주기적 모니터링 시작 ({interval_seconds}초 간격)")
        while self._running:
            try:
                await self.check_pm2_status()
                await self.check_system_resources()
                # API 헬스체크는 자기 자신 호출이므로 루프에서는 생략
            except Exception as e:
                logger.error(f"[모니터링] 체크 실패: {e}")
            await asyncio.sleep(interval_seconds)

    async def start(self, interval_seconds: int = 300):
        """모니터링 시작"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._monitoring_loop(interval_seconds))
        logger.info("[모니터링] 서비스 시작됨")

    async def stop(self):
        """모니터링 중지"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[모니터링] 서비스 중지됨")


# 싱글톤
_monitoring_instance: Optional[MonitoringService] = None

def get_monitoring_service(slack_service: Optional[SlackService] = None) -> MonitoringService:
    """모니터링 서비스 싱글톤 인스턴스 반환"""
    global _monitoring_instance
    if _monitoring_instance is None:
        _monitoring_instance = MonitoringService(slack_service)
    return _monitoring_instance
