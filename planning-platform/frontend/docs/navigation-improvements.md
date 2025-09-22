# 페이지/문항간 이동 및 뒤로가기 개선 사항

## 📋 개선 전 문제점

### 1. AuthForm 단계별 네비게이션 부족
- 이름 → 전화번호 → 생년월일 단계에서 이전 단계로 돌아갈 수 없음
- 브라우저 뒤로가기 시 전체 페이지에서 나가버림
- 단계별 상태가 브라우저 히스토리에 반영되지 않음

### 2. 일관성 없는 뒤로가기 동작
- 페이지마다 다른 뒤로가기 로직
- 앞으로가기 기능 없음
- popstate 이벤트 처리 부족

### 3. 플로팅 버튼 제어 불완전
- 인증 완료 후 플로팅 버튼이 다시 나타나지 않는 문제

## ✅ 구현된 개선 사항

### 1. AuthForm 단계별 히스토리 관리

#### 히스토리 상태 추가
```typescript
// 첫 번째 단계 시작 시
window.history.pushState(
  { step: 'name', confirmationStarted: true }, 
  '', 
  window.location.href
);

// 다음 단계 진행 시
window.history.pushState(
  { step: 'phone', confirmationData: { name: editableName } }, 
  '', 
  window.location.href
);
```

#### 브라우저 뒤로가기 이벤트 처리
```typescript
useEffect(() => {
  const handlePopState = (event: PopStateEvent) => {
    if (showConfirmation && event.state?.step) {
      const step = event.state.step as 'name' | 'phone' | 'birthday';
      setCurrentConfirmationStep(step);
      
      // 데이터 복원
      if (event.state.confirmationData) {
        const data = event.state.confirmationData;
        if (data.name) setEditableName(data.name);
        if (data.phone) setEditablePhone(data.phone);
      }
      
      // 타이틀 업데이트
      typeTitleMessage(`건강검진 인증을 위해\n${stepMessages[step]}을 확인해주세요`);
    }
  };

  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [showConfirmation, typeTitleMessage]);
```

### 2. 단계별 뒤로가기 버튼

#### handleStepBack 함수 구현
```typescript
const handleStepBack = useCallback(() => {
  if (currentConfirmationStep === 'phone') {
    setCurrentConfirmationStep('name');
    typeTitleMessage('건강검진 인증을 위해\n이름을 확인해주세요');
  } else if (currentConfirmationStep === 'birthday') {
    setCurrentConfirmationStep('phone');
    typeTitleMessage('건강검진 인증을 위해\n전화번호를 확인해주세요');
  } else {
    // 첫 번째 단계에서는 정보 확인을 종료하고 원래 페이지로
    setShowConfirmation(false);
    localStorage.removeItem('tilko_info_confirming');
    onBack && onBack();
  }
}, [currentConfirmationStep, typeTitleMessage, onBack]);
```

### 3. 공통 컴포넌트 생성

#### BackButton 컴포넌트
```typescript
// components/common/BackButton.tsx
interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const BackButton: React.FC<BackButtonProps> = ({ 
  onClick, 
  className = '', 
  style = {},
  children = '←'
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.history.back();
    }
  };

  return (
    <div className={`back-button-container ${className}`}>
      <button className="back-button" onClick={handleClick}>
        {children}
      </button>
    </div>
  );
};
```

#### HistoryManager 유틸리티
```typescript
// utils/historyManager.ts
export class HistoryManager {
  pushState(state: HistoryState, title: string = '', url?: string): void
  replaceState(state: HistoryState, title: string = '', url?: string): void
  back(): void
  forward(): void
  getCurrentState(): HistoryState | null
  navigateToStep(step: string, data?: any): void
  addPopStateListener(callback: (event: PopStateEvent) => void): () => void
}
```

### 4. DynamicSurvey 네비게이션 개선

#### 이전/건너뛰기 버튼 추가
```tsx
<div className="survey-floating-button">
  {/* 이전 버튼 */}
  {currentPageIndex > 0 && (
    <button onClick={() => setCurrentPageIndex(prev => prev - 1)}>
      이전
    </button>
  )}
  
  {/* 다음 버튼 */}
  <button onClick={handleNext}>
    {isLastPage ? '완료' : '다음'}
  </button>
  
  {/* 건너뛰기 버튼 (이미 진행했던 페이지가 있는 경우) */}
  {currentPageIndex < survey.pages.length - 1 && 
   response.responses[survey.pages[currentPageIndex + 1]?.id] && (
    <button onClick={() => setCurrentPageIndex(prev => prev + 1)}>
      건너뛰기
    </button>
  )}
</div>
```

### 5. 플로팅 버튼 제어 개선

#### 상태 기반 숨김/표시 로직
```typescript
// App.tsx
React.useEffect(() => {
  const checkHideStatus = () => {
    const isConfirming = localStorage.getItem('tilko_info_confirming') === 'true';
    const sessionId = localStorage.getItem('tilko_session_id');
    const authCompleted = localStorage.getItem('tilko_auth_completed') === 'true';
    
    // 정보 확인 중이거나 인증 진행 중(완료되지 않은 경우)에만 숨기기
    setHideFloatingButton(isConfirming || (!!sessionId && !authCompleted));
  };
  
  checkHideStatus();
  const interval = setInterval(checkHideStatus, 500);
  
  return () => clearInterval(interval);
}, []);
```

## 🎯 주요 개선 효과

### 1. 사용자 경험 향상
- **단계별 뒤로가기**: 이름→전화번호→생년월일 단계에서 자유로운 이전 단계 이동
- **브라우저 뒤로가기 지원**: 브라우저의 뒤로가기 버튼이 정상 작동
- **상태 보존**: 이전 단계로 돌아가도 입력한 정보가 유지됨

### 2. 일관성 있는 네비게이션
- **공통 컴포넌트**: 모든 페이지에서 동일한 뒤로가기 버튼 사용
- **표준 패턴**: 브라우저 표준 히스토리 API 활용
- **예측 가능한 동작**: 사용자가 예상하는 방식으로 동작

### 3. 설문조사 진행 개선
- **이전 페이지 이동**: 설문 중 이전 질문으로 돌아가기 가능
- **건너뛰기 기능**: 이미 답변한 페이지는 건너뛰기 가능
- **진행 상황 관리**: 사용자의 진행 상황을 정확히 추적

### 4. 기술적 안정성
- **메모리 누수 방지**: 이벤트 리스너 적절한 정리
- **상태 동기화**: 브라우저 히스토리와 앱 상태 동기화
- **에러 처리**: 예외 상황에 대한 안전한 처리

## 📁 관련 파일

### 수정된 파일
- `components/AuthForm.tsx` - 단계별 네비게이션 및 히스토리 관리
- `components/DynamicSurvey.tsx` - 설문조사 이전/건너뛰기 버튼
- `App.tsx` - 플로팅 버튼 제어 로직 개선

### 새로 생성된 파일
- `components/common/BackButton.tsx` - 공통 뒤로가기 버튼 컴포넌트
- `utils/historyManager.ts` - 히스토리 관리 유틸리티 클래스

## 🚀 향후 개선 방향

1. **페이지 간 애니메이션**: 단계 전환 시 부드러운 애니메이션 효과
2. **진행률 표시**: 전체 과정에서 현재 위치 시각화
3. **키보드 네비게이션**: 키보드로 이전/다음 단계 이동
4. **접근성 개선**: 스크린 리더 지원 및 ARIA 레이블 추가
