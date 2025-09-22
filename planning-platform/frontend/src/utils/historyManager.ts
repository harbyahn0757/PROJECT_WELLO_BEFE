/**
 * 브라우저 히스토리 관리 유틸리티
 * 페이지간 이동과 단계별 진행을 위한 히스토리 스택 관리
 */

export interface HistoryState {
  type: 'page' | 'step' | 'auth';
  page?: string;
  step?: string;
  data?: any;
  timestamp: number;
}

export class HistoryManager {
  private static instance: HistoryManager | null = null;
  
  public static getInstance(): HistoryManager {
    if (!this.instance) {
      this.instance = new HistoryManager();
    }
    return this.instance;
  }
  
  /**
   * 새로운 상태를 히스토리에 추가
   */
  pushState(state: Omit<HistoryState, 'timestamp'>, title: string = '', url?: string): void {
    const fullState: HistoryState = {
      ...state,
      timestamp: Date.now()
    };
    
    console.log('📝 [히스토리] 새 상태 추가:', fullState);
    window.history.pushState(fullState, title, url || window.location.href);
  }
  
  /**
   * 현재 상태를 교체
   */
  replaceState(state: Omit<HistoryState, 'timestamp'>, title: string = '', url?: string): void {
    const fullState: HistoryState = {
      ...state,
      timestamp: Date.now()
    };
    
    console.log('🔄 [히스토리] 상태 교체:', fullState);
    window.history.replaceState(fullState, title, url || window.location.href);
  }
  
  /**
   * 뒤로가기
   */
  back(): void {
    console.log('⬅️ [히스토리] 뒤로가기');
    window.history.back();
  }
  
  /**
   * 앞으로가기
   */
  forward(): void {
    console.log('➡️ [히스토리] 앞으로가기');
    window.history.forward();
  }
  
  /**
   * 현재 히스토리 상태 가져오기
   */
  getCurrentState(): HistoryState | null {
    const state = window.history.state;
    return state && typeof state === 'object' && state.timestamp ? state as HistoryState : null;
  }
  
  /**
   * 특정 타입의 상태인지 확인
   */
  isStateType(type: HistoryState['type']): boolean {
    const state = this.getCurrentState();
    return state?.type === type;
  }
  
  /**
   * 특정 페이지로 이동 (히스토리 관리)
   */
  navigateToPage(page: string, data?: any): void {
    this.pushState({
      type: 'page',
      page,
      data
    });
  }
  
  /**
   * 단계별 진행 (히스토리 관리)
   */
  navigateToStep(step: string, data?: any): void {
    this.pushState({
      type: 'step',
      step,
      data
    });
  }
  
  /**
   * 인증 단계 진행 (히스토리 관리)
   */
  navigateToAuthStep(step: string, data?: any): void {
    this.pushState({
      type: 'auth',
      step,
      data
    });
  }
  
  /**
   * popstate 이벤트 리스너 등록
   */
  addPopStateListener(callback: (event: PopStateEvent) => void): () => void {
    window.addEventListener('popstate', callback);
    
    return () => {
      window.removeEventListener('popstate', callback);
    };
  }
}

export const historyManager = HistoryManager.getInstance();
