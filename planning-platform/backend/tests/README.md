# 테스트 폴더

이 폴더에는 백엔드 시스템의 모든 테스트 파일이 포함되어 있습니다.

## 테스트 파일 목록

- `test_partner_isolation_comprehensive.py` - 파트너별 격리 종합 테스트
- `test_comprehensive_dynamic_system.py` - 동적 설정 시스템 종합 테스트  
- `test_dynamic_integration.py` - 동적 설정 통합 테스트
- `test_partner_auth.py` - 파트너 인증 테스트
- `test_slack_integration.py` - Slack 통합 테스트

## 테스트 실행 방법

```bash
# 개별 테스트 실행
cd /home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend
python tests/test_partner_isolation_comprehensive.py

# 모든 테스트 실행 (pytest 사용 시)
pytest tests/
```

## 테스트 카테고리

### 통합 테스트 (Integration Tests)
- 데이터베이스와 실제 서비스 간의 통합 테스트
- 파트너별 격리 및 보안 테스트

### 단위 테스트 (Unit Tests)  
- 개별 서비스 및 함수 테스트
- 모킹을 통한 의존성 격리 테스트

### 시스템 테스트 (System Tests)
- 전체 시스템 동작 검증
- 성능 및 부하 테스트