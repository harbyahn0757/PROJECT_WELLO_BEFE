#!/usr/bin/env python3
"""
DOWNLOAD_ONLY 병원 정책 뱃지 — 데이터 상태 점검 스크립트
사용: python3 scripts/check_download_only.py
"""
import httpx
import psycopg2

DB = dict(host="10.0.1.10", port=5432, dbname="p9_mkt_biz", user="peernine")
ES = "http://localhost:9200"


def main():
    # 1) ES: DOWNLOAD_ONLY 병원 목록
    resp = httpx.post(f"{ES}/medilinx-logs-data/_search", json={
        "size": 0,
        "query": {"bool": {"must": [
            {"term": {"header.project.name": "med2-frontend-hana"}},
            {"match_phrase": {"data.message": "DOWNLOAD_ONLY"}},
        ]}},
        "aggs": {"by_hospital": {"terms": {"field": "data.user.hospital.id.keyword", "size": 1000}}},
    })
    dl_buckets = resp.json()["aggregations"]["by_hospital"]["buckets"]
    dl_hospitals = {b["key"] for b in dl_buckets}
    print(f"[ES] DOWNLOAD_ONLY 병원: {len(dl_hospitals)}개")

    # 2) DB: chat_log 병원 + rag_config
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT hospital_id FROM welno.tb_partner_rag_chat_log WHERE hospital_id IS NOT NULL")
    chat_hospitals = {r[0] for r in cur.fetchall()}
    print(f"[DB] chat_log 병원: {len(chat_hospitals)}개")

    cur.execute("SELECT hospital_id, hospital_name FROM welno.tb_hospital_rag_config WHERE is_active = true")
    rag_map = {r[0]: r[1] for r in cur.fetchall()}
    print(f"[DB] rag_config 병원: {len(rag_map)}개")

    # 3) 겹침 분석
    overlap_chat = dl_hospitals & chat_hospitals
    overlap_config = dl_hospitals & set(rag_map.keys())

    print(f"\n── 매칭 결과 ──")
    print(f"rag_config ∩ DOWNLOAD_ONLY: {len(overlap_config)}개 (등록됨)")
    print(f"chat_log   ∩ DOWNLOAD_ONLY: {len(overlap_chat)}개 (뱃지 표시 대상)")

    if overlap_chat:
        print("\n✅ 뱃지 표시 대상 병원:")
        for hid in overlap_chat:
            name = rag_map.get(hid, "(이름없음)")
            print(f"  {name} ({hid[:16]}...)")
    else:
        print("\n⚠️  현재 chat_log에 DOWNLOAD_ONLY 병원 이용 환자가 없어 뱃지 미표시")
        print("   → DOWNLOAD_ONLY 병원에서 RAG 채팅이 발생하면 자동 표시됩니다")

    if overlap_config:
        print(f"\n📋 rag_config에 등록된 DOWNLOAD_ONLY 병원 (채팅 대기 중):")
        for hid in sorted(overlap_config):
            print(f"  {rag_map[hid]}")

    conn.close()


if __name__ == "__main__":
    main()
