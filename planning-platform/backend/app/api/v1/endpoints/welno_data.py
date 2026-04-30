"""
WELNO 건강정보 데이터 관리 API
"""

from fastapi import APIRouter, HTTPException, Query, Request, Body, Depends, Header
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
import httpx
from ....services.welno_data_service import welno_data_service
from ....core.security import get_current_user, verify_token
from ....core.patient_access import soft_verify_patient_access

security = HTTPBearer(auto_error=False)  # 토큰이 없어도 에러 발생 안 함 (선택적 인증)

# Python 3.12+ asyncio task GC 방지: 백그라운드 태스크 강한 참조 유지
_background_tasks: set = set()

router = APIRouter()

@router.get("/check-existing-data")
async def check_existing_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """기존 데이터 존재 여부 확인"""
    try:
        result = await welno_data_service.check_existing_data(uuid, hospital_id)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 확인 실패: {str(e)}")

@router.post("/find-patient")
async def find_patient(
    body: Dict[str, str] = Body(..., description="검색 정보 (name, phone_number, birth_date)")
) -> Dict[str, Any]:
    """이름, 전화번호, 생년월일로 기존 환자 조회"""
    try:
        name = body.get("name")
        phone_number = body.get("phone_number")
        birth_date = body.get("birth_date")
        
        if not all([name, phone_number, birth_date]):
            raise HTTPException(status_code=400, detail="필수 정보가 누락되었습니다 (name, phone_number, birth_date)")
            
        result = await welno_data_service.get_patient_by_combo(
            phone_number=phone_number,
            birth_date=birth_date,
            name=name
        )

        # 기존 환자 발견 시 데이터 요약 추가 (맞이 화면용)
        if result and result.get("uuid"):
            try:
                from ....core.database import db_manager
                uuid = result["uuid"]
                # P0 v6: psycopg2 placeholder (%s) 사용 — db_manager.execute_query 는 psycopg2 cursor 기반 (database.py:57-62)
                # asyncpg $1 형식 미지원 → "there is no parameter $1" 에러로 try/except silent 처리되던 이슈 정정
                summary_sql = """
                    SELECT
                        (SELECT count(*) FROM welno.welno_checkup_data WHERE patient_uuid = %s) as health_checkups,
                        (SELECT count(*) FROM welno.welno_prescription_data WHERE patient_uuid = %s) as prescriptions,
                        (SELECT count(*) FROM welno.tb_partner_rag_chat_log WHERE user_uuid = %s) as rag_chats,
                        (SELECT EXISTS(SELECT 1 FROM welno.welno_password_sessions WHERE patient_uuid = %s)) as has_password
                """
                rows = await db_manager.execute_query(summary_sql, (uuid, uuid, uuid, uuid))
                if rows:
                    row = rows[0]
                    # RealDictCursor 반환 시 dict, tuple cursor 시 인덱스 — 양쪽 호환
                    if isinstance(row, dict):
                        result["dataSummary"] = {
                            "healthCheckups": row.get("health_checkups") or 0,
                            "prescriptions": row.get("prescriptions") or 0,
                            "ragChats": row.get("rag_chats") or 0,
                        }
                        result["hasPassword"] = bool(row.get("has_password"))
                    else:
                        result["dataSummary"] = {
                            "healthCheckups": row[0] or 0,
                            "prescriptions": row[1] or 0,
                            "ragChats": row[2] or 0,
                        }
                        result["hasPassword"] = bool(row[3])
            except Exception as e:
                print(f"⚠️ [환자검색] dataSummary 조회 실패 (무시): {e}")

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        print(f"❌ [환자검색] 오류: {e}")
        raise HTTPException(status_code=500, detail=f"환자 조회 실패: {str(e)}")

@router.get("/patient-health-data")
async def get_patient_health_data(
    request: Request,
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
):
    """환자의 모든 건강정보 조회 (조건부 요청 지원)"""
    from fastapi import Response
    import hashlib
    import json
    from datetime import datetime
    
    try:
        result = await welno_data_service.get_patient_health_data(uuid, hospital_id)
        
        # 🔍 [API 로그] 서비스 함수 결과 확인
        print(f"🔍 [API /patient-health-data] 서비스 함수 결과:")
        print(f"  - health_data 개수: {len(result.get('health_data', []))}")
        print(f"  - prescription_data 개수: {len(result.get('prescription_data', []))}")
        print(f"  - error 존재: {'error' in result}")
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        # Last-Modified 헤더 (마지막 업데이트 시간) - result에서 가져오기
        last_update = result.get('patient', {}).get('last_data_update') or result.get('last_update')
        if last_update:
            if isinstance(last_update, str):
                try:
                    last_modified = datetime.fromisoformat(last_update.replace('Z', '+00:00'))
                except:
                    last_modified = datetime.now()
            elif isinstance(last_update, datetime):
                last_modified = last_update
            else:
                last_modified = datetime.now()
        else:
            last_modified = datetime.now()
        
        # 데이터 해시 생성 (ETag용) - last_update 이후에 생성
        def json_serializer(obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            elif hasattr(obj, '__dict__'):
                return obj.__dict__
            else:
                return str(obj)
        
        try:
            data_str = json.dumps(result, sort_keys=True, ensure_ascii=False, default=json_serializer)
            data_hash = hashlib.sha256(data_str.encode('utf-8')).hexdigest()
            etag = f'"{data_hash}"'
            print(f"✅ [API /patient-health-data] JSON 직렬화 성공, 데이터 길이: {len(data_str)} 문자")
        except Exception as json_err:
            print(f"❌ [API /patient-health-data] JSON 직렬화 실패: {json_err}")
            import traceback
            traceback.print_exc()
            # JSON 직렬화 실패 시 기본 응답 반환
            return {
                "success": True,
                "data": {
                    "patient": result.get("patient", {}),
                    "health_data": result.get("health_data", []),  # 빈 배열이 아닌 실제 데이터
                    "prescription_data": result.get("prescription_data", [])
                }
            }
        
        # 조건부 요청 처리 (데이터가 변경되었을 때만 304 반환)
        if_none_match = request.headers.get('If-None-Match')
        if_modified_since = request.headers.get('If-Modified-Since')
        
        # ETag 비교 (304 Not Modified) - 정확한 ETag 비교만 수행
        if if_none_match and if_none_match.strip('"') == etag.strip('"'):
            print(f"⚠️ [API /patient-health-data] 304 Not Modified (ETag 일치)")
            return Response(status_code=304, headers={
                "ETag": etag,
                "Cache-Control": "private, max-age=300"
            })
        
        # Last-Modified 비교 (304 Not Modified) - 정확한 비교만 수행
        if if_modified_since and last_update:
            try:
                if_modified_dt = datetime.strptime(if_modified_since, '%a, %d %b %Y %H:%M:%S %Z')
                if last_modified <= if_modified_dt:
                    print(f"⚠️ [API /patient-health-data] 304 Not Modified (Last-Modified)")
                    return Response(status_code=304, headers={
                        "ETag": etag,
                        "Last-Modified": last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT'),
                        "Cache-Control": "private, max-age=300"
                    })
            except Exception as date_parse_err:
                print(f"⚠️ [API /patient-health-data] Last-Modified 파싱 실패, 무시: {date_parse_err}")
                pass  # 파싱 실패 시 무시하고 전체 데이터 반환
        
        # 🔍 [API 로그] 응답 데이터 확인
        print(f"🔍 [API /patient-health-data] 응답 데이터 구조:")
        print(f"  - result.health_data 개수: {len(result.get('health_data', []))}")
        print(f"  - result.prescription_data 개수: {len(result.get('prescription_data', []))}")
        
        # 응답 생성 (헤더 포함)
        response_data = {
            "success": True,
            "data": result
        }
        
        print(f"🔍 [API /patient-health-data] response_data 생성 후:")
        print(f"  - response_data.data.health_data 개수: {len(response_data['data'].get('health_data', []))}")
        print(f"  - response_data.data.prescription_data 개수: {len(response_data['data'].get('prescription_data', []))}")
        
        try:
            # JSON 직렬화 전에 데이터 확인
            health_data_list = response_data['data'].get('health_data', [])
            print(f"🔍 [API /patient-health-data] JSON 직렬화 전 health_data_list 타입: {type(health_data_list)}, 길이: {len(health_data_list)}")
            if health_data_list:
                print(f"  - 첫 번째 항목 타입: {type(health_data_list[0])}")
                print(f"  - 첫 번째 항목 키: {list(health_data_list[0].keys())[:10] if isinstance(health_data_list[0], dict) else 'N/A'}")
            
            # JSON 직렬화를 위한 커스텀 default 함수
            def json_serializer(obj):
                if isinstance(obj, (datetime, date)):
                    return obj.isoformat()
                elif hasattr(obj, '__dict__'):
                    return obj.__dict__
                else:
                    return str(obj)
            
            response_content = json.dumps(response_data, ensure_ascii=False, default=json_serializer)
            print(f"✅ [API /patient-health-data] 응답 JSON 직렬화 성공, 길이: {len(response_content)} 문자")
            
            # 직렬화된 JSON을 다시 파싱해서 확인
            parsed_back = json.loads(response_content)
            print(f"🔍 [API /patient-health-data] JSON 파싱 후 확인:")
            print(f"  - parsed_back.data.health_data 개수: {len(parsed_back.get('data', {}).get('health_data', []))}")
            print(f"  - parsed_back.data.prescription_data 개수: {len(parsed_back.get('data', {}).get('prescription_data', []))}")
            
            response = Response(
                content=response_content,
                media_type="application/json",
                headers={
                    "ETag": etag,
                    "Last-Modified": last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT'),
                    "Cache-Control": "private, max-age=300",  # 5분 캐시
                }
            )
            
            return response
        except Exception as json_err:
            print(f"❌ [API /patient-health-data] 응답 JSON 직렬화 실패: {json_err}")
            import traceback
            traceback.print_exc()
            # JSON 직렬화 실패 시 기본 응답 반환
            return {
                "success": True,
                "data": {
                    "patient": result.get("patient", {}),
                    "health_data": result.get("health_data", []),  # 빈 배열이 아닌 실제 데이터
                    "prescription_data": result.get("prescription_data", [])
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 조회 실패: {str(e)}")

@router.get("/drug-detail/{drug_code}")
async def get_drug_detail(
    drug_code: str
) -> Dict[str, Any]:
    """약품 상세정보 조회"""
    try:
        result = await welno_data_service.get_drug_detail(drug_code)
        
        if not result:
            raise HTTPException(status_code=404, detail="약품 정보를 찾을 수 없습니다")
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"약품 정보 조회 실패: {str(e)}")

@router.get("/patients/{uuid}")
async def get_patient_info(
    uuid: str,
    _soft_verified: str = Depends(soft_verify_patient_access),  # Phase 1 Soft Lock
) -> Dict[str, Any]:
    """환자 정보 조회"""
    try:
        result = await welno_data_service.get_patient_by_uuid(uuid)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"환자 정보 조회 실패: {str(e)}")

@router.get("/hospitals/{hospital_id}")
async def get_hospital_info(
    hospital_id: str
) -> Dict[str, Any]:
    """병원 정보 조회"""
    try:
        result = await welno_data_service.get_hospital_by_id(hospital_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 정보 조회 실패: {str(e)}")

@router.get("/login")
async def login_patient(
    uuid: str = Query(..., description="환자 UUID"),
    hospital: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """환자 로그인 처리"""
    try:
        # 환자 정보 조회 및 로그인 처리
        result = await welno_data_service.login_patient(uuid, hospital)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 실패: {str(e)}")

@router.post("/upload-health-data")
async def upload_health_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    partner_id: str = Query("welno", description="파트너 ID"),  # 파트너 ID 추가
    health_record: Dict[str, Any] = Body(..., description="건강 데이터 레코드")
) -> Dict[str, Any]:
    """IndexedDB의 데이터를 서버로 업로드"""
    try:
        # 1. 환자 정보 업데이트/확인
        user_info = {
            "name": health_record.get("patientName"),
            "phone_number": health_record.get("phone"),
            "birth_date": health_record.get("birthday"),
            "gender": health_record.get("gender")
        }
        await welno_data_service.save_patient_data(uuid, hospital_id, user_info, "")
        
        # 2. 건강검진 데이터 저장 (IndexedDB 출처로 표시)
        health_saved = False
        health_count = 0
        if health_record.get("healthData"):
            health_data_list = health_record["healthData"]
            if isinstance(health_data_list, list) and len(health_data_list) > 0:
                health_saved = await welno_data_service.save_health_data(
                    uuid, hospital_id, {"ResultList": health_data_list}, "", 
                    data_source='indexeddb'
                )
                health_count = len(health_data_list)
                print(f"📊 [데이터업로드] 건강검진 데이터 저장: {health_count}건, 성공: {health_saved} (출처: indexeddb)")
            else:
                print(f"⚠️ [데이터업로드] 건강검진 데이터가 비어있거나 형식 오류: {type(health_data_list)}")
            
        # 3. 처방전 데이터 저장 (IndexedDB 출처로 표시)
        prescription_saved = False
        prescription_count = 0
        if health_record.get("prescriptionData"):
            prescription_data_list = health_record["prescriptionData"]
            if isinstance(prescription_data_list, list) and len(prescription_data_list) > 0:
                prescription_saved = await welno_data_service.save_prescription_data(
                    uuid, hospital_id, {"ResultList": prescription_data_list}, "", 
                    data_source='indexeddb'
                )
                prescription_count = len(prescription_data_list)
                print(f"📊 [데이터업로드] 처방전 데이터 저장: {prescription_count}건, 성공: {prescription_saved} (출처: indexeddb)")
            else:
                print(f"⚠️ [데이터업로드] 처방전 데이터가 비어있거나 형식 오류: {type(prescription_data_list)}")
        
        # 4. 캠페인 결제 유저인 경우 리포트 자동 생성 트리거
        try:
            import asyncpg
            from ....core.config import settings
            from ....services.mediarc import generate_mediarc_report_async
            import asyncio
            
            # DB 연결
            conn = await asyncpg.connect(
                host=settings.DB_HOST if hasattr(settings, 'DB_HOST') else '10.0.1.10',
                port=settings.DB_PORT if hasattr(settings, 'DB_PORT') else 5432,
                database=settings.DB_NAME if hasattr(settings, 'DB_NAME') else 'p9_mkt_biz',
                user=settings.DB_USER if hasattr(settings, 'DB_USER') else 'peernine',
                password=settings.DB_PASSWORD if hasattr(settings, 'DB_PASSWORD') else 'autumn3334!'
            )
            
            # 결제 완료된 캠페인 주문 확인
            query = """
                SELECT oid, partner_id 
                FROM welno.tb_campaign_payments 
                WHERE uuid = $1 AND status = 'COMPLETED'
                ORDER BY created_at DESC LIMIT 1
            """
            order = await conn.fetchrow(query, uuid)
            await conn.close()
            
            if order:
                print(f"🚀 [데이터업로드] 캠페인 결제 확인됨 (oid: {order['oid']}) -> 리포트 생성 시작")
                
                # DB 상태 업데이트: 리포트 생성 중
                from .campaign_payment import update_pipeline_step
                update_pipeline_step(order['oid'], 'REPORT_WAITING')

                _report_task = asyncio.create_task(
                    generate_mediarc_report_async(
                        patient_uuid=uuid,
                        hospital_id=hospital_id,
                        session_id=None,
                        partner_id=partner_id,
                        service=welno_data_service
                    )
                )
                _background_tasks.add(_report_task)
                _report_task.add_done_callback(_background_tasks.discard)
        except Exception as campaign_err:
            print(f"⚠️ [데이터업로드] 캠페인 리포트 트리거 실패: {campaign_err}")

        return {
            "success": True,
            "message": "데이터가 성공적으로 업로드되었습니다.",
            "health_data_saved": health_saved,
            "health_data_count": health_count,
            "prescription_data_saved": prescription_saved,
            "prescription_data_count": prescription_count
        }
    except Exception as e:
        print(f"❌ [데이터업로드] 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health-trends")
async def get_health_trends(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    metrics: Optional[str] = Query(None, description="조회할 지표 (comma-separated): height,weight,bmi,blood_pressure,blood_sugar,cholesterol")
) -> Dict[str, Any]:
    """건강 지표 추이 데이터 조회"""
    try:
        # 🔍 [API 로그] 요청 파라미터 확인
        print(f"🔍 [API /health-trends] 요청 파라미터: uuid={uuid}, hospital_id={hospital_id}, metrics={metrics}")
        
        # 환자 데이터 조회
        patient_data = await welno_data_service.get_patient_health_data(uuid, hospital_id)
        
        if "error" in patient_data:
            print(f"❌ [API /health-trends] 환자 데이터 조회 실패: {patient_data['error']}")
            raise HTTPException(status_code=404, detail=patient_data["error"])
        
        health_data = patient_data.get("health_data", [])
        
        # 🔍 [API 로그] 조회된 건강검진 데이터 구조 확인
        print(f"🔍 [API /health-trends] 조회된 건강검진 데이터 개수: {len(health_data)}")
        if health_data:
            print(f"🔍 [API /health-trends] 첫 번째 데이터 샘플:")
            first_item = health_data[0]
            print(f"  - year: {first_item.get('year')}")
            print(f"  - checkup_date: {first_item.get('checkup_date')}")
            print(f"  - location: {first_item.get('location')}")
            print(f"  - raw_data 존재 여부: {bool(first_item.get('raw_data'))}")
            if first_item.get('raw_data'):
                raw_data = first_item.get('raw_data')
                print(f"  - raw_data 타입: {type(raw_data)}")
                if isinstance(raw_data, dict):
                    print(f"  - raw_data 키: {list(raw_data.keys())[:10]}")  # 처음 10개 키만
                    if 'Inspections' in raw_data:
                        inspections = raw_data.get('Inspections', [])
                        print(f"  - Inspections 개수: {len(inspections) if isinstance(inspections, list) else 0}")
                        if isinstance(inspections, list) and len(inspections) > 0:
                            first_inspection = inspections[0]
                            if isinstance(first_inspection, dict) and 'Illnesses' in first_inspection:
                                illnesses = first_inspection.get('Illnesses', [])
                                print(f"  - 첫 번째 Inspection의 Illnesses 개수: {len(illnesses) if isinstance(illnesses, list) else 0}")
                                if isinstance(illnesses, list) and len(illnesses) > 0:
                                    first_illness = illnesses[0]
                                    if isinstance(first_illness, dict) and 'Items' in first_illness:
                                        items = first_illness.get('Items', [])
                                        print(f"  - 첫 번째 Illness의 Items 개수: {len(items) if isinstance(items, list) else 0}")
                                        if isinstance(items, list) and len(items) > 0:
                                            first_item = items[0]
                                            if isinstance(first_item, dict):
                                                print(f"  - 첫 번째 Item Name: {first_item.get('Name')}")
                                                print(f"  - 첫 번째 Item Value: {first_item.get('Value')}")
                                                print(f"  - 첫 번째 Item ItemReferences 존재: {bool(first_item.get('ItemReferences'))}")
                                                if first_item.get('ItemReferences'):
                                                    refs = first_item.get('ItemReferences', [])
                                                    print(f"  - ItemReferences 개수: {len(refs) if isinstance(refs, list) else 0}")
                                                    if isinstance(refs, list):
                                                        for ref in refs[:3]:  # 처음 3개만
                                                            if isinstance(ref, dict):
                                                                print(f"    - {ref.get('Name')}: {ref.get('Value')}")
        
        # 요청된 지표 파싱
        requested_metrics = []
        if metrics:
            requested_metrics = [m.strip() for m in metrics.split(",")]
        else:
            requested_metrics = ["height", "weight", "bmi", "blood_pressure", "blood_sugar", "cholesterol"]
        
        # 추이 데이터 구성
        trends = {}
        for record in health_data:
            year = record.get("year", "")
            checkup_date = record.get("checkup_date", "")
            date_key = f"{year} {checkup_date}"
            
            # 각 지표별 데이터 추출
            if "height" in requested_metrics and record.get("height"):
                if "height" not in trends:
                    trends["height"] = {"label": "신장 (cm)", "unit": "cm", "data": []}
                trends["height"]["data"].append({
                    "date": date_key,
                    "value": float(record["height"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
            
            if "weight" in requested_metrics and record.get("weight"):
                if "weight" not in trends:
                    trends["weight"] = {"label": "체중 (kg)", "unit": "kg", "data": []}
                trends["weight"]["data"].append({
                    "date": date_key,
                    "value": float(record["weight"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
            
            if "bmi" in requested_metrics and record.get("bmi"):
                if "bmi" not in trends:
                    trends["bmi"] = {"label": "BMI (kg/m²)", "unit": "kg/m²", "data": []}
                trends["bmi"]["data"].append({
                    "date": date_key,
                    "value": float(record["bmi"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
            
            if "blood_pressure" in requested_metrics and record.get("blood_pressure_high") and record.get("blood_pressure_low"):
                if "blood_pressure" not in trends:
                    trends["blood_pressure"] = {"label": "혈압 (mmHg)", "unit": "mmHg", "data": []}
                trends["blood_pressure"]["data"].append({
                    "date": date_key,
                    "high": int(record["blood_pressure_high"]),
                    "low": int(record["blood_pressure_low"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
            
            if "blood_sugar" in requested_metrics and record.get("blood_sugar"):
                if "blood_sugar" not in trends:
                    trends["blood_sugar"] = {"label": "공복혈당 (mg/dL)", "unit": "mg/dL", "data": []}
                trends["blood_sugar"]["data"].append({
                    "date": date_key,
                    "value": int(record["blood_sugar"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
            
            if "cholesterol" in requested_metrics and record.get("cholesterol"):
                if "cholesterol" not in trends:
                    trends["cholesterol"] = {"label": "총콜레스테롤 (mg/dL)", "unit": "mg/dL", "data": []}
                trends["cholesterol"]["data"].append({
                    "date": date_key,
                    "value": int(record["cholesterol"]),
                    "year": year,
                    "checkup_date": checkup_date
                })
        
        # 데이터 정렬 (날짜순)
        for metric_key in trends:
            trends[metric_key]["data"].sort(key=lambda x: (x.get("year", ""), x.get("checkup_date", "")))
        
        # 🔍 [API 로그] 응답 데이터 구조 확인
        print(f"🔍 [API /health-trends] 응답 데이터 구조:")
        print(f"  - trends 키: {list(trends.keys())}")
        for metric_key, metric_data in trends.items():
            print(f"  - {metric_key}: {len(metric_data.get('data', []))}개 데이터 포인트")
        
        return {
            "success": True,
            "data": {
                "patient": patient_data.get("patient", {}),
                "trends": trends,
                "total_records": len(health_data)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"추이 데이터 조회 실패: {str(e)}")

@router.get("/prescription-history")
async def get_prescription_history(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    limit: Optional[int] = Query(50, description="조회할 최대 건수")
) -> Dict[str, Any]:
    """처방전 이력 조회"""
    try:
        # 환자 데이터 조회
        patient_data = await welno_data_service.get_patient_health_data(uuid, hospital_id)
        
        if "error" in patient_data:
            raise HTTPException(status_code=404, detail=patient_data["error"])
        
        prescription_data = patient_data.get("prescription_data", [])
        
        # 최신순 정렬 및 제한
        prescription_data.sort(key=lambda x: x.get("treatment_date") or "1900-01-01", reverse=True)
        if limit:
            prescription_data = prescription_data[:limit]
        
        # 병원별 그룹화
        hospitals = {}
        for record in prescription_data:
            hospital_name = record.get("hospital_name", "알 수 없는 병원")
            if hospital_name not in hospitals:
                hospitals[hospital_name] = {
                    "hospital_name": hospital_name,
                    "address": record.get("address", ""),
                    "total_visits": 0,
                    "prescriptions": []
                }
            
            hospitals[hospital_name]["total_visits"] += record.get("visit_count", 0) or 0
            hospitals[hospital_name]["prescriptions"].append({
                "treatment_date": record.get("treatment_date"),
                "treatment_type": record.get("treatment_type"),
                "visit_count": record.get("visit_count"),
                "prescription_count": record.get("prescription_count"),
                "medication_count": record.get("medication_count"),
                "detail_records_count": record.get("detail_records_count", 0),
                "raw_data": record.get("raw_data")
            })
        
        return {
            "success": True,
            "data": {
                "patient": patient_data.get("patient", {}),
                "hospitals": list(hospitals.values()),
                "total_records": len(prescription_data)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"처방전 이력 조회 실패: {str(e)}")

@router.post("/refresh-data")
async def refresh_patient_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """환자 데이터 새로고침 (재인증 필요)"""
    try:
        # 기존 데이터 확인
        existing_data = await welno_data_service.check_existing_data(uuid, hospital_id)
        
        return {
            "success": True,
            "message": "데이터 새로고침을 위해 재인증이 필요합니다.",
            "data": {
                "existing_data": existing_data,
                "auth_required": True,
                "auth_url": f"/welno/login?uuid={uuid}&hospital={hospital_id}&refresh=true"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 새로고침 실패: {str(e)}")

@router.delete("/patient-health-data")
async def delete_patient_health_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """환자의 건강검진 및 처방전 데이터 삭제"""
    try:
        result = await welno_data_service.delete_patient_health_data(uuid, hospital_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "데이터 삭제 실패"))
        
        return {
            "success": True,
            "message": "건강데이터가 삭제되었습니다.",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 삭제 실패: {str(e)}")

@router.post("/terms-agreement")
async def save_terms_agreement(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    terms_agreement: Dict[str, Any] = Body(..., description="약관 동의 정보")
) -> Dict[str, Any]:
    """약관 동의 저장"""
    try:
        result = await welno_data_service.save_terms_agreement(uuid, hospital_id, terms_agreement)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "약관 동의 저장 실패"))
        
        return {
            "success": True,
            "message": "약관 동의가 저장되었습니다.",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"약관 동의 저장 실패: {str(e)}")

@router.get("/mediarc-report")
async def get_mediarc_report(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """
    Mediarc 질병예측 리포트 조회
    
    Args:
        uuid: 환자 UUID
        hospital_id: 병원 ID
        
    Returns:
        Mediarc 리포트 데이터 (bodyage, rank, disease_data, cancer_data 등)
    """
    try:
        import asyncpg
        from ....core.config import settings
        
        # DB 연결
        conn = await asyncpg.connect(
            host=settings.DB_HOST if hasattr(settings, 'DB_HOST') else '10.0.1.10',
            port=settings.DB_PORT if hasattr(settings, 'DB_PORT') else 5432,
            database=settings.DB_NAME if hasattr(settings, 'DB_NAME') else 'p9_mkt_biz',
            user=settings.DB_USER if hasattr(settings, 'DB_USER') else 'peernine',
            password=settings.DB_PASSWORD if hasattr(settings, 'DB_PASSWORD') else 'autumn3334!'
        )
        
        # Mediarc 리포트 조회
        query = """
            SELECT 
                id, patient_uuid, hospital_id, raw_response, mkt_uuid, report_url,
                provider, analyzed_at, bodyage, rank, disease_data, cancer_data,
                has_questionnaire, questionnaire_data, created_at, updated_at
            FROM welno.welno_mediarc_reports
            WHERE patient_uuid = $1 AND hospital_id = $2
            ORDER BY created_at DESC
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, uuid, hospital_id)
        
        if not row:
            await conn.close()
            return {
                "success": False,
                "has_report": False,
                "message": "Mediarc 리포트가 없습니다."
            }
        
        # URL 만료 확인 및 재생성
        report_url = row['report_url']
        if report_url:
            try:
                import httpx
                # URL 접근 테스트 (HEAD 요청)
                async with httpx.AsyncClient(timeout=5.0) as client:
                    test_response = await client.head(report_url, follow_redirects=True)
                    if test_response.status_code == 403:
                        # Access Denied - URL 만료
                        print(f"⚠️ [Mediarc조회] 리포트 URL 만료 감지, raw_response에서 재확인 시도...")
                        
                        # raw_response에서 원본 URL 확인
                        raw_response = row['raw_response']
                        if raw_response and isinstance(raw_response, dict):
                            # raw_response에서 report_url 추출 시도
                            original_url = None
                            if 'data' in raw_response and isinstance(raw_response['data'], dict):
                                original_url = raw_response['data'].get('report_url')
                            elif 'report_url' in raw_response:
                                original_url = raw_response.get('report_url')
                            
                            if original_url and original_url != report_url:
                                # 다른 URL이 있으면 테스트
                                test_response2 = await client.head(original_url, follow_redirects=True)
                                if test_response2.status_code == 200:
                                    report_url = original_url
                                    print(f"✅ [Mediarc조회] raw_response에서 유효한 URL 발견")
                                else:
                                    print(f"⚠️ [Mediarc조회] raw_response의 URL도 만료됨")
                            else:
                                print(f"⚠️ [Mediarc조회] raw_response에서 다른 URL을 찾을 수 없음")
                    elif test_response.status_code == 200:
                        print(f"✅ [Mediarc조회] 리포트 URL 유효함")
            except Exception as url_check_error:
                print(f"⚠️ [Mediarc조회] URL 확인 중 오류 (무시하고 계속): {url_check_error}")
        
        await conn.close()
        
        # 데이터 변환 (Decimal, datetime, JSONB 처리)
        import json as json_lib
        
        def convert_value(obj):
            # JSONB가 문자열로 온 경우 파싱
            if isinstance(obj, str):
                try:
                    obj = json_lib.loads(obj)
                except:
                    return obj
            
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_value(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_value(i) for i in obj]
            else:
                return obj
        
        report_data = {
            "id": row['id'],
            "patient_uuid": row['patient_uuid'],
            "hospital_id": row['hospital_id'],
            "mkt_uuid": row['mkt_uuid'],
            "report_url": report_url,  # 확인/갱신된 URL 사용
            "provider": row['provider'],
            "analyzed_at": row['analyzed_at'].isoformat() if row['analyzed_at'] else None,
            "bodyage": row['bodyage'],
            "rank": row['rank'],
            "disease_data": convert_value(row['disease_data']),
            "cancer_data": convert_value(row['cancer_data']),
            "has_questionnaire": row['has_questionnaire'],
            "questionnaire_data": convert_value(row['questionnaire_data']),
            "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None,
        }
        
        print(f"✅ [Mediarc조회] 리포트 조회 성공: bodyage={report_data['bodyage']}, rank={report_data['rank']}")
        
        return {
            "success": True,
            "has_report": True,
            "data": report_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Mediarc조회] 오류: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Mediarc 리포트 조회 실패: {str(e)}")

@router.post("/mediarc-report/generate")
async def generate_mediarc_report(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    partner_id: str = Query("welno", description="파트너 ID"),  # 파트너 ID 추가
    session_id: Optional[str] = Query(None, description="세션 ID (WebSocket 알림용, 선택)")
) -> Dict[str, Any]:
    """
    Mediarc 질병예측 리포트 생성 요청 (백그라운드 처리)
    
    검진 데이터가 있을 때 호출하면 백그라운드에서 Mediarc API를 호출하여 리포트 생성
    
    Args:
        uuid: 환자 UUID
        hospital_id: 병원 ID
        session_id: 세션 ID (선택, WebSocket 알림을 위해 전달 가능)
        
    Returns:
        생성 요청 성공 여부 (실제 생성은 백그라운드에서 진행)
    """
    try:
        from ....core.config import settings
        from ....services.welno_data_service import welno_data_service
        import asyncio
        
        print(f"\n{'='*80}")
        print(f"🔄 [Mediarc 수동 생성 요청] 시작")
        print(f"  - uuid: {uuid}")
        print(f"  - hospital_id: {hospital_id}")
        print(f"  - session_id: {session_id or '없음 (WebSocket 알림 skip)'}")
        print(f"{'='*80}\n")
        
        # 1. 파트너별 Mediarc 설정 확인
        from app.services.dynamic_config_service import dynamic_config
        partner_id = request.headers.get("X-Partner-ID", "welno")
        mediarc_config = await dynamic_config.get_mediarc_config(partner_id)
        MEDIARC_ENABLED = mediarc_config["enabled"]
        
        if not MEDIARC_ENABLED:
            print(f"⚠️ [Mediarc 생성 요청] 기능 비활성화 (MEDIARC_ENABLED=False)")
            return {
                "success": False,
                "message": "Mediarc 기능이 비활성화되어 있습니다"
            }
        
        # 2. 검진 데이터 존재 확인
        health_data = await welno_data_service.get_patient_health_data(uuid, hospital_id)
        
        if "error" in health_data:
            print(f"❌ [Mediarc 생성 요청] 환자를 찾을 수 없음")
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        health_count = len(health_data.get('health_data', []))
        
        if health_count == 0:
            print(f"⚠️ [Mediarc 생성 요청] 검진 데이터가 없음")
            return {
                "success": False,
                "message": "검진 데이터가 없습니다. 먼저 건강검진 데이터를 수집해주세요."
            }
        
        print(f"✅ [Mediarc 생성 요청] 검진 데이터 확인: {health_count}건")
        
        # 3. 검진설계 문진 데이터 조회 (케이스 2: 질병예측 시 설계 문진 활용)
        # ─────────────────────────────────────────────────────────────────
        # 사용자가 이전에 검진설계를 완료했다면, 그때 작성한 문진 데이터를
        # 자동으로 Mediarc 리포트 생성에 반영합니다.
        #
        # 장점:
        # - 사용자가 문진을 다시 작성할 필요 없음
        # - 검진설계 문진이 더 상세하고 정확함
        # - 일관성 있는 데이터 활용
        # ─────────────────────────────────────────────────────────────────
        questionnaire_codes = None
        
        try:
            # 검진설계 문진 조회
            design_survey = await welno_data_service.load_checkup_design_survey(uuid, hospital_id)
            
            if design_survey:
                print(f"📋 [Mediarc 생성] 검진설계 문진 발견 → Mediarc 코드로 변환")
                
                # 문진 데이터를 Mediarc 코드로 변환
                from ....services.mediarc.questionnaire_mapper import map_checkup_design_survey_to_mediarc
                questionnaire_codes = map_checkup_design_survey_to_mediarc(design_survey)
                
                print(f"✅ [Mediarc 생성] 문진 변환 완료:")
                print(f"   - 흡연: {questionnaire_codes.get('smoke')}")
                print(f"   - 음주: {questionnaire_codes.get('drink')}")
                print(f"   - 가족력: {len(questionnaire_codes.get('family', []))}개")
            else:
                print(f"ℹ️ [Mediarc 생성] 검진설계 문진 없음 → 기본값 사용")
                
        except Exception as e:
            print(f"⚠️ [Mediarc 생성] 문진 조회 실패 (기본값 사용): {e}")
            questionnaire_codes = None
        
        # 4. 백그라운드에서 Mediarc 리포트 생성
        # ─────────────────────────────────────────────────────────────────
        # ✅ session_id가 있으면 WebSocket 알림 전송
        # ❌ session_id가 없으면 WebSocket 알림 skip (폴링으로 확인)
        # ─────────────────────────────────────────────────────────────────
        from ....services.mediarc import generate_mediarc_report_async
        
        print(f"🚀 [Mediarc 수동 생성] 백그라운드 태스크 등록")
        if session_id:
            print(f"   → WebSocket 알림 활성화 (session_id={session_id})")
        else:
            print(f"   → WebSocket 알림 비활성화 (폴링으로 확인 필요)")
        
        asyncio.create_task(
            generate_mediarc_report_async(
                patient_uuid=uuid,
                hospital_id=hospital_id,
                session_id=session_id,  # ✅ session_id 전달 (있으면 WebSocket, 없으면 skip)
                partner_id=partner_id,  # ⭐ 파트너 ID 전달 (보안 강화)
                service=welno_data_service,
                questionnaire_data=questionnaire_codes  # 문진 데이터 포함
            )
        )
        
        print(f"✅ [Mediarc 수동 생성] 백그라운드 태스크 등록 완료")
        print(f"{'='*80}\n")
        
        return {
            "success": True,
            "message": "Mediarc 리포트 생성을 시작했습니다. 완료되면 알림을 받게 됩니다.",
            "generating": True,
            "has_websocket": session_id is not None  # 프론트엔드에서 폴링 여부 판단용
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Mediarc 생성 요청] 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"리포트 생성 요청 실패: {str(e)}")

@router.get("/mediarc-report/download")
async def download_mediarc_report(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> StreamingResponse:
    """
    Mediarc 리포트 PDF 다운로드 (프록시 + 접근 제어)
    
    Presigned URL을 통해 리포트를 다운로드하고 프록시로 전달합니다.
    CORS 문제와 URL 만료 문제를 해결하며, 접근 제어를 수행합니다.
    
    접근 제어:
    - JWT 토큰이 있으면: 토큰의 uuid와 요청 uuid 일치 확인
    - 토큰이 없으면: DB에서 환자 정보 존재 확인 (약한 인증)
    
    Args:
        uuid: 환자 UUID
        hospital_id: 병원 ID
        credentials: JWT 토큰 (선택적)
        
    Returns:
        PDF 파일 스트림
    """
    try:
        import asyncpg
        from ....core.config import settings
        
        # ============================================
        # 1. 접근 제어: UUID 소유권 확인
        # ============================================
        if credentials:
            # JWT 토큰이 있는 경우: 토큰의 uuid와 요청 uuid 일치 확인
            try:
                token_payload = verify_token(credentials.credentials)
                token_uuid = token_payload.get("sub")  # JWT의 subject (uuid)
                
                if token_uuid != uuid:
                    print(f"⚠️ [다운로드 프록시] 접근 거부: 토큰 UUID({token_uuid}) != 요청 UUID({uuid})")
                    raise HTTPException(
                        status_code=403,
                        detail="다른 사용자의 리포트에 접근할 수 없습니다."
                    )
                
                print(f"✅ [다운로드 프록시] JWT 토큰 인증 성공: uuid={uuid}")
            except HTTPException:
                raise
            except Exception as e:
                print(f"⚠️ [다운로드 프록시] 토큰 검증 실패 (다른 방식으로 확인): {str(e)}")
                # 토큰 검증 실패해도 계속 진행 (DB 확인으로 대체)
        else:
            # 토큰이 없는 경우: DB에서 환자 정보 존재 확인 (약한 인증)
            print(f"ℹ️ [다운로드 프록시] JWT 토큰 없음, DB 확인으로 대체")
        
        # DB 연결
        conn = await asyncpg.connect(
            host=settings.DB_HOST if hasattr(settings, 'DB_HOST') else '10.0.1.10',
            port=settings.DB_PORT if hasattr(settings, 'DB_PORT') else 5432,
            database=settings.DB_NAME if hasattr(settings, 'DB_NAME') else 'p9_mkt_biz',
            user=settings.DB_USER if hasattr(settings, 'DB_USER') else 'peernine',
            password=settings.DB_PASSWORD if hasattr(settings, 'DB_PASSWORD') else 'autumn3334!'
        )
        
        # 환자 정보 확인 (접근 제어)
        patient_check = await conn.fetchrow(
            "SELECT id, uuid FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            uuid, hospital_id
        )
        
        # 환자 정보가 없어도 리포트는 있을 수 있음 (파트너 케이스 등)
        # 하지만 최소한 리포트가 해당 uuid에 속하는지 확인
        report_check = await conn.fetchrow(
            """
            SELECT 
                report_url, raw_response, patient_uuid
            FROM welno.welno_mediarc_reports
            WHERE patient_uuid = $1 AND hospital_id = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            uuid, hospital_id
        )
        
        if not report_check:
            await conn.close()
            raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다.")
        
        # 환자 정보가 있고, 리포트의 patient_uuid와 일치하는지 확인
        if patient_check and report_check['patient_uuid'] != uuid:
            await conn.close()
            raise HTTPException(
                status_code=403,
                detail="리포트 접근 권한이 없습니다."
            )
        
        row = report_check
        await conn.close()
        
        # report_url 확인
        report_url = row['report_url']
        
        # raw_response에서 URL 확인 (만료된 경우 대비)
        if not report_url or report_url == '':
            raw_response = row['raw_response']
            if raw_response and isinstance(raw_response, dict):
                report_url = raw_response.get('report_url') or (raw_response.get('data', {}) or {}).get('report_url')
        
        if not report_url:
            raise HTTPException(status_code=404, detail="리포트 URL을 찾을 수 없습니다.")
        
        print(f"📥 [다운로드 프록시] 리포트 다운로드 시작: {report_url[:100]}...")
        
        # Presigned URL에서 파일 다운로드
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            try:
                response = await client.get(report_url)
                response.raise_for_status()
                
                # Content-Type 확인
                content_type = response.headers.get('content-type', 'application/pdf')
                
                # 파일명 생성 (한글 인코딩 처리)
                from urllib.parse import quote
                filename_base = f"질병예측리포트_{uuid[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
                filename_encoded = quote(filename_base.encode('utf-8'))
                
                print(f"✅ [다운로드 프록시] 다운로드 성공: {len(response.content)} bytes")
                
                # 스트리밍 응답 반환 (RFC 5987 형식으로 한글 파일명 인코딩)
                return StreamingResponse(
                    iter([response.content]),
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}",
                        "Content-Length": str(len(response.content))
                    }
                )
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    print(f"❌ [다운로드 프록시] URL 만료 (403): {report_url[:100]}...")
                    raise HTTPException(
                        status_code=410,
                        detail="리포트 URL이 만료되었습니다. 리포트를 다시 생성해주세요."
                    )
                else:
                    print(f"❌ [다운로드 프록시] HTTP 오류: {e.response.status_code}")
                    raise HTTPException(
                        status_code=502,
                        detail=f"리포트 다운로드 실패: HTTP {e.response.status_code}"
                    )
            except httpx.TimeoutException:
                print(f"❌ [다운로드 프록시] 타임아웃")
                raise HTTPException(status_code=504, detail="리포트 다운로드 타임아웃")
            except Exception as e:
                print(f"❌ [다운로드 프록시] 오류: {str(e)}")
                raise HTTPException(status_code=500, detail=f"리포트 다운로드 실패: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [다운로드 프록시] 예외: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"리포트 다운로드 처리 실패: {str(e)}")
