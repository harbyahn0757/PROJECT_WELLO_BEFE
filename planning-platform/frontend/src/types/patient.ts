// 환자 데이터 통합 타입 정의
// 프로젝트 전체에서 일관성 있게 사용하기 위한 중앙화된 타입 정의

// 기본 환자 데이터 인터페이스
export interface BasePatientData {
  uuid: string;
  name: string;
  age: number;
  phone: string;
  birthday: string;
  hospital_id: string;
  last_checkup_count: number;
  created_at: string;
}

// 성별 관련 타입들
export type ApiGenderType = 'male' | 'female';           // API 응답에서 사용
export type DatabaseGenderType = 'MALE' | 'FEMALE';     // 데이터베이스에서 사용  
export type AuthGenderType = 'M' | 'F';                 // 인증 API에서 사용

// 확장된 환자 데이터 (API 응답)
export interface PatientData extends BasePatientData {
  gender: ApiGenderType;
}

// 데이터베이스 환자 데이터
export interface DatabasePatientData extends BasePatientData {
  gender: DatabaseGenderType;
}

// 인증용 환자 데이터
export interface AuthPatientData {
  name: string;
  gender: AuthGenderType;
  phoneNo: string;
  birthday: string;
}

// 병원 데이터 인터페이스
export interface HospitalData {
  hospital_id: string;
  name: string;
  phone: string;
  address: string;
  supported_checkup_types: string[];
  layout_type: string;
  brand_color: string;
  logo_position: string;
  is_active: boolean;
}

// 환자 + 병원 통합 데이터
export interface PatientWithHospital extends PatientData {
  hospital: HospitalData;
}

// 성별 변환 유틸리티 함수들
export class GenderConverter {
  // API gender -> Auth gender
  static apiToAuth(gender: ApiGenderType): AuthGenderType {
    return gender === 'male' ? 'M' : 'F';
  }
  
  // Database gender -> Auth gender  
  static databaseToAuth(gender: DatabaseGenderType): AuthGenderType {
    return gender === 'MALE' ? 'M' : 'F';
  }
  
  // API gender -> Database gender
  static apiToDatabase(gender: ApiGenderType): DatabaseGenderType {
    return gender === 'male' ? 'MALE' : 'FEMALE';
  }
  
  // Database gender -> API gender
  static databaseToApi(gender: DatabaseGenderType): ApiGenderType {
    return gender === 'MALE' ? 'male' : 'female';
  }
  
  // Auth gender -> API gender
  static authToApi(gender: AuthGenderType): ApiGenderType {
    return gender === 'M' ? 'male' : 'female';
  }
  
  // Auth gender -> Database gender
  static authToDatabase(gender: AuthGenderType): DatabaseGenderType {
    return gender === 'M' ? 'MALE' : 'FEMALE';
  }
}

// 환자 데이터 변환 유틸리티
export class PatientDataConverter {
  // PatientData -> AuthPatientData
  static toAuthData(patient: PatientData): AuthPatientData {
    return {
      name: patient.name || '',
      gender: GenderConverter.apiToAuth(patient.gender),
      phoneNo: (patient.phone || '').replace(/-/g, ''),
      birthday: patient.birthday || ''
    };
  }
  
  // 안전한 환자 데이터 추출
  static getSafeName(patient: PatientData | null): string {
    if (!patient || !patient.name || typeof patient.name !== 'string') {
      return '사용자';
    }
    return patient.name.trim() || '사용자';
  }
  
  static getSafePhone(patient: PatientData | null): string {
    if (!patient || !patient.phone || typeof patient.phone !== 'string') {
      return '전화번호';
    }
    return patient.phone.trim() || '전화번호';
  }
  
  static getSafeBirthday(patient: PatientData | null): string {
    if (!patient || !patient.birthday || typeof patient.birthday !== 'string') {
      return '생년월일';
    }
    return patient.birthday.trim() || '생년월일';
  }
  
  // undefined 제거 유틸리티
  static cleanUndefined(value: any): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/undefined/g, '').trim();
  }
}

// 유효성 검사 유틸리티
export class PatientDataValidator {
  static isValidPatient(patient: any): patient is PatientData {
    return (
      patient &&
      typeof patient === 'object' &&
      typeof patient.uuid === 'string' &&
      typeof patient.name === 'string' &&
      typeof patient.phone === 'string' &&
      typeof patient.birthday === 'string' &&
      typeof patient.gender === 'string' &&
      (patient.gender === 'male' || patient.gender === 'female')
    );
  }
  
  static hasRequiredFields(patient: PatientData | null): boolean {
    if (!patient) return false;
    
    return !!(
      patient.name &&
      patient.phone &&
      patient.birthday &&
      patient.gender &&
      patient.uuid
    );
  }
}
