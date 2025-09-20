import { useState, useEffect } from 'react';
import { SkinType, SkinConfig } from '../types';

// 4가지 의료/건강 테마 스킨 설정
const SKIN_CONFIGS: Record<SkinType, SkinConfig> = {
  G: {
    type: 'G',
    name: 'Green',
    description: '웰니스/자연치유 느낌',
    theme: 'Forest Green - 자연스럽고 치유적인 분위기',
    colors: {
      primary: '#2E7D32',      // Forest Green - 메인 브랜드
      primaryDark: '#1B5E20',  // 더 진한 그린 (섹션 헤더)
      accent: '#81C784',       // Light Green - 서브 요소
      background: '#F1F8E9',   // 자연스러운 연한 그린 배경
      surface: '#FFFFFF',      // 카드/표면
      textPrimary: '#2E2E2E',  // 주요 텍스트
      textSecondary: '#424242', // 보조 텍스트
      textTertiary: '#757575', // 부가 텍스트
      buttonPrimary: '#388E3C', // 주요 CTA 버튼
      buttonSecondary: '#E8F5E8', // 보조 버튼 (그린 배경)
      sectionHeader: '#1B5E20', // 섹션 헤더 (더 진한 그린)
      // 기존 호환성 유지
      primaryHover: '#1B5E20',
      primaryBgLight: 'rgba(46, 125, 50, 0.1)',
      primaryShadow: 'rgba(46, 125, 50, 0.3)',
      primaryShadowHover: 'rgba(46, 125, 50, 0.4)',
    },
  },
  M: {
    type: 'M',
    name: 'Mocha',
    description: '고급 의료 서비스/프리미엄 느낌',
    theme: 'Mocha Mousse 2025 트렌드 - 프리미엄하고 신뢰감 있는 분위기',
    colors: {
      primary: '#6B4E3D',      // Mocha Mousse 2025 트렌드
      primaryDark: '#3E2723',  // 더 진한 브라운 (섹션 헤더)
      accent: '#A1887F',       // Light Brown - 서브 요소
      background: '#FFFEF7',   // 따뜻한 화이트
      surface: '#FFFFFF',      // 카드/표면
      textPrimary: '#212121',  // 주요 텍스트
      textSecondary: '#424242', // 보조 텍스트
      textTertiary: '#757575', // 부가 텍스트
      buttonPrimary: '#5D4037', // 주요 CTA 버튼
      buttonSecondary: '#EFEBE9', // 보조 버튼 (베이지 배경)
      sectionHeader: '#3E2723', // 섹션 헤더 (더 진한 브라운)
      // 기존 호환성 유지
      primaryHover: '#3E2723',
      primaryBgLight: 'rgba(107, 78, 61, 0.1)',
      primaryShadow: 'rgba(107, 78, 61, 0.3)',
      primaryShadowHover: 'rgba(107, 78, 61, 0.4)',
    },
  },
  B: {
    type: 'B',
    name: 'Blue',
    description: '클래식 의료진/병원 느낌',
    theme: 'Deep Blue - 전문적이고 신뢰할 수 있는 의료진 분위기',
    colors: {
      primary: '#1565C0',      // Deep Blue - 메인 브랜드
      primaryDark: '#0D47A1',  // 더 진한 블루 (섹션 헤더)
      accent: '#42A5F5',       // Light Blue - 서브 요소
      background: '#FAFAFA',   // 메인 배경
      surface: '#FFFFFF',      // 카드/표면
      textPrimary: '#263238',  // 주요 텍스트
      textSecondary: '#37474F', // 보조 텍스트
      textTertiary: '#546E7A', // 부가 텍스트
      buttonPrimary: '#1976D2', // 주요 CTA 버튼
      buttonSecondary: '#E3F2FD', // 보조 버튼 (파란 배경)
      sectionHeader: '#0D47A1', // 섹션 헤더 (더 진한 블루)
      // 기존 호환성 유지
      primaryHover: '#0D47A1',
      primaryBgLight: 'rgba(21, 101, 192, 0.1)',
      primaryShadow: 'rgba(21, 101, 192, 0.3)',
      primaryShadowHover: 'rgba(21, 101, 192, 0.4)',
    },
  },
  R: {
    type: 'R',
    name: 'Red-Accent',
    description: '응급/혁신적 의료 서비스 느낌',
    theme: 'Blue + Cherry Red - 신뢰감과 긴급성을 동시에 표현',
    colors: {
      primary: '#1565C0',      // Blue 베이스 유지 (신뢰감)
      primaryDark: '#0D47A1',  // 더 진한 블루 (섹션 헤더)
      accent: '#90CAF9',       // Light Blue - 서브 요소
      background: '#FFFFFF',   // 깔끔한 화이트
      surface: '#FFFFFF',      // 카드/표면
      textPrimary: '#212121',  // 주요 텍스트
      textSecondary: '#424242', // 보조 텍스트
      textTertiary: '#757575', // 부가 텍스트
      buttonPrimary: '#D32F2F', // Cherry Red - 강력한 CTA
      buttonSecondary: '#FFEBEE', // 보조 버튼 (연한 레드 배경)
      sectionHeader: '#0D47A1', // 섹션 헤더 (진한 블루)
      // 기존 호환성 유지
      primaryHover: '#B71C1C',
      primaryBgLight: 'rgba(211, 47, 47, 0.1)',
      primaryShadow: 'rgba(211, 47, 47, 0.3)',
      primaryShadowHover: 'rgba(211, 47, 47, 0.4)',
    },
  },
};

// URL 파라미터 유틸리티
const getUrlParameter = (name: string): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
};

const setUrlParameter = (name: string, value: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, '', url.toString());
};

export const useCampaignSkin = () => {
  const [skinType, setSkinType] = useState<SkinType>('G');
  const [skinConfig, setSkinConfig] = useState<SkinConfig>(SKIN_CONFIGS.G);

  // 초기화 및 URL 파라미터 읽기
  useEffect(() => {
    const urlSkin = getUrlParameter('skin') as SkinType;
    const validSkins: SkinType[] = ['G', 'M', 'B', 'R'];
    const defaultSkin: SkinType = validSkins.includes(urlSkin) ? urlSkin : 'G';
    
    setSkinType(defaultSkin);
    setSkinConfig(SKIN_CONFIGS[defaultSkin]);
    
    console.log(`Campaign 스킨 적용: ${defaultSkin} (${SKIN_CONFIGS[defaultSkin].description})`);
  }, []);

  // CSS 변수 적용 - 새로운 테마 시스템
  useEffect(() => {
    const root = document.documentElement;
    const colors = skinConfig.colors;
    
    // 새로운 테마 CSS 변수들
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--background-color', colors.background);
    root.style.setProperty('--surface-color', colors.surface);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-tertiary', colors.textTertiary);
    root.style.setProperty('--button-primary', colors.buttonPrimary);
    root.style.setProperty('--button-secondary', colors.buttonSecondary);
    root.style.setProperty('--section-header', colors.sectionHeader);
    
    // 기존 호환성 유지를 위한 CSS 변수들
    root.style.setProperty('--campaign-primary', colors.primary);
    root.style.setProperty('--campaign-primary-hover', colors.primaryHover);
    root.style.setProperty('--campaign-primary-bg-light', colors.primaryBgLight);
    root.style.setProperty('--campaign-primary-shadow', colors.primaryShadow);
    root.style.setProperty('--campaign-primary-shadow-hover', colors.primaryShadowHover);
    
    // theme-color 메타 태그 업데이트
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', colors.primary);
    }
    
    console.log(`✅ ${skinConfig.name} 테마 CSS 변수 적용 완료`);
  }, [skinConfig]);

  // 스킨 변경 함수
  const changeSkin = (newSkin: SkinType) => {
    setSkinType(newSkin);
    setSkinConfig(SKIN_CONFIGS[newSkin]);
    setUrlParameter('skin', newSkin);
  };

  // 현재 스킨과 함께 URL 생성
  const createUrlWithSkin = (path: string) => {
    return `${path}?skin=${skinType}`;
  };

  return {
    skinType,
    skinConfig,
    changeSkin,
    createUrlWithSkin,
    appliedColors: skinConfig.colors,
  };
}; 