# e2e/scripts — E2E 진단 스크립트

pytest 본 테스트(`tests/`)와 분리된 일회성 진단/캡처 도구. 회귀 자산.

## 스크립트

### `diag_networkidle_timeout.py`
networkidle 도달 못 하는 케이스 진단용. 요청/응답/콘솔/페이지 에러 풀 캡처 + 미응답 URL 차집합 + 상태코드 분포.

용도: networkidle timeout fail 발생 시 어느 API가 지연/오류인지 추적.
출력: `/tmp/welno_diag/<label>.json` + `<label>.png`

### `diag_dom_branch_capture.py`
케이스별 DOM 분기 시그니처 캡처. CTA 버튼 텍스트 + localStorage 키 + body innerText 추출.

용도: 새 케이스 assertion 설계 전 실서버 DOM 구조 파악.
출력: `/tmp/welno_dom/<label>.json` + `<label>.png`

## 실행

```bash
cd planning-platform/frontend/e2e
python3 scripts/diag_networkidle_timeout.py
python3 scripts/diag_dom_branch_capture.py
```

실서버 https://welno.kindhabit.com 대상. 시드 INSERT 선행 필요 (TEST_E2E hospital + test-e2e-* 환자).
