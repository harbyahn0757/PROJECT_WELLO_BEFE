#!/bin/bash
# welno 스키마 통합 마이그레이션 전 백업 스크립트
# 생성일: $(date +%Y-%m-%d)

DB_HOST="10.0.1.10"
DB_PORT="5432"
DB_NAME="p9_mkt_biz"
DB_USER="peernine"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "데이터베이스 백업 시작"
echo "=========================================="
echo "백업 시간: $(date)"
echo "백업 디렉토리: $BACKUP_DIR"
echo ""

# 전체 데이터베이스 백업
echo "📦 전체 데이터베이스 백업 중..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema=wello --schema=welno \
    -F c -f "$BACKUP_DIR/p9_mkt_biz_wello_welno_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    echo "✅ 백업 완료: $BACKUP_DIR/p9_mkt_biz_wello_welno_${TIMESTAMP}.dump"
else
    echo "❌ 백업 실패!"
    exit 1
fi

# SQL 형식 백업도 생성 (읽기 쉬움)
echo ""
echo "📄 SQL 형식 백업 생성 중..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema=wello --schema=welno \
    -f "$BACKUP_DIR/p9_mkt_biz_wello_welno_${TIMESTAMP}.sql"

if [ $? -eq 0 ]; then
    echo "✅ SQL 백업 완료: $BACKUP_DIR/p9_mkt_biz_wello_welno_${TIMESTAMP}.sql"
else
    echo "⚠️ SQL 백업 실패 (진행 계속)"
fi

echo ""
echo "=========================================="
echo "백업 완료"
echo "=========================================="
echo "백업 파일:"
ls -lh "$BACKUP_DIR"/*${TIMESTAMP}*
