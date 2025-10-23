"""
WELLO 건강정보 데이터 관리 API
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
from datetime import datetime
from ....services.wello_data_service import wello_data_service

router = APIRouter()

@router.get("/check-existing-data")
async def check_existing_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """기존 데이터 존재 여부 확인"""
    try:
        result = await wello_data_service.check_existing_data(uuid, hospital_id)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 확인 실패: {str(e)}")

@router.get("/patient-health-data")
async def get_patient_health_data(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
) -> Dict[str, Any]:
    """환자의 모든 건강정보 조회"""
    try:
        result = await wello_data_service.get_patient_health_data(uuid, hospital_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return {
            "success": True,
            "data": result
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
        result = await wello_data_service.get_drug_detail(drug_code)
        
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
        result = await wello_data_service.get_patient_by_uuid(uuid)
        
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
        result = await wello_data_service.get_hospital_by_id(hospital_id)
        
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
        result = await wello_data_service.login_patient(uuid, hospital)
        
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

@router.post("/tilko/session/{session_id}/collect-data")
async def collect_tilko_data(
    session_id: str
) -> Dict[str, Any]:
    """Tilko 세션으로부터 건강 데이터 수집"""
    try:
        result = await wello_data_service.collect_tilko_data(session_id)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 수집 실패: {str(e)}")

@router.get("/health-trends")
async def get_health_trends(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    metrics: Optional[str] = Query(None, description="조회할 지표 (comma-separated): height,weight,bmi,blood_pressure,blood_sugar,cholesterol")
) -> Dict[str, Any]:
    """건강 지표 추이 데이터 조회"""
    try:
        # 환자 데이터 조회
        patient_data = await wello_data_service.get_patient_health_data(uuid, hospital_id)
        
        if "error" in patient_data:
            raise HTTPException(status_code=404, detail=patient_data["error"])
        
        health_data = patient_data.get("health_data", [])
        
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
        patient_data = await wello_data_service.get_patient_health_data(uuid, hospital_id)
        
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
        existing_data = await wello_data_service.check_existing_data(uuid, hospital_id)
        
        return {
            "success": True,
            "message": "데이터 새로고침을 위해 재인증이 필요합니다.",
            "data": {
                "existing_data": existing_data,
                "auth_required": True,
                "auth_url": f"/wello/login?uuid={uuid}&hospital={hospital_id}&refresh=true"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 새로고침 실패: {str(e)}")
