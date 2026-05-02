"""
c1/c2/c5 networkidle timeout 진단용 임시 스크립트.
요청/응답/콘솔/에러 풀 로그 캡처. 30s timeout. 종료 시 즉시 스크린샷.
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("/tmp/welno_diag")
OUT.mkdir(exist_ok=True)
BASE = "https://welno.kindhabit.com"
PATH = "/campaigns/checkup-design"

CASES = [
    ("c1", f"?uuid=test-e2e-c1-uuid&hospital=TEST_E2E"),
    ("c2", f"?uuid=test-e2e-c2-uuid&hospital=TEST_E2E"),
    ("c5", f"?hospital=TEST_E2E"),
    ("c6_control_PEERNINE", f"?hospital=PEERNINE"),  # 정상 케이스 비교용
]


def diag(p, label, query):
    url = BASE + PATH + query
    log = {"label": label, "url": url, "requests": [], "responses": [],
           "console": [], "pageerrors": [], "load_done": False, "elapsed": None}

    ctx = p.chromium.launch(headless=True).new_context(
        viewport={"width": 390, "height": 844},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                   "AppleWebKit/605.1.15 KAKAOTALK 10.4.2",
    )
    page = ctx.new_page()

    page.on("request", lambda r: log["requests"].append({
        "method": r.method, "url": r.url[:200], "rtype": r.resource_type
    }))
    page.on("response", lambda r: log["responses"].append({
        "status": r.status, "url": r.url[:200],
    }))
    page.on("console", lambda m: log["console"].append({
        "type": m.type, "text": m.text[:300]
    }))
    page.on("pageerror", lambda e: log["pageerrors"].append(str(e)[:300]))

    t0 = time.time()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=10_000)
        # domcontentloaded 후 25초 대기 — 그 안에 실 동작 다 보일 것
        page.wait_for_timeout(25_000)
        log["load_done"] = True
    except Exception as e:
        log["error"] = str(e)[:200]
    log["elapsed"] = round(time.time() - t0, 2)

    # 상태 캡처
    try:
        page.screenshot(path=str(OUT / f"{label}.png"), full_page=True)
        log["mounted"] = page.evaluate(
            "() => document.getElementById('root')?.children.length > 0")
        log["body_snippet"] = page.evaluate(
            "() => (document.body.innerText || '').slice(0, 400)")
        log["url_final"] = page.url
    except Exception as e:
        log["snap_error"] = str(e)[:200]

    ctx.close()

    # 응답 통계
    pending = len(log["requests"]) - len(log["responses"])
    statuses = {}
    for r in log["responses"]:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    log["pending_reqs"] = pending
    log["status_counts"] = statuses

    # 끝까지 응답 못 받은 요청 (응답 url set 만들고 차집합)
    resp_urls = {r["url"] for r in log["responses"]}
    log["unanswered_urls"] = [r["url"] for r in log["requests"]
                              if r["url"] not in resp_urls][:20]

    (OUT / f"{label}.json").write_text(json.dumps(log, ensure_ascii=False,
                                                  indent=2))
    return log


def main():
    with sync_playwright() as p:
        for label, q in CASES:
            print(f"\n=== {label} ===")
            log = diag(p, label, q)
            print(f"  url      : {log['url']}")
            print(f"  elapsed  : {log['elapsed']}s")
            print(f"  mounted  : {log.get('mounted')}")
            print(f"  reqs     : {len(log['requests'])} / resps : "
                  f"{len(log['responses'])} / pending : {log['pending_reqs']}")
            print(f"  statuses : {log['status_counts']}")
            print(f"  console  : {len(log['console'])} msgs / "
                  f"errors {sum(1 for c in log['console'] if c['type']=='error')}")
            print(f"  pageerr  : {len(log['pageerrors'])}")
            if log['unanswered_urls']:
                print(f"  UNANSWERED ({len(log['unanswered_urls'])}):")
                for u in log['unanswered_urls'][:5]:
                    print(f"    - {u}")
            if log['pageerrors']:
                print(f"  PAGE ERRORS:")
                for e in log['pageerrors'][:3]:
                    print(f"    ! {e}")

    print(f"\n로그/스크린샷: {OUT}/")


if __name__ == "__main__":
    main()
