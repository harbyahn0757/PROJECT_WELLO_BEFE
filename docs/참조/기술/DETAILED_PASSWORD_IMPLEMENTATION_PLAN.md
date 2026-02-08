# 🔐 비밀번호 시스템 구체적 구현 계획

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: 비밀번호 시스템 구체적 구현 계획 (MainPage·API·DB)

---

## 📍 **1. MainPage.tsx 수정 위치**

**파일**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend/src/pages/MainPage.tsx`

### **수정 위치**: `handleCardClick` 함수 (107-156줄)

```typescript
// 현재 코드 (125-130줄)
if (result.data && result.data.exists && (result.data.health_data_count > 0 || result.data.prescription_data_count > 0)) {
  console.log('📊 [메인페이지] 기존 데이터 발견! 결과 페이지로 이동');
  navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
  return;
}

// 수정 후 코드
if (result.data && result.data.exists && (result.data.health_data_count > 0 || result.data.prescription_data_count > 0)) {
  console.log('📊 [메인페이지] 기존 데이터 발견! 비밀번호 확인 후 이동');
  
  // 🔐 비밀번호 확인 로직 추가
  const passwordCheck = await PasswordService.checkPassword(uuid, hospitalId);
  if (passwordCheck.success && passwordCheck.data?.hasPassword) {
    // 비밀번호가 설정되어 있으면 비밀번호 입력 모달 표시
    setPasswordModalState({
      isOpen: true,
      type: 'confirm',
      uuid,
      hospitalId,
      onSuccess: () => {
        navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
      }
    });
  } else {
    // 비밀번호가 없으면 바로 이동
    navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
  }
  
  // 마지막 접근 시간 업데이트
  await PasswordService.updateLastAccess(uuid, hospitalId);
  return;
}
```

### **추가할 상태 및 임포트**

```typescript
// 임포트 추가 (1-8줄 사이)
import { PasswordModal } from '../components/PasswordModal';
import { PasswordService } from '../components/PasswordModal/PasswordService';
import { PasswordModalType } from '../components/PasswordModal/types';

// 상태 추가 (14줄 이후)
const [passwordModalState, setPasswordModalState] = useState({
  isOpen: false,
  type: 'confirm' as PasswordModalType,
  uuid: '',
  hospitalId: '',
  onSuccess: () => {}
});

// 비밀번호 설정 권유 상태
const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
```

### **JSX에 모달 추가 (303줄 이후)**

```typescript
return (
  <>
    {layoutConfig.layoutType === LayoutType.HORIZONTAL 
      ? renderHorizontalContent()
      : renderVerticalContent()}
    
    {/* 🔐 비밀번호 모달 */}
    <PasswordModal
      isOpen={passwordModalState.isOpen}
      onClose={() => setPasswordModalState(prev => ({ ...prev, isOpen: false }))}
      type={passwordModalState.type}
      uuid={passwordModalState.uuid}
      hospitalId={passwordModalState.hospitalId}
      onSuccess={passwordModalState.onSuccess}
    />
    
    {/* 🔐 비밀번호 설정 권유 모달 */}
    {showPasswordPrompt && (
      <PasswordPromptModal
        isOpen={showPasswordPrompt}
        onClose={() => setShowPasswordPrompt(false)}
        onAccept={() => {
          setPasswordModalState({
            isOpen: true,
            type: 'setup',
            uuid: passwordModalState.uuid,
            hospitalId: passwordModalState.hospitalId,
            onSuccess: () => setShowPasswordPrompt(false)
          });
        }}
        onDecline={() => {
          PasswordService.updatePasswordPrompt(passwordModalState.uuid, passwordModalState.hospitalId);
          setShowPasswordPrompt(false);
        }}
      />
    )}
  </>
);
```

---

## 📍 **2. AuthForm.tsx 수정 위치**

**파일**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend/src/components/AuthForm.tsx`

### **수정 위치**: `onAuthCompleted` 콜백 (203-242줄)

```typescript
// 현재 코드 (224-227줄)
setCurrentStatus('completed');
setTimeout(() => {
  navigate('/results');
}, 1000);

// 수정 후 코드
setCurrentStatus('completed');

// 🔐 비밀번호 설정 제안 로직 추가
const urlParams = new URLSearchParams(window.location.search);
const uuid = urlParams.get('uuid');
const hospitalId = urlParams.get('hospital');

if (uuid && hospitalId) {
  // 비밀번호 설정 여부 확인
  const passwordCheck = await PasswordService.checkPassword(uuid, hospitalId);
  if (!passwordCheck.data?.hasPassword) {
    // 비밀번호가 설정되지 않았으면 설정 제안
    setShowPasswordSetupPrompt(true);
    setPasswordSetupData({ uuid, hospitalId });
    
    setTimeout(() => {
      navigate('/results');
    }, 3000); // 3초 후 자동 이동
    return;
  }
}

setTimeout(() => {
  navigate('/results');
}, 1000);
```

### **추가할 상태 및 임포트**

```typescript
// 임포트 추가 (1-8줄 사이)
import { PasswordSetupPromptModal } from './PasswordModal/PasswordSetupPromptModal';
import { PasswordService } from './PasswordModal/PasswordService';

// 상태 추가 (44줄 이후)
const [showPasswordSetupPrompt, setShowPasswordSetupPrompt] = useState(false);
const [passwordSetupData, setPasswordSetupData] = useState({ uuid: '', hospitalId: '' });
```

---

## 📍 **3. 백엔드 API 구현 위치**

### **A. 새 파일 생성**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/api/v1/endpoints/password.py`

```python
"""
비밀번호 관리 API 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import bcrypt
import re

from app.services.password_service import PasswordService
from app.dependencies import get_password_service

router = APIRouter(prefix="/patients/{patient_uuid}/password", tags=["password"])

class PasswordSetRequest(BaseModel):
    password: str

class PasswordVerifyRequest(BaseModel):
    password: str

class PasswordChangeRequest(BaseModel):
    currentPassword: str
    newPassword: str

@router.get("/check")
async def check_password(
    patient_uuid: str,
    hospital_id: str = Query(...),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 설정 여부 확인"""
    try:
        result = await password_service.check_password_exists(patient_uuid, hospital_id)
        return {
            "success": True,
            "data": {
                "hasPassword": result.get("has_password", False),
                "attempts": result.get("attempts", 0),
                "isLocked": result.get("is_locked", False),
                "lockoutTime": result.get("lockout_time")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"비밀번호 확인 실패: {str(e)}")

@router.post("/set")
async def set_password(
    patient_uuid: str,
    request: PasswordSetRequest,
    hospital_id: str = Query(...),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 설정"""
    try:
        # 8자리 숫자 검증
        if not re.match(r'^\d{8}$', request.password):
            raise HTTPException(status_code=400, detail="비밀번호는 정확히 8자리 숫자여야 합니다.")
        
        success = await password_service.set_password(patient_uuid, hospital_id, request.password)
        if success:
            return {"success": True, "message": "비밀번호가 설정되었습니다."}
        else:
            raise HTTPException(status_code=400, detail="비밀번호 설정에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"비밀번호 설정 실패: {str(e)}")

@router.post("/verify")
async def verify_password(
    patient_uuid: str,
    request: PasswordVerifyRequest,
    hospital_id: str = Query(...),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 확인"""
    try:
        result = await password_service.verify_password(patient_uuid, hospital_id, request.password)
        
        if result["success"]:
            return {"success": True, "message": "비밀번호가 확인되었습니다."}
        else:
            return {
                "success": False,
                "message": result["message"],
                "data": {
                    "attempts": result.get("attempts", 0),
                    "isLocked": result.get("is_locked", False),
                    "lockoutTime": result.get("lockout_time")
                }
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"비밀번호 확인 실패: {str(e)}")
```

### **B. 새 파일 생성**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/services/password_service.py`

```python
"""
비밀번호 관리 서비스
"""

import bcrypt
import asyncpg
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from app.core.config import settings

class PasswordService:
    """비밀번호 관리 서비스"""
    
    def __init__(self):
        self.db_config = {
            'host': settings.DB_HOST,
            'port': settings.DB_PORT,
            'user': settings.DB_USER,
            'password': settings.DB_PASSWORD,
            'database': settings.DB_NAME,
        }
    
    async def check_password_exists(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """비밀번호 설정 여부 및 상태 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT password_hash, password_attempts, password_locked_until
                FROM wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.fetchrow(query, uuid, hospital_id)
            await conn.close()
            
            if not result:
                return {"has_password": False, "attempts": 0, "is_locked": False}
            
            is_locked = False
            lockout_time = None
            
            if result['password_locked_until']:
                is_locked = datetime.now() < result['password_locked_until']
                if is_locked:
                    lockout_time = result['password_locked_until'].isoformat()
            
            return {
                "has_password": bool(result['password_hash']),
                "attempts": result['password_attempts'] or 0,
                "is_locked": is_locked,
                "lockout_time": lockout_time
            }
            
        except Exception as e:
            print(f"❌ [비밀번호] 확인 오류: {e}")
            return {"has_password": False, "attempts": 0, "is_locked": False}
    
    async def set_password(self, uuid: str, hospital_id: str, password: str) -> bool:
        """비밀번호 설정"""
        try:
            # bcrypt로 해싱
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
            
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                UPDATE wello_patients 
                SET password_hash = $1, 
                    password_set_at = NOW(),
                    password_attempts = 0,
                    password_locked_until = NULL,
                    updated_at = NOW()
                WHERE uuid = $2 AND hospital_id = $3
            """
            
            result = await conn.execute(query, password_hash.decode('utf-8'), uuid, hospital_id)
            await conn.close()
            
            return result == "UPDATE 1"
            
        except Exception as e:
            print(f"❌ [비밀번호] 설정 오류: {e}")
            return False
    
    async def verify_password(self, uuid: str, hospital_id: str, password: str) -> Dict[str, Any]:
        """비밀번호 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 현재 상태 확인
            check_query = """
                SELECT password_hash, password_attempts, password_locked_until
                FROM wello_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.fetchrow(check_query, uuid, hospital_id)
            
            if not result or not result['password_hash']:
                await conn.close()
                return {"success": False, "message": "비밀번호가 설정되지 않았습니다."}
            
            # 잠금 상태 확인
            if result['password_locked_until'] and datetime.now() < result['password_locked_until']:
                await conn.close()
                return {
                    "success": False, 
                    "message": "너무 많은 시도로 인해 잠금되었습니다. 30분 후 다시 시도해주세요.",
                    "is_locked": True,
                    "lockout_time": result['password_locked_until'].isoformat()
                }
            
            # 비밀번호 확인
            if bcrypt.checkpw(password.encode('utf-8'), result['password_hash'].encode('utf-8')):
                # 성공: 시도 횟수 초기화
                await conn.execute(
                    "SELECT reset_password_attempts($1, $2)", 
                    uuid, hospital_id
                )
                await conn.close()
                return {"success": True, "message": "비밀번호가 확인되었습니다."}
            else:
                # 실패: 시도 횟수 증가
                new_attempts = await conn.fetchval(
                    "SELECT increment_password_attempts($1, $2)", 
                    uuid, hospital_id
                )
                await conn.close()
                
                if new_attempts >= 5:
                    return {
                        "success": False, 
                        "message": "비밀번호가 틀렸습니다. 5회 실패로 30분간 잠금됩니다.",
                        "attempts": new_attempts,
                        "is_locked": True
                    }
                else:
                    return {
                        "success": False, 
                        "message": f"비밀번호가 틀렸습니다. ({new_attempts}/5회 시도)",
                        "attempts": new_attempts
                    }
            
        except Exception as e:
            print(f"❌ [비밀번호] 확인 오류: {e}")
            return {"success": False, "message": "비밀번호 확인 중 오류가 발생했습니다."}
```

### **C. 기존 파일 수정**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/models/wello_models.py`

```python
# 16-47줄 WelloPatient 클래스에 필드 추가

class WelloPatient(Base):
    """환자 기본정보 테이블"""
    __tablename__ = "wello_patients"
    
    # ... 기존 필드들 ...
    
    # 🔐 비밀번호 관련 필드 추가 (42줄 이후)
    password_hash = Column(String(255), nullable=True)  # bcrypt 해시
    password_set_at = Column(DateTime(timezone=True), nullable=True)  # 설정 시간
    last_password_prompt = Column(DateTime(timezone=True), nullable=True)  # 마지막 권유 시간
    password_attempts = Column(Integer, default=0)  # 연속 실패 횟수
    password_locked_until = Column(DateTime(timezone=True), nullable=True)  # 잠금 해제 시간
    last_access_at = Column(DateTime(timezone=True), nullable=True)  # 마지막 접근 시간
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### **D. 라우터 등록**: `/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/api/v1/api.py`

```python
# 기존 임포트에 추가
from app.api.v1.endpoints import password

# 라우터 등록 (기존 라우터들과 함께)
api_router.include_router(password.router, prefix="/v1")
```

---

## 📍 **4. 컴포넌트 구현 순서**

### **1단계: 기본 컴포넌트**
- `PasswordKeypad.tsx` - 카카오페이 스타일 키패드
- `PasswordDots.tsx` - 비밀번호 입력 표시
- `PasswordModal/styles.scss` - 베이지 색상 스타일

### **2단계: 모달 컴포넌트**
- `PasswordSetupModal.tsx` - 비밀번호 설정 (2회 입력)
- `PasswordConfirmModal.tsx` - 비밀번호 확인
- `PasswordPromptModal.tsx` - 설정 권유 모달

### **3단계: 통합 컴포넌트**
- `PasswordModal/index.tsx` - 메인 모달 (타입별 분기)

---

## 📍 **5. 스타일 가이드**

### **색상 시스템** (기존 `_variables.scss` 활용)
```scss
// 비밀번호 모달 전용 색상
$password-beige: #f7e8d3;        // 배경색
$password-brown: #7c746a;        // 브랜드 브라운
$password-brown-hover: #696158;  // 호버 상태
$password-gray: #a0aec0;         // 비활성 텍스트
$password-error: #f56565;        // 오류 상태
$password-success: #48bb78;      // 성공 상태
```

### **키패드 레이아웃**
```
[1] [2] [3]
[4] [5] [6]  
[7] [8] [9]
[←] [0] [✓]
```

---

## 📍 **6. 보안 정책**

### **프론트엔드**
- 8자리 숫자만 허용
- 입력 중 마스킹 (●●●●●●●●)
- 자동 완성 비활성화
- 메모리에서 즉시 제거

### **백엔드**
- bcrypt 해싱 (라운드 12)
- 5회 실패 시 30분 잠금
- SQL 인젝션 방지
- 로그에 비밀번호 노출 금지

---

## 📍 **7. 테스트 시나리오**

### **A. 신규 사용자**
1. Tilko 인증 완료
2. 비밀번호 설정 제안 모달
3. 8자리 숫자 2회 입력
4. 설정 완료 후 결과 페이지 이동

### **B. 기존 사용자 (비밀번호 설정됨)**
1. "내 검진 결과 추이" 클릭
2. 비밀번호 입력 모달
3. 8자리 숫자 입력
4. 확인 후 결과 페이지 이동

### **C. 오랜만에 접근**
1. 30일 이상 미접근 + 비밀번호 미설정
2. 비밀번호 설정 권유 모달
3. 수락/거절 선택
4. 수락 시 설정 프로세스 진행

### **D. 보안 테스트**
1. 5회 연속 실패
2. 30분 잠금 확인
3. 잠금 해제 후 정상 동작 확인

이 계획에 따라 단계별로 구현하시겠습니까?
