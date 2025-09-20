/**
 * 건강 데이터 관련 타입 정의
 */

// 검진 항목
export interface CheckupItem {
  name: string;
  value: string;
  unit?: string;
  normalRange?: string;
  isNormal: boolean;
  reference?: string;
}

// 검진 카테고리
export interface CheckupCategory {
  name: string;
  items: CheckupItem[];
}

// 검진 결과
export interface CheckupResult {
  id: string;
  date: string;
  hospitalName: string;
  doctorName?: string;
  categories: CheckupCategory[];
  overallStatus: string;
  recommendations?: string[];
}

// 처방 의약품
export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  totalAmount?: number;
}

// 처방전
export interface Prescription {
  id: string;
  date: string;
  hospitalName: string;
  doctorName: string;
  department: string;
  diagnosis?: string;
  medications: Medication[];
  totalCost?: number;
  insuranceCoverage?: number;
}

// 통합 건강 데이터
export interface HealthData {
  checkupResults: CheckupResult[];
  prescriptions: Prescription[];
  lastUpdated: string;
}

// API 응답 타입
export interface HealthDataResponse {
  success: boolean;
  data?: HealthData;
  message: string;
  errorCode?: string;
}

export interface ErrorResponse {
  success: boolean;
  message: string;
  errorCode: string;
  details?: Record<string, any>;
}

// Tilko API 요청/응답 타입
export interface TilkoAuthRequest {
  userName: string;
  phoneNumber: string;
  birthDate: string;
  gender: 'M' | 'F';
}

export interface TilkoAuthResponse {
  success: boolean;
  token?: string;
  message: string;
  expiresAt?: string;
}

export interface TilkoHealthDataRequest {
  token: string;
  startDate?: string;
  endDate?: string;
}

// 상태 관리 타입
export interface HealthDataState {
  data: HealthData | null;
  loading: boolean;
  error: Error | null;
  lastFetch: string | null;
}

export interface FilterState {
  year: number;
  category: string;
  searchTerm: string;
  hospitalName?: string;
  startDate?: string;
  endDate?: string;
  department?: string;
}

// 결과 카테고리 타입
export type ResultCategory = 
  | 'all'
  | 'basic'
  | 'blood'
  | 'urine'
  | 'imaging'
  | 'cancer'
  | 'other';

// 처방전 필터 타입
export type PrescriptionFilter = {
  year?: number;
  startDate?: string;
  endDate?: string;
  department?: string;
  hospitalName?: string;
  searchTerm?: string;
};

// 로딩 상태 타입
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 에러 타입
export interface HealthConnectError extends Error {
  code?: string;
  details?: Record<string, any>;
}

// 컴포넌트 Props 타입
export interface HealthDataViewerProps {
  onBack?: () => void;
  onError?: (error: HealthConnectError) => void;
}

export interface FilterSectionProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  disabled?: boolean;
}

export interface ResultsSectionProps {
  results: CheckupResult[];
  loading?: boolean;
  onResultClick?: (result: CheckupResult) => void;
}

export interface PrescriptionSectionProps {
  prescriptions: Prescription[];
  loading?: boolean;
  onPrescriptionClick?: (prescription: Prescription) => void;
}

// 서비스 설정 타입
export interface HealthConnectConfig {
  apiHost: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}
