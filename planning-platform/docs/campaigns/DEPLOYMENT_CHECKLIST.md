# 질병예측 리포트 시스템 배포 체크리스트

## ✅ 완료된 작업

### 1. 데이터베이스
- [x] `welno.tb_campaign_payments` 테이블 생성
- [x] 인덱스 생성 (uuid, status, partner_id)
- [x] 트리거 함수 (updated_at 자동 업데이트)

### 2. Backend
- [x] 암호화 유틸리티 복사 (`partner_encryption.py`)
- [x] 결제 설정 복사 (`payment_config.py`)
- [x] 이메일 서비스 복사 (`email_service.py`)
- [x] 결제 API 구현 (`campaign_payment.py`)
- [x] FastAPI 라우터 등록 (`main.py`)
- [x] 환경변수 설정 (`.env`)

### 3. Frontend
- [x] 캠페인 페이지 복사 (`disease-prediction/`)
- [x] 라우팅 추가 (`App.tsx`)
- [x] 이미지 리소스 복사 (11개)
- [x] 스타일시트 복사 (`landing.scss`)

### 4. 문서화
- [x] 통합 완료 보고서 작성
- [x] 테스트 스크립트 작성
- [x] 배포 체크리스트 작성

---

## 🔧 배포 전 확인사항

### 1. Backend 서버 재시작
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
pm2 restart Welno_BE
pm2 logs Welno_BE --lines 50
```

**확인사항**:
- [ ] 서버 정상 시작
- [ ] 에러 로그 없음
- [ ] Campaign API 라우터 등록 확인

### 2. Frontend 빌드
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend
npm run build
```

**확인사항**:
- [ ] 빌드 성공
- [ ] `build/` 폴더 생성
- [ ] 경고 없음

### 3. API 테스트
```bash
# 결제 초기화 API 테스트
curl -X POST http://localhost:8082/api/v1/campaigns/disease-prediction/init-payment/ \
  -H "Content-Type: application/json" \
  -d '{"uuid": "test-001", "name": "테스트", "email": "test@example.com"}'
```

**확인사항**:
- [ ] 200 응답
- [ ] `success: true` 응답
- [ ] `P_OID`, `P_CHKFAKE` 등 반환

### 4. 데이터베이스 확인
```sql
-- 테이블 조회
SELECT * FROM welno.tb_campaign_payments LIMIT 5;

-- 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'tb_campaign_payments';
```

**확인사항**:
- [ ] 테이블 존재
- [ ] 인덱스 5개 생성
- [ ] 테스트 데이터 삽입/조회 가능

### 5. 암호화 테스트
```python
# Python 테스트
python3 /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/test_campaign_payment.py
```

**확인사항**:
- [ ] 암호화/복호화 성공
- [ ] API 호출 성공
- [ ] 샘플 URL 생성

---

## 🌐 Nginx 설정 (운영 배포 시)

### 1. 설정 파일 수정
```bash
sudo vi /etc/nginx/nginx.conf
```

### 2. 추가 설정
```nginx
# Campaign 페이지 라우팅
location /welno/campaigns/ {
    try_files $uri $uri/ /welno/index.html;
}

# Campaign API 프록시 (이미 /api/v1/ 프록시가 있다면 생략 가능)
location /api/v1/campaigns/ {
    proxy_pass http://127.0.0.1:8082;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 3. Nginx 재시작
```bash
sudo nginx -t  # 설정 테스트
sudo systemctl restart nginx
```

**확인사항**:
- [ ] Nginx 설정 테스트 통과
- [ ] Nginx 재시작 성공
- [ ] 에러 로그 없음

---

## 🧪 통합 테스트

### 1. 로컬 테스트
```bash
# 1. Backend 실행 확인
curl http://localhost:8082/api/v1/health

# 2. Frontend 접속
http://localhost:9283/welno/campaigns/disease-prediction/?uuid=test-001

# 3. 암호화된 데이터로 테스트
# (test_campaign_payment.py 스크립트에서 생성된 URL 사용)
```

### 2. 운영 테스트 (배포 후)
```bash
# 1. API 엔드포인트 확인
curl https://xogxog.com/api/v1/campaigns/disease-prediction/init-payment/

# 2. 캠페인 페이지 접속
https://xogxog.com/welno/campaigns/disease-prediction/
```

### 3. 결제 플로우 테스트
1. **암호화된 URL로 접속**
2. **랜딩 페이지 확인**
3. **결제 버튼 클릭** → 이니시스 테스트 결제창
4. **테스트 결제 진행** (이니시스 테스트 계정)
5. **결제 결과 페이지** 확인
6. **이메일 입력** 및 발송 요청
7. **DB 확인**: `SELECT * FROM welno.tb_campaign_payments WHERE uuid='test-001'`

---

## ⚠️ 주의사항

### 1. 보안 설정
- [ ] `.env` 파일이 Git에 커밋되지 않도록 확인
- [ ] 이니시스 Hash Key 노출 방지
- [ ] 파트너 AES Key 노출 방지

### 2. 이메일 설정
- [ ] SMTP 설정 확인 (`.env`)
- [ ] 발신 이메일 주소 설정
- [ ] 이메일 템플릿 확인

### 3. Mediarc (리포트 생성)
- [ ] Mediarc API 키 확인
- [ ] S3 업로드 기능 (추가 구현 필요)
- [ ] 리포트 URL 저장 확인

### 4. 결제 설정
- [ ] 이니시스 MID 확인 (실제: `COCkkhabit`, 테스트: `INIpayTest`)
- [ ] 결제 금액 확인 (7,900원)
- [ ] 콜백 URL 확인 (`SERVICE_DOMAIN`)

---

## 📝 배포 순서

### Phase 1: 로컬 테스트
1. Backend 재시작
2. Frontend 빌드
3. API 테스트
4. 암호화 테스트
5. 로컬 브라우저 테스트

### Phase 2: 스테이징 배포 (선택)
1. 스테이징 서버에 배포
2. 스테이징 DB 마이그레이션
3. 스테이징 Nginx 설정
4. 통합 테스트

### Phase 3: 운영 배포
1. 운영 DB 마이그레이션 (백업 필수!)
2. 운영 서버 코드 배포
3. Nginx 설정 적용
4. Backend 재시작
5. Frontend 빌드 및 배포
6. 통합 테스트
7. 모니터링 시작

---

## 🔍 모니터링

### 1. 로그 확인
```bash
# Backend 로그
pm2 logs Welno_BE --lines 100

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. 데이터베이스 모니터링
```sql
-- 결제 현황
SELECT status, COUNT(*) 
FROM welno.tb_campaign_payments 
GROUP BY status;

-- 최근 주문
SELECT oid, uuid, user_name, status, created_at
FROM welno.tb_campaign_payments
ORDER BY created_at DESC
LIMIT 10;

-- 에러 발생 주문
SELECT * 
FROM welno.tb_campaign_payments
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

### 3. 알림 설정
- [ ] 결제 실패 알림
- [ ] API 에러 알림
- [ ] 리포트 생성 실패 알림

---

## 📞 문의 및 지원

**기술 문의**: kkakkung3334@gmail.com  
**문서 위치**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/docs/campaigns/`

---

**최종 업데이트**: 2026-01-24  
**작성자**: AI Assistant
