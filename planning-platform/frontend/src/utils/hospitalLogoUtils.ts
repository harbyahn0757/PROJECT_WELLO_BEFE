/**
 * 병원 로고 이미지 유틸리티
 * 병원별 로고 이미지를 가져오는 함수 제공
 */

// 기본 로고 이미지 (병원 로고가 없을 때 사용)
import defaultHospitalLogo from '../assets/images/main/hwkim_logo.png';

/**
 * 병원 로고 이미지 URL을 가져옵니다.
 * 
 * @param hospital - 병원 데이터 객체 (hospital_id, name 등 포함)
 * @param logoUrl - 백엔드에서 제공한 로고 URL (선택적)
 * @returns 로고 이미지 URL 또는 기본 이미지
 */
export const getHospitalLogoUrl = (
  hospital: { hospital_id?: string; name?: string } | null | undefined,
  logoUrl?: string | null
): string => {
  // 1. 백엔드에서 제공한 logoUrl이 있으면 우선 사용
  if (logoUrl) {
    return logoUrl;
  }

  // 2. 병원 데이터가 없으면 기본 이미지 사용
  if (!hospital) {
    return defaultHospitalLogo;
  }

  // 3. 병원별 로고 이미지 경로 생성 (향후 확장용)
  // 예: /static/logos/{hospital_id}.png
  // 현재는 기본 이미지만 사용
  // TODO: 병원별 로고 이미지가 준비되면 아래 로직 활성화
  // if (hospital.hospital_id) {
  //   const customLogoPath = `/static/logos/${hospital.hospital_id}.png`;
  //   // 이미지 존재 여부 확인 로직 추가 가능
  //   return customLogoPath;
  // }

  // 4. 기본 이미지 반환
  return defaultHospitalLogo;
};

/**
 * 병원 로고 이미지가 존재하는지 확인합니다.
 * (향후 확장용 - 실제 이미지 존재 여부 확인)
 */
export const checkHospitalLogoExists = async (logoUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(logoUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

