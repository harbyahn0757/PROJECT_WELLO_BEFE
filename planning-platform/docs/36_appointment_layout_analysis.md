# 예약 페이지 레이아웃 구조 점검 보고서

## 📋 점검 일시
**작성일**: 2025-01-27  
**목적**: 건강추이 페이지 헤더만 재사용, 하단은 새 레이아웃으로 구성 (중복 방지)

---

## 🔍 현재 구조 분석

### 1. 건강추이 페이지 구조

#### HealthTrendsHeader (헤더)
- **위치**: `components/health/HealthTrendsHeader/`
- **구조**:
  - 뒤로가기 버튼 (좌측)
  - 제목 (중앙)
  - 새로고침 아이콘 (우측 상단, 선택적)
- **스타일**: `position: fixed`, `top: 0`, `height: 90px`, `z-index: 100`
- **재사용 가능**: ✅ (제목만 변경)

#### ContentLayoutWithHeader (전체 레이아웃)
- **위치**: `layouts/ContentLayoutWithHeader/`
- **구조**:
  - HealthTrendsHeader (고정)
  - HealthTrendsToggle (고정, 토글 버튼)
  - 바디 영역 (스크롤 가능)
- **특징**: 건강추이 전용 (토글 포함)
- **재사용 불가**: ❌ (토글과 바디 구조가 건강추이 전용)

#### 플로팅 버튼 (전역)
- **위치**: `App.tsx`의 `FloatingButton` 컴포넌트
- **특징**: 전역 플로팅 버튼 (모든 페이지에서 사용)
- **스타일**: `position: fixed`, `bottom: 0`, `z-index: 1000`
- **재사용 불가**: ❌ (예약 페이지에서는 숨김 처리 필요)

---

## ✅ 재사용 가능한 부분

### 1. HealthTrendsHeader (헤더만)
- **재사용**: ✅
- **수정 사항**:
  - 제목: "건강 추이" → "예약 날짜 선택"
  - 새로고침 아이콘: 제거 (예약 페이지에서는 불필요)
  - lastUpdateTime: 제거 (예약 페이지에서는 불필요)

### 2. BackButton (뒤로가기 버튼)
- **재사용**: ✅
- **위치**: `components/shared/BackButton/`
- **변경 없음**: 그대로 사용

---

## ❌ 재사용 불가능한 부분 (중복 방지)

### 1. ContentLayoutWithHeader
- **재사용 불가**: ❌
- **이유**:
  - HealthTrendsToggle 포함 (건강추이 전용)
  - 바디 구조가 건강추이 전용 (토글 아래 시작)
  - 예약 페이지는 다른 구조 필요

### 2. 플로팅 버튼 (전역)
- **재사용 불가**: ❌
- **이유**:
  - 전역 플로팅 버튼 (모든 페이지에서 사용)
  - 예약 페이지에서는 숨김 처리 필요
  - 예약 페이지 전용 하단 버튼 필요

---

## 🎯 새로운 레이아웃 설계

### AppointmentLayout (새로 생성)

```
┌─────────────────────────────────┐
│  HealthTrendsHeader (재사용)    │ ← 고정 (fixed, top: 0)
│  [←] 예약 날짜 선택              │
├─────────────────────────────────┤
│                                 │
│  컨텐츠 영역 (스크롤 가능)       │ ← 스크롤 (헤더 아래부터)
│  - 안내 텍스트                   │
│  - 캘린더                        │
│  - 범례                          │
│  - 안내 문구                     │
│                                 │
├─────────────────────────────────┤
│  예약 신청 완료 버튼 (새로 생성) │ ← 고정 (fixed, bottom: 0)
│  (#55433B 배경, 흰색 텍스트)     │
└─────────────────────────────────┘
```

### 구조 차이점

| 항목 | 건강추이 페이지 | 예약 페이지 |
|------|---------------|-----------|
| 헤더 | HealthTrendsHeader | HealthTrendsHeader (재사용) |
| 토글 | HealthTrendsToggle | 없음 |
| 레이아웃 | ContentLayoutWithHeader | AppointmentLayout (새로 생성) |
| 하단 버튼 | 없음 (전역 플로팅 버튼 사용) | 예약 신청 완료 버튼 (새로 생성) |
| 바디 시작 위치 | 토글 아래 (184px) | 헤더 아래 (90px) |

---

## 📁 파일 구조

### 새로 생성할 파일

```
frontend/src/
├── layouts/
│   └── AppointmentLayout/          # 새로 생성
│       ├── index.tsx                # 레이아웃 컴포넌트
│       └── styles.scss             # 레이아웃 스타일
├── pages/
│   └── AppointmentPage/            # 새로 생성
│       ├── index.tsx                # 예약 페이지 컴포넌트
│       └── styles.scss              # 페이지 스타일
└── components/
    └── appointment/                 # 새로 생성
        ├── DateSelector/            # 날짜 선택 컴포넌트
        ├── AppointmentButton/       # 하단 버튼 컴포넌트 (새로 생성)
        └── ...
```

### 재사용할 파일

```
frontend/src/
└── components/
    ├── health/
    │   └── HealthTrendsHeader/      # 재사용 (제목만 변경)
    └── shared/
        └── BackButton/              # 재사용 (변경 없음)
```

---

## 🚨 중복 방지 체크리스트

### ✅ 재사용 (헤더만)
- [x] HealthTrendsHeader 재사용 (제목만 변경)
- [x] BackButton 재사용 (변경 없음)

### ❌ 재사용 불가 (새로 생성)
- [x] AppointmentLayout (새로 생성)
- [x] AppointmentButton (하단 버튼, 새로 생성)
- [x] DateSelector (캘린더, 새로 생성)

### ⚠️ 주의사항
- [x] ContentLayoutWithHeader 사용 안함 (건강추이 전용)
- [x] 전역 플로팅 버튼 숨김 처리 (예약 페이지에서)
- [x] 하단 버튼은 예약 페이지 전용으로 생성

---

## 📐 레이아웃 상세 스펙

### AppointmentLayout 구조

```typescript
<AppointmentLayout>
  {/* 헤더 (재사용) */}
  <HealthTrendsHeader 
    title="예약 날짜 선택"
    onBack={handleBack}
    // lastUpdateTime, onRefresh 제거
  />
  
  {/* 컨텐츠 영역 (스크롤 가능) */}
  <div className="appointment-layout__body">
    {/* 안내 텍스트 */}
    <div className="appointment-layout__instruction">
      예약을 희망하는 날짜와 시간을 선택해주세요.
    </div>
    
    {/* 캘린더 */}
    <DateSelector />
    
    {/* 범례 */}
    <Legend />
    
    {/* 안내 문구 */}
    <Notice />
  </div>
  
  {/* 하단 버튼 (새로 생성) */}
  <AppointmentButton 
    text="예약 신청 완료"
    onClick={handleSubmit}
    disabled={!hasSelectedDate}
  />
</AppointmentLayout>
```

### 스타일 구조

```scss
.appointment-layout {
  width: 100%;
  position: relative;
  background: #FFFCF6; // 배경색
  
  // 헤더는 fixed (재사용)
  // 헤더: position: fixed, top: 0, height: 90px, z-index: 100
  
  // 바디 영역 - 헤더 아래부터 시작하는 스크롤 영역
  &__body {
    position: fixed;
    top: 90px; // 헤더 높이
    left: 0;
    right: 0;
    bottom: 60px; // 하단 버튼 높이
    overflow-y: auto;
    overflow-x: hidden;
    padding: $spacing-lg;
    background: #FFFCF6;
  }
  
  // 하단 버튼은 fixed (새로 생성)
  // 버튼: position: fixed, bottom: 0, height: 60px, z-index: 1000
}
```

---

## 🔧 구현 계획

### Phase 1: 레이아웃 구조 생성
1. `AppointmentLayout` 컴포넌트 생성
2. `HealthTrendsHeader` 재사용 (제목 변경, 새로고침 제거)
3. 바디 영역 구조 생성 (헤더 아래부터 시작)
4. 하단 버튼 영역 구조 생성

### Phase 2: 하단 버튼 컴포넌트
1. `AppointmentButton` 컴포넌트 생성
2. 하단 고정 스타일 적용
3. 활성화/비활성화 상태 관리

### Phase 3: 예약 페이지 통합
1. `AppointmentPage` 컴포넌트 생성
2. `AppointmentLayout` 적용
3. 라우팅 추가
4. 전역 플로팅 버튼 숨김 처리

---

## ✅ 최종 확인

### 중복 방지 확인
- ✅ ContentLayoutWithHeader 사용 안함
- ✅ HealthTrendsToggle 사용 안함
- ✅ 전역 플로팅 버튼 숨김 처리
- ✅ 하단 버튼 새로 생성 (중복 없음)
- ✅ 헤더만 재사용 (제목 변경)

### 구조 차이점 명확화
- ✅ 건강추이: 헤더 + 토글 + 바디 (ContentLayoutWithHeader)
- ✅ 예약 페이지: 헤더 + 바디 + 하단 버튼 (AppointmentLayout)

---

**점검 완료**: 중복 없이 헤더만 재사용, 하단은 새 레이아웃으로 구성 ✅

