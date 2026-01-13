# WELNO 블록체인 통합 개발 가이드

> **목적**: 검진·문진·페르소나 데이터를 보험사에 제공하여 맞춤 보험상품 제안

---

## 1. 현재 저장되는 데이터 구조

### 1.1 기초데이터 (Tilko API 수집)

#### ① 건강검진 데이터 (`welno_checkup_data`)
```sql
CREATE TABLE welno.welno_checkup_data (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    
    -- 전체 원본 데이터
    raw_data JSONB NOT NULL,
    
    -- 주요 필드 (인덱싱용)
    year VARCHAR(10),              -- "2021년"
    checkup_date VARCHAR(20),      -- "09/28"
    location VARCHAR(100),         -- "이루탄메디케어의원"
    code VARCHAR(20),              -- "의심", "정상"
    
    -- 주요 검사 수치
    height DECIMAL(5,2),           -- 181.3 cm
    weight DECIMAL(5,2),           -- 82.2 kg
    bmi DECIMAL(4,1),              -- 25.0
    waist_circumference DECIMAL(4,1),  -- 89.0 cm
    blood_pressure_high INTEGER,   -- 최고혈압
    blood_pressure_low INTEGER,    -- 최저혈압
    blood_sugar INTEGER,           -- 공복혈당
    cholesterol INTEGER,           -- 총콜레스테롤
    hdl_cholesterol INTEGER,       -- HDL
    ldl_cholesterol INTEGER,       -- LDL
    triglyceride INTEGER,          -- 중성지방
    hemoglobin DECIMAL(3,1)        -- 혈색소
);
```

**실제 저장 예시 (raw_data JSONB):**
```json
{
  "Year": "2021년",
  "CheckUpDate": "09/28",
  "Location": "이루탄메디케어의원",
  "Code": "의심",
  "Inspections": [
    {
      "Gubun": "계측검사",
      "Illnesses": [
        {
          "Name": "비만",
          "Items": [
            {"Name": "신장", "Value": "181.3", "Unit": "Cm"},
            {"Name": "체중", "Value": "82.2", "Unit": "Kg"},
            {"Name": "허리둘레", "Value": "89.0", "Unit": "Cm"},
            {"Name": "체질량지수", "Value": "25.0", "Unit": "kg/m2"}
          ]
        },
        {
          "Name": "고혈압",
          "Items": [
            {"Name": "혈압(수축기/이완기)", "Value": "120/80", "Unit": "mmHg"}
          ]
        }
      ]
    }
  ]
}
```

#### ② 복약·병원방문 데이터 (`welno_prescription_data`)
```sql
CREATE TABLE welno.welno_prescription_data (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    
    -- 전체 원본 데이터
    raw_data JSONB NOT NULL,
    
    -- 주요 필드
    hospital_name VARCHAR(100),    -- "케어빌한의원"
    treatment_date DATE,           -- "2023-06-20"
    treatment_type VARCHAR(50),    -- "한방기관외래", "일반외래", "처방조제"
    visit_count INTEGER,           -- 방문일수: 1
    prescription_count INTEGER,    -- 처방횟수: 0
    medication_count INTEGER       -- 투약요양횟수: 1
);
```

**실제 저장 예시 (raw_data JSONB):**
```json
{
  "Idx": "1",
  "ByungEuiwonYakGukMyung": "케어빌한의원",
  "Address": "영등포구 당산로",
  "JinRyoGaesiIl": "2023-06-20",
  "JinRyoHyungTae": "한방기관외래",
  "BangMoonIpWonIlsoo": "1",
  "CheoBangHoiSoo": "0",
  "TuYakYoYangHoiSoo": "1",
  "RetrieveTreatmentInjectionInformationPersonDetailList": [
    {
      "ChoBangYakPumMyung": "스토마정 (Stoma Tab.)",
      "ChoBangYakPumHyoneung": "소화성궤양용제",
      "TuyakIlSoo": "2",
      "DrugCode": "A11AKP09F0004",
      "MediPrdcNm": "스토마정",
      "EfftEftCnte": "급성위염, 만성위염"
    }
  ]
}
```

### 1.2 문진데이터 (검진설계 요청)

#### ③ 검진 설계 요청 데이터 (`welno_checkup_design_requests`)
```sql
CREATE TABLE welno.welno_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    
    -- 선택한 염려 항목
    selected_concerns JSONB NOT NULL,
    
    -- 설문 응답
    survey_responses JSONB,
    
    -- 추가 고민사항
    additional_concerns TEXT,
    
    -- AI 생성 검진 설계 결과
    design_result JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**실제 저장 예시:**
```json
{
  "selected_concerns": [
    {
      "type": "checkup",
      "id": "blood_sugar",
      "name": "공복혈당",
      "value": 110,
      "unit": "mg/dL",
      "status": "warning"
    },
    {
      "type": "medication",
      "id": "stoma_tab",
      "name": "스토마정",
      "date": "2023-06-20"
    }
  ],
  "survey_responses": {
    "Q1": "운동을 거의 하지 않습니다",
    "Q2": "매일 음주합니다",
    "Q3": "가족력에 당뇨가 있습니다"
  },
  "design_result": {
    "recommended_tests": [
      {
        "test_name": "당화혈색소(HbA1c)",
        "reason": "공복혈당 110으로 경계성. 당뇨 진행 확인 필요",
        "priority": "high"
      },
      {
        "test_name": "갑상선기능검사",
        "reason": "가족력 및 생활습관 고려",
        "priority": "medium"
      }
    ],
    "lifestyle_advice": "...",
    "total_estimated_cost": 150000
  }
}
```

### 1.3 페르소나 데이터 (PNT 영양 설문)

#### ④ PNT 사용자 응답 (`welno_pnt_user_responses`)
```sql
-- PNT (Personalized Nutrition Therapy) 영양 설문 데이터
CREATE TABLE welno.welno_pnt_user_responses (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    question_id INTEGER,
    answer_option_id INTEGER,
    answer_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ⑤ PNT 최종 추천 (`welno_pnt_final_recommendations`)
```sql
CREATE TABLE welno.welno_pnt_final_recommendations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    
    -- 추천 영양제
    recommended_supplements JSONB,
    
    -- 추천 음식
    recommended_foods JSONB,
    
    -- 페르소나 점수
    persona_scores JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**실제 저장 예시:**
```json
{
  "persona_scores": {
    "digestive_health": 65,
    "metabolic_health": 72,
    "cardiovascular_health": 58,
    "immune_health": 80
  },
  "recommended_supplements": [
    {
      "name": "오메가3",
      "reason": "심혈관 건강 개선",
      "priority": 1
    }
  ],
  "recommended_foods": [
    {
      "name": "브로콜리",
      "reason": "항산화 성분",
      "frequency": "주 3회"
    }
  ]
}
```

---

## 2. 보험사 제공 데이터 정리

### 제공할 데이터 요약
```
1. 기초데이터
   ├─ 건강검진 이력 (연도별, 병원별)
   ├─ 주요 검사 수치 (혈압, 혈당, 콜레스테롤 등)
   ├─ 처방전 이력 (병원, 약국)
   ├─ 복약 이력 (약품명, 효능, 투약일수)
   └─ 병원 방문 이력 (방문일, 진료형태)

2. 문진데이터
   ├─ 염려 항목 (사용자가 선택한 건강 고민)
   ├─ 설문 응답 (생활습관, 가족력 등)
   └─ AI 검진 설계 결과 (추천 검사 항목)

3. 페르소나 데이터
   ├─ 영양 설문 응답
   ├─ 페르소나 점수 (소화, 대사, 심혈관, 면역)
   ├─ 추천 영양제
   └─ 추천 음식
```

---

## 3. 블록체인 적용 구조

### 온체인 vs 오프체인
| 데이터 | 온체인 (블록체인) | 오프체인 (IPFS) |
|--------|------------------|----------------|
| 약관 동의 해시 | ✅ | - |
| 개인정보 조합 해시 | ✅ | - |
| 건강검진 데이터 해시 | ✅ | ✅ 암호화 원본 |
| 처방전/복약 해시 | ✅ | ✅ 암호화 원본 |
| 문진 데이터 해시 | ✅ | ✅ 암호화 원본 |
| 페르소나 점수 해시 | ✅ | ✅ 원본 |
| 보험사 접근 권한 | ✅ 기록 | - |
| 접근 로그 | ✅ 기록 | - |

---

## 4. 스마트 컨트랙트 코드

### health-data-contract.js

```javascript
'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class HealthDataContract extends Contract {
    
    // 1. 약관 동의 기록
    async recordConsent(ctx, patientUuid, consentHash) {
        const consent = {
            patientUuid: patientUuid,
            consentHash: consentHash,
            agreedAt: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `CONSENT_${patientUuid}`, 
            Buffer.from(JSON.stringify(consent))
        );
        
        return consent;
    }

    // 2. 건강검진 데이터 기록
    async recordCheckupData(ctx, patientUuid, dataHash, ipfsHash) {
        const record = {
            patientUuid: patientUuid,
            dataType: 'checkup',
            dataHash: dataHash,        // SHA-256(raw_data)
            ipfsHash: ipfsHash,        // IPFS CID
            recordedAt: new Date().toISOString(),
            recordedBy: ctx.clientIdentity.getMSPID(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `CHECKUP_${patientUuid}_${Date.now()}`, 
            Buffer.from(JSON.stringify(record))
        );
        
        return record;
    }

    // 3. 복약 데이터 기록
    async recordPrescriptionData(ctx, patientUuid, dataHash, ipfsHash) {
        const record = {
            patientUuid: patientUuid,
            dataType: 'prescription',
            dataHash: dataHash,
            ipfsHash: ipfsHash,
            recordedAt: new Date().toISOString(),
            recordedBy: ctx.clientIdentity.getMSPID(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `PRESCRIPTION_${patientUuid}_${Date.now()}`, 
            Buffer.from(JSON.stringify(record))
        );
        
        return record;
    }

    // 4. 문진·검진설계 데이터 기록
    async recordSurveyData(ctx, patientUuid, dataHash, ipfsHash) {
        const record = {
            patientUuid: patientUuid,
            dataType: 'survey',
            dataHash: dataHash,
            ipfsHash: ipfsHash,
            recordedAt: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `SURVEY_${patientUuid}_${Date.now()}`, 
            Buffer.from(JSON.stringify(record))
        );
        
        return record;
    }

    // 5. 페르소나 점수 기록
    async recordPersonaData(ctx, patientUuid, dataHash) {
        const record = {
            patientUuid: patientUuid,
            dataType: 'persona',
            dataHash: dataHash,
            recordedAt: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `PERSONA_${patientUuid}_${Date.now()}`, 
            Buffer.from(JSON.stringify(record))
        );
        
        return record;
    }

    // 6. 보험사 접근 권한 부여
    async grantInsuranceAccess(ctx, patientUuid, insuranceOrgId, expiresAt) {
        const access = {
            patientUuid: patientUuid,
            insuranceOrgId: insuranceOrgId,
            grantedAt: new Date().toISOString(),
            expiresAt: expiresAt,
            dataTypes: ['checkup', 'prescription', 'survey', 'persona'],
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `ACCESS_${patientUuid}_${insuranceOrgId}`, 
            Buffer.from(JSON.stringify(access))
        );
        
        return access;
    }

    // 7. 접근 권한 검증
    async verifyAccess(ctx, patientUuid) {
        const callerMSP = ctx.clientIdentity.getMSPID();
        
        // 웰노는 항상 접근 가능
        if (callerMSP === 'WelnoMSP') {
            return { hasAccess: true };
        }
        
        // 보험사 권한 확인
        const accessKey = `ACCESS_${patientUuid}_${callerMSP}`;
        const accessBytes = await ctx.stub.getState(accessKey);
        
        if (!accessBytes || accessBytes.length === 0) {
            return { hasAccess: false, reason: '권한 없음' };
        }
        
        const access = JSON.parse(accessBytes.toString());
        
        // 만료 확인
        if (new Date() > new Date(access.expiresAt)) {
            return { hasAccess: false, reason: '권한 만료' };
        }
        
        // 접근 로그 기록
        await this.logAccess(ctx, patientUuid, callerMSP);
        
        return { hasAccess: true, expiresAt: access.expiresAt };
    }

    // 8. 접근 로그 기록
    async logAccess(ctx, patientUuid, accessorMSP) {
        const log = {
            patientUuid: patientUuid,
            accessor: accessorMSP,
            accessedAt: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };
        
        await ctx.stub.putState(
            `LOG_${patientUuid}_${Date.now()}`, 
            Buffer.from(JSON.stringify(log))
        );
    }

    // 9. 접근 로그 조회
    async getAccessLogs(ctx, patientUuid) {
        const iterator = await ctx.stub.getStateByRange(
            `LOG_${patientUuid}_0`,
            `LOG_${patientUuid}_9999999999999`
        );
        
        const logs = [];
        let result = await iterator.next();
        while (!result.done) {
            if (result.value && result.value.value.toString()) {
                logs.push(JSON.parse(result.value.value.toString()));
            }
            result = await iterator.next();
        }
        await iterator.close();
        
        return logs;
    }
}

module.exports = HealthDataContract;
```

---

## 5. 백엔드 통합 코드

### 5.1 암호화 모듈

#### app/blockchain/encryption.py

```python
"""AES-256-GCM 암호화"""
import hashlib
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

class EncryptionService:
    def __init__(self, master_key: bytes):
        self.master_key = master_key
    
    def generate_patient_key(self, patient_uuid: str) -> bytes:
        """환자별 고유 키 생성"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=patient_uuid.encode(),
            iterations=100000,
        )
        return kdf.derive(self.master_key)
    
    def encrypt(self, data: str, patient_uuid: str) -> tuple[str, str]:
        """
        데이터 암호화
        Returns: (암호화된 데이터, nonce)
        """
        key = self.generate_patient_key(patient_uuid)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        
        ciphertext = aesgcm.encrypt(nonce, data.encode(), None)
        
        return (
            base64.b64encode(ciphertext).decode(),
            base64.b64encode(nonce).decode()
        )
    
    @staticmethod
    def calculate_hash(data: str) -> str:
        """SHA-256 해시"""
        return hashlib.sha256(data.encode()).hexdigest()
```

### 5.2 IPFS 클라이언트

#### app/blockchain/ipfs_client.py

```python
"""IPFS 업로드/다운로드"""
import ipfshttpclient

class IPFSClient:
    def __init__(self, host: str = '/ip4/127.0.0.1/tcp/5001'):
        self.client = ipfshttpclient.connect(host)
    
    async def add_file(self, content: bytes) -> str:
        """업로드 → IPFS CID 반환"""
        result = self.client.add_bytes(content)
        return result  # QmXxx...
    
    async def get_file(self, cid: str) -> bytes:
        """다운로드"""
        return self.client.cat(cid)
    
    async def pin_file(self, cid: str):
        """영구 보관"""
        self.client.pin.add(cid)
```

### 5.3 Fabric SDK 클라이언트

#### app/blockchain/fabric_client.py

```python
"""Hyperledger Fabric SDK"""
import json
from typing import Dict, Any, List
from hfc.fabric import Client

class FabricClient:
    def __init__(self):
        self.client = Client(net_profile="network.json")
        self.channel_name = "health-data-channel"
        
    async def invoke_chaincode(
        self, 
        chaincode_name: str, 
        function_name: str, 
        args: List[str]
    ) -> Dict[str, Any]:
        """스마트 컨트랙트 실행 (쓰기)"""
        response = await self.client.chaincode_invoke(
            requestor=self.client.get_user('welno', 'admin'),
            channel_name=self.channel_name,
            peers=['peer0.welno.com'],
            cc_name=chaincode_name,
            fcn=function_name,
            args=args,
            wait_for_event=True
        )
        
        return {"txId": response['tx_id']}
    
    async def query_chaincode(
        self, 
        chaincode_name: str, 
        function_name: str, 
        args: List[str]
    ) -> Any:
        """스마트 컨트랙트 조회 (읽기)"""
        response = await self.client.chaincode_query(
            requestor=self.client.get_user('welno', 'admin'),
            channel_name=self.channel_name,
            peers=['peer0.welno.com'],
            cc_name=chaincode_name,
            fcn=function_name,
            args=args
        )
        
        return json.loads(response)
```

### 5.4 기존 API 수정

#### app/api/v1/endpoints/tilko_auth.py (수정)

```python
from app.blockchain.fabric_client import FabricClient
from app.blockchain.encryption import EncryptionService
from app.blockchain.ipfs_client import IPFSClient
import json
import os

# 초기화
blockchain = FabricClient()
encryption = EncryptionService(master_key=os.getenv("MASTER_KEY").encode())
ipfs = IPFSClient()

@router.post("/session/start")
async def start_auth_session(request: SimpleAuthWithSessionRequest):
    """1. 세션 시작 + 약관 동의 블록체인 기록"""
    
    # 기존 세션 생성
    session_id = session_manager.create_session(user_info)
    
    # 약관 동의 해시 생성
    consent_data = {
        "version": "v1.0.0",
        "agreedAt": datetime.now().isoformat(),
        "privacyPolicy": True,
        "insuranceDataSharing": True
    }
    consent_hash = encryption.calculate_hash(
        json.dumps(consent_data, sort_keys=True)
    )
    
    # 블록체인 기록
    tx = await blockchain.invoke_chaincode(
        chaincode_name="health-data-contract",
        function_name="recordConsent",
        args=[request.patient_uuid, consent_hash]
    )
    
    return {
        "session_id": session_id,
        "blockchain_tx": tx["txId"]  # 블록체인 트랜잭션 ID
    }


async def collect_health_data_background_task(session_id: str):
    """2. 데이터 수집 + 블록체인/IPFS 저장"""
    
    session_data = session_manager.get_session(session_id)
    patient_uuid = session_data.get("patient_uuid")
    
    # === 건강검진 데이터 ===
    health_data = await get_health_screening_data(request_login)
    health_json = json.dumps(health_data, ensure_ascii=False)
    health_hash = encryption.calculate_hash(health_json)
    
    # 암호화 후 IPFS 업로드
    encrypted_health, nonce = encryption.encrypt(health_json, patient_uuid)
    ipfs_cid = await ipfs.add_file(encrypted_health.encode())
    await ipfs.pin_file(ipfs_cid)
    
    # 블록체인 기록
    await blockchain.invoke_chaincode(
        chaincode_name="health-data-contract",
        function_name="recordCheckupData",
        args=[patient_uuid, health_hash, ipfs_cid]
    )
    
    # === 처방전 데이터 ===
    prescription_data = await get_prescription_data(request_login)
    prescription_json = json.dumps(prescription_data, ensure_ascii=False)
    prescription_hash = encryption.calculate_hash(prescription_json)
    
    encrypted_presc, presc_nonce = encryption.encrypt(prescription_json, patient_uuid)
    ipfs_presc_cid = await ipfs.add_file(encrypted_presc.encode())
    await ipfs.pin_file(ipfs_presc_cid)
    
    await blockchain.invoke_chaincode(
        chaincode_name="health-data-contract",
        function_name="recordPrescriptionData",
        args=[patient_uuid, prescription_hash, ipfs_presc_cid]
    )
    
    # PostgreSQL 저장 (기존)
    session_manager.update_health_data(session_id, health_data)
    session_manager.update_prescription_data(session_id, prescription_data)
    
    # 블록체인 메타데이터 추가
    health_data["_blockchain"] = {
        "checkup_hash": health_hash,
        "checkup_ipfs": ipfs_cid,
        "prescription_hash": prescription_hash,
        "prescription_ipfs": ipfs_presc_cid
    }
    
    print(f"✅ 블록체인/IPFS 저장 완료: {patient_uuid}")
```

#### app/api/v1/endpoints/checkup_design.py (수정)

```python
@router.post("/design/save")
async def save_checkup_design(request: CheckupDesignRequest):
    """3. 검진설계 결과 + 블록체인 기록"""
    
    # GPT로 검진 설계 생성 (기존)
    design_result = await gpt_service.generate_design(...)
    
    # DB 저장 (기존)
    await welno_data_service.save_checkup_design(
        patient_id=request.patient_id,
        selected_concerns=request.selected_concerns,
        survey_responses=request.survey_responses,
        design_result=design_result
    )
    
    # 문진+설계 데이터 해시 생성
    survey_data = {
        "selected_concerns": request.selected_concerns,
        "survey_responses": request.survey_responses,
        "design_result": design_result
    }
    survey_json = json.dumps(survey_data, ensure_ascii=False)
    survey_hash = encryption.calculate_hash(survey_json)
    
    # 암호화 후 IPFS
    encrypted_survey, nonce = encryption.encrypt(survey_json, patient_uuid)
    ipfs_survey_cid = await ipfs.add_file(encrypted_survey.encode())
    await ipfs.pin_file(ipfs_survey_cid)
    
    # 블록체인 기록
    await blockchain.invoke_chaincode(
        chaincode_name="health-data-contract",
        function_name="recordSurveyData",
        args=[patient_uuid, survey_hash, ipfs_survey_cid]
    )
    
    return {"success": True}
```

### 5.5 보험사 데이터 조회 API (신규)

#### app/api/v1/endpoints/insurance_api.py

```python
"""보험사 전용 API"""
from fastapi import APIRouter, HTTPException
from app.blockchain.fabric_client import FabricClient
from app.services.welno_data_service import WelnoDataService

router = APIRouter()
blockchain = FabricClient()
welno_service = WelnoDataService()

@router.post("/insurance/grant-access")
async def grant_access(patient_uuid: str, insurance_org_id: str):
    """환자가 보험사에게 30일간 접근 권한 부여"""
    
    expires_at = (datetime.now() + timedelta(days=30)).isoformat()
    
    tx = await blockchain.invoke_chaincode(
        chaincode_name="health-data-contract",
        function_name="grantInsuranceAccess",
        args=[patient_uuid, insurance_org_id, expires_at]
    )
    
    return {
        "success": True,
        "txId": tx["txId"],
        "expiresAt": expires_at
    }


@router.get("/insurance/patient-data/{patient_uuid}")
async def get_patient_data(patient_uuid: str):
    """보험사가 환자 데이터 조회"""
    
    # 1. 블록체인에서 권한 검증
    access_check = await blockchain.query_chaincode(
        chaincode_name="health-data-contract",
        function_name="verifyAccess",
        args=[patient_uuid]
    )
    
    if not access_check.get("hasAccess"):
        raise HTTPException(status_code=403, detail="접근 권한 없음")
    
    # 2. PostgreSQL에서 데이터 조회
    patient = await welno_service.get_patient_by_uuid(patient_uuid)
    checkup_data = await welno_service.get_checkup_data(patient_uuid)
    prescription_data = await welno_service.get_prescription_data(patient_uuid)
    design_data = await welno_service.get_checkup_design(patient_uuid)
    persona_data = await welno_service.get_persona_data(patient_uuid)
    
    return {
        "patient": {
            "uuid": patient["uuid"],
            "age": calculate_age(patient["birth_date"]),
            "gender": patient["gender"]
        },
        "checkupData": checkup_data,        # 건강검진 이력
        "prescriptionData": prescription_data,  # 복약/병원방문
        "surveyData": design_data,          # 문진+검진설계
        "personaData": persona_data,        # 페르소나 점수
        "blockchainVerified": True
    }


@router.get("/insurance/access-logs/{patient_uuid}")
async def get_access_logs(patient_uuid: str):
    """접근 로그 조회"""
    
    logs = await blockchain.query_chaincode(
        chaincode_name="health-data-contract",
        function_name="getAccessLogs",
        args=[patient_uuid]
    )
    
    return {"logs": logs}
```

---

## 6. 노드 구성

### 웰노 노드 + 보험사 노드 (2노드)

#### docker-compose.yml (웰노)

```yaml
version: '3.7'

services:
  # Orderer
  orderer.welno.com:
    image: hyperledger/fabric-orderer:2.5
    ports:
      - "7050:7050"
    volumes:
      - ./channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block

  # Peer
  peer0.welno.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_PEER_ID=peer0.welno.com
      - CORE_PEER_LOCALMSPID=WelnoMSP
    ports:
      - "7051:7051"

  # CouchDB
  couchdb:
    image: couchdb:3.3
    ports:
      - "5984:5984"

  # IPFS
  ipfs:
    image: ipfs/kubo:latest
    ports:
      - "5001:5001"  # API
      - "8080:8080"  # Gateway
    volumes:
      - ./ipfs-data:/data/ipfs
```

#### docker-compose-insurance.yml (보험사)

```yaml
version: '3.7'

services:
  peer0.insurance.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_PEER_ID=peer0.insurance.com
      - CORE_PEER_LOCALMSPID=InsuranceMSP
    ports:
      - "9051:7051"

  couchdb-insurance:
    image: couchdb:3.3
    ports:
      - "6984:5984"
```

---

## 7. 구현 단계

### Phase 1: 환경 구축 (2주)
```bash
# Week 1
- Hyperledger Fabric 네트워크 설치
- 채널 생성 (health-data-channel)
- 인증서 발급 (웰노 + 보험사)

# Week 2
- IPFS 노드 설치
- 스마트 컨트랙트 배포
- 통합 테스트
```

### Phase 2: 백엔드 통합 (3주)
```python
# Week 1: 모듈 개발
- encryption.py
- ipfs_client.py
- fabric_client.py

# Week 2: 기존 API 수정
- tilko_auth.py (동의 + 데이터 수집)
- checkup_design.py (문진 데이터)

# Week 3: 보험사 API
- insurance_api.py (권한 부여, 조회, 로그)
```

### Phase 3: 테스트 (2주)
```bash
# Week 1: 기능 테스트
- 데이터 수집 → 블록체인/IPFS 저장
- 보험사 권한 부여 → 조회
- 무결성 검증

# Week 2: 프로덕션 배포
- 보험사 노드 연결
- 모니터링 설정
```

---

## 8. 최종 데이터 흐름

```
[사용자 동의]
  ↓
[블록체인] 약관 동의 해시 기록
  ↓
[Tilko] 건강검진 + 처방전 수집
  ↓
[암호화] AES-256-GCM
  ↓
[IPFS] 암호화 원본 저장
  ↓
[블록체인] 데이터 해시 기록
  ↓
[PostgreSQL] 빠른 조회용 저장
  ↓
[환자] 보험사에 접근 권한 부여
  ↓
[블록체인] 권한 기록 (30일)
  ↓
[보험사] 권한 검증 후 데이터 조회
  ↓
[블록체인] 접근 로그 자동 기록
  ↓
[보험사] 맞춤 보험상품 제안
```

---

**작성일**: 2026-01-13  
**버전**: v3.0 (실제 데이터 기준)
