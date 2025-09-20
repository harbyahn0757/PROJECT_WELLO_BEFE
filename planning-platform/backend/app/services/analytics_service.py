"""
분석 서비스
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta
from ..models.entities import Patient, Hospital
from ..repositories.interfaces import IPatientRepository, IHospitalRepository
from .exceptions import AnalyticsError


class AnalyticsService:
    """데이터 분석 서비스"""
    
    def __init__(self, patient_repository: IPatientRepository, hospital_repository: IHospitalRepository):
        self.patient_repository = patient_repository
        self.hospital_repository = hospital_repository
    
    def get_patient_demographics(self) -> Dict[str, Any]:
        """환자 인구통계 분석"""
        try:
            patients = self.patient_repository.get_all()
            
            total_count = len(patients)
            if total_count == 0:
                return {"total": 0, "demographics": {}}
            
            # 성별 분포
            gender_counts = {}
            age_groups = {"20대": 0, "30대": 0, "40대": 0, "50대": 0, "60대+": 0}
            
            for patient in patients:
                # 성별 집계
                gender = patient.gender.value if hasattr(patient.gender, 'value') else str(patient.gender)
                gender_counts[gender] = gender_counts.get(gender, 0) + 1
                
                # 연령대 집계
                age = patient.age
                if 20 <= age < 30:
                    age_groups["20대"] += 1
                elif 30 <= age < 40:
                    age_groups["30대"] += 1
                elif 40 <= age < 50:
                    age_groups["40대"] += 1
                elif 50 <= age < 60:
                    age_groups["50대"] += 1
                else:
                    age_groups["60대+"] += 1
            
            return {
                "total": total_count,
                "demographics": {
                    "gender": gender_counts,
                    "age_groups": age_groups
                }
            }
            
        except Exception as e:
            raise AnalyticsError(f"인구통계 분석 중 오류 발생: {str(e)}")
    
    def get_hospital_statistics(self) -> Dict[str, Any]:
        """병원별 통계"""
        try:
            hospitals = self.hospital_repository.get_all()
            patients = self.patient_repository.get_all()
            
            # 병원별 환자 수 집계
            hospital_patient_counts = {}
            for patient in patients:
                hospital_id = patient.hospital.hospital_id
                hospital_patient_counts[hospital_id] = hospital_patient_counts.get(hospital_id, 0) + 1
            
            # 병원별 상세 정보
            hospital_stats = []
            for hospital in hospitals:
                patient_count = hospital_patient_counts.get(hospital.hospital_id, 0)
                hospital_stats.append({
                    "hospital_id": hospital.hospital_id,
                    "name": hospital.name,
                    "patient_count": patient_count,
                    "layout_type": hospital.layout_type.value if hasattr(hospital.layout_type, 'value') else str(hospital.layout_type)
                })
            
            return {
                "total_hospitals": len(hospitals),
                "total_patients": len(patients),
                "hospital_details": hospital_stats
            }
            
        except Exception as e:
            raise AnalyticsError(f"병원 통계 분석 중 오류 발생: {str(e)}")
    
    def get_recent_activity(self, days: int = 30) -> Dict[str, Any]:
        """최근 활동 분석"""
        try:
            # 간단한 더미 데이터 반환 (실제로는 로그 데이터 분석)
            return {
                "period_days": days,
                "total_logins": 0,
                "active_patients": 0,
                "popular_checkup_types": []
            }
            
        except Exception as e:
            raise AnalyticsError(f"활동 분석 중 오류 발생: {str(e)}")

