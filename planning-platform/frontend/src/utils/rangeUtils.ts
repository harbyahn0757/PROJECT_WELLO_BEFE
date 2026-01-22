/**
 * 범위 체크 및 판정 유틸리티
 * 검진추이와 카테고리가 공통으로 사용
 */

/**
 * 값이 범위 문자열 내에 있는지 확인
 * - 복합 범위 처리 (예: "18.5미만/25~29.9")
 * - 성별 구분 처리 (예: "남: 13-16.5 / 여: 12-15.5")
 * - 다양한 범위 형식 지원 (미만, 이상, ~, -, >=, <=, >, <)
 * 
 * @param value - 확인할 값
 * @param rangeStr - 범위 문자열
 * @param gender - 성별 ('M' 또는 'F')
 * @returns 범위 내 여부
 */
export function isInRange(value: number, rangeStr: string, gender: string = 'M'): boolean {
  if (!rangeStr) return false;
  
  try {
    // 복합 범위 처리 (예: "18.5미만/25~29.9", "18.5미만/25-29.9")
    // "/"로 구분된 여러 범위 중 하나라도 매칭되면 true 반환
    if (rangeStr.includes('/') && !rangeStr.includes('남') && !rangeStr.includes('여')) {
      const parts = rangeStr.split('/');
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart && isInRange(value, trimmedPart, gender)) {
          return true; // 하나라도 매칭되면 true
        }
      }
      return false; // 모든 부분이 매칭되지 않으면 false
    }
    
    // 성별 구분 처리 (예: "남 90이상 / 여 85이상", "남: 13-16.5 / 여: 12-15.5", "남:12.0미만 / 여:10.0미만")
    if (rangeStr.includes('남') && (rangeStr.includes('여') || rangeStr.includes('/'))) {
      const parts = rangeStr.split('/');
      const targetPart = gender === 'M' ? 
        parts.find(p => p.includes('남'))?.trim() : 
        parts.find(p => p.includes('여'))?.trim();
      
      if (targetPart) {
        // "남:" 또는 "여:" 제거하고 공백 정리
        const cleanRange = targetPart.replace(/^남:|^여:/, '').trim();
        return isInRange(value, cleanRange, gender); // 재귀 호출로 처리
      }
      return false;
    }
    
    // "40미만" 또는 "12.0미만" 형태 처리
    if (rangeStr.includes('미만')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
      if (match) {
        const max = parseFloat(match[1]);
        return !isNaN(max) && value < max;
      }
      // 숫자만 추출 시도
      const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(max) && value < max;
    }
    
    // "60이상" 형태 처리
    if (rangeStr.includes('이상')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
      if (match) {
        const min = parseFloat(match[1]);
        return !isNaN(min) && value >= min;
      }
      // 숫자만 추출 시도
      const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(min) && value >= min;
    }
    
    // "25~29.9" 또는 "25-29.9" 형태 처리 (물결표 또는 하이픈)
    if ((rangeStr.includes('~') || rangeStr.includes('-')) && !rangeStr.includes('이상') && !rangeStr.includes('미만')) {
      const separator = rangeStr.includes('~') ? '~' : '-';
      // "25~29.9" 또는 "25-29.9" 형태에서 숫자 추출
      const rangeMatch = rangeStr.match(/(\d+(?:\.\d+)?)\s*[~-]\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
      }
      // 정규식 매칭 실패 시 기존 방식 사용
      const parts = rangeStr.split(separator);
      if (parts.length === 2) {
        const min = parseFloat(parts[0].replace(/[^0-9.-]/g, ''));
        const max = parseFloat(parts[1].replace(/[^0-9.-]/g, ''));
        return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
      }
    }
    
    // ">=120" 형태
    if (rangeStr.includes('>=')) {
      const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(min) && value >= min;
    }
    
    // "<=140" 형태
    if (rangeStr.includes('<=')) {
      const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(max) && value <= max;
    }
    
    // ">120" 형태
    if (rangeStr.includes('>') && !rangeStr.includes('>=')) {
      const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(min) && value > min;
    }
    
    // "<140" 형태
    if (rangeStr.includes('<') && !rangeStr.includes('<=')) {
      const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(max) && value < max;
    }
    
    return false;
  } catch (error) {
    // 개발 모드에서만 경고 출력
    if (process.env.NODE_ENV === 'development') {
      console.warn('범위 체크 실패:', rangeStr, error);
    }
    return false;
  }
}

/**
 * 혈압 복합값 판정 ("140/90" 형태)
 * - ItemReferences의 "또는", "이며" 키워드 처리
 * - 수축기/이완기 각각 판정
 * 
 * @param value - 혈압 값 (예: "140/90")
 * @param itemReferences - ItemReferences 배열
 * @param gender - 성별
 * @returns 상태 ('normal' | 'borderline' | 'abnormal')
 */
export function determineBloodPressureStatus(
  value: string,
  itemReferences: any[],
  gender: string = 'M'
): 'normal' | 'borderline' | 'abnormal' {
  if (!value || !value.includes('/')) {
    return 'normal';
  }
  
  if (!itemReferences || !Array.isArray(itemReferences) || itemReferences.length === 0) {
    return 'normal';
  }
  
  const [systolicStr, diastolicStr] = value.split('/');
  const systolic = parseFloat(systolicStr.trim());
  const diastolic = parseFloat(diastolicStr.trim());
  
  if (isNaN(systolic) || isNaN(diastolic)) {
    return 'normal';
  }
  
  // 1. 질환의심 범위 체크 ("140이상 또는 /90이상")
  const abnormalRef = itemReferences.find(r => r.Name === '질환의심');
  if (abnormalRef && abnormalRef.Value) {
    const refValue = abnormalRef.Value;
    
    // "140이상 또는 /90이상" 형태 처리
    if (refValue.includes('또는') && refValue.includes('/')) {
      const parts = refValue.split('/');
      if (parts.length >= 2) {
        const systolicPart = parts[0].replace('또는', '').trim(); // "140이상"
        const diastolicPart = parts[1].trim(); // "90이상"
        
        // 하나라도 만족하면 질환의심
        if (isInRange(systolic, systolicPart, gender) || isInRange(diastolic, diastolicPart, gender)) {
          return 'abnormal';
        }
      }
    }
  }
  
  // 2. 정상 범위 체크 - 정상, 정상(A), 정상(B) 모두 확인
  const normalRef = itemReferences.find(r => 
    r.Name === '정상' || r.Name === '정상(A)' || r.Name === '정상(B)'
  );
  
  if (normalRef && normalRef.Value) {
    const refValue = normalRef.Value;
    
    // "120미만 이며/80미만" 형태 (AND 조건)
    if (refValue.includes('이며') && refValue.includes('/')) {
      const parts = refValue.split('/');
      if (parts.length >= 2) {
        const systolicPart = parts[0].replace('이며', '').trim();
        const diastolicPart = parts[1].trim();
        
        // 둘 다 만족해야 정상
        if (isInRange(systolic, systolicPart, gender) && isInRange(diastolic, diastolicPart, gender)) {
          return 'normal';
        }
      }
    }
    
    // "120-139 또는 /80-89" 형태 (OR 조건)
    if (refValue.includes('또는') && refValue.includes('/')) {
      const parts = refValue.split('/');
      if (parts.length >= 2) {
        const systolicPart = parts[0].replace('또는', '').trim();
        const diastolicPart = parts[1].trim();
        
        // 하나라도 만족하면 정상(B) → borderline
        if (isInRange(systolic, systolicPart, gender) || isInRange(diastolic, diastolicPart, gender)) {
          if (normalRef.Name === '정상(B)') {
            return 'borderline';
          }
          return 'normal';
        }
      }
    }
  }
  
  // 3. 경계 범위 체크
  const borderlineRef = itemReferences.find(r => 
    r.Name === '정상(B)' || r.Name === '정상(경계)'
  );
  
  if (borderlineRef && borderlineRef.Value) {
    const refValue = borderlineRef.Value;
    
    if (refValue.includes('또는') && refValue.includes('/')) {
      const parts = refValue.split('/');
      if (parts.length >= 2) {
        const systolicPart = parts[0].replace('또는', '').trim();
        const diastolicPart = parts[1].trim();
        
        if (isInRange(systolic, systolicPart, gender) || isInRange(diastolic, diastolicPart, gender)) {
          return 'borderline';
        }
      }
    }
  }
  
  return 'normal';
}

/**
 * 문자열 값이 참조 값과 매칭되는지 확인
 * - 요단백 "음성", 폐결핵 "정상" 등 문자열 값 처리
 * - 콤마로 구분된 복수 값 처리 (예: "정상, 비활동성")
 * 
 * @param value - 실제 값 (예: "음성", "정상")
 * @param refValue - 참조 값 (예: "음성", "정상, 비활동성")
 * @returns 매칭 여부
 */
export function matchesStringValue(value: string, refValue: string): boolean {
  if (!value || !refValue) return false;
  
  const normalizedValue = value.trim().toLowerCase();
  const normalizedRef = refValue.trim().toLowerCase();
  
  // 정확히 일치
  if (normalizedValue === normalizedRef) {
    return true;
  }
  
  // 콤마 구분된 값들 중 하나와 일치
  if (normalizedRef.includes(',')) {
    const refValues = normalizedRef.split(',').map(v => v.trim());
    return refValues.some(rv => normalizedValue === rv);
  }
  
  // 포함 관계
  return normalizedRef.includes(normalizedValue);
}
