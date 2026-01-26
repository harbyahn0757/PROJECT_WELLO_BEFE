# localhost:9282 접근 케이스 분석

## 현재 동작

### `http://localhost:9282/`로 직접 접근 시

#### 1. 도메인 체크
```typescript
const isKindHabitDomain = window.location.hostname.includes('kindhabit.com');
// localhost는 'kindhabit.com'을 포함하지 않으므로 → false
```

#### 2. 기본값 설정
```typescript
// hospital이 없으면 기본값 사용
const defaultHospital = {
  hospital_id: '',
  name: '건강검진센터',  // ← 기본 병원명
  // ...
};

// patient가 없으면 기본값 사용
const defaultPatient = {
  uuid: '',
  name: '고객',  // ← 기본 환자명
  // ...
};

const displayHospital = hospital || defaultHospital;
const displayPatient = patient || defaultPatient;
```

#### 3. 표시되는 인사말
```
안녕하세요 고객님,
건강검진센터입니다.
건강검진센터에서
더 의미있는 내원이 되시길 바라며
준비한 건강관리 서비스를 확인해보세요!
```

## 케이스 분류

### localhost:9282 접근 = **기본/개발 환경 케이스**

**특징:**
- 도메인: `localhost` (또는 `127.0.0.1`)
- `isKindHabitDomain = false`
- `hospital` 정보 없음 → `defaultHospital` 사용
- `patient` 정보 없음 → `defaultPatient` 사용
- 기본 인사말: "건강검진센터" + "고객님"

**이 케이스의 의미:**
- 개발/테스트 환경
- 환자 정보가 없는 초기 접근
- 병원 정보가 없는 기본 상태

## 문제점

### 현재 인사말이 부적절한 이유
1. **"더 의미있는 내원이 되시길 바라며"**
   - localhost는 개발 환경
   - 실제 병원 방문과 무관
   - 개발자/테스터가 보는 화면

2. **"건강검진센터"**
   - 실제 병원명이 아님
   - 기본값일 뿐

3. **"고객님"**
   - 실제 환자 이름이 아님
   - 기본값일 뿐

## 개선 방안

### localhost 케이스별 인사말 분기
```typescript
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// localhost일 때 다른 인사말
{isLocalhost ? (
  <>
    <span className="greeting-text-thin">WELNO 개발 환경입니다</span><br />
    <span className="greeting-text-thin">테스트를 진행해주세요!</span>
  </>
) : isKindHabitDomain ? (
  // kindhabit.com 케이스
) : (
  // 일반 병원 케이스
)}
```

또는

```typescript
// localhost는 기본 인사말 유지하되, 메시지 변경
{isLocalhost ? (
  <>
    <span className="greeting-text-thin">WELNO 건강검진 플랫폼에 오신 것을 환영합니다</span><br />
    <span className="greeting-text-thin">건강관리 서비스를 확인해보세요!</span>
  </>
) : (
  <>
    <span className="greeting-text-thin">더 의미있는 내원이 되시길 바라며</span><br />
    <span className="greeting-text-thin">준비한 건강관리 서비스를 확인해보세요!</span>
  </>
)}
```

## 확인 필요

**localhost 접근 시 표시되어야 할 인사말:**
1. 개발 환경임을 명시?
2. 기본 환영 메시지?
3. 다른 메시지?
