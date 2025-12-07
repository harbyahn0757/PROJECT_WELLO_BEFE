# mdx_agr_list ↔ wello 스키마 양방향 동기화 서비스 점검 보고서

## 1. 현재 상황 분석

### 1.1 테이블 구조 비교

#### mdx_agr_list (p9_mkt_biz 스키마)
- **환자 식별 필드**:
  - `phoneno` (text) - 전화번호
  - `name` (text) - 이름
  - `birthday` (date) - 생년월일
  - `gender` (character) - 성별 (M/F)
  - `hosnm` (text) - 병원명
  - `uuid` (uuid) - 환자 UUID (nullable)

- **검진 데이터 필드**:
  - `height` (text) - 신장
  - `weight` (text) - 체중
  - `waist` (numeric) - 허리둘레
  - `bmi` (numeric) - 체질량지수
  - `bphigh` (numeric) - 수축기 혈압
  - `bplwst` (numeric) - 이완기 혈압
  - `totchole` (numeric) - 총콜레스테롤
  - `hdlchole` (numeric) - HDL 콜레스테롤
  - `ldlchole` (numeric) - LDL 콜레스테롤
  - `triglyceride` (numeric) - 중성지방
  - `blds` (numeric) - 공복혈당

#### wello.wello_patients (wello 스키마)
- **환자 식별 필드**:
  - `uuid` (varchar) - 환자 UUID
  - `hospital_id` (varchar) - 병원 ID
  - `name` (varchar) - 이름
  - `phone_number` (varchar) - 전화번호
  - `birth_date` (date) - 생년월일
  - `gender` (char) - 성별 (M/F)

#### wello.wello_checkup_data (wello 스키마)
- **환자 식별 필드**:
  - `patient_uuid` (varchar) - 환자 UUID
  - `hospital_id` (varchar) - 병원 ID

- **검진 데이터 필드**:
  - `height` (decimal) - 신장 (cm)
  - `weight` (decimal) - 체중 (kg)
  - `bmi` (decimal) - 체질량지수
  - `waist_circumference` (decimal) - 허리둘레 (cm)
  - `blood_pressure_high` (integer) - 수축기 혈압 (mmHg)
  - `blood_pressure_low` (integer) - 이완기 혈압 (mmHg)
  - `cholesterol` (integer) - 총콜레스테롤 (mg/dL)
  - `hdl_cholesterol` (integer) - HDL 콜레스테롤 (mg/dL)
  - `ldl_cholesterol` (integer) - LDL 콜레스테롤 (mg/dL)
  - `triglyceride` (integer) - 중성지방 (mg/dL)
  - `blood_sugar` (integer) - 공복혈당 (mg/dL)
  - `raw_data` (jsonb) - Tilko API 원본 데이터

### 1.2 필드 매핑 관계

#### 환자 매칭 키
```
mdx_agr_list                    →  wello.wello_patients
─────────────────────────────────────────────────────
phoneno                         →  phone_number
name                            →  name
birthday                        →  birth_date
gender                          →  gender
hosnm                           →  hospital_id
uuid (년도별 생성, 다중 가능)    →  uuid (단일, 필수)

⚠️ 주의: mdx의 uuid는 년도별로 생성되므로 매칭 키로 사용 불가
매칭 키: (phoneno, birthday, name) 3개 조합 사용
```

#### 검진 데이터 매핑
```
mdx_agr_list                    →  wello.wello_checkup_data
────────────────────────────────────────────────────────────
height (text)                   →  height (decimal) - 변환 필요
weight (text)                   →  weight (decimal) - 변환 필요
waist (numeric)                 →  waist_circumference (decimal)
bmi (numeric)                    →  bmi (decimal)
bphigh (numeric)                 →  blood_pressure_high (integer)
bplwst (numeric)                 →  blood_pressure_low (integer)
totchole (numeric)               →  cholesterol (integer)
hdlchole (numeric)               →  hdl_cholesterol (integer)
ldlchole (numeric)               →  ldl_cholesterol (integer)
triglyceride (numeric)           →  triglyceride (integer)
blds (numeric)                   →  blood_sugar (integer)
```

### 1.3 데이터 타입 변환 필요사항

1. **height, weight**: mdx_agr_list는 `text` 타입, wello는 `decimal` 타입
   - 변환 로직: `CAST(height AS DECIMAL)` 또는 `NULLIF(height, '')::DECIMAL`
   
2. **날짜 형식**: 동일하게 `date` 타입이므로 직접 매핑 가능

3. **숫자 필드**: mdx_agr_list는 `numeric`, wello는 `integer` 또는 `decimal`
   - 정수 필드: `CAST(numeric AS INTEGER)`
   - 소수 필드: `CAST(numeric AS DECIMAL)`

## 2. 동기화 전략

### 2.1 동기화 방향

#### 방향 1: mdx_agr_list → wello (검진 데이터 수집)
- **목적**: mdx_agr_list에 있는 검진 데이터를 wello 스키마로 가져오기
- **시나리오**: 
  - wello에 환자 데이터가 없거나 검진 데이터가 부족할 때
  - mdx_agr_list에 최신 검진 데이터가 있을 때

#### 방향 2: wello → mdx_agr_list (검진 데이터 업데이트)
- **목적**: wello에서 Tilko API로 수집한 검진 데이터를 mdx_agr_list에 반영
- **시나리오**:
  - wello에서 새로운 검진 데이터를 수집했을 때
  - mdx_agr_list의 검진 데이터가 오래되었을 때

### 2.2 환자 매칭 로직

```python
# wello → mdx 조회
(phoneno, birthday, name) 3개 조합으로 조회
→ 여러 년도 데이터가 있을 수 있으므로 리스트 반환

# mdx → wello 조회  
(phone_number, birth_date, name) 3개 조합으로 조회
→ 단일 환자 레코드 반환 (없으면 새로 생성)
```

### 2.3 데이터 충돌 해결 전략

- **최신 데이터 우선**: `regdate` 또는 `visitdate` 기준으로 최신 데이터 우선
- **데이터 소스 표시**: 어느 쪽에서 온 데이터인지 메타데이터로 표시
- **수동 검토**: 충돌 발생 시 수동 검토 플래그 설정

## 3. 사용자(환자) 매칭 키 결정

### 3.1 중요한 제약사항

**mdx_agr_list의 UUID 특성:**
- ⚠️ **UUID는 년도별로 생성됨**
- 같은 사람이라도 다년간 데이터가 있으면 여러 개의 UUID를 가짐
- 예: 2021년 UUID, 2022년 UUID, 2023년 UUID 등
- 따라서 **UUID로는 단일 환자 조회가 불가능**

**데이터 분석 결과:**
- 총 레코드: 300,901건
- 고유 전화번호(phoneno): 274,386건
- 고유 조합 (phoneno, name, birthday, hosnm): 281,838건
- 중복 전화번호: 25,280건

**wello.wello_patients 현황:**
- 총 환자: 5건 (현재)
- 모든 환자에 UUID 필수 (단일 UUID)

### 3.2 사용자 매칭 키 최종 결정

#### wello → mdx 조회 시 (추천) ⭐
```
(phoneno, birthday, name) 3개 조합으로 조회
```

**이유:**
- UUID는 년도별로 다르므로 사용 불가
- 전화번호 + 생년월일 + 이름 조합이 가장 정확
- hosnm(병원명)은 제외 (같은 사람이 여러 병원에서 검진 가능)

#### mdx → wello 조회 시
```
1순위: (phone_number, birth_date, name) 3개 조합으로 매칭
2순위: 매칭 실패 시 새 환자 생성 (wello에만)
```

### 3.3 매칭 쿼리 예시

**wello → mdx 조회:**
```sql
-- wello에서 mdx로 조회할 때
SELECT * FROM p9_mkt_biz.mdx_agr_list 
WHERE phoneno = $1 
  AND birthday = $2 
  AND name = $3
ORDER BY regdate DESC, visitdate DESC;
-- 여러 년도 데이터가 있을 수 있으므로 최신순 정렬
```

**mdx → wello 조회:**
```sql
-- mdx에서 wello로 조회할 때
SELECT * FROM wello.wello_patients 
WHERE phone_number = $1 
  AND birth_date = $2 
  AND name = $3;
-- wello는 단일 환자 레코드만 존재
```

### 3.4 매칭 로직 구현

```python
# wello → mdx 조회
async def get_mdx_patients_by_combo(
    phoneno: str,
    birthday: date,
    name: str
) -> List[Dict[str, Any]]:
    """전화번호, 생년월일, 이름으로 mdx 환자 조회 (여러 년도 가능)"""
    query = """
        SELECT * FROM p9_mkt_biz.mdx_agr_list 
        WHERE phoneno = $1 
          AND birthday = $2 
          AND name = $3
        ORDER BY regdate DESC, visitdate DESC NULLS LAST
    """
    return await conn.fetch(query, phoneno, birthday, name)

# mdx → wello 조회
async def get_wello_patient_by_combo(
    phone_number: str,
    birth_date: date,
    name: str
) -> Optional[Dict[str, Any]]:
    """전화번호, 생년월일, 이름으로 wello 환자 조회 (단일 레코드)"""
    query = """
        SELECT * FROM wello.wello_patients 
        WHERE phone_number = $1 
          AND birth_date = $2 
          AND name = $3
        LIMIT 1
    """
    return await conn.fetchrow(query, phone_number, birth_date, name)
```

## 4. 서비스 간 인증 키 (API Key)

### 4.1 키값 옵션 비교

#### 옵션 1: 공유 시크릿 키 (추천) ⭐
```
MDX_WELLO_SYNC_API_KEY = "wello_mdx_sync_2025_secure_key_peernine_12345"
```
- **장점**: 
  - 구현 간단 (하나의 키만 관리)
  - 양방향 통신에 동일 키 사용
  - 환경변수 관리 용이
- **단점**: 
  - 한쪽이 유출되면 양쪽 모두 위험
  - 키 교체 시 양쪽 모두 업데이트 필요

#### 옵션 2: 서로 다른 키
```
MDX_TO_WELLO_API_KEY = "mdx_sync_key_abc123"
WELLO_TO_MDX_API_KEY = "wello_sync_key_xyz789"
```
- **장점**: 
  - 각 서비스별 독립적 키 관리
  - 한쪽 유출 시 다른 쪽은 안전
- **단점**: 
  - 두 개의 키 관리 필요
  - 구현 복잡도 증가

### 4.2 최종 추천: 공유 시크릿 키

**환경변수 설정:**
```bash
MDX_WELLO_SYNC_API_KEY=wello_mdx_sync_2025_secure_key_peernine_12345
```

**헤더 전달 방식:**
```http
POST /api/v1/sync/mdx-to-wello
Headers:
  X-API-Key: wello_mdx_sync_2025_secure_key_peernine_12345
  X-Service-Name: mdx
  Content-Type: application/json
```

**검증 로직:**
```python
if request.headers.get("X-API-Key") != MDX_WELLO_SYNC_API_KEY:
    raise HTTPException(status_code=401, detail="Invalid API Key")
```

## 5. 서비스 구조 제안

### 4.1 서비스 파일 구조
```
planning-platform/backend/app/services/
├── sync/
│   ├── __init__.py
│   ├── mdx_wello_sync_service.py      # 메인 동기화 서비스
│   ├── patient_matcher.py              # 환자 매칭 로직
│   ├── data_mapper.py                  # 데이터 매핑 로직
│   └── conflict_resolver.py            # 충돌 해결 로직
```

### 4.2 API 엔드포인트 제안
```
POST /api/v1/sync/mdx-to-wello
  - mdx_agr_list → wello 동기화
  
POST /api/v1/sync/wello-to-mdx
  - wello → mdx_agr_list 동기화
  
GET /api/v1/sync/status
  - 동기화 상태 확인
  
POST /api/v1/sync/match-patient
  - 환자 매칭 확인
```

### 4.3 주요 함수 구조

```python
class MdxWelloSyncService:
    async def sync_mdx_to_wello(
        self, 
        phoneno: str, 
        name: str, 
        birthday: date,
        hosnm: str,
        api_key: str
    ) -> Dict[str, Any]:
        """mdx_agr_list → wello 동기화"""
        pass
    
    async def sync_wello_to_mdx(
        self,
        uuid: str,
        hospital_id: str,
        api_key: str
    ) -> Dict[str, Any]:
        """wello → mdx_agr_list 동기화"""
        pass
    
    async def match_patient(
        self,
        phoneno: str,
        name: str,
        birthday: date,
        hosnm: str
    ) -> Optional[Dict[str, Any]]:
        """환자 매칭"""
        pass
    
    async def map_checkup_data(
        self,
        mdx_data: Dict[str, Any],
        direction: str  # "mdx_to_wello" or "wello_to_mdx"
    ) -> Dict[str, Any]:
        """검진 데이터 매핑"""
        pass
```

## 6. 구현 시 고려사항

### 5.1 데이터 무결성
- 트랜잭션 처리: 양쪽 테이블 모두 업데이트 성공 시에만 커밋
- 롤백 메커니즘: 실패 시 이전 상태로 복구

### 5.2 성능 최적화
- 배치 처리: 여러 환자 데이터를 한 번에 처리
- 인덱스 활용: phoneno, name, birthday, hosnm 조합 인덱스
- 캐싱: 매칭된 환자 정보 캐싱

### 5.3 로깅 및 모니터링
- 동기화 이력 테이블 생성
- 성공/실패 로그 기록
- 동기화 통계 대시보드

### 5.4 에러 처리
- 데이터 형식 오류 처리
- 매칭 실패 시 알림
- 재시도 메커니즘

## 7. 구현 예시

### 7.1 환경변수 추가
```python
# app/core/config.py
class Settings(BaseSettings):
    # ... 기존 설정 ...
    
    # mdx ↔ wello 동기화 API 키
    mdx_wello_sync_api_key: str = Field(
        default="",
        env="MDX_WELLO_SYNC_API_KEY"
    )
```

### 7.2 인증 미들웨어
```python
# app/middleware/sync_auth.py
from fastapi import HTTPException, Header
from app.core.config import settings

async def verify_sync_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_service_name: str = Header(..., alias="X-Service-Name")
):
    """동기화 API 키 검증"""
    if not settings.mdx_wello_sync_api_key:
        raise HTTPException(
            status_code=500, 
            detail="Sync API key not configured"
        )
    
    if x_api_key != settings.mdx_wello_sync_api_key:
        raise HTTPException(
            status_code=401, 
            detail="Invalid API key"
        )
    
    if x_service_name not in ["mdx", "wello"]:
        raise HTTPException(
            status_code=400, 
            detail="Invalid service name"
        )
    
    return {
        "service": x_service_name,
        "authenticated": True
    }
```

### 7.3 환자 매칭 로직
```python
# app/services/sync/patient_matcher.py

async def get_mdx_patients(
    phoneno: str,
    birthday: date,
    name: str
) -> List[Dict[str, Any]]:
    """wello → mdx: 전화번호, 생년월일, 이름으로 mdx 환자 조회 (여러 년도 가능)"""
    query = """
        SELECT * FROM p9_mkt_biz.mdx_agr_list 
        WHERE phoneno = $1 
          AND birthday = $2 
          AND name = $3
        ORDER BY regdate DESC, visitdate DESC NULLS LAST
    """
    return await conn.fetch(query, phoneno, birthday, name)

async def get_wello_patient(
    phone_number: str,
    birth_date: date,
    name: str
) -> Optional[Dict[str, Any]]:
    """mdx → wello: 전화번호, 생년월일, 이름으로 wello 환자 조회 (단일 레코드)"""
    query = """
        SELECT * FROM wello.wello_patients 
        WHERE phone_number = $1 
          AND birth_date = $2 
          AND name = $3
        LIMIT 1
    """
    return await conn.fetchrow(query, phone_number, birth_date, name)
```

## 8. 다음 단계

1. ✅ **점검 완료** - 테이블 구조 및 매핑 관계 확인
2. ⏳ **서비스 설계** - 상세 설계 문서 작성
3. ⏳ **인증 구현** - API 키 기반 인증 추가
4. ⏳ **매핑 로직 구현** - 데이터 변환 및 매핑 로직
5. ⏳ **동기화 서비스 구현** - 양방향 동기화 로직
6. ⏳ **테스트** - 단위 테스트 및 통합 테스트
7. ⏳ **배포** - 프로덕션 배포

## 9. 참고사항

- ⚠️ **중요**: mdx_agr_list의 UUID는 년도별로 생성되므로 매칭 키로 사용 불가
- 매칭 키는 **(phoneno, birthday, name) 3개 조합** 사용
- mdx_agr_list의 height, weight는 `text` 타입이므로 변환 시 주의 필요
- wello.wello_checkup_data는 `raw_data` (JSONB)에 원본 데이터 저장
- wello.wello_patients는 단일 UUID를 가지지만, mdx_agr_list는 년도별로 여러 UUID 가능
- wello → mdx 조회 시 여러 년도 데이터가 반환될 수 있음 (최신순 정렬 필요)
- 병원명(hosnm)과 hospital_id 매핑이 필요할 수 있음

