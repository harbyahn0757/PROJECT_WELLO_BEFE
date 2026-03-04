#!/usr/bin/env bash
# deploy.sh — WELNO 통합 배포 스크립트
# 사용법: ./deploy.sh [all|frontend|backoffice]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FE_DIR="$PROJECT_ROOT/frontend"
BO_DIR="$PROJECT_ROOT/backoffice"
BE_DIR="$PROJECT_ROOT/backend"
STATIC_DIR="$BE_DIR/static"

MODE="${1:-all}"
DEPLOY_START=$(date +%s)

echo "=== WELNO 배포 시작 (모드: $MODE) ==="
echo "  프로젝트: $PROJECT_ROOT"

# ── 빌드 함수 ──

build_frontend() {
  echo ""
  echo "[FE] 프론트엔드 빌드..."
  cd "$FE_DIR"
  rm -rf build
  npm run build
  echo "[FE] 빌드 완료"
}

build_widgets() {
  echo ""
  echo "[Widget] RAG 채팅 위젯 빌드..."
  cd "$FE_DIR"
  if [ -f webpack.embed.config.js ]; then
    npx webpack --config webpack.embed.config.js
    echo "[Widget] RAG 위젯 완료"
  else
    echo "[Widget] webpack.embed.config.js 없음 — 스킵"
  fi

  echo "[Widget] 설문 위젯 빌드..."
  if [ -f webpack.survey.config.js ]; then
    npx webpack --config webpack.survey.config.js
    echo "[Widget] 설문 위젯 완료"
  else
    echo "[Widget] webpack.survey.config.js 없음 — 스킵"
  fi
}

build_backoffice() {
  echo ""
  echo "[BO] 백오피스 빌드..."
  cd "$BO_DIR"
  npm run build
  echo "[BO] 빌드 완료"
}

# ── 배포 함수 ──

deploy_frontend() {
  echo ""
  echo "[Deploy] 프론트엔드 → static/ ..."
  mkdir -p "$STATIC_DIR"
  rm -rf "$STATIC_DIR"/*
  cp -r "$FE_DIR/build/"* "$STATIC_DIR/"

  # 위젯 JS 복사
  if [ -f "$FE_DIR/dist/embed/welno-rag-chat-widget.min.js" ]; then
    cp "$FE_DIR/dist/embed/welno-rag-chat-widget.min.js" "$STATIC_DIR/"
    echo "  + welno-rag-chat-widget.min.js"
  elif [ -f "$BE_DIR/app/static/welno-rag-chat-widget.min.js" ]; then
    cp "$BE_DIR/app/static/welno-rag-chat-widget.min.js" "$STATIC_DIR/"
    echo "  + welno-rag-chat-widget.min.js (app/static)"
  fi

  if [ -f "$FE_DIR/dist/embed/welno-survey-widget.min.js" ]; then
    cp "$FE_DIR/dist/embed/welno-survey-widget.min.js" "$STATIC_DIR/"
    echo "  + welno-survey-widget.min.js"
  elif [ -f "$FE_DIR/src/embed/WelnoSurveyWidget.js" ]; then
    cp "$FE_DIR/src/embed/WelnoSurveyWidget.js" "$STATIC_DIR/welno-survey-widget.min.js"
    echo "  + welno-survey-widget.min.js (src)"
  fi

  # 아이콘
  [ -f "$FE_DIR/mdx_icon.png" ] && cp "$FE_DIR/mdx_icon.png" "$STATIC_DIR/" && echo "  + mdx_icon.png"

  echo "[Deploy] 프론트엔드 완료"
}

deploy_backoffice() {
  echo ""
  echo "[Deploy] 백오피스 → static/backoffice/ ..."
  local BO_STATIC="$STATIC_DIR/backoffice"
  mkdir -p "$BO_STATIC"
  rm -rf "$BO_STATIC/static/css" "$BO_STATIC/static/js" 2>/dev/null || true
  /bin/cp -rf "$BO_DIR/build/"* "$BO_STATIC/"

  # welno 로고 복사
  if [ -f "$STATIC_DIR/welno_logo.png" ]; then
    cp "$STATIC_DIR/welno_logo.png" "$BO_STATIC/" 2>/dev/null || true
    echo "  + welno_logo.png"
  fi

  echo "[Deploy] 백오피스 완료"
  echo "  번들: $(find "$BO_STATIC/static/js" -name 'main.*.js' 2>/dev/null | head -1)"
}

restart_pm2() {
  echo ""
  if command -v pm2 &>/dev/null; then
    echo "[PM2] WELNO_BE 재시작..."
    pm2 restart WELNO_BE --update-env 2>/dev/null || pm2 start "$BE_DIR/ecosystem.config.js"
    sleep 3
    if pm2 list | grep -q "WELNO_BE.*online"; then
      echo "[PM2] 정상 실행 중"
    else
      echo "[PM2] 시작 실패!"
      pm2 logs WELNO_BE --lines 5 --nostream
      exit 1
    fi
  else
    echo "[PM2] pm2 없음 — 재시작 생략 (서버에서 수동 실행)"
  fi
}

# ── 모드별 실행 ──

case "$MODE" in
  all)
    build_frontend
    build_widgets
    build_backoffice
    deploy_frontend
    deploy_backoffice
    restart_pm2
    ;;
  frontend|fe)
    build_frontend
    build_widgets
    deploy_frontend
    deploy_backoffice  # 기존 backoffice 복원
    restart_pm2
    ;;
  backoffice|bo)
    build_backoffice
    deploy_backoffice
    # PM2 재시작 불필요 (정적 파일만 교체)
    ;;
  *)
    echo "사용법: $0 [all|frontend|backoffice]"
    exit 1
    ;;
esac

ELAPSED=$(( $(date +%s) - DEPLOY_START ))
echo ""
echo "=== 배포 완료 (${ELAPSED}초) ==="
