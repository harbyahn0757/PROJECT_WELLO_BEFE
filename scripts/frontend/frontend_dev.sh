#!/bin/bash

# 설정
PORT=9282

echo "========================================================"
echo "🔧 프론트엔드 개발 서버 시작 스크립트 (Auto-Reload)"
echo "========================================================"

# 1. 포트 점유 확인 및 정리
echo "🔍 포트 $PORT 점유 프로세스 확인 중..."
PID=$(lsof -t -i:$PORT)

if [ ! -z "$PID" ]; then
    echo "⚠️  포트 $PORT 가 이미 사용 중입니다 (PID: $PID). 강제 종료합니다..."
    kill -9 $PID
    echo "✅ 기존 프로세스 종료 완료."
else
    echo "✅ 포트 $PORT 가 깨끗합니다."
fi

# 2. 환경변수 설정
echo "🚀 환경변수 설정 및 서버 시작..."

# 기본 설정
export PORT=$PORT
export DANGEROUSLY_DISABLE_HOST_CHECK=true
export FAST_REFRESH=true
export GENERATE_SOURCEMAP=false
export DISABLE_ESLINT_PLUGIN=true
export TSC_COMPILE_ON_ERROR=true
export SKIP_PREFLIGHT_CHECK=true
export NODE_OPTIONS="--max-old-space-size=512"

# 🔥 핫 리로드 강화 (파일 변경 감지 강제)
# 리눅스/가상환경에서 파일 변경 이벤트를 놓치지 않도록 폴링 방식 사용
export CHOKIDAR_USEPOLLING=true
export WATCHPACK_POLLING=true

# 3. 서버 시작
echo "📦 npm start 실행..."
echo "========================================================"
npm start



