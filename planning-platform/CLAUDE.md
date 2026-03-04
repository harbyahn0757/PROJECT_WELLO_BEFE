# CLAUDE.md — WELNO 건강검진 관리 플랫폼

## 프로젝트 개요

**WELNO** — 건강검진 설계/관리/RAG 상담 플랫폼
- 문진 설문, AI 건강검진 설계 (Gemini + FAISS RAG), Tilko 건보공단 연동
- 파트너사(medilinx) RAG 채팅, 결제(Inicis), 질병예측 리포트(mediArc)

| 항목 | 값 |
|------|-----|
| 백엔드 | FastAPI 0.104.1 + uvicorn (Python 3.9+) |
| 프론트엔드 | React 19 + TypeScript + SCSS (CRA) |
| 백오피스 | React 18 + TypeScript (별도 SPA) |
| DB | PostgreSQL (10.0.1.10:5432, p9_mkt_biz) |
| 캐시 | Redis (10.0.1.10:6379/0) |
| AI | Gemini 3-flash-preview, OpenAI GPT-4o, FAISS |
| 결제 | Inicis (MID: COCkkhabit, 7,900원 고정) |
| 서버 | 10.0.1.6 (PM2 welno 유저) |

---

## 디렉토리 구조

```
planning-platform/
├── backend/              ← FastAPI 백엔드
│   ├── app/
│   │   ├── main.py               ← 엔트리포인트 (27개 라우터)
│   │   ├── core/                  ← config, database, security, payment_config
│   │   ├── api/v1/endpoints/      ← 27개 엔드포인트
│   │   ├── services/              ← 비즈니스 로직
│   │   │   ├── checkup_design/    ← AI 건강검진 설계 (FAISS RAG)
│   │   │   ├── mediarc/           ← mediArc 질병예측 연동
│   │   │   ├── campaigns/         ← 이메일 캠페인
│   │   │   └── sync/              ← medilinx ↔ welno 동기화
│   │   ├── models/                ← Pydantic 모델
│   │   ├── middleware/            ← auth, partner_auth
│   │   ├── data/                  ← redis_session, chat_session
│   │   ├── tasks/                 ← file_to_db_processor
│   │   └── utils/                 ← query_builders, security, partner
│   ├── config.env                 ← 환경변수
│   └── requirements.txt
├── frontend/             ← React 19 메인 앱 (:9282)
│   ├── src/
│   │   ├── components/            ← charts, checkup-design, search
│   │   ├── contexts/              ← WelnoUI, WelnoAuth, WelnoData
│   │   ├── layouts/               ← Intro, Vertical, Horizontal
│   │   ├── utils/                 ← healthData, categoryData
│   │   └── embed/                 ← WelnoSurveyWidget.js, WelnoRagChatWidget.js
│   └── package.json
├── backoffice/           ← React 18 관리 앱 (:9283)
│   ├── src/                       ← 27개 tsx/ts
│   └── package.json
└── docs/                 ← 100+ 설계/분석 문서
```

---

## 개발 명령어

```bash
# 백엔드
cd planning-platform/backend
uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload

# 프론트엔드 (개발)
cd planning-platform/frontend && npm start   # :9282

# 프론트엔드 (빌드 + 배포)
cd planning-platform/frontend && npm run deploy:simple

# 백오피스 (개발)
cd planning-platform/backoffice && npm start  # :9283

# 백오피스 (빌드)
cd planning-platform/backoffice && npm run build

# PM2 (서버에서, welno 유저)
sudo -u welno pm2 restart WELNO_BE
sudo -u welno pm2 logs WELNO_BE --lines 100 --nostream
```

---

## DB 접근

### 로컬 터널 (개발용)
```bash
# 터널 열기 (223 경유 → 10.0.1.10:5432)
ssh -f -N -L 5434:10.0.1.10:5432 root@223.130.142.105
# 접속
psql "postgresql://peernine:autumn3334%21@localhost:5434/p9_mkt_biz"
```

### 스키마 구조
- `welno` — 메인 (patients, hospitals, payments, surveys, rag_docs)
- `p9_mkt_biz` — 파트너/마케팅 (mdx_agr_list, tm_work_records, orders)
- `mediarc` — mediArc CS/알림
- `todayon_studio` — Todayon 스튜디오
- `public` — 레거시/테스트

---

## 서버 배포

### SSH 접근 경로
```
로컬 → 223.130.142.105 (root / dksrhkdtn!23)
     → 10.0.1.6 (root / P2*mh?MUJqRt)
```

### 배포 절차
```bash
# 1. 로컬에서 push
git push origin main

# 2. 서버에서 pull + restart
ssh root@223.130.142.105  # → ssh root@10.0.1.6
cd /home/welno/workspace/PROJECT_WELNO_BEFE
sudo -u welno git pull
sudo -u welno pm2 restart WELNO_BE
```

---

## Git 컨벤션

scope: `backend`, `frontend`, `backoffice`, `rag`, `payment`, `tilko`

---

## 알려진 이슈

1. **FAISS aretrieve 버그** — `vector_search.py` FAISSVectorSearch에 `aretrieve()` 없음 → 캐시 미생성
2. **결제 파이프라인 정체** — 98.8% READY/INIT 상태
3. **ES 설정 오류** — config.py `elasticsearch_url=localhost:9200` (1.6에 ES 없음)
4. **OOM 반복** — PM2 1G 제한, 78회 재시작

---

*v1.0 | 2026-03-04*
