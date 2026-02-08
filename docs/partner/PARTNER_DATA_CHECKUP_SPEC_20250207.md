# Welno RAG Chat – partnerData 전송 규격 변경 사항 (전달용)

**대상:** Welno RAG Chat 파트너 연동  
**작성일:** 2025-02-07  
**목적:** `partnerData` 내 `checkup_results`에 **판정 결과(Abnormal)**·**정상 범위(Range)** 필드가 추가되었음을 안내

---

## 1. 변경 요약

- **변경 전:** `checkup_results`에는 검진 수치(숫자)와 `exam_date`만 전송
- **변경 후:** 해당 항목에 **결과 데이터가 있는 경우**에 한해, 각 항목별로 **판정 결과(`*_abnormal`)** 와 **정상 범위 참고값(`*_range`)** 를 추가 전송

---

## 2. 추가된 필드 규격

### 2.1 공통 규칙

- **추가 위치:** `partnerData.checkup_results` (기존 수치 필드와 동일 객체 내)
- **선택(optional):** 해당 검진 항목에 결과가 있을 때만 포함되며, 없으면 키 자체를 보내지 않음
- **타입:** 문자열(string)

### 2.2 판정 결과 (`*_abnormal`)

| 의미 | 설명 |
|------|------|
| **필드명** | 각 수치 필드명 + `_abnormal` (예: `systolic_bp_abnormal`) |
| **값** | `"정상"` \| `"비해당"` \| 기타(이상 등, 예: `"높음"`, `"낮음"` 등 검진 판정 문구) |
| **용도** | 해당 수치에 대한 판정 결과(정상/비해당/이상 등) |

### 2.3 정상 범위 (`*_range`)

| 의미 | 설명 |
|------|------|
| **필드명** | 각 수치 필드명 + `_range` (예: `systolic_bp_range`) |
| **값** | 정상 범위 참고용 문자열 (예: "90-119 mmHg", "70-99 mg/dL" 등) |
| **용도** | RAG/상담 시 참고용 정상 범위 표시 |

---

## 3. 항목별 추가 필드 목록

아래 항목은 **해당 검진 결과가 있을 때만** `checkup_results`에 포함될 수 있습니다.

| 기존 수치 필드 | 추가 필드 (optional) | 비고 |
|----------------|----------------------|------|
| `systolic_bp` | `systolic_bp_abnormal`, `systolic_bp_range` | 수축기 혈압 |
| `diastolic_bp` | `diastolic_bp_abnormal`, `diastolic_bp_range` | 이완기 혈압 |
| `fasting_glucose` | `fasting_glucose_abnormal`, `fasting_glucose_range` | 공복 혈당 |
| `hemoglobin` | `hemoglobin_abnormal`, `hemoglobin_range` | 혈색소 |
| `total_cholesterol` | `total_cholesterol_abnormal`, `total_cholesterol_range` | 총콜레스테롤 |
| `hdl_cholesterol` | `hdl_cholesterol_abnormal`, `hdl_cholesterol_range` | HDL 콜레스테롤 |
| `ldl_cholesterol` | `ldl_cholesterol_abnormal`, `ldl_cholesterol_range` | LDL 콜레스테롤 |
| `triglycerides` | `triglycerides_abnormal`, `triglycerides_range` | 중성지방 |
| `creatinine` | `creatinine_abnormal`, `creatinine_range` | 크레아티닌 |
| `gfr` | `gfr_abnormal`, `gfr_range` | GFR |
| `sgot_ast` | `sgot_ast_abnormal`, `sgot_ast_range` | AST(SGOT) |
| `sgpt_alt` | `sgpt_alt_abnormal`, `sgpt_alt_range` | ALT(SGPT) |
| `gamma_gtp` | `gamma_gtp_abnormal`, `gamma_gtp_range` | γ-GTP |

- `height`, `weight`, `bmi`, `exam_date`에는 `_abnormal`/`_range`를 추가하지 않습니다.

---

## 4. 예시 (변경 후 checkup_results)

```json
{
  "patient": { ... },
  "checkup_results": {
    "height": 170,
    "weight": 72,
    "bmi": 24.9,
    "systolic_bp": 125,
    "systolic_bp_abnormal": "정상",
    "systolic_bp_range": "90-119 mmHg",
    "diastolic_bp": 82,
    "diastolic_bp_abnormal": "정상",
    "diastolic_bp_range": "60-79 mmHg",
    "fasting_glucose": 98,
    "fasting_glucose_abnormal": "정상",
    "fasting_glucose_range": "70-99 mg/dL",
    "total_cholesterol": 210,
    "total_cholesterol_abnormal": "높음",
    "total_cholesterol_range": "0-199 mg/dL",
    "hdl_cholesterol": 55,
    "ldl_cholesterol": 130,
    "triglycerides": 120,
    "exam_date": "2025-01-15"
  }
}
```

- 항목별로 결과가 없으면 해당 `*_abnormal`, `*_range` 키는 생략됩니다.
- 기존에 사용하시던 수치 필드(`systolic_bp`, `fasting_glucose` 등)는 그대로 유지됩니다.

---

## 5. Welno 측 적용 시 참고

- **하위 호환:** 기존 수치 필드는 변경 없음. 새 필드는 모두 optional이므로 기존 파싱 로직은 유지 가능.
- **RAG/상담 활용:** `*_abnormal`로 정상/비해당/이상 구분, `*_range`로 정상 범위 문구 참고 가능.
- **문의:** 규격 관련 문의는 파트너 담당자 경로로 요청 부탁드립니다.

---

*이 문서는 MediLinx(메디링스) 측에서 Welno로 전달하는 partnerData 전송 규격 변경 사항을 정리한 것입니다.*
