// AIMS 리포트 데이터 타입 정의

export interface AIMSInfluence {
  name: string;
  code: string;
  label: string;
}

export interface AIMSDataItem {
  name: string;
  code: string;
  type: 'disease' | 'cancer';
  label: 'NORMAL' | 'BOUNDARY' | 'ABNORMAL';
  rank: number;
  average: number;
  rate: number;
  influence: AIMSInfluence[] | null;
}

export interface AIMSResponse {
  bodyage: number;
  rank: number;
  data: AIMSDataItem[];
}

export interface AIMSReportData {
  aims_response: AIMSResponse;
  customer_info: {
    name: string | null;
    birthday: string | null;
    gender: string | null;
  };
  updated_at?: string | null; // 리포트 업데이트 시간 (ISO 형식)
}

export interface AIMSReportApiResponse {
  success: boolean;
  has_report?: boolean; // 결과지 존재 여부
  data?: AIMSReportData;
  message?: string; // 결과지가 없을 때 메시지
  error?: string;
}


