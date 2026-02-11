# 파트너 RAG 채팅 튜닝 로그 테이블

**목적:** 파트너별·병원별 대화 수집 → 프롬프트/모델 튜닝 및 품질 분석  
**테이블:** `welno.tb_partner_rag_chat_tuning_log`  
**마이그레이션:** `planning-platform/backend/migrations/add_partner_rag_chat_tuning_log.sql`

---

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGSERIAL | PK |
| `partner_id` | VARCHAR(50) | 파트너 ID (medilinx, kindhabit 등) |
| `hospital_id` | VARCHAR(255) | 병원/클리닉 ID (파트너별 식별자) |
| `user_uuid` | VARCHAR(128) | 사용자 UUID (파트너 제공) |
| `session_id` | VARCHAR(255) | 채팅 세션 ID (유니크 per partner) |
| `client_info` | JSONB | 사용자 클라이언트 정보 (client_ip, referer 등, 개인정보 최소화) |
| `initial_data` | JSONB | 웜업 시 처음 받은 데이터 요약 (검진/환자 정보 요약) |
| `conversation` | JSONB | 대화 내용 배열 `[{role, content, ts}, ...]` |
| `message_count` | INTEGER | 총 메시지 수 (user+assistant 쌍) |
| `created_at` | TIMESTAMPTZ | 첫 기록 시각 |
| `updated_at` | TIMESTAMPTZ | 마지막 업데이트 시각 |

---

## JSONB 구조 예시

### client_info
```json
{
  "client_ip": "210.218.238.194",
  "referer": "http://localhost:9000/"
}
```

### initial_data (웜업 시 받은 데이터 요약)
```json
{
  "has_health_data": true,
  "health_summary_length": 500,
  "patient_info_keys": ["name", "birthdate"]
}
```

### conversation
```json
[
  { "role": "user", "content": "내 상태 어떠니?", "ts": "2026-02-09T10:17:19+09:00" },
  { "role": "assistant", "content": "검진 결과를 바탕으로 보면...", "ts": "2026-02-09T10:17:31+09:00" },
  { "role": "user", "content": "문제가 있다는거야 없다는거야?", "ts": "2026-02-09T10:20:00+09:00" },
  { "role": "assistant", "content": "위험한 수치는 아니에요...", "ts": "2026-02-09T10:20:08+09:00" }
]
```

---

## 서비스 연동 (구현 시)

1. **웜업 시:**  
   - `session_id` 기준으로 레코드 없으면 INSERT (partner_id, hospital_id, user_uuid, session_id, client_info, initial_data, conversation='[]', message_count=0).  
   - 있으면 initial_data만 선택적으로 UPDATE (최초 1회만 저장).

2. **메시지/답변 시:**  
   - 해당 `session_id` 레코드를 조회 후, `conversation` 배열에 `{role: "user", content, ts}` 및 `{role: "assistant", content, ts}` append.  
   - `message_count` +1 (또는 conversation.length/2).  
   - `updated_at`은 트리거로 자동.

3. **저장 위치 후보:**  
   - `PartnerRagChatService.handle_partner_warmup()` → initial_data 저장.  
   - `PartnerRagChatService.handle_partner_message_stream()` 내부에서 스트리밍 완료 후 최종 답변 모아서 conversation append.

4. **개인정보:**  
   - client_info는 IP·referer만 저장하고, initial_data는 본문 대신 요약/키 목록 위주로 저장 권장.

---

## 인덱스

- `(partner_id, session_id)` UNIQUE  
- `(partner_id, hospital_id)`  
- `created_at DESC`  
- `conversation` GIN (JSONB 검색 시)

---

## 마이그레이션 실행

```bash
psql -U <user> -d <db> -f planning-platform/backend/migrations/add_partner_rag_chat_tuning_log.sql
```

트리거에서 `EXECUTE FUNCTION` 문법이 DB 버전에 맞지 않으면 `EXECUTE PROCEDURE`로 변경 후 실행.
