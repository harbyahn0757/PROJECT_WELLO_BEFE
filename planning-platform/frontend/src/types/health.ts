/**
 * WELLO 건강정보 시스템 TypeScript 타입 정의
 * 백엔드 API 응답 구조 기반
 */

// === 기본 응답 구조 ===
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// === 환자 정보 ===
export interface Patient {
  id: number;
  uuid: string;
  hospital_id: string;
  name: string;
  phone_number: string;
  birth_date: string; // YYYY-MM-DD
  gender?: 'M' | 'F';
  last_auth_at?: string;
  tilko_session_id?: string;
  has_health_data: boolean;
  has_prescription_data: boolean;
  last_data_update?: string;
  created_at: string;
  updated_at: string;
}

// === Tilko API 원본 데이터 구조 ===
export interface TilkoHealthCheckupRaw {
  Year: string;
  CheckUpDate: string;
  Code: string; // 정상, 의심, 질환의심 등
  Location: string;
  Description: string;
  Inspections: TilkoInspectionGroup[];
  // ... 기타 Tilko API가 제공하는 모든 필드
}

export interface TilkoInspectionGroup {
  Gubun: string; // 계측검사, 요검사, 혈액검사 등
  Illnesses: TilkoIllness[];
}

export interface TilkoIllness {
  Name: string; // 비만, 시각이상, 고혈압, 당뇨병 등
  Items: TilkoTestItem[];
}

export interface TilkoTestItem {
  Name: string; // 신장, 체중, 혈압(최고/최저), 공복혈당 등
  Value: string;
  Unit: string;
  ItemReferences: { Name: string; Value: string }[];
}

export interface TilkoPrescriptionRaw {
  Idx: string;
  Page: string;
  ByungEuiwonYakGukMyung: string; // 병원/약국명
  Address: string;
  JinRyoGaesiIl: string; // 진료 개시일
  JinRyoHyungTae: string; // 진료 형태
  BangMoonIpWonIlsoo: string; // 방문/입원 일수
  CheoBangHoiSoo: string; // 처방 횟수
  TuYakYoYangHoiSoo: string; // 투약/요양 횟수
  RetrieveTreatmentInjectionInformationPersonDetailList: TilkoPrescriptionDetail[];
  // ... 기타 Tilko API가 제공하는 모든 필드
}

export interface TilkoPrescriptionDetail {
  Idx: string;
  JinRyoChoBangIlja: string; // 진료/처방 일자
  JinRyoHyungTae: string; // 진료 형태
  ChoBangHoetSoo: string | null; // 처방 횟수 (약국)
  ChoBangYakPumMyung: string; // 처방 약품명
  ChoBangYakPumHyoneung: string; // 처방 약품 효능
  TuyakIlSoo: string; // 투약 일수
  DrugCode: string; // 약품 코드
  NameAddr: string; // 약국명[주소]
  RetrieveMdsupDtlInfo: TilkoDrugDetailInfo; // 약품 상세 정보
  // ... 기타 상세 필드
}

export interface TilkoDrugDetailInfo {
  DrugCode: string;
  MediPrdcNm: string; // 의약품 제품명
  DrugImage: string; // 약품 이미지 (Base64 또는 URL)
  CmpnInfo: string; // 성분 정보
  TmsgGnlSpcd: string; // 특수 코드
  SnglCmtnYn: string | null; // 단일 성분 여부
  UpsoName: string; // 업체명
  FomlCdXplnCnte: string; // 제형 설명
  MdctPathXplnCnte: string; // 투여 경로 설명
  MohwClsfNoXplnCnte: string; // 보건복지부 분류 번호 설명
  AtcInfo: string; // ATC 코드 정보
  KpicInfo: string; // KPIC 정보
  EfftEftCnte: string; // 효능 효과 내용
  UsagCpctCnte: string; // 용법 용량 내용
  UseAtntMttCnte: string; // 사용상 주의사항 내용
  CmnTmdcGdncCnte: string; // 일반 의약품 안내 내용
  // ... 기타 상세 필드
}

// === 건강검진 데이터 ===
export interface HealthCheckupRecord {
  id: number;
  patient_id: number;
  raw_data: TilkoHealthCheckupRaw; // 원본 Tilko API 데이터
  year?: string;
  checkup_date?: string;
  location?: string;
  code?: string;
  description?: string;
  // 추출된 주요 지표
  height?: number;
  weight?: number;
  bmi?: number;
  waist_circumference?: number;
  blood_pressure_high?: number;
  blood_pressure_low?: number;
  blood_sugar?: number;
  cholesterol?: number;
  hdl_cholesterol?: number;
  ldl_cholesterol?: number;
  triglyceride?: number;
  hemoglobin?: number;
  collected_at: string;
  created_at: string;
  updated_at: string;
}

// === 처방전 데이터 ===
export interface PrescriptionRecord {
  id: number;
  patient_id: number;
  raw_data: TilkoPrescriptionData; // 원본 Tilko API 데이터
  idx?: string;
  page?: string;
  hospital_name?: string;
  address?: string;
  treatment_date?: string; // YYYY-MM-DD
  treatment_type?: string;
  visit_count?: number;
  prescription_count?: number;
  medication_count?: number;
  detail_records_count: number;
  collected_at: string;
  created_at: string;
  updated_at: string;
}

// === Tilko API 원본 데이터 구조 ===
export interface TilkoHealthData {
  Year: string;
  CheckUpDate: string;
  Code: string;
  Location: string;
  Description: string;
  Inspections: HealthInspection[];
}

export interface HealthInspection {
  Gubun: string; // 검사 구분 (계측검사, 요검사, 혈액검사, 영상검사, 골다공증)
  Illnesses: HealthIllness[];
}

export interface HealthIllness {
  Name: string; // 질환명 (비만, 고혈압, 당뇨병, 이상지질혈증 등)
  Items: HealthItem[];
}

export interface HealthItem {
  Name: string; // 검사항목명 (신장, 체중, 혈압, 혈당 등)
  Value: string; // 측정값
  Unit: string; // 단위
  ItemReferences: HealthReference[];
}

export interface HealthReference {
  Name: string; // 기준 구분 (정상(A), 정상(B), 질환의심)
  Value: string; // 기준값 범위
}

export interface TilkoPrescriptionData {
  Idx: string;
  Page: string;
  ByungEuiwonYakGukMyung: string; // 병원/약국명
  Address: string;
  JinRyoGaesiIl: string; // 진료개시일 (YYYY-MM-DD)
  JinRyoHyungTae: string; // 진료형태
  BangMoonIpWonIlsoo: string; // 방문입원일수
  CheoBangHoiSoo: string; // 처방회수
  TuYakYoYangHoiSoo: string; // 투약요양회수
  RetrieveTreatmentInjectionInformationPersonDetailList: PrescriptionDetail[];
}

export interface PrescriptionDetail {
  Idx: string;
  JinRyoChoBangIlja: string; // 진료처방일자
  JinRyoHyungTae: string; // 진료형태
  ChoBangHoetSoo?: string; // 처방횟수
  ChoBangYakPumMyung: string; // 처방약품명
  ChoBangYakPumHyoneung: string; // 처방약품효능
  TuyakIlSoo: string; // 투약일수
  DrugCode: string; // 약품코드
  NameAddr: string; // 병원/약국 이름 및 주소
  RetrieveMdsupDtlInfo?: {
    DrugCode: string;
    MediPrdcNm: string; // 의약품명
    DrugImage?: string; // 약품 이미지 (Base64)
    [key: string]: any;
  };
}

// === 건강 지표 추이 데이터 ===
export interface HealthTrend {
  label: string; // 지표명
  unit: string; // 단위
  data: HealthTrendPoint[];
}

export interface HealthTrendPoint {
  date: string; // 검진일
  value?: number; // 단일 값 (신장, 체중, BMI, 혈당, 콜레스테롤 등)
  high?: number; // 최고값 (혈압)
  low?: number; // 최저값 (혈압)
  year: string;
  checkup_date: string;
}

export interface HealthTrendsResponse {
  patient: Patient;
  trends: Record<string, HealthTrend>;
  total_records: number;
}

// === 처방전 이력 데이터 ===
export interface PrescriptionHistory {
  patient: Patient;
  hospitals: HospitalPrescriptionGroup[];
  total_records: number;
}

export interface HospitalPrescriptionGroup {
  hospital_name: string;
  address: string;
  total_visits: number;
  prescriptions: PrescriptionSummary[];
}

export interface PrescriptionSummary {
  treatment_date?: string;
  treatment_type?: string;
  visit_count?: number;
  prescription_count?: number;
  medication_count?: number;
  detail_records_count: number;
  raw_data: TilkoPrescriptionData;
}

// === 기존 데이터 확인 응답 ===
export interface ExistingDataCheck {
  exists: boolean;
  patient?: Patient;
  health_data_count: number;
  prescription_data_count: number;
  last_update?: string;
  error?: string;
}

// === 차트 관련 타입 ===
export type ChartType = 'line' | 'bar' | 'area' | 'scatter';

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, any>;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
  type?: ChartType;
}

export interface ChartConfig {
  title?: string;
  subtitle?: string;
  xAxis?: {
    title?: string;
    type?: 'category' | 'datetime' | 'numeric';
    format?: string;
  };
  yAxis?: {
    title?: string;
    min?: number;
    max?: number;
    format?: string;
  };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right';
  };
  tooltip?: {
    show?: boolean;
    format?: string;
  };
  colors?: string[];
  height?: number;
  responsive?: boolean;
}

// === 건강 상태 평가 ===
export type HealthStatus = 'normal' | 'warning' | 'danger' | 'unknown';

export interface HealthMetric {
  name: string;
  value: number | string;
  unit?: string;
  status: HealthStatus;
  reference?: {
    normal?: string;
    warning?: string;
    danger?: string;
  };
  trend?: 'up' | 'down' | 'stable';
  change?: number;
}

export interface HealthSummary {
  patient: Patient;
  last_checkup?: {
    date: string;
    location: string;
    overall_status: HealthStatus;
  };
  key_metrics: HealthMetric[];
  alerts: HealthAlert[];
  recommendations: string[];
}

export interface HealthAlert {
  type: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  metric?: string;
  created_at: string;
}

// === 컴포넌트 Props 타입 ===
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface LoadingState {
  loading: boolean;
  error?: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// === 훅 반환 타입 ===
export interface UseHealthDataReturn extends LoadingState {
  patient?: Patient;
  healthData: HealthCheckupRecord[];
  prescriptionData: PrescriptionRecord[];
  refresh: () => Promise<void>;
  checkExistingData: () => Promise<ExistingDataCheck>;
}

export interface UseHealthTrendsReturn extends LoadingState {
  trends: Record<string, HealthTrend>;
  patient?: Patient;
  totalRecords: number;
  refresh: () => Promise<void>;
}

export interface UsePrescriptionHistoryReturn extends LoadingState {
  hospitals: HospitalPrescriptionGroup[];
  patient?: Patient;
  totalRecords: number;
  refresh: () => Promise<void>;
}

// === 기존 컴포넌트 호환성을 위한 타입들 ===

// 레거시 HealthData 타입 (기존 컴포넌트 호환용)
export interface HealthData {
  checkups?: HealthCheckupRecord[];
  prescriptions?: PrescriptionRecord[];
  patient?: Patient;
  lastUpdate?: string;
  // 서비스에서 사용하는 필드들
  checkupResults?: any[];
  lastUpdated?: string;
}

export interface HealthDataState {
  data: HealthData | null;
  loading: boolean;
  error: HealthConnectError | null;
  lastFetch?: string | null;
}

export interface HealthDataResponse {
  success: boolean;
  data: HealthData;
  message?: string;
}

// Tilko 관련 요청/응답 타입
export interface TilkoAuthRequest {
  name: string;
  phone: string;
  birthday: string;
  uuid: string;
  hospital_id: string;
}

export interface TilkoAuthResponse {
  success: boolean;
  session_id: string;
  auth_key?: string;
  message?: string;
  token?: string;
}

export interface TilkoHealthDataRequest {
  session_id: string;
  collect_type?: 'health' | 'prescription' | 'both';
}

// 에러 타입
export interface HealthConnectError {
  code: string;
  message: string;
  name?: string;
  details?: any;
}

// 서비스 설정 타입
export interface HealthConnectConfig {
  baseURL?: string;
  timeout: number;
  retryAttempts: number;
  apiHost?: string;
  retryDelay?: number;
}

// 필터 관련 타입
export interface FilterState {
  dateRange?: {
    start?: string;
    end?: string;
  };
  location?: string;
  status?: HealthStatus[];
  searchTerm?: string;
  // 컴포넌트에서 실제 사용하는 필드들
  year?: number;
  category?: string;
  hospitalName?: string;
  startDate?: string;
  endDate?: string;
  department?: string;
}

export interface PrescriptionFilter {
  dateRange?: {
    start?: string;
    end?: string;
  };
  hospital?: string;
  treatmentType?: string;
  searchTerm?: string;
  // 컴포넌트에서 실제 사용하는 필드들
  startDate?: string;
  endDate?: string;
  department?: string;
  hospitalName?: string;
}

// 검진 결과 타입
export interface CheckupResult {
  id: string;
  date: string;
  location: string;
  status: HealthStatus;
  categories: ResultCategory[];
  recommendations: string[];
  overallScore?: number;
  // 컴포넌트에서 실제 사용하는 필드들
  overallStatus?: string;
  hospitalName?: string;
  doctorName?: string;
}

export interface ResultCategory {
  name: string;
  status: HealthStatus;
  items: ResultItem[];
  summary?: string;
}

export interface ResultItem {
  name: string;
  value: string | number;
  unit?: string;
  isNormal: boolean;
  reference?: string;
  status: HealthStatus;
}

// 처방전 타입 (레거시 호환)
export interface Prescription {
  id: string;
  date: string;
  hospital: string;
  address?: string;
  treatmentType: string;
  medications: Medication[];
  visitCount?: number;
  prescriptionCount?: number;
  // 컴포넌트에서 실제 사용하는 필드들
  hospitalName?: string;
  doctorName?: string;
  diagnosis?: string;
  department?: string;
  totalCost?: number;
  insuranceCoverage?: number;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  code?: string;
  image?: string;
  // 컴포넌트에서 실제 사용하는 필드들
  totalAmount?: number;
}

// 컴포넌트 Props 타입들
export interface FilterSectionProps extends BaseComponentProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface HealthDataViewerProps extends BaseComponentProps {
  onBack?: () => void;
  uuid?: string;
  hospitalId?: string;
  onError?: (error: string) => void;
}

export interface PrescriptionSectionProps extends BaseComponentProps {
  prescriptions: Prescription[];
  loading?: boolean;
  onPrescriptionClick?: (prescription: Prescription) => void;
  selectedPrescriptions?: string[];
  onSelectionChange?: (prescriptionId: string) => void;
}

export interface ResultsSectionProps extends BaseComponentProps {
  results: CheckupResult[];
  loading?: boolean;
  onResultClick?: (result: CheckupResult) => void;
  sortBy?: 'date' | 'status' | 'location' | 'hospital';
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: 'date' | 'status' | 'location' | 'hospital', sortOrder?: 'asc' | 'desc') => void;
}
