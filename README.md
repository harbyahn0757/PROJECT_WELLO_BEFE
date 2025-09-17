# 김현우내과 건강검진 랜딩페이지

> 따뜻하고 친근한 김현우내과의 건강검진 서비스를 소개하는 모바일 우선 반응형 웹사이트

## 📋 프로젝트 개요

김현우내과에서 제공하는 건강검진 서비스를 환자에게 친근하고 이해하기 쉽게 소개하는 랜딩페이지입니다. 모바일 환경을 우선으로 설계되었으며, 두 가지 레이아웃(세로형/가로형)을 지원합니다.

### 🎯 주요 기능
- **동적 레이아웃 전환**: URL 파라미터에 따른 세로형/가로형 레이아웃
- **반응형 디자인**: 모바일 우선 설계 (Mobile-First)
- **카드 기반 UI**: 재사용 가능한 서비스 소개 카드
- **플로팅 액션 버튼**: 건강검진 신청하기 CTA
- **브랜드 컬러 시스템**: 김현우내과 고유 브랜드 아이덴티티

## 🛠️ 기술 스택

### Frontend
- **React 18** with TypeScript
- **SCSS** (CSS Preprocessor)
- **Create React App** (CRA)
- **Pretendard Font** (한국어 최적화 폰트)

### 개발 도구
- **ESLint** & **Prettier** (코드 품질)
- **SCSS Linter** (스타일 품질)
- **Git** (버전 관리)

## 🎨 디자인 시스템

### 브랜드 컬러
```scss
$brand-brown: #7c746a;           // 메인 브랜드 컬러
$brand-brown-hover: #696158;     // 호버 상태
$background-beige: #f7e8d3;      // 따뜻한 배경
```

### 레이아웃 타입
1. **세로형 (Vertical)**: 전통적인 세로 스크롤 카드 레이아웃
2. **가로형 (Horizontal)**: 가로 스와이프 카드 슬라이더

### 컴포넌트 구조
```
src/
├── components/
│   ├── Button/           # 재사용 가능한 버튼 컴포넌트
│   └── Card/             # 세로형/가로형 지원 카드 컴포넌트
├── layouts/
│   ├── VerticalLayout/   # 세로형 레이아웃
│   └── HorizontalLayout/ # 가로형 레이아웃
├── utils/
│   └── layoutMapper.ts   # URL 파라미터 기반 레이아웃 매핑
└── constants/
    └── layoutTypes.ts    # 레이아웃 설정 상수
```

## 🚀 개발 환경 설정

### 사전 요구사항
- Node.js 14+ 
- npm 6+

### 설치 및 실행
```bash
# 프로젝트 클론
git clone [repository-url]
cd Planning_MVP

# 의존성 설치
cd planning-platform/frontend
npm install

# 개발 서버 실행
npm start
```

### 개발 서버
- **URL**: http://localhost:9281
- **포트**: 9281 (자동 포트 정리 스크립트 포함)

## 📱 레이아웃 접근 방법

### URL 파라미터로 레이아웃 전환
```
# 세로형 레이아웃 (기본)
http://localhost:9281/

# 가로형 레이아웃
http://localhost:9281/?layout=horizontal
http://localhost:9281/?hospital=김현우내과
```

### 병원별 커스터마이징
- 병원명에 따른 자동 레이아웃 매핑
- 헤더 텍스트 및 브랜딩 요소 동적 변경

## 🎯 주요 서비스 소개

1. **내 검진 결과 추이 보기**
   - 공단검진결과를 활용한 건강 추이 확인

2. **올해 검진 항목 설계**
   - 개인 맞춤형 검진 항목 추천

3. **검진 전 습관 만들기**
   - 검진 전 건강관리 가이드

## 📊 브라우저 지원

- **모던 브라우저**: Chrome, Firefox, Safari, Edge
- **모바일**: iOS Safari, Android Chrome
- **접근성**: WCAG 2.1 AA 기준 준수

## 🔧 개발 가이드

### 색상 사용법
```scss
// ✅ 올바른 사용
color: $brand-brown;
background: $background-beige;

// ❌ 금지된 사용
color: #7c746a;
background: #f7e8d3;
```

### 새로운 컴포넌트 추가
1. `src/components/` 폴더에 컴포넌트 생성
2. SCSS 변수 사용 필수
3. TypeScript 인터페이스 정의
4. 재사용성을 고려한 props 설계

## 📋 배포

### 빌드
```bash
npm run build
```

### 환경별 설정
- **개발**: `npm start` (9281 포트)
- **프로덕션**: `npm run build` → `build/` 폴더 배포

## 🤝 기여 가이드

1. **브랜치 전략**: `main` 브랜치에서 개발
2. **커밋 컨벤션**: 
   - `feat: 새로운 기능 추가`
   - `fix: 버그 수정`
   - `docs: 문서 업데이트`
   - `style: 스타일 변경`
3. **코드 리뷰**: 모든 변경사항은 리뷰 후 머지

## 📞 문의사항

### 김현우내과 정보
- **주소**: 서울특별시 동대문구 전농로 124 2층
- **전화**: 02-2215-9964

### 개발 관련 문의
- 이슈 등록을 통한 버그 신고 및 기능 요청
- 코드 기여는 Pull Request를 통해 진행

---

**김현우내과 건강검진 서비스를 통해 더 건강한 내일을 만들어가세요!** 🏥✨
