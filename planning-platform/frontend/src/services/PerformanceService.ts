/**
 * PerformanceService - 성능 최적화 서비스
 * 캐싱, 지연 로딩, 성능 모니터링 등을 제공
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  cacheHitRate: number;
  apiResponseTime: number;
  componentMountTime: number;
}

export interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

class PerformanceService {
  private cache = new Map<string, CacheEntry<any>>();
  private metrics: PerformanceMetrics[] = [];
  private observers = new Map<string, IntersectionObserver>();
  private performanceObserver?: PerformanceObserver;

  constructor() {
    this.setupPerformanceMonitoring();
    this.setupMemoryMonitoring();
  }

  // 성능 모니터링 설정
  private setupPerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric({
              loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
              renderTime: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              cacheHitRate: this.getCacheHitRate(),
              apiResponseTime: 0,
              componentMountTime: 0
            });
          }
        });
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
      } catch (error) {
        console.warn('Performance monitoring not supported:', error);
      }
    }
  }

  // 메모리 모니터링 설정
  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
          if (memoryUsage > 0.8) {
            console.warn('High memory usage detected:', memoryUsage);
            this.cleanupCache();
          }
        }
      }, 30000); // 30초마다 체크
    }
  }

  // 캐시 관리
  public setCache<T>(key: string, data: T, ttl: number = 300000): void { // 기본 5분
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key
    });
  }

  public getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public clearCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // 캐시 히트율 계산
  private getCacheHitRate(): number {
    // 실제 구현에서는 히트/미스 카운터를 유지해야 함
    return 0.75; // 임시값
  }

  // 지연 로딩 유틸리티
  public createLazyLoader(
    callback: () => void,
    options: LazyLoadOptions = {}
  ): (element: Element) => void {
    const {
      threshold = 0.1,
      rootMargin = '50px',
      triggerOnce = true
    } = options;

    const observerId = Math.random().toString(36).substr(2, 9);
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback();
            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    this.observers.set(observerId, observer);

    return (element: Element) => {
      observer.observe(element);
    };
  }

  // 이미지 지연 로딩
  public lazyLoadImage(img: HTMLImageElement, src: string): void {
    const loader = this.createLazyLoader(() => {
      img.src = src;
      img.classList.add('loaded');
    });
    loader(img);
  }

  // 컴포넌트 지연 로딩
  public lazyLoadComponent(
    element: Element,
    loadComponent: () => Promise<any>
  ): void {
    const loader = this.createLazyLoader(async () => {
      try {
        await loadComponent();
      } catch (error) {
        console.error('Failed to lazy load component:', error);
      }
    });
    loader(element);
  }

  // 디바운스 유틸리티
  public debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // 스로틀 유틸리티
  public throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  // 메모이제이션
  public memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  // 청크 단위 처리 (대용량 데이터)
  public async processInChunks<T, R>(
    items: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize: number = 100,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const total = items.length;
    
    for (let i = 0; i < total; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
      
      if (onProgress) {
        onProgress(Math.min(i + chunkSize, total), total);
      }
      
      // 다음 청크 처리 전 잠시 대기 (UI 블로킹 방지)
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
  }

  // 가상 스크롤링을 위한 아이템 계산
  public calculateVisibleItems(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    overscan: number = 5
  ): { startIndex: number; endIndex: number; offsetY: number } {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    const offsetY = startIndex * itemHeight;
    
    return { startIndex, endIndex, offsetY };
  }

  // 성능 메트릭 기록
  public recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push({
      ...metric,
      memoryUsage: this.getMemoryUsage()
    });
    
    // 최근 100개만 유지
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }

  // 메모리 사용량 조회
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : undefined; // MB 단위
    }
    return undefined;
  }

  // 성능 메트릭 조회
  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // 평균 성능 메트릭
  public getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};
    
    const totals = this.metrics.reduce(
      (acc, metric) => ({
        loadTime: acc.loadTime + metric.loadTime,
        renderTime: acc.renderTime + metric.renderTime,
        memoryUsage: (acc.memoryUsage || 0) + (metric.memoryUsage || 0),
        cacheHitRate: acc.cacheHitRate + metric.cacheHitRate,
        apiResponseTime: acc.apiResponseTime + metric.apiResponseTime,
        componentMountTime: acc.componentMountTime + metric.componentMountTime
      }),
      {
        loadTime: 0,
        renderTime: 0,
        memoryUsage: 0,
        cacheHitRate: 0,
        apiResponseTime: 0,
        componentMountTime: 0
      }
    );
    
    const count = this.metrics.length;
    return {
      loadTime: totals.loadTime / count,
      renderTime: totals.renderTime / count,
      memoryUsage: (totals.memoryUsage || 0) / count,
      cacheHitRate: totals.cacheHitRate / count,
      apiResponseTime: totals.apiResponseTime / count,
      componentMountTime: totals.componentMountTime / count
    };
  }

  // 번들 크기 분석 (개발 모드에서만)
  public analyzeBundleSize(): void {
    if (process.env.NODE_ENV === 'development') {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      let totalSize = 0;
      
      scripts.forEach(async (script) => {
        const src = (script as HTMLScriptElement).src;
        try {
          const response = await fetch(src, { method: 'HEAD' });
          const size = parseInt(response.headers.get('content-length') || '0');
          totalSize += size;
          console.log(`Bundle: ${src} - ${(size / 1024).toFixed(2)}KB`);
        } catch (error) {
          console.warn(`Failed to analyze bundle size for ${src}:`, error);
        }
      });
      
      console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)}KB`);
    }
  }

  // 리소스 정리
  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    this.cache.clear();
    this.metrics.length = 0;
  }

  // 성능 권장사항 생성
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgMetrics = this.getAverageMetrics();
    
    if (avgMetrics.loadTime && avgMetrics.loadTime > 3000) {
      recommendations.push('페이지 로딩 시간이 느립니다. 번들 크기를 줄이거나 코드 스플리팅을 고려해보세요.');
    }
    
    if (avgMetrics.memoryUsage && avgMetrics.memoryUsage > 100) {
      recommendations.push('메모리 사용량이 높습니다. 메모리 누수를 확인하고 불필요한 객체를 정리해보세요.');
    }
    
    if (avgMetrics.cacheHitRate && avgMetrics.cacheHitRate < 0.5) {
      recommendations.push('캐시 히트율이 낮습니다. 캐싱 전략을 개선해보세요.');
    }
    
    if (avgMetrics.apiResponseTime && avgMetrics.apiResponseTime > 1000) {
      recommendations.push('API 응답 시간이 느립니다. API 최적화나 캐싱을 고려해보세요.');
    }
    
    return recommendations;
  }
}

// 싱글톤 인스턴스
export const performanceService = new PerformanceService();
export default performanceService;
