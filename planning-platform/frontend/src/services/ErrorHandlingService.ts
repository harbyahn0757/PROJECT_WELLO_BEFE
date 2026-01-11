/**
 * ErrorHandlingService - 통합 에러 처리 서비스
 * 사용자 친화적 에러 메시지, 재시도 로직, 오프라인 지원
 */

export interface AppError {
  id: string;
  type: 'network' | 'auth' | 'validation' | 'server' | 'client' | 'offline';
  code: string;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  context?: {
    url?: string;
    method?: string;
    component?: string;
    action?: string;
  };
}

export interface ErrorHandlerOptions {
  showToUser?: boolean;
  allowRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  logToConsole?: boolean;
  reportToService?: boolean;
  context?: AppError['context'];
}

export interface RetryOptions {
  maxRetries: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: AppError) => void;
}

class ErrorHandlingService {
  private errors: AppError[] = [];
  private listeners: ((errors: AppError[]) => void)[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryQueue: Map<string, () => Promise<any>> = new Map();

  constructor() {
    this.setupOnlineStatusListener();
    this.setupGlobalErrorHandlers();
  }

  // 온라인 상태 감지 설정
  private setupOnlineStatusListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processRetryQueue();
      this.createError({
        type: 'client',
        code: 'NETWORK_RESTORED',
        message: 'Network connection restored',
        userMessage: '인터넷 연결이 복구되었습니다.',
        retryable: false
      }, { showToUser: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.createError({
        type: 'offline',
        code: 'NETWORK_OFFLINE',
        message: 'Network connection lost',
        userMessage: '인터넷 연결이 끊어졌습니다. 연결 상태를 확인해주세요.',
        retryable: true
      }, { showToUser: true });
    });
  }

  // 전역 에러 핸들러 설정
  private setupGlobalErrorHandlers(): void {
    // JavaScript 에러 처리
    window.addEventListener('error', (event) => {
      this.createError({
        type: 'client',
        code: 'JAVASCRIPT_ERROR',
        message: event.message,
        userMessage: '예상치 못한 오류가 발생했습니다.',
        retryable: false,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      }, { logToConsole: true, reportToService: true });
    });

    // Promise rejection 처리
    window.addEventListener('unhandledrejection', (event) => {
      this.createError({
        type: 'client',
        code: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        userMessage: '처리되지 않은 오류가 발생했습니다.',
        retryable: false,
        details: {
          reason: event.reason,
          stack: event.reason?.stack
        }
      }, { logToConsole: true, reportToService: true });
    });
  }

  // 에러 생성 및 처리
  public createError(
    errorData: Omit<AppError, 'id' | 'timestamp'>,
    options: ErrorHandlerOptions = {}
  ): AppError {
    const error: AppError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      ...errorData
    };

    if (options.context) {
      error.context = { ...error.context, ...options.context };
    }

    this.errors.unshift(error);
    this.notifyListeners();

    // 콘솔 로깅
    if (options.logToConsole !== false) {
      console.error(`[${error.type.toUpperCase()}] ${error.code}:`, error.message, error.details);
    }

    // 외부 서비스 리포팅 (실제 구현에서는 Sentry, LogRocket 등 사용)
    if (options.reportToService) {
      this.reportError(error);
    }

    return error;
  }

  // HTTP 에러 처리
  public handleHttpError(
    response: Response,
    context?: AppError['context'],
    options: ErrorHandlerOptions = {}
  ): AppError {
    const errorType = this.getHttpErrorType(response.status);
    const errorCode = `HTTP_${response.status}`;
    const userMessage = this.getHttpErrorMessage(response.status);

    return this.createError({
      type: errorType,
      code: errorCode,
      message: `HTTP ${response.status}: ${response.statusText}`,
      userMessage,
      retryable: this.isHttpErrorRetryable(response.status),
      context: {
        ...context,
        url: response.url,
        method: 'GET' // 실제로는 요청 메소드를 전달받아야 함
      }
    }, options);
  }

  // HTTP 에러 타입 결정
  private getHttpErrorType(status: number): AppError['type'] {
    if (status >= 400 && status < 500) {
      if (status === 401 || status === 403) return 'auth';
      if (status === 400 || status === 422) return 'validation';
      return 'client';
    }
    if (status >= 500) return 'server';
    return 'network';
  }

  // HTTP 에러 메시지 생성
  private getHttpErrorMessage(status: number): string {
    switch (status) {
      case 400:
        return '잘못된 요청입니다. 입력 내용을 확인해주세요.';
      case 401:
        return '로그인이 필요합니다. 다시 로그인해주세요.';
      case 403:
        return '접근 권한이 없습니다.';
      case 404:
        return '요청한 정보를 찾을 수 없습니다.';
      case 408:
        return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      case 429:
        return '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
      case 500:
        return '서버에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      case 502:
      case 503:
      case 504:
        return '서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.';
    }
  }

  // HTTP 에러 재시도 가능 여부
  private isHttpErrorRetryable(status: number): boolean {
    // 4xx 클라이언트 에러는 일반적으로 재시도 불가 (단, 408, 429 제외)
    if (status >= 400 && status < 500) {
      return status === 408 || status === 429;
    }
    // 5xx 서버 에러는 재시도 가능
    if (status >= 500) {
      return true;
    }
    // 네트워크 에러는 재시도 가능
    return true;
  }

  // 재시도 로직
  public async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    errorContext?: AppError['context']
  ): Promise<T> {
    let lastError: AppError | null = null;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.createError({
          type: 'network',
          code: 'RETRY_ATTEMPT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          userMessage: `재시도 중입니다... (${attempt}/${options.maxRetries})`,
          retryable: attempt < options.maxRetries,
          retryCount: attempt,
          maxRetries: options.maxRetries,
          context: errorContext
        }, { showToUser: attempt === options.maxRetries });

        if (options.onRetry) {
          options.onRetry(attempt, lastError);
        }

        if (attempt < options.maxRetries) {
          const delay = this.calculateRetryDelay(attempt, options);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  // 재시도 지연 시간 계산
  private calculateRetryDelay(attempt: number, options: RetryOptions): number {
    const baseDelay = options.delay;
    
    switch (options.backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
      default:
        return baseDelay * attempt;
    }
  }

  // 지연 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 재시도 큐 처리 (오프라인 → 온라인 시)
  private async processRetryQueue(): Promise<void> {
    if (!this.isOnline || this.retryQueue.size === 0) return;

    const retryPromises = Array.from(this.retryQueue.entries()).map(async ([id, operation]) => {
      try {
        await operation();
        this.retryQueue.delete(id);
      } catch (error) {
        console.warn(`Retry failed for operation ${id}:`, error);
      }
    });

    await Promise.allSettled(retryPromises);
  }

  // 재시도 큐에 작업 추가
  public addToRetryQueue(id: string, operation: () => Promise<any>): void {
    this.retryQueue.set(id, operation);
  }

  // 에러 리스너 등록
  public subscribe(listener: (errors: AppError[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // 리스너 알림
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.errors]));
  }

  // 에러 목록 조회
  public getErrors(): AppError[] {
    return [...this.errors];
  }

  // 에러 삭제
  public dismissError(errorId: string): void {
    this.errors = this.errors.filter(error => error.id !== errorId);
    this.notifyListeners();
  }

  // 모든 에러 삭제
  public clearErrors(): void {
    this.errors = [];
    this.notifyListeners();
  }

  // 온라인 상태 확인
  public isOnlineStatus(): boolean {
    return this.isOnline;
  }

  // 에러 리포팅 (외부 서비스)
  private reportError(error: AppError): void {
    // 실제 구현에서는 Sentry, LogRocket, 자체 로깅 서비스 등 사용
    if (process.env.NODE_ENV === 'production') {
      // 예: Sentry.captureException(error);
      console.log('Error reported to external service:', error);
    }
  }

  // 사용자 친화적 에러 메시지 생성
  public getUserFriendlyMessage(error: AppError): string {
    if (error.userMessage) return error.userMessage;

    switch (error.type) {
      case 'network':
        return '네트워크 연결을 확인해주세요.';
      case 'auth':
        return '로그인이 필요합니다.';
      case 'validation':
        return '입력 내용을 확인해주세요.';
      case 'server':
        return '서버에 일시적인 문제가 발생했습니다.';
      case 'offline':
        return '인터넷 연결이 필요합니다.';
      default:
        return '예상치 못한 오류가 발생했습니다.';
    }
  }

  // 에러 복구 제안
  public getRecoveryActions(error: AppError): Array<{
    label: string;
    action: () => void;
  }> {
    const actions: Array<{ label: string; action: () => void }> = [];

    if (error.retryable && error.retryCount! < error.maxRetries!) {
      actions.push({
        label: '다시 시도',
        action: () => {
          // 실제로는 원래 작업을 재시도해야 함
          console.log('Retrying operation for error:', error.id);
        }
      });
    }

    if (error.type === 'auth') {
      actions.push({
        label: '로그인',
        action: () => {
          window.location.href = '/welno/login';
        }
      });
    }

    if (error.type === 'offline') {
      actions.push({
        label: '연결 확인',
        action: () => {
          window.location.reload();
        }
      });
    }

    actions.push({
      label: '새로고침',
      action: () => {
        window.location.reload();
      }
    });

    return actions;
  }
}

// 싱글톤 인스턴스
export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService;
