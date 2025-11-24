#!/bin/bash

# WELLO 프론트엔드 빌드 및 배포 스크립트
# 사용법: ./deploy.sh

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
BACKEND_DIR="${SCRIPT_DIR}/backend"
STATIC_DIR="${BACKEND_DIR}/static"
BUILD_DIR="${FRONTEND_DIR}/build"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}WELLO 프론트엔드 빌드 및 배포${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 프론트엔드 디렉토리 확인
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ 프론트엔드 디렉토리를 찾을 수 없습니다: $FRONTEND_DIR${NC}"
    exit 1
fi

# 2. 백엔드 static 디렉토리 확인
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ 백엔드 디렉토리를 찾을 수 없습니다: $BACKEND_DIR${NC}"
    exit 1
fi

# 3. 이전 빌드 백업 (선택사항)
if [ -d "$BUILD_DIR" ]; then
    echo -e "${YELLOW}📦 이전 빌드 디렉토리 확인: $BUILD_DIR${NC}"
fi

# 4. 빌드 실행
echo -e "${GREEN}🔨 빌드 시작...${NC}"
cd "$FRONTEND_DIR"

# npm install 확인 (필요시)
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 node_modules가 없습니다. npm install 실행...${NC}"
    npm install
fi

# 빌드 실행
echo -e "${GREEN}⚙️  npm run build 실행 중...${NC}"
npm run build

# 빌드 성공 확인
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ 빌드 실패: build 디렉토리가 생성되지 않았습니다.${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}❌ 빌드 실패: index.html이 생성되지 않았습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 빌드 완료${NC}"
echo ""

# 5. 배포 디렉토리 준비
echo -e "${GREEN}📂 배포 디렉토리 준비...${NC}"

# static 디렉토리 백업 (선택사항)
if [ -d "$STATIC_DIR" ] && [ "$(ls -A $STATIC_DIR)" ]; then
    BACKUP_DIR="${STATIC_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}💾 기존 static 디렉토리 백업: $BACKUP_DIR${NC}"
    cp -r "$STATIC_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✅ 백업 완료${NC}"
fi

# 기존 static 디렉토리 내용 삭제 (안전하게)
if [ -d "$STATIC_DIR" ]; then
    echo -e "${YELLOW}🗑️  기존 static 디렉토리 정리...${NC}"
    rm -rf "${STATIC_DIR}"/*
    rm -rf "${STATIC_DIR}"/.[!.]* 2>/dev/null || true  # 숨김 파일도 삭제 (에러 무시)
fi

# 6. 빌드 파일 복사
echo -e "${GREEN}📋 빌드 파일 복사 중...${NC}"
cp -r "$BUILD_DIR"/* "$STATIC_DIR/"

# 복사 확인
if [ ! -f "$STATIC_DIR/index.html" ]; then
    echo -e "${RED}❌ 배포 실패: index.html이 복사되지 않았습니다.${NC}"
    exit 1
fi

# 7. 배포된 파일 정보 출력
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 배포 완료${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}📊 배포 정보:${NC}"
echo "  - 배포 위치: $STATIC_DIR"
echo "  - index.html: $(ls -lh "$STATIC_DIR/index.html" | awk '{print $5, $6, $7, $8}')"

# main.js 파일 확인
MAIN_JS=$(ls "$STATIC_DIR/static/js/main."*.js 2>/dev/null | head -1)
if [ -n "$MAIN_JS" ]; then
    MAIN_JS_NAME=$(basename "$MAIN_JS")
    MAIN_JS_SIZE=$(ls -lh "$MAIN_JS" | awk '{print $5}')
    echo "  - main.js: $MAIN_JS_NAME ($MAIN_JS_SIZE)"
fi

echo ""
echo -e "${GREEN}🎉 배포가 성공적으로 완료되었습니다!${NC}"
echo ""

