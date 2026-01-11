// 브라우저 콘솔에서 실행할 IndexedDB 데이터 확인 스크립트
(async () => {
  try {
    const dbName = 'WelnoHealthDB';  // 실제 DB 이름
    const storeName = 'health_data';
    
    const request = indexedDB.open(dbName);
    
    request.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allRecords = getAllRequest.result;
        console.log(`\n📊 IndexedDB 전체 레코드: ${allRecords.length}건\n`);
        
        allRecords.forEach((record, index) => {
          console.log(`[${index + 1}] UUID: ${record.uuid}`);
          console.log(`    - 병원: ${record.hospitalId}`);
          console.log(`    - 이름: ${record.patientName}`);
          console.log(`    - 건강검진: ${record.healthData?.length || 0}건`);
          console.log(`    - 처방전: ${record.prescriptionData?.length || 0}건`);
          console.log(`    - 데이터소스: ${record.dataSource || 'unknown'}`);
          console.log(`    - 생성일: ${record.createdAt}`);
          console.log(`    - 수정일: ${record.updatedAt}`);
          console.log('');
        });
        
        // 데이터가 있는 레코드만 필터링
        const recordsWithData = allRecords.filter(r => 
          (r.healthData && r.healthData.length > 0) || 
          (r.prescriptionData && r.prescriptionData.length > 0)
        );
        
        console.log(`\n✅ 데이터가 있는 레코드: ${recordsWithData.length}건\n`);
        
        if (recordsWithData.length > 0) {
          recordsWithData.forEach((record, index) => {
            console.log(`[${index + 1}] UUID: ${record.uuid}`);
            console.log(`    - 건강검진: ${record.healthData?.length || 0}건`);
            console.log(`    - 처방전: ${record.prescriptionData?.length || 0}건`);
            console.log(`    - 수정일: ${record.updatedAt}`);
            console.log('');
          });
        }
        
        // 데이터가 없는 레코드
        const recordsWithoutData = allRecords.filter(r => 
          (!r.healthData || r.healthData.length === 0) && 
          (!r.prescriptionData || r.prescriptionData.length === 0)
        );
        
        console.log(`\n⚠️ 데이터가 없는 레코드: ${recordsWithoutData.length}건\n`);
        
        if (recordsWithoutData.length > 0) {
          recordsWithoutData.forEach((record, index) => {
            console.log(`[${index + 1}] UUID: ${record.uuid} - ${record.patientName}`);
            console.log(`    - 수정일: ${record.updatedAt}`);
            console.log('');
          });
        }
        
        db.close();
      };
      
      getAllRequest.onerror = () => {
        console.error('❌ 데이터 조회 실패:', getAllRequest.error);
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
