/**
 * 환경별 로깅 유틸리티
 * 개발: 모든 로그 출력
 * 프로덕션: 로그 출력 안 함
 */

const isDevelopment = 
  process.env.NODE_ENV === 'development' || 
  window.location.hostname === 'localhost' ||
  window.location.hostname.startsWith('192.168');

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // 프로덕션에서도 에러 로그 제거
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  table: (data: any) => {
    if (isDevelopment && console.table) {
      console.table(data);
    }
  },
  
  group: (label: string) => {
    if (isDevelopment && console.group) {
      console.group(label);
    }
  },
  
  groupEnd: () => {
    if (isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  }
};

export default logger;
