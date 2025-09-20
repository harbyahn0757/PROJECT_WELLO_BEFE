#!/bin/bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
source venv/bin/activate
exec uvicorn complete_api_server:app --host 0.0.0.0 --port 8082 --workers 2
