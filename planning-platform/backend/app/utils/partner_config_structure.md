# 파트너 설정 함수 구조 문서

## 계층 구조

```
app/utils/partner_config.py (메인 레이어)
├── get_partner_config(partner_id, conn=None) - 기본 조회
├── get_partner_config_by_api_key(api_key, conn=None) - API Key 조회
├── get_partner_encryption_keys(partner_id, conn=None) - 암호화 키
├── requires_payment(partner_id, conn=None) - 결제 필요 여부
├── get_payment_amount(partner_id, conn=None) - 결제 금액
├── get_payment_mid(partner_id, conn=None) - 결제 MID ✅ 신규
├── get_payment_hash_key(partner_id, conn=None) - 결제 Hash Key ✅ 신규
├── get_payment_iniapi_key(partner_id, conn=None) - INIAPI 키 ✅ 신규
├── get_payment_iniapi_iv(partner_id, conn=None) - INIAPI IV ✅ 신규
├── is_iframe_allowed(partner_id, conn=None) - iframe 허용
└── get_public_partner_config(partner_id, conn=None) - 공개 설정

app/services/dynamic_config_service.py (비동기 레이어)
├── get_default_hospital_id(partner_id) - 비동기 병원 ID
├── get_mediarc_config(partner_id) - 비동기 Mediarc 설정
├── get_hospital_config(partner_id, hospital_id) - 비동기 병원 설정
└── get_partner_by_api_key(api_key) - 동기 파트너 ID (내부 호출)

app/utils/partner_utils.py (유틸리티 레이어)
└── identify_partner(api_key, partner_id) - 파트너 식별 헬퍼
```

## 함수별 역할

### 1. 기본 조회 함수
- `get_partner_config()`: 모든 파트너 설정 조회의 기본 함수
- `get_partner_config_by_api_key()`: API Key로 파트너 식별 및 설정 조회

### 2. 특화 조회 함수
- `get_partner_encryption_keys()`: 암호화 키 조회 (AES Key, IV)
- `requires_payment()`: 결제 필요 여부 확인
- `get_payment_amount()`: 결제 금액 조회
- `get_payment_mid()`: 결제 MID 조회 ✅ 신규 추가
- `get_payment_hash_key()`: 결제 해시키 조회 ✅ 신규 추가
- `get_payment_iniapi_key()`: INIAPI 키 조회 ✅ 신규 추가
- `get_payment_iniapi_iv()`: INIAPI IV 조회 ✅ 신규 추가
- `is_iframe_allowed()`: iframe 허용 여부 확인
- `get_public_partner_config()`: 공개 설정 조회

### 3. 비동기 함수 (dynamic_config_service.py)
- `get_default_hospital_id()`: 파트너별 기본 병원 ID
- `get_mediarc_config()`: Mediarc API 설정
- `get_hospital_config()`: 병원별 RAG 설정

## 호출 패턴

### 올바른 호출 패턴 ✅
```python
# 직접 호출
from app.utils.partner_config import get_payment_mid, get_payment_hash_key
mid = get_payment_mid('kindhabit')
hash_key = get_payment_hash_key('kindhabit')

# 비동기 호출
from app.services.dynamic_config_service import DynamicConfigService
hospital_id = await DynamicConfigService.get_default_hospital_id('kindhabit')
```

### 잘못된 호출 패턴 ❌
```python
# 직접 SQL 조회 (지양)
cur.execute("SELECT config FROM tb_partner_config WHERE partner_id = %s", (partner_id,))

# 하드코딩 사용 (제거됨)
from app.core.payment_config import INICIS_MOBILE_MID  # ❌ 제거됨
```

## 의존성 관계

```
campaign_payment.py
├── get_payment_mid() ✅
├── get_payment_hash_key() ✅
├── get_payment_amount() ✅
└── get_partner_encryption_keys() ✅

disease_report_unified.py
├── get_payment_amount() ✅
├── get_partner_config() ✅
└── get_partner_config_by_api_key() ✅

partner_rag_chat.py
├── get_partner_encryption_keys() ✅
└── get_partner_config_by_api_key() ✅

welno_data_service.py
└── requires_payment() ✅
```

## 개선 완료 사항

### ✅ 완료된 개선사항
1. **결제 키 통합**: MID, 해시키, INIAPI 키를 DB에서 조회
2. **암호화 키 통합**: 하드코딩 제거, 파트너별 키 필수화
3. **중복 함수 제거**: `partner_utils.requires_payment()`, `disease_report_unified.get_payment_amount()` 제거
4. **함수 추가**: 결제 관련 4개 신규 함수 추가

### 🔄 진행 중인 개선사항
1. **외래키 제약조건**: 참조 무결성 보장
2. **파트너 ID 통일**: welno vs welno_internal 불일치 해결
3. **종합 테스트**: 전체 시스템 검증

## 사용 가이드

### 새로운 파트너 설정 조회 함수 사용법

```python
# 결제 관련 설정 조회
from app.utils.partner_config import (
    get_payment_mid,
    get_payment_hash_key, 
    get_payment_iniapi_key,
    get_payment_iniapi_iv,
    get_payment_amount
)

partner_id = 'kindhabit'

# 결제 키 조회
mid = get_payment_mid(partner_id)           # 'COCkkhabit'
hash_key = get_payment_hash_key(partner_id) # '3CB8183A4BE283555ACC8363C0360223'
amount = get_payment_amount(partner_id)      # 7900

# 암호화 키 조회
from app.utils.partner_config import get_partner_encryption_keys
aes_key, aes_iv = get_partner_encryption_keys(partner_id)
```

### 암호화 함수 사용법

```python
from app.utils.partner_encryption import encrypt_user_data, decrypt_user_data
from app.utils.partner_config import get_partner_encryption_keys

# 파트너별 암호화
partner_id = 'kindhabit'
aes_key, aes_iv = get_partner_encryption_keys(partner_id)

# 암호화
data = {"name": "홍길동", "age": 30}
encrypted = encrypt_user_data(data, aes_key, aes_iv)

# 복호화
decrypted = decrypt_user_data(encrypted, aes_key, aes_iv)
```

## 아키텍처 장점

1. **단일 진실 공급원**: 모든 설정이 `tb_partner_config`에 중앙화
2. **계층화된 구조**: 동기/비동기 레이어 분리
3. **타입 안전성**: 각 함수가 명확한 반환 타입 보장
4. **확장성**: 새 파트너 추가 시 코드 변경 없이 DB 설정만 추가
5. **캐싱 지원**: `dynamic_config_service`에서 Redis 캐싱 지원
6. **오류 처리**: 파트너 설정 없을 때 안전한 기본값 제공