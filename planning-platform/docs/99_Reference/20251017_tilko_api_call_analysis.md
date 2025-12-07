# 틸코 API 호출 구조 분석

## 📋 한번의 인증으로 여러 API 호출 가능

### 🔐 인증 플로우:
1. **간편인증 요청** (`SimpleAuthRequest`)
   - 사용자 정보 입력 (이름, 생년월일, 전화번호)
   - 카카오톡 인증 메시지 발송
   - 응답: `CxId`, `PrivateAuthType`, `ReqTxId`, `Token`, `TxId` 등

2. **인증 완료 후 데이터 수집**
   - 위에서 받은 인증 정보를 재사용하여 여러 API 호출 가능

### 🏥 현재 구현된 API 호출:

#### 1️⃣ 건강검진 데이터 (`ggpab003m0105`)
- **엔드포인트**: `/api/v1.0/nhissimpleauth/ggpab003m0105`
- **목적**: 최근 10년간 건강보험공단 건강검진 정보
- **필요 파라미터**: 
  - 인증 정보: `CxId`, `PrivateAuthType`, `ReqTxId`, `Token`, `TxId`
  - 사용자 정보: `UserName`, `BirthDate`, `UserCellphoneNumber` (암호화)
- **응답**: 건강검진 기록 리스트

#### 2️⃣ 처방전/투약 데이터 (`retrievetreatmentinjectioninformationperson`)
- **엔드포인트**: `/api/v1.0/nhissimpleauth/retrievetreatmentinjectioninformationperson`
- **목적**: 진료 및 투약 정보 (처방전 데이터)
- **필요 파라미터**:
  - 인증 정보: `CxId`, `PrivateAuthType`, `ReqTxId`, `Token`, `TxId`
  - 사용자 정보: `UserName`, `BirthDate`, `UserCellphoneNumber` (암호화)
  - 기간 정보: `StartDate`, `EndDate` (14개월 전 ~ 2개월 전)
- **응답**: 처방전/투약 기록 리스트

### 🔄 API 호출 순서:

```
1. 간편인증 요청 → 카카오톡 인증 → 인증 완료
                                    ↓
2. 동일한 인증 정보로 순차 호출:
   ├── 건강검진 데이터 API 호출
   └── 처방전 데이터 API 호출
```

### ✅ 핵심 포인트:

1. **한번의 인증으로 여러 API 호출 가능**: 
   - 카카오톡 인증 한번으로 `CxId`, `Token` 등을 받음
   - 이 인증 정보를 재사용하여 여러 데이터 수집 API 호출

2. **순차적 호출**:
   - 건강검진 데이터 → 처방전 데이터 순서로 호출
   - 각각 별도의 API 엔드포인트

3. **동일한 인증 파라미터**:
   - 모든 API에서 동일한 `CxId`, `Token`, `TxId` 사용
   - 사용자 정보도 동일하게 암호화하여 전송

4. **별도의 데이터 타입**:
   - 건강검진: 검진 결과, 수치, 판정 등
   - 처방전: 병원 방문 기록, 처방약, 투약 정보 등

### 📊 로깅 추가 완료:

- 각 API 호출 시작/완료 로그
- 응답 상태 및 데이터 개수 로그
- 인증 정보 재사용 확인 로그
- JSON 파일 저장 완료 로그

### 🎯 결론:

**한번의 카카오톡 인증으로 2개의 서로 다른 API를 호출하여 건강검진 데이터와 처방전 데이터를 각각 수집하는 구조입니다.**
