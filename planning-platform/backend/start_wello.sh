#!/bin/bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
source venv/bin/activate

# 환경변수 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

exec python -u -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
