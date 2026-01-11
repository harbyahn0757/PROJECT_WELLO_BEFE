import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

/**
 * WelnoUIContext
 * 
 * UI 관련 전역 상태를 관리하는 Context입니다.
 * 로딩, 에러, 모달 등의 UI 상태를 중앙에서 관리합니다.
 */

export interface UIError {
  type: 'validation' | 'network' | 'server' | 'auth' | 'unknown';
  message: string;
  details?: string;
  timestamp?: number;
}

export interface ModalConfig {
  isOpen: boolean;
  type?: 'info' | 'success' | 'error' | 'warning' | 'confirm';
  title?: string;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface WelnoUIState {
  isLoading: boolean;
  loadingMessage: string;
  error: UIError | null;
  modal: ModalConfig;
  showTermsModal: boolean;
  showPasswordModal: boolean;
}

interface WelnoUIActions {
  setLoading: (isLoading: boolean, message?: string) => void;
  setError: (error: UIError | null) => void;
  showModal: (config: Partial<ModalConfig>) => void;
  hideModal: () => void;
  setShowTermsModal: (show: boolean) => void;
  setShowPasswordModal: (show: boolean) => void;
  clearError: () => void;
}

interface WelnoUIContextValue {
  state: WelnoUIState;
  actions: WelnoUIActions;
}

const WelnoUIContext = createContext<WelnoUIContextValue | undefined>(undefined);

interface WelnoUIProviderProps {
  children: ReactNode;
}

export const WelnoUIProvider: React.FC<WelnoUIProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<UIError | null>(null);
  const [modal, setModal] = useState<ModalConfig>({ isOpen: false });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const setLoading = useCallback((loading: boolean, message = '') => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }, []);
  
  const showModal = useCallback((config: Partial<ModalConfig>) => {
    setModal(prev => ({
      ...prev,
      ...config,
      isOpen: true,
    }));
  }, []);
  
  const hideModal = useCallback(() => {
    setModal(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const value: WelnoUIContextValue = {
    state: {
      isLoading,
      loadingMessage,
      error,
      modal,
      showTermsModal,
      showPasswordModal,
    },
    actions: {
      setLoading,
      setError,
      showModal,
      hideModal,
      setShowTermsModal,
      setShowPasswordModal,
      clearError,
    },
  };
  
  return (
    <WelnoUIContext.Provider value={value}>
      {children}
    </WelnoUIContext.Provider>
  );
};

/**
 * useWelnoUI Hook
 * 
 * WelnoUIContext를 사용하기 위한 커스텀 훅입니다.
 * 
 * @returns {WelnoUIContextValue} UI 상태와 actions
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 */
export const useWelnoUI = (): WelnoUIContextValue => {
  const context = useContext(WelnoUIContext);
  
  if (!context) {
    throw new Error('useWelnoUI must be used within a WelnoUIProvider');
  }
  
  return context;
};

export type { WelnoUIState, WelnoUIActions, WelnoUIContextValue };
