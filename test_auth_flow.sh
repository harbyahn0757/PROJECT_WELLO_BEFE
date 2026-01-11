#!/bin/bash

echo "========================================"
echo "🧪 WELNO 인증 플로우 전체 테스트"
echo "========================================"
echo ""

# 테스트 데이터
USER_NAME="안광수"
PHONE_NO="01056180757"
BIRTHDATE="19810927"
PRIVATE_AUTH_TYPE="4"

echo "📋 테스트 정보:"
echo "  - 이름: $USER_NAME"
echo "  - 전화번호: $PHONE_NO"
echo "  - 생년월일: $BIRTHDATE"
echo "  - 인증방식: $PRIVATE_AUTH_TYPE (통신사Pass)"
echo ""

# 1단계: 세션 생성
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  세션 생성 (/session/start)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SESSION_RESPONSE=$(curl -s -X POST "http://localhost:8082/api/v1/tilko/session/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_name\": \"$USER_NAME\",
    \"phone_no\": \"$PHONE_NO\",
    \"birthdate\": \"$BIRTHDATE\",
    \"gender\": \"M\",
    \"private_auth_type\": \"$PRIVATE_AUTH_TYPE\"
  }")

echo "$SESSION_RESPONSE" | jq '.'

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  echo "❌ 세션 생성 실패"
  exit 1
fi

echo ""
echo "✅ 세션 생성 성공: $SESSION_ID"
echo ""
sleep 2

# 2단계: 인증 요청
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  인증 요청 (/session/simple-auth)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

AUTH_RESPONSE=$(curl -s -X POST "http://localhost:8082/api/v1/tilko/session/simple-auth?session_id=$SESSION_ID" \
  -H "Content-Type: application/json")

echo "$AUTH_RESPONSE" | jq '.'
echo ""
sleep 2

# Redis 세션 상태 확인 (인증 요청 후)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Redis 세션 상태 (인증 요청 후)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
python3 -c "
import redis
import json

redis_client = redis.from_url('redis://10.0.1.10:6379/0', decode_responses=True)
session_id = '$SESSION_ID'
session_key = f'tilko_session:{session_id}'

session_data = redis_client.get(session_key)
if session_data:
    data = json.loads(session_data)
    print(f'✅ 세션 상태: {data.get(\"status\")}')
    print(f'✅ 업데이트: {data.get(\"updated_at\")}')
    print(f'✅ Progress: {data.get(\"progress\")}')
    print(f'✅ TTL: {redis_client.ttl(session_key)}초')
else:
    print('❌ 세션 없음')
"

echo ""
echo "⏳ 모바일에서 인증을 완료하세요..."
echo "   완료 후 Enter를 누르세요"
read -p ""

# 3단계: 수동 인증 완료
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  인증 완료 확인 (/manual-auth-complete)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

COMPLETE_RESPONSE=$(curl -s -X POST "http://localhost:8082/api/v1/tilko/session/$SESSION_ID/manual-auth-complete" \
  -H "Content-Type: application/json")

echo "$COMPLETE_RESPONSE" | jq '.'
echo ""
sleep 2

# Redis 세션 상태 확인 (인증 완료 후)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Redis 세션 상태 (인증 완료 후)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

python3 -c "
import redis
import json

redis_client = redis.from_url('redis://10.0.1.10:6379/0', decode_responses=True)
session_id = '$SESSION_ID'
session_key = f'tilko_session:{session_id}'

session_data = redis_client.get(session_key)
if session_data:
    data = json.loads(session_data)
    print(f'✅ 세션 상태: {data.get(\"status\")}')
    print(f'✅ 업데이트: {data.get(\"updated_at\")}')
    print(f'✅ Progress: {data.get(\"progress\")}')
    print(f'✅ auth_data 존재: {\"auth_data\" in data and data[\"auth_data\"] is not None}')
else:
    print('❌ 세션 없음')
"

echo ""

# 세션 상태 확인 (auth_completed인지)
STATUS_CHECK=$(python3 -c "
import redis
import json

redis_client = redis.from_url('redis://10.0.1.10:6379/0', decode_responses=True)
session_id = '$SESSION_ID'
session_key = f'tilko_session:{session_id}'

session_data = redis_client.get(session_key)
if session_data:
    data = json.loads(session_data)
    print(data.get('status'))
else:
    print('ERROR')
")

if [ "$STATUS_CHECK" != "auth_completed" ]; then
  echo "❌ 인증 완료 상태로 변경되지 않음: $STATUS_CHECK"
  echo "   테스트 실패!"
  exit 1
fi

echo "✅ 인증 완료 상태 확인됨"
echo ""
sleep 2

# 4단계: 건강정보 수집
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  건강정보 수집 (/collect-health-data)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

COLLECT_RESPONSE=$(curl -s -X POST "http://localhost:8082/api/v1/tilko/session/$SESSION_ID/collect-health-data" \
  -H "Content-Type: application/json")

echo "$COLLECT_RESPONSE" | jq '.'
echo ""

# 수집 시작 확인
COLLECT_SUCCESS=$(echo "$COLLECT_RESPONSE" | jq -r '.success')

if [ "$COLLECT_SUCCESS" = "true" ]; then
  echo "✅ 건강정보 수집 시작됨"
else:
  echo "❌ 건강정보 수집 실패"
  exit 1
fi

echo ""
echo "⏳ 건강정보 수집 중... (10초 대기)"
sleep 10

# 5단계: 최종 세션 상태 확인
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  최종 세션 상태 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FINAL_STATUS=$(curl -s "http://localhost:8082/api/v1/tilko/session/$SESSION_ID/status")

echo "$FINAL_STATUS" | jq '.'
echo ""

python3 -c "
import redis
import json

redis_client = redis.from_url('redis://10.0.1.10:6379/0', decode_responses=True)
session_id = '$SESSION_ID'
session_key = f'tilko_session:{session_id}'

session_data = redis_client.get(session_key)
if session_data:
    data = json.loads(session_data)
    print('✅ 최종 세션 상태:')
    print(f'   - Status: {data.get(\"status\")}')
    print(f'   - Progress: {data.get(\"progress\")}')
    print(f'   - Health Data: {\"health_data\" in data and data[\"health_data\"] is not None}')
    print(f'   - Updated: {data.get(\"updated_at\")}')
else:
    print('❌ 세션 없음')
"

echo ""
echo "========================================"
echo "✅ 전체 플로우 테스트 완료"
echo "========================================"
