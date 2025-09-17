# 📋 메모리 흐름 분석 및 리팩터링 계획

## 🔍 현재 메모리 흐름 분석

### 1. 데이터 수집 단계

#### **파일 업로드 및 분석**
```
사용자 → PDF 업로드 → 백엔드 분석 → analysisResults → tables 데이터
```

#### **키 인식**
```
사용자 키 선택 → recognizedKeys → keyMappings 후보 생성
```

### 2. 매핑 생성 단계

#### **수동 매핑 플로우 (✅ 정상 작동)**
```
1. 사용자가 키 선택 (setSelectedKey)
2. 앵커 셀 클릭 (setAnchorCell)
3. 값 셀 클릭 (setValueCell)
4. 상대 위치 계산 (setRelativePosition)
5. handleSaveMapping() 호출
6. 표준 매핑 객체 생성:
   {
     id: Date.now(),
     key: selectedKey,
     keyLabel: getKeyLabel(selectedKey, 'ko'),
     anchorCell: {
       ...anchorCell,
       table: analysisResults?.tables?.find(...)?.data  // 🔑 핵심
     },
     valueCell,
     relativePosition,
     tableId: currentTableId,
     createdAt: new Date().toISOString()
   }
7. keyMappings 배열에 추가/업데이트
8. 동적 UI 생성 (키 매핑 아이템)
```

#### **AI 매핑 플로우 (❌ 문제 있음)**
```
1. 사용자가 키 선택
2. AI API 호출 (performAIExtraction)
3. AI 응답 수신
4. 복잡한 변환 로직 (convertedMapping) ← 🚨 문제 지점
   - 다른 ID 생성 방식
   - 다른 구조 (anchorCell.table 누락)
   - 복잡한 필드 매핑
5. setKeyMappings(aiMappings) ← 🚨 기존 매핑 덮어씀
6. 자동 첫 번째 키 선택
```

### 3. 메모리 관리 단계

#### **keyMappings 배열 CRUD**
```javascript
// 추가 (CREATE)
수동: setKeyMappings([...keyMappings, newMapping])     // ✅ 기존 보존
AI:   setKeyMappings(aiMappings)                      // ❌ 기존 덮어씀

// 조회 (READ)
keyMappings.find(mapping => mapping.key === keyValue) // ✅ 동일

// 수정 (UPDATE)
const updatedMappings = [...keyMappings];
updatedMappings[existingIndex] = newMapping;
setKeyMappings(updatedMappings);                      // ✅ 동일

// 삭제 (DELETE)
setKeyMappings(keyMappings.filter(m => m.id !== mappingId)); // ✅ 동일
```

### 4. 백엔드 전송 단계

#### **템플릿 저장 (handleSaveTemplate)**
```javascript
// keyMappings → 백엔드 템플릿 형식 변환
const convertedMappings = keyMappings.map(mapping => ({
  id: mapping.id,
  key: mapping.key,
  key_label: mapping.keyLabel,
  anchor_cell: {
    ...mapping.anchorCell,
    table: mapping.anchorCell?.table  // 🔑 table 데이터 포함
  },
  value_cell: mapping.valueCell,
  relative_position: mapping.relativePosition,
  table_id: mapping.tableId,
  created_at: mapping.createdAt
}));

// POST/PUT → http://localhost:9001/api/v1/templates/
```

#### **빠른 테스트 (handleQuickTest)**
```javascript
// keyMappings → 백엔드 추출 형식 변환
const backendMappings = keyMappings.map(mapping => ({
  key: mapping.key,
  key_label: mapping.keyLabel,
  anchor_cell: {
    row: mapping.anchorCell.row,
    col: mapping.anchorCell.col,
    value: mapping.anchorCell.value
  },
  value_cell: {
    row: mapping.valueCell.row,
    col: mapping.valueCell.col,
    value: mapping.valueCell.value
  },
  relative_position: mapping.relativePosition
}));

// POST → http://localhost:9001/api/v1/extraction/extract
```

## 🚨 발견된 주요 문제점

### 1. **AI 매핑의 구조적 불일치**
- ID 생성: `Date.now()` vs `${Date.now()}-${랜덤}`
- anchorCell.table 필드 누락
- 복잡한 변환 로직으로 인한 데이터 손실

### 2. **메모리 관리 불일치**
```javascript
// 수동: 기존 매핑 보존
setKeyMappings([...keyMappings, newMapping])

// AI: 기존 매핑 덮어씀 (❌)
setKeyMappings(aiMappings)
```

### 3. **백엔드 변환 로직 중복**
- 템플릿 저장용 변환
- 빠른 테스트용 변환
- 서로 다른 필드 구조

### 4. **상태 관리 분리**
- 수동: React 상태 직접 활용
- AI: 별도 변환 후 상태 설정

## 🎯 리팩터링 계획

### Phase 1: 표준 매핑 구조 정의
```javascript
// 표준 매핑 구조 (수동 기준 + AI 필드)
const StandardMapping = {
  // 기본 필드 (수동/AI 공통)
  id: Date.now(),                    // 단순한 ID
  key: string,                       // 키 식별자
  keyLabel: string,                  // 한국어 라벨
  anchorCell: {
    row: number,
    col: number,
    value: string,
    text: string,
    page_number: number,
    page: number,
    table: Array[]                   // 🔑 필수: 테이블 데이터
  },
  valueCell: {
    row: number,
    col: number,
    value: string,
    text: string,
    page_number: number,
    page: number
  },
  relativePosition: { row: number, col: number },
  tableId: string,
  createdAt: string,
  
  // AI 전용 필드 (선택적)
  confidence: number | null,         // AI 신뢰도
  isAIExtracted: boolean,           // AI 추출 여부
  aiReasoning: string | null        // AI 추론
};
```

### Phase 2: 공통 매핑 생성 함수
```javascript
const createStandardMapping = (aiData = null) => {
  return {
    id: Date.now(),
    key: selectedKey,
    keyLabel: getKeyLabel(selectedKey, 'ko'),
    anchorCell: {
      ...anchorCell,
      table: analysisResults?.tables?.find(table => table.page_number === activePageTab)?.data
    },
    valueCell,
    relativePosition,
    tableId: currentTableId,
    createdAt: new Date().toISOString(),
    // AI 필드
    confidence: aiData?.confidence || null,
    isAIExtracted: !!aiData,
    aiReasoning: aiData?.reasoning || null
  };
};
```

### Phase 3: AI 플로우 수정
```javascript
// 기존 AI 변환 로직 제거
// AI 데이터 → React 상태 설정 → handleSaveMapping 호출
result.results.forEach(aiResult => {
  // 1. 상태 설정 (수동과 동일한 방식)
  setSelectedKey(aiResult.key);
  setAnchorCell({
    row: aiResult.anchor_cell.row,
    col: aiResult.anchor_cell.col,
    value: aiResult.anchor_cell.value,
    text: aiResult.anchor_cell.value,
    page_number: aiResult.anchor_cell.page_number
  });
  setValueCell({...});
  setRelativePosition(aiResult.relative_position);
  
  // 2. 표준 매핑 생성 (수동과 동일한 함수)
  const mapping = createStandardMapping({
    confidence: aiResult.confidence,
    reasoning: aiResult.reasoning
  });
  
  // 3. 기존 매핑에 추가 (덮어쓰지 않음)
  setKeyMappings(prev => [...prev, mapping]);
});
```

### Phase 4: 백엔드 변환 로직 통합
```javascript
// 공통 백엔드 변환 함수
const convertMappingsForBackend = (mappings, purpose = 'template') => {
  if (purpose === 'template') {
    return mappings.map(mapping => ({
      id: mapping.id,
      key: mapping.key,
      key_label: mapping.keyLabel,
      anchor_cell: {
        ...mapping.anchorCell,
        table: mapping.anchorCell?.table
      },
      value_cell: mapping.valueCell,
      relative_position: mapping.relativePosition,
      table_id: mapping.tableId,
      created_at: mapping.createdAt
    }));
  } else if (purpose === 'extraction') {
    return mappings.map(mapping => ({
      key: mapping.key,
      key_label: mapping.keyLabel,
      anchor_cell: {
        row: mapping.anchorCell.row,
        col: mapping.anchorCell.col,
        value: mapping.anchorCell.value
      },
      value_cell: {
        row: mapping.valueCell.row,
        col: mapping.valueCell.col,
        value: mapping.valueCell.value
      },
      relative_position: mapping.relativePosition
    }));
  }
};
```

## 📝 수정해야 할 파일 목록

### 1. **ExtractionSettingsPage.js** (메인 수정)
- `handleSaveMapping()`: AI 필드 추가
- `createStandardMapping()`: 공통 함수 추가
- AI 추출 로직 전면 수정 (639-790라인)
- `convertMappingsForBackend()`: 공통 변환 함수 추가
- 디버깅 로그 정리

### 2. **useTemplateManagement.js** (보조 수정)
- `handleSaveTemplate()`: 공통 변환 함수 사용
- `normalizeMappings()`: 표준 구조와 호환성 확인

### 3. **새로 생성할 파일**
```
frontend/src/shared/constants/mappingStructure.js
- 표준 매핑 구조 정의
- 백엔드 변환 함수
- 타입 정의 (JSDoc)
```

## 🚀 작업 단계별 TODO

### Step 1: 표준 구조 정의
- [ ] `mappingStructure.js` 파일 생성
- [ ] 표준 매핑 구조 정의
- [ ] 백엔드 변환 함수 정의

### Step 2: 수동 매핑 수정
- [ ] `handleSaveMapping()`에 AI 필드 추가
- [ ] `createStandardMapping()` 함수 작성
- [ ] 수동 매핑 테스트 (기존 동작 유지 확인)

### Step 3: AI 매핑 수정
- [ ] AI 전용 변환 로직 제거
- [ ] AI 데이터 → 상태 설정 로직 추가
- [ ] AI 매핑도 `handleSaveMapping()` 사용
- [ ] 기존 매핑 덮어쓰기 → 추가 방식 변경

### Step 4: 백엔드 연동 수정
- [ ] `handleQuickTest()`에서 공통 변환 함수 사용
- [ ] `handleSaveTemplate()`에서 공통 변환 함수 사용
- [ ] 중복 변환 로직 제거

### Step 5: 테스트 및 정리
- [ ] 수동 매핑 플로우 테스트
- [ ] AI 매핑 플로우 테스트
- [ ] 템플릿 저장/불러오기 테스트
- [ ] 빠른 테스트 기능 테스트
- [ ] 디버깅 로그 정리

## 🎯 예상 결과

### 통합 후 동일한 플로우
```
1. 데이터 수집 (수동/AI 구분 없음)
2. React 상태 설정 (동일한 방식)
3. createStandardMapping() 호출 (동일한 함수)
4. keyMappings 배열 관리 (동일한 CRUD)
5. 백엔드 전송 (동일한 변환 함수)
```

### 일관성 확보
- ✅ 하나의 표준 구조
- ✅ 하나의 저장 로직
- ✅ 하나의 관리 방식
- ✅ 하나의 백엔드 변환 로직

이렇게 하면 수동/AI 구분 없이 완전히 일관적인 메모리 관리 시스템이 완성됩니다.
