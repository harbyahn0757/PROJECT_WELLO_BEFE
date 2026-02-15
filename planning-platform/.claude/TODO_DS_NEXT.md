# DS 파이프라인 — 향후 작업 (2026-02-15 기준)

## 완료된 Phase 0-3
- [x] 태깅 파이프라인 확장 (commercial_tags, buying_signal, conversion_flag 컬럼)
- [x] 분석 뷰 v_analysis_cross (상담+설문+검진 교차)
- [x] 기존 46건 retag 완료
- [x] 상담 확장뷰 리디자인 (상업태그/구매신호/게이지)
- [x] 서베이 today-summary + 카드 그리드
- [x] AnalyticsPage 대시보드 (차트 8종 + 드릴다운)

---

## 미구현 작업

### 1. conversion_flag API (난이도: 낮음)
- 위젯에서 추천 배너 클릭 → `POST /partner-office/conversion` → `conversion_flag=true` 업데이트
- 위젯(WelnoRagChatWidget.js)에 클릭 이벤트 전송 로직 추가 필요
- DB 컬럼은 이미 존재 (tb_chat_session_tags.conversion_flag BOOLEAN DEFAULT false)

### 2. action_taken CRM (난이도: 중)
- 병원이 "조치함" 기록하는 UI + DB 컬럼
- tb_chat_session_tags에 action_taken VARCHAR + action_note TEXT 추가
- 환자통합 상세패널에 "조치 기록" 버튼/폼 추가
- 선행: 병원용 백오피스 권한 분리

### 3. 전환 피드백 루프 (난이도: 중, 외부 연동)
- GA/파트너사(medilinx) 전환 데이터 → conversion_flag 자동 업데이트
- Webhook 또는 배치 연동
- 선행: 파트너사 API 스펙 확정

### 4. 사전 문진 템플릿 (난이도: 중)
- 검진 전 식습관/운동량/가족력 설문
- 기존 동적 설문 템플릿 기능 활용 가능
- 검진 결과와 교차 분석 → 개인화 상담 품질 향상

### 5. 자동 액션 추천 (난이도: 높음)
- "비만 클리닉 대상 50명 추출", "간질환 고위험군 알림" 등
- 세그먼트 정의 + 자동 알림 시스템
- 선행: 충분한 데이터 축적 (최소 500+ 세션)

### 6. 코호트 분석 (난이도: 높음)
- A/B 테스트, 세그먼트 비교, 시계열 추적
- 데이터 마트 구축 필요
- 선행: 데이터 볼륨 확보 + BI 도구 선정
