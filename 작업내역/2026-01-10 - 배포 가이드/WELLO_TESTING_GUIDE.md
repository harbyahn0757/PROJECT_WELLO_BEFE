# 🧪 **웰로(WELLO) 시스템 통합 테스트 가이드**

## 📋 **목차**
1. [테스트 환경 설정](#테스트-환경-설정)
2. [기능별 테스트 시나리오](#기능별-테스트-시나리오)
3. [성능 테스트](#성능-테스트)
4. [보안 테스트](#보안-테스트)
5. [사용자 경험 테스트](#사용자-경험-테스트)
6. [자동화 테스트](#자동화-테스트)
7. [버그 리포팅](#버그-리포팅)

---

## 🛠️ **테스트 환경 설정**

### 1. **로컬 개발 환경**

#### 백엔드 시작
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
./start_wello.sh
```

#### 프론트엔드 시작
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend
npm start
```

#### 접속 URL
- **로컬**: `http://localhost:9281/wello/?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=MEDILINKS001`
- **프로덕션**: `https://xogxog.com/wello/?uuid={실제UUID}&hospital={병원코드}`

### 2. **테스트 데이터**

#### 기본 테스트 환자 정보
```
이름: [이름 삭제됨]-웰로
전화번호: 01056180757
생년월일: 19810927
성별: 남성
```

#### 토마스 어드민 계정 (API 테스트용)
```
username: thomas.kim@peernine.co.kr
password: peer00753!
권한: super_admin
```

---

## 🎯 **기능별 테스트 시나리오**

### 1. **페이지 로딩 및 초기화**

#### ✅ **T001: 페이지 첫 로딩**
**목적**: 시스템의 안정적인 초기 로딩 확인

**테스트 단계**:
1. 브라우저에서 웰로 URL 접속
2. UUID와 병원 파라미터가 올바르게 전달되는지 확인
3. 환자 정보가 정상적으로 로드되는지 확인
4. 헤더 이미지가 올바르게 표시되는지 확인

**예상 결과**:
- 페이지 로딩 시간 < 3초
- "안녕하세요 [이름 삭제됨]-웰로님" 메시지 표시
- 타이핑 효과 정상 작동
- 헤더 이미지 정상 표시

**체크포인트**:
```javascript
// 브라우저 콘솔에서 확인
console.log('환자 데이터:', localStorage.getItem('wello_patient_cache_a1b2c3d4-e5f6-7890-abcd-ef1234567890'));
console.log('병원 데이터:', localStorage.getItem('wello_hospital_cache_MEDILINKS001'));
```

#### ✅ **T002: 세션 복구**
**목적**: 기존 세션이 있을 때 올바른 복구 동작 확인

**테스트 단계**:
1. 첫 방문으로 인증 진행 (완료하지 않고 중단)
2. 브라우저 새로고침 또는 재방문
3. 세션 복구 동작 확인

**예상 결과**:
- 기존 세션 감지 및 적절한 페이지로 이동
- 캐주얼한 알림 메시지 표시
- 이전 진행 상황에서 계속 진행 가능

---

### 2. **인증 플로우 테스트**

#### ✅ **T003: 정상 인증 플로우**
**목적**: 전체 인증 과정의 정상 동작 확인

**테스트 단계**:
1. "내 검진 추이 확인하기" 버튼 클릭
2. 개인정보 확인 단계 진행
3. 카카오 간편인증 요청
4. 토큰 발급 확인
5. "카카오톡 인증 완료했어요!" 버튼 클릭
6. 건강 데이터 수집 대기
7. 결과 페이지로 이동

**예상 결과**:
- 각 단계별 적절한 UI 상태 변화
- 토큰 발급 후 버튼 활성화
- 데이터 수집 완료 후 결과 페이지 이동

**체크포인트**:
```javascript
// 토큰 상태 확인
const sessionData = JSON.parse(localStorage.getItem('tilko_session_data') || '{}');
console.log('토큰 수신 여부:', sessionData.token_received);
console.log('토큰 수신 시간:', sessionData.token_received_at);
```

#### ✅ **T004: 토큰 발급 실패 재시도**
**목적**: 토큰 발급 실패 시 자동 재시도 메커니즘 확인

**테스트 단계**:
1. 인증 요청 후 의도적으로 카카오톡 인증 무시
2. 45초 대기하여 재시도 로직 동작 확인
3. 최대 3회 재시도 제한 확인

**예상 결과**:
- 45초 후 자동 재시도
- 재시도 횟수 표시
- 3회 실패 시 에러 메시지

#### ✅ **T005: 토큰 수신 후 방치**
**목적**: 사용자가 토큰을 받았지만 버튼을 누르지 않는 경우 처리 확인

**테스트 단계**:
1. 카카오 인증 완료하여 토큰 수신
2. 2분간 버튼 클릭하지 않고 대기
3. 버튼 알림 효과 확인
4. 5분간 더 대기하여 만료 경고 확인

**예상 결과**:
- 2분 후 버튼 펄스 애니메이션
- 5분 후 세션 만료 경고

---

### 3. **네비게이션 테스트**

#### ✅ **T006: 브라우저 네비게이션**
**목적**: 브라우저 뒤로가기/앞으로가기 버튼 지원 확인

**테스트 단계**:
1. 메인 페이지에서 인증 페이지로 이동
2. 브라우저 뒤로가기 버튼 클릭
3. 브라우저 앞으로가기 버튼 클릭
4. URL 변경 시 상태 유지 확인

**예상 결과**:
- 자연스러운 페이지 전환
- 상태 정보 유지
- URL과 화면 상태 일치

#### ✅ **T007: URL 파라미터 처리**
**목적**: 다양한 URL 파라미터 조합에 대한 올바른 처리 확인

**테스트 케이스**:
```
1. 기본: ?uuid=xxx&hospital=yyy
2. 레이아웃 지정: ?uuid=xxx&hospital=yyy&layout=vertical
3. 잘못된 UUID: ?uuid=invalid&hospital=yyy
4. 누락된 파라미터: ?uuid=xxx
```

---

### 4. **에러 처리 테스트**

#### ✅ **T008: 네트워크 에러**
**목적**: 네트워크 장애 상황에서의 시스템 동작 확인

**테스트 방법**:
1. 브라우저 개발자 도구에서 네트워크 차단
2. 인증 요청 시도
3. 에러 메시지 및 복구 동작 확인

**예상 결과**:
- 명확한 에러 메시지
- 재시도 옵션 제공
- 시스템 안정성 유지

#### ✅ **T009: 잘못된 입력값**
**목적**: 유효하지 않은 사용자 입력에 대한 처리 확인

**테스트 케이스**:
```javascript
// 전화번호 검증
'010-1234-5678' // 정상
'01012345678'   // 정상
'0101234567'    // 오류 - 11자리
'02-123-4567'   // 오류 - 지역번호

// 생년월일 검증
'19810927'      // 정상
'810927'        // 오류 - 6자리
'19811301'      // 오류 - 잘못된 날짜
```

---

## ⚡ **성능 테스트**

### 1. **로딩 성능**

#### ✅ **P001: 페이지 로딩 시간**
**측정 기준**:
- LCP (Largest Contentful Paint) < 2.5초
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1

**측정 도구**:
```javascript
// 브라우저 콘솔에서 실행
window.addEventListener('load', () => {
  const perfData = performance.getEntriesByType('navigation')[0];
  console.log('페이지 로딩 시간:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
});
```

#### ✅ **P002: API 응답 시간**
**측정 기준**:
- 환자 데이터 로딩 < 1초
- 인증 요청 < 2초
- 데이터 수집 < 30초

### 2. **메모리 사용량**

#### ✅ **P003: 메모리 누수 확인**
**테스트 방법**:
1. 브라우저 메모리 탭에서 초기 메모리 사용량 확인
2. 인증 프로세스 10회 반복
3. 메모리 사용량 변화 모니터링

**기준**: 메모리 사용량 증가 < 50MB

---

## 🔒 **보안 테스트**

### 1. **세션 보안**

#### ✅ **S001: 세션 TTL 확인**
**목적**: 1분 TTL 정책 준수 확인

**테스트 단계**:
1. 인증 세션 생성
2. 1분 후 세션 상태 확인
3. 만료된 세션으로 요청 시도

**예상 결과**:
- 1분 후 세션 자동 만료
- 만료된 세션 사용 시 에러

#### ✅ **S002: 민감 정보 보호**
**체크리스트**:
- [ ] localStorage에 민감 정보 미저장
- [ ] 콘솔에 개인정보 미출력
- [ ] 네트워크 요청 시 HTTPS 사용
- [ ] 토큰 정보 적절한 관리

### 2. **데이터 검증**

#### ✅ **S003: 입력값 검증**
**목적**: 클라이언트 및 서버 사이드 검증 확인

**테스트 케이스**:
```javascript
// XSS 공격 시도
const maliciousInput = '<script>alert("XSS")</script>';
// SQL 인젝션 시도  
const sqlInjection = "'; DROP TABLE users; --";
```

---

## 👥 **사용자 경험 테스트**

### 1. **접근성 테스트**

#### ✅ **UX001: 키보드 네비게이션**
**테스트 방법**:
1. 마우스 없이 Tab 키로만 페이지 탐색
2. Enter/Space 키로 버튼 동작 확인
3. 포커스 표시 명확성 확인

#### ✅ **UX002: 스크린 리더**
**도구**: NVDA, JAWS
**확인사항**:
- [ ] 이미지 alt 텍스트
- [ ] 버튼 라벨 명확성
- [ ] 페이지 구조 논리성

### 2. **반응형 디자인**

#### ✅ **UX003: 모바일 대응**
**테스트 디바이스**:
- iPhone 12/13/14
- Samsung Galaxy S21/S22
- iPad

**체크리스트**:
- [ ] 터치 영역 44px 이상
- [ ] 가로/세로 모드 지원
- [ ] 폰트 크기 적절성

---

## 🤖 **자동화 테스트**

### 1. **E2E 테스트 스크립트**

#### Playwright 테스트 예시
```javascript
// test/e2e/auth-flow.spec.js
import { test, expect } from '@playwright/test';

test('카카오 인증 플로우', async ({ page }) => {
  // 페이지 접속
  await page.goto('http://localhost:9281/wello/?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=MEDILINKS001');
  
  // 환자 정보 로딩 확인
  await expect(page.locator('text=안녕하세요 [이름 삭제됨]-웰로님')).toBeVisible();
  
  // 인증 시작
  await page.click('text=내 검진 추이 확인하기');
  
  // 개인정보 확인
  await page.click('text=네, 맞습니다');
  
  // 토큰 발급 대기 (최대 60초)
  await page.waitForSelector('.auth-complete-button:not([disabled])', { timeout: 60000 });
  
  // 인증 완료
  await page.click('.auth-complete-button');
  
  // 결과 페이지 이동 확인
  await expect(page).toHaveURL(/.*results-trend.*/);
});
```

### 2. **API 테스트**

#### Jest + Supertest 예시
```javascript
// test/api/tilko-auth.test.js
const request = require('supertest');
const app = require('../../backend/app/main');

describe('Tilko 인증 API', () => {
  test('세션 생성', async () => {
    const response = await request(app)
      .post('/api/v1/tilko/session/start')
      .send({
        name: '[이름 삭제됨]',
        phoneNo: '01056180757',
        birthday: '19810927'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.session_id).toBeDefined();
  });
});
```

---

## 🐛 **버그 리포팅**

### 1. **버그 리포트 템플릿**

```markdown
## 🐛 버그 리포트

### 환경 정보
- **브라우저**: Chrome 119.0.0.0
- **OS**: Windows 11
- **화면 해상도**: 1920x1080
- **네트워크**: WiFi

### 재현 단계
1. 웰로 페이지 접속
2. "내 검진 추이 확인하기" 클릭
3. ...

### 예상 결과
사용자가 인증 페이지로 이동

### 실제 결과
페이지가 로딩되지 않음

### 추가 정보
- 콘솔 에러: [스크린샷 첨부]
- 네트워크 요청: [HAR 파일 첨부]
```

### 2. **우선순위 분류**

**🔴 Critical**: 서비스 사용 불가
- 페이지 로딩 실패
- 인증 완전 실패
- 데이터 손실

**🟡 High**: 주요 기능 영향
- 특정 브라우저 호환성
- UI 깨짐
- 성능 저하

**🟢 Medium**: 사용성 개선
- 디자인 이슈
- 텍스트 오타
- 접근성 개선

**🔵 Low**: 기타 개선사항
- 로깅 개선
- 코드 정리
- 문서 업데이트

---

## 📊 **테스트 체크리스트**

### 기능 테스트 (Functional Testing)
- [ ] T001: 페이지 첫 로딩
- [ ] T002: 세션 복구
- [ ] T003: 정상 인증 플로우
- [ ] T004: 토큰 발급 실패 재시도
- [ ] T005: 토큰 수신 후 방치
- [ ] T006: 브라우저 네비게이션
- [ ] T007: URL 파라미터 처리
- [ ] T008: 네트워크 에러
- [ ] T009: 잘못된 입력값

### 성능 테스트 (Performance Testing)
- [ ] P001: 페이지 로딩 시간
- [ ] P002: API 응답 시간
- [ ] P003: 메모리 누수 확인

### 보안 테스트 (Security Testing)
- [ ] S001: 세션 TTL 확인
- [ ] S002: 민감 정보 보호
- [ ] S003: 입력값 검증

### 사용자 경험 테스트 (UX Testing)
- [ ] UX001: 키보드 네비게이션
- [ ] UX002: 스크린 리더
- [ ] UX003: 모바일 대응

---

## 🚀 **배포 전 최종 체크리스트**

### 코드 품질
- [ ] 린터 에러 0개
- [ ] TypeScript 컴파일 에러 0개
- [ ] 단위 테스트 통과율 > 80%
- [ ] E2E 테스트 통과율 100%

### 성능 기준
- [ ] Lighthouse 점수 > 90
- [ ] 페이지 로딩 < 3초
- [ ] API 응답 시간 < 2초

### 보안 검증
- [ ] OWASP Top 10 취약점 점검
- [ ] 개인정보 처리 정책 준수
- [ ] HTTPS 강제 적용

### 브라우저 호환성
- [ ] Chrome (최신 2개 버전)
- [ ] Safari (최신 2개 버전)
- [ ] Firefox (최신 2개 버전)
- [ ] Edge (최신 2개 버전)

---

## 📞 **지원 및 문의**

**개발팀 연락처**:
- 이메일: dev@peernine.co.kr
- 슬랙: #wello-dev
- 이슈 트래커: GitHub Issues

**긴급 장애 대응**:
- 24/7 모니터링: https://status.wello.co.kr
- 긴급 연락처: 010-XXXX-XXXX

---

*이 문서는 웰로 시스템의 품질 보장을 위한 종합적인 테스트 가이드입니다. 모든 테스트 시나리오를 완료한 후 배포를 진행하시기 바랍니다.*
