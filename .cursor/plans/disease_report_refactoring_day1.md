# 질병예측리포트 리팩토링 - Day 1 작업 플랜

**작업일**: 2026-01-25 (오늘)  
**범위**: DiseaseReportPage + 매트릭스 연관 플로우 + 플로팅 버튼  
**제외**: 로그인, 틸코 인증, 추이보기, RAG, 프롬프트

---

## 🎯 오늘의 목표

**핵심**: 질병예측리포트 페이지의 상태 매트릭스 기반 플로우와 플로팅 버튼만 집중 리팩토링

### 포함 범위
✅ DiseaseReportPage 상태 관리  
✅ 매트릭스 기반 자동 리다이렉트  
✅ 플로팅 버튼 상태 기반 처리  
✅ 리포트 로딩/에러/표시 로직  
✅ useUnifiedStatus 훅 통합  

### 제외 범위
❌ 로그인 페이지  
❌ 틸코 인증 프로세스  
❌ 추이보기/대시보드  
❌ RAG/프롬프트  
❌ 기타 페이지들  

---

## 📋 작업 체크리스트

### Phase 1: 현재 상태 파악 및 분석 (30분)

**1.1 DiseaseReportPage 매트릭스 연관 코드 식별**
```bash
# 체크 항목
[ ] useUnifiedStatus 훅 사용 현황 확인
[ ] 상태별 리다이렉트 로직 위치 파악
[ ] 플로팅 버튼 관련 코드 위치 파악
[ ] 매트릭스 상태와 연동되는 UI 컴포넌트 목록화
```

**분석 대상 파일**:
1. `DiseaseReportPage.tsx` (1,985줄)
   - Lines 4: useUnifiedStatus import ✅
   - Lines 46-94: 상태 관리 (useState 52개)
   - Lines ???: 자동 리다이렉트 로직 (추가 필요)
   - Lines ???: 플로팅 버튼 연동

2. `useUnifiedStatus.ts` (171줄) ✅ 완성됨
   - 매트릭스 상태 조회
   - 폴링 지원
   - 이벤트 발생

3. `App.tsx` 
   - FloatingButton 컴포넌트
   - unified-status-change 이벤트 리스닝

---

### Phase 2: 매트릭스 연관 상태 관리 추출 (2-3시간)

**2.1 타입 정의 생성**

```typescript
// features/disease-report/pages/DiseaseReportPage/types/report.types.ts

export interface ReportPageState {
  // 기본 정보
  uuid: string;
  hospitalId: string;
  partnerId: string | null;
  
  // 리포트 상태
  loading: boolean;
  error: string | null;
  reportData: AIMSResponse | null;
  reportUrl: string | null;
  
  // 고객 정보
  customerName: string | null;
  customerBirthday: string | null;
  customerPhone: string | null;
  currentAge: number | null;
  
  // 데이터 출처
  dataSource: 'db' | 'delayed' | null;
}

export interface ReportUIState {
  // 모달
  showEmailModal: boolean;
  showDebugModal: boolean;
  
  // 애니메이션 (필요한 것만)
  showAgeCardGlow: boolean;
  
  // 기타
  isTestMode: boolean;
}

// 매트릭스 상태 (useUnifiedStatus에서 가져옴)
export interface UnifiedStatusState {
  status: string;
  action: string;
  terms_agreed: boolean;
  has_checkup_data: boolean;
  has_report: boolean;
  has_payment: boolean;
  // ... 나머지
}
```

**작업**:
```bash
[ ] types/report.types.ts 생성
[ ] 기존 interface 정의 이동
[ ] export 확인
```

---

**2.2 useReportPageState 커스텀 훅 생성**

```typescript
// features/disease-report/pages/DiseaseReportPage/hooks/useReportPageState.ts

import { useState, useCallback } from 'react';
import type { ReportPageState, ReportUIState } from '../types/report.types';

export function useReportPageState(
  initialUuid: string,
  initialHospitalId: string,
  initialPartnerId: string | null
) {
  // 기본 상태
  const [pageState, setPageState] = useState<ReportPageState>({
    uuid: initialUuid,
    hospitalId: initialHospitalId,
    partnerId: initialPartnerId,
    loading: true,
    error: null,
    reportData: null,
    reportUrl: null,
    customerName: null,
    customerBirthday: null,
    customerPhone: null,
    currentAge: null,
    dataSource: null
  });
  
  // UI 상태
  const [uiState, setUiState] = useState<ReportUIState>({
    showEmailModal: false,
    showDebugModal: false,
    showAgeCardGlow: false,
    isTestMode: false
  });
  
  // 상태 업데이트 헬퍼
  const updatePageState = useCallback((updates: Partial<ReportPageState>) => {
    setPageState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const updateUiState = useCallback((updates: Partial<ReportUIState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);
  
  return {
    pageState,
    uiState,
    updatePageState,
    updateUiState
  };
}
```

**작업**:
```bash
[ ] hooks/useReportPageState.ts 생성
[ ] useState 52개 → 2개 객체로 축소
[ ] 업데이트 헬퍼 함수 제공
```

---

**2.3 useMatrixAutoRedirect 커스텀 훅 생성**

```typescript
// features/disease-report/pages/DiseaseReportPage/hooks/useMatrixAutoRedirect.ts

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UnifiedStatus } from '../../hooks/useUnifiedStatus';

export function useMatrixAutoRedirect(
  unifiedStatus: UnifiedStatus | null,
  uuid: string,
  partnerId: string | null
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!unifiedStatus) return;

    const { status, action } = unifiedStatus;
    
    console.log(`[매트릭스 자동 리다이렉트] status=${status}, action=${action}`);

    // 약관 미동의 → 약관 페이지
    if (status.startsWith('TERMS_REQUIRED')) {
      console.log('[리다이렉트] → 약관 페이지');
      navigate(`/campaigns/disease-prediction?page=terms&uuid=${uuid}&partner=${partnerId || ''}`, 
        { replace: true }
      );
      return;
    }

    // 데이터 부족 → Tilko 인증 (제외하지만 로직은 유지)
    if (status === 'ACTION_REQUIRED' || status === 'ACTION_REQUIRED_PAID') {
      console.log('[리다이렉트] → Tilko 인증 필요 (오늘 작업 범위 외)');
      // navigate(`/login?return_to=/disease-report&uuid=${uuid}&mode=campaign`, { replace: true });
      return;
    }

    // 결제 필요 → 결제 페이지
    if (status === 'PAYMENT_REQUIRED') {
      console.log('[리다이렉트] → 결제 페이지');
      navigate(`/campaigns/disease-prediction?page=payment&uuid=${uuid}&partner=${partnerId || ''}`, 
        { replace: true }
      );
      return;
    }

    // REPORT_READY → 정상 표시 (리다이렉트 없음)
    if (status === 'REPORT_READY') {
      console.log('[상태] 리포트 표시 준비 완료');
      return;
    }

    // REPORT_PENDING → 로딩 상태 유지 (폴링 중)
    if (status === 'REPORT_PENDING') {
      console.log('[상태] 리포트 생성 중 (폴링)');
      return;
    }

  }, [unifiedStatus, navigate, uuid, partnerId]);
}
```

**작업**:
```bash
[ ] hooks/useMatrixAutoRedirect.ts 생성
[ ] 매트릭스 기반 자동 리다이렉트 로직 집중
[ ] 로깅 추가 (디버깅용)
```

---

### Phase 3: 플로팅 버튼 상태 기반 처리 (1-2시간)

**3.1 useFloatingButton 커스텀 훅 생성**

```typescript
// features/disease-report/pages/DiseaseReportPage/hooks/useFloatingButton.ts

import { useState, useEffect } from 'react';
import type { UnifiedStatus } from '../../hooks/useUnifiedStatus';

interface FloatingButtonConfig {
  visible: boolean;
  text: string;
  action: () => void;
}

export function useFloatingButton(
  unifiedStatus: UnifiedStatus | null
): FloatingButtonConfig {
  const [config, setConfig] = useState<FloatingButtonConfig>({
    visible: false,
    text: '',
    action: () => {}
  });

  useEffect(() => {
    if (!unifiedStatus) {
      setConfig({ visible: false, text: '', action: () => {} });
      return;
    }

    const { status, has_report } = unifiedStatus;

    // 매트릭스 기반 플로팅 버튼 설정
    switch (status) {
      case 'REPORT_READY':
        setConfig({
          visible: true,
          text: '더 자세히 알아보기',
          action: () => {
            const detailSection = document.querySelector('.report-detail-section');
            detailSection?.scrollIntoView({ behavior: 'smooth' });
          }
        });
        break;

      case 'REPORT_EXPIRED':
        setConfig({
          visible: true,
          text: '리포트 새로고침',
          action: () => {
            window.location.reload();
          }
        });
        break;

      case 'REPORT_PENDING':
        setConfig({
          visible: false, // 로딩 중에는 숨김
          text: '',
          action: () => {}
        });
        break;

      case 'PAYMENT_REQUIRED':
        setConfig({
          visible: true,
          text: '결제하고 시작하기',
          action: () => {
            window.location.href = '/campaigns/disease-prediction?page=payment';
          }
        });
        break;

      case 'TERMS_REQUIRED':
      case 'TERMS_REQUIRED_WITH_DATA':
      case 'TERMS_REQUIRED_WITH_REPORT':
        setConfig({
          visible: false, // 약관 미동의 시 숨김
          text: '',
          action: () => {}
        });
        break;

      default:
        setConfig({
          visible: false,
          text: '',
          action: () => {}
        });
    }
  }, [unifiedStatus]);

  return config;
}
```

**작업**:
```bash
[ ] hooks/useFloatingButton.ts 생성
[ ] 매트릭스 상태 기반 버튼 설정
[ ] 액션 핸들러 정의
```

---

**3.2 App.tsx 플로팅 버튼 통합**

```typescript
// App.tsx (수정 부분만)

import { useFloatingButton } from './features/disease-report/pages/DiseaseReportPage/hooks/useFloatingButton';

function App() {
  const [unifiedStatus, setUnifiedStatus] = useState<UnifiedStatus | null>(null);
  
  // unified-status-change 이벤트 리스닝
  useEffect(() => {
    const handleStatusChange = (event: CustomEvent) => {
      setUnifiedStatus(event.detail);
    };

    window.addEventListener('unified-status-change', handleStatusChange as EventListener);
    return () => {
      window.removeEventListener('unified-status-change', handleStatusChange as EventListener);
    };
  }, []);

  // 플로팅 버튼 설정
  const floatingButtonConfig = useFloatingButton(unifiedStatus);

  return (
    <div className="app">
      {/* 기존 라우팅 */}
      
      {/* 플로팅 버튼 */}
      {floatingButtonConfig.visible && (
        <button
          className="floating-button"
          onClick={floatingButtonConfig.action}
        >
          {floatingButtonConfig.text}
        </button>
      )}
    </div>
  );
}
```

**작업**:
```bash
[ ] App.tsx에 unified-status-change 리스닝 추가
[ ] useFloatingButton 훅 통합
[ ] 기존 플로팅 버튼 로직 제거
```

---

### Phase 4: DiseaseReportPage 메인 컨테이너 단순화 (2-3시간)

**4.1 리포트 로딩 로직만 남기고 정리**

```typescript
// DiseaseReportPage/index.tsx (단순화 버전)

import { useUnifiedStatus } from '../../hooks/useUnifiedStatus';
import { useReportPageState } from './hooks/useReportPageState';
import { useMatrixAutoRedirect } from './hooks/useMatrixAutoRedirect';
import { useFloatingButton } from './hooks/useFloatingButton';

const DiseaseReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // URL 파라미터
  const uuid = searchParams.get('uuid') || '';
  const hospitalId = searchParams.get('hospital') || 'PEERNINE';
  const partnerId = searchParams.get('partner') || null;

  // ✅ 통합 상태 훅
  const { 
    status: unifiedStatus, 
    loading: statusLoading, 
    error: statusError 
  } = useUnifiedStatus(uuid, hospitalId, partnerId, {
    pollInterval: 10000, // REPORT_PENDING 상태일 때 10초마다 폴링
  });

  // ✅ 페이지 상태 관리
  const { pageState, uiState, updatePageState, updateUiState } = useReportPageState(
    uuid,
    hospitalId,
    partnerId
  );

  // ✅ 매트릭스 기반 자동 리다이렉트
  useMatrixAutoRedirect(unifiedStatus, uuid, partnerId);

  // ✅ 리포트 데이터 로딩 (REPORT_READY 상태일 때만)
  useEffect(() => {
    if (unifiedStatus?.status === 'REPORT_READY' && !pageState.reportData) {
      fetchReportData();
    }
  }, [unifiedStatus, pageState.reportData]);

  const fetchReportData = async () => {
    updatePageState({ loading: true, error: null });
    
    try {
      const response = await fetch(`/api/v1/disease-report?uuid=${uuid}&hospital=${hospitalId}`);
      const data = await response.json();
      
      if (data.success) {
        updatePageState({
          loading: false,
          reportData: data.report,
          reportUrl: data.reportUrl,
          customerName: data.customerName,
          // ... 기타 필드
        });
      } else {
        updatePageState({ loading: false, error: data.message });
      }
    } catch (err) {
      updatePageState({ 
        loading: false, 
        error: err instanceof Error ? err.message : '알 수 없는 오류'
      });
    }
  };

  // ✅ 로딩/에러 상태 처리
  if (statusLoading || pageState.loading) {
    return (
      <div className="disease-report-page loading">
        <LoadingSpinner message="리포트를 불러오는 중..." />
      </div>
    );
  }

  if (statusError || pageState.error) {
    return (
      <div className="disease-report-page error">
        <ErrorMessage message={statusError || pageState.error} />
      </div>
    );
  }

  // ✅ 상태별 UI 렌더링
  if (unifiedStatus?.status === 'REPORT_PENDING') {
    return (
      <div className="disease-report-page pending">
        <LoadingSpinner message="리포트 생성 중입니다. 잠시만 기다려주세요." />
        <p>상태가 자동으로 업데이트됩니다...</p>
      </div>
    );
  }

  if (!pageState.reportData) {
    return null; // 자동 리다이렉트 처리됨
  }

  // ✅ 리포트 표시 (기존 로직 유지)
  return (
    <div className="disease-report-page">
      {/* 기존 리포트 렌더링 로직 */}
      {/* 여기는 오늘 건드리지 않음 */}
    </div>
  );
};
```

**작업**:
```bash
[ ] DiseaseReportPage/index.tsx 수정
[ ] 커스텀 훅 통합
[ ] 불필요한 상태 제거
[ ] 로딩/에러 UI 단순화
```

---

### Phase 5: 테스트 및 검증 (1시간)

**5.1 매트릭스 상태별 시나리오 테스트**

```bash
[ ] TERMS_REQUIRED → 약관 페이지 리다이렉트 확인
[ ] REPORT_READY → 리포트 정상 표시 확인
[ ] REPORT_PENDING → 로딩 + 폴링 동작 확인
[ ] PAYMENT_REQUIRED → 결제 페이지 리다이렉트 확인
[ ] REPORT_EXPIRED → 만료 메시지 + 새로고침 버튼 확인
```

**5.2 플로팅 버튼 동작 확인**

```bash
[ ] REPORT_READY 상태: "더 자세히 알아보기" 버튼 표시
[ ] 버튼 클릭 시 상세 섹션으로 스크롤
[ ] REPORT_PENDING 상태: 버튼 숨김
[ ] TERMS_REQUIRED 상태: 버튼 숨김
```

**5.3 성능 확인**

```bash
[ ] useState 52개 → ~5개로 축소 확인
[ ] 리렌더링 횟수 비교 (React DevTools)
[ ] 메모리 사용량 확인
```

---

## 📁 생성될 파일 목록

```
features/disease-report/pages/DiseaseReportPage/
├── index.tsx (수정, 단순화)
├── types/
│   └── report.types.ts (신규)
└── hooks/
    ├── useReportPageState.ts (신규)
    ├── useMatrixAutoRedirect.ts (신규)
    └── useFloatingButton.ts (신규)

App.tsx (수정, 플로팅 버튼 통합)
```

---

## ⏱️ 예상 시간표

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| 1 | 현재 상태 파악 | 30분 |
| 2 | 상태 관리 훅 추출 | 2-3시간 |
| 3 | 플로팅 버튼 처리 | 1-2시간 |
| 4 | 메인 컨테이너 단순화 | 2-3시간 |
| 5 | 테스트 및 검증 | 1시간 |
| **총계** | | **6-9시간** |

---

## ✅ 오늘의 성공 기준

1. ✅ useState 52개 → 5개 이하로 축소
2. ✅ 매트릭스 기반 자동 리다이렉트 100% 동작
3. ✅ 플로팅 버튼 상태 기반 처리 완벽 동작
4. ✅ 기존 리포트 표시 기능 100% 유지
5. ✅ 코드 가독성 대폭 향상

---

## 🚫 오늘 건드리지 않는 부분

- ❌ 리포트 차트 렌더링 로직
- ❌ 암/질병 섹션 세부 로직
- ❌ 이메일/카카오 전송 로직
- ❌ 디버그 모달
- ❌ 설문 패널
- ❌ 로그인/틸코 인증 페이지

---

## 📝 다음 액션

**즉시 시작**: Phase 1 (현재 상태 파악)

```bash
# 1. DiseaseReportPage.tsx 열기
# 2. useUnifiedStatus 사용 현황 확인
# 3. 상태 관리 코드 위치 파악
# 4. 플로팅 버튼 관련 코드 찾기
```

**준비 완료!** 🚀
