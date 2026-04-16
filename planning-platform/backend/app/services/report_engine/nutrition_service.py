"""
nutrition_service.py — 건기식 RAG 맞춤 추천 서비스 (Phase 1)

4-step 파이프라인:
  Step 1: nutrition_rules.recommend_candidates() → 후보 8-12종
  Step 2: FAISS RAG 에비던스 조회
  Step 3: 약물 상호작용 체크 (Phase 1: medications=[] → 스킵)
  Step 4: GPT-4o-mini 스토리텔링 → 개인화 설명

facade.py (동기)에서 recommend_sync()로 호출.
"""

import asyncio
import concurrent.futures
import hashlib
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GPT 시스템 프롬프트 (스펙 섹션 3-1)
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """당신은 건강검진 결과를 일반인에게 친근하게 설명하는 영양 가이드입니다.

절대 규칙:
1. 의학적 진단/소견을 내리지 않습니다. "~질환입니다", "~병이 있습니다" 금지.
2. 가이드라인 표현만 사용합니다. "~할 수 있어요", "~에 도움이 돼요"
3. 출처를 한 줄로 첨부합니다.
4. 공포 마케팅 금지. "이걸 안 먹으면 위험합니다" 같은 표현 사용하지 않습니다.
5. 중학생도 이해할 수 있는 쉬운 말로 설명합니다."""

_RECOMMEND_TMPL = """환자 이름: {name}
환자 검진 수치: SBP={sbp}, LDL={ldl}, FBG={fbg}, BMI={bmi}, ALT={alt}
추천 영양소: {nutrient_name}
추천 태그: {tag}
추천 사유 (룰): {rule_reason}
에비던스 요약: {evidence_summary}

위 정보로 환자에게 보여줄 추천 설명을 작성해주세요.
형식: 1-2문장, 80자 이내, "~예요"/"~해요" 친근한 톤, 환자 수치 구체 언급, 의학적 진단 금지."""

_CAUTION_TMPL = """환자 이름: {name}
환자 검진 수치: {relevant_values}
주의 영양소: {nutrient_name}
주의 사유: {caution_reason}
에비던스: {evidence_summary}

위 정보로 환자에게 보여줄 주의사항 설명을 작성해주세요.
형식: 1문장, 60자 이내, "~할 수 있어요" 톤, 공포 유발 금지."""


# ---------------------------------------------------------------------------
# 캐시 키 생성 (스펙 섹션 3-5)
# ---------------------------------------------------------------------------
def _story_cache_key(nutrient: str, patient: dict) -> str:
    sbp_bin = (int(patient.get("SBP", 0) or 0) // 10) * 10
    fbg_bin = (int(patient.get("FBG", 0) or 0) // 10) * 10
    bmi_bin = round(float(patient.get("BMI", 0) or 0))
    alt_bin = (int(patient.get("ALT", 0) or 0) // 10) * 10
    raw = f"nutrition_story:{nutrient}:{sbp_bin}:{fbg_bin}:{bmi_bin}:{alt_bin}"
    return hashlib.md5(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# NutritionService
# ---------------------------------------------------------------------------
class NutritionService:
    """건기식 RAG 맞춤 추천 서비스."""

    def __init__(self) -> None:
        self._faiss_vs = None   # FAISSVectorSearch (lazy init)
        self._openai = None     # openai.AsyncOpenAI (lazy init)
        self._story_cache: dict[str, str] = {}   # 메모리 캐시 (TTL 미구현, 재시작 시 초기화)

    # ------------------------------------------------------------------
    # lazy FAISS 초기화
    # ------------------------------------------------------------------
    def _get_faiss(self):
        if self._faiss_vs is not None:
            return self._faiss_vs
        try:
            from app.services.checkup_design.vector_search import FAISSVectorSearch
            from app.core.config import settings
            faiss_dir = "/data/vector_db/welno/faiss_db"
            self._faiss_vs = FAISSVectorSearch(
                faiss_dir=faiss_dir,
                openai_api_key=settings.openai_api_key,
            )
        except Exception as e:
            logger.warning("nutrition_service: FAISS 초기화 실패 — %s (폴백 모드)", e)
            self._faiss_vs = None
        return self._faiss_vs

    # ------------------------------------------------------------------
    # lazy OpenAI 초기화
    # ------------------------------------------------------------------
    def _get_openai(self):
        if self._openai is not None:
            return self._openai
        try:
            import openai
            from app.core.config import settings
            self._openai = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        except Exception as e:
            logger.warning("nutrition_service: OpenAI 초기화 실패 — %s", e)
            self._openai = None
        return self._openai

    # ------------------------------------------------------------------
    # Step 2: RAG 에비던스 조회
    # ------------------------------------------------------------------
    async def _fetch_rag_evidence(self, nutrient_name: str, rag_query: str) -> dict:
        """FAISS에서 에비던스 조회. 실패 시 빈 dict 반환."""
        vs = self._get_faiss()
        if vs is None:
            return {}
        try:
            results = vs.search(rag_query, top_k=3)
            if not results:
                return {}
            top = results[0]
            text = top.get("text", "")
            # 간단 파싱: source, dosage, timing 추출
            evidence: dict = {
                "source": "식약처 인정 기능성 원료",
                "type": "official",
                "detail": text[:200] if text else "",
            }
            # 식약처/가이드라인 타입 판별
            if "가이드라인" in text or "학회" in text:
                evidence["source"] = text.split("가이드라인")[0][-20:].strip() + " 가이드라인"
                evidence["type"] = "guideline"
            elif "연구" in text or "논문" in text:
                evidence["type"] = "research"
            dosage = None
            if "mg" in text or "g" in text:
                import re
                m = re.search(r"\d[\d,.\-~]+\s*(?:mg|g|mcg|IU)", text)
                if m:
                    dosage = {"amount": m.group(0), "timing": "식후", "duration": "3개월 이상"}
            if dosage:
                evidence["dosage"] = dosage
            return evidence
        except Exception as e:
            logger.warning("nutrition_service: RAG 검색 실패 (%s) — %s", nutrient_name, e)
            return {}

    # ------------------------------------------------------------------
    # Step 4: GPT 스토리텔링 (단건)
    # ------------------------------------------------------------------
    async def _gpt_story(
        self,
        prompt_text: str,
        fallback: str,
        cache_key: str,
    ) -> str:
        """GPT-4o-mini로 설명 생성. 캐시 히트 또는 실패 시 fallback 반환."""
        if cache_key in self._story_cache:
            return self._story_cache[cache_key]
        client = self._get_openai()
        if client is None:
            return fallback
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt_text},
                ],
                temperature=0.3,
                max_tokens=150,
            )
            text = resp.choices[0].message.content.strip()
            self._story_cache[cache_key] = text
            return text
        except Exception as e:
            logger.warning("nutrition_service: GPT 실패 — %s (폴백)", e)
            return fallback

    # ------------------------------------------------------------------
    # 핵심 recommend (async)
    # ------------------------------------------------------------------
    async def recommend(
        self,
        patient: dict,
        diseases: dict,
        name: str = "",
        medications: list[str] | None = None,
    ) -> dict:
        """
        4-step 파이프라인 실행.

        Args:
            patient:     검진 수치 딕셔너리 (ALT, SBP, BMI, cr, TC, LDL, FBG 등 대문자)
            diseases:    질환별 평가 결과 {질환명: {result, ...}}
            name:        환자 이름 (스토리텔링용)
            medications: 복용 약물 목록 (Phase 2 — 현재 무시)

        Returns:
            {"recommend": [...max 5], "caution": [...max 6], "meta": {...}}
        """
        if medications is None:
            medications = []
        t0 = time.time()

        # Step 1: 룰 엔진 → 후보 생성
        from .nutrition_rules import (
            recommend_candidates,
            caution_nutrients,
            RAG_QUERY_MAP,
            NUTRIENT_DESC,
        )
        candidates = recommend_candidates(patient, diseases)

        # Step 2: RAG 에비던스 배치 조회
        rag_hits = 0
        evidence_map: dict[str, dict] = {}
        tasks = []
        for cand in candidates[:12]:
            n = cand["name"]
            q = RAG_QUERY_MAP.get(n, f"{n} 건강기능식품 효능 용량 주의사항 식약처")
            tasks.append((n, q))

        if tasks:
            ev_results = await asyncio.gather(
                *[self._fetch_rag_evidence(n, q) for n, q in tasks],
                return_exceptions=True,
            )
            for (n, _), ev in zip(tasks, ev_results):
                if isinstance(ev, dict) and ev:
                    evidence_map[n] = ev
                    rag_hits += 1

        # Step 3: 약물 상호작용 (Phase 1: 스킵)
        # medications=[] → 경고 없음. Phase 2에서 FAISS "약물명+영양소+상호작용" 검색 구현.

        # 카테고리 상한 적용하여 상위 5종 선택
        from .nutrition_rules import _CATEGORY_LIMITS
        candidates.sort(key=lambda x: x["priority_score"], reverse=True)
        cat_count: dict[str, int] = {}
        selected_cands: list[dict] = []
        for c in candidates:
            cat = c["category"]
            limit = _CATEGORY_LIMITS.get(cat, 1)
            if cat_count.get(cat, 0) < limit:
                cat_count[cat] = cat_count.get(cat, 0) + 1
                selected_cands.append(c)
            if len(selected_cands) >= 5:
                break

        # Step 4: GPT 스토리텔링 (추천 5종 배치)
        sbp = patient.get("SBP", 0) or 0
        ldl = patient.get("LDL", 0) or 0
        fbg = patient.get("FBG", 0) or 0
        bmi = patient.get("BMI", 0) or 0
        alt = patient.get("ALT", 0) or 0
        display_name = name or "고객"

        recommend_list = []
        for i, cand in enumerate(selected_cands):
            n = cand["name"]
            ev = evidence_map.get(n, {})
            ev_summary = ev.get("detail", "") or str(NUTRIENT_DESC.get(n, ""))[:100]

            ck = _story_cache_key(n, patient)
            prompt = _RECOMMEND_TMPL.format(
                name=display_name,
                sbp=sbp, ldl=ldl, fbg=fbg, bmi=bmi, alt=alt,
                nutrient_name=n,
                tag=cand["tag"],
                rule_reason=cand.get("rule_reason", ""),
                evidence_summary=ev_summary[:200],
            )
            fallback_val = cand["desc"]
            desc = await self._gpt_story(prompt, fallback_val, ck)

            item: dict = {
                "name": n,
                "tag": cand["tag"],
                "desc": desc,
                "priority": i + 1,
            }
            # optional 필드 (하위 호환 — 없으면 FE 기존 렌더링 유지)
            if ev:
                item["evidence"] = {
                    "source": ev.get("source", "식약처 인정 기능성 원료"),
                    "type": ev.get("type", "official"),
                    "detail": ev.get("detail", ""),
                }
                if "dosage" in ev:
                    item["dosage"] = ev["dosage"]
            item["caution_text"] = None  # Phase 2에서 약물 상호작용 채움
            recommend_list.append(item)

        # caution 영양소 (GPT 스토리텔링 포함)
        caution_raw = caution_nutrients(patient, diseases)
        caution_list = []
        for j, c in enumerate(caution_raw):
            n = c["name"]
            rel_vals = f"SBP={sbp}, FBG={fbg}, ALT={alt}, cr={patient.get('creatinine', 0)}"
            ck = _story_cache_key(f"caution_{n}", patient)
            prompt = _CAUTION_TMPL.format(
                name=display_name,
                relevant_values=rel_vals,
                nutrient_name=n,
                caution_reason=c["tag"],
                evidence_summary=c.get("desc", "")[:100],
            )
            fallback_val = c["desc"]
            desc = await self._gpt_story(prompt, fallback_val, ck)
            caution_list.append({
                "name": n,
                "tag": c["tag"],
                "desc": desc,
                "priority": j + 1,
                "evidence": None,
            })

        latency_ms = int((time.time() - t0) * 1000)
        gpt_generated = bool(self._get_openai())

        return {
            "recommend": recommend_list,
            "caution": caution_list,
            "meta": {
                "pool_size": 28,
                "candidates": len(candidates),
                "rag_hits": rag_hits,
                "gpt_generated": gpt_generated,
                "cached": False,
                "latency_ms": latency_ms,
            },
        }

    # ------------------------------------------------------------------
    # sync wrapper (facade.py 호출용 — 동기 함수에서 async 실행)
    # ------------------------------------------------------------------
    def recommend_sync(
        self,
        patient: dict,
        diseases: dict,
        name: str = "",
        medications: Optional[list[str]] = None,
    ) -> dict:
        """facade.py (동기 함수)에서 호출하는 sync wrapper."""
        if medications is None:
            medications = []
        try:
            try:
                loop = asyncio.get_event_loop()
                is_running = loop.is_running()
            except RuntimeError:
                is_running = False

            if is_running:
                # 이미 이벤트 루프가 돌고 있으면 새 스레드에서 실행
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(
                        asyncio.run,
                        self.recommend(patient, diseases, name, medications),
                    )
                    return future.result(timeout=30)
            else:
                return loop.run_until_complete(
                    self.recommend(patient, diseases, name, medications)
                )
        except Exception as e:
            logger.warning("nutrition_service.recommend_sync 실패 — %s (기존 룰 폴백)", e)
            from .nutrition_rules import recommend_nutrients, caution_nutrients
            return {
                "recommend": recommend_nutrients(patient, diseases),
                "caution": caution_nutrients(patient, diseases),
                "meta": {"gpt_generated": False, "fallback": True, "error": str(e)},
            }
