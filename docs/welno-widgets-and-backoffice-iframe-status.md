# 웰노 위젯 및 백오피스 iframe 제공 현황 점검

## 1. 웰노 제공 위젯 개요 (총 2종)

| 구분 | 위젯명 | 제공 형태 | 용도 |
|------|--------|-----------|------|
| 1 | **RAG 채팅 위젯** | 스크립트 임베드 (Vanilla JS) | 파트너 사이트에 채팅 버튼/창 삽입, AI 건강 상담 |
| 2 | **백오피스/플래닝 페이지** | iframe URL 임베드 | 검진결과 상담·만족도 조사 등 백오피스 화면을 파트너 페이지에 삽입 |

---

## 2. 백오피스 iframe 제공 페이지 점검 (상태 표)

백오피스 쪽에서 iframe으로 제공되는 페이지를 코드 기준으로 점검한 결과입니다.

### 2.1 백엔드 서빙 경로 (FastAPI)

| URL 경로 | 서빙 내용 | 비고 |
|----------|-----------|------|
| `/backoffice` | 백오피스 SPA `index.html` | 정상 (nginx → 8082) |
| `/backoffice/` | 동일 | 정상 |
| `/backoffice/{path}` | 정적 파일 또는 SPA 폴백 | 정상 |
| `/survey` | 백오피스 SPA `index.html` (동일 파일) | iframe 진입용; **nginx에 별도 location 없음** → 현재 nginx 설정에서는 `/`로 빠져 Django(8000)로 전달될 수 있음 |
| `/embedding` | 백오피스 SPA `index.html` (동일 파일) | 위와 동일 |

- **실제 iframe으로 쓸 URL**: nginx에서 백오피스는 `/backoffice`로만 프록시되므로, **실제 사용 URL은 `/backoffice/embedding`, `/backoffice/survey`** 가 맞습니다.

### 2.2 백오피스 SPA 라우트 및 embed 지원 여부

| 백오피스 경로 | 페이지명 | embed 모드 코드 지원 | api_key 로그인 우회 | iframe 제공 상태 | 비고 |
|---------------|----------|----------------------|---------------------|------------------|------|
| `/backoffice` | 인덱스 (dashboard 또는 embedding으로 리다이렉트) | - | ✅ 허용 (`EMBED_ALLOWED_PATHS` 포함) | ✅ 가능 | `api_key` 있으면 `embedding`으로 이동 |
| `/backoffice/embedding` | 검진결과 상담 (EmbeddingPage) | ✅ `useEmbedParams`, `isEmbedMode` | ✅ 허용 | ✅ **iframe 제공 가능** | 레이아웃·메뉴 embed 대응됨 |
| `/backoffice/survey` | 만족도 조사 (SurveyPage) | ✅ `useEmbedParams`, `isEmbedMode` | ✅ 허용 | ✅ **iframe 제공 가능** | 레이아웃·메뉴 embed 대응됨 |
| `/backoffice/dashboard` | 대시보드 | - | ❌ | ❌ iframe 비권장 | 로그인 필요 |
| `/backoffice/patients` | 환자 통합 | - | ❌ | ❌ iframe 비권장 | 로그인 필요 |
| `/backoffice/analytics` | 데이터 분석 | - | ❌ | ❌ iframe 비권장 | 로그인 필요 |

### 2.3 요약 표 (iframe 제공 관점)

| 페이지 | iframe URL 예시 | 로그인 없이 열기 | embed UI 적용 | 권장 |
|--------|------------------|------------------|---------------|------|
| 검진결과 상담 | `https://도메인/backoffice/embedding?api_key=...&partner_id=...&hospital_id=...` | ✅ 가능 | ✅ | ✅ 사용 |
| 만족도 조사 | `https://도메인/backoffice/survey?api_key=...&partner_id=...&hospital_id=...` | ✅ 가능 | ✅ | ✅ 사용 |

---

## 3. 채팅 위젯 (참고)

| 항목 | 내용 |
|------|------|
| 소스 | `planning-platform/frontend/src/embed/WelnoRagChatWidget.js` |
| 빌드 산출물 | `welno-rag-chat-widget.min.js` |
| 서빙 경로 예 | `/welno-api/static/welno-rag-chat-widget.min.js` (또는 backend static) |
| 설정 | `apiKey`, `baseUrl`, `uuid`, `hospitalId` 등 (INTEGRATION_GUIDE.md 참고) |

---

## 4. iframe → 부모 창으로 메뉴 숫자 전달 (postMessage)

백오피스가 iframe으로 열릴 때, 왼쪽 메뉴에 표시되는 숫자(신규 상담/설문 건수)를 **부모 페이지에 개별 맞춤으로** 보냅니다.

### 4.1 전송 이벤트

- **이벤트 타입**: `welno-backoffice-counts`
- **전송 시점**: iframe 로드 후 summary-counts 조회 직후, 이후 **60초마다** 갱신·재전송

### 4.2 메시지 payload (개별 맞춤)

| 필드 | 의미 | 부모에서 사용 예 |
|------|------|------------------|
| `embedding` | 검진결과 상담(신규 채팅) 건수 | 해당 메뉴/탭 뱃지 |
| `survey` | 만족도 조사(신규 설문) 건수 | 해당 메뉴/탭 뱃지 |
| `new_chats` | 동일 (embedding과 같음) | - |
| `new_surveys` | 동일 (survey와 같음) | - |

### 4.3 부모 페이지 수신 예시

```html
<iframe id="welno-backoffice" src="https://도메인/backoffice/embedding?api_key=...&partner_id=...&hospital_id=..."></iframe>
<script>
window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'welno-backoffice-counts') {
    var d = event.data;
    // 메뉴별 개별 맞춤
    document.querySelector('[data-menu="embedding"] .badge').textContent = d.embedding || 0;
    document.querySelector('[data-menu="survey"] .badge').textContent = d.survey || 0;
    // 또는
    console.log('신규 상담:', d.new_chats, '신규 설문:', d.new_surveys);
  }
});
</script>
```

- 필요하면 `event.origin`을 검사해 `https://welno.kindhabit.com` 등 허용 도메인만 처리하는 것을 권장합니다.

---

## 5. 권장 조치 (백오피스 iframe)

1. **만족도 조사 iframe 로그인 없이 쓰기**  
   - `ProtectedRoute.tsx`의 `EMBED_ALLOWED_PATHS`에 `'/backoffice/survey'` 추가 검토.
2. **nginx**  
   - `/survey`, `/embedding` 단독 진입을 쓸 계획이면, 해당 경로를 8082(백엔드)로 프록시하는 location 추가 검토.
3. **문서/파트너 안내**  
   - iframe 사용 시 실제 URL을 **`/backoffice/embedding`**, **`/backoffice/survey`** 로 통일해 안내하는 것이 좋음.

---

*문서 기준: 2025-02-20, 코드베이스 기준 점검.*
