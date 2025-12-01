/**
 * 처방 패턴 분석 유틸리티
 * 약국 처방 이력을 분석하여 복용 패턴을 도출
 */

export interface MedicationItem {
  ChoBangYakPumMyung: string; // 약품명
  ChoBangYakPumHyoneung: string; // 약품 효능
  TuyakIlSoo: string; // 투약일수 (숫자 문자열)
  JinRyoChoBangIlja: string; // 진료처방일자 (YYYY-MM-DD)
  DrugCode?: string; // 약품코드
}

export interface PrescriptionRecord {
  JinRyoGaesiIl: string; // 진료개시일 (YYYY-MM-DD)
  ByungEuiwonYakGukMyung: string; // 병원/약국명
  JinRyoHyungTae: string; // 진료형태
  RetrieveTreatmentInjectionInformationPersonDetailList?: MedicationItem[];
  treatment_date?: string; // 파싱된 날짜
  hospital_name?: string; // 파싱된 병원명
  treatment_type?: string; // 파싱된 진료형태
}

/**
 * 약품 효능별 집계 결과
 */
export interface MedicationEffectPattern {
  effect: string; // 약품 효능 (예: "고혈압", "당뇨병", "소화불량")
  totalDays: number; // 총 복용일수
  prescriptionCount: number; // 처방 횟수
  firstPrescriptionDate: string; // 첫 처방일
  lastPrescriptionDate: string; // 마지막 처방일
  lastPrescriptionEndDate: string; // 마지막 처방 종료일 (처방일 + 투약일수)
  years: string[]; // 복용한 연도 목록
  patternAnalysis: MedicationPatternAnalysis; // 상세 패턴 분석
  medications: Array<{ // 해당 효능의 약품 목록
    name: string;
    prescriptionCount: number;
    totalDays: number;
  }>;
  priority: number; // 우선순위 점수 (복용일수 + 빈도 + 최근성 + 연속성)
}

/**
 * 연도별 복용 패턴
 */
export interface YearlyPattern {
  year: string;
  effects: MedicationEffectPattern[];
  totalPrescriptions: number;
  totalDays: number;
}

/**
 * 처방 패턴 분석 결과
 */
export interface PrescriptionPatternAnalysis {
  effectPatterns: MedicationEffectPattern[]; // 효능별 패턴 (우선순위 정렬)
  yearlyPatterns: YearlyPattern[]; // 연도별 패턴
  topEffects: MedicationEffectPattern[]; // 상위 효능 (상위 5개)
  longTermMedications: MedicationEffectPattern[]; // 장기 복용 약품 (6개월 이상)
  recentMedications: MedicationEffectPattern[]; // 최근 복용 약품 (최근 1년)
  summary: {
    totalYears: number; // 분석 기간 (년)
    totalPrescriptions: number; // 총 처방 횟수
    uniqueEffects: number; // 고유 효능 수
    mostFrequentEffect: string; // 가장 자주 복용한 효능
    longestMedication: string; // 가장 오래 복용한 효능
  };
}

/**
 * 처방 데이터에서 약국 데이터만 필터링
 */
function filterPharmacyPrescriptions(
  prescriptionData: PrescriptionRecord[]
): PrescriptionRecord[] {
  return prescriptionData.filter(prescription => {
    const treatmentType = prescription.treatment_type || prescription.JinRyoHyungTae || '';
    const hospitalName = prescription.hospital_name || prescription.ByungEuiwonYakGukMyung || '';
    return treatmentType === '처방조제' || hospitalName.includes('약국');
  });
}

/**
 * 날짜 문자열을 Date 객체로 변환
 */
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * 두 날짜 사이의 일수 계산
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 연속 복용 기간 계산 (개선된 버전)
 * 첫 처방일부터 마지막 처방일까지 전체 기간을 분석하여 모든 패턴 추적
 * 
 * 분석 항목:
 * 1. 연속 복용 기간: 처방 종료일과 다음 처방일의 간격이 30일 이내
 * 2. 중단 기간: 처방 종료일과 다음 처방일의 간격이 30일 초과
 * 3. 복용 밀도: 전체 기간 중 실제 복용한 비율
 * 4. 재시작 패턴: 중단 후 재시작한 횟수
 */
export interface ContinuousPeriod {
  startDate: string;
  endDate: string; // 마지막 처방의 종료일 (처방일 + 투약일수)
  days: number; // 총 복용일수
  prescriptionCount: number; // 해당 기간 내 처방 횟수
  gapBefore?: number; // 이전 기간과의 간격 (첫 기간은 undefined)
}

export interface MedicationPatternAnalysis {
  continuousPeriods: ContinuousPeriod[]; // 연속 복용 기간들
  gapPeriods: Array<{ // 중단 기간들
    startDate: string; // 이전 처방 종료일
    endDate: string; // 다음 처방 시작일
    days: number; // 중단 일수
  }>;
  totalPeriod: { // 전체 기간 (첫 처방일 ~ 마지막 처방 종료일)
    startDate: string;
    endDate: string;
    days: number;
  };
  consumptionDensity: number; // 복용 밀도 (0~1): 실제 복용일수 / 전체 기간
  restartCount: number; // 재시작 횟수 (중단 후 재시작)
  averageGap: number; // 평균 중단 기간
}

function calculateContinuousPeriods(
  prescriptionDates: Array<{ date: string; days: number }>
): MedicationPatternAnalysis {
  if (prescriptionDates.length === 0) {
    return {
      continuousPeriods: [],
      gapPeriods: [],
      totalPeriod: { startDate: '', endDate: '', days: 0 },
      consumptionDensity: 0,
      restartCount: 0,
      averageGap: 0
    };
  }
  
  // 날짜순 정렬 (오래된 것부터)
  const sorted = [...prescriptionDates].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const continuousPeriods: ContinuousPeriod[] = [];
  const gapPeriods: Array<{ startDate: string; endDate: string; days: number }> = [];
  
  // 첫 처방일
  const firstPrescription = sorted[0];
  const firstDate = parseDate(firstPrescription.date);
  if (!firstDate) {
    return {
      continuousPeriods: [],
      gapPeriods: [],
      totalPeriod: { startDate: '', endDate: '', days: 0 },
      consumptionDensity: 0,
      restartCount: 0,
      averageGap: 0
    };
  }
  
  // 현재 연속 기간 추적
  let currentPeriod: ContinuousPeriod = {
    startDate: firstPrescription.date,
    endDate: firstPrescription.date,
    days: parseInt(firstPrescription.days.toString(), 10),
    prescriptionCount: 1
  };
  
  // 첫 처방의 종료일 계산
  const firstEndDate = new Date(firstDate);
  firstEndDate.setDate(firstEndDate.getDate() + currentPeriod.days);
  currentPeriod.endDate = firstEndDate.toISOString().split('T')[0];
  
  // 두 번째 처방부터 순회
  for (let i = 1; i < sorted.length; i++) {
    const prevEndDate = parseDate(currentPeriod.endDate);
    const currPrescription = sorted[i];
    const currDate = parseDate(currPrescription.date);
    
    if (!prevEndDate || !currDate) continue;
    
    // 이전 처방 종료일과 현재 처방 시작일의 간격
    const gap = daysBetween(prevEndDate, currDate);
    
    if (gap <= 30) {
      // 연속 복용: 현재 기간에 추가
      const currDays = parseInt(currPrescription.days.toString(), 10);
      currentPeriod.days += currDays;
      currentPeriod.prescriptionCount++;
      
      // 종료일 업데이트 (현재 처방의 종료일)
      const currEndDate = new Date(currDate);
      currEndDate.setDate(currEndDate.getDate() + currDays);
      currentPeriod.endDate = currEndDate.toISOString().split('T')[0];
    } else {
      // 중단 후 재시작: 현재 기간 저장하고 새 기간 시작
      continuousPeriods.push(currentPeriod);
      
      // 중단 기간 기록
      gapPeriods.push({
        startDate: currentPeriod.endDate,
        endDate: currPrescription.date,
        days: gap
      });
      
      // 새 기간 시작
      const currDays = parseInt(currPrescription.days.toString(), 10);
      const currEndDate = new Date(currDate);
      currEndDate.setDate(currEndDate.getDate() + currDays);
      
      currentPeriod = {
        startDate: currPrescription.date,
        endDate: currEndDate.toISOString().split('T')[0],
        days: currDays,
        prescriptionCount: 1,
        gapBefore: gap
      };
    }
  }
  
  // 마지막 기간 추가
  continuousPeriods.push(currentPeriod);
  
  // 전체 기간 계산 (첫 처방일 ~ 마지막 처방 종료일)
  const totalStartDate = firstPrescription.date;
  const totalEndDate = currentPeriod.endDate;
  const totalPeriodDays = daysBetween(
    parseDate(totalStartDate)!,
    parseDate(totalEndDate)!
  );
  
  // 총 복용일수
  const totalConsumptionDays = continuousPeriods.reduce((sum, p) => sum + p.days, 0);
  
  // 복용 밀도 계산
  const consumptionDensity = totalPeriodDays > 0 
    ? totalConsumptionDays / totalPeriodDays 
    : 0;
  
  // 재시작 횟수 (중단 기간 수)
  const restartCount = gapPeriods.length;
  
  // 평균 중단 기간
  const averageGap = gapPeriods.length > 0
    ? gapPeriods.reduce((sum, g) => sum + g.days, 0) / gapPeriods.length
    : 0;
  
  return {
    continuousPeriods,
    gapPeriods,
    totalPeriod: {
      startDate: totalStartDate,
      endDate: totalEndDate,
      days: totalPeriodDays
    },
    consumptionDensity,
    restartCount,
    averageGap
  };
}

/**
 * 처방 패턴 분석 메인 함수
 */
export function analyzePrescriptionPatterns(
  prescriptionData: PrescriptionRecord[]
): PrescriptionPatternAnalysis {
  // 1. 약국 데이터만 필터링
  const pharmacyPrescriptions = filterPharmacyPrescriptions(prescriptionData);
  
  if (pharmacyPrescriptions.length === 0) {
    return {
      effectPatterns: [],
      yearlyPatterns: [],
      topEffects: [],
      longTermMedications: [],
      recentMedications: [],
      summary: {
        totalYears: 0,
        totalPrescriptions: 0,
        uniqueEffects: 0,
        mostFrequentEffect: '',
        longestMedication: ''
      }
    };
  }
  
  // 2. 효능별 집계
  const effectMap = new Map<string, {
    prescriptions: Array<{ date: string; days: number; medicationName: string }>;
    medications: Map<string, { count: number; days: number }>;
  }>();
  
  const currentDate = new Date();
  const oneYearAgo = new Date(currentDate);
  oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
  
  pharmacyPrescriptions.forEach(prescription => {
    const medicationList = prescription.RetrieveTreatmentInjectionInformationPersonDetailList || [];
    const prescriptionDate = prescription.treatment_date || prescription.JinRyoGaesiIl;
    
    if (!prescriptionDate) return;
    
    medicationList.forEach(med => {
      // 효능 우선, 없으면 약품명 사용
      const effect = med.ChoBangYakPumHyoneung || med.ChoBangYakPumMyung || '효능 미상';
      const medicationName = med.ChoBangYakPumMyung || '약품명 미상';
      const days = parseInt(med.TuyakIlSoo || '0', 10);
      
      if (days <= 0) return;
      
      if (!effectMap.has(effect)) {
        effectMap.set(effect, {
          prescriptions: [],
          medications: new Map()
        });
      }
      
      const effectData = effectMap.get(effect)!;
      effectData.prescriptions.push({
        date: prescriptionDate,
        days,
        medicationName
      });
      
      // 약품별 집계
      if (!effectData.medications.has(medicationName)) {
        effectData.medications.set(medicationName, { count: 0, days: 0 });
      }
      const medData = effectData.medications.get(medicationName)!;
      medData.count++;
      medData.days += days;
    });
  });
  
  // 3. 효능별 패턴 생성
  const effectPatterns: MedicationEffectPattern[] = [];
  
  effectMap.forEach((data, effect) => {
    const prescriptionDates = data.prescriptions.map(p => ({
      date: p.date,
      days: p.days
    }));
    
    // 날짜순 정렬 (오래된 것부터)
    prescriptionDates.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    if (prescriptionDates.length === 0) return;
    
    const firstDate = prescriptionDates[0].date;
    const lastPrescription = prescriptionDates[prescriptionDates.length - 1];
    const lastDate = lastPrescription.date;
    
    // 마지막 처방 종료일 계산
    const lastDateObj = parseDate(lastDate);
    const lastPrescriptionEndDate = lastDateObj
      ? (() => {
          const endDate = new Date(lastDateObj);
          endDate.setDate(endDate.getDate() + parseInt(lastPrescription.days.toString(), 10));
          return endDate.toISOString().split('T')[0];
        })()
      : lastDate;
    
    // 연도 추출
    const years = new Set<string>();
    prescriptionDates.forEach(p => {
      const year = new Date(p.date).getFullYear().toString();
      years.add(year);
    });
    
    // 상세 패턴 분석 (연속 기간, 중단 기간, 복용 밀도 등)
    const patternAnalysis = calculateContinuousPeriods(prescriptionDates);
    
    // 총 복용일수 계산 (연속 기간 합산)
    const totalDays = patternAnalysis.continuousPeriods.reduce(
      (sum, period) => sum + period.days, 
      0
    );
    
    // 약품 목록 정리
    const medications = Array.from(data.medications.entries())
      .map(([name, data]) => ({
        name,
        prescriptionCount: data.count,
        totalDays: data.days
      }))
      .sort((a, b) => b.totalDays - a.totalDays);
    
    // 우선순위 점수 계산 (개선된 버전)
    // - 총 복용일수: 35%
    // - 처방 횟수: 25%
    // - 최근성 (마지막 처방 종료일 기준): 20%
    // - 연속성 (복용 밀도): 15%
    // - 재시작 횟수 (적을수록 좋음): 5%
    const prescriptionCount = prescriptionDates.length;
    const lastEndDateObj = parseDate(lastPrescriptionEndDate);
    const daysSinceLastPrescription = lastEndDateObj 
      ? daysBetween(lastEndDateObj, currentDate)
      : 9999;
    const recencyScore = Math.max(0, 365 - daysSinceLastPrescription) / 365; // 최근 1년 내면 높은 점수
    const continuityScore = patternAnalysis.consumptionDensity; // 복용 밀도 (0~1)
    const restartPenalty = Math.max(0, 1 - (patternAnalysis.restartCount / 10)); // 재시작이 적을수록 높은 점수
    
    const priority = 
      (totalDays / 365) * 0.35 + // 1년 기준 정규화
      (prescriptionCount / 50) * 0.25 + // 50회 기준 정규화
      recencyScore * 0.2 +
      continuityScore * 0.15 +
      restartPenalty * 0.05;
    
    effectPatterns.push({
      effect,
      totalDays,
      prescriptionCount,
      firstPrescriptionDate: firstDate,
      lastPrescriptionDate: lastDate,
      lastPrescriptionEndDate: lastPrescriptionEndDate,
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
      patternAnalysis,
      medications,
      priority
    });
  });
  
  // 우선순위 정렬
  effectPatterns.sort((a, b) => b.priority - a.priority);
  
  // 4. 연도별 패턴 생성
  const yearlyMap = new Map<string, MedicationEffectPattern[]>();
  
  effectPatterns.forEach(pattern => {
    pattern.years.forEach(year => {
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, []);
      }
      yearlyMap.get(year)!.push(pattern);
    });
  });
  
  const yearlyPatterns: YearlyPattern[] = Array.from(yearlyMap.entries())
    .map(([year, patterns]) => {
      const yearPrescriptions = pharmacyPrescriptions.filter(p => {
        const pYear = new Date(p.treatment_date || p.JinRyoGaesiIl).getFullYear().toString();
        return pYear === year;
      });
      
      const yearMedications = yearPrescriptions.flatMap(p => 
        p.RetrieveTreatmentInjectionInformationPersonDetailList || []
      );
      const yearTotalDays = yearMedications.reduce((sum, m) => 
        sum + parseInt(m.TuyakIlSoo || '0', 10), 0
      );
      
      return {
        year,
        effects: patterns.sort((a, b) => b.priority - a.priority),
        totalPrescriptions: yearPrescriptions.length,
        totalDays: yearTotalDays
      };
    })
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));
  
  // 5. 상위 효능 (상위 5개)
  const topEffects = effectPatterns.slice(0, 5);
  
  // 6. 장기 복용 약품 (6개월 이상)
  const longTermMedications = effectPatterns.filter(p => p.totalDays >= 180);
  
  // 7. 최근 복용 약품 (최근 1년)
  const recentMedications = effectPatterns.filter(p => {
    const lastDate = parseDate(p.lastPrescriptionDate);
    return lastDate && lastDate >= oneYearAgo;
  }).sort((a, b) => 
    new Date(b.lastPrescriptionDate).getTime() - new Date(a.lastPrescriptionDate).getTime()
  );
  
  // 8. 요약 정보
  const allYears = new Set<string>();
  effectPatterns.forEach(p => p.years.forEach(y => allYears.add(y)));
  
  const mostFrequent = effectPatterns.length > 0 ? effectPatterns[0].effect : '';
  const longest = effectPatterns.length > 0 
    ? effectPatterns.reduce((max, p) => p.totalDays > max.totalDays ? p : max, effectPatterns[0]).effect
    : '';
  
  return {
    effectPatterns,
    yearlyPatterns,
    topEffects,
    longTermMedications,
    recentMedications,
    summary: {
      totalYears: allYears.size,
      totalPrescriptions: pharmacyPrescriptions.length,
      uniqueEffects: effectPatterns.length,
      mostFrequentEffect: mostFrequent,
      longestMedication: longest
    }
  };
}

/**
 * 효능별 패턴을 사용자 친화적인 메시지로 변환
 */
export function formatEffectPatternMessage(pattern: MedicationEffectPattern): string {
  const years = pattern.years.length > 1 
    ? `${pattern.years[pattern.years.length - 1]}년부터 ${pattern.years[0]}년까지`
    : `${pattern.years[0]}년`;
  
  const months = Math.floor(pattern.totalDays / 30);
  const days = pattern.totalDays % 30;
  
  let durationText = '';
  if (months > 0 && days > 0) {
    durationText = `${months}개월 ${days}일`;
  } else if (months > 0) {
    durationText = `${months}개월`;
  } else {
    durationText = `${days}일`;
  }
  
  // 전체 기간 계산
  const totalPeriodMonths = Math.floor(pattern.patternAnalysis.totalPeriod.days / 30);
  const totalPeriodDays = pattern.patternAnalysis.totalPeriod.days % 30;
  let totalPeriodText = '';
  if (totalPeriodMonths > 0 && totalPeriodDays > 0) {
    totalPeriodText = `${totalPeriodMonths}개월 ${totalPeriodDays}일`;
  } else if (totalPeriodMonths > 0) {
    totalPeriodText = `${totalPeriodMonths}개월`;
  } else {
    totalPeriodText = `${totalPeriodDays}일`;
  }
  
  // 복용 밀도에 따른 설명
  const density = pattern.patternAnalysis.consumptionDensity;
  let densityText = '';
  if (density >= 0.8) {
    densityText = '지속적으로';
  } else if (density >= 0.5) {
    densityText = '주기적으로';
  } else if (density >= 0.3) {
    densityText = '간헐적으로';
  } else {
    densityText = '가끔';
  }
  
  // 재시작 횟수 정보
  const restartInfo = pattern.patternAnalysis.restartCount > 0
    ? ` (중단 후 ${pattern.patternAnalysis.restartCount}회 재시작)`
    : '';
  
  return `${pattern.effect} 관련 약품을 ${years} 동안 ${densityText} 복용하셨어요. ` +
         `전체 기간 ${totalPeriodText} 중 ${durationText}간 복용 (${pattern.prescriptionCount}회 처방)${restartInfo}`;
}

