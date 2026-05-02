/**
 * 건강 데이터 로더 유틸리티
 * HealthDataViewer의 데이터 로드 패턴을 공용으로 추출
 * API 우선, IndexedDB 폴백 방식으로 데이터 로드
 */
import { API_ENDPOINTS } from '../config/api';
import { WelnoIndexedDB } from '../services/WelnoIndexedDB';
import { simplifyDataForLog } from './debugUtils';

export interface HealthDataLoadResult {
  healthData: { ResultList: any[] };
  prescriptionData: { ResultList: any[] };
  lastUpdate?: string;
}

/**
 * 건강 데이터 로드 (HealthDataViewer 패턴 재사용)
 * 1. API에서 데이터 조회
 * 2. 성공 시 IndexedDB에 저장
 * 3. 실패 시 IndexedDB에서 폴백
 */
export const loadHealthData = async (
  uuid: string,
  hospital: string,
  patientName?: string
): Promise<HealthDataLoadResult> => {
  console.log('📊 [데이터로더] DB에서 저장된 데이터 로드 시도:', { uuid, hospital });

  // P0 v8: hospital_id 불일치 자동 재시도 (알림톡 hex hospital → 실제 환자 hospital 매칭)
  const fetchHealthDataWithRetry = async (currentHospital: string): Promise<{ resp: Response; result: any; effectiveHospital: string }> => {
    const r = await fetch(API_ENDPOINTS.HEALTH_DATA(uuid, currentHospital));
    if (!r.ok) return { resp: r, result: null, effectiveHospital: currentHospital };
    const j = await r.json();
    // BE 가 hospital_id_mismatch 응답 + actual_hospital_id 제공 시 한 번 재시도
    const actual = j?.data?.actual_hospital_id || j?.actual_hospital_id;
    if ((j?.data?.hospital_id_mismatch || j?.hospital_id_mismatch) && actual && actual !== currentHospital) {
      console.warn(`🔁 [데이터로더] hospital_id 불일치 → 실제 hospital(${actual})로 재시도`);
      const r2 = await fetch(API_ENDPOINTS.HEALTH_DATA(uuid, actual));
      if (r2.ok) {
        const j2 = await r2.json();
        return { resp: r2, result: j2, effectiveHospital: actual };
      }
    }
    return { resp: r, result: j, effectiveHospital: currentHospital };
  };

  try {
    // 1. API에서 데이터 조회 (우선) — 불일치 시 자동 재시도
    const { resp: response, result: resultPre, effectiveHospital } = await fetchHealthDataWithRetry(hospital);

    if (response.ok) {
      const result = resultPre || await response.json();
      // 🔧 디버깅용 간소화된 데이터 로그 (이미지 데이터는 키만 표시)
      const simplifiedResult = simplifyDataForLog(result);
      console.log('✅ [데이터로더] DB 데이터 로드 성공:', simplifiedResult);

      if (result.success && result.data) {
        const { health_data, prescription_data } = result.data;
        
        // 🔍 [프론트엔드 로그] API 응답 데이터 구조 확인
        console.log('🔍 [데이터로더] API 응답 데이터 구조:');
        console.log(`  - health_data 개수: ${health_data?.length || 0}`);
        console.log(`  - prescription_data 개수: ${prescription_data?.length || 0}`);
        
        // DB 데이터를 Tilko 형식으로 변환 (파싱된 필드들도 포함)
        let healthDataFormatted = { ResultList: [] as any[] };
        let prescriptionDataFormatted = { ResultList: [] as any[] };
        
        if (health_data && health_data.length > 0) {
          console.log('🔍 [데이터로더] DB→Tilko 형식 변환 시작');
          console.log(`  - 변환할 health_data 개수: ${health_data.length}`);
          
          healthDataFormatted = {
            ResultList: health_data.map((item: any) => ({
              ...item.raw_data,
              // 🔧 raw_data 필드 보존 (상태 판정에 필요)
              raw_data: item.raw_data,
              // DB에서 파싱된 필드들 추가
              height: item.height,
              weight: item.weight,
              bmi: item.bmi,
              waist_circumference: item.waist_circumference,
              blood_pressure_high: item.blood_pressure_high,
              blood_pressure_low: item.blood_pressure_low,
              blood_sugar: item.blood_sugar,
              cholesterol: item.cholesterol,
              hdl_cholesterol: item.hdl_cholesterol,
              ldl_cholesterol: item.ldl_cholesterol,
              triglyceride: item.triglyceride,
              hemoglobin: item.hemoglobin,
              year: item.year,
              checkup_date: item.checkup_date,
              location: item.location,
              code: item.code
            }))
          };
          
          console.log(`🔍 [데이터로더] 변환 완료: ${healthDataFormatted.ResultList.length}개 항목`);
          const simplifiedHealthData = simplifyDataForLog(healthDataFormatted);
          console.log('🏥 [데이터로더] 건강검진 데이터 설정 완료:', simplifiedHealthData);
        }
        
        if (prescription_data && prescription_data.length > 0) {
          prescriptionDataFormatted = {
            ResultList: prescription_data.map((item: any) => ({
              ...item.raw_data,
              // DB에서 파싱된 필드들 추가
              hospital_name: item.hospital_name,
              address: item.address,
              treatment_date: item.treatment_date,
              treatment_type: item.treatment_type,
              visit_count: item.visit_count,
              medication_count: item.medication_count,
              prescription_count: item.prescription_count,
              detail_records_count: item.detail_records_count
            }))
          };
          const simplifiedPrescriptionData = simplifyDataForLog(prescriptionDataFormatted);
          console.log('💊 [데이터로더] 처방전 데이터 설정 완료:', simplifiedPrescriptionData);
        }
        
        // 🔄 [IndexedDB] 건강 데이터 저장 (AI 종합 분석용)
        try {
          const healthRecord = {
            uuid: uuid,
            patientName: patientName || '사용자',
            hospitalId: hospital,
            healthData: healthDataFormatted.ResultList,
            prescriptionData: prescriptionDataFormatted.ResultList,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dataSource: 'api' as const
          };

          const saveSuccess = await WelnoIndexedDB.saveHealthData(healthRecord);
          
          if (saveSuccess) {
            console.log('✅ [IndexedDB] 건강 데이터 저장 성공:', {
              uuid: uuid,
              건강검진개수: healthDataFormatted.ResultList.length,
              처방전개수: prescriptionDataFormatted.ResultList.length,
              데이터크기: `${(JSON.stringify(healthRecord).length/1024).toFixed(1)}KB`
            });
          }
        } catch (indexedDBError) {
          console.error('❌ [IndexedDB] 건강 데이터 저장 실패:', indexedDBError);
        }
        
        return {
          healthData: healthDataFormatted,
          prescriptionData: prescriptionDataFormatted,
          lastUpdate: result.data.last_update
        };
      }
    } else {
      console.warn('⚠️ [데이터로더] API 응답 실패:', response.status);
    }
  } catch (apiError) {
    console.error('❌ [데이터로더] API 호출 실패:', apiError);
  }
  
  // 2. API 실패 시 IndexedDB에서 폴백
  console.log('📊 [데이터로더] IndexedDB에서 데이터 조회 시도:', { uuid });
  try {
    const indexedDBRecord = await WelnoIndexedDB.getHealthData(uuid);
    
    if (indexedDBRecord && indexedDBRecord.healthData && indexedDBRecord.prescriptionData) {
      console.log('✅ [데이터로더] IndexedDB 데이터 사용:', {
        healthDataCount: indexedDBRecord.healthData.length,
        prescriptionDataCount: indexedDBRecord.prescriptionData.length
      });
      
      // HealthDataViewer와 동일한 형식: { ResultList: [...] }
      return {
        healthData: {
          ResultList: Array.isArray(indexedDBRecord.healthData) 
            ? indexedDBRecord.healthData 
            : []
        },
        prescriptionData: {
          ResultList: Array.isArray(indexedDBRecord.prescriptionData) 
            ? indexedDBRecord.prescriptionData 
            : []
        }
      };
    }
  } catch (indexedDBError) {
    console.error('❌ [데이터로더] IndexedDB 조회 실패:', indexedDBError);
  }
  
  // 3. 모두 실패 시 빈 데이터 반환
  console.warn('⚠️ [데이터로더] 모든 데이터 소스 실패, 빈 데이터 반환');
  return {
    healthData: { ResultList: [] },
    prescriptionData: { ResultList: [] }
  };
};

