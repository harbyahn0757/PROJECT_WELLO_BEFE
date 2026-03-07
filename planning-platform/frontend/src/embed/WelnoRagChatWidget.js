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

    // partnerData가 JSON 문자열인 경우 자동 파싱
    var partnerData = config.partnerData || null;
    if (typeof partnerData === 'string') {
      try { partnerData = JSON.parse(partnerData); } catch(e) { partnerData = null; }
    }

    // 기본 설정
    this.config = {
      apiKey: config.apiKey,
      baseUrl: baseUrl,
      uuid: config.uuid || 'widget_user_' + Date.now(),
      hospitalId: config.hospitalId || 'widget_partner',
      partnerData: partnerData,
      
      // UI 설정
      position: config.position || 'bottom-right', // bottom-right, bottom-left, top-right, top-left
      theme: config.theme || 'default',
      buttonColor: config.buttonColor || '#A69B8F',
      chatIconUrl: chatIconUrl, // 파트너 지정 또는 API Key 자동 매핑(메디링스 등)
      
      // 동작 설정
      mode: config.mode || 'button',  // 'button' (기존) | 'teaser' (신규)
      teaserMessage: config.teaserMessage || '건강 궁금한 점 물어보세요!',
      teaserDelay: config.teaserDelay != null ? config.teaserDelay : 2000,
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
      isInitialized: false,
      assistantMsgCount: 0
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

      // 모드별 초기 동작
      if (this.config.mode === 'teaser') {
        // 티저 모드: 딜레이 후 티저 말풍선 표시
        this.showTeaser();
      } else if (this.config.autoOpen) {
        // 버튼 모드: 자동 열기
        setTimeout(() => this.open(), 500);
      }

      this.state.isInitialized = true;
      
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
        // 1. 테마 색상 덮어쓰기 (DB 설정이 최우선)
        if (data.theme && data.theme.primary_color) {
          this.config.buttonColor = data.theme.primary_color;
          this.config.themeData = data.theme; // 상세 테마 데이터 저장
        }

        // 2. 아이콘 URL 덮어쓰기
        if (data.theme && data.theme.icon_url) {
          this.config.chatIconUrl = data.theme.icon_url;
        }

        // 3. 위젯 모드/티저 설정 덮어쓰기
        if (data.theme && data.theme.widget_mode) {
          this.config.mode = data.theme.widget_mode;
        }
        if (data.theme && data.theme.teaser_message) {
          this.config.teaserMessage = data.theme.teaser_message;
        }
        if (data.theme && data.theme.teaser_delay != null) {
          this.config.teaserDelay = data.theme.teaser_delay;
        }

        // 4. 인사말 및 파트너명 덮어쓰기
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

    // Noto Sans KR 폰트 로드 (파트너 CSP 차단 시 시스템 폰트로 자동 폴백)
    if (!document.getElementById('welno-noto-sans-kr')) {
      try {
        const fontLink = document.createElement('link');
        fontLink.id = 'welno-noto-sans-kr';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap';
        fontLink.onerror = function() { /* CSP 차단 시 무시 — font-family 폴백 사용 */ };
        document.head.appendChild(fontLink);
      } catch (e) { /* CSP 차단 */ }
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
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 15px;
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

      /* 배지 dot — warmup has_data=true 일 때 표시 */
      .${this.cssPrefix}-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 10px;
        height: 10px;
        background: #ff4d4f;
        border-radius: 50%;
        border: 2px solid white;
        display: none;
        z-index: 1;
      }
      .${this.cssPrefix}-badge.visible {
        display: block;
        animation: badgePulse 2s infinite;
      }
      @keyframes badgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
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
        font-size: 16px;
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
        font-size: 14px;
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

      /* 메시지 영역 - 메시지가 적을 때 하단부터 쌓임 (채팅 UX) */
      .${this.cssPrefix}-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #FFFAF2;
        display: flex;
        flex-direction: column;
      }

      /* 메시지가 적을 때 빈 공간을 위쪽으로 밀어 메시지를 입력창 가까이 배치 */
      .${this.cssPrefix}-messages::before {
        content: '';
        flex: 1 1 auto;
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
        font-size: 13px;
      }

      .${this.cssPrefix}-message.user .${this.cssPrefix}-message-bubble {
        background: ${primaryColor};
        color: white;
        border-radius: 18px 18px 4px 18px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .${this.cssPrefix}-message.assistant .${this.cssPrefix}-message-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .${this.cssPrefix}-message-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(${this._hexToRgb(primaryColor)}, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .${this.cssPrefix}-message.assistant .${this.cssPrefix}-message-bubble {
        background: #FFFFFF;
        color: #2A1F17;
        border-radius: 18px 18px 18px 4px;
        border: 1px solid rgba(221,208,195,0.5);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .${this.cssPrefix}-message-bubble.structured {
        border-left: 3px solid ${primaryColor};
        max-width: 88%;
      }

      .${this.cssPrefix}-message-bubble ul,
      .${this.cssPrefix}-message-bubble ol {
        margin: 4px 0 !important;
        padding-left: 20px !important;
        list-style: disc !important;
      }
      .${this.cssPrefix}-message-bubble ol {
        list-style: decimal !important;
      }
      .${this.cssPrefix}-message-bubble li {
        margin: 2px 0 !important;
        display: list-item !important;
        line-height: 1.5 !important;
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
        font-size: 11px;
        color: #A09890;
      }

      /* 로딩 인디케이터 (Studio 스타일: 아바타 + ▌ 커서) */
      .${this.cssPrefix}-loading-wrap {
        display: flex;
        align-items: flex-start;
        align-self: flex-start;
        gap: 8px;
        padding: 8px 0;
      }

      .${this.cssPrefix}-loading-cursor {
        font-size: 16px;
        color: ${primaryColor};
        animation: cursorPulse 1s infinite;
      }

      @keyframes cursorPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
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
        border-radius: 16px;
        padding: 10px 16px;
        font-size: 13px;
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
        background: rgba(${this._hexToRgb(primaryColor)}, 0.15);
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
          height: 100dvh !important;
          height: 100vh !important;
          height: -webkit-fill-available !important;
          bottom: 0 !important;
          right: 0 !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 0 !important;
          max-width: none !important;
          max-height: none !important;
          position: fixed !important;
        }

        .${this.cssPrefix}-window .${this.cssPrefix}-header {
          padding-top: max(12px, env(safe-area-inset-top));
          flex-shrink: 0;
        }

        .${this.cssPrefix}-window .${this.cssPrefix}-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .${this.cssPrefix}-window .${this.cssPrefix}-input-area {
          flex-shrink: 0;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
          position: sticky;
          bottom: 0;
          z-index: 10;
          background: white;
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
        font-size: 11px;
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
        margin: 6px 0 0 !important;
        padding: 0 !important;
        flex-direction: column !important;
        gap: 4px !important;
      }
      .${this.cssPrefix}-sources-list[data-open="false"] {
        display: none !important;
      }
      .${this.cssPrefix}-sources-list[data-open="true"] {
        display: flex !important;
      }
      .${this.cssPrefix}-source {
        display: block !important;
        font-size: 12px !important;
        color: #555 !important;
        padding: 6px 8px !important;
        background: rgba(0,0,0,0.04) !important;
        border-radius: 6px !important;
        border-left: 2px solid ${primaryColor} !important;
        white-space: normal !important;
        word-break: break-word !important;
        line-height: 1.4 !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        overflow: visible !important;
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
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .${this.cssPrefix}-suggestion:hover {
        background: ${primaryColor};
        color: white;
        border-color: ${primaryColor};
      }

      .${this.cssPrefix}-disclaimer {
        text-align: center;
        padding: 6px 12px;
        margin: 4px 0 12px;
        font-size: 11px;
        color: #999;
        background: #f5f5f5;
        border-radius: 8px;
        line-height: 1.5;
      }

      /* ── 티저 모드 ── */
      .${this.cssPrefix}-teaser-bubble {
        position: fixed;
        bottom: 24px;
        right: 24px;
        max-width: 280px;
        padding: 16px 20px 16px 52px;
        background: ${primaryColor};
        color: white;
        border-radius: 18px 18px 4px 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        cursor: pointer;
        font-size: 15px;
        line-height: 1.5;
        opacity: 0;
        transform: translateY(100px) scale(0.8);
        transition: opacity 0.2s ease;
        z-index: 9999;
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .${this.cssPrefix}-teaser-bubble:hover {
        filter: brightness(1.08);
      }
      .${this.cssPrefix}-teaser-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        position: absolute;
        top: 14px;
        left: 14px;
        background: rgba(255,255,255,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .${this.cssPrefix}-teaser-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .${this.cssPrefix}-teaser-avatar svg {
        width: 16px;
        height: 16px;
      }
      .${this.cssPrefix}-teaser-close {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        background: rgba(0,0,0,0.4);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 12px;
        line-height: 20px;
        text-align: center;
        cursor: pointer;
        padding: 0;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .${this.cssPrefix}-teaser-bubble:hover .${this.cssPrefix}-teaser-close {
        opacity: 1;
      }

      @keyframes welnoTeaserBounceIn {
        0% { transform: translateY(100px) scale(0.8); opacity: 0; }
        50% { transform: translateY(-8px) scale(1.02); opacity: 1; }
        70% { transform: translateY(4px) scale(0.99); opacity: 1; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes welnoTeaserFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .${this.cssPrefix}-teaser-bubble.visible {
        animation: welnoTeaserBounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards,
                   welnoTeaserFloat 2s ease-in-out 0.8s infinite;
      }
      .${this.cssPrefix}-teaser-bubble.hiding {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: all 0.2s ease-in;
        animation: none;
      }

      /* 티저 모드 채팅창: 슬라이드업 */
      .${this.cssPrefix}-window.teaser-mode {
        position: fixed;
        bottom: 0;
        right: 0;
        left: auto;
        top: auto;
        width: 400px;
        height: 650px;
        border-radius: 20px 20px 0 0;
        transform: translateY(100%);
        opacity: 0;
        display: flex;
        animation: none;
      }
      .${this.cssPrefix}-window.teaser-mode.open {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease;
      }
      .${this.cssPrefix}-window.teaser-mode.closing {
        transform: translateY(100%);
        opacity: 0;
        transition: transform 0.3s ease-in, opacity 0.2s ease-in;
      }

      @media (max-width: 480px) {
        .${this.cssPrefix}-teaser-bubble {
          right: 16px;
          bottom: 16px;
          left: 16px;
          max-width: none;
        }
        .${this.cssPrefix}-window.teaser-mode {
          width: 100%;
          height: 100%;
          border-radius: 0;
        }
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

    // 배지 dot (warmup has_data=true 시 표시)
    this.elements.badge = document.createElement('span');
    this.elements.badge.className = `${this.cssPrefix}-badge`;
    this.elements.button.appendChild(this.elements.badge);

    // 웰컴 버블 (말풍선)
    this.elements.welcomeBubble = document.createElement('div');
    this.elements.welcomeBubble.className = `${this.cssPrefix}-welcome-bubble`;
    this.elements.welcomeBubble.innerHTML = `<div class="${this.cssPrefix}-welcome-bubble-text">검진 결과 확인하기 ✨</div>`;
    
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

    if (this.config.mode === 'teaser') {
      // 티저 모드: 버튼/웰컴버블 대신 티저 말풍선 사용
      this.createTeaserBubble();
      this.elements.window.classList.add('teaser-mode');
      this.elements.container.appendChild(this.elements.window);
    } else {
      // 버튼 모드: 기존 동작
      this.elements.container.appendChild(this.elements.welcomeBubble);
      this.elements.container.appendChild(this.elements.button);
      this.elements.container.appendChild(this.elements.window);
    }

    // body에 추가
    document.body.appendChild(this.elements.container);
  }

  /**
   * 이벤트 리스너 등록
   */
  bindEvents() {
    if (this.config.mode === 'teaser') {
      // 티저 모드 이벤트는 createTeaserBubble()에서 등록됨
    } else {
      // 버튼 모드: 채팅 버튼 클릭
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
    }

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

    // 모바일 키보드 대응: Visual Viewport API
    if (window.innerWidth <= 480 && window.visualViewport) {
      this._handleViewportResize = () => {
        if (!this.state.isOpen) return;
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;

        if (keyboardHeight > 50) {
          // 키보드가 올라옴 → 창 높이를 뷰포트에 맞춤
          this.elements.window.style.height = `${viewportHeight}px`;
          this.elements.window.style.top = `${window.visualViewport.offsetTop}px`;
          this.scrollToBottom();
        } else {
          // 키보드 내려감 → 원래 높이로 복원
          this.elements.window.style.height = '';
          this.elements.window.style.top = '';
        }
      };
      window.visualViewport.addEventListener('resize', this._handleViewportResize);
      window.visualViewport.addEventListener('scroll', this._handleViewportResize);
    }

    // 입력 포커스 시 마지막 메시지로 즉시 스크롤
    this.elements.input.addEventListener('focus', () => {
      setTimeout(() => this.scrollToBottom(), 300);
    });
  }

  /**
   * 채팅창 열기
   */
  open() {
    if (this.state.isOpen) return;

    this.state.isOpen = true;
    this.elements.container.classList.add('is-open');

    if (this.config.mode === 'teaser') {
      // 티저 모드: 티저 fadeOut → 채팅창 slideUp
      this.handleTeaserClick();
    } else {
      // 버튼 모드: 기존 동작
      this.elements.window.classList.add('open');
      this.elements.button.classList.add('active');
      this.elements.button.innerHTML = this.getCloseIcon();

      if (this.elements.welcomeBubble) {
        this.elements.welcomeBubble.classList.remove('visible');
      }
      if (this.elements.badge) {
        this.elements.badge.classList.remove('visible');
      }
    }

    // 모바일: 배경 스크롤 방지
    if (window.innerWidth <= 480) {
      this._prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    // 입력창에 포커스
    setTimeout(() => {
      this.elements.input.focus();
    }, 300);

    if (this.config.onOpen) {
      this.config.onOpen();
    }
  }

  /**
   * 채팅창 닫기
   */
  close() {
    if (!this.state.isOpen) return;

    this.state.isOpen = false;
    this.elements.container.classList.remove('is-open');

    if (this.config.mode === 'teaser') {
      // 티저 모드: 채팅창 slideDown → 티저 재등장
      this.closeChatToTeaser();
    } else {
      // 버튼 모드: 기존 동작
      this.elements.window.classList.remove('open');
      this.elements.button.classList.remove('active');
      this.elements.button.innerHTML = this.getChatIcon();
    }

    // 모바일: 배경 스크롤 복원 + 키보드 높이 초기화
    if (window.innerWidth <= 480) {
      document.body.style.overflow = this._prevBodyOverflow || '';
      this.elements.window.style.height = '';
      this.elements.window.style.top = '';
    }

    if (this.config.onClose) {
      this.config.onClose();
    }
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
   * 스트리밍 응답 처리 (SSE + rAF 타이핑 애니메이션)
   * Studio 패턴: 버퍼에 텍스트를 쌓고, rAF로 3글자씩 화면에 반영 + ▌ 커서
   */
  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let assistantMessage = '';  // SSE에서 받은 전체 텍스트
    let displayed = '';         // 화면에 보여준 텍스트
    let messageElement = null;
    let animFrame = null;
    let streamDone = false;
    var self = this;

    // rAF 타이핑 루프: 버퍼(assistantMessage)보다 displayed가 뒤처지면 3글자씩 따라감
    var startTyping = function() {
      var tick = function() {
        if (displayed.length < assistantMessage.length) {
          var charsToAdd = Math.min(3, assistantMessage.length - displayed.length);
          displayed = assistantMessage.slice(0, displayed.length + charsToAdd);
          if (messageElement) {
            // 스트리밍 중이면 ▌ 커서 추가
            var cursorHtml = streamDone ? '' : '<span style="color:' + (self.config.buttonColor || '#A69B8F') + ';animation:cursorPulse 1s infinite">\u258C</span>';
            var bubble = messageElement.querySelector('.' + self.cssPrefix + '-message-bubble');
            if (bubble) {
              bubble.innerHTML = self._renderMessageHtml(displayed) + cursorHtml;
              // structured 클래스 동적 적용
              if (self._isStructuredResponse(displayed)) {
                bubble.classList.add('structured');
              }
            }
            // 스크롤
            if (!self._scrollRAF) {
              self._scrollRAF = requestAnimationFrame(function() {
                self._scrollRAF = null;
                var el = self.elements.messagesContainer;
                if (!el) return;
                var isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                if (isNearBottom) el.scrollTop = el.scrollHeight;
              });
            }
          }
        } else if (streamDone) {
          // 타이핑 완료 — 커서 제거, 최종 렌더
          if (messageElement) {
            self.updateMessageContent(messageElement, assistantMessage);
          }
          return; // rAF 루프 중지
        }
        animFrame = requestAnimationFrame(tick);
      };
      animFrame = requestAnimationFrame(tick);
    };

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));

        if (data.answer) {
          assistantMessage += data.answer;
          if (!messageElement) {
            messageElement = this.addMessage('assistant', '');
            startTyping();
          }
        }

        if (data.done) {
          if (data.sources && data.sources.length > 0) {
            this.addSources(messageElement, data.sources);
          }
          if (data.suggestions && data.suggestions.length > 0) {
            this.addSuggestions(messageElement, data.suggestions);
          }
          this.state.assistantMsgCount++;
          if (this.state.assistantMsgCount === 1) {
            this.addDisclaimer();
          }
        }
      } catch (e) {
        console.error('[WelnoWidget] SSE 파싱 에러:', e.message, '| line:', line.substring(0, 200));
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
      streamDone = true;
      // rAF가 남은 텍스트를 다 보여준 후 자동 종료
    }
  }

  /**
   * 구조화된 응답인지 판별 (Studio isStructuredResponse 포팅)
   */
  _isStructuredResponse(text) {
    if (!text || text.length < 150) return false;
    var patterns = [/^\d+\.\s+\*\*/m, /^#{1,3}\s+/m, /^\*\*[^*]+\*\*:/m, /^-\s+\*\*/m];
    return patterns.some(function(p) { return p.test(text); });
  }

  /**
   * HEX → R,G,B 문자열 변환 (rgba() 용)
   */
  _hexToRgb(hex) {
    if (!hex) return '196,168,130';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
  }

  /**
   * 채팅 말풍선용 마크다운 렌더.
   * 지원: **bold**, 줄바꿈, 리스트(* / - / 숫자.)
   */
  _renderMessageHtml(text) {
    if (text == null || text === '') return '';
    var escaped = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // bold 먼저 처리 (리스트 항목 내부에서도 적용)
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    var lines = escaped.split('\n');
    var result = [];
    var inUl = false;
    var inOl = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var ulMatch = line.match(/^\s*[*\-]\s+(.+)$/);
      var olMatch = !ulMatch ? line.match(/^\s*(\d+)[.)]\s+(.+)$/) : null;

      if (ulMatch) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inUl) { result.push('<ul>'); inUl = true; }
        result.push('<li>' + ulMatch[1] + '</li>');
      } else if (olMatch) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (!inOl) { result.push('<ol>'); inOl = true; }
        result.push('<li>' + olMatch[2] + '</li>');
      } else {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        // 빈 줄은 여백, 내용 있는 줄은 <br>
        if (line.trim() === '') {
          result.push('<br>');
        } else {
          result.push(line + '<br>');
        }
      }
    }
    if (inUl) result.push('</ul>');
    if (inOl) result.push('</ol>');

    return result.join('');
  }

  /**
   * 메시지 추가
   */
  addMessage(role, content) {
    const messageElement = document.createElement('div');
    messageElement.className = `${this.cssPrefix}-message ${role}`;

    if (role === 'assistant') {
      // AI 메시지: 아바타 + 말풍선을 row로 묶기
      const row = document.createElement('div');
      row.className = `${this.cssPrefix}-message-row`;

      const avatar = document.createElement('div');
      avatar.className = `${this.cssPrefix}-message-avatar`;
      avatar.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L8.5 5.5L12.5 7L8.5 8.5L7 12.5L5.5 8.5L1.5 7L5.5 5.5L7 1.5Z" fill="currentColor" style="color:' + (this.config.buttonColor || THEME_TOKENS[this.config.theme === 'navy' ? 'navy' : 'default'].buttonColor) + '"/></svg>';

      const bubbleElement = document.createElement('div');
      bubbleElement.className = `${this.cssPrefix}-message-bubble`;
      if (this._isStructuredResponse(content)) {
        bubbleElement.classList.add('structured');
      }
      bubbleElement.innerHTML = this._renderMessageHtml(content);

      row.appendChild(avatar);
      row.appendChild(bubbleElement);
      messageElement.appendChild(row);
    } else {
      // 사용자 메시지: 말풍선만
      const bubbleElement = document.createElement('div');
      bubbleElement.className = `${this.cssPrefix}-message-bubble`;
      bubbleElement.innerHTML = this._renderMessageHtml(content);
      messageElement.appendChild(bubbleElement);
    }

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
    // 구조화 응답이면 structured 클래스 동적 추가
    if (this._isStructuredResponse(content)) {
      bubbleElement.classList.add('structured');
    } else {
      bubbleElement.classList.remove('structured');
    }
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
    if (!messageElement) return;

    const prefix = this.cssPrefix;

    // 토글 버튼
    const toggleBtn = document.createElement('span');
    toggleBtn.setAttribute('role', 'button');
    toggleBtn.setAttribute('tabindex', '0');
    toggleBtn.className = `${prefix}-sources-toggle`;
    toggleBtn.innerHTML = `<span>참고 문헌</span><span class="${prefix}-sources-chevron" aria-hidden="true">▼</span>`;

    // 소스 리스트 — 기본 열림
    const listWrap = document.createElement('div');
    listWrap.className = `${prefix}-sources-list`;
    listWrap.setAttribute('data-open', 'true');
    toggleBtn.classList.add('is-open');

    sources.forEach(source => {
      const sourceEl = document.createElement('div');
      sourceEl.className = `${prefix}-source`;
      let label = '';
      if (source.category) {
        label += `[${source.category}] `;
      } else if (source.source_type === 'hospital') {
        label += '[병원 자료] ';
      }
      label += source.title || '참고자료';
      if (source.page) label += ` (p.${source.page})`;
      sourceEl.textContent = label;
      sourceEl.title = (source.text || '').substring(0, 200);
      listWrap.appendChild(sourceEl);
    });

    // 토글 클릭: data-open 속성으로 제어 (CSS class 대신 — 파트너 CSS 충돌 방지)
    toggleBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var isOpen = listWrap.getAttribute('data-open') === 'true';
      listWrap.setAttribute('data-open', isOpen ? 'false' : 'true');
      toggleBtn.classList.toggle('is-open');
      return false;
    };

    // footer-row에 토글, footer에 리스트 추가
    const footerRow = messageElement.querySelector(`.${prefix}-message-footer-row`);
    const footer = messageElement.querySelector(`.${prefix}-message-footer`);
    if (footerRow) footerRow.appendChild(toggleBtn);
    if (footer) {
      footer.appendChild(listWrap);
    } else {
      messageElement.appendChild(listWrap);
    }

    // footer 너비를 말풍선 너비에 맞춤 (참고문헌 버튼이 풍선 오른쪽 끝에 위치)
    const bubble = messageElement.querySelector(`.${prefix}-message-bubble`);
    if (bubble && footer) {
      footer.style.width = bubble.offsetWidth + 'px';
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
   * 의료 면책 안내 삽입
   */
  addDisclaimer() {
    const el = document.createElement('div');
    el.className = `${this.cssPrefix}-disclaimer`;
    el.textContent = '본 서비스는 참고용이며, 의학적 자문이나 진단을 대체하지 않습니다. 필요시 전문 의료진과 상담하세요.';
    this.elements.messagesContainer.appendChild(el);
    this.scrollToBottom();
  }


  /**
   * 로딩 상태 설정
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    this.elements.sendButton.disabled = isLoading;
    
    if (isLoading) {
      // 로딩 인디케이터: Studio 스타일 아바타 + ▌ 커서
      const loadingElement = document.createElement('div');
      loadingElement.className = `${this.cssPrefix}-loading-wrap`;
      loadingElement.id = 'loading-indicator';
      var accentColor = this.config.buttonColor || THEME_TOKENS[this.config.theme === 'navy' ? 'navy' : 'default'].buttonColor;
      loadingElement.innerHTML = `
        <div class="${this.cssPrefix}-message-avatar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L8.5 5.5L12.5 7L8.5 8.5L7 12.5L5.5 8.5L1.5 7L5.5 5.5L7 1.5Z" fill="${accentColor}"/></svg>
        </div>
        <span class="${this.cssPrefix}-loading-cursor">\u258C</span>
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
   * 티저 말풍선 DOM 생성 (mode === 'teaser' 전용)
   */
  createTeaserBubble() {
    const bubble = document.createElement('div');
    bubble.className = `${this.cssPrefix}-teaser-bubble`;

    // 아바타
    const avatar = document.createElement('div');
    avatar.className = `${this.cssPrefix}-teaser-avatar`;
    if (this.config.chatIconUrl) {
      avatar.innerHTML = `<img src="${this.config.chatIconUrl}" alt="" />`;
    } else {
      avatar.innerHTML = '<svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L8.5 5.5L12.5 7L8.5 8.5L7 12.5L5.5 8.5L1.5 7L5.5 5.5L7 1.5Z" fill="white"/></svg>';
    }
    bubble.appendChild(avatar);

    // 메시지 텍스트
    const text = document.createElement('span');
    text.className = `${this.cssPrefix}-teaser-text`;
    text.textContent = this.config.teaserMessage;
    bubble.appendChild(text);

    // 닫기 버튼 (hover 시 표시)
    const closeBtn = document.createElement('button');
    closeBtn.className = `${this.cssPrefix}-teaser-close`;
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bubble.classList.remove('visible');
      bubble.classList.add('hiding');
    });
    bubble.appendChild(closeBtn);

    // 클릭 → 채팅 열기
    bubble.addEventListener('click', () => this.open());

    this.elements.teaserBubble = bubble;
    document.body.appendChild(bubble);
  }

  /**
   * 티저 말풍선 표시 (딜레이 후 bounce-in)
   */
  showTeaser() {
    if (!this.elements.teaserBubble) return;
    setTimeout(() => {
      if (!this.state.isOpen) {
        this.elements.teaserBubble.classList.remove('hiding');
        this.elements.teaserBubble.classList.add('visible');
      }
    }, this.config.teaserDelay);
  }

  /**
   * 티저 클릭 → 채팅창 전환 (fadeOut → slideUp)
   */
  handleTeaserClick() {
    if (this.elements.teaserBubble) {
      this.elements.teaserBubble.classList.remove('visible');
      this.elements.teaserBubble.classList.add('hiding');
    }

    // 티저 fadeOut 후 채팅창 slideUp
    setTimeout(() => {
      this.elements.window.classList.remove('closing');
      this.elements.window.classList.add('open');
      this.scrollToBottom();
    }, 200);
  }

  /**
   * 채팅 닫기 → 티저 재등장 (slideDown → fadeIn)
   */
  closeChatToTeaser() {
    this.elements.window.classList.add('closing');
    this.elements.window.classList.remove('open');

    // slideDown 완료 후 티저 재등장
    setTimeout(() => {
      this.elements.window.classList.remove('closing');
      if (this.elements.teaserBubble) {
        this.elements.teaserBubble.classList.remove('hiding');
        this.elements.teaserBubble.classList.add('visible');
      }
    }, 400);
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
        }

        // has_data=true → 배지 dot 표시
        if (data.has_data && this.elements.badge) {
          this.elements.badge.classList.add('visible');
        }

        if (data.greeting) {
          // 말풍선 문구 업데이트 (줄바꿈/공백 강화 정규화: <br> 제거, 연속 공백 collapse)
          const raw = (data.greeting || '').replace(/<br\s*\/?>/gi, ' ');
          const normalizedGreeting = raw.replace(/\s+/g, ' ').trim();

          if (this.config.mode === 'teaser') {
            // 티저 모드: 티저 말풍선 텍스트 업데이트
            const teaserText = this.elements.teaserBubble && this.elements.teaserBubble.querySelector(`.${this.cssPrefix}-teaser-text`);
            if (teaserText) teaserText.textContent = normalizedGreeting;
          } else {
            // 버튼 모드: 웰컴 버블 텍스트 업데이트 + 노출
            this.elements.welcomeBubble.querySelector(`.${this.cssPrefix}-welcome-bubble-text`).textContent = normalizedGreeting;
            setTimeout(() => {
              if (!this.state.isOpen) {
                this.elements.welcomeBubble.classList.add('visible');
              }
            }, 1000);
          }
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
    // Visual Viewport 리스너 정리
    if (this._handleViewportResize && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._handleViewportResize);
      window.visualViewport.removeEventListener('scroll', this._handleViewportResize);
    }

    // 모바일 배경 스크롤 복원
    if (window.innerWidth <= 480) {
      document.body.style.overflow = this._prevBodyOverflow || '';
    }

    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }

    // 티저 말풍선 제거 (body에 직접 붙어있음)
    if (this.elements.teaserBubble && this.elements.teaserBubble.parentNode) {
      this.elements.teaserBubble.parentNode.removeChild(this.elements.teaserBubble);
    }

    // 스타일 제거 (다른 위젯이 없을 때만)
    const styleElement = document.getElementById(`${this.cssPrefix}-styles`);
    if (styleElement && !document.querySelector(`.${this.cssPrefix}-container`)) {
      styleElement.remove();
    }

    this.state.isInitialized = false;
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
}