/**
 * LazyImage - 지연 로딩 이미지 컴포넌트
 * Intersection Observer를 사용한 효율적인 이미지 로딩
 */
import React, { useState, useRef, useEffect } from 'react';
import { performanceService } from '../../../services/PerformanceService';
import './styles.scss';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  fallback?: string;
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  wrapperClassName?: string;
  showPlaceholder?: boolean;
  blurPlaceholder?: boolean;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  onLoad,
  onError,
  className = '',
  wrapperClassName = '',
  showPlaceholder = true,
  blurPlaceholder = true,
  ...imgProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // Intersection Observer 설정
  useEffect(() => {
    if (!imgRef.current) return;

    const loader = performanceService.createLazyLoader(
      () => {
        setIsInView(true);
      },
      { threshold, rootMargin, triggerOnce: true }
    );

    loader(imgRef.current);
  }, [threshold, rootMargin]);

  // 이미지 로드 핸들러
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // 이미지 에러 핸들러
  const handleError = () => {
    setIsError(true);
    onError?.();
  };

  // 플레이스홀더 생성
  const generatePlaceholder = () => {
    if (placeholder) return placeholder;
    
    // SVG 플레이스홀더 생성
    const width = imgProps.width || 300;
    const height = imgProps.height || 200;
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">
          이미지 로딩 중...
        </text>
      </svg>
    `)}`;
  };

  // 에러 플레이스홀더 생성
  const generateErrorPlaceholder = () => {
    if (fallback) return fallback;
    
    const width = imgProps.width || 300;
    const height = imgProps.height || 200;
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#fef2f2"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#ef4444" text-anchor="middle" dy=".3em">
          이미지를 불러올 수 없습니다
        </text>
      </svg>
    `)}`;
  };

  return (
    <div className={`lazy-image-wrapper ${wrapperClassName}`}>
      {/* 플레이스홀더 */}
      {showPlaceholder && !isLoaded && !isError && (
        <div
          ref={placeholderRef}
          className={`lazy-image__placeholder ${blurPlaceholder ? 'lazy-image__placeholder--blur' : ''}`}
          style={{
            width: imgProps.width,
            height: imgProps.height,
            backgroundImage: `url(${generatePlaceholder()})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      )}

      {/* 실제 이미지 */}
      <img
        ref={imgRef}
        src={isInView ? (isError ? generateErrorPlaceholder() : src) : undefined}
        alt={alt}
        className={`lazy-image ${className} ${isLoaded ? 'lazy-image--loaded' : ''} ${isError ? 'lazy-image--error' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy" // 네이티브 지연 로딩 지원
        {...imgProps}
      />

      {/* 로딩 인디케이터 */}
      {isInView && !isLoaded && !isError && (
        <div className="lazy-image__loading">
          <div className="lazy-image__spinner" />
        </div>
      )}

      {/* 에러 메시지 */}
      {isError && (
        <div className="lazy-image__error">
          <div className="lazy-image__error-icon">⚠️</div>
          <p className="lazy-image__error-message">이미지를 불러올 수 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default LazyImage;
