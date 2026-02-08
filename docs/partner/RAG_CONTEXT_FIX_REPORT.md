# 파트너 RAG “쌩뚱맞은 맥락” 답변 원인 및 수정 보고

**생성일**: 2026-02-08  
**작업일자**: 2026-02-08  
**작업내용**: 파트너 RAG 쌩뚱맞은 맥락 답변 원인 분석 및 수정 보고  
**현상**: 파트너사 클라이언트 발화에 대해 “제공해주신 의학 지식 문서는…” 식의 **일반 의학 문서 요약**만 반환됨. 환자/검진 맥락과 무관한 4가지 핵심 포인트(영양표시, 스트레스·장건강, 저체중 교육, 건강 통계) 요약이 나옴.

---

## 1. 원인 분석

### 1.1 파트너 컨텍스트가 프롬프트에 전혀 반영되지 않음 (핵심)

- **흐름**
  - 파트너 메시지 수신 → `PartnerRagChatService._generate_partner_response_stream` 에서 `_build_partner_context()` 로 파트너 검진/환자 정보를 문자열로 만듦.
  - `_inject_partner_context_to_session()` 이 해당 문자열을 **Redis**에 저장함.  
    키: `welno:partner_rag:mapping:{session_id}:context` → (암호화된 키) → 실제 컨텍스트 문자열.
  - 그 다음 **공통** 스트리밍 로직인 `handle_user_message_stream()` 이 호출됨.

- **문제**
  - `handle_user_message_stream()` 은 **내부 웰노 DB**만 사용해 `briefing_context` 를 채움.  
    `welno_data_service.get_patient_health_data(uuid, hospital_id)` 로 검진/복약 데이터를 가져와서 briefing 을 만듦.
  - 파트너 세션의 `uuid` / `hospital_id` 는 내부 DB 에 없으므로 `briefing_context` 는 **항상 빈 문자열**.
  - **Redis 에 넣어둔 파트너 컨텍스트를 읽는 코드가 없었음.**  
    즉, 프롬프트의 `[Context]` 에는 **환자/검진 정보가 전혀 들어가지 않고**, RAG 로 검색된 “의학 지식 문서”만 들어감.

- **결과**
  - `combined_context = briefing_context + past_survey_info + "[의학 지식 문서]\n" + context_str`  
    → `briefing_context == ""` 이므로 **의학 지식 문서만** 모델에 전달됨.
  - 사용자 질문이 짧은 인사/단문이면, 모델이 “문서 요약”으로 해석해 “제공해주신 의학 지식 문서는 … 4가지 핵심 포인트로 정리해 드립니다” 식의 답변이 나옴.

### 1.2 인사/짧은 발화에 대한 지침 부재

- “안녕”, “하이” 등 짧은 인사만 올 때, **참고 문헌을 요약·나열하지 말고** 인사 + “무엇을 도와드릴지” 물어보라는 **명시적 지침**이 없었음.
- 문서만 컨텍스트로 들어가 있는 상태에서 짧은 질문이 오면, 모델이 문서 요약을 생성하는 경향이 있음.

---

## 2. 수정 사항

### 2.1 파트너 컨텍스트를 스트림 처리에서 실제로 사용 (welno_rag_chat_service.py)

- **첫 메시지**
  - 내부 DB 로부터 `briefing_context` 를 채운 뒤에도 **비어 있으면** Redis 에서 파트너 컨텍스트를 조회:
    - `welno:partner_rag:mapping:{session_id}:context` 로 매핑 키 조회 → 저장된 context 키로 실제 문자열 조회.
  - 조회된 문자열을 `[파트너 제공 검진/환자 정보]` 로 감싸 `briefing_context` 로 사용.
  - 동일 내용을 `welno:rag_chat:data_summary:{uuid}:{hospital_id}:{session_id}` 에 저장해 **이후 메시지**에서도 사용하도록 함.

- **이후 메시지**
  - 기존대로 `data_summary` 를 Redis 에서 읽음.
  - `data_summary` 가 비어 있을 때만, 같은 방식으로 `welno:partner_rag:mapping:{session_id}:context` 에서 파트너 컨텍스트를 읽어 `data_summary` 를 보강.

이제 파트너 세션에서는 **접속·수신 인자(uuid, hospital_id, session_id)** 와 함께 **Redis 에 주입된 파트너 검진/환자 정보**가 프롬프트에 항상 포함됨.

### 2.2 인사/짧은 발화 시 “문서 요약 금지” 지침 추가 (welno_rag_chat_service.py)

- 첫 메시지 처리 시, 사용자 메시지가 **인사 또는 극히 짧은 말**인지 판별:
  - 예: `안녕`, `하이`, `안녕하세요`, `hello`, `hi`, 길이 4자 이하 등.
- 해당할 경우 **stage_instruction** 에 다음을 추가:
  - “사용자가 인사나 짧은 말만 한 경우, **참고 문헌을 요약·나열하지 말고**, 친절히 인사한 뒤 **이 환자의 검진/건강 관련해 무엇을 도와드릴지** 짧게 물어보세요.”

이로써 “쌩뚱맞게” 의학 문서만 요약하는 응답을 줄일 수 있음.

---

## 3. 접속·인자·주고받은 데이터 (점검 포인트)

- **접속**: 파트너 메시지 API `POST /welno-api/v1/rag-chat/partner/message`, 헤더 `X-API-Key`, body: `uuid`, `hospital_id`, `message`, `session_id`, (선택) `health_data`.
- **받은 인자**: 위 body + warmup 시 발급된 `session_id` 사용 시, 동일 세션에서 주입된 파트너 컨텍스트가 Redis 에 있음.
- **주고받은 것**:  
  - 클라이언트 → 서버: `message` (사용자 발화).  
  - 서버 → 클라이언트: SSE 스트림 `data: {"answer": "...", "done": ...}`.
- **뒷단 맥락**:  
  - **수정 전**: 프롬프트에 파트너 검진/환자 정보 없음 → 의학 지식 문서만 포함 → 문서 요약형 답변.  
  - **수정 후**: Redis 파트너 컨텍스트를 로드해 `briefing_context` / `data_summary` 에 넣음 → 프롬프트에 “파트너 제공 검진/환자 정보” 포함 → 환자 맥락에 맞는 상담형 답변 가능.

---

## 4. 프롬프트/변수 정상 여부 점검

- **CHAT_SYSTEM_PROMPT** (rag_service.py): “[Context]에 없는 정보는 생성하지 마세요”, “사용자 질문에 직접 답변” 등 기존대로 유효.
- **combined_context** 구성:  
  `briefing_context`(이제 파트너 세션에서 Redis 로 채움) + `past_survey_info` + `[의학 지식 문서 (참고 문헌)]` + RAG 검색 결과 `context_str`.
- **query_str**: 사용자 `message` 그대로 사용.
- **trace_data**: `final_prompt`, `enhanced_context`, `timings` 등으로 로그/추적 가능.  
  로그에서 `✅ [파트너 컨텍스트] Redis에서 로드` 가 찍히면 파트너 컨텍스트가 실제로 사용된 것임.

---

## 5. 검증 방법

1. **파트너 위젯**에서 동일 계정으로 **warmup 후** 첫 메시지로 “안녕” 또는 “검진 결과 알려줘” 전송.
2. **기대**:  
   - “(환자명)님, 안녕하세요. 검진 결과에 대해 궁금한 점이 있으시면 말씀해 주세요.” 식의 **짧은 인사 + 도움 제안**.  
   - “제공해주신 의학 지식 문서는 … 4가지 핵심 포인트로 정리해 드립니다” 같은 **문서 요약**은 나오지 않음.
3. **백엔드 로그** 확인:  
   - `✅ [파트너 컨텍스트] Redis에서 로드: N자`  
   - `briefing_context 포함: yes, 길이: N자`  
   - (선택) `trace_*.json` 에 `enhanced_context`, `final_prompt` 확인.

---

*수정 파일: `planning-platform/backend/app/services/welno_rag_chat_service.py`*
