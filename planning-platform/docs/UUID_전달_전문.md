# UUID 전달 전문 - 질병예측 리포트 아이템 클릭 시

## 📍 시작 URL
```
http://127.0.0.1:9283/wello?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=KHW001
```

---

## 🔄 UUID 전달 경로

### 1단계: 프론트엔드에서 UUID 추출
```typescript
// MainPage.tsx (line 319-320)
const urlParams = new URLSearchParams(location.search);
const uuid = urlParams.get('uuid');  // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### 2단계: 파트너 인증 API 호출 시 전달

**API 엔드포인트:**
```
POST http://localhost:8000/api/partner-marketing/partner-auth
```

**요청 바디 (JSON):**
```json
{
  "api_key": "welno_5a9bb40b5108ecd8ef864658d5a2d5ab",
  "mkt_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // ← URL의 uuid가 여기로 전달됨
  "name": "환자이름",
  "birthday": "19810927",
  "redirect_url": "http://localhost:3012"
}
```

**코드 위치:**
```typescript
// MainPage.tsx (line 444-446)
if (uuid) {
  requestPayload.mkt_uuid = uuid;  // ← UUID를 mkt_uuid 키로 전달
}
```

---

## 📤 외부 서비스로 전달되는 최종 형태

### 백엔드 API가 리다이렉트하는 URL

**리다이렉트 URL 형식:**
```
{redirect_url}?uid={mkt_uuid}&page=event-fixed&token={session_token}&partner_id=welno&name={name}&birthday={birthday}
```

**실제 예시:**
```
http://localhost:3012/?uid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&page=event-fixed&token=xxx&partner_id=welno&name=안광수&birthday=19810927
```

**중요:** 
- 프론트엔드 → 백엔드 API: `mkt_uuid` 키로 전달
- 백엔드 API → 외부 캠페인 서비스: `uid` 키로 전달

---

## 📋 전체 전달 경로 요약

| 단계 | 위치 | 키 이름 | 값 | 설명 |
|------|------|---------|-----|------|
| 1 | URL 파라미터 | `uuid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | 시작 URL에서 추출 |
| 2 | 프론트엔드 코드 | `uuid` (변수명) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | `urlParams.get('uuid')` |
| 3 | API 요청 바디 | `mkt_uuid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | JSON 요청 바디의 키 |
| 4 | 백엔드 API 처리 | `mkt_uuid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | 백엔드에서 받아서 처리 |
| 5 | 리다이렉트 URL | `uid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | 외부 캠페인 서비스로 전달 |

---

## 🔍 실제 전달되는 전문 (JSON)

### 프론트엔드 → 백엔드 API 요청

**HTTP Request:**
```http
POST /api/partner-marketing/partner-auth HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "api_key": "welno_5a9bb40b5108ecd8ef864658d5a2d5ab",
  "mkt_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "안광수",
  "birthday": "19810927",
  "redirect_url": "http://localhost:3012"
}
```

### 백엔드 API → 외부 캠페인 서비스 리다이렉트

**HTTP Response (302 Redirect):**
```http
HTTP/1.1 302 Found
Location: http://localhost:3012/?uid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&page=event-fixed&token=xxx&partner_id=welno&name=안광수&birthday=19810927
```

---

## ⚠️ 키 이름 변경 사항

### 프론트엔드 → 백엔드
- **시작:** URL 파라미터 `uuid`
- **전달:** JSON 요청 바디 `mkt_uuid`

### 백엔드 → 외부 서비스
- **받음:** JSON 요청 바디 `mkt_uuid`
- **전달:** URL 파라미터 `uid`

**변경 이유:**
- 프론트엔드에서는 Wello의 `uuid` 사용
- 백엔드 API는 마케팅 시스템의 `mkt_uuid` 형식 사용
- 외부 캠페인 서비스는 `uid` 파라미터로 받음

---

## 📝 코드 참조

**파일:** `planning-platform/frontend/src/pages/MainPage.tsx`

**관련 코드:**
```typescript
// Line 319-320: UUID 추출
const urlParams = new URLSearchParams(location.search);
const uuid = urlParams.get('uuid');

// Line 444-446: mkt_uuid로 전달
if (uuid) {
  requestPayload.mkt_uuid = uuid;
}

// Line 461-468: API 호출
const response = await fetch(API_ENDPOINTS.PARTNER_AUTH, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestPayload),
  redirect: 'follow'
});
```

---

**작성일**: 2025-11-23
**확인 필요**: 백엔드 API가 실제로 `mkt_uuid`를 `uid`로 변환하여 리다이렉트하는지 확인 필요




