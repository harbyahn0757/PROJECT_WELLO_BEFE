/**
 * 환자 API 요청 인증 인터셉터 — P0 Phase 1 Soft Lock
 *
 * 대상 경로: /api/v1/patients/* 및 /api/v1/welno/patients/*
 * 동작:
 *   1. ?lookup_key= 쿼리 파라미터 추가 (localStorage ALIMTALK_LOOKUP_KEY)
 *   2. X-Tilko-Session-Id 헤더 추가 (localStorage TILKO_SESSION_ID)
 *   3. Authorization: Bearer 헤더 추가 (localStorage / sessionStorage jwt)
 *
 * Phase 1 Soft Lock 동작: 첨부 실패해도 요청을 차단하지 않음.
 * 서버 측 soft_verify_patient_access 가 WARN 로그만 남기고 통과.
 */

import axios, { InternalAxiosRequestConfig } from 'axios';
import { STORAGE_KEYS, StorageManager } from '../constants/storage';

// 환자 API 경로 패턴
const PATIENT_PATH_PATTERNS = [
  /\/api\/v1\/patients\//,
  /\/api\/v1\/welno\/patients\//,
  /\/welno-api\/v1\/patients\//,
  /\/welno-api\/v1\/welno\/patients\//,
];

function isPatientApiRequest(url: string | undefined): boolean {
  if (!url) return false;
  return PATIENT_PATH_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * axios 인스턴스에 환자 API 인증 인터셉터를 등록한다.
 * 기존 axios.defaults 또는 커스텀 인스턴스 모두에 적용 가능.
 */
export function registerPatientApiInterceptor(
  axiosInstance: typeof axios | ReturnType<typeof axios.create> = axios
): void {
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (!isPatientApiRequest(config.url)) {
        return config;
      }

      // 1. lookup_key 쿼리 파라미터 첨부
      const lookupKey = StorageManager.getItem<string>(STORAGE_KEYS.ALIMTALK_LOOKUP_KEY);
      if (lookupKey) {
        const separator = config.url && config.url.includes('?') ? '&' : '?';
        config.url = `${config.url}${separator}lookup_key=${encodeURIComponent(lookupKey)}`;
      }

      // 2. X-Tilko-Session-Id 헤더 첨부
      const tilkoSessionId = StorageManager.getItem<string>(STORAGE_KEYS.TILKO_SESSION_ID);
      if (tilkoSessionId) {
        config.headers = config.headers || {};
        config.headers['X-Tilko-Session-Id'] = tilkoSessionId;
      }

      // 3. Authorization: Bearer 헤더 첨부 (이미 설정된 경우 덮어쓰지 않음)
      if (!config.headers?.['Authorization']) {
        const jwt =
          StorageManager.getItem<string>('welno_jwt') ||
          sessionStorage.getItem('welno_jwt') ||
          localStorage.getItem('welno_access_token');
        if (jwt) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${jwt}`;
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );
}
