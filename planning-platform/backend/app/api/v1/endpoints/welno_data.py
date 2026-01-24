"""
WELNO 건강정보 데이터 관리 API
"""

from fastapi import APIRouter, HTTPException, Query, Request, Body
from typing import Dict, Any, Optional, List
from datetime import datetime
from ....services.welno_data_service import welno_data_service

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
    uuid: str
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
        
        # 2. 건강검진 데이터 저장
        health_saved = False
        health_count = 0
        if health_record.get("healthData"):
            health_data_list = health_record["healthData"]
            if isinstance(health_data_list, list) and len(health_data_list) > 0:
                health_saved = await welno_data_service.save_health_data(uuid, hospital_id, {"ResultList": health_data_list}, "")
                health_count = len(health_data_list)
                print(f"📊 [데이터업로드] 건강검진 데이터 저장: {health_count}건, 성공: {health_saved}")
            else:
                print(f"⚠️ [데이터업로드] 건강검진 데이터가 비어있거나 형식 오류: {type(health_data_list)}")
            
        # 3. 처방전 데이터 저장
        prescription_saved = False
        prescription_count = 0
        if health_record.get("prescriptionData"):
            prescription_data_list = health_record["prescriptionData"]
            if isinstance(prescription_data_list, list) and len(prescription_data_list) > 0:
                prescription_saved = await welno_data_service.save_prescription_data(uuid, hospital_id, {"ResultList": prescription_data_list}, "")
                prescription_count = len(prescription_data_list)
                print(f"📊 [데이터업로드] 처방전 데이터 저장: {prescription_count}건, 성공: {prescription_saved}")
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

                asyncio.create_task(
                    generate_mediarc_report_async(
                        patient_uuid=uuid,
                        hospital_id=hospital_id,
                        session_id=None,
                        service=welno_data_service
                    )
                )
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
        await conn.close()
        
        if not row:
            return {
                "success": False,
                "has_report": False,
                "message": "Mediarc 리포트가 없습니다."
            }
        
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
            "report_url": row['report_url'],
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
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """
    Mediarc 질병예측 리포트 생성 요청 (백그라운드 처리)
    
    검진 데이터가 있을 때 호출하면 백그라운드에서 Mediarc API를 호출하여 리포트 생성
    
    Args:
        uuid: 환자 UUID
        hospital_id: 병원 ID
        
    Returns:
        생성 요청 성공 여부 (실제 생성은 백그라운드에서 진행)
    """
    try:
        from ....core.config import settings
        from ....services.welno_data_service import welno_data_service
        import asyncio
        
        print(f"\n{'='*80}")
        print(f"🔄 [Mediarc 생성 요청] 시작")
        print(f"  - uuid: {uuid}")
        print(f"  - hospital_id: {hospital_id}")
        print(f"{'='*80}\n")
        
        # 1. MEDIARC_ENABLED 플래그 확인
        MEDIARC_ENABLED = getattr(settings, 'MEDIARC_ENABLED', False)
        
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
        # questionnaire_codes가 None이면 기본값 자동 추가됨
        # (generate_mediarc_report_async 내부 로직)
        # ─────────────────────────────────────────────────────────────────
        from ....services.mediarc import generate_mediarc_report_async
        
        print(f"🔄 [Mediarc 생성 요청] 백그라운드 태스크 시작")
        
        asyncio.create_task(
            generate_mediarc_report_async(
                patient_uuid=uuid,
                hospital_id=hospital_id,
                session_id=None,  # 수동 생성이므로 session_id 없음
                service=welno_data_service,
                questionnaire_data=questionnaire_codes  # 문진 데이터 포함
            )
        )
        
        print(f"✅ [Mediarc 생성 요청] 백그라운드 태스크 등록 완료")
        print(f"{'='*80}\n")
        
        return {
            "success": True,
            "message": "Mediarc 리포트 생성을 시작했습니다. 완료되면 알림을 받게 됩니다.",
            "generating": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Mediarc 생성 요청] 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"리포트 생성 요청 실패: {str(e)}")
