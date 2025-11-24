# 예약 페이지 개발 종합 점검 보고서

## 📋 점검 일시
**작성일**: 2025-01-27  
**점검 범위**: 예약 페이지 개발 전 기존 코드베이스 분석

---

## 🔍 1. 기존 코드베이스 점검 결과

### ✅ 발견된 예약 관련 코드

#### 1.1 프론트엔드
- **플로팅 버튼** (`App.tsx:209`)
  - 텍스트: "검진 예약 하기"
  - 현재 동작: 카카오 로그인 함수 호출 (`window.handleKakaoLoginFromFloating`)
  - **문제점**: 예약 페이지로 이동하지 않음

- **문서상 계획** (`docs/01_project_overview.md`)
  - `BookingPage/` 폴더 계획됨 (실제 구현 없음)
  - `booking/` 컴포넌트 폴더 계획됨 (실제 구현 없음)

#### 1.2 백엔드
- **API 엔드포인트**: 예약 관련 엔드포인트 없음
- **데이터베이스**: 예약 테이블 없음
- **서비스**: 예약 서비스 없음

#### 1.3 날짜 선택 관련 기존 코드
- **FilterSection 컴포넌트** (`components/health/FilterSection/index.tsx`)
  - `type="date"` 입력 필드 사용 (처방전 필터용)
  - 시작일/종료일 선택 기능
  - **재사용 가능**: 기본 날짜 입력 로직 참고 가능

- **AdvancedSearch 컴포넌트** (`components/search/AdvancedSearch/index.tsx`)
  - 날짜 범위 필터 기능
  - `type="date"` 입력 필드 사용
  - **재사용 가능**: 날짜 필터링 로직 참고 가능

### ❌ 없는 기능들

1. **예약 페이지**: 완전히 없음
2. **예약 캘린더 UI**: 날짜 입력 필드만 있고 캘린더 UI 없음
3. **시간대 선택**: 시간대 선택 기능 없음
4. **예약 API**: 백엔드 예약 엔드포인트 없음
5. **예약 데이터베이스**: 예약 테이블 없음

---

## 🎯 2. 겹치는 부분 분석

### 2.1 날짜 입력 필드
**기존 코드 위치**:
- `FilterSection/index.tsx` (라인 110-119, 124-133)
- `AdvancedSearch/index.tsx` (라인 221-226)

**재사용 방안**:
- ✅ 기본 HTML `type="date"` 입력 필드는 재사용 가능
- ❌ 캘린더 UI는 새로 구현 필요 (기존에는 단순 입력 필드만 있음)

### 2.2 헤더 컴포넌트
**기존 코드 위치**:
- `HealthTrendsHeader/index.tsx`
- `ContentLayoutWithHeader/index.tsx`

**재사용 방안**:
- ✅ `HealthTrendsHeader` 재사용 가능 (제목만 변경)
- ✅ `ContentLayoutWithHeader` 레이아웃 재사용 가능

### 2.3 플로팅 버튼
**기존 코드 위치**:
- `App.tsx:209` - "검진 예약 하기" 버튼

**수정 필요**:
- ❌ 현재는 카카오 로그인 함수 호출
- ✅ 예약 페이지로 이동하도록 수정 필요

---

## 📁 3. 파일 구조 점검

### 3.1 현재 페이지 구조
```
frontend/src/pages/
├── MainPage.tsx              ✅ 존재
├── AuthPage.tsx              ✅ 존재
├── HealthDashboard/          ✅ 존재
├── HealthTrends/              ✅ 존재
├── PrescriptionHistory/      ✅ 존재
├── HealthComparison/          ✅ 존재
└── AppointmentPage/          ❌ 없음 (새로 생성 필요)
```

### 3.2 현재 컴포넌트 구조
```
frontend/src/components/
├── health/                    ✅ 존재
│   ├── HealthTrendsHeader/   ✅ 재사용 가능
│   └── FilterSection/         ✅ 날짜 입력 참고 가능
├── search/                    ✅ 존재
│   └── AdvancedSearch/        ✅ 날짜 필터 참고 가능
└── appointment/              ❌ 없음 (새로 생성 필요)
    ├── DateSelector/          ❌ 새로 생성
    ├── TimeSlotSelector/      ❌ 새로 생성
    └── AppointmentForm/      ❌ 새로 생성
```

### 3.3 백엔드 API 구조
```
backend/app/api/v1/endpoints/
├── tilko_auth.py              ✅ 존재
├── patients.py                ✅ 존재
├── health.py                  ✅ 존재
└── booking.py                 ❌ 없음 (새로 생성 필요)
```

### 3.4 데이터베이스 스키마
```
현재 테이블:
├── wello_patients              ✅ 존재
├── wello_checkup_data          ✅ 존재
├── wello_prescription_data     ✅ 존재
└── wello_appointments           ❌ 없음 (새로 생성 필요)
```

---

## 📄 4. PDF/SVG 파일 가이드

### 4.1 현재 파일 현황
```
frontend/src/assets/images/
├── 예약날짜.pdf                ✅ 존재 (분석 필요)
├── icons8-chatgpt-50.png       ✅ 존재
├── kakao.png                   ✅ 존재
├── naver.png                   ✅ 존재
├── pass.png                    ✅ 존재
├── pill-icon.png               ✅ 존재
└── main/                       ✅ 존재
    ├── chart.png
    ├── check_1 1.png
    ├── check_2 1.png
    ├── hwkim_logo.png
    └── sample_wello_hos_logo.png

backend/static/
└── wello-icon-line.svg         ✅ 존재 (1개만)
```

### 4.2 필요한 파일 가이드

#### PDF 파일 분석 필요
**현재 파일**: `예약날짜.pdf`
- ✅ **이미 제공됨**: 예약 날짜 선택 UI/UX 가이드로 추정
- 📋 **분석 필요 사항**:
  1. 날짜 선택 UI 디자인 (캘린더 형태인지, 리스트 형태인지)
  2. 선택 가능한 날짜 범위
  3. 선택 불가 날짜 표시 방법
  4. 날짜 선택 후 다음 단계 (시간 선택 등)

#### SVG 파일 필요 여부
**현재 상황**: SVG 파일 1개만 존재 (`wello-icon-line.svg`)

**예약 페이지에 필요한 SVG 아이콘**:
1. ✅ **필수 아님**: 기본 HTML/CSS로 구현 가능
2. 📋 **선택적 필요**:
   - 캘린더 아이콘 (날짜 선택 섹션)
   - 시계 아이콘 (시간 선택 섹션)
   - 체크 아이콘 (예약 완료)
   - 화살표 아이콘 (이전/다음 달)

**권장 사항**:
- 우선 CSS/HTML로 구현
- 필요시 기존 `main/check_1 1.png`, `main/check_2 1.png` 재사용
- SVG는 나중에 추가 가능

---

## 🚨 5. 중복 방지 체크리스트

### 5.1 컴포넌트 재사용
- ✅ `HealthTrendsHeader` → 예약 페이지 헤더로 재사용
- ✅ `ContentLayoutWithHeader` → 예약 페이지 레이아웃으로 재사용
- ⚠️ 날짜 입력 필드 → 기본 HTML `type="date"` 사용 (기존과 동일)
- ❌ 캘린더 UI → 새로 구현 (기존에 없음)

### 5.2 스타일 재사용
- ✅ 디자인 토큰 (`_variables.scss`) 재사용
- ✅ 색상 시스템 (`design-tokens.css`) 재사용
- ✅ 간격 시스템 (`$spacing-*`) 재사용
- ✅ 폰트 시스템 (`Pretendard`) 재사용

### 5.3 API 재사용
- ✅ 환자 정보 API (`/api/v1/patients/{uuid}`) 재사용
- ❌ 예약 API → 새로 생성 필요

---

## 📋 6. 개발 우선순위

### Phase 1: 기본 구조 (중복 없음)
1. ✅ 예약 페이지 컴포넌트 생성 (`AppointmentPage`)
2. ✅ 라우팅 추가 (`/appointment`)
3. ✅ 플로팅 버튼 수정 (예약 페이지로 이동)
4. ✅ 헤더 재사용 (`HealthTrendsHeader`)

### Phase 2: 날짜 선택 (부분 재사용)
1. ✅ 날짜 선택 컴포넌트 생성 (`DateSelector`)
2. ⚠️ 기존 `type="date"` 입력 필드 참고
3. ❌ 캘린더 UI 새로 구현 (기존에 없음)
4. 📋 PDF 파일 분석하여 디자인 반영

### Phase 3: 시간 선택 (완전 신규)
1. ❌ 시간대 선택 컴포넌트 생성 (`TimeSlotSelector`)
2. ❌ 예약 가능 시간대 API 필요

### Phase 4: 예약 폼 (부분 재사용)
1. ✅ 환자 정보 자동 입력 (기존 환자 API 활용)
2. ❌ 예약 폼 컴포넌트 생성 (`AppointmentForm`)

### Phase 5: 백엔드 (완전 신규)
1. ❌ 예약 API 엔드포인트 생성 (`booking.py`)
2. ❌ 예약 데이터베이스 테이블 생성
3. ❌ 예약 서비스 로직 구현

---

## ✅ 7. 최종 점검 결과

### 겹치는 부분
1. **헤더 컴포넌트**: 재사용 가능 ✅
2. **레이아웃**: 재사용 가능 ✅
3. **날짜 입력 필드**: 기본 HTML 사용 (재사용 가능) ✅
4. **디자인 시스템**: 완전 재사용 가능 ✅

### 없는 부분 (신규 개발 필요)
1. **예약 페이지**: 완전 신규 ❌
2. **캘린더 UI**: 완전 신규 ❌
3. **시간대 선택**: 완전 신규 ❌
4. **예약 API**: 완전 신규 ❌
5. **예약 데이터베이스**: 완전 신규 ❌

### PDF/SVG 파일 가이드
- ✅ **PDF 파일**: `예약날짜.pdf` 이미 제공됨 (분석 필요)
- ⚠️ **SVG 파일**: 필수 아님, 필요시 나중에 추가 가능
- 📋 **권장**: PDF 내용 분석 후 캘린더 UI 디자인 결정

---

## 🎯 8. 다음 단계

1. **PDF 파일 분석**: `예약날짜.pdf` 내용 확인
2. **기본 구조 생성**: 예약 페이지 및 라우팅
3. **캘린더 UI 구현**: PDF 기반 디자인 반영
4. **백엔드 설계**: 예약 API 및 데이터베이스 스키마

---

**점검 완료**: 기존 코드와의 중복 최소화, 재사용 가능한 부분 명확히 식별됨 ✅





