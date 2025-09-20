/**
 * 카드 데이터 모델
 */
export interface ICardData {
  id: string;
  icon: string; // SVG 문자열 또는 컴포넌트
  title: string;
  description: string;
  category?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

/**
 * 카드 카테고리 열거형
 */
export enum CardCategory {
  NATIONAL = 'national',
  CANCER = 'cancer', 
  COMPREHENSIVE = 'comprehensive',
  AI_CUSTOMIZED = 'ai_customized'
}

/**
 * 카드 데이터 팩토리 클래스
 */
export class CardDataFactory {
  /**
   * 국가검진 카드 생성
   */
  static createNationalCheckupCard(): ICardData {
    return {
      id: 'national-checkup',
      icon: 'clipboard',
      title: '국가검진',
      description: '**홀수년도 출생자** 및 **전년도 미검진 짝수년도 출생자**가 대상입니다.\n기본적인 건강 상태를 점검하는 필수 검진입니다.',
      category: CardCategory.NATIONAL,
      priority: 1,
      metadata: {
        targetYear: 'odd',
        mandatory: true
      }
    };
  }

  /**
   * 암검진 카드 생성
   */
  static createCancerScreeningCard(): ICardData {
    return {
      id: 'cancer-screening',
      icon: 'shield',
      title: '국가 암검진',
      description: '국가 6대 암종은 **조기발견, 조기치료** 시 **완치 또는 완화가 가능**합니다.\n정기적인 암검진으로 건강을 지키세요.',
      category: CardCategory.CANCER,
      priority: 2,
      metadata: {
        cancerTypes: 6,
        earlyDetection: true
      }
    };
  }

  /**
   * 종합검진 카드 생성
   */
  static createComprehensiveCheckupCard(): ICardData {
    return {
      id: 'comprehensive-checkup',
      icon: 'document',
      title: '종합검진',
      description: '최첨단 의료기기를 이용한 **종합검진 프로그램**을 제공합니다.\n전문의의 정밀한 진단으로 건강을 관리하세요.',
      category: CardCategory.COMPREHENSIVE,
      priority: 3,
      metadata: {
        equipment: 'advanced',
        doctorSpecialized: true
      }
    };
  }

  /**
   * AI 맞춤 검진 카드 생성
   */
  static createAICustomizedCard(): ICardData {
    return {
      id: 'ai-customized',
      icon: 'star',
      title: 'AI 맞춤 검진',
      description: '**본인에게 필요한 검사**를 AI가 분석하여 **맞춤형 검진을 설계**해 드립니다.\n개인별 건강 상태에 최적화된 검진 프로그램입니다.',
      category: CardCategory.AI_CUSTOMIZED,
      priority: 4,
      metadata: {
        aiPowered: true,
        personalized: true
      }
    };
  }

  /**
   * 모든 카드 데이터 반환
   */
  static getAllCards(): ICardData[] {
    return [
      this.createNationalCheckupCard(),
      this.createCancerScreeningCard(),
      this.createComprehensiveCheckupCard(),
      this.createAICustomizedCard()
    ];
  }

  /**
   * 카테고리별 카드 필터링
   */
  static getCardsByCategory(category: CardCategory): ICardData[] {
    return this.getAllCards().filter(card => card.category === category);
  }

  /**
   * 우선순위별 정렬
   */
  static getCardsSortedByPriority(): ICardData[] {
    return this.getAllCards().sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }
}
