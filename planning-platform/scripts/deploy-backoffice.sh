#!/usr/bin/env bash
# deploy-backoffice.sh — 백오피스 빌드 → backend/static 배포
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKOFFICE_DIR="$PROJECT_ROOT/backoffice"
STATIC_DIR="$PROJECT_ROOT/backend/static/backoffice"

echo "=== 백오피스 배포 시작 ==="
echo "  소스: $BACKOFFICE_DIR"
echo "  배포: $STATIC_DIR"

# 1) 빌드
echo ""
echo "[1/3] npm run build ..."
cd "$BACKOFFICE_DIR"
npm run build

BUILD_DIR="$BACKOFFICE_DIR/build"
if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: build 디렉토리가 생성되지 않았습니다."
  exit 1
fi

# 2) 이전 정적 파일 정리 + 복사
echo ""
echo "[2/3] static 파일 배포 ..."

# 기존 css/js 정리 (해시가 바뀌므로 이전 파일 제거)
rm -rf "$STATIC_DIR/static/css" "$STATIC_DIR/static/js" 2>/dev/null || true

# build 결과 복사 (alias cp -i 우회)
/bin/cp -rf "$BUILD_DIR"/* "$STATIC_DIR"/

echo "  배포 완료: $(find "$STATIC_DIR/static/js" -name 'main.*.js' 2>/dev/null | head -1)"

# 3) PM2 재시작 (옵션)
if [ "${1:-}" = "--restart" ]; then
  echo ""
  echo "[3/3] PM2 WELNO_BE 재시작 ..."
  pm2 restart WELNO_BE --update-env
  echo "  PM2 재시작 완료"
else
  echo ""
  echo "[3/3] PM2 재시작 생략 (--restart 옵션으로 활성화)"
fi

echo ""
echo "=== 배포 완료 ==="
