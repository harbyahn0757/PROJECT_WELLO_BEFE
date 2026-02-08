# IndexedDB 초기화 시점 분석 보고서

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: IndexedDB 초기화 시점 분석 보고서

---

## 현재 초기화 방식

### 1. 자동 초기화 (모듈 레벨)
**위치**: `planning-platform/frontend/src/services/WelnoIndexedDB.ts` (line 485-490)

```typescript
// 앱 시작 시 자동 초기화
if (typeof window !== 'undefined') {
  WelnoIndexedDB.initialize().catch(error => {
    console.error('❌ [IndexedDB] 자동 초기화 실패:', error);
  });
}
```

**특징**:
- 모듈이 처음 로드될 때 자동으로 실행됨
- `window` 객체가 존재하는 경우에만 실행 (SSR 방지)
- 비동기 실행이므로 앱 시작을 블로킹하지 않음

### 2. 지연 초기화 (Lazy Initialization)
**위치**: `WelnoIndexedDB.ensureConnection()` (line 93-98)

```typescript
private static async ensureConnection(): Promise<IDBDatabase> {
  if (!this.db) {
    await this.initialize();
  }
  return this.db!;
}
```

**특징**:
- 모든 메서드(`saveHealthData`, `getHealthData` 등)에서 `ensureConnection()` 호출
- `db`가 `null`인 경우에만 초기화
- 이미 초기화되었으면 재초기화하지 않음

## 초기화 시점 분석

### 실제 초기화가 일어나는 시점

1. **앱 시작 시 (가장 먼저)**
   - `WelnoIndexedDB` 모듈이 처음 import될 때
   - 정적 import를 사용하는 파일:
     - `MainPage.tsx` (line 19): `import { WelnoIndexedDB } from '../services/WelnoIndexedDB';`
   - 동적 import를 사용하는 파일들 (9개):
     - `AuthForm.tsx`
     - `ComprehensiveAnalysisPage/index.tsx`
     - `HealthTrends/index.tsx`
     - `HealthDataViewer/index.tsx`
     - `AIAnalysisSection/index.tsx`
     - `healthDataLoader.ts`
     - `WelnoDataContext.tsx`
     - `PrescriptionHistory/index.tsx`

2. **초기화 순서**
   ```
   앱 시작 → MainPage.tsx 로드 → WelnoIndexedDB 모듈 로드 → 자동 초기화 실행
   ```

3. **중복 초기화 방지**
   - `db`가 static 변수이므로 한 번만 초기화됨
   - `ensureConnection()`에서 `if (!this.db)` 체크로 중복 방지
   - 하지만 자동 초기화 코드는 모듈이 로드될 때마다 실행됨 (Promise는 중복 실행되지만 결과는 무시됨)

## 문제점 및 개선 사항

### 현재 문제점

1. **자동 초기화 코드의 중복 실행 가능성**
   - 모듈이 여러 번 import되면 `initialize()`가 여러 번 호출될 수 있음
   - 하지만 `db` static 변수로 인해 실제로는 한 번만 초기화됨
   - 불필요한 Promise 생성

2. **초기화 실패 시 재시도 없음**
   - 자동 초기화가 실패하면 `ensureConnection()`에서 재시도
   - 하지만 자동 초기화 실패 로그만 남고 조용히 실패

3. **초기화 상태 추적 불가**
   - 초기화가 진행 중인지, 완료되었는지, 실패했는지 알 수 없음
   - 여러 컴포넌트에서 동시에 `ensureConnection()`을 호출하면 중복 초기화 시도 가능

### 개선 제안

1. **초기화 상태 플래그 추가**
   ```typescript
   private static db: IDBDatabase | null = null;
   private static initPromise: Promise<void> | null = null;
   private static isInitializing: boolean = false;
   ```

2. **초기화 중복 방지 강화**
   ```typescript
   static async initialize(): Promise<void> {
     // 이미 초기화 중이면 기존 Promise 반환
     if (this.initPromise) {
       return this.initPromise;
     }
     
     // 이미 초기화되었으면 즉시 반환
     if (this.db) {
       return Promise.resolve();
     }
     
     // 초기화 시작
     this.isInitializing = true;
     this.initPromise = new Promise((resolve, reject) => {
       // ... 기존 초기화 로직
     });
     
     return this.initPromise;
   }
   ```

3. **자동 초기화 개선**
   - 자동 초기화를 제거하고 `ensureConnection()`에서만 초기화
   - 또는 초기화 상태를 체크하여 중복 실행 방지

## 초기화 로그 분석

### 사용자 로그에서 확인된 내용
```
WelnoIndexedDB.ts:21 ✅ [IndexedDB] 데이터베이스 초기화 완료
```

**분석**:
- 초기화가 한 번만 실행됨 (정상)
- 로그가 `WelnoIndexedDB.ts:21`에서 나왔는데, 실제로는 line 51에서 출력됨
- 이는 정상적인 초기화 완료 로그

### 초기화가 일어나는 조건

1. **항상 일어나는 경우**
   - 앱이 처음 시작될 때
   - `MainPage.tsx`가 로드될 때 (정적 import)

2. **조건부로 일어나는 경우**
   - 다른 컴포넌트에서 동적 import로 `WelnoIndexedDB`를 사용할 때
   - 하지만 `ensureConnection()`에서 `db`가 있으면 재초기화하지 않음

3. **일어나지 않는 경우**
   - 이미 초기화된 후에는 재초기화하지 않음
   - `db` static 변수로 상태 유지

## 결론

### 현재 상태
- ✅ 초기화가 정상적으로 한 번만 실행됨
- ✅ 중복 초기화 방지 메커니즘 작동 중
- ⚠️ 자동 초기화 코드가 모듈 로드 시마다 실행되지만, 실제 초기화는 한 번만 됨

### 권장 사항
1. **현재 상태 유지** (문제 없음)
   - 실제로는 한 번만 초기화되고 있음
   - 성능 문제 없음

2. **개선이 필요한 경우**
   - 초기화 상태를 더 명확히 추적하고 싶다면
   - 초기화 실패 시 재시도 로직 추가
   - 초기화 진행 중 상태 표시

3. **불필요한 초기화가 발생하는 경우**
   - 자동 초기화 코드를 제거하고 `ensureConnection()`에서만 초기화
   - 또는 초기화 상태 플래그로 중복 실행 방지

## 초기화 시점 요약

| 시점 | 조건 | 실행 여부 |
|------|------|----------|
| 앱 시작 | `MainPage.tsx` 로드 시 | ✅ 항상 |
| 동적 import | 다른 컴포넌트에서 사용 시 | ⚠️ `db`가 없을 때만 |
| `ensureConnection()` | 모든 메서드 호출 시 | ⚠️ `db`가 없을 때만 |
| 재초기화 | 이미 초기화된 후 | ❌ 일어나지 않음 |
