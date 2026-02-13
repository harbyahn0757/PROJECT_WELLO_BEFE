/**
 * Welno Hospital Survey Widget - Vanilla JavaScript 임베드 위젯
 *
 * 파트너 병원 웹사이트에 임베드 가능한 만족도 설문 위젯
 * React 의존성 없이 순수 JavaScript 구현 (UMD)
 *
 * 사용법:
 * const widget = new WelnoSurveyWidget({
 *   apiKey: 'your-partner-api-key',
 *   hospitalId: 'hospital-001',
 *   baseUrl: 'https://welno.kindhabit.com'
 * });
 * widget.init();
 */

var SURVEY_FIELDS = [
  { key: 'reservation_process',  label: '예약 과정' },
  { key: 'facility_cleanliness', label: '시설 청결도' },
  { key: 'staff_kindness',       label: '직원 친절도' },
  { key: 'waiting_time',         label: '대기 시간' },
  { key: 'overall_satisfaction', label: '전반적 만족도' }
];

class WelnoSurveyWidget {
  constructor(config) {
    if (!config.apiKey) throw new Error('WelnoSurveyWidget: apiKey is required');
    if (!config.hospitalId) throw new Error('WelnoSurveyWidget: hospitalId is required');

    var baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    this.config = {
      apiKey: config.apiKey,
      hospitalId: config.hospitalId,
      baseUrl: baseUrl,
      uuid: config.uuid || 'survey_' + Date.now(),
      position: config.position || 'bottom-right',
      primaryColor: config.primaryColor || '#7B5E4F',
      buttonLabel: config.buttonLabel || '만족도 조사',
      title: config.title || '병원 만족도 설문',
      subtitle: config.subtitle || '소중한 의견을 남겨주세요',
      onSubmit: config.onSubmit || null,
      onError: config.onError || null,
      autoOpen: config.autoOpen || false,
      hideButton: config.hideButton || false
    };

    this.state = {
      isOpen: false,
      isSubmitting: false,
      isSubmitted: false,
      isInitialized: false,
      ratings: {}
    };

    this.elements = {};
    this.cssPrefix = 'welno-survey-widget';
  }

  init() {
    if (this.state.isInitialized) return;
    this.injectStyles();
    this.createDOM();
    this.bindEvents();
    this.state.isInitialized = true;

    if (this.config.autoOpen) {
      setTimeout(function () { this.open(); }.bind(this), 500);
    }
  }

  // ── CSS ────────────────────────────────────────────
  injectStyles() {
    var id = this.cssPrefix + '-styles';
    if (document.getElementById(id)) return;

    // Load Noto Sans KR
    if (!document.getElementById('welno-noto-sans-kr')) {
      try {
        var link = document.createElement('link');
        link.id = 'welno-noto-sans-kr';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap';
        link.onerror = function () {};
        document.head.appendChild(link);
      } catch (e) {}
    }

    var c = this.config.primaryColor;
    var p = this.cssPrefix;

    var css = '\
.' + p + '-container {\
  position: fixed;\
  z-index: 9999;\
  font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
  font-size: 15px;\
  line-height: 1.4;\
  color: #333;\
  box-sizing: border-box;\
}\
.' + p + '-container *, .' + p + '-container *::before, .' + p + '-container *::after { box-sizing: border-box; }\
.' + p + '-container.position-bottom-right { bottom: 24px; right: 24px; }\
.' + p + '-container.position-bottom-left { bottom: 24px; left: 24px; }\
.' + p + '-button {\
  display: flex; align-items: center; gap: 8px;\
  padding: 12px 20px;\
  border: none; border-radius: 28px;\
  background: ' + c + ';\
  color: #fff;\
  font-size: 14px; font-weight: 600;\
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);\
  cursor: pointer;\
  transition: all 0.3s ease;\
  outline: none;\
}\
.' + p + '-button:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }\
.' + p + '-button svg { width: 18px; height: 18px; flex-shrink: 0; }\
.' + p + '-overlay {\
  position: fixed; inset: 0;\
  background: rgba(0,0,0,0.5);\
  display: none;\
  align-items: center; justify-content: center;\
  z-index: 10000;\
  animation: ' + p + '-fadeIn 0.25s ease-out;\
}\
.' + p + '-overlay.open { display: flex; }\
@keyframes ' + p + '-fadeIn { from { opacity: 0; } to { opacity: 1; } }\
.' + p + '-panel {\
  background: #fff;\
  border-radius: 20px;\
  width: 420px; max-width: 92vw;\
  max-height: 90vh;\
  overflow-y: auto;\
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);\
  animation: ' + p + '-slideUp 0.3s ease-out;\
}\
@keyframes ' + p + '-slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }\
.' + p + '-header {\
  background: ' + c + ';\
  color: #fff;\
  padding: 20px 24px;\
  border-radius: 20px 20px 0 0;\
  display: flex; justify-content: space-between; align-items: flex-start;\
}\
.' + p + '-header h3 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }\
.' + p + '-header p { margin: 0; font-size: 13px; opacity: 0.85; }\
.' + p + '-close {\
  background: none; border: none;\
  color: #fff; font-size: 22px;\
  cursor: pointer; padding: 4px;\
  border-radius: 4px; line-height: 1;\
}\
.' + p + '-close:hover { background: rgba(255,255,255,0.15); }\
.' + p + '-body { padding: 24px; }\
.' + p + '-field { margin-bottom: 20px; }\
.' + p + '-field-label {\
  font-size: 14px; font-weight: 600; color: #333;\
  margin-bottom: 8px; display: block;\
}\
.' + p + '-stars {\
  display: flex; gap: 6px;\
}\
.' + p + '-star {\
  width: 36px; height: 36px;\
  border: 2px solid #ddd;\
  border-radius: 50%;\
  background: #fff;\
  cursor: pointer;\
  display: flex; align-items: center; justify-content: center;\
  font-size: 18px;\
  transition: all 0.15s;\
  color: #ccc;\
}\
.' + p + '-star:hover { border-color: ' + c + '; transform: scale(1.1); }\
.' + p + '-star.selected {\
  background: ' + c + ';\
  border-color: ' + c + ';\
  color: #fff;\
}\
.' + p + '-comment {\
  width: 100%;\
  min-height: 80px;\
  padding: 12px;\
  border: 1px solid #ddd;\
  border-radius: 12px;\
  font-size: 14px;\
  font-family: inherit;\
  resize: vertical;\
  outline: none;\
  transition: border-color 0.2s;\
}\
.' + p + '-comment:focus { border-color: ' + c + '; }\
.' + p + '-submit {\
  width: 100%;\
  padding: 14px;\
  background: ' + c + ';\
  color: #fff;\
  border: none;\
  border-radius: 12px;\
  font-size: 16px;\
  font-weight: 700;\
  cursor: pointer;\
  transition: all 0.2s;\
  margin-top: 8px;\
}\
.' + p + '-submit:hover:not(:disabled) { filter: brightness(0.9); }\
.' + p + '-submit:disabled { opacity: 0.5; cursor: not-allowed; }\
.' + p + '-thanks {\
  text-align: center;\
  padding: 60px 24px;\
}\
.' + p + '-thanks-icon {\
  font-size: 48px;\
  margin-bottom: 16px;\
}\
.' + p + '-thanks h3 {\
  margin: 0 0 8px;\
  font-size: 20px;\
  font-weight: 700;\
  color: #333;\
}\
.' + p + '-thanks p {\
  margin: 0;\
  font-size: 14px;\
  color: #666;\
}\
@media (max-width: 480px) {\
  .' + p + '-panel { width: 100%; max-width: 100%; border-radius: 20px 20px 0 0; position: fixed; bottom: 0; left: 0; right: 0; max-height: 85vh; }\
  .' + p + '-header { border-radius: 20px 20px 0 0; }\
  .' + p + '-container { bottom: 16px; right: 16px; }\
}\
';

    var el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── DOM ────────────────────────────────────────────
  createDOM() {
    var p = this.cssPrefix;

    // Container
    this.elements.container = document.createElement('div');
    this.elements.container.className = p + '-container position-' + this.config.position;

    // Floating button
    this.elements.button = document.createElement('button');
    this.elements.button.className = p + '-button';
    this.elements.button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>' +
      '<span>' + this.config.buttonLabel + '</span>';

    // Overlay
    this.elements.overlay = document.createElement('div');
    this.elements.overlay.className = p + '-overlay';

    // Panel
    var panel = document.createElement('div');
    panel.className = p + '-panel';

    // Header
    var header = document.createElement('div');
    header.className = p + '-header';
    header.innerHTML =
      '<div><h3>' + this.config.title + '</h3><p>' + this.config.subtitle + '</p></div>' +
      '<button class="' + p + '-close" aria-label="닫기">&times;</button>';

    // Body (form)
    this.elements.body = document.createElement('div');
    this.elements.body.className = p + '-body';
    this.renderForm();

    panel.appendChild(header);
    panel.appendChild(this.elements.body);
    this.elements.overlay.appendChild(panel);
    this.elements.panel = panel;

    if (!this.config.hideButton) {
      this.elements.container.appendChild(this.elements.button);
      document.body.appendChild(this.elements.container);
    }
    document.body.appendChild(this.elements.overlay);
  }

  renderForm() {
    var p = this.cssPrefix;
    var self = this;
    this.elements.body.innerHTML = '';

    // Rating fields
    SURVEY_FIELDS.forEach(function (field) {
      var wrapper = document.createElement('div');
      wrapper.className = p + '-field';

      var label = document.createElement('span');
      label.className = p + '-field-label';
      label.textContent = field.label;
      wrapper.appendChild(label);

      var stars = document.createElement('div');
      stars.className = p + '-stars';

      for (var i = 1; i <= 5; i++) {
        (function (score) {
          var star = document.createElement('button');
          star.className = p + '-star';
          star.type = 'button';
          star.textContent = score;
          star.setAttribute('data-field', field.key);
          star.setAttribute('data-score', String(score));

          star.addEventListener('click', function () {
            self.state.ratings[field.key] = score;
            // Update UI
            var siblings = stars.querySelectorAll('.' + p + '-star');
            for (var j = 0; j < siblings.length; j++) {
              var s = parseInt(siblings[j].getAttribute('data-score'), 10);
              if (s <= score) {
                siblings[j].classList.add('selected');
              } else {
                siblings[j].classList.remove('selected');
              }
            }
            self.updateSubmitState();
          });

          stars.appendChild(star);
        })(i);
      }

      wrapper.appendChild(stars);
      self.elements.body.appendChild(wrapper);
    });

    // Free comment
    var commentField = document.createElement('div');
    commentField.className = p + '-field';
    var commentLabel = document.createElement('span');
    commentLabel.className = p + '-field-label';
    commentLabel.textContent = '추가 의견 (선택)';
    commentField.appendChild(commentLabel);

    this.elements.comment = document.createElement('textarea');
    this.elements.comment.className = p + '-comment';
    this.elements.comment.placeholder = '개선할 점이나 좋았던 점을 자유롭게 남겨주세요...';
    commentField.appendChild(this.elements.comment);
    this.elements.body.appendChild(commentField);

    // Submit button
    this.elements.submitBtn = document.createElement('button');
    this.elements.submitBtn.className = p + '-submit';
    this.elements.submitBtn.textContent = '제출하기';
    this.elements.submitBtn.disabled = true;
    this.elements.body.appendChild(this.elements.submitBtn);
  }

  updateSubmitState() {
    var allFilled = SURVEY_FIELDS.every(function (f) {
      return !!this.state.ratings[f.key];
    }.bind(this));
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = !allFilled || this.state.isSubmitting;
    }
  }

  renderThanks() {
    var p = this.cssPrefix;
    this.elements.body.innerHTML =
      '<div class="' + p + '-thanks">' +
      '<div class="' + p + '-thanks-icon">&#x2705;</div>' +
      '<h3>감사합니다!</h3>' +
      '<p>소중한 의견이 접수되었습니다.<br>더 나은 서비스를 위해 노력하겠습니다.</p>' +
      '</div>';
  }

  // ── Events ─────────────────────────────────────────
  bindEvents() {
    var self = this;
    var p = this.cssPrefix;

    this.elements.button.addEventListener('click', function () { self.open(); });

    this.elements.overlay.querySelector('.' + p + '-close').addEventListener('click', function () { self.close(); });
    this.elements.overlay.addEventListener('click', function (e) {
      if (e.target === self.elements.overlay) self.close();
    });

    this.elements.submitBtn.addEventListener('click', function () { self.submit(); });
  }

  open() {
    if (this.state.isOpen) return;
    this.state.isOpen = true;
    this.elements.overlay.classList.add('open');
  }

  close() {
    if (!this.state.isOpen) return;
    this.state.isOpen = false;
    this.elements.overlay.classList.remove('open');

    // 제출 후 닫으면 리셋
    if (this.state.isSubmitted) {
      this.state.isSubmitted = false;
      this.state.ratings = {};
      this.renderForm();
      this.bindFormEvents();
    }
  }

  bindFormEvents() {
    var self = this;
    if (this.elements.submitBtn) {
      this.elements.submitBtn.addEventListener('click', function () { self.submit(); });
    }
  }

  async submit() {
    if (this.state.isSubmitting) return;
    this.state.isSubmitting = true;
    this.elements.submitBtn.disabled = true;
    this.elements.submitBtn.textContent = '제출 중...';

    try {
      var body = {
        hospital_id: this.config.hospitalId,
        reservation_process: this.state.ratings.reservation_process,
        facility_cleanliness: this.state.ratings.facility_cleanliness,
        staff_kindness: this.state.ratings.staff_kindness,
        waiting_time: this.state.ratings.waiting_time,
        overall_satisfaction: this.state.ratings.overall_satisfaction,
        free_comment: this.elements.comment ? this.elements.comment.value.trim() : '',
        respondent_uuid: this.config.uuid
      };

      var response = await fetch(this.config.baseUrl + '/welno-api/v1/hospital-survey/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        var errData = await response.json().catch(function () { return {}; });
        throw new Error(errData.detail || 'HTTP ' + response.status);
      }

      this.state.isSubmitted = true;
      this.renderThanks();

      if (this.config.onSubmit) this.config.onSubmit(body);

      // 3초 후 자동 닫힘
      var self = this;
      setTimeout(function () { self.close(); }, 3000);

    } catch (err) {
      console.error('[WelnoSurveyWidget] 제출 실패:', err);
      if (this.config.onError) this.config.onError(err);
      this.elements.submitBtn.textContent = '제출 실패 - 다시 시도';
      this.elements.submitBtn.disabled = false;
    } finally {
      this.state.isSubmitting = false;
    }
  }

  destroy() {
    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }
    if (this.elements.overlay && this.elements.overlay.parentNode) {
      this.elements.overlay.parentNode.removeChild(this.elements.overlay);
    }
    var style = document.getElementById(this.cssPrefix + '-styles');
    if (style) style.remove();
    this.state.isInitialized = false;
  }
}

// Static convenience: WelnoSurveyWidget.create(config) → returns initialized instance
WelnoSurveyWidget.create = function (config) {
  var widget = new WelnoSurveyWidget(config);
  widget.init();
  return widget;
};

// UMD export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelnoSurveyWidget;
  module.exports.default = WelnoSurveyWidget;
} else if (typeof define === 'function' && define.amd) {
  define([], function () { return WelnoSurveyWidget; });
} else {
  window.WelnoSurveyWidget = WelnoSurveyWidget;
}
