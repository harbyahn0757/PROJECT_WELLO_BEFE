# 클라이언트 데이터 삭제 명령어

브라우저 개발자 도구 콘솔에서 다음 명령어들을 실행하세요.

## 1. IndexedDB 삭제

```javascript
// IndexedDB 데이터베이스 삭제
indexedDB.deleteDatabase('WelnoHealthDB').onsuccess = () => {
  console.log('✅ IndexedDB 삭제 완료');
};
```

또는 더 상세한 삭제:

```javascript
// IndexedDB 모든 데이터 삭제
const deleteDB = indexedDB.deleteDatabase('WelnoHealthDB');
deleteDB.onsuccess = () => {
  console.log('✅ IndexedDB 데이터베이스 삭제 완료');
};
deleteDB.onerror = (e) => {
  console.error('❌ IndexedDB 삭제 실패:', e);
};
deleteDB.onblocked = () => {
  console.warn('⚠️ IndexedDB 삭제 차단됨 (다른 탭에서 사용 중일 수 있음)');
};
```

## 2. localStorage 삭제

```javascript
// 모든 localStorage 항목 삭제
localStorage.clear();
console.log('✅ localStorage 삭제 완료');
```

또는 특정 항목만 삭제:

```javascript
// 특정 키만 삭제
localStorage.removeItem('tilko_patient_uuid');
localStorage.removeItem('tilko_hospital_id');
localStorage.removeItem('tilko_collected_data');
localStorage.removeItem('welno_patient_uuid');
localStorage.removeItem('welno_hospital_id');
console.log('✅ localStorage 특정 항목 삭제 완료');
```

## 3. sessionStorage 삭제

```javascript
// 모든 sessionStorage 항목 삭제
sessionStorage.clear();
console.log('✅ sessionStorage 삭제 완료');
```

## 4. 한 번에 모두 삭제

```javascript
// 모든 클라이언트 데이터 삭제
(async () => {
  try {
    // IndexedDB 삭제
    await new Promise((resolve, reject) => {
      const deleteDB = indexedDB.deleteDatabase('WelnoHealthDB');
      deleteDB.onsuccess = () => resolve();
      deleteDB.onerror = () => reject(deleteDB.error);
      deleteDB.onblocked = () => {
        console.warn('⚠️ IndexedDB 삭제 차단됨 - 다른 탭을 닫고 다시 시도하세요');
        resolve(); // 차단되어도 계속 진행
      };
    });
    console.log('✅ IndexedDB 삭제 완료');
    
    // localStorage 삭제
    localStorage.clear();
    console.log('✅ localStorage 삭제 완료');
    
    // sessionStorage 삭제
    sessionStorage.clear();
    console.log('✅ sessionStorage 삭제 완료');
    
    console.log('🎉 모든 클라이언트 데이터 삭제 완료!');
    console.log('페이지를 새로고침하세요.');
  } catch (error) {
    console.error('❌ 삭제 중 오류:', error);
  }
})();
```

## 5. IndexedDB 데이터 확인 명령어

삭제 전에 현재 저장된 데이터 확인:

```javascript
// IndexedDB 모든 레코드 확인
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
          console.log(`    - 수정일: ${record.updatedAt}`);
          console.log('');
        });
        
        // 데이터가 있는 레코드만 필터링
        const recordsWithData = allRecords.filter(r => 
          (r.healthData && r.healthData.length > 0) || 
          (r.prescriptionData && r.prescriptionData.length > 0)
        );
        
        console.log(`\n✅ 데이터가 있는 레코드: ${recordsWithData.length}건\n`);
        
        // 데이터가 없는 레코드
        const recordsWithoutData = allRecords.filter(r => 
          (!r.healthData || r.healthData.length === 0) && 
          (!r.prescriptionData || r.prescriptionData.length === 0)
        );
        
        console.log(`\n⚠️ 데이터가 없는 레코드: ${recordsWithoutData.length}건\n`);
        
        db.close();
      };
    };
  } catch (error) {
    console.error('❌ 오류:', error);
  }
})();
```

## 6. 확인 명령어

삭제 후 데이터가 정말 삭제되었는지 확인:

```javascript
// IndexedDB 확인
indexedDB.databases().then(dbs => {
  const welnoDB = dbs.find(db => db.name === 'WelnoHealthDB');
  if (welnoDB) {
    console.log('⚠️ IndexedDB가 아직 존재합니다:', welnoDB);
  } else {
    console.log('✅ IndexedDB 삭제 확인됨');
  }
});

// localStorage 확인
console.log('localStorage 항목 수:', localStorage.length);
console.log('localStorage 키 목록:', Object.keys(localStorage));

// sessionStorage 확인
console.log('sessionStorage 항목 수:', sessionStorage.length);
console.log('sessionStorage 키 목록:', Object.keys(sessionStorage));
```

## 사용 방법

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭 선택
3. 위의 명령어 중 하나를 복사하여 붙여넣기
4. Enter 키 누르기
5. 페이지 새로고침 (F5 또는 Ctrl+R)

## 주의사항

- IndexedDB 삭제는 다른 탭에서 데이터베이스를 사용 중이면 차단될 수 있습니다.
- 모든 탭을 닫고 다시 열거나, 다른 탭을 먼저 닫은 후 삭제하세요.
- 삭제된 데이터는 복구할 수 없습니다.
