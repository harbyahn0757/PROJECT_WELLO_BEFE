/**
 * ErrorBoundary - React 에러 경계 컴포넌트
 * 예상치 못한 에러를 포착하고 사용자 친화적인 UI 제공
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandlingService } from '../../../services/ErrorHandlingService';
import './styles.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 서비스에 등록
    const errorId = errorHandlingService.createError({
      type: 'client',
      code: 'REACT_ERROR_BOUNDARY',
      message: error.message,
      userMessage: '페이지를 불러오는 중 오류가 발생했습니다.',
      retryable: true,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name
      }
    }, {
      logToConsole: true,
      reportToService: true
    }).id;

    this.setState({ errorId });

    // 부모 컴포넌트에 에러 알림
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/wello/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              ⚠️
            </div>
            
            <div className="error-boundary__content">
              <h1 className="error-boundary__title">
                앗, 문제가 발생했어요!
              </h1>
              
              <p className="error-boundary__message">
                페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
                <br />
                잠시 후 다시 시도해주세요.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="error-boundary__details">
                  <summary>개발자 정보</summary>
                  <pre className="error-boundary__stack">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="error-boundary__actions">
              <button
                className="error-boundary__button error-boundary__button--primary"
                onClick={this.handleRetry}
              >
                다시 시도
              </button>
              
              <button
                className="error-boundary__button error-boundary__button--secondary"
                onClick={this.handleReload}
              >
                페이지 새로고침
              </button>
              
              <button
                className="error-boundary__button error-boundary__button--ghost"
                onClick={this.handleGoHome}
              >
                홈으로 이동
              </button>
            </div>

            <div className="error-boundary__help">
              <p>
                문제가 계속 발생하면{' '}
                <a 
                  href="mailto:support@wello.co.kr"
                  className="error-boundary__link"
                >
                  고객지원팀
                </a>
                으로 문의해주세요.
              </p>
              {this.state.errorId && (
                <p className="error-boundary__error-id">
                  오류 ID: {this.state.errorId}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
