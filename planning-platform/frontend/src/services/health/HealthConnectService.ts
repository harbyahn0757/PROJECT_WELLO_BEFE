/**
 * 건강 데이터 연동 서비스
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  HealthData,
  HealthDataResponse,
  TilkoAuthRequest,
  TilkoAuthResponse,
  TilkoHealthDataRequest,
  HealthConnectError,
  HealthConnectConfig
} from '../../types/health';

class HealthConnectService {
  private api: AxiosInstance;
  private config: HealthConnectConfig;

  constructor(config?: Partial<HealthConnectConfig>) {
    this.config = {
      apiHost: process.env.REACT_APP_TILKO_API_HOST || 'http://localhost:8001',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.api = axios.create({
      baseURL: this.config.apiHost,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 요청 인터셉터
    this.api.interceptors.request.use(
      (config: any) => {
        console.log(`[HealthConnect] API 요청: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        console.error('[HealthConnect] 요청 에러:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.api.interceptors.response.use(
      (response: any) => {
        console.log(`[HealthConnect] API 응답: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        console.error('[HealthConnect] 응답 에러:', error);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * 에러 처리
   */
  private handleError(error: any): HealthConnectError {
    const healthError: HealthConnectError = new Error();

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        // 서버 응답 에러
        const responseData = axiosError.response.data as any;
        healthError.message = responseData?.message || '서버 에러가 발생했습니다';
        healthError.code = responseData?.errorCode || `HTTP_${axiosError.response.status}`;
        healthError.details = responseData?.details;
      } else if (axiosError.request) {
        // 네트워크 에러
        healthError.message = '네트워크 연결에 실패했습니다';
        healthError.code = 'NETWORK_ERROR';
      } else {
        // 기타 에러
        healthError.message = axiosError.message || '알 수 없는 에러가 발생했습니다';
        healthError.code = 'UNKNOWN_ERROR';
      }
    } else {
      healthError.message = error.message || '알 수 없는 에러가 발생했습니다';
      healthError.code = 'UNKNOWN_ERROR';
    }

    return healthError;
  }

  /**
   * 재시도 로직
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempts > 1) {
        console.log(`[HealthConnect] 재시도 ${this.config.retryAttempts - attempts + 1}/${this.config.retryAttempts}`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.withRetry(operation, attempts - 1);
      }
      throw error;
    }
  }

  /**
   * Tilko 사용자 인증
   */
  async authenticate(authRequest: TilkoAuthRequest): Promise<TilkoAuthResponse> {
    return this.withRetry(async () => {
      const response = await this.api.post<TilkoAuthResponse>(
        '/health-connect/auth',
        authRequest
      );
      return response.data;
    });
  }

  /**
   * 건강검진 데이터 조회
   */
  async getHealthScreeningData(request: TilkoHealthDataRequest): Promise<any> {
    return this.withRetry(async () => {
      const response = await this.api.post(
        '/health-connect/checkup',
        request
      );
      return response.data;
    });
  }

  /**
   * 처방전 데이터 조회
   */
  async getPrescriptionData(request: TilkoHealthDataRequest): Promise<any> {
    return this.withRetry(async () => {
      const response = await this.api.post(
        '/health-connect/prescription',
        request
      );
      return response.data;
    });
  }

  /**
   * 통합 건강 데이터 조회
   */
  async getHealthData(
    token: string,
    startDate?: string,
    endDate?: string
  ): Promise<HealthDataResponse> {
    return this.withRetry(async () => {
      const params = new URLSearchParams();
      params.append('token', token);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await this.api.get<HealthDataResponse>(
        `/health-connect/data?${params.toString()}`
      );
      return response.data;
    });
  }

  /**
   * 서비스 상태 확인
   */
  async getStatus(): Promise<any> {
    try {
      const response = await this.api.get('/health-connect/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 데이터 변환 유틸리티
   */
  transformHealthData(rawData: any): HealthData {
    return {
      checkupResults: rawData.checkupResults || [],
      prescriptions: rawData.prescriptions || [],
      lastUpdated: rawData.lastUpdated || new Date().toISOString()
    };
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 수치 정규화
   */
  normalizeValue(value: string, unit?: string): string {
    if (!value) return '-';
    
    // 단위가 있는 경우
    if (unit) {
      return `${value} ${unit}`;
    }
    
    // 숫자인 경우 소수점 처리
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2);
    }
    
    return value;
  }

  /**
   * 검진 결과 상태 판단
   */
  getResultStatus(item: any): 'normal' | 'abnormal' | 'warning' {
    if (item.isNormal === true) return 'normal';
    if (item.isNormal === false) return 'abnormal';
    return 'warning';
  }

  /**
   * 검진 결과 필터링
   */
  filterCheckupResults(results: any[], filters: any): any[] {
    return results.filter(result => {
      // 연도 필터
      if (filters.year && filters.year !== 0) {
        const resultYear = new Date(result.date).getFullYear();
        if (resultYear !== filters.year) return false;
      }

      // 카테고리 필터
      if (filters.category && filters.category !== 'all') {
        const hasCategory = result.categories?.some((cat: any) => 
          cat.name.toLowerCase().includes(filters.category.toLowerCase())
        );
        if (!hasCategory) return false;
      }

      // 검색어 필터
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          result.hospitalName?.toLowerCase().includes(searchTerm) ||
          result.doctorName?.toLowerCase().includes(searchTerm) ||
          result.overallStatus?.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }

  /**
   * 처방전 필터링
   */
  filterPrescriptions(prescriptions: any[], filters: any): any[] {
    return prescriptions.filter(prescription => {
      // 날짜 범위 필터
      if (filters.startDate || filters.endDate) {
        const prescriptionDate = new Date(prescription.date);
        if (filters.startDate && prescriptionDate < new Date(filters.startDate)) return false;
        if (filters.endDate && prescriptionDate > new Date(filters.endDate)) return false;
      }

      // 진료과 필터
      if (filters.department && filters.department !== 'all') {
        if (prescription.department !== filters.department) return false;
      }

      // 병원명 필터
      if (filters.hospitalName) {
        const hospitalName = filters.hospitalName.toLowerCase();
        if (!prescription.hospitalName?.toLowerCase().includes(hospitalName)) return false;
      }

      return true;
    });
  }
}

// 싱글톤 인스턴스 생성
export const healthConnectService = new HealthConnectService();

export default HealthConnectService;
