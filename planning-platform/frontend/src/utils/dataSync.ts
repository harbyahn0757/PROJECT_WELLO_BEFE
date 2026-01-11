/**
 * 서버-클라이언트 데이터 동기화 유틸리티
 * 해시와 타임스탬프를 사용한 효율적인 동기화
 */

export interface DataMetadata {
  /** 데이터 해시 (SHA256) */
  hash: string;
  /** 서버의 마지막 업데이트 시간 (ISO 8601) */
  lastUpdate: string;
  /** 로컬 저장 시간 (ISO 8601) */
  cachedAt: string;
  /** 데이터 버전 (선택적) */
  version?: number;
}

export interface SyncResult<T> {
  /** 동기화된 데이터 */
  data: T;
  /** 업데이트 여부 */
  updated: boolean;
  /** 메타데이터 */
  metadata: DataMetadata;
  /** 동기화 방법 */
  syncMethod: 'server' | 'cache' | 'conditional';
}

/**
 * 데이터 해시 생성 (SHA256) - Web Crypto API 사용
 */
export async function generateDataHash(data: any): Promise<string> {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 동기식 해시 생성 (간단한 버전, 큰 데이터에는 비권장)
 */
export function generateDataHashSync(data: any): string {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * localStorage에서 메타데이터 가져오기
 */
export function getCachedMetadata(key: string): DataMetadata | null {
  try {
    const metadataKey = `${key}_metadata`;
    const metadataStr = localStorage.getItem(metadataKey);
    if (!metadataStr) return null;
    return JSON.parse(metadataStr);
  } catch {
    return null;
  }
}

/**
 * localStorage에 메타데이터 저장
 */
export function setCachedMetadata(key: string, metadata: DataMetadata): void {
  try {
    const metadataKey = `${key}_metadata`;
    localStorage.setItem(metadataKey, JSON.stringify(metadata));
  } catch (error) {
    console.error('[DataSync] 메타데이터 저장 실패:', error);
  }
}

/**
 * 데이터와 메타데이터를 함께 저장
 */
export async function cacheDataWithMetadata<T>(key: string, data: T, serverLastUpdate: string): Promise<void> {
  try {
    // 데이터 저장
    localStorage.setItem(key, JSON.stringify(data));
    
    // 메타데이터 생성 및 저장
    const hash = await generateDataHash(data);
    const metadata: DataMetadata = {
      hash,
      lastUpdate: serverLastUpdate,
      cachedAt: new Date().toISOString(),
    };
    
    setCachedMetadata(key, metadata);
    console.log(`[DataSync] 데이터 캐시 저장: ${key}`, { hash: hash.substring(0, 16) + '...', lastUpdate: serverLastUpdate });
  } catch (error) {
    console.error('[DataSync] 데이터 저장 실패:', error);
  }
}

/**
 * 캐시된 데이터 가져오기
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const dataStr = localStorage.getItem(key);
    if (!dataStr) return null;
    return JSON.parse(dataStr);
  } catch {
    return null;
  }
}

/**
 * 조건부 요청 헤더 생성
 */
export function createConditionalHeaders(metadata: DataMetadata | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (metadata) {
    // ETag 기반 조건부 요청
    headers['If-None-Match'] = `"${metadata.hash}"`;
    // Last-Modified 기반 조건부 요청
    headers['If-Modified-Since'] = new Date(metadata.lastUpdate).toUTCString();
  }
  
  return headers;
}

/**
 * 서버 응답에서 메타데이터 추출
 */
export async function extractMetadataFromResponse(response: Response, data: any): Promise<DataMetadata | null> {
  // ETag 헤더에서 해시 가져오기 (있는 경우)
  const etag = response.headers.get('ETag');
  const hash = etag ? etag.replace(/"/g, '') : await generateDataHash(data);
  
  // 서버의 last_update 필드 우선 사용 (데이터에 포함된 경우)
  let lastUpdate: string;
  if (data?.last_update) {
    // 서버에서 반환한 last_update 사용
    lastUpdate = typeof data.last_update === 'string' 
      ? data.last_update 
      : new Date(data.last_update).toISOString();
  } else {
    // Last-Modified 헤더에서 업데이트 시간 가져오기
    const lastModified = response.headers.get('Last-Modified');
    lastUpdate = lastModified 
      ? new Date(lastModified).toISOString()
      : new Date().toISOString();
  }
  
  return {
    hash,
    lastUpdate,
    cachedAt: new Date().toISOString(),
  };
}

/**
 * 데이터 동기화 (스마트 동기화)
 * 
 * 전략:
 * 1. 캐시된 데이터가 있으면 조건부 요청 (304 Not Modified)
 * 2. 서버에서 변경사항이 있으면 전체 데이터 다운로드
 * 3. 네트워크 오류 시 캐시된 데이터 사용
 */
export async function syncData<T>(
  key: string,
  fetchFn: (headers: HeadersInit) => Promise<Response>,
  parseFn: (response: Response) => Promise<T>,
  options: {
    /** 캐시 만료 시간 (밀리초), 기본값: 5분 */
    cacheExpiry?: number;
    /** 항상 서버에서 가져오기 (캐시 무시) */
    forceRefresh?: boolean;
  } = {}
): Promise<SyncResult<T>> {
  const { cacheExpiry = 5 * 60 * 1000, forceRefresh = false } = options;
  
  // 1. 캐시된 데이터 확인
  const cachedData = getCachedData<T>(key);
  const cachedMetadata = getCachedMetadata(key);
  
  // 2. 캐시가 유효한지 확인
  const isCacheValid = cachedData && cachedMetadata && !forceRefresh;
  const isCacheExpired = cachedMetadata 
    ? (Date.now() - new Date(cachedMetadata.cachedAt).getTime()) > cacheExpiry
    : true;
  
  // 3. 조건부 요청 헤더 생성
  const headers = isCacheValid && !isCacheExpired
    ? createConditionalHeaders(cachedMetadata)
    : { 'Content-Type': 'application/json' };
  
  try {
    // 4. 서버에서 데이터 가져오기
    const response = await fetchFn(headers);
    
    // 5. 304 Not Modified (캐시 유효)
    if (response.status === 304 && cachedData && cachedMetadata) {
      console.log(`[DataSync] 캐시 유효 (304): ${key}`);
      return {
        data: cachedData,
        updated: false,
        metadata: cachedMetadata,
        syncMethod: 'conditional',
      };
    }
    
    // 6. 서버에서 새 데이터 받음
    if (response.ok) {
      const data = await parseFn(response);
      
      // 7. 메타데이터 추출 (서버의 last_update 우선 사용)
      const metadata = await extractMetadataFromResponse(response, data);
      
      // 8. 해시 비교 (실제 변경사항 확인)
      const dataHash = await generateDataHash(data);
      const isUpdated = !cachedMetadata || cachedMetadata.hash !== dataHash;
      
      // 9. 서버의 last_update와 캐시된 lastUpdate 비교 (추가 검증)
      const serverLastUpdate = metadata?.lastUpdate || new Date().toISOString();
      const cacheLastUpdate = cachedMetadata?.lastUpdate;
      const isServerNewer = !cacheLastUpdate || 
        new Date(serverLastUpdate).getTime() > new Date(cacheLastUpdate).getTime();
      
      // 해시가 다르거나 서버가 더 최신이면 업데이트
      const shouldUpdate = isUpdated || (isServerNewer && !isUpdated);
      
      if (shouldUpdate && metadata) {
        // 10. 새 데이터 캐시 저장
        await cacheDataWithMetadata(key, data, metadata.lastUpdate);
        console.log(`[DataSync] 데이터 업데이트: ${key}`, { 
          oldHash: cachedMetadata?.hash.substring(0, 16),
          newHash: dataHash.substring(0, 16),
          oldLastUpdate: cachedMetadata?.lastUpdate,
          newLastUpdate: metadata.lastUpdate,
          reason: isUpdated ? 'hash_changed' : 'server_newer'
        });
      }
      
      return {
        data,
        updated: shouldUpdate,
        metadata: metadata || {
          hash: dataHash,
          lastUpdate: serverLastUpdate,
          cachedAt: new Date().toISOString(),
        },
        syncMethod: 'server',
      };
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    console.error(`[DataSync] 동기화 실패: ${key}`, error);
    
    // 10. 네트워크 오류 시 캐시된 데이터 사용
    if (cachedData && cachedMetadata) {
      console.log(`[DataSync] 캐시 데이터 사용 (오프라인): ${key}`);
      return {
        data: cachedData,
        updated: false,
        metadata: cachedMetadata,
        syncMethod: 'cache',
      };
    }
    
    throw error;
  }
}

/**
 * 건강 데이터 동기화 (전용 함수)
 */
export async function syncHealthData(
  uuid: string,
  hospitalId: string,
  options?: { cacheExpiry?: number; forceRefresh?: boolean }
): Promise<SyncResult<any>> {
  const key = `welno_health_data_${uuid}_${hospitalId}`;
  
  return syncData(
    key,
    async (headers) => {
      const url = `/welno-api/v1/welno/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`;
      return fetch(url, { headers });
    },
    async (response) => {
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Invalid API response');
      }
      return result.data;
    },
    options
  );
}

/**
 * 검진 설계 데이터 동기화 (전용 함수)
 */
export async function syncCheckupDesign(
  uuid: string,
  hospitalId: string,
  options?: { cacheExpiry?: number; forceRefresh?: boolean }
): Promise<SyncResult<any>> {
  const key = `welno_checkup_design_${uuid}_${hospitalId}`;
  
  return syncData(
    key,
    async (headers) => {
      const url = `/welno-api/v1/checkup-design/latest?uuid=${uuid}&hospital_id=${hospitalId}`;
      return fetch(url, { headers });
    },
    async (response) => {
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Invalid API response');
      }
      return result.data;
    },
    options
  );
}

/**
 * 모든 환자 데이터 동기화 (건강검진 + 처방전 + 검진 설계)
 */
export async function syncAllPatientData(
  uuid: string,
  hospitalId: string,
  options?: { cacheExpiry?: number; forceRefresh?: boolean }
): Promise<{
  health: SyncResult<any>;
  design?: SyncResult<any>;
}> {
  const [healthResult, designResult] = await Promise.allSettled([
    syncHealthData(uuid, hospitalId, options),
    syncCheckupDesign(uuid, hospitalId, options).catch(() => null), // 검진 설계는 선택적
  ]);
  
  return {
    health: healthResult.status === 'fulfilled' 
      ? healthResult.value 
      : { data: null, updated: false, metadata: {} as DataMetadata, syncMethod: 'cache' },
    design: designResult.status === 'fulfilled' && designResult.value
      ? designResult.value
      : undefined,
  };
}
