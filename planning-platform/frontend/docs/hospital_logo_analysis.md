# 병원 로고 이미지 저장 위치 분석

## 현재 상황 분석

### 1. 데이터 조회 흐름 확인

#### UUID로 mdx_agr_list 조회
- **위치**: `planning-platform/backend/app/repositories/implementations.py`
- **함수**: `PatientRepository.get_by_uuid()`
- **쿼리**:
  ```sql
  SELECT uuid, name, birthday, gender, phoneno, hosnm, visitdate, regdate
  FROM p9_mkt_biz.mdx_agr_list 
  WHERE uuid = %s
  ```
- **결과**: `hosnm` 필드에 병원명이 저장되어 있음

#### 병원 정보 매핑
- **위치**: `planning-platform/backend/app/repositories/implementations.py`
- **함수**: `HospitalRepository.get_by_id()`
- **테이블**: `wello.wello_hospitals`
- **현재 쿼리**:
  ```sql
  SELECT hospital_id, hospital_name, phone, address, 
         supported_checkup_types, layout_type, 
         brand_color, logo_position, is_active
  FROM wello.wello_hospitals 
  WHERE hospital_id = %s AND is_active = true
  ```

### 2. 데이터베이스 테이블 구조

#### wello.wello_hospitals 테이블
현재 컬럼 목록:
- `hospital_id` (character varying)
- `hospital_name` (character varying)
- `phone` (character varying)
- `address` (text)
- `supported_checkup_types` (ARRAY)
- `layout_type` (character varying)
- `brand_color` (character varying)
- `logo_position` (character varying)
- `is_active` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

**문제점**: 로고 이미지 URL을 저장할 필드가 없음

#### mdx_agr_list 테이블
- `hosnm` 필드: 병원명 저장 (예: "서울웰노내과의원", "유성선병원(종합)")
- `hosnm`은 병원명이지 `hospital_id`가 아님
- `hospital_id`는 `wello_hospitals` 테이블의 `hospital_id`와 매핑 필요

### 3. 현재 매핑 로직

```python
# PatientRepository.get_by_uuid()에서
hospital_id = result['hosnm']  # hosnm을 hospital_id로 사용

# HospitalRepository.get_by_id()에서
# hosnm 값을 hospital_id로 사용하여 wello_hospitals 조회
```

**문제점**: 
- `hosnm`은 병원명이고, `hospital_id`는 별도 값일 수 있음
- `hosnm`과 `hospital_id` 간 매핑 테이블이 필요할 수 있음

## 해결 방안

### 옵션 1: wello_hospitals 테이블에 로고 필드 추가 (권장)

```sql
ALTER TABLE wello.wello_hospitals 
ADD COLUMN logo_url VARCHAR(500),
ADD COLUMN logo_image_path VARCHAR(500);
```

**장점**:
- 병원별 로고 관리 용이
- 파트너사별로 다른 로고 사용 가능
- 확장성 좋음

**단점**:
- 기존 데이터 마이그레이션 필요
- 이미지 파일 저장 위치 결정 필요

### 옵션 2: hosnm과 hospital_id 매핑 테이블 생성

```sql
CREATE TABLE IF NOT EXISTS wello.hospital_mapping (
    hosnm VARCHAR(200) PRIMARY KEY,
    hospital_id VARCHAR(50) NOT NULL,
    logo_url VARCHAR(500),
    FOREIGN KEY (hospital_id) REFERENCES wello.wello_hospitals(hospital_id)
);
```

**장점**:
- mdx_agr_list의 hosnm과 wello_hospitals의 hospital_id 연결
- 로고 정보도 함께 관리 가능

**단점**:
- 추가 테이블 관리 필요

### 옵션 3: 정적 파일로 관리 (임시 방안)

- 프론트엔드에서 `hospital_id` 또는 `hosnm` 기반으로 로고 이미지 경로 생성
- 예: `/static/logos/{hospital_id}.png` 또는 `/static/logos/{hosnm}.png`

**장점**:
- DB 변경 불필요
- 빠른 구현 가능

**단점**:
- 파일명 규칙 관리 필요
- 확장성 낮음

## 권장 사항

1. **단기**: 옵션 3 (정적 파일)로 임시 구현
2. **장기**: 옵션 1 (wello_hospitals에 logo_url 필드 추가)로 전환

## 다음 단계

1. `hosnm`과 `hospital_id` 매핑 관계 확인
2. 로고 이미지 저장 위치 결정 (S3, 로컬 파일, DB)
3. wello_hospitals 테이블 스키마 업데이트
4. 프론트엔드에서 로고 이미지 표시 로직 구현




