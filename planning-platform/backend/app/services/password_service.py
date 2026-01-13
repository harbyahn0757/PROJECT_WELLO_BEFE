"""
비밀번호 관리 서비스
8자리 숫자 비밀번호 시스템 (bcrypt 해싱)
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
        print(f"🔐 [비밀번호서비스] 초기화 완료 - DB: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    
    async def check_password_exists(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """비밀번호 설정 여부 및 상태 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT password_hash, password_attempts, password_locked_until, last_access_at
                FROM welno.welno_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.fetchrow(query, uuid, hospital_id)
            await conn.close()
            
            if not result:
                print(f"⚠️ [비밀번호] 환자 정보 없음: {uuid}")
                return {"has_password": False, "attempts": 0, "is_locked": False}
            
            is_locked = False
            lockout_time = None
            
            if result['password_locked_until']:
                is_locked = datetime.now() < result['password_locked_until']
                if is_locked:
                    lockout_time = result['password_locked_until'].isoformat()
            
            has_password = bool(result['password_hash'])
            attempts = result['password_attempts'] or 0
            
            print(f"✅ [비밀번호] 상태 확인 - UUID: {uuid}, 비밀번호: {has_password}, 시도: {attempts}, 잠금: {is_locked}")
            
            return {
                "has_password": has_password,
                "attempts": attempts,
                "is_locked": is_locked,
                "lockout_time": lockout_time,
                "last_access": result['last_access_at'].isoformat() if result['last_access_at'] else None
            }
            
        except Exception as e:
            print(f"❌ [비밀번호] 확인 오류: {e}")
            return {"has_password": False, "attempts": 0, "is_locked": False}
    
    async def set_password(
        self, 
        uuid: str, 
        hospital_id: str, 
        password: str,
        name: Optional[str] = None,
        phone_number: Optional[str] = None,
        birth_date: Optional[str] = None,
        gender: Optional[str] = None
    ) -> bool:
        """비밀번호 설정 (레코드 존재 확인 후 처리)"""
        try:
            # 6자리 숫자 검증
            if not password.isdigit() or len(password) != 6:
                print(f"❌ [비밀번호] 잘못된 형식: {len(password)}자리")
                return False
            
            # bcrypt로 해싱 (라운드 12)
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
            
            conn = await asyncpg.connect(**self.db_config)
            
            # 1. 먼저 레코드 존재 여부 확인
            check_query = """
                SELECT id FROM welno.welno_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            row = await conn.fetchrow(check_query, uuid, hospital_id)
            
            if row:
                # 2-1. 레코드가 있으면 UPDATE
                update_query = """
                    UPDATE welno.welno_patients 
                    SET password_hash = $1, 
                        password_set_at = NOW(),
                        password_attempts = 0,
                        password_locked_until = NULL,
                        updated_at = NOW()
                    WHERE id = $2
                """
                result = await conn.execute(update_query, password_hash.decode('utf-8'), row['id'])
                print(f"✅ [비밀번호] 기존 레코드 업데이트 - ID: {row['id']}, 결과: {result}")
            else:
                # 2-2. 레코드가 없으면 INSERT (필수값 확인)
                if not name or not phone_number or not birth_date:
                    print(f"❌ [비밀번호] 신규 환자 등록 실패 - 필수 정보 부족 (이름/번호/생일)")
                    await conn.close()
                    return False

                # 생년월일 형식 변환 (YYYY-MM-DD)
                try:
                    b_date = datetime.strptime(birth_date, "%Y-%m-%d").date()
                except:
                    try:
                        # 8자리 숫자(YYYYMMDD) 형식인 경우 대응
                        b_date = datetime.strptime(birth_date, "%Y%m%d").date()
                    except:
                        print(f"❌ [비밀번호] 생년월일 형식 오류: {birth_date}")
                        await conn.close()
                        return False

                insert_query = """
                    INSERT INTO welno.welno_patients (
                        uuid, hospital_id, name, phone_number, birth_date, gender,
                        password_hash, password_set_at, 
                        password_attempts, password_locked_until, 
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, NOW(), 0, NULL, NOW(), NOW()
                    )
                """
                result = await conn.execute(
                    insert_query, 
                    uuid, hospital_id, name, phone_number, b_date, gender,
                    password_hash.decode('utf-8')
                )
                print(f"✅ [비밀번호] 새 레코드 생성 및 비밀번호 설정 - UUID: {uuid}, 결과: {result}")
            
            await conn.close()
            return True
            
        except Exception as e:
            print(f"❌ [비밀번호] 설정 오류: {e}")
            return False
    
    async def reset_password(self, uuid: str, hospital_id: str) -> bool:
        """비밀번호 삭제/리셋"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 비밀번호 관련 필드를 NULL로 설정
            query = """
                UPDATE welno.welno_patients 
                SET password_hash = NULL, 
                    password_set_at = NULL,
                    password_attempts = 0,
                    password_locked_until = NULL,
                    updated_at = NOW()
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.execute(query, uuid, hospital_id)
            await conn.close()
            
            success = result.startswith("UPDATE")
            if success:
                print(f"✅ [비밀번호] 리셋 완료 - UUID: {uuid}")
            else:
                print(f"❌ [비밀번호] 리셋 실패 - UUID: {uuid}, 결과: {result}")
            
            return success
            
        except Exception as e:
            print(f"❌ [비밀번호] 리셋 오류: {e}")
            return False
    
    async def verify_password(self, uuid: str, hospital_id: str, password: str) -> Dict[str, Any]:
        """비밀번호 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            # 현재 상태 확인
            check_query = """
                SELECT password_hash, password_attempts, password_locked_until
                FROM welno.welno_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.fetchrow(check_query, uuid, hospital_id)
            
            if not result or not result['password_hash']:
                await conn.close()
                print(f"❌ [비밀번호] 비밀번호 미설정 - UUID: {uuid}")
                return {"success": False, "message": "비밀번호가 설정되지 않았습니다."}
            
            # 잠금 상태 확인
            if result['password_locked_until'] and datetime.now() < result['password_locked_until']:
                await conn.close()
                lockout_time = result['password_locked_until'].isoformat()
                print(f"🔒 [비밀번호] 계정 잠금 상태 - UUID: {uuid}, 해제시간: {lockout_time}")
                return {
                    "success": False, 
                    "message": "너무 많은 시도로 인해 잠금되었습니다. 30분 후 다시 시도해주세요.",
                    "is_locked": True,
                    "lockout_time": lockout_time
                }
            
            # 비밀번호 확인
            stored_hash = result['password_hash'].encode('utf-8')
            if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
                # 성공: 시도 횟수 초기화
                await conn.execute(
                    "SELECT welno.reset_password_attempts($1, $2)", 
                    uuid, hospital_id
                )
                await conn.close()
                print(f"✅ [비밀번호] 확인 성공 - UUID: {uuid}")
                return {"success": True, "message": "비밀번호가 확인되었습니다."}
            else:
                # 실패: 시도 횟수 증가
                new_attempts = await conn.fetchval(
                    "SELECT welno.increment_password_attempts($1, $2)", 
                    uuid, hospital_id
                )
                await conn.close()
                
                print(f"❌ [비밀번호] 확인 실패 - UUID: {uuid}, 시도: {new_attempts}/5")
                
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
    
    async def change_password(self, uuid: str, hospital_id: str, current_password: str, new_password: str) -> Dict[str, Any]:
        """비밀번호 변경"""
        try:
            # 현재 비밀번호 확인
            verify_result = await self.verify_password(uuid, hospital_id, current_password)
            if not verify_result["success"]:
                return {
                    "success": False,
                    "message": "현재 비밀번호가 틀렸습니다.",
                    "attempts": verify_result.get("attempts", 0)
                }
            
            # 새 비밀번호 설정
            set_result = await self.set_password(uuid, hospital_id, new_password)
            if set_result:
                print(f"✅ [비밀번호] 변경 완료 - UUID: {uuid}")
                return {"success": True, "message": "비밀번호가 변경되었습니다."}
            else:
                return {"success": False, "message": "비밀번호 변경에 실패했습니다."}
                
        except Exception as e:
            print(f"❌ [비밀번호] 변경 오류: {e}")
            return {"success": False, "message": "비밀번호 변경 중 오류가 발생했습니다."}
    
    async def should_prompt_password(self, uuid: str, hospital_id: str) -> bool:
        """비밀번호 설정 권유 필요 여부 확인"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            result = await conn.fetchval(
                "SELECT welno.should_prompt_password($1, $2)", 
                uuid, hospital_id
            )
            
            await conn.close()
            
            should_prompt = bool(result)
            print(f"🔍 [비밀번호] 권유 필요 여부 - UUID: {uuid}, 권유: {should_prompt}")
            
            return should_prompt
            
        except Exception as e:
            print(f"❌ [비밀번호] 권유 확인 오류: {e}")
            return False
    
    async def update_last_access(self, uuid: str, hospital_id: str) -> bool:
        """마지막 접근 시간 업데이트"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            await conn.execute(
                "SELECT welno.update_last_access($1, $2)", 
                uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [비밀번호] 접근 시간 업데이트 - UUID: {uuid}")
            return True
            
        except Exception as e:
            print(f"❌ [비밀번호] 접근 시간 업데이트 오류: {e}")
            return False
    
    async def update_password_prompt(self, uuid: str, hospital_id: str) -> bool:
        """비밀번호 권유 시간 업데이트"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            await conn.execute(
                "SELECT welno.update_password_prompt($1, $2)", 
                uuid, hospital_id
            )
            
            await conn.close()
            print(f"✅ [비밀번호] 권유 시간 업데이트 - UUID: {uuid}")
            return True
            
        except Exception as e:
            print(f"❌ [비밀번호] 권유 시간 업데이트 오류: {e}")
            return False
    
    async def get_password_stats(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """비밀번호 관련 통계 정보"""
        try:
            conn = await asyncpg.connect(**self.db_config)
            
            query = """
                SELECT 
                    password_hash IS NOT NULL as has_password,
                    password_set_at,
                    last_password_prompt,
                    password_attempts,
                    password_locked_until,
                    last_access_at,
                    EXTRACT(EPOCH FROM (NOW() - last_access_at))/86400 as days_since_access
                FROM welno.welno_patients 
                WHERE uuid = $1 AND hospital_id = $2
            """
            
            result = await conn.fetchrow(query, uuid, hospital_id)
            await conn.close()
            
            if not result:
                return {}
            
            return {
                "has_password": result['has_password'],
                "password_set_at": result['password_set_at'].isoformat() if result['password_set_at'] else None,
                "last_password_prompt": result['last_password_prompt'].isoformat() if result['last_password_prompt'] else None,
                "password_attempts": result['password_attempts'],
                "password_locked_until": result['password_locked_until'].isoformat() if result['password_locked_until'] else None,
                "last_access_at": result['last_access_at'].isoformat() if result['last_access_at'] else None,
                "days_since_access": float(result['days_since_access']) if result['days_since_access'] else None
            }
            
        except Exception as e:
            print(f"❌ [비밀번호] 통계 조회 오류: {e}")
            return {}
