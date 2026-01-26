# 🎯 DiseaseReportPage 리팩토링 - Day 1 최종 작업 리스트

**작업일**: 2026-01-25  
**시간**: 6-8시간  
**목표**: 매트릭스 연관 플로우 + 플로팅 버튼만 집중 리팩토링

---

## 📊 현재 상태 스캔 결과

### DiseaseReportPage.tsx (1,985줄)
**문제점**:
- ✅ Line 4: `useUnifiedStatus` import 완료
- ⚠️ Lines 80-103: **24개 useState** (매트릭스와 직접 연관 없는 것들 다수)
- ❌ 자동 리다이렉트 로직 없음
- ❌ 플로팅 버튼 연동 없음

**매트릭스 직접 연관 상태만** (8개):
```typescript
const [loading, setLoading] = useState(true);              // ✅ 필요
const [error, setError] = useState<string | null>(null);   // ✅ 필요
const [reportData, setReportData] = useState(...);         // ✅ 필요
const [reportUrl, setReportUrl] = useState(...);           // ✅ 필요
const [customerName, setCustomerName] = useState(...);     // ✅ 필요
const [customerBirthday, setCustomerBirthday] = useState(...); // ✅ 필요
const [customerPhone, setCustomerPhone] = useState(...);   // ✅ 필요
const [isTestMode, setIsTestMode] = useState(false);       // ✅ 필요
```

**오늘 건드리지 않을 것** (16개):
```typescript
const [isBrownMode, setIsBrownMode] = useState(...);       // ❌ 스킨 (제외)
const [currentAge, setCurrentAge] = useState(...);         // ❌ 차트 (제외)
const [ageComparison, setAgeComparison] = useState(...);   // ❌ 차트 (제외)
const [dataSource, setDataSource] = useState(...);         // ❌ 디버그 (제외)
const [showEmailModal, setShowEmailModal] = useState(...); // ❌ 모달 (제외)
const [emailLoading, setEmailLoading] = useState(...);     // ❌ 모달 (제외)
const [countdown, setCountdown] = useState(...);           // ❌ 카운트다운 (제외)
const [countdownStarted, setCountdownStarted] = useState(...); // ❌ 카운트다운 (제외)
const [showKakaoMessage, setShowKakaoMessage] = useState(...); // ❌ 카카오 (제외)
const [showRankTooltip, setShowRankTooltip] = useState(...); // ❌ 툴팁 (제외)
const [showPanel, setShowPanel] = useState(...);           // ❌ 패널 (제외)
const [showAgeCardGlow, setShowAgeCardGlow] = useState(...); // ❌ 애니메이션 (제외)
const [showAbnormalCardsGlow, setShowAbnormalCardsGlow] = useState(...); // ❌ 애니메이션 (제외)
const [cancerLabelFilter, setCancerLabelFilter] = useState(...); // ❌ 필터 (제외)
const [diseaseLabelFilter, setDiseaseLabelFilter] = useState(...); // ❌ 필터 (제외)
const [cancerSliderIndex, setCancerSliderIndex] = useState(0); // ❌ 슬라이더 (제외)
const [diseaseSliderIndex, setDiseaseSliderIndex] = useState(0); // ❌ 슬라이더 (제외)
const [showDebugModal, setShowDebugModal] = useState(false); // ❌ 디버그 (제외)
const [cancerTouchStartX, setCancerTouchStartX] = useState(...); // ❌ 제스처 (제외)
const [cancerTouchEndX, setCancerTouchEndX] = useState(...); // ❌ 제스처 (제외)
const [diseaseTouchStartX, setDiseaseTouchStartX] = useState(...); // ❌ 제스처 (제외)
const [diseaseTouchEndX, setDiseaseTouchEndX] = useState(...); // ❌ 제스처 (제외)
```

### App.tsx (FloatingButton)
**현재 로직** (Lines 58-157):
- ⚠️ `location.pathname` 기반 버튼 텍스트 결정
- ⚠️ `localStorage` 상태 체크
- ❌ **매트릭스 상태와 연동 없음**

**필요한 수정**:
- ✅ `unified-status-change` 이벤트 리스닝
- ✅ 매트릭스 상태 기반 버튼 설정

---

## 🔧 오늘 작업 목록 (상세)

### Task 1: 매트릭스 연관 타입 정의 (30분)

**생성 파일**: `features/disease-report/pages/DiseaseReportPage/types/matrix.types.ts`

```typescript
/**
 * 매트릭스 상태 관련 타입 정의
 */

// 통합 상태 (useUnifiedStatus에서 받아옴)
export interface UnifiedStatus {
  status: string;
  action: string;
  terms_agreed: boolean;
  has_checkup_data: boolean;
  has_report: boolean;
  has_payment: boolean;
  requires_payment: boolean;
  metric_count: number;
  is_sufficient: boolean;
  data_sources: {
    tilko: { count: number; last_synced_at: string | null };
    indexeddb: { count: number; last_synced_at: string | null };
    partner: { count: number; last_synced_at: string | null };
  };
  primary_source: string | null;
}

// 리포트 페이지 기본 상태 (매트릭스 연관만)
export interface ReportPageState {
  loading: boolean;
  error: string | null;
  reportData: AIMSResponse | null;
  reportUrl: string | null;
  customerName: string | null;
  customerBirthday: string | null;
  customerPhone: string | null;
  isTestMode: boolean;
}

// 플로팅 버튼 설정
export interface FloatingButtonConfig {
  visible: boolean;
  text: string;
  action: () => void;
}
```

**체크리스트**:
```bash
[ ] types/matrix.types.ts 생성
[ ] UnifiedStatus 타입 정의
[ ] ReportPageState 타입 정의 (8개만)
[ ] FloatingButtonConfig 타입 정의
[ ] export 확인
```

---

### Task 2: useMatrixAutoRedirect 훅 (1시간)

**생성 파일**: `features/disease-report/pages/DiseaseReportPage/hooks/useMatrixAutoRedirect.ts`

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UnifiedStatus } from '../types/matrix.types';

/**
 * 매트릭스 상태 기반 자동 리다이렉트
 * 
 * 적용 상태:
 * - TERMS_REQUIRED* → 약관 페이지
 * - PAYMENT_REQUIRED → 결제 페이지
 * - ACTION_REQUIRED* → (오늘 제외, 로깅만)
 */
export function useMatrixAutoRedirect(
  unifiedStatus: UnifiedStatus | null,
  uuid: string,
  partnerId: string | null
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!unifiedStatus) return;

    const { status } = unifiedStatus;
    
    console.log(`[매트릭스 자동 리다이렉트] status=${status}`);

    // 1. 약관 미동의 → 약관 페이지
    if (status.startsWith('TERMS_REQUIRED')) {
      console.log('[리다이렉트] → 약관 페이지');
      const termsUrl = `/campaigns/disease-prediction?page=terms&uuid=${uuid}&partner=${partnerId || ''}`;
      navigate(termsUrl, { replace: true });
      return;
    }

    // 2. 결제 필요 → 결제 페이지
    if (status === 'PAYMENT_REQUIRED') {
      console.log('[리다이렉트] → 결제 페이지');
      const paymentUrl = `/campaigns/disease-prediction?page=payment&uuid=${uuid}&partner=${partnerId || ''}`;
      navigate(paymentUrl, { replace: true });
      return;
    }

    // 3. 데이터 부족 → Tilko 인증 (오늘은 로깅만)
    if (status === 'ACTION_REQUIRED' || status === 'ACTION_REQUIRED_PAID') {
      console.log('[상태] 데이터 수집 필요 (Tilko 인증 - 오늘 작업 범위 외)');
      // TODO: 나중에 활성화
      // navigate(`/login?return_to=/disease-report&uuid=${uuid}&mode=campaign`, { replace: true });
      return;
    }

    // 4. REPORT_READY → 정상 표시 (리다이렉트 없음)
    if (status === 'REPORT_READY') {
      console.log('[상태] ✅ 리포트 표시 준비 완료');
      return;
    }

    // 5. REPORT_PENDING → 로딩 상태 유지 (폴링 중)
    if (status === 'REPORT_PENDING') {
      console.log('[상태] ⏳ 리포트 생성 중 (폴링 활성)');
      return;
    }

    // 6. REPORT_EXPIRED → 만료 메시지 표시
    if (status === 'REPORT_EXPIRED') {
      console.log('[상태] ⚠️ 리포트 만료됨');
      return;
    }

  }, [unifiedStatus, navigate, uuid, partnerId]);
}
```

**체크리스트**:
```bash
[ ] hooks/useMatrixAutoRedirect.ts 생성
[ ] 매트릭스 6가지 상태 처리 로직
[ ] console.log 추가 (디버깅용)
[ ] navigate replace 옵션 사용
```

---

### Task 3: useFloatingButton 훅 (1시간)

**생성 파일**: `features/disease-report/pages/DiseaseReportPage/hooks/useFloatingButton.ts`

```typescript
import { useMemo } from 'react';
import type { UnifiedStatus, FloatingButtonConfig } from '../types/matrix.types';

/**
 * 매트릭스 상태 기반 플로팅 버튼 설정
 * 
 * 상태별 버튼 정책:
 * - REPORT_READY: "더 자세히 알아보기" (스크롤)
 * - REPORT_EXPIRED: "리포트 새로고침" (리로드)
 * - PAYMENT_REQUIRED: "결제하고 시작하기" (결제 페이지)
 * - TERMS_REQUIRED*: 버튼 숨김
 * - REPORT_PENDING: 버튼 숨김 (로딩 중)
 * - 기타: 버튼 숨김
 */
export function useFloatingButton(
  unifiedStatus: UnifiedStatus | null
): FloatingButtonConfig {
  return useMemo(() => {
    if (!unifiedStatus) {
      return { visible: false, text: '', action: () => {} };
    }

    const { status } = unifiedStatus;

    switch (status) {
      case 'REPORT_READY':
        return {
          visible: true,
          text: '더 자세히 알아보기',
          action: () => {
            const detailSection = document.querySelector('.report-detail-section');
            if (detailSection) {
              detailSection.scrollIntoView({ behavior: 'smooth' });
            } else {
              console.warn('[플로팅버튼] 상세 섹션을 찾을 수 없습니다');
            }
          }
        };

      case 'REPORT_EXPIRED':
        return {
          visible: true,
          text: '리포트 새로고침',
          action: () => {
            console.log('[플로팅버튼] 리포트 새로고침 실행');
            window.location.reload();
          }
        };

      case 'PAYMENT_REQUIRED':
        return {
          visible: true,
          text: '결제하고 시작하기',
          action: () => {
            console.log('[플로팅버튼] 결제 페이지로 이동');
            window.location.href = '/campaigns/disease-prediction?page=payment';
          }
        };

      case 'REPORT_PENDING':
      case 'TERMS_REQUIRED':
      case 'TERMS_REQUIRED_WITH_DATA':
      case 'TERMS_REQUIRED_WITH_REPORT':
      case 'ACTION_REQUIRED':
      case 'ACTION_REQUIRED_PAID':
        // 이들 상태에서는 플로팅 버튼 숨김
        return { visible: false, text: '', action: () => {} };

      default:
        console.warn(`[플로팅버튼] 알 수 없는 상태: ${status}`);
        return { visible: false, text: '', action: () => {} };
    }
  }, [unifiedStatus]);
}
```

**체크리스트**:
```bash
[ ] hooks/useFloatingButton.ts 생성
[ ] 매트릭스 상태별 버튼 설정
[ ] 액션 핸들러 정의
[ ] useMemo로 최적화
```

---

### Task 4: DiseaseReportPage 메인 로직 통합 (2-3시간)

**수정 파일**: `DiseaseReportPage.tsx`

**4.1 import 추가**
```typescript
import { useUnifiedStatus } from '../../hooks/useUnifiedStatus';
import { useMatrixAutoRedirect } from './hooks/useMatrixAutoRedirect';
import { useFloatingButton } from './hooks/useFloatingButton';
import type { UnifiedStatus } from './types/matrix.types';
```

**4.2 훅 통합** (Lines 70-110 영역)
```typescript
const DiseaseReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // URL 파라미터
  const uuid = searchParams.get('uuid') || '';
  const hospitalId = searchParams.get('hospital') || 'PEERNINE';
  const partnerId = searchParams.get('partner') || null;
  const oid = searchParams.get('oid') || null;

  // ✨ 통합 상태 훅
  const { 
    status: unifiedStatus, 
    loading: statusLoading, 
    error: statusError,
    refetch: refetchStatus
  } = useUnifiedStatus(uuid, hospitalId, partnerId, {
    pollInterval: 10000 // REPORT_PENDING 상태일 때만 폴링
  });

  // ✨ 매트릭스 자동 리다이렉트
  useMatrixAutoRedirect(unifiedStatus, uuid, partnerId);

  // ✨ 플로팅 버튼 설정 (전역 이벤트 발생)
  const floatingButtonConfig = useFloatingButton(unifiedStatus);
  
  useEffect(() => {
    // 플로팅 버튼 설정을 전역 이벤트로 발송 (App.tsx가 받음)
    window.dispatchEvent(new CustomEvent('floating-button-config', {
      detail: floatingButtonConfig
    }));
  }, [floatingButtonConfig]);

  // 기존 상태 (매트릭스 연관만 유지)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<AIMSResponse | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerBirthday, setCustomerBirthday] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  
  // 나머지 상태들 (스킨, 차트, 필터 등)은 그대로 유지
  // ... (오늘 건드리지 않음)
```

**4.3 상태별 렌더링 로직 추가** (기존 return 문 앞에)
```typescript
  // ✅ 통합 상태 로딩
  if (statusLoading) {
    return (
      <div className="disease-report-page loading">
        <div className="spinner-container">
          <div className="spinner" />
          <p>상태 확인 중...</p>
        </div>
      </div>
    );
  }

  // ✅ 통합 상태 에러
  if (statusError) {
    return (
      <div className="disease-report-page error">
        <div className="error-message">
          <h2>상태 조회 오류</h2>
          <p>{statusError}</p>
        </div>
      </div>
    );
  }

  // ✅ 리포트 생성 중 (REPORT_PENDING)
  if (unifiedStatus?.status === 'REPORT_PENDING') {
    return (
      <div className="disease-report-page pending">
        <div className="spinner-container">
          <div className="spinner" />
          <h2>리포트 생성 중입니다</h2>
          <p>잠시만 기다려주세요. 상태가 자동으로 업데이트됩니다.</p>
        </div>
      </div>
    );
  }

  // ✅ 리포트 만료 (REPORT_EXPIRED)
  if (unifiedStatus?.status === 'REPORT_EXPIRED') {
    return (
      <div className="disease-report-page expired">
        <div className="expired-message">
          <h2>리포트가 만료되었습니다</h2>
          <p>리포트 링크가 만료되었습니다. 새로고침이 필요합니다.</p>
          <button onClick={() => window.location.reload()}>
            리포트 새로고침
          </button>
        </div>
      </div>
    );
  }

  // ✅ 리포트 표시 준비 (REPORT_READY)
  if (unifiedStatus?.status === 'REPORT_READY') {
    // 리포트 데이터 로딩 (기존 로직 활용)
    // ... (기존 useEffect로 fetchReport 호출)
  }

  // 기존 리포트 렌더링 로직
  return (
    <div className="disease-report-page">
      {/* 기존 JSX 유지 */}
    </div>
  );
```

**체크리스트**:
```bash
[ ] import 추가
[ ] useUnifiedStatus 통합
[ ] useMatrixAutoRedirect 적용
[ ] useFloatingButton 적용
[ ] 상태별 early return 추가
[ ] 기존 로직과 충돌 없는지 확인
```

---

### Task 5: App.tsx 플로팅 버튼 매트릭스 연동 (1-2시간)

**수정 파일**: `App.tsx`

**5.1 floating-button-config 이벤트 리스닝 추가**

```typescript
// App.tsx (FloatingButton 컴포넌트 수정)

const FloatingButton: React.FC<{ onOpenAppointmentModal?: () => void }> = ({ onOpenAppointmentModal }) => {
  const location = useLocation();
  const { state } = useWelnoData();
  const { patient } = state;
  
  // ✨ 매트릭스 기반 플로팅 버튼 설정
  const [matrixButtonConfig, setMatrixButtonConfig] = useState<{
    visible: boolean;
    text: string;
    action: () => void;
  } | null>(null);

  // floating-button-config 이벤트 리스닝 (DiseaseReportPage에서 발생)
  useEffect(() => {
    const handleButtonConfig = (event: CustomEvent) => {
      console.log('[App.tsx] 플로팅 버튼 설정 수신:', event.detail);
      setMatrixButtonConfig(event.detail);
    };

    window.addEventListener('floating-button-config', handleButtonConfig as EventListener);
    return () => {
      window.removeEventListener('floating-button-config', handleButtonConfig as EventListener);
    };
  }, []);

  // ✨ DiseaseReportPage에서 온 설정 우선 사용
  if (location.pathname === '/disease-report' && matrixButtonConfig) {
    if (!matrixButtonConfig.visible) {
      return null; // 매트릭스 상태가 버튼 숨김이면 숨김
    }
    
    return (
      <button
        className="floating-action-button"
        onClick={matrixButtonConfig.action}
      >
        {matrixButtonConfig.text}
      </button>
    );
  }

  // 기존 로직 (다른 페이지들)
  // ... (기존 코드 유지)
};
```

**체크리스트**:
```bash
[ ] floating-button-config 이벤트 리스닝 추가
[ ] matrixButtonConfig 상태 추가
[ ] DiseaseReportPage 경로에서 매트릭스 설정 우선 사용
[ ] 기존 다른 페이지 로직 유지
```

---

### Task 6: 통합 테스트 및 검증 (1-2시간)

**6.1 상태별 시나리오 테스트**

| 시나리오 | 테스트 방법 | 예상 결과 |
|---------|-----------|----------|
| **약관 미동의** | 안광수 케이스 접속 | 약관 페이지로 자동 리다이렉트 ✅ |
| **리포트 준비** | 정상 유저 접속 | 리포트 표시 + "더 자세히 알아보기" 버튼 ✅ |
| **리포트 생성 중** | 방금 결제한 유저 | 스피너 + 폴링 + 버튼 숨김 ✅ |
| **결제 필요** | 무료 데이터 + 미결제 | 결제 페이지로 리다이렉트 ✅ |
| **리포트 만료** | 7일 지난 리포트 | 만료 메시지 + "새로고침" 버튼 ✅ |

**6.2 플로팅 버튼 액션 테스트**

```bash
[ ] "더 자세히 알아보기" 클릭 → 상세 섹션 스크롤 확인
[ ] "리포트 새로고침" 클릭 → 페이지 리로드 확인
[ ] "결제하고 시작하기" 클릭 → 결제 페이지 이동 확인
[ ] 로딩/약관 상태 시 버튼 숨김 확인
```

**6.3 폴링 동작 확인**

```bash
[ ] REPORT_PENDING 상태일 때 10초마다 API 호출 확인
[ ] REPORT_READY 전환 시 폴링 중단 확인
[ ] 폴링 중 페이지 이탈 시 정리 확인
```

---

## 📁 오늘 생성/수정될 파일

### 신규 생성 (3개)
```
features/disease-report/pages/DiseaseReportPage/
├── types/
│   └── matrix.types.ts (신규)
└── hooks/
    ├── useMatrixAutoRedirect.ts (신규)
    └── useFloatingButton.ts (신규)
```

### 수정 (2개)
```
features/disease-report/pages/DiseaseReportPage.tsx (수정)
App.tsx (수정, FloatingButton 부분만)
```

### 기존 유지 (변경 없음)
```
features/disease-report/hooks/useUnifiedStatus.ts (완성 ✅)
backend/app/services/welno_data_service.py (완성 ✅)
backend/app/api/v1/endpoints/disease_report_unified.py (완성 ✅)
```

---

## ✅ 오늘의 성공 기준

### 핵심 목표
1. ✅ **매트릭스 자동 리다이렉트**: 6가지 상태 100% 동작
2. ✅ **플로팅 버튼**: 매트릭스 상태 기반 완벽 연동
3. ✅ **폴링**: REPORT_PENDING 상태에서 자동 상태 갱신
4. ✅ **코드 단순화**: useState 24개 → 8개로 축소 (매트릭스 연관만)
5. ✅ **기존 기능 유지**: 리포트 표시 로직 100% 동일

### 제외 사항 (명확히)
- ❌ 차트 렌더링 (암/질병 섹션)
- ❌ 필터/슬라이더 로직
- ❌ 이메일/카카오 모달
- ❌ 디버그 모달
- ❌ 스와이프 제스처
- ❌ 애니메이션 효과
- ❌ 로그인/틸코 페이지

---

## 🎯 작업 순서

```
1. Task 1: 타입 정의 (30분)
   ↓
2. Task 2: useMatrixAutoRedirect (1시간)
   ↓
3. Task 3: useFloatingButton (1시간)
   ↓
4. Task 4: DiseaseReportPage 통합 (2-3시간)
   ↓
5. Task 5: App.tsx 수정 (1-2시간)
   ↓
6. Task 6: 통합 테스트 (1-2시간)
```

**총 소요 시간**: 6-9시간

---

## 📝 다음 액션

**즉시 시작**: Task 1 (타입 정의)

승인해주시면 바로 진행하겠습니다! 🚀
