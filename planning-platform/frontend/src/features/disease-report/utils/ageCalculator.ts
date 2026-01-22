// 나이 계산 유틸리티

export interface AgeCalculationResult {
  currentAge: number;
  ageDifference: number; // 건강나이 - 실제나이 (음수면 건강나이가 더 낮음)
  isHealthier: boolean; // 건강나이가 실제나이보다 낮으면 true
}

/**
 * 생년월일 문자열로부터 현재 나이 계산
 * @param birthday 생년월일 (YYYY-MM-DD 또는 YYYYMMDD 형식)
 * @returns 현재 나이 (만 나이)
 */
export const calculateCurrentAge = (birthday: string | null): number | null => {
  if (!birthday) return null;

  try {
    let birthDate: Date;
    
    // YYYY-MM-DD 형식 처리
    if (birthday.includes('-')) {
      birthDate = new Date(birthday);
    } 
    // YYYYMMDD 형식 처리
    else if (birthday.length === 8) {
      const year = parseInt(birthday.substring(0, 4));
      const month = parseInt(birthday.substring(4, 6)) - 1; // 월은 0부터 시작
      const day = parseInt(birthday.substring(6, 8));
      birthDate = new Date(year, month, day);
    } 
    else {
      return null;
    }

    if (isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // 생일이 아직 지나지 않았으면 1살 빼기
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  } catch (error) {
    console.error('나이 계산 오류:', error);
    return null;
  }
};

/**
 * 건강나이와 실제나이 비교
 * @param bodyAge 건강나이
 * @param currentAge 실제나이
 * @returns 비교 결과
 */
export const compareAges = (
  bodyAge: number,
  currentAge: number | null
): AgeCalculationResult | null => {
  if (currentAge === null) return null;

  const ageDifference = bodyAge - currentAge;
  const isHealthier = ageDifference < 0;

  return {
    currentAge,
    ageDifference: Math.abs(ageDifference),
    isHealthier,
  };
};




