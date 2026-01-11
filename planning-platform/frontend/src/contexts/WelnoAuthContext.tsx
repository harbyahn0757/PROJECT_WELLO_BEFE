import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthFlow } from '../components/auth/hooks';
import type { 
  AuthFlowState, 
  AuthFlowActions,
} from '../components/auth/hooks';

/**
 * WelnoAuthContext
 * 
 * 인증 플로우 관련 전역 상태를 관리하는 Context입니다.
 * useAuthFlow 훅의 상태를 Context로 승격하여 앱 전체에서 사용할 수 있게 합니다.
 */

interface WelnoAuthContextValue {
  state: AuthFlowState;
  actions: AuthFlowActions;
}

const WelnoAuthContext = createContext<WelnoAuthContextValue | undefined>(undefined);

interface WelnoAuthProviderProps {
  children: ReactNode;
}

export const WelnoAuthProvider: React.FC<WelnoAuthProviderProps> = ({ children }) => {
  const authFlow = useAuthFlow();
  
  const value: WelnoAuthContextValue = {
    state: authFlow.state,
    actions: authFlow.actions,
  };
  
  return (
    <WelnoAuthContext.Provider value={value}>
      {children}
    </WelnoAuthContext.Provider>
  );
};

/**
 * useWelnoAuth Hook
 * 
 * WelnoAuthContext를 사용하기 위한 커스텀 훅입니다.
 * 
 * @returns {WelnoAuthContextValue} 인증 플로우의 state와 actions
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 */
export const useWelnoAuth = (): WelnoAuthContextValue => {
  const context = useContext(WelnoAuthContext);
  
  if (!context) {
    throw new Error('useWelnoAuth must be used within a WelnoAuthProvider');
  }
  
  return context;
};

export type { WelnoAuthContextValue };
