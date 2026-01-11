import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import { LayoutConfig as BaseLayoutConfig } from '../utils/layoutMapper';
import { PatientData as CommonPatientData, HospitalData as CommonHospitalData } from '../types/patient';
import { API_ENDPOINTS } from '../config/api';

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
          
          if (indexedData && indexedData.healthData && indexedData.healthData.length > 0) {
            console.log(`✅ [IndexedDB] 데이터 발견:`, {
              uuid: indexedData.uuid,
              patientName: indexedData.patientName,
              hospitalId: indexedData.hospitalId,
              healthDataCount: indexedData.healthData.length,
              prescriptionDataCount: indexedData.prescriptionData?.length || 0
            });

            // IndexedDB 데이터를 Context 형식으로 변환
            const patientData: PatientData = {
              uuid: indexedData.uuid,
              name: indexedData.patientName,
              age: 0, // IndexedDB에서 가져올 수 없는 정보는 기본값
              phone: '',
              birthday: '',
              gender: 'male' as const,
              hospital_id: indexedData.hospitalId,
              last_checkup_count: indexedData.healthData.length,
              created_at: indexedData.createdAt
            };

            // 병원 정보는 API에서 가져와야 함 (캐시 확인)
            const cached = WelnoCacheManager.getCache(uuid);
            if (cached && cached.hospital) {
              setState(prev => ({
                ...prev,
                patient: patientData,
                hospital: cached.hospital,
                layoutConfig: cached.layoutConfig,
                lastUpdated: new Date(indexedData.updatedAt).getTime(),
                isCacheExpired: false,
                cacheExpiresAt: null,
                isLoading: false,
                error: null,
              }));

              // IndexedDB에서 로드 완료 - 로딩 리셋
              loadingRef.current = null;
              return;
            }
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
        
        // 건강 데이터 조회 (API에서)
        const healthDataUrl = `/welno-api/v1/welno/health-data/${cleanUuid}/${cleanHospital}`;
        let healthData: any[] = [];
        let prescriptionData: any[] = [];
        
        try {
          const healthResponse = await fetch(healthDataUrl);
          if (healthResponse.ok) {
            const healthResult = await healthResponse.json();
            healthData = healthResult.health_data || [];
            prescriptionData = healthResult.prescription_data || [];
            console.log(`✅ [API] 건강 데이터 조회 완료: 건강검진 ${healthData.length}건, 처방전 ${prescriptionData.length}건`);
          } else {
            console.warn(`⚠️ [API] 건강 데이터 조회 실패 (${healthResponse.status}) - IndexedDB 저장 건너뜀`);
          }
        } catch (healthError) {
          console.warn(`⚠️ [API] 건강 데이터 조회 오류:`, healthError);
        }

        // IndexedDB에 저장
        if (healthData.length > 0 || prescriptionData.length > 0) {
          const now = new Date().toISOString();
          const savedId = await WelnoIndexedDB.saveHealthData({
            uuid: cleanUuid,
            patientName: patientData.name,
            hospitalId: cleanHospital,
            healthData,
            prescriptionData,
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

    // 2순위: localStorage에서 확인 (재접속 시)
    if (!uuid || !hospital) {
      uuid = localStorage.getItem('tilko_patient_uuid');
      hospital = localStorage.getItem('tilko_hospital_id');
      
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
