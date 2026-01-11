// 브라우저 콘솔에서 실행할 IndexedDB 데이터 확인 스크립트
// 사용법: 브라우저 개발자 도구 콘솔에 복사해서 실행

(async function checkIndexedDB() {
  const DB_NAME = 'WelnoHealthDB';
  const STORE_NAME = 'health_data';
  const UUID = '1d2e9e40-de4b-4328-be90-be7540787f6b'; // 확인할 UUID
  
  try {
    // IndexedDB 열기
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 IndexedDB 데이터 확인');
      console.log('='.repeat(80));
      
      // 특정 UUID로 조회
      const getRequest = store.get(UUID);
      
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        
        if (record) {
          console.log('\n✅ 데이터 발견:', UUID);
          console.log('\n📋 기본 정보:');
          console.log('  - UUID:', record.uuid);
          console.log('  - 환자명:', record.patientName);
          console.log('  - 병원 ID:', record.hospitalId);
          console.log('  - 데이터 출처:', record.dataSource);
          console.log('  - 생성일:', record.createdAt);
          console.log('  - 수정일:', record.updatedAt);
          
          console.log('\n🏥 건강검진 데이터:');
          console.log('  - 개수:', record.healthData?.length || 0);
          
          if (record.healthData && record.healthData.length > 0) {
            console.log('\n  샘플 데이터 (최대 3건):');
            record.healthData.slice(0, 3).forEach((item, index) => {
              console.log(`\n  [${index + 1}]`);
              console.log('    - Year:', item.Year || item.year);
              console.log('    - CheckUpDate:', item.CheckUpDate || item.checkup_date);
              console.log('    - Location:', item.Location || item.location);
              console.log('    - Code:', item.Code || item.code);
              if (item.raw_data) {
                console.log('    - raw_data 존재: ✅');
              }
            });
            
            // 첫 번째 항목의 전체 구조 확인
            if (record.healthData[0]) {
              console.log('\n  첫 번째 항목의 전체 키:');
              console.log('    ', Object.keys(record.healthData[0]).join(', '));
            }
          } else {
            console.log('  ⚠️ 건강검진 데이터가 비어있습니다.');
          }
          
          console.log('\n💊 처방전 데이터:');
          console.log('  - 개수:', record.prescriptionData?.length || 0);
          
          if (record.prescriptionData && record.prescriptionData.length > 0) {
            console.log('\n  샘플 데이터 (최대 3건):');
            record.prescriptionData.slice(0, 3).forEach((item, index) => {
              console.log(`\n  [${index + 1}]`);
              console.log('    - ByungEuiwonYakGukMyung:', item.ByungEuiwonYakGukMyung || item.hospital_name);
              console.log('    - JinRyoGaesiIl:', item.JinRyoGaesiIl || item.treatment_date);
              console.log('    - JinRyoHyungTae:', item.JinRyoHyungTae || item.treatment_type);
              if (item.raw_data) {
                console.log('    - raw_data 존재: ✅');
              }
            });
            
            // 첫 번째 항목의 전체 구조 확인
            if (record.prescriptionData[0]) {
              console.log('\n  첫 번째 항목의 전체 키:');
              console.log('    ', Object.keys(record.prescriptionData[0]).join(', '));
            }
          } else {
            console.log('  ⚠️ 처방전 데이터가 비어있습니다.');
          }
          
          // 데이터 크기 확인
          const dataSize = JSON.stringify(record).length;
          console.log('\n📊 데이터 크기:');
          console.log('  - 전체:', (dataSize / 1024).toFixed(2), 'KB');
          console.log('  - 건강검진:', (JSON.stringify(record.healthData || []).length / 1024).toFixed(2), 'KB');
          console.log('  - 처방전:', (JSON.stringify(record.prescriptionData || []).length / 1024).toFixed(2), 'KB');
          
        } else {
          console.log('\n❌ 데이터를 찾을 수 없습니다:', UUID);
          
          // 모든 키 확인
          const getAllRequest = store.getAllKeys();
          getAllRequest.onsuccess = () => {
            const keys = getAllRequest.result;
            console.log('\n📋 IndexedDB에 저장된 모든 UUID:');
            if (keys.length > 0) {
              keys.forEach((key, index) => {
                console.log(`  [${index + 1}] ${key}`);
              });
            } else {
              console.log('  ⚠️ IndexedDB에 저장된 데이터가 없습니다.');
            }
          };
        }
        
        db.close();
        console.log('\n' + '='.repeat(80));
        console.log('✅ 확인 완료');
        console.log('='.repeat(80) + '\n');
      };
      
      getRequest.onerror = () => {
        console.error('❌ 데이터 조회 실패:', getRequest.error);
        db.close();
      };
    };
    
    request.onerror = () => {
      console.error('❌ IndexedDB 열기 실패:', request.error);
    };
    
  } catch (error) {
    console.error('❌ 오류:', error);
  }
})();

// 간단한 버전 (한 줄로 실행)
// indexedDB.open('WelnoHealthDB', 1).onsuccess = (e) => { const db = e.target.result; const tx = db.transaction(['health_data'], 'readonly'); const store = tx.objectStore('health_data'); store.get('1d2e9e40-de4b-4328-be90-be7540787f6b').onsuccess = (r) => { const data = r.target.result; console.log('건강검진:', data?.healthData?.length || 0, '건'); console.log('처방전:', data?.prescriptionData?.length || 0, '건'); console.log('전체 데이터:', data); }; };
