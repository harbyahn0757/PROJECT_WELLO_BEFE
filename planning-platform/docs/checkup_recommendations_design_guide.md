# 검진 항목 추천 화면 디자인 가이드

## 개요
메인 화면에서 "검진항목 설계하기" 카드를 클릭하면 표시되는 검진 항목 추천 화면입니다.
메인 화면의 헤더 구조를 재사용하고, 하단에 추천 검진 항목 목록과 예약 버튼을 배치합니다.

---

## 화면 구조

### 1. 헤더 영역 (MainPage 재사용)
- **위치**: 상단 고정
- **구성**: 
  - 병원 로고 (108px × 108px)
  - 병원명 (서울웰노내과의원 / SEOUL WELNO MEDICAL CENTER)
- **스타일**: MainPage의 `main-page__header-greeting-section` 재사용

### 2. 환자 인사말 + 추천 설명 영역
- **위치**: 헤더 바로 아래
- **구성**:
  - 환자 이름 + "님 건강 상태에 꼭 필요한 검진 항목을 추천드려요!"
  - 정보 아이콘 (ⓘ) + "건강검진 결과 기준 발병확률이 있는 항목을 추천"
- **배경색**: `#FEF9EE` (크림 배경)
- **패딩**: 좌우 1rem (16px), 하단 1.5rem (24px)

### 3. 추천 검진 항목 섹션
- **위치**: 인사말 영역 아래
- **제목**: "추천 검진 항목" (빨간색-브라운 계열)
- **뱃지**: "총 5개" (브라운 필 모양)
- **배경색**: `#FEF9EE` (크림 배경)

### 4. 검진 항목 카드 (아코디언)
각 검진 카테고리별로 접기/펼치기 가능한 카드

#### 4.1 대장검사 카드 (기본 펼쳐짐)
- **헤더**:
  - 제목: "대장검사"
  - 뱃지: "3개" (브라운 필 모양)
  - 아이콘: 위쪽 화살표 (펼쳐짐 상태)
- **내용** (펼쳐짐 시):
  - 체크박스: "대장내시경(비수면)" ✓
  - 체크박스: "대장내시경(수면)" ✓
  - 체크박스: "얼리텍 검사" ✓
    - 정보 아이콘 + 설명: "분변 채취로 용종, 대장암을 확인 할 수 있는 검사"
  - 의사 추천 박스:
    - 배경: 연한 베이지 (`#FEF9EE` 또는 `#E8DCC8`)
    - 테두리: 빨간색-브라운 (`#A16A51`)
    - 왼쪽: 의사 일러스트 (check_planner.png 이미지)
    - 텍스트: "*안광수님은 과거 검진 결과, **대장검사에서** 이상 소견이 보이고..."
    - 강조: "대장검사에서" 부분 빨간색 강조

#### 4.2 CT 검사 카드 (기본 접힘)
- **헤더**:
  - 제목: "CT 검사"
  - 뱃지: "2개"
  - 아이콘: 아래쪽 화살표 (접힘 상태)

#### 4.3 MRI 검사 카드 (기본 접힘)
- **헤더**:
  - 제목: "MRI 검사"
  - 뱃지: "1개"
  - 아이콘: 아래쪽 화살표 (접힘 상태)

### 5. 하단 예약 버튼
- **위치**: 화면 최하단 고정
- **텍스트**: "검진 예약 날짜 선택하기"
- **배경색**: 진한 브라운 (`#55433B` 또는 `#A16A51`)
- **텍스트 색상**: 흰색
- **높이**: 약 56px
- **모서리**: 둥근 모서리 (12px)
- **패딩**: 좌우 1rem, 상하 1rem

---

## 색상 시스템 (기존 토큰 재사용)

### 메인 색상 (SCSS 변수 기반)
모든 색상은 기존 `_variables.scss`의 토큰을 재사용합니다.

#### 배경 색상
- **메인 배경**: `$background-cream` (`#FEF9EE`) - 크림 배경
- **카드 배경**: `$brand-brown-card` (`#E8DCC8`) - 연한 브라운 카드 배경
- **의사 추천 박스 배경**: `$background-cream` 또는 `$brand-brown-card`

#### 브라운 계열 (기존 토큰 재사용)
- **제목 색상**: `$brand-brown-darker` (`#55433B`) - 매우 진한 브라운
- **버튼 배경**: `$brand-brown-darker` (`#55433B`) 또는 `$brand-brown-dark` (`#A16A51`)
- **뱃지 배경**: `$brand-brown-dark` (`#A16A51`) - 중간 브라운
- **아이콘 배경**: `$brand-brown-dark` (`#A16A51`)
- **카드 배경**: `$brand-brown-card` (`#E8DCC8`) - 연한 브라운

#### 강조 색상
- **의사 추천 박스 강조 텍스트**: `$error` (`#f56565`) 또는 `$badge-abnormal-bg` (`#f56565`) - 빨간색 강조
- **의사 추천 박스 테두리**: `$brand-brown-dark` (`#A16A51`) - 빨간색-브라운 계열

#### 텍스트 색상
- **기본 텍스트**: `$black` (`#000000`) - 검정
- **보조 텍스트**: `$gray-450` (`#565656`) - 중간 진한 회색
- **설명 텍스트**: `$brand-brown-text` (`#8B6F5E`) - 브라운톤 텍스트
- **버튼 텍스트**: `$white` (`#ffffff`) - 흰색

### CSS 변수 매핑 (design-tokens.css)
CSS 변수도 함께 사용 가능:
- `var(--color-brown-500)` → `$brand-brown` (`#7c746a`)
- `var(--color-brown-600)` → `$brand-brown-dark` (`#A16A51`)
- `var(--color-brown-800)` → `$brand-brown-darker` (`#55433B`)
- `var(--bg-primary)` → `$background-cream` (`#FEF9EE`)
- `var(--color-danger)` → `$error` (`#f56565`)

### 체크박스 색상 (기존 토큰 재사용)
- **체크박스 배경**: `$brand-brown-dark` (`#A16A51`) - 브라운
- **체크 마크**: `$white` (`#ffffff`) - 흰색
- **CSS 변수**: `var(--color-brown-600)` → `$brand-brown-dark`

---

## 타이포그래피

### 폰트
- **기본 폰트**: Noto Sans KR (MainPage와 동일)
- **폰트 크기**:
  - 환자 인사말: 22px (모바일), 24px (데스크톱)
  - 추천 설명: 14px
  - 카드 제목: 16px (볼드)
  - 검진 항목명: 14px
  - 의사 추천 텍스트: 14px
  - 버튼 텍스트: 16px (볼드)

### 폰트 두께
- **제목**: 700 (Bold)
- **본문**: 400 (Normal)
- **설명**: 300 (Light)

---

## 간격 시스템

### 패딩
- **헤더 영역**: 좌우 1rem (16px)
- **카드 내부**: 상하 1rem, 좌우 1rem
- **카드 간격**: 12px

### 마진
- **섹션 간 간격**: 24px
- **카드 내부 요소 간격**: 12px

---

## 컴포넌트 구조

```
CheckupRecommendationsPage
├── HeaderSection (MainPage 재사용)
│   ├── HospitalLogo
│   └── HospitalName
├── GreetingSection
│   ├── PatientGreeting
│   └── RecommendationInfo
├── RecommendationsSection
│   ├── SectionTitle ("추천 검진 항목")
│   ├── TotalBadge ("총 5개")
│   └── RecommendationCards
│       ├── ColonoscopyCard (기본 펼쳐짐)
│       │   ├── CardHeader
│       │   ├── CardContent (펼쳐짐)
│       │   │   ├── CheckupItem (체크박스)
│       │   │   ├── CheckupItem (체크박스)
│       │   │   ├── CheckupItem (체크박스 + 정보)
│       │   │   └── DoctorRecommendationBox
│       │   │       ├── DoctorIllustration (check_planner.png)
│       │   │       └── RecommendationText
│       ├── CTScanCard (기본 접힘)
│       └── MRIScanCard (기본 접힘)
└── BottomButton
    └── AppointmentButton ("검진 예약 날짜 선택하기")
```

---

## 인터랙션

### 아코디언 카드
- **클릭 영역**: 카드 헤더 전체
- **애니메이션**: 부드러운 펼치기/접기 (0.3s ease)
- **아이콘 회전**: 펼쳐짐 시 위쪽 화살표, 접힘 시 아래쪽 화살표

### 체크박스
- **상태**: 기본 모두 체크됨 (추천 항목이므로)
- **클릭 가능**: 나중에 선택 해제 가능하도록 (현재는 퍼블리싱만)

### 예약 버튼
- **클릭 시**: `/appointment` 페이지로 이동
- **호버 효과**: 배경색 약간 진하게

---

## 반응형 디자인

### 모바일 (기본)
- 전체 너비 사용
- 카드 세로 배치
- 버튼 하단 고정

### 태블릿/데스크톱
- 최대 너비 제한 (예: 768px)
- 중앙 정렬
- 폰트 크기 약간 증가

---

## 이미지 리소스

### 필수 이미지
1. **check_planner.png**: 의사 추천 박스 내 일러스트
   - 위치: `/src/assets/images/check_planner.png`
   - 크기: 약 80px × 80px (반응형)
   - 용도: 의사 추천 메시지 박스 왼쪽

### 선택적 이미지
- 병원 로고: MainPage에서 가져옴
- 정보 아이콘: SVG 또는 유니코드 (ⓘ)

---

## 백엔드 API 요구사항 (향후 개발)

### 엔드포인트
```
GET /api/v1/checkup-recommendations?patient_uuid={uuid}&hospital_id={hospital_id}
```

### 응답 구조
```json
{
  "success": true,
  "data": {
    "patient_name": "안광수",
    "total_count": 5,
    "categories": [
      {
        "category_name": "대장검사",
        "category_name_en": "Colonoscopy",
        "item_count": 3,
        "items": [
          {
            "id": "colonoscopy-non-sedated",
            "name": "대장내시경(비수면)",
            "name_en": "Colonoscopy (non-sedated)",
            "recommended": true,
            "description": null
          },
          {
            "id": "colonoscopy-sedated",
            "name": "대장내시경(수면)",
            "name_en": "Colonoscopy (sedated)",
            "recommended": true,
            "description": null
          },
          {
            "id": "early-detection-test",
            "name": "얼리텍 검사",
            "name_en": "Early Detection Test",
            "recommended": true,
            "description": "분변 채취로 용종, 대장암을 확인 할 수 있는 검사"
          }
        ],
        "doctor_recommendation": {
          "has_recommendation": true,
          "message": "*안광수님은 과거 검진 결과, 대장검사에서 이상 소견이 보이고 추후 정밀검사를 필요로 할 수 있어 해당 검사를 추천드립니다!",
          "highlighted_text": "대장검사에서"
        },
        "default_expanded": true
      },
      {
        "category_name": "CT 검사",
        "category_name_en": "CT Scan",
        "item_count": 2,
        "items": [
          {
            "id": "ct-chest",
            "name": "흉부 CT",
            "name_en": "Chest CT",
            "recommended": true,
            "description": null
          },
          {
            "id": "ct-abdomen",
            "name": "복부 CT",
            "name_en": "Abdomen CT",
            "recommended": true,
            "description": null
          }
        ],
        "doctor_recommendation": null,
        "default_expanded": false
      },
      {
        "category_name": "MRI 검사",
        "category_name_en": "MRI Scan",
        "item_count": 1,
        "items": [
          {
            "id": "mri-brain",
            "name": "뇌 MRI",
            "name_en": "Brain MRI",
            "recommended": true,
            "description": null
          }
        ],
        "doctor_recommendation": null,
        "default_expanded": false
      }
    ]
  }
}
```

### 필드 설명
- `patient_name`: 환자 이름
- `total_count`: 전체 추천 항목 수
- `categories`: 검진 카테고리 배열
  - `category_name`: 카테고리명 (한글)
  - `category_name_en`: 카테고리명 (영문)
  - `item_count`: 해당 카테고리 항목 수
  - `items`: 검진 항목 배열
    - `id`: 항목 고유 ID
    - `name`: 항목명 (한글)
  - `doctor_recommendation`: 의사 추천 메시지 (있을 경우만)
    - `has_recommendation`: 추천 메시지 존재 여부
    - `message`: 추천 메시지 전체 텍스트
    - `highlighted_text`: 강조할 텍스트 부분
  - `default_expanded`: 기본 펼침 상태 (true/false)

---

## 구현 우선순위

### Phase 1: 퍼블리싱 (현재)
1. ✅ 디자인 가이드 작성
2. ✅ 컴포넌트 구조 설계
3. ✅ 스타일 파일 작성
4. ✅ 목업 데이터로 화면 구현
5. ✅ 아코디언 기능 구현
6. ✅ 반응형 디자인 적용

### Phase 2: 백엔드 연동 (향후)
1. API 엔드포인트 개발
2. 프론트엔드 API 연동
3. 로딩 상태 처리
4. 에러 처리
5. 실제 데이터 표시

---

## 체크리스트

### 디자인
- [x] 색상 시스템 정의
- [x] 타이포그래피 정의
- [x] 간격 시스템 정의
- [x] 컴포넌트 구조 설계
- [x] 인터랙션 정의
- [x] 반응형 디자인 정의

### 구현
- [ ] CheckupRecommendationsPage 컴포넌트 생성
- [ ] HeaderSection 재사용
- [ ] GreetingSection 구현
- [ ] RecommendationCard 아코디언 구현
- [ ] DoctorRecommendationBox 구현
- [ ] BottomButton 구현
- [ ] 스타일 파일 작성
- [ ] 목업 데이터로 테스트
- [ ] 반응형 테스트

### 백엔드 요구사항
- [ ] API 엔드포인트 명세서 작성
- [ ] 데이터 모델 정의
- [ ] 응답 구조 문서화

