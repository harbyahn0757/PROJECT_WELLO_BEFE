/**
 * 채팅 인터페이스 타입 정의
 */

export type MessageType = 
  | 'bot_intro'           // 봇 인사말
  | 'bot_analysis'        // 분석 결과 제시
  | 'bot_question'        // 질문/선택 요청
  | 'user_selection'      // 사용자 선택
  | 'bot_confirmation'    // 확인 메시지
  | 'bot_progress';       // 진행 상태

export interface ChatMessage {
  id: string;
  type: MessageType;
  sender: 'bot' | 'user';
  content: string;
  timestamp: Date;
  options?: ChatOption[];  // 선택 옵션 (봇 메시지에만)
  data?: any;              // 메시지 관련 데이터
  animationDelay?: number; // 애니메이션 delay (ms)
}

export interface ChatOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  data: any;              // 선택 시 전달할 데이터
}

export type ChatStep = 
  | 'prescription_analysis'  // Step 1: 처방 패턴 분석 및 선택
  | 'checkup_selection'       // Step 2: 검진 카드 선택
  | 'treatment_selection'    // Step 3: 진료 기록 선택 (선택적)
  | 'complete';              // 완료

export interface ChatInterfaceState {
  currentStep: ChatStep;
  messages: ChatMessage[];
  selectedPrescriptionEffects: string[];  // 선택된 처방 효능
  selectedCheckupRecords: string[];      // 선택된 검진 기록
  selectedTreatmentRecords: string[];     // 선택된 진료 기록
}

