# 🚀 WELNO 프론트엔드 개발 가이드

## 📱 1. 모바일 크기로 브라우저 자동 실행

### 방법 1: 스크립트 사용 (권장)

```bash
# 개발 서버 + 모바일 브라우저 자동 실행
npm run start:mobile

# 또는
npm run dev:mobile
```

**특징:**
- 375x812 (iPhone 13 Pro 크기) 자동 설정
- 모바일 User-Agent 적용
- 개발자 도구 자동 열림
- 개발 서버 시작 후 3초 뒤 브라우저 자동 실행

### 방법 2: Chrome 개발자 도구 수동 설정

1. `npm run start` 또는 `npm run dev` 실행
2. Chrome에서 `F12` 또는 `Cmd+Opt+I` (Mac)
3. 좌측 상단 📱 아이콘 클릭 (Device Toolbar)
4. "Dimensions" → "iPhone 13 Pro" 선택

### 방법 3: Chrome 실행 옵션으로 직접 띄우기

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --window-size=375,812 \
  --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" \
  --app="http://localhost:9282/welno"

# Linux
google-chrome \
  --window-size=375,812 \
  --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" \
  --app="http://localhost:9282/welno"
```

---

## 🔇 2. 배포 버전에서 콘솔 로그 제거

### 자동 제거 설정 (이미 적용됨)

#### ✅ Webpack TerserPlugin 설정 (craco.config.js)

```javascript
// 프로덕션 빌드 시 자동으로 console.* 제거
if (env === 'production') {
  webpackConfig.optimization.minimizer = [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true,  // 모든 console.* 제거
          drop_debugger: true, // debugger 구문 제거
        },
      },
    }),
  ];
}
```

#### ✅ index.html 스크립트에서 console 비활성화

```javascript
// 프로덕션 환경(localhost 제외)에서 console 비활성화
if (window.location.hostname !== 'localhost' && 
    !window.location.hostname.startsWith('192.168')) {
  console.log = function() {};
  console.info = function() {};
  console.debug = function() {};
  console.warn = function() {};
}
```

### 권장: logger 유틸 사용

기존 `console.log()` 대신 `src/utils/logger.ts` 사용:

```typescript
// ❌ 기존
console.log('데이터:', data);
console.warn('경고!');

// ✅ 변경
import logger from '@/utils/logger';

logger.log('데이터:', data);  // 개발: 출력 / 프로덕션: 무시
logger.warn('경고!');          // 개발: 출력 / 프로덕션: 무시
logger.error('에러!');         // 항상 출력 (에러만 프로덕션에서도 남김)
```

**logger API:**
```typescript
logger.log(...)      // 일반 로그
logger.info(...)     // 정보
logger.warn(...)     // 경고
logger.error(...)    // 에러 (프로덕션에도 출력)
logger.debug(...)    // 디버그
logger.table(data)   // 테이블 형식
logger.group(label)  // 그룹 시작
logger.groupEnd()    // 그룹 종료
```

---

## 🛠 3. 설치 및 빌드

### 의존성 설치

```bash
cd planning-platform/frontend
npm install
```

### 개발 서버 실행

```bash
# 일반 개발 서버
npm run start
# 또는
npm run dev

# 모바일 뷰 자동 실행
npm run start:mobile
npm run dev:mobile
```

### 프로덕션 빌드

```bash
# 빌드 (console.log 자동 제거됨)
npm run build

# 빌드 결과 확인
ls -lh build/static/js/
```

### 배포

```bash
# 백엔드 static 폴더로 복사
npm run deploy:simple

# 또는 개선된 배포 스크립트
npm run deploy
```

---

## 🔍 4. 환경별 동작 확인

### 개발 환경 (localhost)
- ✅ 모든 console.* 출력
- ✅ logger.* 모두 작동
- ✅ 소스맵 생성

### 프로덕션 (xogxog.com, welno.kindhabit.com 등)
- ❌ console.log, info, debug, warn 제거
- ✅ console.error만 남음
- ✅ 코드 압축 및 난독화

### 확인 방법

```javascript
// 브라우저 콘솔에서 실행
console.log('hostname:', window.location.hostname);
console.log('env:', process.env.NODE_ENV);

// 개발 환경인지 확인
const isDev = 
  window.location.hostname === 'localhost' ||
  window.location.hostname.startsWith('192.168');
console.log('개발 환경?', isDev);
```

---

## 📊 5. 빌드 크기 최적화 확인

```bash
# 빌드 후 파일 크기 확인
npm run build
du -sh build/static/js/*

# 예상 결과:
# - console.log 제거 전: ~1.2MB
# - console.log 제거 후: ~1.0MB (약 20% 감소)
```

---

## 🚨 6. 트러블슈팅

### Chrome이 모바일 크기로 안 열려요

```bash
# 스크립트 권한 확인
ls -la open-mobile.sh

# 권한 부여
chmod +x open-mobile.sh

# Chrome 경로 확인 (Linux)
which google-chrome
which chromium-browser

# macOS는 기본 경로 사용
ls /Applications/Google\ Chrome.app
```

### 프로덕션에서 console.log가 여전히 보여요

1. **빌드 캐시 삭제:**
```bash
rm -rf build/
rm -rf node_modules/.cache/
npm run build
```

2. **TerserPlugin 설치 확인:**
```bash
npm list terser-webpack-plugin
# 없으면 설치
npm install --save-dev terser-webpack-plugin@^5.3.10
```

3. **브라우저 캐시 삭제:**
- Chrome: `Cmd+Shift+Delete` (Mac) / `Ctrl+Shift+Delete` (Win/Linux)
- "캐시된 이미지 및 파일" 체크 → 삭제

### 개발 환경에서도 로그가 안 보여요

`craco.config.js`에서 TerserPlugin이 개발 환경에도 적용되었는지 확인:

```javascript
// ✅ 올바른 설정
if (env === 'production') {
  webpackConfig.optimization.minimizer = [
    new TerserPlugin({ ... })
  ];
}

// ❌ 잘못된 설정
if (env === 'development') {  // 개발에 적용되면 안 됨!
  webpackConfig.optimization.minimizer = [
    new TerserPlugin({ ... })
  ];
}
```

---

## 📦 7. 추가 최적화 옵션

### console.error도 제거하려면

```javascript
// craco.config.js
compress: {
  drop_console: true,     // 모든 console.* 제거
  pure_funcs: [           // 추가 제거 (console.error 포함)
    'console.log',
    'console.info', 
    'console.debug',
    'console.warn',
    'console.error'       // 에러도 제거
  ]
}
```

### alert, confirm 등도 제거

```javascript
compress: {
  drop_console: true,
  pure_funcs: [
    'console.log',
    'alert',       // 알림창 제거
    'confirm',     // 확인창 제거
    'prompt'       // 입력창 제거
  ]
}
```

---

**마지막 업데이트**: 2026-01-13  
**설정 파일**:
- `craco.config.js` - Webpack 설정
- `open-mobile.sh` - 모바일 브라우저 자동 실행
- `package.json` - 스크립트 추가
- `public/index.html` - 런타임 console 비활성화
- `src/utils/logger.ts` - 환경별 로깅 유틸
