"""
동적 설정 관리 서비스
하드코딩된 파트너/병원 설정을 DB에서 동적으로 조회하는 서비스
"""

from typing import Optional, Dict, Any, Tuple, List
import logging
import asyncio
from datetime import datetime
from functools import lru_cache
from ..core.database import db_manager
from ..utils.partner_config import get_partner_config, get_partner_config_by_api_key

logger = logging.getLogger(__name__)


class DynamicConfigService:
    """동적 설정 관리 서비스"""
    
    @staticmethod
    async def get_default_hospital_id(partner_id: str = "welno") -> str:
        """
        파트너별 기본 병원 ID 조회 (비동기)
        
        Args:
            partner_id: 파트너 ID (기본: welno)
            
        Returns:
            기본 병원 ID
        """
        try:
            # 파트너 설정에서 기본 병원 ID 조회
            config = get_partner_config(partner_id)
            if config and config.get("config", {}).get("default_hospital_id"):
                return config["config"]["default_hospital_id"]
            
            # 파트너별 활성 병원 중 첫 번째 조회
            query = """
                SELECT hospital_id 
                FROM welno.tb_hospital_rag_config 
                WHERE partner_id = %s AND is_active = true AND hospital_id != '*'
                ORDER BY created_at ASC 
                LIMIT 1
            """
            result = await db_manager.execute_one(query, (partner_id,))
            if result:
                return result["hospital_id"]
            
            # 마스터 테이블에서 활성 병원 조회
            query = """
                SELECT hospital_id 
                FROM welno.welno_hospitals 
                WHERE is_active = true 
                ORDER BY created_at ASC 
                LIMIT 1
            """
            result = await db_manager.execute_one(query)
            if result:
                return result["hospital_id"]
            
            # 최후의 수단: 하드코딩된 기본값
            logger.warning(f"파트너 {partner_id}의 기본 병원 ID를 찾을 수 없음, PEERNINE 사용")
            return "PEERNINE"
            
        except Exception as e:
            logger.error(f"기본 병원 ID 조회 실패: {e}")
            return "PEERNINE"
    
    @staticmethod
    async def get_mediarc_config(partner_id: str = "welno") -> Dict[str, Any]:
        """
        파트너별 Mediarc 설정 조회
        
        Args:
            partner_id: 파트너 ID
            
        Returns:
            Mediarc 설정 딕셔너리
        """
        try:
            config = get_partner_config(partner_id)
            if config:
                mediarc_config = config.get("config", {}).get("mediarc", {})
                if mediarc_config:
                    return {
                        "enabled": mediarc_config.get("enabled", True),
                        "api_url": mediarc_config.get("api_url", "https://xogxog.com/api/external/mediarc/report/"),
                        "api_key": mediarc_config.get("api_key", "welno_5a9bb40b5108ecd8ef864658d5a2d5ab")
                    }
            
            # 기본값 반환
            return {
                "enabled": True,
                "api_url": "https://xogxog.com/api/external/mediarc/report/",
                "api_key": "welno_5a9bb40b5108ecd8ef864658d5a2d5ab"
            }
            
        except Exception as e:
            logger.error(f"Mediarc 설정 조회 실패: {e}")
            return {
                "enabled": False,
                "api_url": "",
                "api_key": ""
            }
    
    @staticmethod
    def get_partner_by_api_key(api_key: str) -> Optional[str]:
        """
        API Key로 파트너 ID 조회
        
        Args:
            api_key: API Key
            
        Returns:
            파트너 ID 또는 None
        """
        try:
            config = get_partner_config_by_api_key(api_key)
            return config["partner_id"] if config else None
        except Exception as e:
            logger.error(f"API Key 기반 파트너 조회 실패: {e}")
            return None
    
    @staticmethod
    async def get_hospital_config(partner_id: str, hospital_id: str) -> Optional[Dict[str, Any]]:
        """
        병원별 설정 조회 (비동기)

        전화번호는 DB 폴백 없이 클라이언트(파트너 위젯)에서 전달된 값만 사용.
        DB contact_phone 컬럼은 관리용 참조값일 뿐 AI 응답에는 사용하지 않음.

        Args:
            partner_id: 파트너 ID
            hospital_id: 병원 ID

        Returns:
            병원 설정 딕셔너리 또는 None
        """
        try:
            query = """
                SELECT partner_id, hospital_id, hospital_name, persona_prompt, welcome_message,
                       llm_config, embedding_config, theme_config, is_active
                FROM welno.tb_hospital_rag_config
                WHERE partner_id = %s AND hospital_id = %s AND is_active = true
            """
            config = await db_manager.execute_one(query, (partner_id, hospital_id))

            # DB contact_phone 폴백 제거 — 전화번호는 클라이언트 전달 데이터만 사용

            return config
        except Exception as e:
            logger.error(f"병원 설정 조회 실패: {e}")
            return None

    @staticmethod
    async def get_partner_metadata(partner_id: str, hospital_id: Optional[str] = None) -> Dict[str, Any]:
        """파트너 및 특정 병원 메타데이터 조회 (테마, 전화번호 등)"""
        try:
            # 1. 특정 병원 설정 우선 조회
            config = None
            if hospital_id and hospital_id != '*':
                query_specific = """
                    SELECT hospital_name, welcome_message, theme_config, contact_phone
                    FROM welno.tb_hospital_rag_config
                    WHERE partner_id = %s AND hospital_id = %s AND is_active = true
                """
                config = await db_manager.execute_one(query_specific, (partner_id, hospital_id))
            
            # 2. 특정 병원 설정이 없으면 파트너 공통 설정('*') 조회
            if not config:
                query_common = """
                    SELECT hospital_name, welcome_message, theme_config, contact_phone
                    FROM welno.tb_hospital_rag_config
                    WHERE partner_id = %s AND hospital_id = '*' AND is_active = true
                """
                config = await db_manager.execute_one(query_common, (partner_id,))
            
            # ⚠️ 등록된 설정이 전혀 없는 경우
            if not config:
                # 미등록 병원 자동 등록 후 재조회
                await DynamicConfigService.auto_register_hospital(partner_id, hospital_id or "*")
                config = await db_manager.execute_one(query_common, (partner_id,))
                if not config:
                    return {"is_not_found": True}
            
            # DB에 설정된 전화번호 처리 (하드코딩 폴백 없음 → 없으면 빈값)
            phone = config.get('contact_phone') if config else ""

            return {
                "partner_name": config['hospital_name'] if config else partner_id,
                "phone_number": phone or "",
                "welcome_message": config['welcome_message'] if config else "안녕하세요.",
                "theme": config['theme_config'] if config else {}
            }
        except Exception as e:
            logger.error(f"파트너 메타데이터 조회 실패: {e}")
            return {"partner_name": partner_id, "phone_number": "", "welcome_message": "안녕하세요.", "theme": {}}
    
    @staticmethod
    def clear_cache():
        """캐시 클리어 (비동기 함수는 캐시 없음)"""
        # 비동기 함수로 변경되어 @lru_cache 제거됨
        # 필요시 Redis 등 외부 캐시 시스템 사용 고려
        pass

    @staticmethod
    async def auto_register_hospital(partner_id: str, hospital_id: str, hospital_name: str = None):
        """미등록 병원 자동 등록 (welno_hospitals + tb_hospital_rag_config에 INSERT)"""
        try:
            # 1. welno_hospitals에 INSERT (hospital_id가 PK)
            await db_manager.execute_update("""
                INSERT INTO welno.welno_hospitals (hospital_id, partner_id, hospital_name, created_at)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (hospital_id) DO UPDATE SET hospital_name = EXCLUDED.hospital_name
            """, (hospital_id, partner_id, hospital_name or hospital_id))

            # 2. tb_hospital_rag_config에 INSERT (파트너의 '*' 기본설정 복제)
            await db_manager.execute_update("""
                INSERT INTO welno.tb_hospital_rag_config (
                    partner_id, hospital_id, hospital_name,
                    persona_prompt, welcome_message, llm_config, embedding_config, theme_config,
                    is_active, created_at
                )
                SELECT %s, %s, %s,
                    persona_prompt, welcome_message, llm_config, embedding_config, theme_config,
                    true, CURRENT_TIMESTAMP
                FROM welno.tb_hospital_rag_config
                WHERE partner_id = %s AND hospital_id = '*'
                ON CONFLICT (partner_id, hospital_id) DO UPDATE SET hospital_name = EXCLUDED.hospital_name
            """, (partner_id, hospital_id, hospital_name or hospital_id, partner_id))

            # 3. pending 테이블에 이력 기록
            await db_manager.execute_update("""
                INSERT INTO welno.tb_pending_hospital_registration (partner_id, hospital_id, request_count, status, last_seen_at)
                VALUES (%s, %s, 1, 'auto_registered', CURRENT_TIMESTAMP)
                ON CONFLICT (partner_id, hospital_id)
                DO UPDATE SET 
                    request_count = welno.tb_pending_hospital_registration.request_count + 1,
                    status = 'auto_registered',
                    last_seen_at = EXCLUDED.last_seen_at
            """, (partner_id, hospital_id))
            logger.info(f"📝 [미등록 병원] 로그 기록 완료: {partner_id} / {hospital_id}")
        except Exception as e:
            logger.error(f"⚠️ [미등록 병원] 로그 기록 실패: {e}")

    @staticmethod
    async def update_hospital_name(partner_id: str, hospital_id: str, hospital_name: str):
        """자동 등록된 병원의 이름을 파트너 데이터에서 추출한 실제 이름으로 업데이트"""
        if not hospital_name or not hospital_id or hospital_id == '*':
            return
        try:
            # 현재 이름이 해시 ID 그대로인 경우에만 업데이트 (수동 설정 보호)
            result = await db_manager.execute_one("""
                SELECT hospital_name FROM welno.tb_hospital_rag_config
                WHERE partner_id = %s AND hospital_id = %s
            """, (partner_id, hospital_id))
            if result and result['hospital_name'] != hospital_name:
                current_name = result['hospital_name']
                # 자동 생성된 이름이면 파트너 데이터 기준으로 업데이트
                is_auto_name = (
                    current_name == hospital_id
                    or len(current_name) >= 64
                    or current_name.startswith('(미확인')
                    or current_name.startswith('(병원코드')
                )
                if is_auto_name:
                    await db_manager.execute_update("""
                        UPDATE welno.tb_hospital_rag_config
                        SET hospital_name = %s WHERE partner_id = %s AND hospital_id = %s
                    """, (hospital_name, partner_id, hospital_id))
                    await db_manager.execute_update("""
                        UPDATE welno.welno_hospitals
                        SET hospital_name = %s WHERE hospital_id = %s
                    """, (hospital_name, hospital_id))
                    logger.info(f"✅ [병원명 업데이트] {partner_id}/{hospital_id[:16]}... → {hospital_name}")
        except Exception as e:
            logger.warning(f"⚠️ [병원명 업데이트] 실패: {e}")


# 전역 인스턴스
dynamic_config = DynamicConfigService()