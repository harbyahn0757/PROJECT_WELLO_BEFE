import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { LayoutConfig as BaseLayoutConfig } from '../utils/layoutMapper';
import { PatientData as CommonPatientData, HospitalData as CommonHospitalData } from '../types/patient';

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
export interface WelloDataState {
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
export interface WelloDataActions {
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
export interface WelloDataContextType {
  state: WelloDataState;
  actions: WelloDataActions;
}

// Context 생성
const WelloDataContext = createContext<WelloDataContextType | null>(null);

// 초기 상태
const initialState: WelloDataState = {
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
class WelloCacheManager {
  private static readonly CACHE_KEY = 'wello_data_cache';
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
interface WelloDataProviderProps {
  children: ReactNode;
}

// Provider 컴포넌트
export const WelloDataProvider: React.FC<WelloDataProviderProps> = ({ children }) => {
  const [state, setState] = useState<WelloDataState>(initialState);

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

    try {
      // 캐시 확인 (force 옵션이 없는 경우)
      if (!force) {
        const cached = WelloCacheManager.getCache(uuid);
        if (cached && cached.patient && cached.hospital) {
          const isExpired = WelloCacheManager.isCacheExpired(uuid);
          const expiresAt = WelloCacheManager.getCacheExpirationTime(uuid);

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

          return;
        }
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // API 호출 (WELLO 전용 경로)
      const [patientResponse, hospitalResponse] = await Promise.all([
        fetch(`/api/v1/wello/patients/${uuid}`),
        fetch(`/api/v1/wello/hospitals/${hospital}`),
      ]);

      if (!patientResponse.ok) {
        throw new Error(`환자 정보 조회 실패: ${patientResponse.status}`);
      }

      if (!hospitalResponse.ok) {
        throw new Error(`병원 정보 조회 실패: ${hospitalResponse.status}`);
      }

      const [patientData, hospitalData]: [PatientData, HospitalData] = await Promise.all([
        patientResponse.json(),
        hospitalResponse.json(),
      ]);

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
        headerImage: "/wello/doctor-image.png",
        headerImageAlt: "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
        headerSlogan: "행복한 건강생활의 평생 동반자",
        headerLogoTitle: hospitalData.name,
        headerLogoSubtitle: "",
        hospitalName: hospitalData.name,
        brandColor: hospitalData.brand_color,
        logoPosition: hospitalData.logo_position,
      };

      // 캐시 저장
      WelloCacheManager.setCache(uuid, {
        patient: patientData,
        hospital: hospitalData,
        layoutConfig,
      });

      const now = Date.now();
      const expiresAt = WelloCacheManager.getCacheExpirationTime(uuid);

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

      // 성공 알림
      if (force) {
        addNotification({
          type: 'success',
          title: '업데이트 완료',
          message: '최신 데이터로 업데이트되었습니다.',
        });
      }

    } catch (error) {
      console.error('환자 데이터 로딩 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      // 네트워크 오류인 경우 캐시 데이터 사용 제안
      const cached = WelloCacheManager.getCache(uuid);
      if (cached && (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError'))) {
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
      }
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
      WelloCacheManager.clearCache(state.patient.uuid);
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
    // URL에서 UUID와 병원 정보 추출하여 세션 복구 시도
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

    if (uuid && hospital) {
      addNotification({
        type: 'info',
        title: '세션 복구 중',
        message: '이전 세션을 복구하고 있습니다...',
        autoClose: true,
        duration: 2000,
      });

      await loadPatientData(uuid, hospital);
    }
  }, [loadPatientData, addNotification]);

  // Actions 객체 메모화
  const actions: WelloDataActions = useMemo(() => ({
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
    <WelloDataContext.Provider value={{ state, actions }}>
      {children}
    </WelloDataContext.Provider>
  );
};

// Hook
export const useWelloData = (): WelloDataContextType => {
  const context = useContext(WelloDataContext);
  if (!context) {
    throw new Error('useWelloData must be used within a WelloDataProvider');
  }
  return context;
};

export default WelloDataContext;
