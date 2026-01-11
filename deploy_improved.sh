#!/bin/bash

# 개선된 통합 배포 스크립트
echo "🚀 WELNO 서비스 배포 시작..."

# 현재 디렉토리 저장
SCRIPT_DIR=$(pwd)

# 1. 개발 서버 종료 (포트 9282)
echo "🛑 개발 서버 종료 중..."
cd planning-platform/frontend
npm run kill-port 2>/dev/null || true

# 2. 프론트엔드 빌드
echo "📦 프론트엔드 빌드 중..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 프론트엔드 빌드 실패!"
    exit 1
fi

# 3. 빌드 파일을 백엔드 static 폴더로 복사
echo "📁 정적 파일 복사 중..."
cd ../backend
mkdir -p static
rm -rf static/* 2>/dev/null || true
cp -r ../frontend/build/* static/

# 4. PM2로 백엔드 재시작
echo "🔄 백엔드 서버 재시작 중..."
pm2 restart WELLO_BE 2>/dev/null || pm2 start ecosystem.config.js

# 5. 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
sleep 3

# 백엔드 상태 확인
if pm2 list | grep -q "WELLO_BE.*online"; then
    echo "✅ 백엔드 서버 정상 실행 중"
else
    echo "❌ 백엔드 서버 실행 실패"
    pm2 logs WELLO_BE --lines 10
    exit 1
fi

# 6. 정적 파일 서빙 확인
if [ -f "static/index.html" ]; then
    echo "✅ 정적 파일 배포 완료"
else
    echo "❌ 정적 파일 배포 실패"
    exit 1
fi

echo ""
echo "🎉 배포 완료!"
echo "🌐 서비스 접속: https://xogxog.com/welno/"
echo "📊 서버 상태: pm2 status"
echo "📋 로그 확인: pm2 logs WELLO_BE"
