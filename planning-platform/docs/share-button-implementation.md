# 질병예측 리포트 공유 버튼 구현 문서

## 파일 위치
`frontend/src/features/disease-report/pages/DiseaseReportPage.tsx`

---

## 1. 동작 흐름 요약

```
사용자가 "📤 공유" 버튼 클릭
  │
  ├─ reportUrl 없음? → "리포트 PDF가 아직 준비되지 않았습니다" alert
  │
  ├─ refreshReportUrl()로 URL 유효성 확인 / 갱신
  │   └─ 실패 시 → "리포트 URL을 가져올 수 없습니다" 토스트, 중단
  │
  ├─ navigator.share 지원? (모바일)
  │   ├─ YES → Web Share API로 공유
  │   │         └─ 실패 시 → copyToClipboard 폴백
  │   │                       └─ 실패 시 → "공유 기능 사용 불가" 토스트
  │   └─ NO → (데스크톱) window.open으로 PDF 새 창 열기
  │
  └─ GTM 추적 이벤트 전송
```

---

## 2. 플랫폼별 동작

### 모바일 (isMobile() === true)
- **버튼 텍스트**: `📤 공유`
- **플로팅 버튼**: 클릭 시 `handleShare()` 호출
- **1차 시도**: `navigator.share()` (Web Share API)
- **2차 폴백**: `copyToClipboard()` (Clipboard API → textarea execCommand)

### 데스크톱 (isMobile() === false)
- **버튼 텍스트**: `⬇️ 다운로드`
- **플로팅 버튼**: 클릭 시 `handleDownload()` 호출
- **공유 버튼 직접 클릭 시**: `window.open(url, '_blank')` 으로 PDF 새 창

### isMobile 판단 기준
```typescript
const isMobile = useCallback(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 768);
}, []);
```

---

## 3. 핵심 API: Web Share API

### 호출 코드
```typescript
await navigator.share({
  title: '질병예측 리포트',
  text: `${customerName || '사용자'}님의 질병예측 리포트`,
  url: currentUrl   // S3 presigned URL (PDF)
});
```

### 브라우저 지원 현황

| 플랫폼 | 브라우저 | navigator.share | 비고 |
|--------|----------|:---------------:|------|
| **iOS Safari** | 12.2+ | ✅ | 네이티브 공유 시트 표시. 가장 안정적 |
| **iOS Chrome** | 모든 버전 | ✅ | iOS에서는 WebKit 기반이므로 Safari와 동일하게 동작 |
| **iOS 인앱 브라우저** | 카카오/네이버 등 | ✅ | WKWebView 기반, 대부분 지원 |
| **Android Chrome** | 61+ (2017~) | ✅ | 네이티브 공유 인텐트 표시 |
| **Android Samsung Internet** | 8.0+ | ✅ | Chrome과 동일하게 지원 |
| **Android Firefox** | 79+ | ✅ | 지원 |
| **Android 인앱 브라우저** | 카카오/네이버 등 | ⚠️ | WebView 버전에 따라 다름. 대부분 지원하나 구버전 WebView는 미지원 가능 |
| **데스크톱 Chrome** | 89+ (Win/Mac) | ✅ | OS 네이티브 공유 다이얼로그 |
| **데스크톱 Safari** | 12.1+ | ✅ | AirDrop, 메시지 등 |
| **데스크톱 Firefox** | ❌ 미지원 | ❌ | Web Share API 미지원 → window.open 폴백 |

### 결론: 안드로이드에서 잘 작동하는가?

**✅ YES** — Android Chrome 61+(2017년~), Samsung Internet 8.0+에서 `navigator.share`가 네이티브로 지원됩니다.

안드로이드에서 공유 버튼을 누르면:
1. OS 네이티브 공유 인텐트(시트)가 뜨고
2. 카카오톡, 메시지, 메일 등 설치된 앱 목록이 표시됨
3. 사용자가 앱을 선택하면 제목+URL이 전달됨

**iPhone과 동일한 UX**를 제공합니다.

---

## 4. 폴백 체계 (3단계)

### 4-1. Web Share API 실패 시 → Clipboard API
```typescript
if (navigator.clipboard && navigator.clipboard.writeText) {
  await navigator.clipboard.writeText(text);
}
```
- HTTPS 환경 필수 (HTTP에서는 Clipboard API 차단)
- iframe 내에서는 `clipboard-write` permission policy 필요

### 4-2. Clipboard API 실패 시 → textarea + execCommand
```typescript
const textarea = document.createElement('textarea');
textarea.value = text;
document.body.appendChild(textarea);

// iOS Safari 전용 처리
if (navigator.userAgent.match(/ipad|iphone/i)) {
  const range = document.createRange();
  range.selectNodeContents(textarea);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  textarea.setSelectionRange(0, 999999);
} else {
  textarea.select();  // Android / Desktop
}

document.execCommand('copy');
```

**주의**: `document.execCommand('copy')`는 deprecated이지만, 레거시 WebView 호환을 위해 유지.

### 4-3. 모두 실패 시 → 에러 토스트
```
"Web Share API와 클립보드 복사 모두 실패했습니다. 현재 환경에서는 공유기능을 사용할 수 없어요"
```

---

## 5. URL 유효성 보장

공유 전 `refreshReportUrl()`을 호출하여 S3 presigned URL이 만료되지 않았는지 확인합니다.

```
handleShare() 호출
  → refreshReportUrl() : 서버에서 최신 URL 재조회
    → 성공: currentUrl 갱신 후 공유 진행
    → 실패: "리포트 URL을 가져올 수 없습니다" 토스트, 공유 중단
```

S3 presigned URL은 보통 1시간 유효. 만료된 URL을 공유하면 수신자가 열 수 없으므로 이 단계가 중요합니다.

---

## 6. 알려진 엣지케이스

| 상황 | 동작 | 비고 |
|------|------|------|
| 카카오톡 인앱 브라우저 (Android 구버전 WebView) | Web Share API 미지원 가능 → Clipboard 폴백 | Android 5.0~6.0의 오래된 WebView |
| iframe 내 실행 | Clipboard API가 permission policy로 차단될 수 있음 → textarea 폴백 | 현재 질병예측은 iframe 외부이므로 해당 없음 |
| HTTP (비HTTPS) 환경 | Clipboard API 차단 → textarea 폴백 | 운영은 HTTPS이므로 해당 없음 |
| 사용자가 공유 취소 | AbortError → 무시 (정상 동작) | `err.name !== 'AbortError'` 체크 |
| presigned URL 만료 | refreshReportUrl에서 갱신 시도 | 서버가 새 URL 발급 |

---

## 7. GTM 추적

```typescript
trackReportPage('share_click', {
  mkt_uuid: mktUuid || null,
  report_url: currentUrl,
  share_method: 'web_share_api' | 'open_new_window'
});
```

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `DiseaseReportPage.tsx:1248-1398` | handleShare 함수 (메인 공유 로직) |
| `DiseaseReportPage.tsx:1200-1245` | copyToClipboard 함수 (폴백) |
| `DiseaseReportPage.tsx:916-919` | isMobile 판단 |
| `DiseaseReportPage.tsx:922-987` | refreshReportUrl (URL 갱신) |
| `DiseaseReportPage.tsx:1400-1436` | 플로팅 버튼 이벤트 리스너 |
| `DiseaseReportPage.tsx:1796-1820` | JSX 공유/다운로드 버튼 |
