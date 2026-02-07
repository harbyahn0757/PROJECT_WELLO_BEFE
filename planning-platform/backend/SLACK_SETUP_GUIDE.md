# 슬랙 알림 시스템 설정 가이드

## 📋 개요

WELNO 질병예측 서비스의 결제 및 에러 이벤트를 슬랙으로 실시간 알림받는 시스템입니다.

## 🎯 알림 종류

### 결제 관련 알림
- **결제 시작**: 사용자가 결제 초기화 완료
- **결제 성공**: 결제 완료 후 리포트 생성 또는 틸코 인증 분기
- **결제 실패**: 결제 인증 실패 또는 승인 거절
- **결제 취소**: 망취소 성공/실패 (긴급 알림)
- **결제 이탈**: 약관 미동의, 중복 결제 시도 등

### 리포트 관련 알림
- **리포트 생성 성공**: 소요 시간, 데이터 소스 정보 포함
- **리포트 생성 실패**: 에러 메시지 및 실패 원인

### 시스템 에러 알림
- **API 에러**: 타임아웃, 네트워크 오류 등
- **시스템 에러**: DB 연결 실패, 예외 발생 등

## 🔧 설정 방법

### 1. 슬랙 웹훅 URL 생성

1. 슬랙 워크스페이스에서 **Apps** → **Incoming Webhooks** 검색
2. **Add to Slack** 클릭
3. 채널 선택: `#질병예측-알림` (또는 원하는 채널)
4. **Add Incoming WebHooks integration** 클릭
5. **Webhook URL** 복사 (예: `https://hooks.slack.com/services/T.../B.../...`)

### 2. 환경변수 설정

프로덕션 서버의 환경변수 파일에 추가:

```bash
# 슬랙 알림 설정
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
SLACK_CHANNEL_ID=C0ADYBAN9PA
```

### 3. 개발환경 테스트

```bash
# 환경변수 설정
export SLACK_ENABLED=true
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# 테스트 실행
cd /home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend
python test_slack_integration.py
```

## 📍 채널 ID 확인 방법

1. **슬랙 앱에서**:
   - 채널 클릭 → 우클릭 → "채널 세부정보 보기" → 맨 아래 "채널 ID" 복사

2. **브라우저에서**:
   - 채널 URL 확인: `https://app.slack.com/client/T.../C0ADYBAN9PA`
   - `C0ADYBAN9PA` 부분이 채널 ID

## 🚀 배포 및 적용

### PM2 재시작
```bash
pm2 restart WELNO_BE
```

### 로그 확인
```bash
# PM2 로그
pm2 logs WELNO_BE

# 슬랙 알림 로그
tail -f /data/wello_logs/slack_alerts/$(date +%Y-%m-%d)/slack_alerts_$(date +%Y-%m-%d).jsonl
```

## 📊 로그 저장 위치

### 구조화된 로그
```
/data/wello_logs/slack_alerts/
├── 2026-01-31/
│   └── slack_alerts_2026-01-31.jsonl
├── 2026-02-01/
│   └── slack_alerts_2026-02-01.jsonl
└── ...
```

### 기존 로그 (유지)
```
/data/wello_logs/
├── planning_20260131/          # 세션 로그
├── pm2/welno-be/              # PM2 로그
└── slack_alerts/              # 새로운 슬랙 로그
```

## 🔍 모니터링 및 디버깅

### 슬랙 알림 상태 확인
```bash
# 최근 슬랙 알림 로그 확인
tail -20 /data/wello_logs/slack_alerts/$(date +%Y-%m-%d)/slack_alerts_$(date +%Y-%m-%d).jsonl | jq .

# 에러 로그 필터링
grep "슬랙 알림 실패" /data/wello_logs/pm2/welno-be/error.log
```

### 알림 빈도 조절

과도한 알림을 방지하려면 `config.py`에서 설정 조정:

```python
# 개발환경에서는 비활성화
SLACK_ENABLED = Field(default=False if ENVIRONMENT == "development" else True, env="SLACK_ENABLED")
```

## 🚨 긴급 상황 대응

### 망취소 실패 알림
- **색상**: 빨간색 (danger)
- **내용**: TID, 금액 정보 포함
- **대응**: 수동으로 이니시스 관리자에서 취소 처리 필요

### API 타임아웃 알림
- **임계값**: 30초 초과
- **대응**: Mediarc API 상태 확인 및 타임아웃 설정 조정

### 시스템 에러 알림
- **내용**: 스택 트레이스 포함
- **대응**: 로그 확인 후 원인 분석 및 수정

## 📈 성능 고려사항

### 비동기 처리
- 슬랙 전송은 메인 로직을 블로킹하지 않음
- 전송 실패 시 로컬 로깅으로 폴백

### 에러 처리
- 슬랙 전송 실패 시에도 기존 로직은 정상 동작
- 모든 슬랙 관련 예외는 캐치되어 로그로만 기록

### 메시지 제한
- 슬랙 웹훅 API 제한: 1초당 1개 메시지
- 대량 알림 시 큐잉 또는 배치 처리 고려

## 🔒 보안 고려사항

### 웹훅 URL 보안
- 환경변수로만 관리, 코드에 하드코딩 금지
- 웹훅 URL 유출 시 즉시 재생성

### 민감정보 마스킹
- 사용자 UUID는 앞 8자리만 표시
- 결제 정보는 주문번호와 금액만 포함
- 개인정보는 슬랙으로 전송하지 않음

## 📞 문의 및 지원

- 슬랙 알림 관련 문의: 개발팀
- 슬랙 워크스페이스 관리: IT팀
- 긴급 상황: 온콜 담당자