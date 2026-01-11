# 서버-클라이언트 데이터 동기화 전략

## 📊 개요

서버의 `last_data_update`와 데이터 해시를 기반으로 효율적인 동기화를 수행합니다.

## 🔄 동기화 방법론

### **1. 해시 기반 동기화 (ETag)**

**원리:**
- 서버: 데이터의 SHA256 해시를 ETag 헤더로 전송
- 클라이언트: 캐시된 해시와 비교
- 동일하면: 304 Not Modified 반환 (네트워크 트래픽 절약)

**장점:**
- ✅ 정확한 변경 감지
- ✅ 네트워크 트래픽 최소화
- ✅ 빠른 응답 (304)

### **2. 타임스탬프 기반 동기화 (Last-Modified)**

**원리:**
- 서버: `last_data_update`를 Last-Modified 헤더로 전송
- 클라이언트: If-Modified-Since 헤더로 조건부 요청
- 서버가 더 최신이면: 전체 데이터 반환

**장점:**
- ✅ 시간 기반 비교 가능
- ✅ 캐시 만료 시간과 함께 사용

### **3. 하이브리드 전략**

**우선순위:**
1. **ETag 비교** (가장 정확)
2. **Last-Modified 비교** (백업)
3. **해시 재계산** (최종 검증)

## 📋 서버 측 업데이트 시간 관리

### **데이터 저장 시 `last_data_update` 업데이트**

| 데이터 타입 | 저장 함수 | 업데이트 위치 |
|------------|----------|--------------|
| **건강검진** | `save_health_data()` | `UPDATE wello.wello_patients SET last_data_update = NOW()` |
| **처방전** | `save_prescription_data()` | `UPDATE wello.wello_patients SET last_data_update = NOW()` |
| **검진 설계** | `save_checkup_design_request()` | `updated_at = NOW()` (별도 테이블) |

### **API 응답 구조**

```json
{
  "success": true,
  "data": {
    "patient": { ... },
    "health_data": [ ... ],
    "prescription_data": [ ... ],
    "last_update": "2026-01-06T02:57:41.061979Z"  // ✅ 서버의 실제 업데이트 시간
  }
}
```

## 🔧 프론트엔드 동기화 플로우

### **1. 캐시 확인**

```typescript
const cachedData = getCachedData(key);
const cachedMetadata = getCachedMetadata(key);
```

### **2. 조건부 요청**

```typescript
const headers = {
  'If-None-Match': `"${cachedMetadata.hash}"`,
  'If-Modified-Since': new Date(cachedMetadata.lastUpdate).toUTCString()
};
```

### **3. 서버 응답 처리**

| 상태 코드 | 의미 | 동작 |
|----------|------|------|
| **304 Not Modified** | 캐시 유효 | 캐시된 데이터 사용 |
| **200 OK** | 새 데이터 | 해시 비교 → 업데이트 여부 결정 |

### **4. 업데이트 판단**

```typescript
// 해시 비교
const isUpdated = cachedMetadata.hash !== serverHash;

// 타임스탬프 비교 (추가 검증)
const isServerNewer = new Date(serverLastUpdate) > new Date(cacheLastUpdate);

// 업데이트 필요 여부
const shouldUpdate = isUpdated || isServerNewer;
```

## 📦 localStorage 저장 구조

### **데이터 키**
```
welno_health_data_{uuid}_{hospitalId}
```

### **메타데이터 키**
```
welno_health_data_{uuid}_{hospitalId}_metadata
```

### **메타데이터 구조**
```typescript
{
  hash: "a1b2c3d4...",           // SHA256 해시
  lastUpdate: "2026-01-06T...",  // 서버의 last_data_update
  cachedAt: "2026-01-06T...",    // 로컬 저장 시간
  version?: 1                    // 선택적 버전
}
```

## 🎯 사용 예시

### **건강 데이터 동기화**

```typescript
import { syncHealthData } from '@/utils/dataSync';

const result = await syncHealthData(uuid, hospitalId, {
  cacheExpiry: 5 * 60 * 1000,  // 5분 캐시
  forceRefresh: false,          // 조건부 요청 사용
});

if (result.updated) {
  console.log('새 데이터로 업데이트됨');
} else {
  console.log('캐시 사용 (변경사항 없음)');
}
```

### **모든 데이터 동기화**

```typescript
import { syncAllPatientData } from '@/utils/dataSync';

const { health, design } = await syncAllPatientData(uuid, hospitalId);

console.log('건강검진:', health.updated ? '업데이트됨' : '캐시 사용');
console.log('검진 설계:', design?.updated ? '업데이트됨' : '캐시 사용');
```

## ⚡ 성능 최적화

### **캐시 전략**

1. **즉시 사용 가능**: 캐시된 데이터 먼저 표시
2. **백그라운드 동기화**: 조건부 요청으로 업데이트 확인
3. **304 응답**: 네트워크 트래픽 0% (헤더만 교환)

### **캐시 만료 시간**

| 데이터 타입 | 권장 만료 시간 | 이유 |
|------------|--------------|------|
| **건강검진** | 5분 | 자주 변경되지 않음 |
| **처방전** | 5분 | 자주 변경되지 않음 |
| **검진 설계** | 1시간 | 생성 후 변경 없음 |

## 🔒 데이터 무결성

### **해시 검증**

- 저장 시: 데이터 해시 계산 및 저장
- 로드 시: 해시 재계산 및 비교
- 불일치 시: 서버에서 재다운로드

### **타임스탬프 검증**

- 서버 시간 우선 사용
- 로컬 시간은 보조 용도만

## 📝 주의사항

1. **해시 계산 비용**: 큰 데이터는 비동기 처리
2. **타임스탬프 정확도**: 서버 시간 기준으로 동기화
3. **캐시 만료**: 너무 짧으면 빈번한 요청, 너무 길면 오래된 데이터

## 🚀 향후 개선 사항

1. **인덱스 기반 동기화**: 변경된 항목만 전송
2. **WebSocket 실시간 동기화**: 서버 푸시
3. **오프라인 큐**: 네트워크 복구 시 자동 동기화
