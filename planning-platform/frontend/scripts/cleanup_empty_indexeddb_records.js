// 브라우저 콘솔에서 실행할 IndexedDB 빈 레코드 삭제 스크립트
(async () => {
  try {
    const dbName = 'WelnoHealthDB';
    const storeName = 'health_data';
    
    const request = indexedDB.open(dbName);
    
    request.onsuccess = async (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(storeName)) {
        console.error(`❌ 스토어 '${storeName}'가 존재하지 않습니다.`);
        db.close();
        return;
      }
      
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allRecords = getAllRequest.result;
        console.log(`\n📊 IndexedDB 전체 레코드: ${allRecords.length}건\n`);
        
        // 데이터가 없는 레코드 필터링
        const recordsWithoutData = allRecords.filter(r => 
          (!r.healthData || r.healthData.length === 0) && 
          (!r.prescriptionData || r.prescriptionData.length === 0)
        );
        
        console.log(`⚠️ 데이터가 없는 레코드: ${recordsWithoutData.length}건\n`);
        
        if (recordsWithoutData.length === 0) {
          console.log('✅ 삭제할 레코드가 없습니다.');
          db.close();
          return;
        }
        
        // 삭제할 레코드 목록 표시
        recordsWithoutData.forEach((record, index) => {
          console.log(`[${index + 1}] 삭제 예정: ${record.uuid}`);
          console.log(`    - 이름: ${record.patientName}`);
          console.log(`    - 병원: ${record.hospitalId}`);
          console.log(`    - 수정일: ${record.updatedAt}`);
          console.log('');
        });
        
        // 삭제 실행
        let deletedCount = 0;
        const deletePromises = recordsWithoutData.map(record => {
          return new Promise((resolve, reject) => {
            const deleteRequest = store.delete(record.uuid);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              console.log(`✅ 삭제 완료: ${record.uuid}`);
              resolve(true);
            };
            deleteRequest.onerror = () => {
              console.error(`❌ 삭제 실패: ${record.uuid}`, deleteRequest.error);
              reject(deleteRequest.error);
            };
          });
        });
        
        Promise.all(deletePromises)
          .then(() => {
            console.log(`\n✅ 총 ${deletedCount}건의 빈 레코드 삭제 완료`);
            console.log(`📊 남은 레코드: ${allRecords.length - deletedCount}건\n`);
            db.close();
          })
          .catch(error => {
            console.error('❌ 삭제 중 오류:', error);
            db.close();
          });
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
