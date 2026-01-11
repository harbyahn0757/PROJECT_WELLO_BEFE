import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import { LayoutConfig as BaseLayoutConfig } from '../utils/layoutMapper';
import { PatientData as CommonPatientData, HospitalData as CommonHospitalData } from '../types/patient';
import { API_ENDPOINTS } from '../config/api';
import { StorageManager, STORAGE_KEYS } from '../constants/storage';

// 확장된 레이아웃 설정 (Context용)
export interface ExtendedLayoutConfig extends BaseLayoutConfig {
  hospitalName: string;
  brandColor: string;
  logoPosition: string;
}

// 통합 타입 사용 (중복 정의 제거)
export type PatientData = CommonPatientData;
export type HospitalData = CommonHospitalData;

export interface CacheData {
  patient: PatientData | null;
  hospital: HospitalData | null;
  layoutConfig: ExtendedLayoutConfig | null;
  timestamp: number;
  ttl: number;
}

// 알림 메시지 타입
export interface NotificationMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoClose?: boolean;
  duration?: number;
}

// Context 상태 인터페이스
export interface WelnoDataState {
  // 핵심 데이터
  patient: PatientData | null;
  hospital: HospitalData | null;
  layoutConfig: ExtendedLayoutConfig | null;
  
  // 상태 관리
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // 캐시 상태
  isCacheExpired: boolean;
  cacheExpiresAt: number | null;
  
  // 알림 시스템
  notifications: NotificationMessage[];
  
  // 네트워크 상태
  isOffline: boolean;
}

// Context Actions 인터페이스
export interface WelnoDataActions {
  // 데이터 로딩
  loadPatientData: (uuid: string, hospital: string, options?: { force?: boolean }) => Promise<void>;
  
  // 캐시 관리
  refreshData: () => Promise<void>;
  clearCache: () => void;
  
  // 알림 관리
  addNotification: (notification: Omit<NotificationMessage, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // 에러 처리
  clearError: () => void;
  
  // 세션 복구
  recoverSession: () => Promise<void>;
}

// Context 타입
export interface WelnoDataContextType {
  state: WelnoDataState;
  actions: WelnoDataActions;
}

// Context 생성
const WelnoDataContext = createContext<WelnoDataContextType | null>(null);

// 초기 상태
const initialState: WelnoDataState = {
  patient: null,
  hospital: null,
  layoutConfig: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  isCacheExpired: false,
  cacheExpiresAt: null,
  notifications: [],
  isOffline: false,
};

// 캐시 관리 클래스
class WelnoCacheManager {
  private static readonly CACHE_KEY = 'welno_data_cache';
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5분

  static setCache(uuid: string, data: Partial<CacheData>, ttl = this.DEFAULT_TTL): void {
    const existingCache = this.getCache(uuid);
    const cacheData: CacheData = {
      patient: data.patient || existingCache?.patient || null,
      hospital: data.hospital || existingCache?.hospital || null,
      layoutConfig: data.layoutConfig || existingCache?.layoutConfig || null,
      timestamp: Date.now(),
      ttl,
    };

    const cacheKey = `${this.CACHE_KEY}_${uuid}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    // localStorage에도 백업 (브라우저 재시작 대응)
    localStorage.setItem(cacheKey, JSON.stringify({
      ...cacheData,
      ttl: ttl * 2 // localStorage는 더 긴 TTL
    }));
  }

  static getCache(uuid: string): CacheData | null {
    const cacheKey = `${this.CACHE_KEY}_${uuid}`;
    
    // 1순위: sessionStorage
    let cached = sessionStorage.getItem(cacheKey);
    let isFromLocalStorage = false;
    
    // 2순위: localStorage
    if (!cached) {
      cached = localStorage.getItem(cacheKey);
      isFromLocalStorage = true;
    }

    if (cached) {
      try {
        const data: CacheData = JSON.parse(cached);
        const now = Date.now();
        
        if (now - data.timestamp < data.ttl) {
          // 유효한 캐시
          if (isFromLocalStorage) {
            // localStorage에서 복구되면 sessionStorage에도 복사
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
          }
          return data;
        } else {
          // 만료된 캐시 정리
          sessionStorage.removeItem(cacheKey);
          if (isFromLocalStorage) {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.error('캐시 파싱 오류:', error);
        this.clearCache(uuid);
      }
    }

    return null;
  }

  static clearCache(uuid?: string): void {
    if (uuid) {
      const cacheKey = `${this.CACHE_KEY}_${uuid}`;
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey);
    } else {
      // 모든 캐시 정리
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          sessionStorage.removeItem(key);
        }
      });
      
      const localKeys = Object.keys(localStorage);
      localKeys.forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  static isCacheExpired(uuid: string): boolean {
    const cache = this.getCache(uuid);
    if (!cache) return true;
    
    return Date.now() - cache.timestamp >= cache.ttl;
  }

  static getCacheExpirationTime(uuid: string): number | null {
    const cache = this.getCache(uuid);
    if (!cache) return null;
    
    return cache.timestamp + cache.ttl;
  }
}

// Provider Props
interface WelnoDataProviderProps {
  children: ReactNode;
}

// Provider 컴포넌트
export const WelnoDataProvider: React.FC<WelnoDataProviderProps> = ({ children }) => {
  const [state, setState] = useState<WelnoDataState>(initialState);
  const loadingRef = useRef<string | null>(null); // 현재 로딩 중인 UUID 추적

  // 알림 ID 생성
  const generateNotificationId = (): string => {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 알림 추가
  const addNotification = useCallback((notification: Omit<NotificationMessage, 'id'>) => {
    const id = generateNotificationId();
    const newNotification: NotificationMessage = {
      ...notification,
      id,
      autoClose: notification.autoClose ?? true,
      duration: notification.duration ?? 5000,
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification],
    }));

    // 자동 닫기
    if (newNotification.autoClose) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }
  }, []);

  // 알림 제거
  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  }, []);

  // 모든 알림 제거
  const clearNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // 에러 클리어
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // IndexedDB ↔ 서버 DB 동기화 함수
  const syncIndexedDBWithServer = useCallback(async (uuid: string, hospitalId: string) => {
    try {
      console.log('[동기화] 시작:', { uuid, hospitalId });
      
      // 1. IndexedDB 데이터 확인
      const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
      const indexedData = await WelnoIndexedDB.getHealthData(uuid);
      const indexedHealthCount = indexedData?.healthData?.length || 0;
      const indexedPrescriptionCount = indexedData?.prescriptionData?.length || 0;
      
      // 2. 서버 DB 데이터 확인
      const response = await fetch(API_ENDPOINTS.HEALTH_DATA(uuid, hospitalId));
      if (!response.ok) {
        console.warn('[동기화] 서버 데이터 조회 실패:', response.status);
        return;
      }
      
      const result = await response.json();
      if (!result.success || !result.data) {
        console.warn('[동기화] 서버 응답 형식 오류');
        return;
      }
      
      const serverHealthCount = result.data.health_data?.length || 0;
      const serverPrescriptionCount = result.data.prescription_data?.length || 0;
      
      // 3. 차이 확인 및 동기화 (서버에 데이터가 있을 때만 동기화)
      const needsSync = 
        (indexedHealthCount !== serverHealthCount || 
         indexedPrescriptionCount !== serverPrescriptionCount) &&
        (serverHealthCount > 0 || serverPrescriptionCount > 0); // 서버에 데이터가 있을 때만 동기화
      
      if (needsSync) {
        console.log('[동기화] 데이터 차이 발견, 서버 데이터로 IndexedDB 업데이트:', {
          indexed: { health: indexedHealthCount, prescription: indexedPrescriptionCount },
          server: { health: serverHealthCount, prescription: serverPrescriptionCount }
        });
        
        // 서버 데이터를 서버와 동일한 구조로 변환하여 IndexedDB 저장
        const healthDataFormatted = result.data.health_data?.map((item: any) => ({
          ...item.raw_data,
          raw_data: item.raw_data,
          year: item.year,
          checkup_date: item.checkup_date,
          location: item.location,
          code: item.code,
          height: item.height,
          weight: item.weight,
          bmi: item.bmi,
          waist_circumference: item.waist_circumference,
          blood_pressure_high: item.blood_pressure_high,
          blood_pressure_low: item.blood_pressure_low,
          blood_sugar: item.blood_sugar,
          cholesterol: item.cholesterol,
          hdl_cholesterol: item.hdl_cholesterol,
          ldl_cholesterol: item.ldl_cholesterol,
          triglyceride: item.triglyceride,
          hemoglobin: item.hemoglobin
        })) || [];
        
        const prescriptionDataFormatted = result.data.prescription_data?.map((item: any) => ({
          ...item.raw_data,
          raw_data: item.raw_data,
          hospital_name: item.hospital_name,
          address: item.address,
          treatment_date: item.treatment_date,
          treatment_type: item.treatment_type,
          visit_count: item.visit_count,
          medication_count: item.medication_count,
          prescription_count: item.prescription_count,
          detail_records_count: item.detail_records_count
        })) || [];
        
        await WelnoIndexedDB.saveHealthData({
          uuid,
          patientName: result.data.patient?.name || indexedData?.patientName || '사용자',
          hospitalId,
          healthData: healthDataFormatted,
          prescriptionData: prescriptionDataFormatted,
          createdAt: indexedData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dataSource: 'api'
        });
        
        console.log('[동기화] IndexedDB 업데이트 완료');
      } else if (indexedHealthCount > 0 || indexedPrescriptionCount > 0) {
        // IndexedDB에 데이터가 있고 서버에는 없으면 IndexedDB 유지
        console.log('[동기화] IndexedDB에 데이터 있음, 서버 데이터 없음 - IndexedDB 유지:', {
          indexed: { health: indexedHealthCount, prescription: indexedPrescriptionCount },
          server: { health: serverHealthCount, prescription: serverPrescriptionCount }
        });
      } else {
        console.log('[동기화] 데이터 일치 또는 양쪽 모두 없음, 동기화 불필요');
      }
    } catch (error) {
      console.error('[동기화] 오류:', error);
    }
  }, []);

  // 환자 데이터 로딩
  const loadPatientData = useCallback(async (
    uuid: string, 
    hospital: string, 
    options: { force?: boolean } = {}
  ) => {
    const { force = false } = options;
    const callStack = new Error().stack;
    console.log(`[loadPatientData] 호출 시작: ${uuid} @ ${hospital}`, {
      force,
      loadingRef: loadingRef.current,
      callStack: callStack?.split('\n').slice(1, 4).join('\n')
    });

    // 중복 호출 방지: 같은 UUID로 이미 로딩 중이면 무시
    if (!force && loadingRef.current === uuid) {
      console.log(`⏸️ [중복방지] 이미 로딩 중인 환자 데이터: ${uuid}`);
      return;
    }

    // 로딩 시작
    loadingRef.current = uuid;
    console.log(`[loadPatientData] 로딩 시작: ${uuid}`);

    try {
      // 1순위: IndexedDB 확인 (force 옵션이 없는 경우)
      if (!force) {
        console.log(`📂 [IndexedDB] 데이터 조회 시도: ${uuid}`);
        try {
          const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
          const indexedData = await WelnoIndexedDB.getHealthData(uuid);
          
          // 데이터가 비어있어도 레코드가 있으면 로그 출력
          if (indexedData) {
            console.log(`📂 [IndexedDB] 레코드 발견:`, {
              uuid: indexedData.uuid,
              patientName: indexedData.patientName,
              hospitalId: indexedData.hospitalId,
              healthDataCount: indexedData.healthData?.length || 0,
              prescriptionDataCount: indexedData.prescriptionData?.length || 0,
              healthData타입: Array.isArray(indexedData.healthData) ? 'array' : typeof indexedData.healthData,
              prescriptionData타입: Array.isArray(indexedData.prescriptionData) ? 'array' : typeof indexedData.prescriptionData,
              dataSource: indexedData.dataSource,
              updatedAt: indexedData.updatedAt
            });
          }
          
          // 데이터가 비어있어도 처방전 데이터가 있으면 사용
          const hasHealthData = indexedData?.healthData && indexedData.healthData.length > 0;
          const hasPrescriptionData = indexedData?.prescriptionData && indexedData.prescriptionData.length > 0;
          
          if (indexedData && (hasHealthData || hasPrescriptionData)) {
            console.log(`✅ [IndexedDB] 데이터 발견:`, {
              uuid: indexedData.uuid,
              patientName: indexedData.patientName,
              hospitalId: indexedData.hospitalId,
              healthDataCount: indexedData.healthData?.length || 0,
              prescriptionDataCount: indexedData.prescriptionData?.length || 0
            });

            // IndexedDB 데이터를 Context 형식으로 변환
            const patientData: PatientData = {
              uuid: indexedData.uuid,
              name: indexedData.patientName,
              age: 0, // IndexedDB에서 가져올 수 없는 정보는 기본값
              phone: '',
              birthday: indexedData.birthday || '',
              gender: 'male' as const,
              hospital_id: indexedData.hospitalId,
              last_checkup_count: indexedData.healthData?.length || 0,
              created_at: indexedData.createdAt
            };

            // 병원 정보는 API에서 가져와야 함 (캐시 확인)
            const cached = WelnoCacheManager.getCache(uuid);
            const hospitalData = cached?.hospital || {
              hospital_id: hospital,
              name: '상담 병원',
              brand_color: '#ff6b6b',
              layout_type: 'vertical',
              logo_position: 'center'
            };

            setState(prev => ({
              ...prev,
              patient: patientData,
              hospital: hospitalData as any,
              layoutConfig: cached?.layoutConfig || null,
              lastUpdated: new Date(indexedData.updatedAt).getTime(),
              isCacheExpired: false,
              cacheExpiresAt: null,
              isLoading: false,
              error: null,
            }));

            // 만약 병원 정보가 없었다면 백그라운드에서 API 호출 시도 (업데이트용)
            if (!cached?.hospital) {
              console.log('🔄 [WelnoContext] 병원 정보 로드 시도 (백그라운드)');
              fetch(API_ENDPOINTS.HOSPITAL(hospital))
                .then(res => res.ok ? res.json() : null)
                .then(hData => {
                  if (hData) {
                    setState(prev => ({ ...prev, hospital: hData }));
                    WelnoCacheManager.setCache(uuid, { hospital: hData });
                  }
                }).catch(() => {});
            }

            // 🔄 IndexedDB ↔ 서버 DB 동기화 체크 (백그라운드)
            syncIndexedDBWithServer(uuid, hospital).catch((syncError) => {
              console.warn('[동기화] 백그라운드 동기화 실패 (무시):', syncError);
            });

            // IndexedDB에서 로드 완료 - 로딩 리셋
            loadingRef.current = null;
            return;
          } else {
            console.log(`📂 [IndexedDB] 데이터 없음: ${uuid}`);
          }
        } catch (indexedError) {
          console.warn(`⚠️ [IndexedDB] 조회 실패 (API로 폴백):`, indexedError);
        }

        // 2순위: 캐시 확인 (IndexedDB 없을 때)
        const cached = WelnoCacheManager.getCache(uuid);
        if (cached && cached.patient && cached.hospital) {
          const isExpired = WelnoCacheManager.isCacheExpired(uuid);
          const expiresAt = WelnoCacheManager.getCacheExpirationTime(uuid);

          console.log(`💾 [캐시] 데이터 발견: ${uuid}`);

          setState(prev => ({
            ...prev,
            patient: cached.patient,
            hospital: cached.hospital,
            layoutConfig: cached.layoutConfig,
            lastUpdated: cached.timestamp,
            isCacheExpired: isExpired,
            cacheExpiresAt: expiresAt,
            isLoading: false,
            error: null,
          }));

          // 캐시가 만료되었으면 사용자에게 알림
          if (isExpired) {
            addNotification({
              type: 'warning',
              title: '데이터 업데이트',
              message: '저장된 데이터가 만료되었습니다. 최신 정보로 업데이트하시겠습니까?',
              action: {
                label: '업데이트',
                onClick: () => loadPatientData(uuid, hospital, { force: true }),
              },
              autoClose: false,
            });
          }

          // 캐시에서 로드 완료 - 로딩 리셋
          loadingRef.current = null;
          return;
        }
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // 파라미터 유효성 검증 및 정리
      const cleanUuid = uuid?.trim();
      const cleanHospital = hospital?.trim();
      
      if (!cleanUuid || cleanUuid === '') {
        throw new Error('UUID 파라미터가 유효하지 않습니다.');
      }
      if (!cleanHospital || cleanHospital === '') {
        throw new Error('Hospital 파라미터가 유효하지 않습니다.');
      }

      // API 엔드포인트 생성
      const patientUrl = API_ENDPOINTS.PATIENT(cleanUuid);
      const hospitalUrl = API_ENDPOINTS.HOSPITAL(cleanHospital);
      
      console.log(`[API호출] 시작:`, {
        uuid: cleanUuid,
        hospital: cleanHospital,
        patientUrl,
        hospitalUrl
      });
      
      // API 호출 (환경변수 기반 URL 사용)
      const [patientResponse, hospitalResponse] = await Promise.all([
        fetch(patientUrl),
        fetch(hospitalUrl),
      ]);
      console.log(`[API호출] 완료: ${cleanUuid} @ ${cleanHospital}`);

      // 응답 상태 및 Content-Type 검증
      if (!patientResponse.ok) {
        const responseText = await patientResponse.text();
        console.error('🚨 [환자 API] 응답 실패:', {
          status: patientResponse.status,
          statusText: patientResponse.statusText,
          url: API_ENDPOINTS.PATIENT(uuid),
          contentType: patientResponse.headers.get('content-type'),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`환자 정보 조회 실패: ${patientResponse.status} - ${responseText.substring(0, 100)}`);
      }

      if (!hospitalResponse.ok) {
        const responseText = await hospitalResponse.text();
        console.error('🚨 [병원 API] 응답 실패:', {
          status: hospitalResponse.status,
          statusText: hospitalResponse.statusText,
          url: API_ENDPOINTS.HOSPITAL(hospital),
          contentType: hospitalResponse.headers.get('content-type'),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`병원 정보 조회 실패: ${hospitalResponse.status} - ${responseText.substring(0, 100)}`);
      }

      // Content-Type 검증
      const patientContentType = patientResponse.headers.get('content-type');
      const hospitalContentType = hospitalResponse.headers.get('content-type');

      if (!patientContentType?.includes('application/json')) {
        const responseText = await patientResponse.text();
        console.error('🚨 [환자 API] JSON이 아닌 응답:', {
          contentType: patientContentType,
          url: API_ENDPOINTS.PATIENT(uuid),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`환자 API가 JSON이 아닌 응답을 반환했습니다: ${patientContentType}`);
      }

      if (!hospitalContentType?.includes('application/json')) {
        const responseText = await hospitalResponse.text();
        console.error('🚨 [병원 API] JSON이 아닌 응답:', {
          contentType: hospitalContentType,
          url: API_ENDPOINTS.HOSPITAL(hospital),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`병원 API가 JSON이 아닌 응답을 반환했습니다: ${hospitalContentType}`);
      }

      // JSON 파싱 시도
      let patientData: PatientData;
      let hospitalData: HospitalData;

      try {
        const rawPatientData = await patientResponse.json();
        console.log('[환자 API] JSON 파싱 성공:', { 
          uuid, 
          name: rawPatientData.name,
          phone_number: rawPatientData.phone_number,
          phone: rawPatientData.phone,
          birth_date: rawPatientData.birth_date,
          birthday: rawPatientData.birthday
        });
        
        // API 응답을 프론트엔드 형식으로 변환
        // phone_number -> phone, birth_date -> birthday 변환 및 null 처리
        const convertedPhone = rawPatientData.phone_number || rawPatientData.phone || '';
        const convertedBirthday = rawPatientData.birth_date || rawPatientData.birthday || '';
        
        patientData = {
          uuid: rawPatientData.uuid || uuid,
          name: rawPatientData.name || '',
          age: rawPatientData.age || 0,
          phone: convertedPhone,
          birthday: convertedBirthday,
          gender: rawPatientData.gender === 'M' ? 'male' : rawPatientData.gender === 'F' ? 'female' : 'male',
          hospital_id: rawPatientData.hospital_id || hospital,
          last_checkup_count: rawPatientData.last_checkup_count || 0,
          created_at: rawPatientData.created_at || new Date().toISOString()
        };
        
        console.log('[환자 API] 데이터 변환 완료:', {
          uuid: patientData.uuid,
          name: patientData.name,
          phone: patientData.phone || '(없음)',
          birthday: patientData.birthday || '(없음)',
          gender: patientData.gender,
          '원본 phone_number': rawPatientData.phone_number,
          '변환된 phone': patientData.phone
        });
      } catch (error) {
        const responseText = await patientResponse.text();
        console.error('🚨 [환자 API] JSON 파싱 실패:', {
          error: error instanceof Error ? error.message : error,
          url: API_ENDPOINTS.PATIENT(uuid),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`환자 정보 JSON 파싱 실패: ${error instanceof Error ? error.message : error}`);
      }

      try {
        hospitalData = await hospitalResponse.json();
        console.log('[병원 API] JSON 파싱 성공:', { hospitalId: hospital, name: hospitalData.name });
      } catch (error) {
        const responseText = await hospitalResponse.text();
        console.error('🚨 [병원 API] JSON 파싱 실패:', {
          error: error instanceof Error ? error.message : error,
          url: API_ENDPOINTS.HOSPITAL(hospital),
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`병원 정보 JSON 파싱 실패: ${error instanceof Error ? error.message : error}`);
      }

      // patient 데이터에 hospital_id 추가
      patientData.hospital_id = hospital;

      // 레이아웃 설정 생성 (기존 layoutMapper 로직 사용)
      const layoutConfig: ExtendedLayoutConfig = {
        layoutType: hospitalData.layout_type as any,
        showAIButton: false,
        showFloatingButton: true,
        title: `안녕하세요 ${patientData.name}님,\n${hospitalData.name}입니다`,
        subtitle: `${hospitalData.name}에서\n더 의미있는 내원이 되시길 바라며\n준비한 건강관리 서비스를 제공해드립니다.`,
        headerMainTitle: '',
        headerImage: "/welno/doctor-image.png",
        headerImageAlt: "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
        headerSlogan: "행복한 건강생활의 평생 동반자",
        headerLogoTitle: hospitalData.name,
        headerLogoSubtitle: "",
        hospitalName: hospitalData.name,
        brandColor: hospitalData.brand_color,
        logoPosition: hospitalData.logo_position,
      };

      // IndexedDB에 저장 (단일 진실 공급원)
      try {
        const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
        
        // 건강 데이터 조회 (API에서) - 동기화를 위해 사용
        const healthDataUrl = API_ENDPOINTS.HEALTH_DATA(cleanUuid, cleanHospital);
        let healthData: any[] = [];
        let prescriptionData: any[] = [];
        
        try {
          const healthResponse = await fetch(healthDataUrl);
          if (healthResponse.ok) {
            const healthResult = await healthResponse.json();
            console.log('🔍 [API] 건강 데이터 응답 상세:', {
              success: healthResult.success,
              hasData: !!healthResult.data,
              health_data_count: healthResult.data?.health_data?.length || 0,
              prescription_data_count: healthResult.data?.prescription_data?.length || 0,
              patient_exists: !!healthResult.data?.patient
            });
            
            if (healthResult.success && healthResult.data) {
              healthData = healthResult.data.health_data || [];
              prescriptionData = healthResult.data.prescription_data || [];
              console.log(`✅ [API] 건강 데이터 조회 완료: 건강검진 ${healthData.length}건, 처방전 ${prescriptionData.length}건`);
              
              // 데이터가 있는데 빈 배열이면 상세 로그
              if (healthData.length === 0 && prescriptionData.length === 0) {
                console.warn('⚠️ [API] 서버 DB에는 데이터가 있지만 API 응답이 빈 배열입니다.');
                console.warn('⚠️ [API] 응답 구조:', JSON.stringify(healthResult, null, 2).substring(0, 500));
              }
            } else {
              console.warn(`⚠️ [API] 건강 데이터 응답 형식 오류:`, healthResult);
            }
          } else {
            const errorText = await healthResponse.text();
            console.warn(`⚠️ [API] 건강 데이터 조회 실패 (${healthResponse.status}):`, errorText.substring(0, 200));
          }
        } catch (healthError) {
          console.warn(`⚠️ [API] 건강 데이터 조회 오류:`, healthError);
        }

        // IndexedDB에 저장 (서버 데이터를 서버와 동일한 구조로 변환)
        if (healthData.length > 0 || prescriptionData.length > 0) {
          // 서버 데이터를 서버와 동일한 구조로 변환
          const healthDataFormatted = healthData.map((item: any) => ({
            ...item.raw_data,
            raw_data: item.raw_data,
            year: item.year,
            checkup_date: item.checkup_date,
            location: item.location,
            code: item.code,
            height: item.height,
            weight: item.weight,
            bmi: item.bmi,
            waist_circumference: item.waist_circumference,
            blood_pressure_high: item.blood_pressure_high,
            blood_pressure_low: item.blood_pressure_low,
            blood_sugar: item.blood_sugar,
            cholesterol: item.cholesterol,
            hdl_cholesterol: item.hdl_cholesterol,
            ldl_cholesterol: item.ldl_cholesterol,
            triglyceride: item.triglyceride,
            hemoglobin: item.hemoglobin
          }));
          
          const prescriptionDataFormatted = prescriptionData.map((item: any) => ({
            ...item.raw_data,
            raw_data: item.raw_data,
            hospital_name: item.hospital_name,
            address: item.address,
            treatment_date: item.treatment_date,
            treatment_type: item.treatment_type,
            visit_count: item.visit_count,
            medication_count: item.medication_count,
            prescription_count: item.prescription_count,
            detail_records_count: item.detail_records_count
          }));
          
          const now = new Date().toISOString();
          const savedId = await WelnoIndexedDB.saveHealthData({
            uuid: cleanUuid,
            patientName: patientData.name,
            hospitalId: cleanHospital,
            birthday: patientData.birthday,
            healthData: healthDataFormatted,
            prescriptionData: prescriptionDataFormatted,
            dataSource: 'api',
            createdAt: now,
            updatedAt: now
          });
          console.log(`📂 [IndexedDB] 데이터 저장 완료: ${savedId}`);
        }
      } catch (indexedError) {
        console.warn(`⚠️ [IndexedDB] 저장 실패 (계속 진행):`, indexedError);
      }

      // 캐시 저장 (2차 캐시)
      WelnoCacheManager.setCache(uuid, {
        patient: patientData,
        hospital: hospitalData,
        layoutConfig,
      });

      const now = Date.now();
      const expiresAt = WelnoCacheManager.getCacheExpirationTime(uuid);

      setState(prev => ({
        ...prev,
        patient: patientData,
        hospital: hospitalData,
        layoutConfig,
        isLoading: false,
        error: null,
        lastUpdated: now,
        isCacheExpired: false,
        cacheExpiresAt: expiresAt,
      }));

      // 성공 알림 (명시적으로 업데이트를 요청한 경우에만)
      if (force && state.patient) { // 기존 환자 데이터가 있을 때만 업데이트 토스트 표시
        addNotification({
          type: 'success',
          title: '업데이트 완료',
          message: '최신 데이터로 업데이트되었습니다.',
        });
      }

      // 로딩 완료
      loadingRef.current = null;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      
      console.error('🚨 [환자 데이터 로딩] 실패:', {
        error: errorMessage,
        uuid,
        hospital,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        apiEndpoints: {
          patient: API_ENDPOINTS.PATIENT(uuid),
          hospital: API_ENDPOINTS.HOSPITAL(hospital)
        }
      });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      // 네트워크 오류인 경우 캐시 데이터 사용 제안
      const cached = WelnoCacheManager.getCache(uuid);
      const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError');
      const isAPIError = errorMessage.includes('API') || errorMessage.includes('JSON');
      
      if (cached && isNetworkError) {
        setState(prev => ({ ...prev, isOffline: true }));
        
        addNotification({
          type: 'warning',
          title: '네트워크 연결 오류',
          message: '인터넷 연결을 확인해주세요. 저장된 데이터를 사용하시겠습니까?',
          action: {
            label: '저장된 데이터 사용',
            onClick: () => {
              setState(prev => ({
                ...prev,
                patient: cached.patient,
                hospital: cached.hospital,
                layoutConfig: cached.layoutConfig,
                isOffline: true,
                error: null,
              }));
            },
          },
          autoClose: false,
        });
      } else {
        // 프로덕션 환경에서 더 자세한 에러 정보 제공
        let userFriendlyMessage = errorMessage;
        if (isNetworkError) {
          userFriendlyMessage = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정하거나 서버에 일시적인 문제가 있을 수 있습니다.';
        } else if (isAPIError) {
          userFriendlyMessage = 'API 서버에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        }

        addNotification({
          type: 'error',
          title: '데이터 로딩 실패',
          message: userFriendlyMessage,
          action: {
            label: '다시 시도',
            onClick: () => loadPatientData(uuid, hospital, { force: true }),
          },
          autoClose: false,
        });
      }

      // 로딩 완료 (에러 발생 시에도 리셋)
      loadingRef.current = null;
    }
  }, [addNotification]);

  // 데이터 새로고침
  const refreshData = useCallback(async () => {
    if (state.patient?.uuid && state.hospital?.hospital_id) {
      await loadPatientData(state.patient.uuid, state.hospital.hospital_id, { force: true });
    }
  }, [state.patient?.uuid, state.hospital?.hospital_id, loadPatientData]);

  // 캐시 클리어
  const clearCache = useCallback(() => {
    if (state.patient?.uuid) {
      WelnoCacheManager.clearCache(state.patient.uuid);
    }
    setState(initialState);
    addNotification({
      type: 'info',
      title: '캐시 정리',
      message: '저장된 데이터가 삭제되었습니다.',
    });
  }, [state.patient?.uuid, addNotification]);

  // 세션 복구
  const recoverSession = useCallback(async () => {
    // 1순위: URL 파라미터에서 UUID와 병원 정보 추출
    const urlParams = new URLSearchParams(window.location.search);
    let uuid = urlParams.get('uuid');
    let hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

    // 2순위: IndexedDB에서 가장 최신 데이터의 UUID 사용
    if (!uuid || !hospital) {
      try {
        const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
        const allHealthData = await WelnoIndexedDB.getAllHealthData();
        console.log('[WelnoContext] IndexedDB 전체 조회 결과:', {
          전체건수: allHealthData.length,
          UUID목록: allHealthData.map(d => ({ 
            uuid: d.uuid, 
            hospitalId: d.hospitalId, 
            updatedAt: d.updatedAt,
            healthDataCount: d.healthData?.length || 0,
            prescriptionDataCount: d.prescriptionData?.length || 0
          }))
        });
        
        if (allHealthData.length > 0) {
          // 데이터가 있는 레코드 우선 선택
          const dataWithContent = allHealthData.filter(d => 
            (d.healthData && d.healthData.length > 0) || 
            (d.prescriptionData && d.prescriptionData.length > 0)
          );
          
          const targetData = dataWithContent.length > 0 
            ? dataWithContent.sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              )[0]
            : allHealthData.sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              )[0];
          
          uuid = uuid || targetData.uuid;
          hospital = hospital || targetData.hospitalId;
          console.log('[WelnoContext] IndexedDB에서 UUID 발견:', { 
            uuid, 
            hospital,
            선택된데이터: {
              uuid: targetData.uuid,
              hospitalId: targetData.hospitalId,
              healthDataCount: targetData.healthData?.length || 0,
              prescriptionDataCount: targetData.prescriptionData?.length || 0,
              updatedAt: targetData.updatedAt
            },
            데이터있는레코드수: dataWithContent.length
          });
        }
      } catch (indexedError) {
        console.warn('[WelnoContext] IndexedDB 조회 실패:', indexedError);
      }
    }

    // 3순위: localStorage에서 확인 (재접속 시)
    if (!uuid || !hospital) {
      uuid = uuid || StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || 
                    localStorage.getItem('tilko_patient_uuid');
      hospital = hospital || StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || 
                        localStorage.getItem('tilko_hospital_id');
      
      if (uuid && hospital) {
        console.log('[WelnoContext] localStorage에서 세션 복구:', { uuid, hospital });
        addNotification({
          type: 'info',
          title: '데이터 로딩 중',
          message: '저장된 건강정보를 불러오고 있습니다...',
          autoClose: true,
          duration: 2000,
        });
      }
    } else {
      console.log('[WelnoContext] URL 파라미터에서 세션 복구:', { uuid, hospital });
      addNotification({
        type: 'info',
        title: '세션 복구 중',
        message: '이전 세션을 복구하고 있습니다...',
        autoClose: true,
        duration: 2000,
      });
    }

    if (uuid && hospital) {
      await loadPatientData(uuid, hospital);
    } else {
      console.log('[WelnoContext] 복구할 세션 없음');
    }
  }, [loadPatientData, addNotification]);

  // Actions 객체 메모화
  const actions: WelnoDataActions = useMemo(() => ({
    loadPatientData,
    refreshData,
    clearCache,
    addNotification,
    removeNotification,
    clearNotifications,
    clearError,
    recoverSession,
  }), [loadPatientData, refreshData, clearCache, addNotification, removeNotification, clearNotifications, clearError, recoverSession]);

  return (
    <WelnoDataContext.Provider value={{ state, actions }}>
      {children}
    </WelnoDataContext.Provider>
  );
};

// Hook
export const useWelnoData = (): WelnoDataContextType => {
  const context = useContext(WelnoDataContext);
  if (!context) {
    throw new Error('useWelnoData must be used within a WelnoDataProvider');
  }
  return context;
};

export default WelnoDataContext;
