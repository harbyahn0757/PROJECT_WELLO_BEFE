# Perplexity API 모델 옵션 검토

## 현재 상황
- **현재 모델**: `sonar` (기본값)
- **프롬프트 길이**: 약 16,579 문자
- **타임아웃**: 300초 (5분)
- **문제**: 타임아웃 발생 (약 2분 1초 소요 후 타임아웃)

## Perplexity API 모델 옵션

### 1. Sonar 시리즈 (현재 사용 중)
- **sonar**: 기본 모델, 균형잡힌 성능
- **sonar-pro**: 더 강력하지만 느림
- **sonar-small**: 더 빠르지만 정확도 낮음

### 2. Llama 3.1 Sonar 시리즈 (2024 최신)
- **llama-3.1-sonar-small-128k-online**: 
  - 가장 빠른 모델
  - 128k 컨텍스트 윈도우
  - 온라인 검색 지원
  - **추천**: 속도 우선 시
  
- **llama-3.1-sonar-large-128k-online**:
  - 더 정확하지만 sonar-small보다 느림
  - 128k 컨텍스트 윈도우
  - 온라인 검색 지원

### 3. 구형 모델
- **pplx-70b-online**: 구형 모델 (config.env.example에 있음)

## 추천 모델 전략

### 옵션 1: sonar-small (빠른 속도)
```env
PERPLEXITY_MODEL=sonar-small
```
- **장점**: 가장 빠른 응답 속도
- **단점**: 정확도가 약간 낮을 수 있음
- **용도**: 빠른 응답이 필요한 경우

### 옵션 2: llama-3.1-sonar-small-128k-online (최신 + 빠름)
```env
PERPLEXITY_MODEL=llama-3.1-sonar-small-128k-online
```
- **장점**: 
  - 최신 모델
  - 빠른 응답 속도
  - 긴 컨텍스트 지원 (128k)
- **단점**: sonar보다 약간 느릴 수 있음
- **용도**: 최신 기술 + 빠른 속도

### 옵션 3: 현재 모델 유지 + 최적화
- **sonar** 유지
- 타임아웃 증가 (이미 5분으로 설정됨)
- 프롬프트 최적화 (하지만 사용자는 프롬프트 변경 원하지 않음)

## 테스트 권장사항

1. **1차 테스트**: `sonar-small`로 변경하여 속도 확인
2. **2차 테스트**: `llama-3.1-sonar-small-128k-online`로 변경하여 성능 비교
3. **결과 비교**: 응답 시간, 정확도, JSON 파싱 성공률 비교

## 모델 변경 방법

### 환경변수로 변경
```bash
# config.env 또는 .env 파일에 추가
PERPLEXITY_MODEL=sonar-small
# 또는
PERPLEXITY_MODEL=llama-3.1-sonar-small-128k-online
```

### 코드에서 확인
- `app/core/config.py`: `perplexity_model` 설정
- `app/api/v1/endpoints/checkup_design.py`: `settings.perplexity_model` 사용

## 예상 효과

### sonar-small 사용 시
- **응답 시간**: 약 30-60초로 단축 예상
- **정확도**: 약간 감소 가능 (하지만 검진 설계에는 충분할 수 있음)
- **타임아웃**: 거의 발생하지 않을 것으로 예상

### llama-3.1-sonar-small-128k-online 사용 시
- **응답 시간**: 약 40-80초로 단축 예상
- **정확도**: sonar-small보다 높을 수 있음
- **타임아웃**: 거의 발생하지 않을 것으로 예상

