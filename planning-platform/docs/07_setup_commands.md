# 프로젝트 설정 명령어 가이드

## 🏗️ 폴더 구조 생성 명령어

### 1. 백엔드 폴더 구조 생성

```bash
# 백엔드 핵심 구조
mkdir -p backend/core
mkdir -p backend/features/pdf_processing
mkdir -p backend/features/file_management  
mkdir -p backend/features/relationship_management
mkdir -p backend/shared/{models,utils,constants}
mkdir -p backend/tests/{test_pdf_processing,test_file_management,test_relationship}

# 각 기능별 세부 구조는 개발 진행하면서 생성
```

### 2. 프론트엔드 폴더 구조 생성

```bash
# React 앱 생성 후 추가 폴더 구조
mkdir -p frontend/src/features/pdf_processing/{components,hooks,services,styles}
mkdir -p frontend/src/features/table_display/{components,hooks,utils,styles}
mkdir -p frontend/src/features/relationship_management/{components,hooks,services,styles}
mkdir -p frontend/src/shared/{components/{ui,layout},hooks,services,utils,styles}
mkdir -p frontend/src/types
mkdir -p frontend/tests/{__tests__,__mocks__,utils}
```

### 3. 기타 폴더 생성

```bash
# 샘플 파일 및 설정 폴더
mkdir -p samples
mkdir -p relationships
mkdir -p cache
```

## 🔧 개발 환경 설정

### 1. 백엔드 초기화

```bash
# 백엔드 디렉토리로 이동
cd backend

# 가상환경 생성
python -m venv venv

# 가상환경 활성화 (macOS/Linux)
source venv/bin/activate

# 가상환경 활성화 (Windows)
# venv\Scripts\activate

# 기본 패키지 설치
pip install fastapi uvicorn

# requirements.txt 생성을 위한 초기 패키지 기록
pip freeze > requirements.txt
```

### 2. 프론트엔드 초기화

```bash
# 프론트엔드 생성 (프로젝트 루트에서)
npx create-react-app frontend

# 프론트엔드 디렉토리로 이동
cd frontend

# 추가 의존성 설치
npm install axios styled-components

# 개발용 의존성 설치  
npm install --save-dev @testing-library/user-event
```

## 📄 초기 파일 생성

### 1. 백엔드 기본 파일들

#### `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PDF Table Analyzer API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "PDF Table Analyzer API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

#### `backend/core/config.py`
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "PDF Table Analyzer"
    
    # 파일 설정
    SAMPLES_DIR: str = "../samples"
    RELATIONSHIPS_DIR: str = "../relationships" 
    CACHE_DIR: str = "../cache"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # PDF 라이브러리 설정
    SUPPORTED_LIBRARIES: list = ["pdfplumber", "camelot", "tabula"]
    
    class Config:
        env_file = ".env"

settings = Settings()
```

#### `backend/requirements.txt`
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-multipart==0.0.6
aiofiles==23.2.1
pandas==2.1.3
pdfplumber==0.10.3
camelot-py[cv]==0.10.1
tabula-py==2.8.2
```

### 2. 프론트엔드 기본 파일들

#### `frontend/src/App.js` (수정)
```javascript
import React from 'react';
import './shared/styles/globals.css';

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>PDF Table Analyzer</h1>
      </header>
      <main className="app-main">
        <p>Coming soon...</p>
      </main>
    </div>
  );
}

export default App;
```

#### `frontend/src/shared/styles/globals.css`
```css
/* 전역 스타일 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

:root {
  /* 색상 변수 */
  --color-primary: #F97316;
  --color-secondary: #6B7280;
  --color-background: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-text: #111827;
  --color-text-secondary: #6B7280;
  
  /* 간격 변수 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--color-background);
  color: var(--color-text);
  line-height: 1.6;
}

.App {
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: var(--spacing-lg);
  text-align: center;
}

.app-main {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}
```

#### `frontend/package.json` (dependencies 추가)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "styled-components": "^6.1.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

## 🧪 개발 서버 실행

### 백엔드 실행
```bash
cd backend
source venv/bin/activate  # 가상환경 활성화
uvicorn main:app --reload --port 8000
```

### 프론트엔드 실행
```bash
cd frontend
npm start
```

## ✅ 설정 완료 확인

### 1. 백엔드 확인
- 브라우저에서 `http://localhost:8000` 접속
- `{"message": "PDF Table Analyzer API"}` 메시지 확인
- `http://localhost:8000/docs` 에서 Swagger UI 확인

### 2. 프론트엔드 확인  
- 브라우저에서 `http://localhost:3000` 접속
- "PDF Table Analyzer" 제목과 "Coming soon..." 메시지 확인

### 3. 폴더 구조 확인
```bash
# 전체 구조 확인
tree -L 3 -I 'node_modules|__pycache__|.git'
```

## 🔄 다음 단계

설정이 완료되면 다음 순서로 개발을 진행합니다:

1. ✅ **프로젝트 구조 설정** (현재 단계)
2. 🔄 **백엔드 PDF 처리 기능 구현**
3. 🔄 **프론트엔드 기본 컴포넌트 구현**
4. 🔄 **API 연동**
5. 🔄 **테이블 그리드 구현**
6. 🔄 **관계 설정 기능 구현**

각 단계별로 해당 기능 폴더 내에서 개발을 진행하며, 공통 기능은 shared 폴더를 활용합니다.
