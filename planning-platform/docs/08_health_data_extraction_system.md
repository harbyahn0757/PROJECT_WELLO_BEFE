# 건강검진 데이터 추출 시스템 명세서

## 🎯 시스템 목적

건강검진표 PDF에서 특정 검사 항목의 수치를 자동으로 추출하기 위한 **앵커 기반 관계 설정 시스템** 구축

## 🔍 핵심 개념

### 1. 앵커(Anchor) 개념
- **앵커**: 찾고자 하는 데이터의 **기준점** (예: "신장", "체중", "혈압" 등)
- **값(Value)**: 실제 추출하려는 **데이터** (예: "181", "75", "120/80" 등)
- **관계(Relationship)**: 앵커에서 값까지의 **상대적 위치** (예: "우측 1칸", "아래 2칸")

### 2. 작동 방식
```
1단계: 앵커 설정
   사용자가 "신장" 텍스트가 있는 셀 클릭 → 앵커로 설정

2단계: 값 설정  
   사용자가 "181" 값이 있는 셀 클릭 → 값으로 설정

3단계: 관계 계산
   시스템이 자동으로 위치 관계 계산 (신장 → 우측 1칸)

4단계: 저장
   "신장" 키에 대한 추출 규칙을 JSON으로 저장

5단계: 자동 추출
   새 문서에서 "신장" 텍스트 찾음 → 우측 1칸 값 자동 추출
```

## 📊 사용자 인터페이스 설계

### 전체 화면 구성
```
┌─────────────────────────────────────────────────────────────┐
│                    파일 업로드 & 처리                        │
│  [파일선택] [라이브러리: pdfplumber ▼] [📊 분석시작]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 테이블 그리드 (60%)          ⚙️ 관계 설정 (40%)         │
│                                                             │
│ ┌─[페이지1]─[페이지2]─────┐      ┌─키 관리──────────────┐    │
│ │                       │      │ 추출할 키: 신장       │    │
│ │ │  │항목│측정값│단위  │ │      │ ┌─────────────────┐  │    │
│ │ ├──┼───┼────┼───┤ │      │ │ 새 키 입력      │  │    │
│ │ │1 │🔵신장│181 │cm │ │      │ └─────────────────┘  │    │
│ │ ├──┼───┼────┼───┤ │      │ [➕ 키 추가]          │    │
│ │ │2 │체중│75  │kg │ │      ├─────────────────────┤    │
│ │ ├──┼───┼────┼───┤ │      │ 📋 등록된 키 목록     │    │
│ │ │3 │혈압│120 │mmHg│      │ ✅ 신장 (설정완료)    │    │
│ │ └──┴───┴────┴───┘ │      │ ⚠️ 체중 (설정중)      │    │
│ └───────────────────┘      └─────────────────────┘    │
│                                                             │
│                            ┌─현재 설정 상태─────────┐      │
│                            │ 선택된 키: 신장        │      │
│                            │ 앵커 셀: A1 ("신장")   │      │
│                            │ 값 셀: B1 ("181")     │      │
│                            │ 관계: 우측 1칸        │      │
│                            │ [💾 관계 저장]        │      │
│                            └───────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 색상 코딩 시스템
- 🔵 **파란색**: 앵커(기준점) 셀
- 🟠 **주황색**: 값(데이터) 셀  
- ⚪ **회색**: 일반 셀
- 🟢 **초록색**: 설정 완료된 관계

## 🔧 기술적 구현 방안

### 1. 데이터 구조

#### 그리드 데이터 구조
```javascript
const gridData = {
  pageNumber: 1,
  tableIndex: 0,
  rows: 4,
  cols: 3,
  cells: [
    [
      { row: 0, col: 0, value: "항목", type: "header" },
      { row: 0, col: 1, value: "측정값", type: "header" },
      { row: 0, col: 2, value: "단위", type: "header" }
    ],
    [
      { row: 1, col: 0, value: "신장", type: "text", isAnchor: true },
      { row: 1, col: 1, value: "181", type: "number", isValue: true },
      { row: 1, col: 2, value: "cm", type: "text" }
    ],
    // ... 더 많은 행들
  ]
};
```

#### 관계 설정 데이터 구조
```json
{
  "키명": "신장",
  "앵커": {
    "텍스트": "신장",
    "위치": { "row": 1, "col": 0 },
    "페이지": 1,
    "테이블": 0
  },
  "값": {
    "위치": { "row": 1, "col": 1 },
    "상대위치": { "row_offset": 0, "col_offset": 1 },
    "방향": "right"
  },
  "검증": {
    "데이터타입": "number",
    "범위": { "min": 100, "max": 250 },
    "단위": "cm"
  }
}
```

### 2. 핵심 컴포넌트 구조

#### TableGrid 컴포넌트
```javascript
const TableGrid = ({ data, onCellSelect, selectedCells }) => {
  const handleCellClick = (row, col, value) => {
    const cellInfo = {
      position: { row, col },
      value: value,
      type: detectDataType(value)
    };
    onCellSelect(cellInfo);
  };

  return (
    <div className="table-grid">
      {data.cells.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`grid-cell ${getCellClass(cell)}`}
              onClick={() => handleCellClick(rowIndex, colIndex, cell.value)}
            >
              {cell.value}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

#### RelationshipEditor 컴포넌트
```javascript
const RelationshipEditor = ({ selectedKey, anchorCell, valueCell, onSave }) => {
  const calculateRelationship = (anchor, value) => {
    const rowOffset = value.row - anchor.row;
    const colOffset = value.col - anchor.col;
    
    let direction = "exact";
    if (rowOffset === 0 && colOffset > 0) direction = "right";
    else if (rowOffset === 0 && colOffset < 0) direction = "left";
    else if (rowOffset > 0 && colOffset === 0) direction = "down";
    else if (rowOffset < 0 && colOffset === 0) direction = "up";
    
    return { rowOffset, colOffset, direction };
  };

  const relationship = anchorCell && valueCell 
    ? calculateRelationship(anchorCell, valueCell)
    : null;

  return (
    <div className="relationship-editor">
      <h3>🎯 관계 설정: {selectedKey}</h3>
      
      {anchorCell && (
        <div className="anchor-info">
          <span>앵커: {anchorCell.value} (행:{anchorCell.row}, 열:{anchorCell.col})</span>
        </div>
      )}
      
      {valueCell && (
        <div className="value-info">
          <span>값: {valueCell.value} (행:{valueCell.row}, 열:{valueCell.col})</span>
        </div>
      )}
      
      {relationship && (
        <div className="relationship-info">
          <span>관계: {relationship.direction} {Math.abs(relationship.colOffset || relationship.rowOffset)}칸</span>
          <button onClick={() => onSave(selectedKey, anchorCell, valueCell, relationship)}>
            💾 관계 저장
          </button>
        </div>
      )}
    </div>
  );
};
```

### 3. 백엔드 API 설계

#### 관계 설정 저장 API
```python
@router.post("/relationships/save")
async def save_relationship(config: RelationshipConfig):
    """
    관계 설정을 JSON 파일로 저장
    """
    relationship_data = {
        "key_name": config.key_name,
        "anchor": {
            "text": config.anchor_text,
            "search_pattern": config.anchor_pattern,
            "position_type": "text_match"  # 텍스트 매칭으로 찾기
        },
        "value": {
            "relative_position": {
                "row_offset": config.row_offset,
                "col_offset": config.col_offset,
                "direction": config.direction
            },
            "data_type": config.data_type,
            "validation": config.validation_rules
        },
        "created_at": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    # JSON 파일로 저장
    filename = f"{config.key_name}_mapping.json"
    filepath = os.path.join(settings.RELATIONSHIPS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(relationship_data, f, ensure_ascii=False, indent=2)
    
    return {"status": "success", "filename": filename}
```

#### 데이터 추출 API
```python
@router.post("/extract/apply-relationships")
async def extract_using_relationships(
    file_name: str, 
    relationship_files: List[str]
):
    """
    저장된 관계 설정을 사용하여 데이터 자동 추출
    """
    # PDF 처리
    pdf_data = pdf_service.extract_tables(file_name)
    
    # 각 관계 설정 파일 로드
    extraction_results = {}
    
    for rel_file in relationship_files:
        rel_config = load_relationship_config(rel_file)
        
        # 앵커 텍스트 찾기
        anchor_positions = find_anchor_text(pdf_data, rel_config["anchor"]["text"])
        
        # 각 앵커 위치에서 값 추출
        for anchor_pos in anchor_positions:
            value_pos = calculate_value_position(anchor_pos, rel_config["value"]["relative_position"])
            extracted_value = get_cell_value(pdf_data, value_pos)
            
            # 검증
            if validate_extracted_value(extracted_value, rel_config["value"]["validation"]):
                extraction_results[rel_config["key_name"]] = {
                    "value": extracted_value,
                    "position": value_pos,
                    "confidence": "high"
                }
    
    return {"extracted_data": extraction_results}
```

## 🎯 사용자 워크플로우

### 1단계: 관계 설정 (최초 1회)
```
1. PDF 업로드 → 표 추출
2. "신장" 키 추가
3. 그리드에서 "신장" 텍스트 셀 클릭 (앵커 설정)
4. 그리드에서 "181" 값 셀 클릭 (값 설정)  
5. 시스템이 자동으로 "우측 1칸" 관계 계산
6. 관계 저장 → "신장_mapping.json" 파일 생성
```

### 2단계: 자동 추출 (반복 사용)
```
1. 새로운 건강검진표 PDF 업로드
2. 기존 관계 설정 파일들 선택
3. "자동 추출" 버튼 클릭
4. 결과: {"신장": "175", "체중": "68", "혈압": "110/70"}
```

## 🧪 테스트 시나리오

### 테스트용 건강검진표 패턴들

#### 패턴 1: 가로형 테이블
```
│ 신장 │ 181 │ cm │
│ 체중 │ 75  │ kg │
```

#### 패턴 2: 세로형 테이블  
```
│ 신장 │
│ 181  │
│ cm   │
```

#### 패턴 3: 복합형 테이블
```
│ 기본정보 │ 신장 │ 181cm │ 체중 │ 75kg │
```

각 패턴에 대해 관계 설정이 올바르게 작동하는지 검증해야 합니다.

## 🚀 개발 우선순위

1. **기본 그리드 표시** (1주차)
2. **셀 선택 및 앵커/값 설정** (2주차)  
3. **관계 계산 및 저장** (3주차)
4. **자동 추출 엔진** (4주차)
5. **검증 및 최적화** (5주차)

이 시스템을 통해 건강검진표에서 필요한 모든 수치를 자동으로 추출할 수 있게 됩니다!
