# ChatInterface 남은 작업 정리

## 현재 상태 분석

### 완료된 작업
- ✅ 처음 메시지 딜레이 추가 (500ms)
- ✅ 띵킹 텍스트 스타일 수정 (갈색, 작은 폰트, 기울이기 제거, 천천히 표시)
- ✅ 슬라이더 표시 문제 해결
- ✅ 실제 데이터 기반 중얼중얼 텍스트 구현
- ✅ 스피너 애니메이션 개선 (페이드인/아웃)
- ✅ 하단 진행 상태 표시 (1/2 단계, 2/2 단계)

### 남은 작업 목록

#### 1. 닷 네비게이터 숨김 처리
**현재 상태**: 닷 네비게이터가 표시되고 있음 (648-668 라인)
**작업 내용**:
- `chat-interface__dots` div를 숨김 처리
- 슬라이딩 기능은 유지 (스와이프/드래그로 슬라이드 가능)

**파일**: `ChatInterface/index.tsx`, `ChatInterface/styles.scss`

---

#### 2. 카드에 체크박스 구현 (다중 선택)
**현재 상태**: 카드 클릭으로만 선택 가능 (토글 방식)
**작업 내용**:
- MedicationCard와 CheckupCard에 체크박스 추가
- 체크박스 클릭 시 선택/해제
- 카드 클릭도 선택/해제 가능 (현재와 동일)
- 다중 선택 가능 (현재도 가능하지만 UI 개선)

**파일**: 
- `ChatInterface/MedicationCard.tsx`
- `ChatInterface/CheckupCard.tsx`
- `ChatInterface/styles.scss`

---

#### 3. 사용자 선택 후 카드 표시 딜레이
**현재 상태**: 사용자가 카드를 선택하면 즉시 사용자 메시지 버블이 표시됨
**작업 내용**:
- 사용자 선택 후 2초 딜레이 추가
- 딜레이 후 사용자 선택 카드가 버블로 표시
- 고객 선택 카드도 동일한 딜레이 적용

**파일**: `ChatInterface/index.tsx` (handleOptionClick 함수)

---

#### 4. 슬라이더 하단에 다음/건너뛰기 버튼 레이아웃
**현재 상태**: 건너뛰기는 옵션 카드로만 존재 (ChatOptionButton)
**작업 내용**:
- 슬라이더 하단에 고정 버튼 영역 추가
- 레이아웃: `[카드1] [카드2] ... [다음] | [건너뛰기]`
- 다음 버튼: 선택된 카드 개수 표시 (예: "다음 (2개)")
- 건너뛰기 버튼: 현재 단계 건너뛰기

**파일**: 
- `ChatInterface/index.tsx`
- `ChatInterface/styles.scss`

---

#### 5. 다음 버튼 클릭 시 처리
**현재 상태**: 자동으로 다음 단계로 이동하거나 handleComplete 호출
**작업 내용**:
- 다음 버튼 클릭 시 선택 완료 처리
- 선택된 항목이 있으면 다음 단계로 이동
- 선택된 항목이 없으면 경고 메시지 표시
- 2단계 완료 시 handleComplete 호출하여 다음 페이지로 이동

**파일**: `ChatInterface/index.tsx`

---

#### 6. 건너뛰기 버튼 클릭 시 처리
**현재 상태**: 옵션으로만 존재, 클릭 시 moveToNextStep 호출
**작업 내용**:
- 건너뛰기 버튼 클릭 시 현재 단계 건너뛰기
- 사용자 확인 메시지 표시 (선택사항)
- 다음 단계로 이동
- 2단계에서 건너뛰기 시 handleComplete 호출

**파일**: `ChatInterface/index.tsx`

---

#### 7. 완료 후 플로팅 버튼 및 다음 페이지 이동
**현재 상태**: handleComplete에서 onNext 호출하여 CheckupDesignPage의 handleNext 실행
**작업 내용**:
- handleComplete에서 onNext 호출 확인
- CheckupDesignPage의 handleNext가 정상 작동하는지 확인
- 다음 페이지(문진)로 이동 로직 확인
- 플로팅 버튼 표시 로직 확인 (App.tsx에서 처리)

**파일**: 
- `ChatInterface/index.tsx`
- `CheckupDesignPage.tsx`
- `App.tsx` (플로팅 버튼 로직)

---

## 작업 우선순위

### Phase 1: UI 개선 (즉시 진행 가능)
1. 닷 네비게이터 숨김 처리
2. 카드에 체크박스 구현

### Phase 2: 사용자 경험 개선
3. 사용자 선택 후 카드 표시 딜레이
4. 슬라이더 하단에 다음/건너뛰기 버튼 레이아웃

### Phase 3: 플로우 완성
5. 다음 버튼 클릭 시 처리
6. 건너뛰기 버튼 클릭 시 처리
7. 완료 후 플로팅 버튼 및 다음 페이지 이동 확인

---

## 작업 시작 준비

각 Phase별로 작업을 진행하고, 각 Phase 완료 후 테스트를 요청하겠습니다.

