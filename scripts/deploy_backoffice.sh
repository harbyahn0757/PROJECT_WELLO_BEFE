#!/bin/bash

# 백오피스 단독 배포 스크립트
PROJECT_ROOT="/home/workspace/PROJECT_WELNO_BEFE"
BACKOFFICE_DIR="$PROJECT_ROOT/planning-platform/backoffice"
STATIC_DIR="$PROJECT_ROOT/planning-platform/backend/static/backoffice"

echo "📦 백오피스 빌드 중..."
cd "$BACKOFFICE_DIR"
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 백오피스 빌드 실패!"
  exit 1
fi

echo "📁 정적 파일 복사 중..."
mkdir -p "$STATIC_DIR"
rm -rf "$STATIC_DIR"/*
cp -r "$BACKOFFICE_DIR/build/"* "$STATIC_DIR/"
echo "   ✅ 백오피스 앱 복사 완료"

echo "🔄 백엔드 서버 재시작 중..."
pm2 restart WELNO_BE

sleep 5

if pm2 list | grep -q "WELNO_BE.*online"; then
  echo "✅ 배포 완료!"
  # 번들 해시 표시
  BUNDLE=$(grep -o 'main\.[a-f0-9]*\.js' "$STATIC_DIR/index.html")
  echo "   번들: $BUNDLE"
else
  echo "❌ 서버 재시작 실패"
  pm2 logs WELNO_BE --lines 5
  exit 1
fi
