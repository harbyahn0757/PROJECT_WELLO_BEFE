# 쏙(Xog) 질병예측 리포트 시스템 통합 완료 보고서

## 작업 개요
**일시**: 2026-01-24  
**목적**: Todayon_marketing_Jerry 프로젝트의 질병예측 리포트 시스템을 PROJECT_WELLO_BEFE로 통합 이전  
**상태**: ✅ 기본 통합 완료 (테스트 필요)

---

## 완료된 작업

### 1. 데이터베이스 스키마 (✅ 완료)
**파일**: `backend/migrations/add_campaign_payments_table.sql`

**생성된 테이블**: `welno.tb_campaign_payments`

**주요 컬럼**:
- `oid`: 주문번호 (Primary Key)
- `uuid`: 파트너사 사용자 식별자
- `user_data`: 건강 데이터 (JSONB)
- `status`: 결제 상태 (READY/COMPLETED/FAILED)
- `report_url`: 리포트 PDF URL
- `email`: 사용자 이메일

**인덱스**: uuid, status, partner_id, email

**실행 결과**: ✅ 테이블 생성 완료

---

### 2. Backend 파일 복사 및 변환 (✅ 완료)

#### 복사된 파일:
| 원본 | 목표 | 상태 |
|------|------|------|
| `backend/utils/encryption_utils.py` | `backend/app/utils/partner_encryption.py` | ✅ |
| `backend/config/payment_config.py` | `backend/app/config/payment_config.py` | ✅ |
| `backend/services/campaigns/delivery_service.py` | `backend/app/services/campaigns/email_service.py` | ✅ |
| `backend/api/campaigns/disease_prediction_api.py` | `backend/app/api/v1/endpoints/campaign_payment.py` | ✅ FastAPI 변환 |

#### 주요 변경사항:
1. **Django → FastAPI 변환**:
   - `@csrf_exempt` → FastAPI 라우터
   - `JsonResponse` → `JSONResponse`
   - `HttpResponseRedirect` → `RedirectResponse`
   - `request.POST.get()` → `Form(...)`
   - 동기 → 비동기 함수

2. **데이터베이스 연결**:
   - `psycopg2` → `DatabaseManager` (WELLO 표준)
   - 스키마: `p9_mkt_biz` → `welno`

3. **리포트 생성**:
   - `send_twobecon_bodyage_request` → `generate_mediarc_report_async` (기존 Mediarc 서비스 재사용)

---

### 3. API 라우터 등록 (✅ 완료)

**파일**: `backend/app/main.py`

**추가된 라우터**:
```python
from .api.v1.endpoints import campaign_payment

app.include_router(
    campaign_payment.router,
    prefix="/api/v1/campaigns",
    tags=["campaigns"]
)
```

**등록된 API 엔드포인트**:
1. `POST /api/v1/campaigns/disease-prediction/init-payment/`
   - 결제 초기화
   - 주문번호 생성 및 서명 발급

2. `POST /api/v1/campaigns/disease-prediction/payment-callback/`
   - 이니시스 결제 콜백 수신
   - 최종 승인 처리

3. `POST /api/v1/campaigns/disease-prediction/update-email/`
   - 사후 이메일 등록 및 리포트 발송

---

### 4. Frontend 파일 복사 (✅ 완료)

#### 복사된 파일:
```
frontend/src/campaigns/disease-prediction/
├── index.tsx              (✅ 라우터)
├── LandingPage.tsx        (✅ 랜딩 페이지)
├── PaymentResult.tsx      (✅ 결제 결과 페이지)
├── styles/
│   └── landing.scss       (✅ 스타일시트)
└── assets/                (✅ 이미지 11개)
    ├── report_b_1.png
    ├── report_b_2.png
    ├── report_b_3.png
    ├── report_b_4.png
    ├── report_b_5.png
    ├── report_b_6.png
    ├── report_b_7-1.png
    ├── report_b_7.png
    ├── report_b_8.png
    ├── report_chart05.png
    └── result_sample.png
```

#### 라우팅 추가:
**파일**: `frontend/src/App.tsx`

```typescript
import DiseasePredictionCampaign from './campaigns/disease-prediction';

<Route 
    path="/campaigns/disease-prediction" 
    element={<DiseasePredictionCampaign />} 
/>
```

**접속 경로**:
- 로컬: `http://localhost:9283/welno/campaigns/disease-prediction`
- 운영: `https://xogxog.com/welno/campaigns/disease-prediction`

---

### 5. 환경변수 설정 (✅ 완료)

**파일**: `backend/.env`

**추가된 설정**:
```bash
# Campaign Payment (질병예측 리포트)
CAMPAIGN_PAYMENT_ENABLED=true

# KG 이니시스 설정
INICIS_MID=COCkkhabit
INICIS_HASH_KEY=3CB8183A4BE283555ACC8363C0360223

# 파트너 암호화 설정
PARTNER_AES_KEY=kindhabit_disease_predict_key_32
PARTNER_AES_IV=kindhabit_iv_16 

# 서비스 도메인
SERVICE_DOMAIN=https://xogxog.com
```

---

## 테스트 필요 사항

### 1. Backend API 테스트
```bash
# 서버 재시작 필요
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
pm2 restart Welno_BE

# API 테스트
curl -X POST http://localhost:8082/api/v1/campaigns/disease-prediction/init-payment/ \
  -H "Content-Type: application/json" \
  -d '{"uuid": "test-user-001", "name": "테스트", "email": "test@example.com"}'
```

### 2. Frontend 빌드 테스트
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend
npm run build
```

### 3. 암호화 테스트
```python
# Python으로 데이터 암호화 테스트
import base64
import json
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

key = b"kindhabit_disease_predict_key_32"
iv = b"kindhabit_iv_16 "  # 공백 포함!
cipher = AES.new(key, AES.MODE_CBC, iv)

data = {"name": "홍길동", "birth": "1990-01-01", "gender": "1"}
encrypted = cipher.encrypt(pad(json.dumps(data).encode('utf-8'), AES.block_size))
print(base64.b64encode(encrypted).decode('utf-8'))
```

### 4. 전체 플로우 테스트
1. **암호화된 URL 생성**:
   ```
   https://xogxog.com/welno/campaigns/disease-prediction/?data={ENCRYPTED_DATA}&uuid=test-001
   ```

2. **랜딩 페이지 접속 확인**

3. **결제 버튼 클릭** → 이니시스 테스트 결제창

4. **결제 완료** → 콜백 수신 확인

5. **리포트 생성 확인** → DB에 `report_url` 저장

6. **이메일 발송 확인**

---

## 남은 작업

### 1. Mediarc 리포트 S3 업로드 (⚠️ 추가 작업 필요)
**현재 상태**: Mediarc 서비스는 URL만 저장하고 S3 업로드는 미구현

**필요 작업**:
- `backend/app/services/mediarc/` 에 S3 업로드 로직 추가
- PDF 다운로드 후 S3 버킷에 저장
- `report_url`에 S3 URL 저장

**참고 코드**: Todayon의 `backend/services/twobecon_report_service.py` (155-186 라인)

### 2. SMTP 이메일 설정 확인
**파일**: `backend/.env`

**필요 설정**:
```bash
# Django 이메일 설정
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=쏙(Xog) <no-reply@kindhabit.com>
```

### 3. Nginx 설정 (운영 배포 시)
**파일**: `/etc/nginx/nginx.conf`

**추가 필요 설정**:
```nginx
# Campaign 페이지 라우팅
location /welno/campaigns/ {
    try_files $uri $uri/ /welno/index.html;
}

# Campaign API 프록시
location /api/v1/campaigns/ {
    proxy_pass http://127.0.0.1:8082;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. 로컬 테스트
1. Backend 서버 재시작
2. Frontend 빌드 및 확인
3. API 엔드포인트 테스트
4. 암호화/복호화 테스트

---

## 파일 구조 요약

```
PROJECT_WELLO_BEFE/planning-platform/
├── backend/
│   ├── migrations/
│   │   └── add_campaign_payments_table.sql  (✅ 신규)
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   └── campaign_payment.py          (✅ 신규)
│   │   ├── config/
│   │   │   └── payment_config.py            (✅ 신규)
│   │   ├── utils/
│   │   │   └── partner_encryption.py        (✅ 신규)
│   │   ├── services/
│   │   │   ├── campaigns/
│   │   │   │   └── email_service.py         (✅ 신규)
│   │   │   └── mediarc/                     (기존 재사용)
│   │   └── main.py                          (✅ 수정)
│   └── .env                                  (✅ 수정)
└── frontend/
    ├── src/
    │   ├── campaigns/
    │   │   └── disease-prediction/          (✅ 신규)
    │   │       ├── index.tsx
    │   │       ├── LandingPage.tsx
    │   │       ├── PaymentResult.tsx
    │   │       ├── styles/
    │   │       │   └── landing.scss
    │   │       └── assets/                  (11개 이미지)
    │   └── App.tsx                           (✅ 수정)
```

---

## 외부 파트너 연동 가이드

### 연동 URL 형식
```
https://xogxog.com/welno/campaigns/disease-prediction/?data={ENCRYPTED_JSON}&uuid={PARTNER_UUID}
```

### 암호화 규격
- **알고리즘**: AES-256-CBC
- **Key**: `kindhabit_disease_predict_key_32` (32 bytes)
- **IV**: `kindhabit_iv_16 ` (16 bytes, 공백 포함)
- **Padding**: PKCS7
- **Encoding**: Base64

### JSON 데이터 구조
```json
{
  "name": "홍길동",
  "birth": "1990-01-01",
  "gender": "1",
  "email": "user@example.com",
  "height": "175",
  "weight": "70",
  "waist": "85",
  "bphigh": "120",
  "bplwst": "80",
  "blds": "95",
  "totchole": "180",
  "triglyceride": "150",
  "hdlchole": "50",
  "ldlchole": "100"
}
```

---

## 다음 단계

1. **Backend 서버 재시작** 및 로그 확인
2. **Frontend 빌드** 및 라우팅 확인
3. **API 테스트** (Postman 또는 curl)
4. **암호화 테스트** (Python 스크립트)
5. **이메일 설정 확인** (SMTP)
6. **S3 업로드 구현** (Mediarc 서비스)
7. **통합 테스트** (End-to-End)
8. **운영 배포** (Nginx 설정)

---

**작성자**: AI Assistant  
**작성일**: 2026-01-24  
**참고 문서**: `/home/workspace/Todayon_marketing_Jerry/0_docs/disease_prediction_system_map.md`
