# 코드베이스 리팩토링 마스터 플랜

**목표**: 프롬프트/RAG 제외, 유지보수성 및 성능 개선  
**예상 기간**: 4-6주  
**우선순위**: P0 (즉시) → P1 (2주 내) → P2 (점진적)

---

## 🎯 Phase 1: DiseaseReportPage 대규모 리팩토링 (P0)

### 현재 상태 분석
- **파일**: `DiseaseReportPage.tsx` (1,984줄)
- **문제점**:
  - 52개 useState (상태 관리 복잡도 ↑↑↑)
  - 20개 useEffect (사이드 이펙트 추적 어려움)
  - 15개 useCallback (메모이제이션 오버헤드)
  - 모든 기능이 단일 파일에 혼재

### 목표 구조

```
features/disease-report/
├── pages/
│   └── DiseaseReportPage/
│       ├── index.tsx (200줄) - 메인 컨테이너
│       ├── hooks/
│       │   ├── useReportData.ts (150줄)
│       │   ├── useReportState.ts (100줄)
│       │   ├── useReportFilters.ts (80줄)
│       │   ├── useReportModals.ts (120줄)
│       │   ├── useReportAnimations.ts (100줄)
│       │   └── useReportActions.ts (150줄)
│       ├── components/
│       │   ├── ReportHeader/
│       │   │   ├── index.tsx (100줄)
│       │   │   └── ColorModeToggle.tsx (50줄)
│       │   ├── AgeSection/
│       │   │   ├── index.tsx (150줄)
│       │   │   ├── AgeComparisonCard.tsx (100줄)
│       │   │   └── HealthAgeDisplay.tsx (80줄)
│       │   ├── CancerSection/
│       │   │   ├── index.tsx (200줄)
│       │   │   ├── CancerCard.tsx (100줄)
│       │   │   ├── CancerSlider.tsx (150줄)
│       │   │   └── CancerFilters.tsx (80줄)
│       │   ├── DiseaseSection/
│       │   │   ├── index.tsx (200줄)
│       │   │   ├── DiseaseCard.tsx (100줄)
│       │   │   ├── DiseaseSlider.tsx (150줄)
│       │   │   └── DiseaseFilters.tsx (80줄)
│       │   ├── modals/
│       │   │   ├── EmailModal.tsx (150줄)
│       │   │   ├── DebugModal.tsx (100줄)
│       │   │   └── SurveyModal.tsx (200줄 → 별도 처리)
│       │   └── shared/
│       │       ├── LoadingSpinner.tsx (50줄)
│       │       ├── ErrorMessage.tsx (60줄)
│       │       └── FloatingActionButton.tsx (80줄)
│       ├── utils/
│       │   ├── reportCalculations.ts (150줄)
│       │   ├── reportFormatters.ts (100줄)
│       │   ├── ageCalculations.ts (80줄)
│       │   └── swipeGestures.ts (100줄)
│       ├── types/
│       │   ├── report.types.ts (100줄)
│       │   └── filter.types.ts (50줄)
│       └── constants/
│           ├── filterOptions.ts (50줄)
│           └── testData.ts (80줄)
```

### 단계별 작업 계획

#### Step 1.1: 타입 정의 및 상수 추출 (2-3일)
**목표**: 재사용 가능한 타입과 상수 분리

**작업**:
```typescript
// types/report.types.ts
export interface ReportData {
  uuid: string;
  reportUrl: string | null;
  customerName: string;
  customerBirthday: string;
  currentAge: number;
  ageComparison: AgeComparison;
  cancerData: CancerItem[];
  diseaseData: DiseaseItem[];
}

export interface ReportState {
  loading: boolean;
  error: string | null;
  reportData: ReportData | null;
  dataSource: 'db' | 'delayed' | null;
}

export interface FilterState {
  cancerFilter: FilterType;
  diseaseFilter: FilterType;
  cancerSliderIndex: number;
  diseaseSliderIndex: number;
}

export type FilterType = 'ALL' | 'NORMAL' | 'BOUNDARY' | 'ABNORMAL';
```

**검증**:
- [ ] 타입 오류 없이 컴파일
- [ ] 기존 코드에서 타입 재사용 확인

---

#### Step 1.2: 커스텀 훅 추출 (3-4일)

**1.2.1: useReportData 훅**
```typescript
// hooks/useReportData.ts
export function useReportData(uuid: string, hospitalId: string) {
  const [state, setState] = useState<ReportState>(initialState);
  const { status: unifiedStatus } = useUnifiedStatus(uuid, hospitalId);

  useEffect(() => {
    if (unifiedStatus?.status === 'REPORT_READY') {
      fetchReportData();
    }
  }, [unifiedStatus]);

  const fetchReportData = async () => {
    // 기존 로딩 로직 이동
  };

  return {
    loading: state.loading,
    error: state.error,
    reportData: state.reportData,
    dataSource: state.dataSource,
    refetch: fetchReportData
  };
}
```

**1.2.2: useReportFilters 훅**
```typescript
// hooks/useReportFilters.ts
export function useReportFilters(
  cancerData: CancerItem[],
  diseaseData: DiseaseItem[]
) {
  const [filters, setFilters] = useState<FilterState>({
    cancerFilter: 'ALL',
    diseaseFilter: 'ALL',
    cancerSliderIndex: 0,
    diseaseSliderIndex: 0
  });

  const filteredCancer = useMemo(() => 
    filterByLabel(cancerData, filters.cancerFilter),
    [cancerData, filters.cancerFilter]
  );

  const filteredDisease = useMemo(() =>
    filterByLabel(diseaseData, filters.diseaseFilter),
    [diseaseData, filters.diseaseFilter]
  );

  return {
    filters,
    setFilters,
    filteredCancer,
    filteredDisease
  };
}
```

**1.2.3: useReportModals 훅**
```typescript
// hooks/useReportModals.ts
export function useReportModals() {
  const [modals, setModals] = useState({
    email: false,
    debug: false,
    survey: false,
    kakao: false
  });

  const openModal = (name: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [name]: true }));
  };

  const closeModal = (name: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [name]: false }));
  };

  return { modals, openModal, closeModal };
}
```

**검증**:
- [ ] 각 훅이 독립적으로 동작
- [ ] 메모리 누수 없음
- [ ] 리렌더링 최소화 확인

---

#### Step 1.3: 컴포넌트 분리 (4-5일)

**1.3.1: AgeSection 컴포넌트**
```typescript
// components/AgeSection/index.tsx
interface AgeSectionProps {
  currentAge: number | null;
  ageComparison: AgeComparison | null;
  customerName: string | null;
  onAgeBoxClick: () => void;
}

export const AgeSection: React.FC<AgeSectionProps> = ({
  currentAge,
  ageComparison,
  customerName,
  onAgeBoxClick
}) => {
  // 기존 나이 섹션 로직
  return (
    <div className="age-section">
      <AgeComparisonCard {...} />
      <HealthAgeDisplay {...} />
    </div>
  );
};
```

**1.3.2: CancerSection 컴포넌트**
```typescript
// components/CancerSection/index.tsx
interface CancerSectionProps {
  data: CancerItem[];
  filter: FilterType;
  sliderIndex: number;
  onFilterChange: (filter: FilterType) => void;
  onSliderChange: (index: number) => void;
}

export const CancerSection: React.FC<CancerSectionProps> = ({
  data,
  filter,
  sliderIndex,
  onFilterChange,
  onSliderChange
}) => {
  const filteredData = useMemo(() => 
    filterByLabel(data, filter),
    [data, filter]
  );

  return (
    <section className="cancer-section">
      <CancerFilters 
        current={filter}
        onChange={onFilterChange}
      />
      <CancerSlider
        data={filteredData}
        index={sliderIndex}
        onChange={onSliderChange}
      />
    </section>
  );
};
```

**검증**:
- [ ] Props 타입 안정성
- [ ] 부모-자식 간 데이터 흐름 명확
- [ ] 재사용 가능한 구조

---

#### Step 1.4: 메인 컨테이너 단순화 (2일)

**최종 DiseaseReportPage/index.tsx**
```typescript
const DiseaseReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const uuid = searchParams.get('uuid') || '';
  const hospitalId = searchParams.get('hospital') || 'PEERNINE';

  // ✅ 커스텀 훅으로 상태 관리
  const { loading, error, reportData, refetch } = useReportData(uuid, hospitalId);
  const { filters, setFilters, filteredCancer, filteredDisease } = useReportFilters(
    reportData?.cancerData || [],
    reportData?.diseaseData || []
  );
  const { modals, openModal, closeModal } = useReportModals();
  const { glowEffects, triggerGlow } = useReportAnimations();

  // ✅ 로딩/에러 상태는 단순 처리
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!reportData) return null;

  // ✅ 컴포넌트 조합만
  return (
    <div className="disease-report-page">
      <ReportHeader
        customerName={reportData.customerName}
        onColorModeChange={handleSkinChange}
      />

      <AgeSection
        currentAge={reportData.currentAge}
        ageComparison={reportData.ageComparison}
        customerName={reportData.customerName}
        onAgeBoxClick={handleAgeBoxClick}
      />

      <CancerSection
        data={filteredCancer}
        filter={filters.cancerFilter}
        sliderIndex={filters.cancerSliderIndex}
        onFilterChange={(f) => setFilters(prev => ({...prev, cancerFilter: f}))}
        onSliderChange={(i) => setFilters(prev => ({...prev, cancerSliderIndex: i}))}
      />

      <DiseaseSection
        data={filteredDisease}
        filter={filters.diseaseFilter}
        sliderIndex={filters.diseaseSliderIndex}
        onFilterChange={(f) => setFilters(prev => ({...prev, diseaseFilter: f}))}
        onSliderChange={(i) => setFilters(prev => ({...prev, diseaseSliderIndex: i}))}
      />

      {/* Modals */}
      {modals.email && <EmailModal onClose={() => closeModal('email')} />}
      {modals.debug && <DebugModal onClose={() => closeModal('debug')} />}
    </div>
  );
};

// 총 라인 수: ~200줄
```

**검증**:
- [ ] 기능 동일성 확인
- [ ] 성능 비교 (렌더링 횟수)
- [ ] 번들 크기 변화

---

### Phase 1 체크리스트

- [ ] Step 1.1: 타입 및 상수 추출
- [ ] Step 1.2: 커스텀 훅 6개 생성
- [ ] Step 1.3: 주요 섹션 컴포넌트 분리
- [ ] Step 1.4: 메인 컨테이너 단순화
- [ ] 통합 테스트: 기존 기능 100% 동작
- [ ] 성능 테스트: 렌더링 횟수 비교
- [ ] 코드 리뷰: 팀 승인

**예상 기간**: 2-3주  
**담당**: 프론트엔드 팀  
**우선순위**: P0

---

## 🔧 Phase 2: 백엔드 서비스 레이어 통합 (P0)

### 현재 상태 분석
- **파일**: 
  - `welno_data_service.py` (1,726줄)
  - `wello_data_service.py` (1,366줄)
- **문제점**: 70% 코드 중복
- **차이점**: DB 설정만 다름

### 목표 구조

```python
app/services/
├── base/
│   ├── __init__.py
│   ├── base_health_data_service.py (800줄) - 공통 로직
│   └── connection_pool.py (100줄) - Connection Pool 관리
├── welno_data_service.py (300줄) - WELNO 특화
├── wello_data_service.py (300줄) - WELLO 특화
└── health_data_factory.py (50줄) - 서비스 팩토리
```

### 단계별 작업 계획

#### Step 2.1: Connection Pool 표준화 (1일)

**목표**: 전역 Connection Pool 구성

**작업**:
```python
# services/base/connection_pool.py
import asyncpg
from typing import Dict, Optional

class DatabasePool:
    """전역 Connection Pool 관리자"""
    
    _pools: Dict[str, asyncpg.Pool] = {}
    
    @classmethod
    async def get_pool(cls, db_name: str, config: dict) -> asyncpg.Pool:
        """Pool 가져오기 (없으면 생성)"""
        if db_name not in cls._pools:
            cls._pools[db_name] = await asyncpg.create_pool(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['user'],
                password=config['password'],
                min_size=5,
                max_size=20,
                command_timeout=60
            )
        return cls._pools[db_name]
    
    @classmethod
    async def close_all(cls):
        """모든 Pool 종료"""
        for pool in cls._pools.values():
            await pool.close()
        cls._pools.clear()

# 사용 예시
async def get_patient(uuid: str):
    pool = await DatabasePool.get_pool('welno', WELNO_DB_CONFIG)
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM welno_patients WHERE uuid=$1", uuid)
```

**검증**:
- [ ] Pool 재사용 확인
- [ ] Connection 누수 테스트
- [ ] 성능 벤치마크 (기존 대비 +30% 예상)

---

#### Step 2.2: Base 서비스 클래스 추출 (3-4일)

**목표**: 공통 CRUD 로직 추상화

**작업**:
```python
# services/base/base_health_data_service.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import asyncpg

class BaseHealthDataService(ABC):
    """건강 데이터 서비스 Base 클래스"""
    
    def __init__(self, db_config: dict, db_name: str):
        self.db_config = db_config
        self.db_name = db_name
        self._pool: Optional[asyncpg.Pool] = None
    
    async def get_pool(self) -> asyncpg.Pool:
        """Connection Pool 가져오기"""
        if not self._pool:
            self._pool = await DatabasePool.get_pool(self.db_name, self.db_config)
        return self._pool
    
    # ========================================
    # 공통 환자 정보 조회 (welno/wello 동일)
    # ========================================
    
    async def get_patient_by_uuid(
        self,
        uuid: str,
        hospital_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """UUID로 환자 조회"""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            query = self._build_patient_query(hospital_id)
            params = [uuid, hospital_id] if hospital_id else [uuid]
            row = await conn.fetchrow(query, *params)
            
            if not row:
                return None
            
            return dict(row)
    
    @abstractmethod
    def _build_patient_query(self, hospital_id: Optional[str]) -> str:
        """환자 조회 쿼리 (서브클래스 구현)"""
        pass
    
    # ========================================
    # 공통 건강 데이터 저장 (welno/wello 동일)
    # ========================================
    
    async def save_health_data(
        self,
        patient_uuid: str,
        hospital_id: str,
        health_data: Dict[str, Any],
        session_id: str,
        data_source: str = 'tilko',
        partner_id: Optional[str] = None,
        partner_oid: Optional[str] = None
    ) -> bool:
        """건강검진 데이터 저장"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                # 데이터 검증
                if data_source not in ('tilko', 'indexeddb', 'partner'):
                    data_source = 'tilko'
                
                # 기존 데이터 삭제
                await self._delete_old_data(conn, patient_uuid, hospital_id)
                
                # 신규 데이터 저장
                saved_count = await self._insert_health_data(
                    conn, patient_uuid, hospital_id, health_data,
                    data_source, partner_id, partner_oid
                )
                
                # 환자 테이블 업데이트
                await self._update_patient_flags(
                    conn, patient_uuid, hospital_id, data_source
                )
                
                return True
                
        except Exception as e:
            logger.error(f"[건강검진저장] 오류: {e}")
            return False
    
    @abstractmethod
    async def _delete_old_data(self, conn, uuid: str, hospital_id: str):
        """기존 데이터 삭제 (테이블명 차이)"""
        pass
    
    @abstractmethod
    async def _insert_health_data(self, conn, uuid: str, hospital_id: str, data: dict, **kwargs):
        """건강 데이터 INSERT (테이블명 차이)"""
        pass
    
    @abstractmethod
    async def _update_patient_flags(self, conn, uuid: str, hospital_id: str, data_source: str):
        """환자 플래그 업데이트 (테이블명 차이)"""
        pass
    
    # ========================================
    # 공통 유틸리티 메서드
    # ========================================
    
    def _serialize_dates(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """날짜 필드 ISO 형식 변환 (welno/wello 동일)"""
        date_fields = ['birth_date', 'last_data_update', 'last_auth_at', 'created_at', 'updated_at']
        for field in date_fields:
            if field in data and data[field]:
                if isinstance(data[field], (date, datetime)):
                    data[field] = data[field].isoformat()
        return data
```

**검증**:
- [ ] 추상 메서드 정의 완료
- [ ] 타입 힌트 정확성
- [ ] Docstring 완비

---

#### Step 2.3: WELNO/WELLO 서비스 단순화 (2일)

**목표**: Base 클래스 상속으로 코드 축소

**작업**:
```python
# services/welno_data_service.py (300줄)
from .base.base_health_data_service import BaseHealthDataService

WELNO_DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

class WelnoDataService(BaseHealthDataService):
    """WELNO 건강정보 데이터 관리 서비스"""
    
    def __init__(self):
        super().__init__(WELNO_DB_CONFIG, 'welno')
    
    def _build_patient_query(self, hospital_id: Optional[str]) -> str:
        """WELNO 환자 조회 쿼리"""
        base_cols = "id, uuid, hospital_id, name, phone_number, birth_date, ..."
        
        if hospital_id:
            return f"SELECT {base_cols} FROM welno.welno_patients WHERE uuid=$1 AND hospital_id=$2"
        else:
            return f"SELECT {base_cols} FROM welno.welno_patients WHERE uuid=$1"
    
    async def _delete_old_data(self, conn, uuid: str, hospital_id: str):
        """WELNO 기존 데이터 삭제"""
        await conn.execute(
            "DELETE FROM welno.welno_checkup_data WHERE patient_uuid=$1 AND hospital_id=$2",
            uuid, hospital_id
        )
    
    async def _insert_health_data(self, conn, uuid: str, hospital_id: str, data: dict, **kwargs):
        """WELNO 건강 데이터 INSERT"""
        data_source = kwargs.get('data_source', 'tilko')
        partner_id = kwargs.get('partner_id')
        partner_oid = kwargs.get('partner_oid')
        
        saved_count = 0
        for item in data.get('ResultList', []):
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, data_source, partner_id, partner_oid, ...)
                VALUES ($1, $2, $3, $4, $5, $6, ...)
            """, uuid, hospital_id, json.dumps(item), data_source, partner_id, partner_oid)
            saved_count += 1
        
        return saved_count
    
    async def _update_patient_flags(self, conn, uuid: str, hospital_id: str, data_source: str):
        """WELNO 환자 플래그 업데이트"""
        await conn.execute("""
            UPDATE welno.welno_patients
            SET has_health_data = TRUE,
                last_data_update = NOW(),
                data_source = $3
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id, data_source)
    
    # ========================================
    # WELNO 전용 메서드 (get_unified_status 등)
    # ========================================
    
    async def get_unified_status(self, uuid: str, hospital_id: str, partner_id: Optional[str] = None):
        """통합 상태 조회 (WELNO 전용)"""
        # 기존 로직 유지
        pass

# 총 라인 수: ~300줄 (기존 1,726줄에서 -83% 감소)
```

**WELLO도 동일 패턴**:
```python
# services/wello_data_service.py (300줄)
class WelloDataService(BaseHealthDataService):
    """WELLO 건강정보 데이터 관리 서비스"""
    
    def __init__(self):
        super().__init__(WELLO_DB_CONFIG, 'wello')
    
    # 추상 메서드 구현 (테이블명만 다름)
    def _build_patient_query(self, hospital_id: Optional[str]) -> str:
        # wello.wello_patients 사용
        pass
    
    async def _delete_old_data(self, conn, uuid: str, hospital_id: str):
        # wello.wello_checkup_data 사용
        pass
    
    # ... 나머지 동일 패턴
```

**검증**:
- [ ] 기존 API 호환성 100%
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과

---

#### Step 2.4: 서비스 팩토리 패턴 (1일)

**목표**: 서비스 인스턴스 관리 단순화

**작업**:
```python
# services/health_data_factory.py
from typing import Literal
from .welno_data_service import WelnoDataService
from .wello_data_service import WelloDataService

ServiceType = Literal['welno', 'wello']

class HealthDataFactory:
    """건강 데이터 서비스 팩토리"""
    
    _instances = {}
    
    @classmethod
    def get_service(cls, service_type: ServiceType):
        """서비스 인스턴스 가져오기 (싱글톤)"""
        if service_type not in cls._instances:
            if service_type == 'welno':
                cls._instances[service_type] = WelnoDataService()
            elif service_type == 'wello':
                cls._instances[service_type] = WelloDataService()
            else:
                raise ValueError(f"Unknown service type: {service_type}")
        
        return cls._instances[service_type]

# 사용 예시
welno_service = HealthDataFactory.get_service('welno')
wello_service = HealthDataFactory.get_service('wello')

# 싱글톤 보장
assert HealthDataFactory.get_service('welno') is welno_service
```

**검증**:
- [ ] 싱글톤 패턴 동작
- [ ] 타입 안정성 확인

---

### Phase 2 체크리스트

- [ ] Step 2.1: Connection Pool 구현
- [ ] Step 2.2: Base 서비스 추출
- [ ] Step 2.3: WELNO/WELLO 단순화
- [ ] Step 2.4: 팩토리 패턴 적용
- [ ] 성능 테스트: Connection 재사용 확인
- [ ] 통합 테스트: 모든 API 정상 동작
- [ ] 코드 리뷰: 팀 승인

**예상 기간**: 1-2주  
**담당**: 백엔드 팀  
**우선순위**: P0  
**기대 효과**: 
- 코드 중복 -70%
- 성능 +30% (Connection Pool)
- 유지보수 시간 -50%

---

## 🔄 Phase 3: tilko_auth.py 레이어 분리 (P1)

### 현재 상태
- **파일**: `tilko_auth.py` (2,421줄)
- **문제**: 인증 + 데이터 수집 + 세션 관리 혼재

### 목표 구조

```python
app/api/v1/endpoints/
├── tilko/
│   ├── __init__.py
│   ├── auth.py (500줄) - 인증 엔드포인트
│   ├── data_collection.py (600줄) - 데이터 수집 엔드포인트
│   └── session.py (400줄) - 세션 관리 엔드포인트

app/services/tilko/
├── __init__.py
├── auth_service.py (300줄) - 인증 로직
├── scraping_service.py (400줄) - 스크래핑 로직
└── session_service.py (200줄) - 세션 관리 로직
```

### 단계별 작업 (생략 - 필요 시 상세화)

---

## 📱 Phase 4: 프론트엔드 큰 페이지들 컴포넌트화 (P2)

### 대상 파일
1. `ComprehensiveAnalysisPage.tsx` (2,057줄)
2. `CheckupRecommendationsPage.tsx` (1,986줄)
3. `AIAnalysisSection/index.tsx` (1,977줄)
4. `SurveySlideUpPanel.tsx` (1,734줄)
5. `MainPage.tsx` (1,653줄)
6. `AuthForm.tsx` (1,612줄)

### 우선순위
1. **AuthForm** (가장 재사용 많음)
2. **MainPage** (진입점)
3. 나머지 순차 진행

### 방법론
- DiseaseReportPage 리팩토링 패턴 재사용
- 단계별 점진적 분리
- 기능 동일성 보장

---

## 🎯 전체 타임라인

```
Week 1-3:   Phase 1 (DiseaseReportPage)
Week 4-5:   Phase 2 (백엔드 서비스 통합)
Week 6-7:   Phase 3 (tilko_auth 분리)
Week 8-12:  Phase 4 (프론트 페이지들)
```

---

## 📊 기대 효과

| 항목 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| 평균 파일 크기 | 550줄 | 300줄 | -45% |
| 최대 파일 크기 | 1,984줄 | 800줄 | -60% |
| 코드 중복률 | 25% | 8% | -68% |
| useState 평균 | 8.6개 | 3.5개 | -59% |
| Connection Pool | 30% | 100% | +233% |
| 빌드 시간 | 45초 | 35초 | -22% |

---

## ✅ 다음 액션

1. **즉시**: Phase 1 Step 1.1 시작 (타입 추출)
2. **금주 내**: Phase 2 Step 2.1 시작 (Connection Pool)
3. **팀 리뷰**: 이 플랜 문서 검토 및 승인

**플랜 작성 완료!** 🎉
