# 서버 및 클라이언트 데이터 전체 삭제 가이드

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: 서버·클라이언트 데이터 전체 삭제 가이드

---

## 1. 서버 DB 데이터 삭제

서버 DB의 모든 테스트 데이터를 삭제합니다.

```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
python3 scripts/delete_all_test_data.py
```

또는 특정 UUID만 삭제:

```bash
# UUID를 직접 지정하여 삭제
python3 scripts/delete_patient_data_by_uuid.py
# (스크립트 내부의 UUID 변수를 수정 후 실행)
```

## 2. 클라이언트 데이터 삭제

### IndexedDB 삭제

브라우저 콘솔에서 실행:

```javascript
// IndexedDB 데이터베이스 삭제
const deleteDB = indexedDB.deleteDatabase('WelnoHealthDB');
deleteDB.onsuccess = () => {
  console.log('✅ IndexedDB 삭제 완료');
};
deleteDB.onerror = (e) => {
  console.error('❌ IndexedDB 삭제 실패:', e);
};
deleteDB.onblocked = () => {
  console.warn('⚠️ IndexedDB 삭제 차단됨 - 다른 탭을 닫고 다시 시도하세요');
};
```

### localStorage 삭제

```javascript
// 모든 localStorage 항목 삭제
localStorage.clear();
console.log('✅ localStorage 삭제 완료');
```

### sessionStorage 삭제

```javascript
// 모든 sessionStorage 항목 삭제
sessionStorage.clear();
console.log('✅ sessionStorage 삭제 완료');
```

## 3. 한 번에 모두 삭제

브라우저 콘솔에서 실행:

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

## 4. 삭제 확인

### 서버 DB 확인

```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
python3 scripts/check_health_data_by_uuid.py
```

### 클라이언트 확인

브라우저 콘솔에서 실행:

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

## 5. 삭제 후 다음 단계

1. 페이지 새로고침 (F5)
2. 메인 페이지 접속
3. 플로팅 버튼 클릭하여 새로 인증 시작
4. 데이터 수집 완료 후 결과 확인
