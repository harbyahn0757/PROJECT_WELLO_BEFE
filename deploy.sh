#!/bin/bash

# 통합 배포 스크립트
echo "🚀 Planning MVP 배포 시작..."

# 1. 프론트엔드 빌드
echo "📦 프론트엔드 빌드 중..."
cd planning-platform/frontend
npm run build

# 2. 빌드 파일을 백엔드 static 폴더로 복사
echo "📁 정적 파일 복사 중..."
cd ../backend
mkdir -p static
cp -r ../frontend/build/* static/

# 3. 백엔드 의존성 설치
echo "🐍 백엔드 의존성 설치 중..."
pip install -r requirements.txt

# 4. FastAPI에 정적 파일 서빙 추가
echo "⚙️  FastAPI 설정 업데이트 중..."

# 5. 서버 시작
echo "🚀 서버 시작 중..."
uvicorn app.main:app --host 0.0.0.0 --port 8082

echo "✅ 배포 완료!"
echo "🌐 서비스 접속: http://your-server:8082"
