# 개발 도구

개발 및 디버깅을 위한 확인 도구 모음입니다.

## 📋 스크립트 목록

### check_actual_function.py
실제 실행되는 함수의 코드를 확인합니다.

**용도:**
- 런타임에 실제 실행되는 함수 코드 확인
- 함수가 올바르게 import되었는지 검증
- 함수의 소스 코드 위치 확인

```bash
python scripts/dev-tools/check_actual_function.py
```

---

### check_actual_query.py
실제 실행되는 SQL 쿼리를 확인합니다.

**용도:**
- 런타임에 실제 실행되는 쿼리 확인
- 쿼리 파라미터 바인딩 검증
- SQL 성능 디버깅

```bash
python scripts/dev-tools/check_actual_query.py
```

---

### show_full_function.py
전체 함수 코드를 표시합니다.

**용도:**
- 함수 전체 코드 출력
- 함수 시그니처 및 docstring 확인
- 코드 리뷰 및 분석

```bash
python scripts/dev-tools/show_full_function.py
```

---

### verify_model_usage.py
AI 모델 사용량을 검증합니다.

**용도:**
- 모델 API 호출 횟수 확인
- 토큰 사용량 분석
- 비용 추정

```bash
python scripts/dev-tools/verify_model_usage.py
```

---

## 사용 시나리오

### 1. 함수 디버깅
```bash
# 1. 실제 실행되는 함수 확인
python scripts/dev-tools/check_actual_function.py

# 2. 전체 함수 코드 확인
python scripts/dev-tools/show_full_function.py
```

### 2. 쿼리 최적화
```bash
# 실제 실행되는 쿼리 확인
python scripts/dev-tools/check_actual_query.py
```

### 3. AI 모델 사용량 모니터링
```bash
# 모델 사용량 검증
python scripts/dev-tools/verify_model_usage.py
```

---

## 환경 설정

스크립트들은 `.env.local` 파일에서 설정을 읽습니다.

**설정 파일 위치:**
```
planning-platform/backend/.env.local
```

---

## 주의사항

- 개발 및 디버깅 목적으로만 사용하세요.
- 프로덕션 환경에서는 신중하게 사용하세요.
- 민감한 정보(비밀번호, API 키 등)가 로그에 출력될 수 있으니 주의하세요.
