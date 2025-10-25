/**
 * 디바이스 고유 식별자 생성 서비스
 * 브라우저 환경 정보를 조합하여 디바이스별 고유 식별자 생성
 */

export class DeviceFingerprint {
  private static fingerprint: string | null = null;

  /**
   * 디바이스 핑거프린트 생성
   * 브라우저 정보, 화면 해상도, 시간대 등을 조합
   */
  static async generate(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    try {
      const components = await this.collectComponents();
      const fingerprint = this.hashComponents(components);
      
      this.fingerprint = fingerprint;
      console.log('🔍 [디바이스] 핑거프린트 생성:', fingerprint.slice(0, 16) + '...');
      
      return fingerprint;
    } catch (error) {
      console.error('❌ [디바이스] 핑거프린트 생성 실패:', error);
      // 폴백: 랜덤 식별자 + 타임스탬프
      const fallback = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.fingerprint = fallback;
      return fallback;
    }
  }

  /**
   * 브라우저 환경 정보 수집
   */
  private static async collectComponents(): Promise<Record<string, any>> {
    const components: Record<string, any> = {};

    // 1. 기본 브라우저 정보
    components.userAgent = navigator.userAgent;
    components.language = navigator.language;
    components.languages = navigator.languages?.join(',') || '';
    components.platform = navigator.platform;
    components.cookieEnabled = navigator.cookieEnabled;

    // 2. 화면 정보
    components.screenWidth = window.screen.width;
    components.screenHeight = window.screen.height;
    components.screenColorDepth = window.screen.colorDepth;
    components.screenPixelDepth = window.screen.pixelDepth;
    components.availWidth = window.screen.availWidth;
    components.availHeight = window.screen.availHeight;

    // 3. 시간대 정보
    components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    components.timezoneOffset = new Date().getTimezoneOffset();

    // 4. 브라우저 창 정보
    components.innerWidth = window.innerWidth;
    components.innerHeight = window.innerHeight;
    components.outerWidth = window.outerWidth;
    components.outerHeight = window.outerHeight;

    // 5. Canvas 핑거프린팅 (선택적)
    try {
      components.canvas = await this.getCanvasFingerprint();
    } catch (error) {
      console.warn('⚠️ [디바이스] Canvas 핑거프린팅 실패:', error);
      components.canvas = 'unavailable';
    }

    // 6. WebGL 정보 (선택적)
    try {
      components.webgl = this.getWebGLFingerprint();
    } catch (error) {
      console.warn('⚠️ [디바이스] WebGL 핑거프린팅 실패:', error);
      components.webgl = 'unavailable';
    }

    // 7. 폰트 정보 (선택적)
    try {
      components.fonts = await this.getFontFingerprint();
    } catch (error) {
      console.warn('⚠️ [디바이스] 폰트 핑거프린팅 실패:', error);
      components.fonts = 'unavailable';
    }

    // 8. 하드웨어 정보
    components.hardwareConcurrency = navigator.hardwareConcurrency || 0;
    components.maxTouchPoints = navigator.maxTouchPoints || 0;

    return components;
  }

  /**
   * Canvas 기반 핑거프린팅
   */
  private static async getCanvasFingerprint(): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return 'no-canvas';
    }

    canvas.width = 200;
    canvas.height = 50;

    // 텍스트 그리기
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Device fingerprint 🔍', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device fingerprint 🔍', 4, 17);

    // 도형 그리기
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  }

  /**
   * WebGL 기반 핑거프린팅
   */
  private static getWebGLFingerprint(): string {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (!gl) {
      return 'no-webgl';
    }

    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';

      return `${vendor}|${renderer}`;
    } catch (error) {
      console.warn('⚠️ [디바이스] WebGL 정보 수집 실패:', error);
      return 'webgl-error';
    }
  }

  /**
   * 폰트 기반 핑거프린팅
   */
  private static async getFontFingerprint(): Promise<string> {
    const testFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact', 'Malgun Gothic', 'Gulim'
    ];

    const availableFonts: string[] = [];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const baseFonts = ['monospace', 'sans-serif', 'serif'];

    // 기준 폰트로 측정
    const baseWidths: Record<string, number> = {};
    for (const baseFont of baseFonts) {
      const span = document.createElement('span');
      span.style.font = `${testSize} ${baseFont}`;
      span.textContent = testString;
      document.body.appendChild(span);
      baseWidths[baseFont] = span.offsetWidth;
      document.body.removeChild(span);
    }

    // 테스트 폰트 확인
    for (const font of testFonts) {
      let detected = false;
      
      for (const baseFont of baseFonts) {
        const span = document.createElement('span');
        span.style.font = `${testSize} ${font}, ${baseFont}`;
        span.textContent = testString;
        document.body.appendChild(span);
        
        const width = span.offsetWidth;
        if (width !== baseWidths[baseFont]) {
          detected = true;
        }
        
        document.body.removeChild(span);
        
        if (detected) {
          availableFonts.push(font);
          break;
        }
      }
    }

    return availableFonts.join(',');
  }

  /**
   * 컴포넌트들을 해시화하여 최종 핑거프린트 생성
   */
  private static hashComponents(components: Record<string, any>): string {
    const jsonString = JSON.stringify(components, Object.keys(components).sort());
    return this.simpleHash(jsonString);
  }

  /**
   * 간단한 해시 함수 (crypto API 대신)
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    
    // 음수를 양수로 변환하고 16진수로 변환
    const hashStr = Math.abs(hash).toString(16);
    
    // 최소 12자리 보장 (백엔드 요구사항: 10자리 이상)
    return hashStr.padStart(12, '0').slice(0, 32);
  }

  /**
   * 저장된 핑거프린트 초기화 (테스트용)
   */
  static reset(): void {
    this.fingerprint = null;
    console.log('🔄 [디바이스] 핑거프린트 초기화');
  }

  /**
   * 현재 핑거프린트 반환 (캐시된 값)
   */
  static getCached(): string | null {
    return this.fingerprint;
  }
}
