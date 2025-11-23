# 브라우저 개발자 도구 확인 가이드

## 토글-카드 간격 확인 방법

### 1. 개발자 도구 열기
- `F12` 또는 `Ctrl+Shift+I` (Windows/Linux)
- `Cmd+Option+I` (Mac)
- 또는 우클릭 → 검사

### 2. 확인할 요소들

#### A. ContentLayoutWithHeader의 __content 요소
```
1. Elements 탭에서 검색: "content-layout-with-header__content"
2. Computed 탭에서 확인:
   - padding-top: 180px (토글 하단 위치)
   - margin-top: 0
```

#### B. health-metrics-wrapper 요소
```
1. Elements 탭에서 검색: "health-metrics-wrapper"
2. Computed 탭에서 확인:
   - padding-top: 0
   - margin-top: 0
   - 실제 적용된 값 확인
```

#### C. health-metrics-slider 요소
```
1. Elements 탭에서 검색: "health-metrics-slider"
2. Computed 탭에서 확인:
   - padding-top: 0
   - margin-top: 0
```

#### D. trends-section 요소
```
1. Elements 탭에서 검색: "trends-section"
2. Computed 탭에서 확인:
   - padding-top: 0
   - margin-top: 0
```

### 3. 실제 간격 측정
```
1. Elements 탭에서 토글 요소 선택
2. 토글의 하단 위치 확인 (예: top: 120px, height: 60px → 하단: 180px)
3. 카드 영역의 상단 위치 확인
4. 두 값의 차이가 0px인지 확인
```

### 4. 스타일 오버라이드 확인
```
1. Elements 탭에서 요소 선택
2. Styles 탭에서:
   - 취소선이 그어진 스타일 확인 (다른 스타일이 오버라이드)
   - !important가 적용된 스타일 확인
   - 실제 적용된 스타일 확인
```

### 5. 문제 발견 시
- 실제 적용된 padding-top, margin-top 값 확인
- 어떤 스타일이 오버라이드하고 있는지 확인
- 스크린샷 또는 값 캡처




