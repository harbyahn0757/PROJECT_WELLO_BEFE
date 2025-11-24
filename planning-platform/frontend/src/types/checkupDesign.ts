/**
 * 검진 설계 관련 타입 정의
 */

export type ConcernTab = 'checkup' | 'hospital' | 'medication';

export interface CheckupConcernItem {
  id: string;
  name: string; // '혈당', '총콜레스테롤' 등
  value: number;
  unit: string; // 'mg/dL', 'cm' 등
  date: string; // '2023-05-15'
  location: string; // '서울대학교병원'
  status: 'warning' | 'abnormal';
  checkupDate: string;
  year: string; // '2023년'
}

export interface HospitalConcernItem {
  id: string;
  hospitalName: string;
  checkupDate: string;
  abnormalCount: number;
  warningCount: number;
  items: CheckupConcernItem[];
}

export interface MedicationConcernItem {
  id: string;
  medicationName: string;
  startDate: string;
  endDate?: string;
  period: string; // '2023-01-15 ~ 2023-06-15'
  hospitalName: string;
  prescriptionDate: string;
}

export type ConcernItem = CheckupConcernItem | HospitalConcernItem | MedicationConcernItem;

// API 요청용 ConcernItem (백엔드와 통신)
export interface ConcernItemForAPI {
  type: 'checkup' | 'hospital' | 'medication';
  id: string;
  name?: string;
  date?: string;
  value?: number;
  unit?: string;
  status?: 'warning' | 'abnormal';
  location?: string;
  hospitalName?: string;
  checkupDate?: string;
  abnormalCount?: number;
  warningCount?: number;
  medicationName?: string;
  period?: string;
}

// HealthDataViewer 형식: { ResultList: any[] }
export interface HealthDataFormat {
  ResultList: any[];
}

export interface ConcernSelectionProps {
  healthData: HealthDataFormat | any[];
  prescriptionData: HealthDataFormat | any[];
  onSelectionChange: (selectedItems: Set<string>) => void;
  onNext: (selectedItems: Set<string>, selectedConcerns: ConcernItemForAPI[]) => void;
}

