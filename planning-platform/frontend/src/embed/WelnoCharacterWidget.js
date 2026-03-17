/**
 * Welno Character Widget - Vanilla JavaScript 임베드 위젯
 *
 * 파트너 웹사이트에 임베드 가능한 3D 디지털트윈 건강 캐릭터 위젯
 * React 의존성 없이 순수 JavaScript로 구현 (iframe으로 3D 렌더링)
 *
 * 사용법:
 * const widget = new WelnoCharacterWidget({
 *   apiKey: 'your-partner-api-key',
 *   baseUrl: 'https://api.welno.com',
 *   partnerData: { ... }
 * });
 * widget.init();
 */

class WelnoCharacterWidget {
  constructor(config) {
    if (!config.apiKey) {
      throw new Error('WelnoCharacterWidget: apiKey is required');
    }

    var baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    // partnerData JSON 문자열 자동 파싱
    var partnerData = config.partnerData || null;
    if (typeof partnerData === 'string') {
      try { partnerData = JSON.parse(partnerData); } catch(e) { partnerData = null; }
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: baseUrl,
      partnerData: partnerData,

      // UI 설정
      position: config.position || 'bottom-left',
      theme: config.theme || 'default',
      buttonColor: config.buttonColor || '#7B5E4F',
      buttonSize: config.buttonSize || 56,

      // 동작 설정
      autoOpen: config.autoOpen || false,
      iframeWidth: config.iframeWidth || 380,
      iframeHeight: config.iframeHeight || 500,

      // 콜백
      onOpen: config.onOpen || null,
      onClose: config.onClose || null,
      onError: config.onError || null
    };

    this.state = {
      isOpen: false,
      isInitialized: false,
      iframeReady: false
    };

    this.elements = {
      container: null,
      button: null,
      window: null,
      iframe: null,
      badge: null
    };

    this.cssPrefix = 'welno-char-widget';
  }

  /**
   * 위젯 초기화 및 DOM에 추가
   */
  init() {
    if (this.state.isInitialized) {
      console.warn('[WelnoCharacterWidget] 이미 초기화됨');
      return;
    }

    // 데이터 없는 환자 → 위젯 미노출
    var pd = this.config.partnerData;
    if (!pd || !pd.checkup_results) {
      console.info('[WelnoCharacterWidget] 검진 데이터 없음 — 위젯 미노출');
      return;
    }

    try {
      this.injectStyles();
      this.createDOM();
      this.bindEvents();

      if (this.config.autoOpen) {
        setTimeout(() => this.open(), 500);
      }

      this.state.isInitialized = true;
    } catch (error) {
      console.error('[WelnoCharacterWidget] 초기화 실패:', error);
      if (this.config.onError) this.config.onError(error);
    }
  }

  /**
   * CSS 스타일 주입
   */
  injectStyles() {
    if (document.getElementById(this.cssPrefix + '-styles')) return;

    var pos = this.config.position;
    var isLeft = pos.includes('left');
    var isTop = pos.includes('top');
    var btnSize = this.config.buttonSize;
    var btnColor = this.config.buttonColor;
    var iw = this.config.iframeWidth;
    var ih = this.config.iframeHeight;

    var style = document.createElement('style');
    style.id = this.cssPrefix + '-styles';
    style.textContent = ''
      + '.' + this.cssPrefix + '-container {'
      + '  position: fixed;'
      + '  z-index: 2147483646;'
      + (isTop ? '  top: 20px;' : '  bottom: 20px;')
      + (isLeft ? '  left: 20px;' : '  right: 20px;')
      + '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;'
      + '}'
      + '.' + this.cssPrefix + '-btn {'
      + '  width: ' + btnSize + 'px;'
      + '  height: ' + btnSize + 'px;'
      + '  border-radius: 50%;'
      + '  border: none;'
      + '  background: ' + btnColor + ';'
      + '  color: #fff;'
      + '  cursor: pointer;'
      + '  box-shadow: 0 4px 12px rgba(0,0,0,0.2);'
      + '  display: flex;'
      + '  align-items: center;'
      + '  justify-content: center;'
      + '  transition: transform 0.2s ease, box-shadow 0.2s ease;'
      + '  position: relative;'
      + '}'
      + '.' + this.cssPrefix + '-btn:hover {'
      + '  transform: scale(1.08);'
      + '  box-shadow: 0 6px 20px rgba(0,0,0,0.25);'
      + '}'
      + '.' + this.cssPrefix + '-badge {'
      + '  position: absolute;'
      + '  top: -2px;'
      + '  right: -2px;'
      + '  width: 14px;'
      + '  height: 14px;'
      + '  border-radius: 50%;'
      + '  border: 2px solid #fff;'
      + '  display: none;'
      + '}'
      + '.' + this.cssPrefix + '-badge.visible {'
      + '  display: block;'
      + '}'
      + '.' + this.cssPrefix + '-window {'
      + '  position: absolute;'
      + (isTop ? '  top: ' + (btnSize + 12) + 'px;' : '  bottom: ' + (btnSize + 12) + 'px;')
      + (isLeft ? '  left: 0;' : '  right: 0;')
      + '  width: ' + iw + 'px;'
      + '  height: ' + ih + 'px;'
      + '  border-radius: 16px;'
      + '  overflow: hidden;'
      + '  box-shadow: 0 8px 40px rgba(0,0,0,0.2);'
      + '  background: #f8f6f4;'
      + '  display: none;'
      + '  animation: ' + this.cssPrefix + '-slideIn 0.3s ease;'
      + '}'
      + '.' + this.cssPrefix + '-window.open {'
      + '  display: block;'
      + '}'
      + '.' + this.cssPrefix + '-iframe {'
      + '  width: 100%;'
      + '  height: 100%;'
      + '  border: none;'
      + '}'
      + '@keyframes ' + this.cssPrefix + '-slideIn {'
      + '  from { opacity: 0; transform: translateY(' + (isTop ? '-10' : '10') + 'px); }'
      + '  to { opacity: 1; transform: translateY(0); }'
      + '}';

    document.head.appendChild(style);
  }

  /**
   * DOM 생성
   */
  createDOM() {
    // 컨테이너
    var container = document.createElement('div');
    container.className = this.cssPrefix + '-container';
    this.elements.container = container;

    // 플로팅 버튼
    var btn = document.createElement('button');
    btn.className = this.cssPrefix + '-btn';
    btn.setAttribute('aria-label', '건강 캐릭터 열기');
    btn.innerHTML = this.getCharacterIcon();
    this.elements.button = btn;

    // 건강 상태 배지
    var badge = document.createElement('span');
    badge.className = this.cssPrefix + '-badge';
    this.elements.badge = badge;

    // 건강 데이터 기반 배지 색상
    var cr = this.config.partnerData && this.config.partnerData.checkup_results;
    if (cr) {
      var hasWarning = (cr.bmi > 24.9) || (cr.systolic_bp > 120)
        || (cr.fasting_glucose > 100) || (cr.total_cholesterol > 200);
      var hasDanger = (cr.bmi > 29.9) || (cr.systolic_bp > 139)
        || (cr.fasting_glucose > 125) || (cr.total_cholesterol > 239);
      badge.style.background = hasDanger ? '#F44336' : hasWarning ? '#FF9800' : '#4CAF50';
      badge.classList.add('visible');
    }

    btn.appendChild(badge);

    // 위젯 윈도우 (iframe 컨테이너)
    var win = document.createElement('div');
    win.className = this.cssPrefix + '-window';
    this.elements.window = win;

    container.appendChild(btn);
    container.appendChild(win);
    document.body.appendChild(container);
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    var self = this;

    this.elements.button.addEventListener('click', function() {
      if (self.state.isOpen) {
        self.close();
      } else {
        self.open();
      }
    });

    // iframe → parent 메시지 수신
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'WELNO_CHARACTER_READY') {
        self.state.iframeReady = true;
        self.sendDataToIframe();
      }
      if (event.data && event.data.type === 'WELNO_CHARACTER_CLOSE') {
        self.close();
      }
    });
  }

  /**
   * 위젯 열기 — iframe 생성
   */
  open() {
    if (this.state.isOpen) return;

    if (!this.elements.iframe) {
      var iframe = document.createElement('iframe');
      iframe.className = this.cssPrefix + '-iframe';
      var embedPath = this.config.embedPath || '/welno-app/embed/character';
      iframe.src = this.config.baseUrl + embedPath;
      iframe.setAttribute('allow', 'autoplay');
      iframe.setAttribute('loading', 'lazy');
      this.elements.iframe = iframe;
      this.elements.window.appendChild(iframe);
    }

    this.elements.window.classList.add('open');
    this.state.isOpen = true;

    if (this.state.iframeReady) {
      this.sendDataToIframe();
    }

    if (this.config.onOpen) this.config.onOpen();
  }

  /**
   * 위젯 닫기
   */
  close() {
    if (!this.state.isOpen) return;

    this.elements.window.classList.remove('open');
    this.state.isOpen = false;

    if (this.config.onClose) this.config.onClose();
  }

  /**
   * iframe에 partnerData 전송
   */
  sendDataToIframe() {
    if (!this.elements.iframe || !this.elements.iframe.contentWindow) return;
    this.elements.iframe.contentWindow.postMessage({
      type: 'WELNO_CHARACTER_DATA',
      partnerData: this.config.partnerData
    }, '*');
  }

  /**
   * 캐릭터 아이콘 SVG
   */
  getCharacterIcon() {
    return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none">'
      + '<circle cx="12" cy="8" r="5" stroke="currentColor" stroke-width="1.5"/>'
      + '<path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
      + '<circle cx="10" cy="7.5" r="0.8" fill="currentColor"/>'
      + '<circle cx="14" cy="7.5" r="0.8" fill="currentColor"/>'
      + '<path d="M10.5 9.5c.7.6 2.3.6 3 0" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>'
      + '</svg>';
  }

  /**
   * 위젯 제거
   */
  destroy() {
    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }
    var styleEl = document.getElementById(this.cssPrefix + '-styles');
    if (styleEl) styleEl.parentNode.removeChild(styleEl);

    this.state.isInitialized = false;
    this.state.isOpen = false;
    this.elements = { container: null, button: null, window: null, iframe: null, badge: null };
  }
}

// UMD export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelnoCharacterWidget;
} else if (typeof window !== 'undefined') {
  window.WelnoCharacterWidget = WelnoCharacterWidget;
}
