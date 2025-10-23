import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { API_ENDPOINTS } from '../config/api';

// 사용자 데이터 타입 정의
export interface UserData {
  uuid: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  phone: string;
  birthday: string;
  hospital: {
    hospital_id: string;
    name: string;
    phone: string;
    address: string;
    supported_checkup_types: string[];
    layout_type: string;
    brand_color: string;
    logo_position: string;
    is_active: boolean;
  };
  last_checkup_count: number;
  created_at: string;
}

// 인증 데이터 타입 정의 (틸코 API용)
export interface AuthData {
  name: string;
  gender: 'M' | 'F';
  phoneNo: string;
  birthday: string;
}

// Context 타입 정의
interface UserContextType {
  userData: UserData | null;
  authData: AuthData | null;
  isLoading: boolean;
  error: string | null;
  
  // 액션들
  setUserData: (data: UserData) => void;
  setAuthData: (data: AuthData) => void;
  loadUserFromUUID: (uuid: string) => Promise<void>;
  clearUserData: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Context 생성
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provider 컴포넌트
interface UserContextProviderProps {
  children: ReactNode;
}

export const UserContextProvider: React.FC<UserContextProviderProps> = ({ children }) => {
  const [userData, setUserDataState] = useState<UserData | null>(null);
  const [authData, setAuthDataState] = useState<AuthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용자 데이터 설정
  const setUserData = useCallback((data: UserData) => {
    setUserDataState(data);
    
    // 사용자 데이터에서 인증 데이터 자동 생성
    const authData: AuthData = {
      name: data.name,
      gender: data.gender === 'MALE' ? 'M' : 'F',
      phoneNo: data.phone.replace(/-/g, ''), // 하이픈 제거
      birthday: data.birthday
    };
    setAuthDataState(authData);
    setError(null);
  }, []);

  // 인증 데이터만 별도 설정
  const setAuthData = useCallback((data: AuthData) => {
    setAuthDataState(data);
  }, []);

  // UUID로부터 사용자 데이터 로드
  const loadUserFromUUID = useCallback(async (uuid: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(API_ENDPOINTS.PATIENT(uuid));
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 사용자 데이터를 불러올 수 없습니다.`);
      }
      
      const userData: UserData = await response.json();
      setUserData(userData);
      
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '사용자 데이터를 불러오는 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [setUserData]);

  // 사용자 데이터 초기화
  const clearUserData = useCallback(() => {
    setUserDataState(null);
    setAuthDataState(null);
    setError(null);
  }, []);

  // 로딩 상태 설정
  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const contextValue: UserContextType = {
    userData,
    authData,
    isLoading,
    error,
    setUserData,
    setAuthData,
    loadUserFromUUID,
    clearUserData,
    setLoading,
    setError
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

// Custom Hook
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserContextProvider');
  }
  return context;
};

export default UserContext;


