# 🔍 인증 플로우 디버깅 가이드

## 🚨 현재 문제: 정보 확인 단계에서 멈춤

### 📊 현재 로그 분석
```
layoutMapper.ts:225 🎨 Layout Mapping Debug
MainPage.tsx:32 🚀 [메인페이지] 인증페이지로 이동
AuthForm.tsx:119 🔄 [인증페이지] AuthForm 마운트 - 플로팅 버튼 플래그 초기화
App.tsx:77 👤 [인증페이지] 환자 데이터 로드됨 - 플로팅 버튼 표시 보장
App.tsx:87 🔐 [인증페이지] 정보 확인 단계 시작
App.tsx:96 📡 [플로팅버튼] 정보 확인 시작 신호 전송
```

**문제점**: 플로팅 버튼에서 신호를 전송했지만 AuthForm에서 감지되지 않음

---

## 🧪 브라우저 콘솔 디버깅 방법

### 1. **localStorage 상태 확인**
```javascript
// 브라우저 콘솔에서 실행
console.log('저장된 신호:', localStorage.getItem('start_info_confirmation'));
console.log('환자 데이터:', localStorage.getItem('wello_patient_cache_a1b2c3d4-e5f6-7890-abcd-ef1234567890'));
console.log('모든 localStorage:', Object.keys(localStorage).filter(key => key.includes('wello') || key.includes('tilko')));
```

### 2. **수동으로 신호 전송 테스트**
```javascript
// 콘솔에서 직접 신호 전송
localStorage.setItem('start_info_confirmation', 'true');
console.log('수동 신호 전송 완료');

// 잠시 후 신호 확인
setTimeout(() => {
  console.log('신호 상태:', localStorage.getItem('start_info_confirmation'));
}, 1000);
```

### 3. **AuthForm 상태 확인**
```javascript
// React DevTools가 없다면 전역 객체로 확인
console.log('AuthForm 마운트 여부:', document.querySelector('[class*="auth"]') !== null);
console.log('플로팅 버튼 존재:', document.querySelector('.floating-button') !== null);
```

---

## 🔧 예상 원인 및 해결 방법

### 원인 1: useEffect 의존성 문제
**문제**: `typeTitleMessage` 의존성으로 인한 무한 루프 방지
**해결**: 의존성 배열 수정 필요

### 원인 2: 컴포넌트 마운트 타이밍
**문제**: AuthForm이 완전히 마운트되기 전에 신호 전송
**해결**: 마운트 완료 후 신호 처리

### 원인 3: localStorage 이벤트 처리
**문제**: 같은 탭에서의 localStorage 변경은 storage 이벤트 발생 안함
**해결**: interval 기반 폴링 또는 커스텀 이벤트 사용

---

## ⚡ 즉시 해결 방법

### 방법 1: 브라우저에서 수동 테스트
```javascript
// 1. 페이지 새로고침
location.reload();

// 2. 5초 후 수동 신호 전송
setTimeout(() => {
  localStorage.setItem('start_info_confirmation', 'true');
  console.log('수동으로 정보 확인 시작');
}, 5000);
```

### 방법 2: 플로팅 버튼 강제 클릭
```javascript
// 버튼 요소 찾아서 강제 클릭
const floatingBtn = document.querySelector('.floating-button');
if (floatingBtn) {
  floatingBtn.click();
  console.log('플로팅 버튼 강제 클릭');
} else {
  console.log('플로팅 버튼을 찾을 수 없습니다');
}
```

### 방법 3: 직접 showConfirmation 설정
```javascript
// React 컴포넌트 상태에 직접 접근 (개발용)
// 이 방법은 개발 환경에서만 사용하고, 실제 버그는 코드로 수정해야 함
```

---

## 🐛 코드 수정 필요사항

### 1. AuthForm.tsx의 useEffect 개선
```typescript
// 현재 문제가 있을 수 있는 부분
useEffect(() => {
  const checkStartSignal = () => {
    const startSignal = StorageManager.getItem(STORAGE_KEYS.START_INFO_CONFIRMATION);
    if (startSignal === 'true') {
      // 신호 처리 로직
    }
  };

  const interval = setInterval(checkStartSignal, 500);
  return () => clearInterval(interval);
}, [typeTitleMessage]); // 이 의존성이 문제일 수 있음
```

### 2. 커스텀 이벤트 사용
```typescript
// StorageManager에 이벤트 기반 신호 전송 추가 권장
StorageManager.setItemWithEvent('start_info_confirmation', 'true', 'auth-start-signal');
```

---

## 📝 테스트 체크리스트

- [ ] 플로팅 버튼 클릭 시 localStorage에 신호 저장되는가?
- [ ] AuthForm 컴포넌트가 완전히 마운트되었는가?
- [ ] useEffect의 interval이 정상 작동하는가?
- [ ] 환자 데이터가 올바르게 로드되었는가?
- [ ] 브라우저 콘솔에 에러가 없는가?

---

## 🚀 다음 단계

1. **브라우저 콘솔에서 위 디버깅 명령어 실행**
2. **수동 신호 전송으로 정보 확인 단계 진행 확인**
3. **문제점 파악 후 코드 수정**
4. **자동화된 신호 감지 로직 개선**

*이 가이드를 통해 현재 멈춘 지점을 넘어서 전체 인증 플로우를 테스트할 수 있습니다.*
