import { useState, useEffect } from 'react';
import { SkinType, SkinConfig, ReportColors } from '../types';

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
    reportColors: {
      panelBackground: '#4a4a4a',
      accentColor: '#81C784',      // Light Green
      accentBgLight: 'rgba(129, 199, 132, 0.2)',
      accentBorder: 'rgba(129, 199, 132, 0.3)',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.9)',
      textTertiary: 'rgba(255, 255, 255, 0.7)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      dangerColor: '#ef4444',
      rankValueColor: '#81C784',
      ageCardBg: 'rgba(255, 255, 255, 0.1)',
      ageCardBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardBetterBg: 'rgba(16, 185, 129, 0.2)',
      ageCardBetterBorder: 'rgba(16, 185, 129, 0.5)',
      ageCardWorseBg: 'rgba(239, 68, 68, 0.2)',
      ageCardWorseBorder: 'rgba(239, 68, 68, 0.5)',
      sectionBg: 'rgba(255, 255, 255, 0.08)',
      sectionBorder: 'rgba(129, 199, 132, 0.3)',
      cardBg: 'rgba(255, 255, 255, 0.05)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      spinnerColor: '#81C784',
      // 브라운 스킨 전용 변수 기본값 (기본 스킨용)
      ageCardCurrentBg: 'rgba(255, 255, 255, 0.1)',
      ageCardCurrentBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardDefaultBg: 'rgba(255, 255, 255, 0.1)',
      ageCardDefaultBorder: 'rgba(255, 255, 255, 0.2)',
      ageDiffBadgeBg: 'rgba(129, 199, 132, 0.2)',
      ageDiffBadgeColor: '#81C784',
      rankItemMainBg: 'rgba(129, 199, 132, 0.1)',
      rankItemMainBorder: 'rgba(129, 199, 132, 0.3)',
      rankItemGoodBg: 'rgba(16, 185, 129, 0.1)',
      rankItemGoodBorder: 'rgba(16, 185, 129, 0.3)',
      rankItemBadBg: 'rgba(239, 68, 68, 0.1)',
      rankItemBadBorder: 'rgba(239, 68, 68, 0.3)',
      diseaseTagColor: '#81C784',
      diseaseCountBg: 'rgba(255, 255, 255, 0.2)',
      diseaseCountColor: 'rgba(255, 255, 255, 0.9)',
      chartBackground: 'rgba(255, 255, 255, 0.1)',
      diseaseTypeBg: 'rgba(129, 199, 132, 0.1)',
      diseaseTypeColor: '#81C784',
      influenceItemBg: 'rgba(255, 255, 255, 0.05)',
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
    reportColors: {
      panelBackground: '#4a4a4a',
      accentColor: '#A1887F',      // Light Brown
      accentBgLight: 'rgba(161, 136, 127, 0.2)',
      accentBorder: 'rgba(161, 136, 127, 0.3)',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.9)',
      textTertiary: 'rgba(255, 255, 255, 0.7)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      dangerColor: '#ef4444',
      rankValueColor: '#A1887F',
      ageCardBg: 'rgba(255, 255, 255, 0.1)',
      ageCardBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardBetterBg: 'rgba(16, 185, 129, 0.2)',
      ageCardBetterBorder: 'rgba(16, 185, 129, 0.5)',
      ageCardWorseBg: 'rgba(239, 68, 68, 0.2)',
      ageCardWorseBorder: 'rgba(239, 68, 68, 0.5)',
      sectionBg: 'rgba(255, 255, 255, 0.08)',
      sectionBorder: 'rgba(161, 136, 127, 0.3)',
      cardBg: 'rgba(255, 255, 255, 0.05)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      spinnerColor: '#A1887F',
      // 브라운 스킨 전용 변수 기본값 (기본 스킨용)
      ageCardCurrentBg: 'rgba(255, 255, 255, 0.1)',
      ageCardCurrentBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardDefaultBg: 'rgba(255, 255, 255, 0.1)',
      ageCardDefaultBorder: 'rgba(255, 255, 255, 0.2)',
      ageDiffBadgeBg: 'rgba(161, 136, 127, 0.2)',
      ageDiffBadgeColor: '#A1887F',
      rankItemMainBg: 'rgba(161, 136, 127, 0.1)',
      rankItemMainBorder: 'rgba(161, 136, 127, 0.3)',
      rankItemGoodBg: 'rgba(16, 185, 129, 0.1)',
      rankItemGoodBorder: 'rgba(16, 185, 129, 0.3)',
      rankItemBadBg: 'rgba(239, 68, 68, 0.1)',
      rankItemBadBorder: 'rgba(239, 68, 68, 0.3)',
      diseaseTagColor: '#A1887F',
      diseaseCountBg: 'rgba(255, 255, 255, 0.2)',
      diseaseCountColor: 'rgba(255, 255, 255, 0.9)',
      chartBackground: 'rgba(255, 255, 255, 0.1)',
      diseaseTypeBg: 'rgba(161, 136, 127, 0.1)',
      diseaseTypeColor: '#A1887F',
      influenceItemBg: 'rgba(255, 255, 255, 0.05)',
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
    reportColors: {
      panelBackground: '#4a4a4a',
      accentColor: '#42A5F5',      // Light Blue
      accentBgLight: 'rgba(66, 165, 245, 0.2)',
      accentBorder: 'rgba(66, 165, 245, 0.3)',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.9)',
      textTertiary: 'rgba(255, 255, 255, 0.7)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      dangerColor: '#ef4444',
      rankValueColor: '#42A5F5',
      ageCardBg: 'rgba(255, 255, 255, 0.1)',
      ageCardBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardBetterBg: 'rgba(16, 185, 129, 0.2)',
      ageCardBetterBorder: 'rgba(16, 185, 129, 0.5)',
      ageCardWorseBg: 'rgba(239, 68, 68, 0.2)',
      ageCardWorseBorder: 'rgba(239, 68, 68, 0.5)',
      sectionBg: 'rgba(255, 255, 255, 0.08)',
      sectionBorder: 'rgba(66, 165, 245, 0.3)',
      cardBg: 'rgba(255, 255, 255, 0.05)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      spinnerColor: '#42A5F5',
      // 브라운 스킨 전용 변수 기본값 (기본 스킨용)
      ageCardCurrentBg: 'rgba(255, 255, 255, 0.1)',
      ageCardCurrentBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardDefaultBg: 'rgba(255, 255, 255, 0.1)',
      ageCardDefaultBorder: 'rgba(255, 255, 255, 0.2)',
      ageDiffBadgeBg: 'rgba(66, 165, 245, 0.2)',
      ageDiffBadgeColor: '#42A5F5',
      rankItemMainBg: 'rgba(66, 165, 245, 0.1)',
      rankItemMainBorder: 'rgba(66, 165, 245, 0.3)',
      rankItemGoodBg: 'rgba(16, 185, 129, 0.1)',
      rankItemGoodBorder: 'rgba(16, 185, 129, 0.3)',
      rankItemBadBg: 'rgba(239, 68, 68, 0.1)',
      rankItemBadBorder: 'rgba(239, 68, 68, 0.3)',
      diseaseTagColor: '#42A5F5',
      diseaseCountBg: 'rgba(255, 255, 255, 0.2)',
      diseaseCountColor: 'rgba(255, 255, 255, 0.9)',
      chartBackground: 'rgba(255, 255, 255, 0.1)',
      diseaseTypeBg: 'rgba(66, 165, 245, 0.1)',
      diseaseTypeColor: '#42A5F5',
      influenceItemBg: 'rgba(255, 255, 255, 0.05)',
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
    reportColors: {
      panelBackground: '#4a4a4a',
      accentColor: '#D32F2F',      // Cherry Red
      accentBgLight: 'rgba(211, 47, 47, 0.2)',
      accentBorder: 'rgba(211, 47, 47, 0.3)',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.9)',
      textTertiary: 'rgba(255, 255, 255, 0.7)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      dangerColor: '#ef4444',
      rankValueColor: '#D32F2F',
      ageCardBg: 'rgba(255, 255, 255, 0.1)',
      ageCardBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardBetterBg: 'rgba(16, 185, 129, 0.2)',
      ageCardBetterBorder: 'rgba(16, 185, 129, 0.5)',
      ageCardWorseBg: 'rgba(239, 68, 68, 0.2)',
      ageCardWorseBorder: 'rgba(239, 68, 68, 0.5)',
      sectionBg: 'rgba(255, 255, 255, 0.08)',
      sectionBorder: 'rgba(211, 47, 47, 0.3)',
      cardBg: 'rgba(255, 255, 255, 0.05)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      spinnerColor: '#D32F2F',
      // 브라운 스킨 전용 변수 기본값 (기본 스킨용)
      ageCardCurrentBg: 'rgba(255, 255, 255, 0.1)',
      ageCardCurrentBorder: 'rgba(255, 255, 255, 0.2)',
      ageCardDefaultBg: 'rgba(255, 255, 255, 0.1)',
      ageCardDefaultBorder: 'rgba(255, 255, 255, 0.2)',
      ageDiffBadgeBg: 'rgba(211, 47, 47, 0.2)',
      ageDiffBadgeColor: '#D32F2F',
      rankItemMainBg: 'rgba(211, 47, 47, 0.1)',
      rankItemMainBorder: 'rgba(211, 47, 47, 0.3)',
      rankItemGoodBg: 'rgba(16, 185, 129, 0.1)',
      rankItemGoodBorder: 'rgba(16, 185, 129, 0.3)',
      rankItemBadBg: 'rgba(239, 68, 68, 0.1)',
      rankItemBadBorder: 'rgba(239, 68, 68, 0.3)',
      diseaseTagColor: '#D32F2F',
      diseaseCountBg: 'rgba(255, 255, 255, 0.2)',
      diseaseCountColor: 'rgba(255, 255, 255, 0.9)',
      chartBackground: 'rgba(255, 255, 255, 0.1)',
      diseaseTypeBg: 'rgba(211, 47, 47, 0.1)',
      diseaseTypeColor: '#D32F2F',
      influenceItemBg: 'rgba(255, 255, 255, 0.05)',
    },
  },
  Br: {
    type: 'Br',
    name: 'Brown',
    description: '브라운 테마 - 따뜻하고 안정적인 느낌',
    theme: 'Brown - 따뜻하고 안정적인 브라운 톤',
    colors: {
      primary: '#8B4513',      // Saddle Brown
      primaryDark: '#654321',  // 더 진한 브라운
      accent: '#CD853F',       // Peru - 서브 요소
      background: '#FFF8DC',   // Cornsilk
      surface: '#FFFFFF',      // 카드/표면
      textPrimary: '#2E2E2E',  // 주요 텍스트
      textSecondary: '#424242', // 보조 텍스트
      textTertiary: '#757575', // 부가 텍스트
      buttonPrimary: '#A0522D', // Sienna
      buttonSecondary: '#F5DEB3', // Wheat
      sectionHeader: '#654321', // 섹션 헤더
      // 기존 호환성 유지
      primaryHover: '#654321',
      primaryBgLight: 'rgba(139, 69, 19, 0.1)',
      primaryShadow: 'rgba(139, 69, 19, 0.3)',
      primaryShadowHover: 'rgba(139, 69, 19, 0.4)',
    },
    reportColors: {
      panelBackground: '#FFF3E0',           // 섹션 패널 배경
      accentColor: '#FF7A00',               // 강조 색상
      accentBgLight: 'rgba(255, 122, 0, 0.12)',
      accentBorder: 'rgba(255, 122, 0, 0.25)',
      textPrimary: '#5A4634',               // 주요 텍스트
      textSecondary: 'rgba(90, 70, 52, 0.8)',
      textTertiary: 'rgba(90, 70, 52, 0.6)',
      borderColor: 'rgba(90, 70, 52, 0.15)',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      dangerColor: '#ef4444',
      rankValueColor: '#FF7A00',
      ageCardCurrentBg: '#FFFFFF',  // 브라운 테마에서 순수 흰색으로 대비 강화
      ageCardCurrentBorder: '#D4D4D4',  // 더 진한 보더로 대비 강화
      ageCardBetterBg: 'rgba(16, 185, 129, 0.15)',
      ageCardBetterBorder: 'rgba(16, 185, 129, 0.35)',
      ageCardWorseBg: 'rgba(255, 122, 0, 0.15)',
      ageCardWorseBorder: 'rgba(255, 122, 0, 0.35)',
      ageCardDefaultBg: 'rgba(255, 122, 0, 0.12)',
      ageCardDefaultBorder: 'rgba(255, 122, 0, 0.28)',
      sectionBg: '#FFF3E0',
      sectionBorder: 'rgba(255, 122, 0, 0.25)',
      cardBg: '#FFF7ED',
      cardBorder: 'rgba(90, 70, 52, 0.15)',
      spinnerColor: '#FF7A00',
      // 추가 리포트 색상
      ageDiffBadgeBg: 'rgba(255, 122, 0, 0.2)',
      ageDiffBadgeColor: '#FF7A00',
      rankItemMainBg: 'rgba(255, 122, 0, 0.10)',
      rankItemMainBorder: 'rgba(255, 122, 0, 0.25)',
      rankItemGoodBg: 'rgba(16, 185, 129, 0.10)',
      rankItemGoodBorder: 'rgba(16, 185, 129, 0.25)',
      rankItemBadBg: 'rgba(239, 68, 68, 0.10)',
      rankItemBadBorder: 'rgba(239, 68, 68, 0.25)',
      diseaseTagColor: '#FF7A00',
      diseaseCountBg: 'rgba(255, 255, 255, 0.5)',
      diseaseCountColor: 'rgba(90, 70, 52, 0.9)',
      chartBackground: 'rgba(90, 70, 52, 0.25)',  // 브라운 테마에 맞는 차트 배경 (더 진하게 보이도록)
      diseaseTypeBg: 'rgba(255, 122, 0, 0.12)',
      diseaseTypeColor: '#FF7A00',
      influenceItemBg: 'rgba(255, 255, 255, 0.4)',
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

// 초기 스킨 타입을 URL에서 동기적으로 읽기
const getInitialSkin = (): SkinType => {
  const urlSkin = getUrlParameter('skin') as SkinType;
  const validSkins: SkinType[] = ['G', 'M', 'B', 'R', 'Br'];
  return validSkins.includes(urlSkin) ? urlSkin : 'G';
};

export const useCampaignSkin = () => {
  // 초기값을 URL에서 직접 읽어서 깜빡임 방지 (lazy initialization 사용)
  const [skinType, setSkinType] = useState<SkinType>(() => getInitialSkin());
  const [skinConfig, setSkinConfig] = useState<SkinConfig>(() => {
    const initialSkin = getInitialSkin();
    return SKIN_CONFIGS[initialSkin];
  });

  // URL 파라미터 변경 감지 (초기 로드 후, URL 변경 시에만)
  useEffect(() => {
    const handleUrlChange = () => {
      const urlSkin = getUrlParameter('skin') as SkinType;
      const validSkins: SkinType[] = ['G', 'M', 'B', 'R', 'Br'];
      const currentSkin: SkinType = validSkins.includes(urlSkin) ? urlSkin : 'G';
      
      // 스킨이 변경된 경우에만 업데이트
      if (currentSkin !== skinType) {
        setSkinType(currentSkin);
        setSkinConfig(SKIN_CONFIGS[currentSkin]);
        console.log(`Campaign 스킨 변경: ${currentSkin} (${SKIN_CONFIGS[currentSkin].description})`);
      }
    };
    
    // 초기 로드 시 한 번만 체크 (이미 초기값으로 설정되었으므로 스킵)
    // URL 변경 이벤트 리스너는 필요시 추가 가능
  }, []); // 빈 배열로 초기 로드 후 실행 안 함 (이미 초기값 설정됨)

  // CSS 변수 적용 - 새로운 테마 시스템 (스킨 변경 시에만 실행)
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
    
    // 리포트 페이지 전용 CSS 변수들
    const reportColors = skinConfig.reportColors;
    root.style.setProperty('--report-panel-bg', reportColors.panelBackground);
    root.style.setProperty('--report-accent-color', reportColors.accentColor);
    root.style.setProperty('--report-accent-bg-light', reportColors.accentBgLight);
    root.style.setProperty('--report-accent-border', reportColors.accentBorder);
    root.style.setProperty('--report-text-primary', reportColors.textPrimary);
    root.style.setProperty('--report-text-secondary', reportColors.textSecondary);
    root.style.setProperty('--report-text-tertiary', reportColors.textTertiary);
    root.style.setProperty('--report-border-color', reportColors.borderColor);
    root.style.setProperty('--report-success-color', reportColors.successColor);
    root.style.setProperty('--report-warning-color', reportColors.warningColor);
    root.style.setProperty('--report-danger-color', reportColors.dangerColor);
    root.style.setProperty('--report-rank-value-color', reportColors.rankValueColor);
    // 모든 리포트 색상 변수를 명시적으로 설정 (조건부 제거)
    root.style.setProperty('--report-age-card-bg', reportColors.ageCardBg || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-age-card-border', reportColors.ageCardBorder || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--report-age-card-better-bg', reportColors.ageCardBetterBg);
    root.style.setProperty('--report-age-card-better-border', reportColors.ageCardBetterBorder);
    root.style.setProperty('--report-age-card-worse-bg', reportColors.ageCardWorseBg);
    root.style.setProperty('--report-age-card-worse-border', reportColors.ageCardWorseBorder);
    root.style.setProperty('--report-section-bg', reportColors.sectionBg);
    root.style.setProperty('--report-section-border', reportColors.sectionBorder);
    root.style.setProperty('--report-card-bg', reportColors.cardBg);
    root.style.setProperty('--report-card-border', reportColors.cardBorder);
    root.style.setProperty('--report-spinner-color', reportColors.spinnerColor);
    
    // 추가 리포트 색상 변수들 (모두 명시적으로 설정)
    root.style.setProperty('--report-age-card-current-bg', reportColors.ageCardCurrentBg || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-age-card-current-border', reportColors.ageCardCurrentBorder || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--report-age-card-default-bg', reportColors.ageCardDefaultBg || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-age-card-default-border', reportColors.ageCardDefaultBorder || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--report-age-diff-badge-bg', reportColors.ageDiffBadgeBg || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--report-age-diff-badge-color', reportColors.ageDiffBadgeColor || reportColors.accentColor);
    root.style.setProperty('--report-rank-item-main-bg', reportColors.rankItemMainBg || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-rank-item-main-border', reportColors.rankItemMainBorder || 'rgba(255, 255, 255, 0.3)');
    root.style.setProperty('--report-rank-item-good-bg', reportColors.rankItemGoodBg || 'rgba(16, 185, 129, 0.1)');
    root.style.setProperty('--report-rank-item-good-border', reportColors.rankItemGoodBorder || 'rgba(16, 185, 129, 0.3)');
    root.style.setProperty('--report-rank-item-bad-bg', reportColors.rankItemBadBg || 'rgba(239, 68, 68, 0.1)');
    root.style.setProperty('--report-rank-item-bad-border', reportColors.rankItemBadBorder || 'rgba(239, 68, 68, 0.3)');
    root.style.setProperty('--report-disease-tag-color', reportColors.diseaseTagColor || reportColors.accentColor);
    root.style.setProperty('--report-disease-count-bg', reportColors.diseaseCountBg || 'rgba(255, 255, 255, 0.2)');
    root.style.setProperty('--report-disease-count-color', reportColors.diseaseCountColor || reportColors.textPrimary);
    root.style.setProperty('--report-chart-background', reportColors.chartBackground || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-disease-type-bg', reportColors.diseaseTypeBg || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--report-disease-type-color', reportColors.diseaseTypeColor || reportColors.accentColor);
    root.style.setProperty('--report-influence-item-bg', reportColors.influenceItemBg || 'rgba(255, 255, 255, 0.05)');
    
    // 리포트 페이지 배경색 (모든 스킨에 명시적으로 설정)
    if (skinType === 'Br') {
      root.style.setProperty('--report-page-bg', '#FFF9EF');
    } else {
      // 기본 스킨은 배경색 변수 제거 (기본값 사용)
      root.style.removeProperty('--report-page-bg');
    }
    
    // theme-color 메타 태그 업데이트
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', colors.primary);
    }
    
    // 초기 로드 시에만 콘솔 로그 출력 (깜빡임 방지)
    if (skinType === getInitialSkin()) {
      console.log(`✅ ${skinConfig.name} 테마 CSS 변수 적용 완료`);
    }
  }, [skinConfig, skinType]);

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