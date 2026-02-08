# 환자 데이터 삭제 명령어

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: 환자 데이터 삭제 명령어 (PostgreSQL·스크립트)

---

## 대상 환자 정보
- UUID: `0a030e57-80fd-4010-af74-9aa3ffe0407b`
- Hospital ID: `PEERNINE`

## 1. PostgreSQL 데이터베이스 삭제

### 방법 1: Python 스크립트 실행 (권장)

```bash
cd planning-platform/backend
python scripts/delete_patient_data_by_uuid.py
```

### 방법 2: 직접 SQL 실행

```bash
# PostgreSQL에 접속
psql -h 10.0.1.10 -p 5432 -U peernine -d p9_mkt_biz

# 또는 환경변수 사용
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
```

SQL 명령어:
```sql
-- 트랜잭션 시작
BEGIN;

-- 건강검진 데이터 삭제
DELETE FROM welno.welno_checkup_data 
WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 처방전 데이터 삭제
DELETE FROM welno.welno_prescription_data 
WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 환자 정보 플래그 업데이트
UPDATE welno.welno_patients 
SET has_health_data = FALSE,
    has_prescription_data = FALSE,
    last_data_update = NULL,
    updated_at = NOW()
WHERE uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 확인
SELECT 
    (SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' AND hospital_id = 'PEERNINE') as health_count,
    (SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' AND hospital_id = 'PEERNINE') as prescription_count,
    has_health_data,
    has_prescription_data
FROM welno.welno_patients
WHERE uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 커밋 (확인 후)
COMMIT;
-- 또는 롤백 (문제가 있으면)
-- ROLLBACK;
```

## 2. IndexedDB 삭제 (브라우저 콘솔)

브라우저 개발자 도구 콘솔에서 실행:

```javascript
// IndexedDB 데이터 삭제
(async () => {
  const DB_NAME = 'WelnoHealthDB';
  const UUID = '0a030e57-80fd-4010-af74-9aa3ffe0407b';
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['health_data'], 'readwrite');
      const store = transaction.objectStore('health_data');
      
      const deleteRequest = store.delete(UUID);
      
      deleteRequest.onsuccess = () => {
        console.log('✅ IndexedDB 데이터 삭제 완료:', UUID);
        db.close();
        resolve(true);
      };
      
      deleteRequest.onerror = () => {
        console.error('❌ IndexedDB 삭제 실패:', deleteRequest.error);
        db.close();
        reject(deleteRequest.error);
      };
    };
    
    request.onerror = () => {
      console.error('❌ IndexedDB 열기 실패:', request.error);
      reject(request.error);
    };
  });
})();

// 확인
(async () => {
  const DB_NAME = 'WelnoHealthDB';
  const UUID = '0a030e57-80fd-4010-af74-9aa3ffe0407b';
  
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['health_data'], 'readonly');
      const store = transaction.objectStore('health_data');
      const getRequest = store.get(UUID);
      
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          console.log('⚠️ IndexedDB에 데이터가 아직 있습니다:', getRequest.result);
        } else {
          console.log('✅ IndexedDB에 데이터가 없습니다 (삭제 완료)');
        }
        db.close();
        resolve(getRequest.result);
      };
    };
  });
})();
```

## 3. localStorage 삭제 (브라우저 콘솔)

브라우저 개발자 도구 콘솔에서 실행:

```javascript
// localStorage에서 관련 데이터 삭제
const UUID = '0a030e57-80fd-4010-af74-9aa3ffe0407b';
const HOSPITAL_ID = 'PEERNINE';

// 환자 UUID와 Hospital ID 삭제
localStorage.removeItem('welno_patient_uuid');
localStorage.removeItem('welno_hospital_id');

// 특정 UUID/Hospital 조합 확인 후 삭제
const keysToCheck = [
  'welno_health_data',
  'welno_view_mode',
  'tilko_session_id',
  'tilko_session_data',
  'tilko_collected_data',
  'tilko_manual_collect',
  'tilko_collecting_status',
  'tilko_auth_requested',
  'password_modal_open',
  'password_auth_time',
  'login_input_data'
];

keysToCheck.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    try {
      const parsed = JSON.parse(value);
      // UUID나 Hospital ID가 포함된 경우 삭제
      if (parsed && (
        parsed.uuid === UUID || 
        parsed.patient_uuid === UUID ||
        parsed.hospital_id === HOSPITAL_ID ||
        parsed.hospital === HOSPITAL_ID
      )) {
        localStorage.removeItem(key);
        console.log(`✅ 삭제: ${key}`);
      }
    } catch (e) {
      // JSON 파싱 실패 시 그냥 삭제
      localStorage.removeItem(key);
      console.log(`✅ 삭제 (JSON 아님): ${key}`);
    }
  }
});

// 전체 localStorage 확인
console.log('현재 localStorage 키 목록:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(`  - ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
}
```

## 4. 전체 삭제 (모든 환자 데이터)

### IndexedDB 전체 삭제

```javascript
// IndexedDB 전체 삭제
indexedDB.deleteDatabase('WelnoHealthDB').onsuccess = () => {
  console.log('✅ IndexedDB 전체 삭제 완료');
};
```

### localStorage 전체 삭제

```javascript
// localStorage 전체 삭제
localStorage.clear();
console.log('✅ localStorage 전체 삭제 완료');
```

## 5. 삭제 확인

### DB 확인

```sql
-- 건강검진 데이터 확인
SELECT COUNT(*) FROM welno.welno_checkup_data 
WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 처방전 데이터 확인
SELECT COUNT(*) FROM welno.welno_prescription_data 
WHERE patient_uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';

-- 환자 정보 확인
SELECT uuid, hospital_id, name, has_health_data, has_prescription_data 
FROM welno.welno_patients 
WHERE uuid = '0a030e57-80fd-4010-af74-9aa3ffe0407b' 
  AND hospital_id = 'PEERNINE';
```

### IndexedDB 확인

```javascript
// IndexedDB 데이터 확인
(async () => {
  const DB_NAME = 'WelnoHealthDB';
  const UUID = '0a030e57-80fd-4010-af74-9aa3ffe0407b';
  
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['health_data'], 'readonly');
      const store = transaction.objectStore('health_data');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        console.log('IndexedDB 전체 데이터:', getAllRequest.result);
        const targetData = getAllRequest.result.find(r => r.uuid === UUID);
        if (targetData) {
          console.log('⚠️ 대상 데이터 발견:', targetData);
        } else {
          console.log('✅ 대상 데이터 없음 (삭제 완료)');
        }
        db.close();
        resolve(getAllRequest.result);
      };
    };
  });
})();
```
