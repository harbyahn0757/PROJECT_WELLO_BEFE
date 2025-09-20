// 현아 프론트엔드의 설문조사 인터페이스를 그대로 복사

export interface IUserAgreement {
  healthDataUsageAgreedYN?: 'Y' | 'N';
  marketingAgreedYN?: 'Y' | 'N';
  thirdPersonsAgreedYN?: 'Y' | 'N';
}

export interface IFamilyHistory {
  familyCerebralHistory: boolean;
  familyHeartDiseaseHistory: boolean;
  familyHypertensionHistory: boolean;
  familyDiabetesHistory: boolean;
  familyCancerHistory: boolean;
}

export interface IPersonalHistory {
  personalCerebralHistory: boolean;
  personalHeartDiseaseHistory: boolean;
  personalHypertensionHistory: boolean;
  personalDiabetesHistory: boolean;
  personalCancerHistory: boolean;
  personalKidneyDiseaseHistory: boolean;
  personalLiverDiseaseHistory: boolean;
  personalThyroidDiseaseHistory: boolean;
  personalOtherDiseaseHistory: boolean;
}

export interface ILivingHabits {
  smokingYN: boolean;
  smokingStatus: number; // 0: 비흡연, 1: 현재흡연, 2: 과거흡연
  smokingTotalPeriod: number;
  smokingAveragePerWeek: number;
  drinkingFrequencyPerWeek: number;
  drinkingOverdoseYN: boolean;
  regularEatingHabitYN: boolean;
  balancedDietYN: boolean;
  exerciseFrequencyPerWeek: number;
  regularExerciseHabitYN: boolean;
  [key: string]: any; // 인덱스 시그니처 추가
}

export interface IStress {
  stressStatusCode: number; // 1: 대단히많이, 2: 많이, 3: 조금, 4: 거의없음
  stressReasonCode: number; // 1: 가정생활, 2: 직장생활, 3: 경제생활, 4: 기타
}

export interface IDocumentAnswer {
  id?: string;
  webAppKey?: string;
  version: number;
  familyHistory: IFamilyHistory;
  personalHistory: IPersonalHistory;
  livingHabits: ILivingHabits;
  stress: IStress;
  [key: string]: any; // 인덱스 시그니처 추가
}

export interface ISubQuestionVisible {
  disability: boolean;
  smoking: boolean;
  drinking: boolean;
  exercise: boolean;
  stress: boolean;
}

// 초기 상태값들
export const initialFamilyHistory: IFamilyHistory = {
  familyCerebralHistory: false,
  familyHeartDiseaseHistory: false,
  familyHypertensionHistory: false,
  familyDiabetesHistory: false,
  familyCancerHistory: false,
};

export const initialPersonalHistory: IPersonalHistory = {
  personalCerebralHistory: false,
  personalHeartDiseaseHistory: false,
  personalHypertensionHistory: false,
  personalDiabetesHistory: false,
  personalCancerHistory: false,
  personalKidneyDiseaseHistory: false,
  personalLiverDiseaseHistory: false,
  personalThyroidDiseaseHistory: false,
  personalOtherDiseaseHistory: false,
};

export const initialLivingHabits: ILivingHabits = {
  smokingYN: false,
  smokingStatus: 0,
  smokingTotalPeriod: 0,
  smokingAveragePerWeek: 0,
  drinkingFrequencyPerWeek: 0,
  drinkingOverdoseYN: false,
  regularEatingHabitYN: false,
  balancedDietYN: false,
  exerciseFrequencyPerWeek: 0,
  regularExerciseHabitYN: false,
};

export const initialStress: IStress = {
  stressStatusCode: 0,
  stressReasonCode: 0,
};

export const initialDocumentAnswer: IDocumentAnswer = {
  version: 2,
  familyHistory: initialFamilyHistory,
  personalHistory: initialPersonalHistory,
  livingHabits: initialLivingHabits,
  stress: initialStress,
};
