"""
실서버 케이스별 DOM 구조 풀 캡처.
시드 의존 케이스 (c1/c2/c3/c4/c8) + 시드 무관 케이스 (c6/c7) 모두.
assertion 후보 도출용.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("/tmp/welno_dom")
OUT.mkdir(exist_ok=True)
BASE = "https://welno.kindhabit.com"
PATH = "/campaigns/checkup-design"

CASES = [
    ("c1", "?uuid=test-e2e-c1-uuid&hospital=TEST_E2E"),
    ("c2", "?uuid=test-e2e-c2-uuid&hospital=TEST_E2E"),
    ("c3", "?uuid=test-e2e-c3-uuid"),
    ("c4", "?uuid=test-e2e-c4-NOTEXIST-uuid"),
    ("c5", "?hospital=TEST_E2E"),
    ("c6", "?hospital=PEERNINE"),
    ("c7", ""),
    ("c8", "?key=teste2e8"),
]


def capture(p, label, query):
    url = BASE + PATH + query
    ctx = p.chromium.launch(headless=True).new_context(
        viewport={"width": 390, "height": 844},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                   "AppleWebKit/605.1.15 KAKAOTALK 10.4.2",
    )
    page = ctx.new_page()
    out = {"label": label, "url": url}
    try:
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(3_000)
        out["url_final"] = page.url
        out["body_text"] = page.evaluate(
            "() => (document.body.innerText || '').slice(0, 1500)")
        # 주요 anchor selector 매칭 카운트
        out["selectors"] = page.evaluate("""
            () => ({
                landing: document.querySelectorAll('.landing').length,
                landing_title: document.querySelectorAll('.landing__title').length,
                landing_cta_primary: document.querySelectorAll('.landing__cta-primary').length,
                landing_hero: document.querySelectorAll('.landing__hero').length,
                landing_hospital: document.querySelectorAll('.landing__hospital').length,
                landing_greeting: document.querySelectorAll('.landing__greeting').length,
                auth_form: document.querySelectorAll('.auth-form-container').length,
                auth_title: document.querySelectorAll('.auth-form-title').length,
                auth_error: document.querySelectorAll('.auth-error-container').length,
                buttons: document.querySelectorAll('button').length,
                button_texts: Array.from(document.querySelectorAll('button')).map(b => b.innerText).slice(0, 10),
            })
        """)
        # localStorage 핵심 키
        out["localStorage"] = page.evaluate("""
            () => {
                const r = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.includes('welno') || k.includes('uuid') || k.includes('hospital'))) {
                        r[k] = (localStorage.getItem(k) || '').slice(0, 200);
                    }
                }
                return r;
            }
        """)
        page.screenshot(path=str(OUT / f"{label}.png"), full_page=True)
    except Exception as e:
        out["error"] = str(e)[:300]
    ctx.close()
    (OUT / f"{label}.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    return out


def main():
    with sync_playwright() as p:
        for label, q in CASES:
            print(f"\n=== {label} ({q or 'main'}) ===")
            r = capture(p, label, q)
            if "error" in r:
                print(f"  ! ERROR: {r['error']}")
                continue
            print(f"  url_final: {r['url_final'][:120]}")
            sels = r["selectors"]
            print(f"  selectors: landing={sels['landing']} cta={sels['landing_cta_primary']} "
                  f"title={sels['landing_title']} auth={sels['auth_form']} "
                  f"err={sels['auth_error']} buttons={sels['buttons']}")
            print(f"  button_texts: {sels['button_texts']}")
            print(f"  body[:300]: {r['body_text'][:300]!r}")
            print(f"  localStorage: {list(r['localStorage'].keys())}")


if __name__ == "__main__":
    main()
