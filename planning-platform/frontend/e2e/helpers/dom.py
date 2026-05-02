"""
DOM/localStorage 캡처 헬퍼.

분기 시그니처 검증용 (UUID/hospital_id 매트릭스 등).
storage.py 와 역할 분리: 이 파일은 read-only 캡처, storage.py 는 set/clear.
"""

from typing import Dict, List

from playwright.sync_api import Page


def get_local_storage(page: Page) -> Dict[str, str]:
    """페이지의 localStorage 전체를 dict로 반환."""
    return page.evaluate("""
        () => {
            const r = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) r[k] = localStorage.getItem(k) || '';
            }
            return r;
        }
    """)


def get_button_texts(page: Page) -> List[str]:
    """모든 button 요소의 innerText 리스트."""
    return page.evaluate(
        "() => Array.from(document.querySelectorAll('button')).map(b => b.innerText)"
    )


def get_body_text(page: Page, limit: int = 1500) -> str:
    """body innerText (최대 limit 자)."""
    return page.evaluate(
        f"() => (document.body.innerText || '').slice(0, {limit})"
    )
