/**
 * Welno RAG Chat Widget - Vanilla JavaScript 임베드 위젯
 * 
 * 파트너 웹사이트에 임베드 가능한 독립적인 RAG 채팅 위젯
 * React 의존성 없이 순수 JavaScript로 구현
 * 
 * 사용법:
 * const widget = new WelnoRagChatWidget({
 *   apiKey: 'your-partner-api-key',
 *   baseUrl: 'https://api.welno.com',
 *   partnerData: { ... }
 * });
 * widget.init();
 */

// 파트너별 기본 채팅 아이콘 (API Key로 자동 매핑)
var PARTNER_DEFAULT_ICON = {
  '5a9bb40b5108ecd8ef864658d5a2d5ab': '/welno-api/static/mdx_icon.png'
};

// 테마별 색상 토큰 (위젯 설정 theme: 'default' | 'navy')
var THEME_TOKENS = {
  default: {
    headerBg: '#7B5E4F',
    accent: '#7B5E4F',
    accentHover: '#6B4E3F',
    welcomeText: '#7B5E4F',
    userBubble: '#7B5E4F',
    buttonColor: '#A69B8F',
    borderSubtle: 'rgba(123, 94, 79, 0.1)'
  },
  navy: {
    headerBg: '#1e3a5f',
    accent: '#2c5282',
    accentHover: '#234a75',
    welcomeText: '#1e3a5f',
    userBubble: '#2c5282',
    buttonColor: '#2c5282',
    borderSubtle: 'rgba(30, 58, 95, 0.12)'
  }
};

class WelnoRagChatWidget {
  constructor(config) {
    // 필수 설정 검증
    if (!config.apiKey) {
      throw new Error('WelnoRagChatWidget: apiKey is required');
    }

    var baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    var chatIconUrl = config.chatIconUrl || null;
    if (!chatIconUrl && config.apiKey && PARTNER_DEFAULT_ICON[config.apiKey]) {
      chatIconUrl = (baseUrl.replace(/\/$/, '')) + PARTNER_DEFAULT_ICON[config.apiKey];
    }

    // 기본 설정
    this.config = {
      apiKey: config.apiKey,
      baseUrl: baseUrl,
      uuid: config.uuid || 'widget_user_' + Date.now(),
      hospitalId: config.hospitalId || 'widget_partner',
      partnerData: config.partnerData || null,
      
      // UI 설정
      position: config.position || 'bottom-right', // bottom-right, bottom-left, top-right, top-left
      theme: config.theme || 'default',
      buttonColor: config.buttonColor || '#A69B8F',
      chatIconUrl: chatIconUrl, // 파트너 지정 또는 API Key 자동 매핑(메디링스 등)
      
      // 동작 설정
      autoOpen: config.autoOpen || false,
      welcomeMessage: config.welcomeMessage || '안녕하세요! 건강과 영양에 대해 궁금한 점을 물어보세요. 😊',
      
      // 콜백
      onOpen: config.onOpen || null,
      onClose: config.onClose || null,
      onMessage: config.onMessage || null,
      onError: config.onError || null
    };

    // 상태 관리
    this.state = {
      isOpen: false,
      isLoading: false,
      messages: [],
      sessionId: null,
      suggestions: [],
      isInitialized: false
    };

    // DOM 요소들
    this.elements = {
      container: null,
      button: null,
      window: null,
      messagesContainer: null,
      input: null,
      sendButton: null
    };

    // 네임스페이스 접두사 (CSS 충돌 방지)
    this.cssPrefix = 'welno-rag-widget';
    
    console.log('[WelnoRagChatWidget] 초기화 완료:', this.config);
  }

  /**
   * 위젯 초기화 및 DOM에 추가
   */
  async init() {
    if (this.state.isInitialized) {
      console.warn('[WelnoRagChatWidget] 이미 초기화됨');
      return;
    }

    try {
      // 0. 서버에서 동적 설정 로드 (파트너 테마 적용)
      await this.fetchRemoteConfig();

      // 1. CSS 스타일 주입
      this.injectStyles();
      
      // DOM 구조 생성
      this.createDOM();
      
      // 이벤트 리스너 등록
      this.bindEvents();
      
    // 세션 ID 생성 (웜업 전 임시용)
    this.state.sessionId = `temp_${this.config.uuid}_${Date.now()}`;
    
    // 웜업 API 호출 (백그라운드에서 분석 및 인사말 준비)
    this.warmup();
      
      // 환영 메시지 추가
      this.addMessage('assistant', this.config.welcomeMessage);
      
      // 자동 열기
      if (this.config.autoOpen) {
        setTimeout(() => this.open(), 500);
      }
      
      this.state.isInitialized = true;
      console.log('[WelnoRagChatWidget] 초기화 완료');
      
    } catch (error) {
      console.warn('[WelnoRagChatWidget] 위젯 활성화 조건 미충족 (등록되지 않은 파트너/병원):', error.message);
      // 에러 시 위젯 생성을 중단하고 아무것도 렌더링하지 않음
      this.destroy(); 
    }
  }

  /**
   * 서버에서 동적 설정 로드 (파트너/병원별 테마 및 메시지)
   */
  async fetchRemoteConfig() {
    try {
      // API Key 기반 파트너 ID 조회 (간소화를 위해 medilinx 전용 처리 또는 파라미터 활용)
      // 현재는 hospitalId가 이미 medilinx 정보를 포함하고 있으므로 이를 활용
      var partnerId = 'welno';
      if (this.config.apiKey === '5a9bb40b5108ecd8ef864658d5a2d5ab') {
        partnerId = 'medilinx';
      }

      var url = `${this.config.baseUrl}/welno-api/v1/admin/embedding/config/frontend?partner_id=${partnerId}`;
      if (this.config.hospitalId) {
        url += `&hospital_id=${this.config.hospitalId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('[WelnoRagChatWidget] 서버 설정 로드 성공:', data);

        // 1. 테마 색상 덮어쓰기 (DB 설정이 최우선)
        if (data.theme && data.theme.primary_color) {
          this.config.buttonColor = data.theme.primary_color;
          this.config.themeData = data.theme; // 상세 테마 데이터 저장
        }

        // 2. 아이콘 URL 덮어쓰기
        if (data.theme && data.theme.icon_url) {
          this.config.chatIconUrl = data.theme.icon_url;
        }

        // 3. 인사말 및 파트너명 덮어쓰기
        if (data.welcome_message) {
          this.config.welcomeMessage = data.welcome_message;
        }
        if (data.partner_name) {
          this.config.partnerName = data.partner_name;
        }
      } else {
        // 등록되지 않은 병원/파트너인 경우 (404 등)
        throw new Error(`등록되지 않은 병원 또는 파트너입니다. (HTTP ${response.status})`);
      }
    } catch (err) {
      console.error('[WelnoRagChatWidget] 서버 설정 로드 실패:', err);
      throw err; // 에러를 다시 던져서 init()에서 위젯 생성을 중단하게 함
    }
  }

  /**
   * CSS 스타일 주입 (네임스페이스 적용)
   */
  injectStyles() {
    const styleId = `${this.cssPrefix}-styles`;
    
    // 이미 주입된 경우 스킵
    if (document.getElementById(styleId)) {
      return;
    }

    var themeName = (this.config.theme === 'navy' ? 'navy' : 'default');
    var t = THEME_TOKENS[themeName];
    
    // DB에서 가져온 색상이 있으면 최우선 적용, 없으면 설정값, 그것도 없으면 테마 기본값
    var primaryColor = this.config.buttonColor || t.buttonColor;
    var headerColor = (this.config.themeData && this.config.themeData.primary_color) || t.headerBg;

    const styles = `
      /* Welno RAG Chat Widget Styles */
      .${this.cssPrefix}-container {
        position: fixed;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #333;
        box-sizing: border-box;
      }
      
      .${this.cssPrefix}-container *,
      .${this.cssPrefix}-container *::before,
      .${this.cssPrefix}-container *::after {
        box-sizing: border-box;
      }

      /* 위치별 스타일 */
      .${this.cssPrefix}-container.position-bottom-right {
        bottom: 24px;
        right: 24px;
      }
      
      .${this.cssPrefix}-container.position-bottom-left {
        bottom: 24px;
        left: 24px;
      }
      
      .${this.cssPrefix}-container.position-top-right {
        top: 24px;
        right: 24px;
      }
      
      .${this.cssPrefix}-container.position-top-left {
        top: 24px;
        left: 24px;
      }

      /* 채팅 버튼 */
      .${this.cssPrefix}-button {
        width: 56px;
        height: 56px;
        min-width: 56px;
        min-height: 56px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: ${primaryColor};
        color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        outline: none;
        overflow: hidden;
        position: relative;
      }

      .${this.cssPrefix}-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        filter: brightness(0.9);
      }

      .${this.cssPrefix}-button.active {
        filter: brightness(0.9);
      }

      /* 파트너 아이콘: 이미지일 때는 원형 버튼 전체를 꽉 채움, SVG는 24x24 유지 */
      .${this.cssPrefix}-button .${this.cssPrefix}-icon-slot {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
      }
      .${this.cssPrefix}-button .${this.cssPrefix}-icon-slot svg {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        display: block;
      }
      .${this.cssPrefix}-button .${this.cssPrefix}-icon-slot img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
      }

      /* 채팅 창 */
      .${this.cssPrefix}-window {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 400px; /* 360px -> 400px */
        height: 650px; /* 550px -> 650px */
        background: #FFFAF2;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid ${t.borderSubtle};
        animation: slideInUp 0.3s ease-out;
      }

      .${this.cssPrefix}-window.open {
        display: flex;
      }

      .${this.cssPrefix}-container.position-bottom-left .${this.cssPrefix}-window {
        right: auto;
        left: 0;
      }

      .${this.cssPrefix}-container.position-top-right .${this.cssPrefix}-window {
        bottom: auto;
        top: 70px;
      }

      .${this.cssPrefix}-container.position-top-left .${this.cssPrefix}-window {
        bottom: auto;
        top: 70px;
        right: auto;
        left: 0;
      }

      @keyframes slideInUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* 헤더 */
      .${this.cssPrefix}-header {
        background: ${headerColor};
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .${this.cssPrefix}-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.5px;
      }

      .${this.cssPrefix}-close-button {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .${this.cssPrefix}-close-button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      /* 웰컴 버블 - 뷰포트 기준 고정 위치로 가로 너비 활용 (!important 추가로 강제 적용) */
      .${this.cssPrefix}-welcome-bubble {
        position: fixed !important;
        background: white !important;
        padding: 12px 18px !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
        border: 1px solid ${primaryColor} !important;
        width: max-content !important;
        min-width: 240px !important;
        max-width: min(80vw, 320px) !important;
        white-space: normal !important;
        word-break: normal !important;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
        cursor: pointer;
        z-index: 9998 !important;
      }
      .${this.cssPrefix}-container.position-bottom-right .${this.cssPrefix}-welcome-bubble {
        right: 24px !important;
        bottom: 96px !important;
        left: auto !important;
        top: auto !important;
      }
      .${this.cssPrefix}-container.position-bottom-left .${this.cssPrefix}-welcome-bubble {
        left: 24px !important;
        bottom: 96px !important;
        right: auto !important;
        top: auto !important;
      }
      .${this.cssPrefix}-container.position-top-right .${this.cssPrefix}-welcome-bubble {
        right: 24px !important;
        top: 96px !important;
        bottom: auto !important;
        left: auto !important;
      }
      .${this.cssPrefix}-container.position-top-left .${this.cssPrefix}-welcome-bubble {
        left: 24px !important;
        top: 96px !important;
        right: auto !important;
        bottom: auto !important;
      }

      .${this.cssPrefix}-welcome-bubble.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .${this.cssPrefix}-welcome-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid ${primaryColor};
      }

      .${this.cssPrefix}-welcome-bubble::before {
        content: '';
        position: absolute;
        bottom: -6px;
        right: 21px;
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 7px solid white;
        z-index: 1;
      }

      .${this.cssPrefix}-welcome-bubble-text {
        font-weight: 500;
        color: ${primaryColor};
        font-size: 13px;
        line-height: 1.4;
      }
      @media (max-width: 480px) {
        .${this.cssPrefix}-welcome-bubble {
          min-width: 200px;
          max-width: min(80vw, 320px);
        }
      }

      @keyframes bubbleBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      .${this.cssPrefix}-welcome-bubble.visible {
        animation: bubbleBounce 3s infinite ease-in-out;
      }

      /* 메시지 영역 */
      .${this.cssPrefix}-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #FFFAF2;
      }

      .${this.cssPrefix}-message {
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
      }

      .${this.cssPrefix}-message.user {
        align-items: flex-end;
      }

      .${this.cssPrefix}-message.assistant {
        align-items: flex-start;
      }

      .${this.cssPrefix}-message-bubble {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 18px;
        word-wrap: break-word;
        line-height: 1.6;
        font-size: 13.5px;
      }

      .${this.cssPrefix}-message.user .${this.cssPrefix}-message-bubble {
        background: ${primaryColor};
        color: white;
        border-bottom-right-radius: 2px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .${this.cssPrefix}-message.assistant .${this.cssPrefix}-message-bubble {
        background: #F8EDDA;
        color: #4A3A34;
        border-bottom-left-radius: 2px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .${this.cssPrefix}-message-footer {
        margin-top: 4px;
        padding: 0 4px;
      }

      .${this.cssPrefix}-message-footer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .${this.cssPrefix}-message-time {
        font-size: 10px;
        color: #999;
      }

      /* 로딩 인디케이터 (말풍선 없이 점 세 개만) */
      .${this.cssPrefix}-loading-wrap {
        display: flex;
        align-items: center;
        align-self: flex-start;
        padding: 8px 0;
      }

      .${this.cssPrefix}-loading-dots {
        display: flex;
        gap: 4px;
      }

      .${this.cssPrefix}-loading-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #999;
        animation: loadingDot 1.4s infinite ease-in-out both;
      }

      .${this.cssPrefix}-loading-dot:nth-child(1) { animation-delay: -0.32s; }
      .${this.cssPrefix}-loading-dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes loadingDot {
        0%, 80%, 100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1);
        }
      }

      /* 입력 영역 */
      .${this.cssPrefix}-input-area {
        padding: 16px 20px;
        background: white;
        border-top: 1px solid #E5E5E5;
        display: flex;
        gap: 12px;
        align-items: flex-end;
      }

      .${this.cssPrefix}-input {
        flex: 1;
        border: 1px solid #E5E5E5;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        resize: none;
        min-height: 20px;
        max-height: 100px;
        font-family: inherit;
      }

      .${this.cssPrefix}-input:focus {
        border-color: ${primaryColor};
      }

      .${this.cssPrefix}-send-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${primaryColor};
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
        flex-shrink: 0;
      }

      .${this.cssPrefix}-send-button:hover {
        filter: brightness(0.9);
      }

      .${this.cssPrefix}-send-button:disabled {
        background: #CCC;
        cursor: not-allowed;
      }

      .${this.cssPrefix}-send-button svg {
        width: 16px;
        height: 16px;
      }

      /* 반응형: 모바일에서 전체 화면 꽉 채우기 */
      @media (max-width: 480px) {
        .${this.cssPrefix}-window {
          width: 100% !important;
          height: 100% !important;
          bottom: 0 !important;
          right: 0 !important;
          border-radius: 0 !important;
          max-width: none !important;
          max-height: none !important;
        }
        
        .${this.cssPrefix}-container {
          bottom: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: 100% !important;
          pointer-events: none; /* 컨테이너 자체는 클릭 통과 */
        }

        .${this.cssPrefix}-container > * {
          pointer-events: auto; /* 자식 요소는 클릭 가능 */
        }

        .${this.cssPrefix}-button {
          bottom: 24px !important;
          right: 24px !important;
          position: fixed !important;
          z-index: 10001;
        }

        /* 채팅창이 열렸을 때 하단 플로팅 버튼 숨기기 (컨테이너 클래스 기준) */
        .${this.cssPrefix}-container.is-open .${this.cssPrefix}-button {
          display: none !important;
        }
      }

      /* 헤더 고정 및 메시지 영역 독립 스크롤 강화 */
      .${this.cssPrefix}-window {
        display: none;
        flex-direction: column;
        height: 650px;
        position: relative; /* 자식 요소 포지셔닝 기준 */
      }
      .${this.cssPrefix}-window.open {
        display: flex !important;
      }
      .${this.cssPrefix}-header {
        flex-shrink: 0;
        z-index: 2;
      }
      .${this.cssPrefix}-messages {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 20px;
      }
      .${this.cssPrefix}-input-area {
        flex-shrink: 0;
        z-index: 2;
        background: white;
      }

      /* 소스 아코디언: 시간 옆 토글 + 아래에 리스트 확장 */
      .${this.cssPrefix}-sources-toggle {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 0;
        border: none;
        background: none;
        font-size: 10px;
        font-weight: 600;
        color: ${primaryColor};
        user-select: none;
        white-space: nowrap;
      }
      .${this.cssPrefix}-sources-toggle:hover { opacity: 0.7; }
      .${this.cssPrefix}-sources-chevron {
        font-size: 7px;
        display: inline-block;
        transition: transform 0.2s;
      }
      .${this.cssPrefix}-sources-toggle.is-open .${this.cssPrefix}-sources-chevron {
        transform: rotate(180deg);
      }
      .${this.cssPrefix}-sources-list {
        margin: 6px 0 0;
        padding: 0;
        display: none;
        flex-direction: column;
        gap: 4px;
      }
      .${this.cssPrefix}-sources-list.is-open {
        display: flex;
      }
      .${this.cssPrefix}-source {
        display: block;
        font-size: 11px;
        color: #555;
        padding: 6px 8px;
        background: rgba(0,0,0,0.04);
        border-radius: 6px;
        border-left: 2px solid ${primaryColor};
        white-space: normal;
        word-break: break-word;
        line-height: 1.4;
      }

      /* 제안 질문 */
      .${this.cssPrefix}-suggestions {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .${this.cssPrefix}-suggestion {
        background: #F8F8F8;
        border: 1px solid #E5E5E5;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .${this.cssPrefix}-suggestion:hover {
        background: ${primaryColor};
        color: white;
        border-color: ${primaryColor};
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * DOM 구조 생성
   */
  createDOM() {
    // 메인 컨테이너
    this.elements.container = document.createElement('div');
    this.elements.container.className = `${this.cssPrefix}-container position-${this.config.position}`;

    // 채팅 버튼
    this.elements.button = document.createElement('button');
    this.elements.button.className = `${this.cssPrefix}-button`;
    this.elements.button.innerHTML = this.getChatIcon();
    this.elements.button.setAttribute('aria-label', '채팅 열기');

    // 웰컴 버블 (말풍선)
    this.elements.welcomeBubble = document.createElement('div');
    this.elements.welcomeBubble.className = `${this.cssPrefix}-welcome-bubble`;
    this.elements.welcomeBubble.innerHTML = `<div class="${this.cssPrefix}-welcome-bubble-text">분석 중...</div>`;
    
    // 채팅 창
    this.elements.window = document.createElement('div');
    this.elements.window.className = `${this.cssPrefix}-window`;

    // 헤더
    const header = document.createElement('div');
    header.className = `${this.cssPrefix}-header`;
    header.innerHTML = `
      <h3>MediArc</h3>
      <button class="${this.cssPrefix}-close-button" aria-label="채팅 닫기">×</button>
    `;

    // 메시지 영역
    this.elements.messagesContainer = document.createElement('div');
    this.elements.messagesContainer.className = `${this.cssPrefix}-messages`;

    // 입력 영역
    const inputArea = document.createElement('div');
    inputArea.className = `${this.cssPrefix}-input-area`;

    this.elements.input = document.createElement('textarea');
    this.elements.input.className = `${this.cssPrefix}-input`;
    this.elements.input.placeholder = '메시지를 입력하세요...';
    this.elements.input.rows = 1;

    this.elements.sendButton = document.createElement('button');
    this.elements.sendButton.className = `${this.cssPrefix}-send-button`;
    this.elements.sendButton.innerHTML = this.getSendIcon();
    this.elements.sendButton.setAttribute('aria-label', '메시지 전송');

    // DOM 조립
    inputArea.appendChild(this.elements.input);
    inputArea.appendChild(this.elements.sendButton);

    this.elements.window.appendChild(header);
    this.elements.window.appendChild(this.elements.messagesContainer);
    this.elements.window.appendChild(inputArea);

    this.elements.container.appendChild(this.elements.welcomeBubble);
    this.elements.container.appendChild(this.elements.button);
    this.elements.container.appendChild(this.elements.window);

    // body에 추가
    document.body.appendChild(this.elements.container);
  }

  /**
   * 이벤트 리스너 등록
   */
  bindEvents() {
    // 채팅 버튼 클릭
    this.elements.button.addEventListener('click', () => {
      if (this.state.isOpen) {
        this.close();
      } else {
        this.open();
      }
    });

    // 웰컴 버블 클릭
    this.elements.welcomeBubble.addEventListener('click', () => {
      this.open();
      this.elements.welcomeBubble.classList.remove('visible');
    });

    // 닫기 버튼 클릭
    const closeButton = this.elements.window.querySelector(`.${this.cssPrefix}-close-button`);
    closeButton.addEventListener('click', () => this.close());

    // 메시지 전송
    this.elements.sendButton.addEventListener('click', () => this.sendMessage());

    // Enter 키로 메시지 전송
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 입력창 자동 높이 조절
    this.elements.input.addEventListener('input', () => {
      this.elements.input.style.height = 'auto';
      this.elements.input.style.height = Math.min(this.elements.input.scrollHeight, 100) + 'px';
    });

    // 외부 클릭으로 닫기 (선택사항)
    document.addEventListener('click', (e) => {
      if (this.state.isOpen && !this.elements.container.contains(e.target)) {
        // 외부 클릭 시 닫기 기능은 사용자 설정에 따라 활성화 가능
        // this.close();
      }
    });
  }

  /**
   * 채팅창 열기
   */
  open() {
    if (this.state.isOpen) return;

    this.state.isOpen = true;
    this.elements.window.classList.add('open');
    this.elements.container.classList.add('is-open'); // 컨테이너에 상태 추가
    this.elements.button.classList.add('active');
    this.elements.button.innerHTML = this.getCloseIcon();

    // 채팅창이 열리면 웰컴 버블 숨기기
    if (this.elements.welcomeBubble) {
      this.elements.welcomeBubble.classList.remove('visible');
    }

    // 입력창에 포커스
    setTimeout(() => {
      this.elements.input.focus();
    }, 300);

    // 콜백 호출
    if (this.config.onOpen) {
      this.config.onOpen();
    }

    console.log('[WelnoRagChatWidget] 채팅창 열림');
  }

  /**
   * 채팅창 닫기
   */
  close() {
    if (!this.state.isOpen) return;

    this.state.isOpen = false;
    this.elements.window.classList.remove('open');
    this.elements.container.classList.remove('is-open'); // 컨테이너 상태 제거
    this.elements.button.classList.remove('active');
    this.elements.button.innerHTML = this.getChatIcon();

    // 콜백 호출
    if (this.config.onClose) {
      this.config.onClose();
    }

    console.log('[WelnoRagChatWidget] 채팅창 닫힘');
  }

  /**
   * 메시지 전송
   */
  async sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message || this.state.isLoading) return;

    try {
      // 사용자 메시지 추가
      this.addMessage('user', message);
      
      // 입력창 초기화
      this.elements.input.value = '';
      this.elements.input.style.height = 'auto';
      
      // 로딩 상태 시작
      this.setLoading(true);
      
      // API 호출
      await this.callPartnerAPI(message);
      
    } catch (error) {
      console.error('[WelnoRagChatWidget] 메시지 전송 실패:', error);
      
      // 타임아웃 에러 처리
      if (error.name === 'AbortError') {
        this.handleError('응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', error);
      } else {
        this.handleError('메시지 전송에 실패했습니다.', error);
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 파트너 API 호출 (스트리밍)
   */
  async callPartnerAPI(message) {
    const requestData = {
      uuid: this.config.uuid,
      hospital_id: this.config.hospitalId,
      message: message,
      session_id: this.state.sessionId
    };

    // 파트너 데이터가 있으면 포함
    if (this.config.partnerData) {
      requestData.health_data = this.config.partnerData;
    }

    // AbortController로 타임아웃 설정 (30초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${this.config.baseUrl}/welno-api/v1/rag-chat/partner/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    // 스트리밍 응답 처리
    await this.handleStreamingResponse(response);
  }

  /**
   * 스트리밍 응답 처리 (SSE: 청크가 줄 중간에 잘릴 수 있으므로 버퍼로 완전한 줄만 파싱)
   */
  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    let assistantMessage = '';
    let messageElement = null;
    
    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));
        
        if (data.answer) {
          assistantMessage += data.answer;
          if (!messageElement) {
            messageElement = this.addMessage('assistant', '');
          }
          this.updateMessageContent(messageElement, assistantMessage);
        }
        
        if (data.done) {
          if (data.sources && data.sources.length > 0) {
            this.addSources(messageElement, data.sources);
          }
          if (data.suggestions && data.suggestions.length > 0) {
            this.addSuggestions(messageElement, data.suggestions);
          }
        }
      } catch (e) {
        // 불완전한 JSON(스트리밍 중 잘린 줄)은 무시
      }
    };
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          processLine(line.trim());
        }
      }
      
      if (buffer.trim()) {
        processLine(buffer.trim());
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 채팅 말풍선용 간단 마크다운 렌더 (** → 볼드, 줄바꿈 → <br>). HTML 이스케이프 후 적용.
   */
  _renderMessageHtml(text) {
    if (text == null || text === '') return '';
    const escaped = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/\n/g, '<br>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  /**
   * 메시지 추가
   */
  addMessage(role, content) {
    const messageElement = document.createElement('div');
    messageElement.className = `${this.cssPrefix}-message ${role}`;
    
    const bubbleElement = document.createElement('div');
    bubbleElement.className = `${this.cssPrefix}-message-bubble`;
    bubbleElement.innerHTML = this._renderMessageHtml(content);
    
    const footerElement = document.createElement('div');
    footerElement.className = `${this.cssPrefix}-message-footer`;

    const footerRow = document.createElement('div');
    footerRow.className = `${this.cssPrefix}-message-footer-row`;

    const timeElement = document.createElement('div');
    timeElement.className = `${this.cssPrefix}-message-time`;
    timeElement.textContent = new Date().toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    footerRow.appendChild(timeElement);
    footerElement.appendChild(footerRow);
    
    messageElement.appendChild(bubbleElement);
    messageElement.appendChild(footerElement);
    
    this.elements.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
    
    // 상태 업데이트
    this.state.messages.push({ role, content, timestamp: new Date().toISOString() });
    
    // 콜백 호출
    if (this.config.onMessage) {
      this.config.onMessage({ role, content });
    }
    
    return messageElement;
  }

  /**
   * 메시지 내용 업데이트 (스트리밍용)
   */
  updateMessageContent(messageElement, content) {
    const bubbleElement = messageElement.querySelector(`.${this.cssPrefix}-message-bubble`);
    bubbleElement.innerHTML = this._renderMessageHtml(content);
    // 스트리밍 중 스크롤을 throttle (매 청크마다 스크롤하면 버벅임)
    if (!this._scrollRAF) {
      this._scrollRAF = requestAnimationFrame(() => {
        this._scrollRAF = null;
        const el = this.elements.messagesContainer;
        if (!el) return;
        // 사용자가 위로 스크롤했으면 자동 스크롤 안 함
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (isNearBottom) {
          el.scrollTop = el.scrollHeight;
        }
      });
    }
  }

  /**
   * 소스 추가 (아코디언: 참고 자료 클릭 시 목록 열기/접기)
   */
  addSources(messageElement, sources) {
    if (!sources || sources.length === 0) return;

    // 토글 버튼: footer-row 안에 시간 옆
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = `${this.cssPrefix}-sources-toggle`;
    toggleBtn.innerHTML = `<span>참고 문헌</span><span class="${this.cssPrefix}-sources-chevron" aria-hidden="true">▼</span>`;

    // 소스 리스트: footer 안 (footer-row 아래)
    const listWrap = document.createElement('div');
    listWrap.className = `${this.cssPrefix}-sources-list`;

    sources.forEach(source => {
      const sourceEl = document.createElement('div');
      sourceEl.className = `${this.cssPrefix}-source`;
      sourceEl.textContent = source.title || '참고자료';
      sourceEl.title = (source.text || '').substring(0, 200);
      listWrap.appendChild(sourceEl);
    });

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBtn.classList.toggle('is-open');
      listWrap.classList.toggle('is-open');
    });

    // footer-row에 토글 버튼 추가
    const footerRow = messageElement.querySelector(`.${this.cssPrefix}-message-footer-row`);
    const footer = messageElement.querySelector(`.${this.cssPrefix}-message-footer`);
    if (footerRow) {
      footerRow.appendChild(toggleBtn);
    }
    // footer에 리스트 추가 (footer-row 아래)
    if (footer) {
      footer.appendChild(listWrap);
    } else {
      messageElement.appendChild(listWrap);
    }
  }

  /**
   * 제안 질문 추가
   */
  addSuggestions(messageElement, suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    
    const suggestionsElement = document.createElement('div');
    suggestionsElement.className = `${this.cssPrefix}-suggestions`;
    
    suggestions.slice(0, 3).forEach(suggestion => { // 최대 3개만 표시
      const suggestionElement = document.createElement('button');
      suggestionElement.className = `${this.cssPrefix}-suggestion`;
      suggestionElement.textContent = suggestion;
      suggestionElement.addEventListener('click', () => {
        this.elements.input.value = suggestion;
        this.elements.input.focus();
      });
      suggestionsElement.appendChild(suggestionElement);
    });
    
    messageElement.appendChild(suggestionsElement);
  }

  /**
   * 로딩 상태 설정
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    this.elements.sendButton.disabled = isLoading;
    
    if (isLoading) {
      // 로딩 인디케이터: 말풍선 없이 점 세 개만 (웰너와 동일)
      const loadingElement = document.createElement('div');
      loadingElement.className = `${this.cssPrefix}-loading-wrap`;
      loadingElement.id = 'loading-indicator';
      loadingElement.innerHTML = `
        <div class="${this.cssPrefix}-loading-dots">
          <div class="${this.cssPrefix}-loading-dot"></div>
          <div class="${this.cssPrefix}-loading-dot"></div>
          <div class="${this.cssPrefix}-loading-dot"></div>
        </div>
      `;
      this.elements.messagesContainer.appendChild(loadingElement);
      this.scrollToBottom();
    } else {
      // 로딩 인디케이터 제거
      const loadingElement = document.getElementById('loading-indicator');
      if (loadingElement) {
        loadingElement.remove();
      }
    }
  }

  /**
   * 하단으로 스크롤
   */
  scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this.elements.messagesContainer;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  /**
   * 에러 처리
   */
  handleError(message, error) {
    console.error('[WelnoRagChatWidget] 에러:', error);
    
    // 에러 메시지 표시
    this.addMessage('assistant', `죄송합니다. ${message}`);
    
    // 콜백 호출
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * 아이콘 SVG / 파트너 지정 이미지
   * config.chatIconUrl 이 있으면 해당 URL 이미지를 채팅 버튼에 사용
   */
  getChatIcon() {
    const slotClass = `${this.cssPrefix}-icon-slot`;
    if (this.config.chatIconUrl) {
      return `<span class="${slotClass}"><img src="${this.config.chatIconUrl}" alt="채팅 열기" /></span>`;
    }
    return `
      <span class="${slotClass}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
  }

  getCloseIcon() {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  getSendIcon() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  /**
   * 세션 웜업 및 개인화 인사말 로드
   */
  async warmup() {
    if (!this.config.partnerData) return;

    try {
      const response = await fetch(`${this.config.baseUrl}/welno-api/v1/rag-chat/partner/warmup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          uuid: this.config.uuid,
          hospital_id: this.config.hospitalId,
          health_data: this.config.partnerData
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // 백엔드에서 생성한 보안 세션 ID로 동기화 (캐시 활용의 핵심)
        if (data.session_id) {
          this.state.sessionId = data.session_id;
          console.log('[WelnoRagChatWidget] 세션 동기화 완료:', this.state.sessionId);
        }

        if (data.greeting) {
          // 말풍선 문구 업데이트 (줄바꿈/공백 강화 정규화: <br> 제거, 연속 공백 collapse)
          const raw = (data.greeting || '').replace(/<br\s*\/?>/gi, ' ');
          const normalizedGreeting = raw.replace(/\s+/g, ' ').trim();
          this.elements.welcomeBubble.querySelector(`.${this.cssPrefix}-welcome-bubble-text`).textContent = normalizedGreeting;
          
          // 약간의 지연 후 부드럽게 노출
          setTimeout(() => {
            if (!this.state.isOpen) {
              this.elements.welcomeBubble.classList.add('visible');
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.warn('[WelnoRagChatWidget] 웜업 실패:', error);
    }
  }

  /**
   * 위젯 제거
   */
  destroy() {
    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }
    
    // 스타일 제거 (다른 위젯이 없을 때만)
    const styleElement = document.getElementById(`${this.cssPrefix}-styles`);
    if (styleElement && !document.querySelector(`.${this.cssPrefix}-container`)) {
      styleElement.remove();
    }
    
    this.state.isInitialized = false;
    console.log('[WelnoRagChatWidget] 위젯 제거됨');
  }
}

// 전역 객체에 등록 (UMD 패턴)
// 주의: 웹팩 UMD 번들은 팩토리 반환값을 전역에 할당하므로, default export가 없으면
// 그 반환값(undefined)이 전역을 덮어써서 동적 로드 시 window.WelnoRagChatWidget이 사라짐.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelnoRagChatWidget;
  module.exports.default = WelnoRagChatWidget;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return WelnoRagChatWidget; });
} else {
  window.WelnoRagChatWidget = WelnoRagChatWidget;
  if (typeof window !== 'undefined') {
    console.log('[WelnoRagChatWidget] 전역 할당 직후 typeof window.WelnoRagChatWidget:', typeof window.WelnoRagChatWidget);
  }
}

console.log('[WelnoRagChatWidget] 로드 완료');