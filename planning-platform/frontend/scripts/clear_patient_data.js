/**
 * 환자 데이터 완전 삭제 스크립트 (고도화 버전)
 * 브라우저 콘솔에서 실행
 * 
 * 사용법:
 *   clearPatientData('안광수')  // 이름으로 삭제
 *   clearPatientData(null, 'uuid-here', 'hospital-id')  // UUID로 삭제
 *   clearPatientData()  // 모든 welno 데이터 삭제
 */

async function clearPatientData(patientName = null, uuid = null, hospitalId = null) {
  console.log('🗑️ 환자 데이터 완전 삭제 시작...');
  
  // 1. localStorage 정리
  const localStorageKeys = Object.keys(localStorage);
  const welnoKeys = localStorageKeys.filter(key => 
    key.includes('welno') || 
    key.includes('tilko') || 
    key.includes('Welno') ||
    key.includes('patient') ||
    key.includes('hospital') ||
    key.includes('uuid')
  );
  
  console.log(`📋 발견된 localStorage 키: ${welnoKeys.length}개`);
  welnoKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`   - ${key}: ${value ? value.substring(0, 50) : '(empty)'}`);
    localStorage.removeItem(key);
    console.log(`✅ localStorage 삭제: ${key}`);
  });
  
  // 2. sessionStorage 정리
  const sessionStorageKeys = Object.keys(sessionStorage);
  const welnoSessionKeys = sessionStorageKeys.filter(key => 
    key.includes('welno') || 
    key.includes('Welno') ||
    key.includes('patient') ||
    key.includes('hospital') ||
    key.includes('uuid')
  );
  
  console.log(`📋 발견된 sessionStorage 키: ${welnoSessionKeys.length}개`);
  welnoSessionKeys.forEach(key => {
    sessionStorage.removeItem(key);
    console.log(`✅ sessionStorage 삭제: ${key}`);
  });
  
  // 3. IndexedDB 삭제
  const DB_NAME = 'WelnoHealthDB';
  const STORE_NAME = 'health_data';
  
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();
      
      getAllReq.onsuccess = () => {
        const allRecords = getAllReq.result;
        console.log(`📋 IndexedDB 전체 레코드: ${allRecords.length}건`);
        
        // 필터링
        let matchingRecords = [];
        if (patientName) {
          matchingRecords = allRecords.filter(r => r.patientName === patientName);
          console.log(`🔍 ${patientName} 환자 레코드: ${matchingRecords.length}건`);
        } else if (uuid && hospitalId) {
          matchingRecords = allRecords.filter(r => r.uuid === uuid && r.hospitalId === hospitalId);
          console.log(`🔍 UUID ${uuid} 레코드: ${matchingRecords.length}건`);
        } else if (uuid) {
          matchingRecords = allRecords.filter(r => r.uuid === uuid);
          console.log(`🔍 UUID ${uuid} 레코드: ${matchingRecords.length}건`);
        } else {
          matchingRecords = allRecords;
          console.log(`🔍 모든 레코드 삭제: ${matchingRecords.length}건`);
        }
        
        if (matchingRecords.length === 0) {
          console.log('⚠️ IndexedDB에 해당 데이터가 없습니다.');
          db.close();
          resolve();
          return;
        }
        
        // 각 레코드 정보 출력
        matchingRecords.forEach(record => {
          console.log(`   - 이름: ${record.patientName || '(없음)'}, UUID: ${record.uuid}, Hospital: ${record.hospitalId}, 건강검진: ${record.healthData?.length || 0}건, 처방전: ${record.prescriptionData?.length || 0}건`);
        });
        
        // 삭제
        let deleted = 0;
        const deletes = matchingRecords.map(r => {
          return new Promise(delResolve => {
            const delReq = store.delete(r.uuid);
            delReq.onsuccess = () => {
              console.log(`✅ IndexedDB 삭제: ${r.uuid}`);
              deleted++;
              delResolve();
            };
            delReq.onerror = () => {
              console.error(`❌ IndexedDB 삭제 실패: ${r.uuid}`, delReq.error);
              delResolve();
            };
          });
        });
        
        Promise.all(deletes).then(() => {
          console.log(`✅ IndexedDB 총 ${deleted}건 삭제 완료`);
          db.close();
          console.log('\n✅ 모든 캐시 및 IndexedDB 정리 완료!');
          console.log('새로고침(F5) 후 테스트를 시작하세요.');
          resolve();
        });
      };
      
      getAllReq.onerror = () => {
        console.error('❌ IndexedDB 조회 실패:', getAllReq.error);
        db.close();
        resolve();
      };
    };
    
    request.onerror = () => {
      console.error('❌ IndexedDB 열기 실패:', request.error);
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// 즉시 실행 (이름으로 삭제)
// clearPatientData('안광수');

// UUID로 삭제
// clearPatientData(null, 'uuid-here', 'hospital-id');

// 모든 데이터 삭제
// clearPatientData();

console.log('✅ clearPatientData 함수가 로드되었습니다.');
console.log('사용법:');
console.log('  clearPatientData("안광수")  // 이름으로 삭제');
console.log('  clearPatientData(null, "uuid", "hospital-id")  // UUID로 삭제');
console.log('  clearPatientData()  // 모든 welno 데이터 삭제');
