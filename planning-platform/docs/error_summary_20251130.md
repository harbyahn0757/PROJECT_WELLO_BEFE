# 에러 정리 보고서 (2025-11-30)

## 📋 에러 현황 요약

### ✅ 해결된 에러

#### 1. **Invalid format specifier 에러** (21:51:05, 21:52:56)
- **원인**: f-string 내부 JSON 예시에서 중괄호 이스케이프 누락
- **위치**: `checkup_design_prompt.py` 433, 560, 566번 라인
- **해결**: `{patient_name}` → `{{patient_name}}`, JSON 예시 중괄호 이스케이프
- **상태**: ✅ 완전 해결

#### 2. **테이블 없음 에러** (21:55:30)
- **원인**: `wello.wello_checkup_design_requests` 테이블이 데이터베이스에 없음
- **위치**: `wello_data_service.py` 1203번 라인
- **해결**: `create_checkup_design_table.sql` 스크립트 실행
- **상태**: ✅ 완전 해결 (테이블 생성 완료 확인)

---

### ⚠️ 비치명적 에러 (폴백 메커니즘 작동)

#### 3. **Perplexity API 401 Unauthorized** (21:54:36)
- **원인**: Perplexity API 키 인증 실패 (만료 또는 유효하지 않음)
- **위치**: `perplexity_service.py` API 호출
- **영향**: 없음 (자동으로 OpenAI로 폴백)
- **조치**: 필요 시 Perplexity API 키 갱신 (긴급하지 않음)
- **상태**: ⚠️ 폴백으로 정상 동작 중

---

## 📊 에러 통계

| 구분 | 개수 | 상태 |
|------|------|------|
| 치명적 에러 (해결됨) | 2 | ✅ 해결 완료 |
| 비치명적 에러 (폴백 작동) | 1 | ⚠️ 정상 동작 중 |
| **총계** | **3** | **모두 처리됨** |

---

## 🔍 상세 에러 로그

### 에러 1: Invalid format specifier
```
2025-11-30 21:51:05 +09:00: ERROR:app.api.v1.endpoints.checkup_design:❌ [검진설계] 오류 발생: Invalid format specifier
2025-11-30 21:51:05 +09:00: ValueError: Invalid format specifier
```
**해결 방법**: f-string 내부 JSON 예시의 모든 중괄호를 `{{`와 `}}`로 이스케이프

### 에러 2: 테이블 없음
```
2025-11-30 21:55:30 +09:00: ❌ [검진설계요청] 저장 오류: relation "wello.wello_checkup_design_requests" does not exist
```
**해결 방법**: 
```sql
psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f create_checkup_design_table.sql
```
**확인**: 테이블 존재 확인 완료 (`EXISTS = true`)

### 에러 3: Perplexity API 401
```
2025-11-30 21:54:36 +09:00: ERROR:app.services.perplexity_service:❌ [Perplexity Service] HTTP 오류: HTTP 오류: 401
2025-11-30 21:54:36 +09:00: WARNING:app.api.v1.endpoints.checkup_design:⚠️ [검진설계] Perplexity API 호출 실패 - OpenAI로 폴백
```
**영향**: 없음 (OpenAI 폴백 성공, 검진 설계 정상 작동)

---

## ✅ 현재 시스템 상태

### 정상 작동 중인 기능
1. ✅ 프롬프트 생성 (12,240 문자)
2. ✅ OpenAI API 호출 (200 OK, 응답 수신 완료)
3. ✅ 검진 설계 결과 생성 (카테고리 1개 수신)
4. ✅ 데이터베이스 테이블 생성 완료

### 프롬프트 길이 분석
- **프롬프트 길이**: 12,240 문자
- **추정 토큰 수**: 약 22,032 토큰
- **GPT-4o-mini 컨텍스트**: 128,000 토큰 (사용률: 17.2%)
- **Perplexity 70B 컨텍스트**: 32,000 토큰 (사용률: 68.8%)
- **max_tokens 설정**: 3,000 토큰
- **총 필요 토큰**: 약 25,032 토큰
- **결론**: ✅ 프롬프트 길이는 문제없습니다!

---

## 🎯 다음 단계 (선택사항)

1. **Perplexity API 키 갱신** (선택사항)
   - 현재 OpenAI로 정상 동작 중이므로 긴급하지 않음
   - Perplexity는 citations(참고 자료) 제공에 유용하지만 필수는 아님

2. **에러 모니터링**
   - 최신 로그 확인: `tail -f /var/log/pm2/wello-be-error.log`
   - 정상 로그 확인: `tail -f /var/log/pm2/wello-be-out.log`

---

## 📝 수정된 파일

1. `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/services/checkup_design_prompt.py`
   - f-string 중괄호 이스케이프 수정

2. 데이터베이스 테이블 생성
   - `wello.wello_checkup_design_requests` 테이블 생성 완료

---

**최종 상태**: ✅ 모든 치명적 에러 해결 완료, 시스템 정상 동작 중

