import { 
  PasswordServiceResponse,
  PasswordCheckResponse,
  PasswordPromptCheckResponse
} from './types';
import { API_ENDPOINTS } from '../../config/api';

export class PasswordService {
  private static async request<T>(
    method: string,
    url: string,
    body?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'API 요청 실패');
    }
    return response.json();
  }

  static async checkPasswordStatus(uuid: string, hospitalId: string): Promise<PasswordCheckResponse> {
    const url = API_ENDPOINTS.PASSWORD.CHECK_PASSWORD(uuid, hospitalId);
    const result = await this.request<any>('GET', url);
    
    return {
      has_password: result.data?.hasPassword || false,
      is_locked: result.data?.isLocked || false
    };
  }

  static async setPassword(
    uuid: string, 
    hospitalId: string, 
    password: string,
    userInfo?: {
      name?: string;
      phone_number?: string;
      birth_date?: string;
      gender?: string;
    }
  ): Promise<PasswordServiceResponse> {
    const url = API_ENDPOINTS.PASSWORD.SET_PASSWORD(uuid, hospitalId);
    try {
      const result = await this.request<any>('POST', url, { 
        password,
        ...userInfo 
      });
      return {
        success: result.success || true,
        message: result.message || '비밀번호가 성공적으로 설정되었습니다.'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '비밀번호 설정에 실패했습니다.'
      };
    }
  }

  static async verifyPassword(uuid: string, hospitalId: string, password: string): Promise<PasswordServiceResponse> {
    const url = API_ENDPOINTS.PASSWORD.VERIFY_PASSWORD(uuid, hospitalId);
    try {
      const result = await this.request<any>('POST', url, { password });
      return {
        success: result.success,
        message: result.message || '비밀번호 확인 성공'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '비밀번호가 일치하지 않습니다.'
      };
    }
  }

  static async changePassword(uuid: string, hospitalId: string, oldPassword: string, newPassword: string): Promise<PasswordServiceResponse> {
    const url = API_ENDPOINTS.PASSWORD.CHANGE_PASSWORD(uuid, hospitalId);
    try {
      const result = await this.request<any>('PUT', url, { 
        old_password: oldPassword, 
        new_password: newPassword 
      });
      return {
        success: result.success || true,
        message: result.message || '비밀번호가 성공적으로 변경되었습니다.'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '비밀번호 변경에 실패했습니다.'
      };
    }
  }

  static async checkPromptPasswordSetup(uuid: string, hospitalId: string): Promise<PasswordPromptCheckResponse> {
    const url = API_ENDPOINTS.PASSWORD.PROMPT_CHECK(uuid, hospitalId);
    const result = await this.request<any>('GET', url);
    
    return {
      should_prompt: result.data?.shouldPrompt || false
    };
  }

  static async updatePasswordPromptTime(uuid: string, hospitalId: string): Promise<PasswordServiceResponse> {
    const url = API_ENDPOINTS.PASSWORD.PROMPT_UPDATE(uuid, hospitalId);
    const result = await this.request<any>('POST', url);
    
    return {
      success: result.success || true,
      message: result.message || '비밀번호 설정 권유 시간이 업데이트되었습니다.'
    };
  }

  static async updateLastAccessTime(uuid: string, hospitalId: string): Promise<PasswordServiceResponse> {
    const url = API_ENDPOINTS.PASSWORD.ACCESS_UPDATE(uuid, hospitalId);
    const result = await this.request<any>('POST', url);
    
    return {
      success: result.success || true,
      message: result.message || '마지막 접근 시간이 업데이트되었습니다.'
    };
  }
}