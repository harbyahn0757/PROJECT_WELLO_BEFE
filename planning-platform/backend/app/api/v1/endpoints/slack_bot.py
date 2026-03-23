"""
Slack 챗봇 엔드포인트

Slack Events API를 수신하고 Claude Code CLI로 응답하는 봇입니다.
서버 상태 조회, 모니터링 명령도 처리합니다.
"""

import asyncio
import logging
import re
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks

from ....core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# 중복 이벤트 방지 (Slack은 3초 내 응답 없으면 재전송함)
_processed_events: Dict[str, float] = {}


async def call_claude(prompt: str, timeout: int = 60) -> str:
    """Claude Code CLI를 호출하여 응답을 받습니다."""
    try:
        # PM2 환경에서 node v16이 PATH 앞에 있어 호환 문제 발생
        # node v18+ 경로를 우선시하도록 PATH 오버라이드
        import os
        env = os.environ.copy()
        env["PATH"] = "/usr/local/bin:" + env.get("PATH", "")

        import shlex
        proc = await asyncio.create_subprocess_shell(
            f'/usr/local/bin/node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js -p {shlex.quote(prompt)}',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/home/welno/workspace/PROJECT_WELNO_BEFE",
            env=env,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        response = stdout.decode("utf-8").strip()

        if not response and stderr:
            err = stderr.decode("utf-8").strip()
            logger.warning(f"[SlackBot] Claude stderr: {err[:200]}")
            return f"Claude 응답 오류: {err[:200]}"

        # Slack 메시지 길이 제한 (4000자)
        if len(response) > 3900:
            response = response[:3900] + "\n...(응답이 잘렸습니다)"

        return response or "응답을 생성하지 못했습니다."

    except asyncio.TimeoutError:
        return "Claude 응답 시간이 초과되었습니다. (60초)"
    except FileNotFoundError:
        return "Claude CLI가 설치되어 있지 않습니다."
    except Exception as e:
        logger.error(f"[SlackBot] Claude 호출 실패: {e}")
        return f"Claude 호출 오류: {str(e)[:200]}"


async def post_slack_message(channel: str, text: str, thread_ts: Optional[str] = None):
    """Slack에 메시지 전송 (Bot Token 사용)"""
    if not settings.slack_bot_token:
        logger.warning("[SlackBot] Bot token 미설정, 메시지 전송 불가")
        return False

    payload: Dict[str, Any] = {
        "channel": channel,
        "text": text,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://slack.com/api/chat.postMessage",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.slack_bot_token}",
                    "Content-Type": "application/json",
                },
            )
            data = resp.json()
            if data.get("ok"):
                logger.info(f"[SlackBot] 메시지 전송 성공: channel={channel}")
                return True
            else:
                logger.error(f"[SlackBot] 메시지 전송 실패: {data.get('error')}")
                return False
    except Exception as e:
        logger.error(f"[SlackBot] 메시지 전송 에러: {e}")
        return False


async def handle_special_command(text: str) -> Optional[str]:
    """특수 명령어 처리"""
    text_lower = text.strip().lower()

    if text_lower in ("서버상태", "status", "서버 상태", "모니터링"):
        try:
            from ....services.monitoring_service import get_monitoring_service
            from ....services.slack_service import get_slack_service

            slack_svc = None
            if settings.slack_enabled and settings.slack_webhook_url:
                slack_svc = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)

            monitor = get_monitoring_service(slack_svc)
            status = await monitor.get_full_status()

            pm2_info = ""
            if status.get("pm2", {}).get("processes"):
                for name, info in status["pm2"]["processes"].items():
                    mem_mb = round(info.get("memory", 0) / (1024 * 1024), 1)
                    pm2_info += f"  • {name}: {info['status']} (CPU: {info['cpu']}%, MEM: {mem_mb}MB, 재시작: {info['restarts']}회)\n"
            else:
                pm2_info = "  PM2 정보 없음\n"

            sys_info = status.get("system", {})
            api_info = status.get("api", {})

            return (
                f"🖥️ *서버 모니터링 현황*\n\n"
                f"*PM2 프로세스:*\n{pm2_info}\n"
                f"*시스템 리소스:*\n"
                f"  • CPU: {sys_info.get('cpu_percent', 'N/A')}%\n"
                f"  • 메모리: {sys_info.get('memory_percent', 'N/A')}% ({sys_info.get('memory_used_gb', '?')}GB / {sys_info.get('memory_total_gb', '?')}GB)\n"
                f"  • 디스크: {sys_info.get('disk_percent', 'N/A')}% ({sys_info.get('disk_used_gb', '?')}GB / {sys_info.get('disk_total_gb', '?')}GB)\n\n"
                f"*API 상태:* {api_info.get('status', 'unknown')}"
                + (f" ({api_info.get('response_time_ms', 0):.0f}ms)" if api_info.get("response_time_ms") else "")
            )
        except Exception as e:
            return f"서버 상태 조회 실패: {e}"

    if text_lower in ("헬프", "help", "도움말", "명령어"):
        return (
            "🤖 *MediArC Bot (Claude Code)*\n\n"
            "• `서버상태` / `status` - 서버 모니터링 현황\n"
            "• `헬프` / `help` - 이 도움말\n"
            "• 그 외 자유롭게 질문하세요 - Claude가 답변합니다"
        )

    return None


async def process_message(text: str, channel: str, thread_ts: Optional[str], user: str):
    """백그라운드에서 메시지 처리 (Slack 3초 타임아웃 우회)"""
    # 특수 명령어 확인
    special_response = await handle_special_command(text)
    if special_response:
        await post_slack_message(channel, special_response, thread_ts)
        return

    # Claude Code로 응답 생성
    logger.info(f"[SlackBot] Claude 호출 시작: user={user}, text={text[:50]}")
    response = await call_claude(text)
    await post_slack_message(channel, response, thread_ts)


@router.post("/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    """
    Slack Events API 수신 엔드포인트

    1. URL 검증 (challenge)
    2. 메시지 이벤트 → 백그라운드에서 Claude Code 호출 → 응답
    """
    body = await request.json()

    # URL 검증 (Slack 앱 설정 시 필수)
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # 이벤트 처리
    event = body.get("event", {})
    event_type = event.get("type")
    event_id = body.get("event_id", "")

    # 중복 이벤트 방지
    import time
    now = time.time()
    if event_id in _processed_events:
        return {"ok": True}
    _processed_events[event_id] = now
    # 오래된 이벤트 ID 정리 (5분 이상)
    for eid in list(_processed_events.keys()):
        if now - _processed_events[eid] > 300:
            del _processed_events[eid]

    # 봇 자신의 메시지는 무시
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return {"ok": True}

    if event_type in ("message", "app_mention"):
        text = event.get("text", "").strip()
        channel = event.get("channel", "")
        thread_ts = event.get("thread_ts") or event.get("ts")
        user = event.get("user", "")

        if not text:
            return {"ok": True}

        # app_mention인 경우 봇 멘션 태그 제거
        if event_type == "app_mention":
            text = re.sub(r"<@[A-Z0-9]+>\s*", "", text).strip()

        # 백그라운드에서 처리 (Slack 3초 타임아웃 내에 즉시 200 응답)
        background_tasks.add_task(process_message, text, channel, thread_ts, user)

    return {"ok": True}


@router.get("/status")
async def slack_bot_status():
    """Slack 봇 설정 상태 확인"""
    return {
        "slack_enabled": settings.slack_enabled,
        "webhook_configured": bool(settings.slack_webhook_url),
        "bot_token_configured": bool(settings.slack_bot_token),
        "channel": settings.slack_channel,
        "channel_id": settings.slack_channel_id,
        "ai_engine": "Claude Code CLI",
    }
