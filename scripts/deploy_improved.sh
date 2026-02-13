#!/bin/bash

# 개선된 통합 배포 스크립트
PROJECT_ROOT="/home/workspace/PROJECT_WELNO_BEFE"
DEPLOY_START_TIME=$(date +%s)
DEPLOY_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Slack 웹훅 URL (.env에서 로드)
SLACK_WEBHOOK_URL=""
if [ -f "$PROJECT_ROOT/planning-platform/backend/.env" ]; then
  SLACK_WEBHOOK_URL=$(grep -E "^SLACK_WEBHOOK_URL=" "$PROJECT_ROOT/planning-platform/backend/.env" | cut -d'=' -f2-)
fi

# Slack 알림 함수
send_slack_notify() {
  local color="$1"   # good, warning, danger
  local title="$2"
  local message="$3"

  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    return 0
  fi

  local payload=$(cat <<EOFSLACK
{
  "text": "$title",
  "attachments": [{
    "color": "$color",
    "fields": [
      {"title": "환경", "value": "Production", "short": true},
      {"title": "시간", "value": "$DEPLOY_TIMESTAMP", "short": true},
      {"title": "내용", "value": "$message", "short": false}
    ],
    "footer": "WELNO 배포 시스템"
  }]
}
EOFSLACK
)

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null 2>&1
}

echo "🚀 WELNO 서비스 배포 시작 (루트: $PROJECT_ROOT)"
send_slack_notify "warning" "🚀 배포 시작" "WELNO 서비스 배포가 시작되었습니다."

# 1. 개발 서버 종료 (포트 9282)
echo "🛑 개발 서버 종료 중..."
cd "$PROJECT_ROOT/planning-platform/frontend"
npm run kill-port 2>/dev/null || true

# 2. 프론트엔드 빌드
echo "📦 프론트엔드 빌드 중..."
rm -rf build # 확실한 반영을 위해 기존 빌드 삭제
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 프론트엔드 빌드 실패!"
    send_slack_notify "danger" "❌ 배포 실패" "프론트엔드 빌드에 실패했습니다."
    exit 1
fi

# 2b. 파트너 임베드 위젯 빌드 (동적 로드 시 window.WelnoRagChatWidget 노출용)
echo "📦 파트너 위젯 빌드 중..."
cd "$PROJECT_ROOT/planning-platform/frontend"
npx webpack --config webpack.embed.config.js
if [ $? -ne 0 ]; then
  echo "❌ 파트너 위젯 빌드 실패!"
  send_slack_notify "danger" "❌ 배포 실패" "파트너 위젯 빌드에 실패했습니다."
  exit 1
fi

# 2b-2. 설문 위젯 빌드
echo "📦 설문 위젯 빌드 중..."
cd "$PROJECT_ROOT/planning-platform/frontend"
npx webpack --config webpack.survey.config.js
if [ $? -ne 0 ]; then
  echo "❌ 설문 위젯 빌드 실패!"
  send_slack_notify "danger" "❌ 배포 실패" "설문 위젯 빌드에 실패했습니다."
  exit 1
fi

# 2c. 백오피스 독립 앱 빌드
echo "📦 백오피스 앱 빌드 중..."
cd "$PROJECT_ROOT/planning-platform/backoffice"
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 백오피스 빌드 실패!"
  send_slack_notify "danger" "❌ 배포 실패" "백오피스 빌드에 실패했습니다."
  exit 1
fi

# 3. 빌드 파일을 백엔드 static 폴더로 복사
echo "📁 정적 파일 복사 중..."
cd "$PROJECT_ROOT/planning-platform/backend"
mkdir -p static
rm -rf static/* 2>/dev/null || true
cp -r ../frontend/build/* static/
# 파트너 위젯 및 메디링스 아이콘 유지
if [ -f "../frontend/dist/embed/welno-rag-chat-widget.min.js" ]; then
  cp ../frontend/dist/embed/welno-rag-chat-widget.min.js static/
  echo "   ✅ welno-rag-chat-widget.min.js 복사"
fi
if [ -f "../frontend/dist/embed/welno-survey-widget.min.js" ]; then
  cp ../frontend/dist/embed/welno-survey-widget.min.js static/
  echo "   ✅ welno-survey-widget.min.js 복사"
fi
if [ -f "../frontend/mdx_icon.png" ]; then
  cp ../frontend/mdx_icon.png static/
  echo "   ✅ mdx_icon.png 복사"
fi
# 백오피스 앱 복사
if [ -d "../backoffice/build" ]; then
  mkdir -p static/backoffice
  rm -rf static/backoffice/*
  cp -r ../backoffice/build/* static/backoffice/
  echo "   ✅ 백오피스 앱 복사 (static/backoffice/)"
fi

# 4. PM2로 백엔드 재시작
echo "🔄 백엔드 서버 재시작 중..."
pm2 restart WELNO_BE 2>/dev/null || pm2 start ecosystem.config.js

# 5. 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
sleep 3

# Nginx 리로드 추가
sudo systemctl reload nginx

# 백엔드 상태 확인
if pm2 list | grep -q "WELNO_BE.*online"; then
    echo "✅ 백엔드 서버 정상 실행 중"
else
    echo "❌ 백엔드 서버 실행 실패"
    send_slack_notify "danger" "❌ 배포 실패" "백엔드 서버(PM2) 시작에 실패했습니다."
    pm2 logs WELNO_BE --lines 10
    exit 1
fi

# 6. 정적 파일 서빙 확인
if [ -f "static/index.html" ]; then
    echo "✅ 정적 파일 배포 완료"
else
    echo "❌ 정적 파일 배포 실패"
    send_slack_notify "danger" "❌ 배포 실패" "정적 파일 배포에 실패했습니다."
    exit 1
fi

# 배포 소요 시간 계산
DEPLOY_END_TIME=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))

echo ""
echo "🎉 배포 완료! (소요: ${DEPLOY_DURATION}초)"
echo "🌐 서비스 접속: https://xogxog.com/welno/"
echo "📊 서버 상태: pm2 status"
echo "📋 로그 확인: pm2 logs WELNO_BE"

send_slack_notify "good" "✅ 배포 완료" "WELNO 서비스 배포가 성공적으로 완료되었습니다. (소요: ${DEPLOY_DURATION}초)"
