# 슬랙 알림 시스템 배포 체크리스트

## ✅ 배포 전 확인사항

### 1. 코드 검증
- [x] SlackService 클래스 구현 완료
- [x] StructuredLogger 구현 완료  
- [x] InfraErrorLogBuilder 구현 완료
- [x] 결제 관련 알림 추가 완료
- [x] 리포트 관련 알림 추가 완료
- [x] API 에러 알림 추가 완료
- [x] 환경 설정 업데이트 완료
- [x] 구문 검사 통과

### 2. 환경변수 설정 (프로덕션)
- [ ] `SLACK_ENABLED=true` 설정
- [ ] `SLACK_WEBHOOK_URL` 설정 (슬랙에서 생성)
- [ ] `SLACK_CHANNEL_ID=C0ADYBAN9PA` 설정

### 3. 디렉토리 권한 확인
- [ ] `/data/wello_logs/slack_alerts/` 디렉토리 생성 권한
- [ ] 로그 파일 쓰기 권한

## 🚀 배포 단계

### 1단계: 환경변수 설정
```bash
# 프로덕션 서버에서
export SLACK_ENABLED=true
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."
export SLACK_CHANNEL_ID="C0ADYBAN9PA"
```

### 2단계: 백엔드 재시작
```bash
cd /home/workspace/PROJECT_WELNO_BEFE
pm2 restart WELNO_BE
```

### 3단계: 서비스 상태 확인
```bash
pm2 status
pm2 logs WELNO_BE --lines 50
```

### 4단계: 테스트 실행 (선택적)
```bash
cd /home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend
python test_slack_integration.py
```

## 🔍 배포 후 검증

### 1. 로그 확인
```bash
# PM2 로그에서 슬랙 관련 메시지 확인
pm2 logs WELNO_BE | grep -i slack

# 슬랙 알림 로그 디렉토리 확인
ls -la /data/wello_logs/slack_alerts/
```

### 2. 실제 결제 테스트
- 개발환경에서 결제 플로우 테스트
- 슬랙 채널에서 알림 수신 확인

### 3. 에러 시뮬레이션
- API 타임아웃 상황 시뮬레이션
- 에러 알림 정상 동작 확인

## 📊 모니터링 포인트

### 결제 관련 알림
- [x] 결제 시작 알림
- [x] 결제 성공 알림 (리포트생성/틸코인증 분기)
- [x] 결제 실패 알림
- [x] 결제 이탈 알림 (중복결제 등)
- [x] 망취소 성공/실패 알림

### 리포트 관련 알림
- [x] 리포트 생성 성공 알림
- [x] 리포트 생성 실패 알림

### 시스템 에러 알림
- [x] API 타임아웃 알림
- [x] 네트워크 에러 알림

## 🚨 롤백 계획

문제 발생 시 롤백 방법:

### 1. 슬랙 알림만 비활성화
```bash
export SLACK_ENABLED=false
pm2 restart WELNO_BE
```

### 2. 코드 롤백 (긴급시)
```bash
git checkout HEAD~1  # 이전 커밋으로 롤백
pm2 restart WELNO_BE
```

## 📈 성능 영향 분석

### 예상 성능 영향
- **메모리**: 슬랙 서비스 인스턴스 추가 (~1MB)
- **네트워크**: 알림당 1개 HTTP 요청 (비동기)
- **응답시간**: 메인 로직에 영향 없음 (비동기 처리)

### 부하 테스트 권장사항
- 동시 결제 100건 처리 시 슬랙 알림 성능 측정
- 슬랙 API 제한 (1초당 1개 메시지) 고려

## 🔧 트러블슈팅

### 자주 발생하는 문제

1. **슬랙 웹훅 URL 오류**
   - 증상: `슬랙 메시지 전송 실패: 404`
   - 해결: 웹훅 URL 재확인 및 재생성

2. **채널 권한 문제**
   - 증상: `슬랙 메시지 전송 실패: 403`
   - 해결: 봇이 채널에 초대되었는지 확인

3. **네트워크 타임아웃**
   - 증상: `슬랙 메시지 전송 타임아웃`
   - 해결: 방화벽 설정 확인, 타임아웃 값 조정

4. **로그 디렉토리 권한**
   - 증상: `로그 파일 저장 실패`
   - 해결: `/data/wello_logs/slack_alerts/` 디렉토리 권한 확인

## 📞 긴급 연락처

- **개발팀**: 슬랙 알림 시스템 관련
- **인프라팀**: 서버 및 네트워크 관련
- **온콜 담당자**: 긴급 상황 시

---

**배포 담당자 서명**: ________________  
**배포 일시**: ________________  
**검토자 서명**: ________________