/**
 * WelnoIndexedDB - 건강 데이터 전용 IndexedDB 매니저
 * 건강검진 데이터와 처방전 데이터를 효율적으로 저장/조회
 */

export interface HealthDataRecord {
  uuid: string;           // 환자 UUID (Primary Key)
  patientName: string;    // 환자명
  hospitalId: string;     // 병원 ID
  healthData: any[];      // 건강검진 데이터 배열
  prescriptionData: any[]; // 처방전 데이터 배열
  createdAt: string;      // 생성 시간
  updatedAt: string;      // 수정 시간
  dataSource: 'api' | 'tilko'; // 데이터 출처
}

export interface SessionRecord {
  sessionId: string;      // 세션 ID (Primary Key)
  uuid: string;          // 환자 UUID
  sessionData: any;      // 세션 데이터
  createdAt: string;     // 생성 시간
  expiresAt: string;     // 만료 시간
}

export class WelnoIndexedDB {
  private static readonly DB_NAME = 'WelnoHealthDB';
  private static readonly DB_VERSION = 1;
  
  // 스토어 정의
  private static readonly STORES = {
    HEALTH_DATA: 'health_data',
    SESSION_DATA: 'session_data'
  } as const;

  private static db: IDBDatabase | null = null;

  /**
   * 데이터베이스 초기화
   */
  static async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ [IndexedDB] 데이터베이스 열기 실패:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [IndexedDB] 데이터베이스 초기화 완료');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 [IndexedDB] 데이터베이스 업그레이드 중...');

        // 건강 데이터 스토어 생성
        if (!db.objectStoreNames.contains(this.STORES.HEALTH_DATA)) {
          const healthStore = db.createObjectStore(this.STORES.HEALTH_DATA, { 
            keyPath: 'uuid' 
          });
          
          // 인덱스 생성
          healthStore.createIndex('patientName', 'patientName', { unique: false });
          healthStore.createIndex('hospitalId', 'hospitalId', { unique: false });
          healthStore.createIndex('createdAt', 'createdAt', { unique: false });
          healthStore.createIndex('dataSource', 'dataSource', { unique: false });
          
          console.log('📋 [IndexedDB] health_data 스토어 생성 완료');
        }

        // 세션 데이터 스토어 생성
        if (!db.objectStoreNames.contains(this.STORES.SESSION_DATA)) {
          const sessionStore = db.createObjectStore(this.STORES.SESSION_DATA, { 
            keyPath: 'sessionId' 
          });
          
          // 인덱스 생성
          sessionStore.createIndex('uuid', 'uuid', { unique: false });
          sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          
          console.log('📋 [IndexedDB] session_data 스토어 생성 완료');
        }
      };
    });
  }

  /**
   * 데이터베이스 연결 확인 및 재연결
   */
  private static async ensureConnection(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * 건강 데이터 저장
   */
  static async saveHealthData(record: HealthDataRecord, mode: 'overwrite' | 'merge' = 'overwrite'): Promise<boolean> {
    try {
      const db = await this.ensureConnection();
      
      // 기존 데이터 확인을 위한 별도 트랜잭션
      let existingRecord: HealthDataRecord | null = null;
      try {
        const readTransaction = db.transaction([this.STORES.HEALTH_DATA], 'readonly');
        const readStore = readTransaction.objectStore(this.STORES.HEALTH_DATA);
        const readRequest = readStore.get(record.uuid);
        
        existingRecord = await new Promise((resolve, reject) => {
          readRequest.onsuccess = () => resolve(readRequest.result || null);
          readRequest.onerror = () => reject(readRequest.error);
        });
      } catch (readError) {
        console.warn('⚠️ [IndexedDB] 기존 데이터 조회 실패, 새로 생성:', readError);
      }
      
      // 저장을 위한 새로운 트랜잭션
      const writeTransaction = db.transaction([this.STORES.HEALTH_DATA], 'readwrite');
      const writeStore = writeTransaction.objectStore(this.STORES.HEALTH_DATA);
      
      let dataToSave: HealthDataRecord;
      
      if (mode === 'merge' && existingRecord) {
        dataToSave = {
          ...existingRecord,
          ...record,
          // 배열 데이터 머지 (중복 제거)
          healthData: [...(existingRecord.healthData || []), ...(record.healthData || [])],
          prescriptionData: [...(existingRecord.prescriptionData || []), ...(record.prescriptionData || [])],
          updatedAt: new Date().toISOString()
        };
      } else {
        dataToSave = {
          ...record,
          updatedAt: new Date().toISOString(),
          createdAt: existingRecord?.createdAt || new Date().toISOString()
        };
      }

      const writeRequest = writeStore.put(dataToSave);

      return new Promise((resolve, reject) => {
        writeRequest.onsuccess = () => {
          console.log('✅ [IndexedDB] 건강 데이터 저장 완료:', record.uuid);
          resolve(true);
        };

        writeRequest.onerror = () => {
          console.error('❌ [IndexedDB] 건강 데이터 저장 실패:', writeRequest.error);
          reject(writeRequest.error);
        };

        writeTransaction.onerror = () => {
          console.error('❌ [IndexedDB] 쓰기 트랜잭션 실패:', writeTransaction.error);
          reject(writeTransaction.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] saveHealthData 오류:', error);
      return false;
    }
  }

  /**
   * 건강 데이터 조회
   */
  static async getHealthData(uuid: string): Promise<HealthDataRecord | null> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.HEALTH_DATA], 'readonly');
      const store = transaction.objectStore(this.STORES.HEALTH_DATA);
      const request = store.get(uuid);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            console.log('✅ [IndexedDB] 건강 데이터 조회 완료:', uuid, {
              healthDataCount: result.healthData?.length || 0,
              prescriptionDataCount: result.prescriptionData?.length || 0,
              healthData타입: Array.isArray(result.healthData) ? 'array' : typeof result.healthData,
              prescriptionData타입: Array.isArray(result.prescriptionData) ? 'array' : typeof result.prescriptionData,
              전체키: Object.keys(result)
            });
            
            // 데이터가 비어있으면 상세 확인
            if ((!result.healthData || result.healthData.length === 0) && 
                (!result.prescriptionData || result.prescriptionData.length === 0)) {
              console.warn('⚠️ [IndexedDB] 레코드는 있지만 데이터가 비어있음:', {
                uuid: result.uuid,
                patientName: result.patientName,
                hospitalId: result.hospitalId,
                dataSource: result.dataSource,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                healthData: result.healthData,
                prescriptionData: result.prescriptionData
              });
            }
            
            resolve(result);
          } else {
            // UUID가 없을 때 모든 UUID 목록 확인
            const allRequest = store.getAll();
            allRequest.onsuccess = () => {
              const allRecords = allRequest.result;
              const allUuids = allRecords.map((r: HealthDataRecord) => r.uuid);
              console.log('📭 [IndexedDB] 건강 데이터 없음:', uuid);
              console.log('📋 [IndexedDB] 저장된 모든 UUID 목록:', allUuids);
              console.log('🔍 [IndexedDB] UUID 매칭 확인:', {
                찾는UUID: uuid,
                저장된UUID목록: allUuids,
                매칭여부: allUuids.includes(uuid)
              });
            };
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 건강 데이터 조회 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] getHealthData 오류:', error);
      return null;
    }
  }

  /**
   * 모든 건강 데이터 조회
   */
  static async getAllHealthData(): Promise<HealthDataRecord[]> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.HEALTH_DATA], 'readonly');
      const store = transaction.objectStore(this.STORES.HEALTH_DATA);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('✅ [IndexedDB] 전체 건강 데이터 조회 완료:', request.result.length + '건');
          resolve(request.result);
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 전체 건강 데이터 조회 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] getAllHealthData 오류:', error);
      return [];
    }
  }

  /**
   * 건강 데이터 삭제
   */
  static async deleteHealthData(uuid: string): Promise<boolean> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.HEALTH_DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.HEALTH_DATA);
      const request = store.delete(uuid);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('✅ [IndexedDB] 건강 데이터 삭제 완료:', uuid);
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 건강 데이터 삭제 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] deleteHealthData 오류:', error);
      return false;
    }
  }

  /**
   * 세션 데이터 저장
   */
  static async saveSessionData(record: SessionRecord): Promise<boolean> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.SESSION_DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.SESSION_DATA);
      const request = store.put(record);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('✅ [IndexedDB] 세션 데이터 저장 완료:', record.sessionId);
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 세션 데이터 저장 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] saveSessionData 오류:', error);
      return false;
    }
  }

  /**
   * 세션 데이터 조회
   */
  static async getSessionData(sessionId: string): Promise<SessionRecord | null> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.SESSION_DATA], 'readonly');
      const store = transaction.objectStore(this.STORES.SESSION_DATA);
      const request = store.get(sessionId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            // 만료 시간 체크
            const now = new Date().toISOString();
            if (result.expiresAt < now) {
              console.log('⏰ [IndexedDB] 세션 만료됨:', sessionId);
              this.deleteSessionData(sessionId); // 만료된 세션 삭제
              resolve(null);
            } else {
              console.log('✅ [IndexedDB] 세션 데이터 조회 완료:', sessionId);
              resolve(result);
            }
          } else {
            console.log('📭 [IndexedDB] 세션 데이터 없음:', sessionId);
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 세션 데이터 조회 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] getSessionData 오류:', error);
      return null;
    }
  }

  /**
   * 세션 데이터 삭제
   */
  static async deleteSessionData(sessionId: string): Promise<boolean> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.SESSION_DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.SESSION_DATA);
      const request = store.delete(sessionId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('✅ [IndexedDB] 세션 데이터 삭제 완료:', sessionId);
          resolve(true);
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 세션 데이터 삭제 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] deleteSessionData 오류:', error);
      return false;
    }
  }

  /**
   * 만료된 세션 정리
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.SESSION_DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.SESSION_DATA);
      const index = store.index('expiresAt');
      
      const now = new Date().toISOString();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log('🧹 [IndexedDB] 만료된 세션 정리 완료:', deletedCount + '개');
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.error('❌ [IndexedDB] 만료된 세션 정리 실패:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] cleanupExpiredSessions 오류:', error);
      return 0;
    }
  }

  /**
   * 데이터베이스 통계 조회
   */
  static async getStorageStats(): Promise<{
    healthDataCount: number;
    sessionDataCount: number;
    totalSize: number;
  }> {
    try {
      const healthData = await this.getAllHealthData();
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.SESSION_DATA], 'readonly');
      const store = transaction.objectStore(this.STORES.SESSION_DATA);
      const sessionRequest = store.getAll();

      return new Promise((resolve, reject) => {
        sessionRequest.onsuccess = () => {
          const sessionData = sessionRequest.result;
          
          // 대략적인 크기 계산
          const healthDataSize = JSON.stringify(healthData).length;
          const sessionDataSize = JSON.stringify(sessionData).length;
          
          const stats = {
            healthDataCount: healthData.length,
            sessionDataCount: sessionData.length,
            totalSize: healthDataSize + sessionDataSize
          };

          console.log('📊 [IndexedDB] 저장소 통계:', stats);
          resolve(stats);
        };

        sessionRequest.onerror = () => {
          console.error('❌ [IndexedDB] 저장소 통계 조회 실패:', sessionRequest.error);
          reject(sessionRequest.error);
        };
      });

    } catch (error) {
      console.error('❌ [IndexedDB] getStorageStats 오류:', error);
      return {
        healthDataCount: 0,
        sessionDataCount: 0,
        totalSize: 0
      };
    }
  }

  /**
   * 전체 데이터베이스 초기화 (개발용)
   */
  static async clearAllData(): Promise<boolean> {
    try {
      const db = await this.ensureConnection();
      const transaction = db.transaction([this.STORES.HEALTH_DATA, this.STORES.SESSION_DATA], 'readwrite');
      
      const healthStore = transaction.objectStore(this.STORES.HEALTH_DATA);
      const sessionStore = transaction.objectStore(this.STORES.SESSION_DATA);
      
      await Promise.all([
        new Promise((resolve, reject) => {
          const request = healthStore.clear();
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        }),
        new Promise((resolve, reject) => {
          const request = sessionStore.clear();
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        })
      ]);

      console.log('🧹 [IndexedDB] 전체 데이터 초기화 완료');
      return true;

    } catch (error) {
      console.error('❌ [IndexedDB] clearAllData 오류:', error);
      return false;
    }
  }
}

// 호환성을 위해 WelloIndexedDB로도 내보냄
export const WelloIndexedDB = WelnoIndexedDB;

// 앱 시작 시 자동 초기화
if (typeof window !== 'undefined') {
  WelnoIndexedDB.initialize().catch(error => {
    console.error('❌ [IndexedDB] 자동 초기화 실패:', error);
  });
}
