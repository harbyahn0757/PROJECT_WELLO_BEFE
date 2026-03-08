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

var RATING_LABELS_DEFAULT = ['매우불만족', '불만족', '보통', '만족', '매우만족'];
var NPS_LABELS_DEFAULT = ['전혀 아니다', '아니다', '보통', '그렇다', '매우 그렇다'];

var DEFAULT_SURVEY_FIELDS = [
  // 전반적 만족도 — 별도 섹션
  { key: 'overall_satisfaction', label: '전반적 만족도', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT, section: 'overall' } },
  // 세부 항목
  { key: 'reservation_process', label: '예약 과정', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT } },
  { key: 'facility_cleanliness', label: '시설 청결', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT } },
  { key: 'staff_kindness', label: '직원 친절', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT } },
  { key: 'waiting_time', label: '대기 시간', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT } },
  { key: 'result_explanation', label: '검진 결과 설명', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: RATING_LABELS_DEFAULT } },
  // 충성도 지표
  { key: 'revisit_intention', label: '재방문 의향', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: NPS_LABELS_DEFAULT } },
  { key: 'recommendation', label: '추천 의향', type: 'rating', required: true, options: null, config: { min: 1, max: 5, labels: NPS_LABELS_DEFAULT } },
  // 주관식
  { key: 'best_experience', label: '가장 좋았던 점', type: 'text', required: false, options: null, config: {} },
  { key: 'improvement_suggestion', label: '개선이 필요한 점', type: 'text', required: false, options: null, config: {} },
  { key: 'free_text', label: '기타 하실 말씀', type: 'text', required: false, options: null, config: {} }
];

class WelnoSurveyWidget {
  constructor(config) {
    if (!config || !config.apiKey || !config.hospitalId) {
      console.warn('[WelnoSurveyWidget] apiKey와 hospitalId는 필수입니다.');
      this._disabled = true;
      this.config = {}; this.state = {}; this.elements = {};
      return;
    }

    var baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    // partnerData가 JSON 문자열인 경우 자동 파싱
    var partnerData = config.partnerData || null;
    if (typeof partnerData === 'string') {
      try { partnerData = JSON.parse(partnerData); } catch(e) { partnerData = null; }
    }

    // hospitalName: 직접 전달 또는 partnerData에서 추출 (채팅 위젯과 동일 키)
    var hospitalName = config.hospitalName
      || (partnerData && partnerData.partner_hospital_name)
      || null;

    // respondentName: partnerData.patient.name에서 추출
    var respondentName = config.respondentName
      || (partnerData && partnerData.patient && partnerData.patient.name)
      || '';

    this.config = {
      apiKey: config.apiKey,
      hospitalId: config.hospitalId,
      hospitalName: hospitalName,
      respondentName: respondentName,
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

    if (!config.uuid) {
      console.warn('[WelnoSurveyWidget] uuid 미전달 — 기본값 사용. 채팅-설문 연동을 위해 uuid(webAppKey) 전달을 권장합니다.');
    }

    this.state = {
      isOpen: false,
      isSubmitting: false,
      isSubmitted: false,
      isInitialized: false,
      ratings: {}
    };

    this.surveyFields = DEFAULT_SURVEY_FIELDS;
    this.templateId = null;

    this.elements = {};
    this.cssPrefix = 'welno-survey-widget';
  }

  async fetchSurveyConfig() {
    try {
      var url = this.config.baseUrl + '/welno-api/v1/hospital-survey/config?hospital_id=' + encodeURIComponent(this.config.hospitalId);
      if (this.config.hospitalName) {
        url += '&hospital_name=' + encodeURIComponent(this.config.hospitalName);
      }
      var response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      var data = await response.json();

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        this.surveyFields = data.questions;
      }
      if (data.template_id) {
        this.templateId = data.template_id;
      }
    } catch (err) {
      console.warn('[WelnoSurveyWidget] 설문 설정 로드 실패, 기본 필드 사용:', err.message);
      this.surveyFields = DEFAULT_SURVEY_FIELDS;
      this.templateId = null;
    }
  }

  async init() {
    if (this._disabled) return;
    if (this.state.isInitialized) return;

    try {
      await this.fetchSurveyConfig();
      this.injectStyles();
      this.createDOM();
      this.bindEvents();
      this.state.isInitialized = true;

      if (this.config.autoOpen) {
        setTimeout(function () { this.open(); }.bind(this), 500);
      }
    } catch (err) {
      console.warn('[WelnoSurveyWidget] 초기화 실패:', err.message || err);
      // 위젯을 조용히 비활성화 — 사용자에게 에러 노출하지 않음
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
  display: flex; flex-direction: column;\
  overflow: hidden;\
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
.' + p + '-body { padding: 24px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }\
.' + p + '-field { margin-bottom: 20px; }\
.' + p + '-field-label {\
  font-size: 14px; font-weight: 600; color: #333;\
  margin-bottom: 8px; display: block;\
}\
.' + p + '-stars {\
  display: flex; gap: 6px;\
}\
.' + p + '-star {\
  padding: 6px 10px;\
  border: 1.5px solid #ddd;\
  border-radius: 20px;\
  background: #fff;\
  cursor: pointer;\
  display: flex; align-items: center; justify-content: center;\
  font-size: 12px;\
  font-weight: 500;\
  transition: all 0.15s;\
  color: #999;\
  white-space: nowrap;\
}\
.' + p + '-star:hover { transform: scale(1.05); }\
.' + p + '-star[data-level="1"]:hover { border-color: #c62828; color: #c62828; }\
.' + p + '-star[data-level="2"]:hover { border-color: #ef6c00; color: #ef6c00; }\
.' + p + '-star[data-level="3"]:hover { border-color: #fbc02d; color: #9e8600; }\
.' + p + '-star[data-level="4"]:hover { border-color: #66bb6a; color: #388e3c; }\
.' + p + '-star[data-level="5"]:hover { border-color: #2e7d32; color: #2e7d32; }\
.' + p + '-star.selected {\
  color: #fff;\
}\
.' + p + '-star.selected[data-level="1"] { background: #c62828; border-color: #c62828; }\
.' + p + '-star.selected[data-level="2"] { background: #ef6c00; border-color: #ef6c00; }\
.' + p + '-star.selected[data-level="3"] { background: #fbc02d; border-color: #fbc02d; color: #333; }\
.' + p + '-star.selected[data-level="4"] { background: #66bb6a; border-color: #66bb6a; }\
.' + p + '-star.selected[data-level="5"] { background: #2e7d32; border-color: #2e7d32; }\
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
.' + p + '-radio-group {\
  display: flex;\
  flex-direction: column;\
  gap: 8px;\
  width: 100%;\
  padding: 0 4px;\
}\
.' + p + '-radio-item {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  padding: 8px 12px;\
  border: 1px solid #e0e0e0;\
  border-radius: 8px;\
  cursor: pointer;\
  transition: all 0.2s;\
  font-size: 14px;\
}\
.' + p + '-radio-item:hover {\
  border-color: ' + c + ';\
  background: ' + c + '11;\
}\
.' + p + '-radio-item.selected {\
  border-color: ' + c + ';\
  background: ' + c + '22;\
}\
.' + p + '-radio-item input[type="radio"],\
.' + p + '-radio-item input[type="checkbox"] {\
  accent-color: ' + c + ';\
  width: 16px;\
  height: 16px;\
}\
.' + p + '-checkbox-group {\
  display: flex;\
  flex-direction: column;\
  gap: 8px;\
  width: 100%;\
  padding: 0 4px;\
}\
.' + p + '-checkbox-item {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  padding: 8px 12px;\
  border: 1px solid #e0e0e0;\
  border-radius: 8px;\
  cursor: pointer;\
  transition: all 0.2s;\
  font-size: 14px;\
}\
.' + p + '-checkbox-item:hover {\
  border-color: ' + c + ';\
  background: ' + c + '11;\
}\
.' + p + '-checkbox-item.selected {\
  border-color: ' + c + ';\
  background: ' + c + '22;\
}\
.' + p + '-text-input {\
  width: 100%;\
  min-height: 80px;\
  padding: 10px 12px;\
  border: 1px solid #e0e0e0;\
  border-radius: 8px;\
  font-family: "Noto Sans KR", sans-serif;\
  font-size: 14px;\
  resize: vertical;\
  outline: none;\
  transition: border-color 0.2s;\
  box-sizing: border-box;\
}\
.' + p + '-text-input:focus {\
  border-color: ' + c + ';\
}\
.' + p + '-rating-buttons {\
  display: flex;\
  justify-content: center;\
  gap: 6px;\
  flex-wrap: wrap;\
}\
.' + p + '-section-header {\
  text-align: center;\
  margin-bottom: 8px;\
}\
.' + p + '-section-header span {\
  font-size: 16px;\
  font-weight: 700;\
  color: ' + c + ';\
}\
.' + p + '-section-divider {\
  height: 1px;\
  background: #e0e0e0;\
  margin: 16px 0 12px;\
}\
.' + p + '-section-subheader {\
  font-size: 13px;\
  font-weight: 600;\
  color: #888;\
  margin-bottom: 12px;\
}\
.' + p + '-field--overall {\
  background: ' + c + '08;\
  border-radius: 12px;\
  padding: 12px;\
  border: 1px solid ' + c + '22;\
}\
@media (max-width: 480px) {\
  .' + p + '-panel {\
    width: 100%; max-width: 100%;\
    border-radius: 16px 16px 0 0;\
    position: fixed; bottom: 0; left: 0; right: 0;\
    max-height: 88vh;\
  }\
  .' + p + '-header {\
    border-radius: 16px 16px 0 0;\
    padding: 14px 16px;\
  }\
  .' + p + '-header h3 { font-size: 15px; margin: 0 0 2px; }\
  .' + p + '-header p { font-size: 12px; }\
  .' + p + '-close { font-size: 20px; padding: 2px; }\
  .' + p + '-body { padding: 16px; }\
  .' + p + '-field { margin-bottom: 16px; }\
  .' + p + '-field-label { font-size: 13px; margin-bottom: 6px; }\
  .' + p + '-rating-buttons { gap: 4px; }\
  .' + p + '-star {\
    padding: 8px 0; flex: 1; min-width: 0;\
    font-size: 11px; border-radius: 8px;\
    text-align: center; justify-content: center;\
  }\
  .' + p + '-comment { min-height: 60px; padding: 10px; font-size: 13px; border-radius: 8px; }\
  .' + p + '-text-input { min-height: 60px; padding: 10px; font-size: 13px; }\
  .' + p + '-radio-item, .' + p + '-checkbox-item { padding: 8px 10px; font-size: 13px; }\
  .' + p + '-submit { padding: 12px; font-size: 15px; border-radius: 10px; margin-top: 4px; }\
  .' + p + '-thanks { padding: 40px 16px; }\
  .' + p + '-thanks h3 { font-size: 17px; }\
  .' + p + '-thanks p { font-size: 13px; }\
  .' + p + '-section-header span { font-size: 14px; }\
  .' + p + '-section-subheader { font-size: 12px; margin-bottom: 8px; }\
  .' + p + '-section-divider { margin: 12px 0 8px; }\
  .' + p + '-field--overall { padding: 10px; }\
  .' + p + '-container { bottom: 12px; right: 12px; }\
  .' + p + '-button { padding: 10px 16px; font-size: 13px; gap: 6px; }\
  .' + p + '-button svg { width: 16px; height: 16px; }\
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

    // Dynamic survey fields
    var fields = this.surveyFields || DEFAULT_SURVEY_FIELDS;
    var overallRendered = false;
    var detailStarted = false;

    fields.forEach(function (field) {
      try {
        // 전반적 만족도 별도 섹션 처리
        var isOverall = field.config && field.config.section === 'overall';

        if (isOverall && !overallRendered) {
          // 전반적 만족도 섹션 헤더
          var sectionHeader = document.createElement('div');
          sectionHeader.className = p + '-section-header';
          sectionHeader.innerHTML = '<span>' + (field.label || '전반적 만족도') + '</span>';
          self.elements.body.appendChild(sectionHeader);
          overallRendered = true;
        } else if (!isOverall && !detailStarted && overallRendered) {
          // 세부 항목 시작 구분선
          var divider = document.createElement('div');
          divider.className = p + '-section-divider';
          self.elements.body.appendChild(divider);

          var detailHeader = document.createElement('div');
          detailHeader.className = p + '-section-subheader';
          detailHeader.textContent = '세부 항목';
          self.elements.body.appendChild(detailHeader);
          detailStarted = true;
        }

        var wrapper = document.createElement('div');
        wrapper.className = p + '-field' + (isOverall ? ' ' + p + '-field--overall' : '');

        // 전반적 만족도는 섹션 헤더에서 이미 라벨 표시했으므로 라벨 생략
        if (!isOverall) {
          var label = document.createElement('span');
          label.className = p + '-field-label';
          label.textContent = field.label || '';
          wrapper.appendChild(label);
        }

        if (field.type === 'rating') {
          self._renderRatingField(wrapper, field);
        } else if (field.type === 'text') {
          self._renderTextField(wrapper, field);
        } else if (field.type === 'single_choice') {
          self._renderSingleChoiceField(wrapper, field);
        } else if (field.type === 'multiple_choice') {
          self._renderMultipleChoiceField(wrapper, field);
        }

        self.elements.body.appendChild(wrapper);
      } catch (renderErr) {
        console.warn('[WelnoSurveyWidget] 필드 렌더링 실패:', field.key, renderErr.message);
      }
    });

    // Free comment — 텍스트 타입 필드가 이미 있으면 중복 생성 안 함
    var hasTextField = fields.some(function (f) { return f.type === 'text'; });
    if (!hasTextField) {
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
    }

    // Submit button
    this.elements.submitBtn = document.createElement('button');
    this.elements.submitBtn.className = p + '-submit';
    this.elements.submitBtn.textContent = '제출하기';
    this.elements.submitBtn.disabled = true;
    this.elements.body.appendChild(this.elements.submitBtn);
  }

  _renderRatingField(wrapper, field) {
    var p = this.cssPrefix;
    var self = this;
    var minVal = (field.config && field.config.min) ? field.config.min : 1;
    var maxVal = (field.config && field.config.max) ? field.config.max : 5;
    var labels = (field.config && field.config.labels) ? field.config.labels : RATING_LABELS_DEFAULT;

    var stars = document.createElement('div');
    stars.className = p + '-rating-buttons';

    for (var i = minVal; i <= maxVal; i++) {
      (function (score, idx) {
        var star = document.createElement('button');
        star.className = p + '-star';
        star.type = 'button';
        var labelText = labels[idx] || String(score);
        star.textContent = labelText;
        star.setAttribute('data-field', field.key);
        star.setAttribute('data-score', String(score));
        star.setAttribute('data-level', String(score));

        star.addEventListener('click', function () {
          self.state.ratings[field.key] = score;
          // Update UI — only highlight the selected one
          var siblings = stars.querySelectorAll('.' + p + '-star');
          for (var j = 0; j < siblings.length; j++) {
            var s = parseInt(siblings[j].getAttribute('data-score'), 10);
            if (s === score) {
              siblings[j].classList.add('selected');
            } else {
              siblings[j].classList.remove('selected');
            }
          }
          self.updateSubmitState();
        });

        stars.appendChild(star);
      })(i, i - minVal);
    }

    wrapper.appendChild(stars);
  }

  _renderTextField(wrapper, field) {
    var p = this.cssPrefix;
    var self = this;

    var textarea = document.createElement('textarea');
    textarea.className = p + '-text-input';
    textarea.placeholder = field.label || '';
    textarea.setAttribute('data-field', field.key);

    textarea.addEventListener('input', function () {
      var val = textarea.value.trim();
      if (val) {
        self.state.ratings[field.key] = val;
      } else {
        delete self.state.ratings[field.key];
      }
      self.updateSubmitState();
    });

    wrapper.appendChild(textarea);
  }

  _renderSingleChoiceField(wrapper, field) {
    var p = this.cssPrefix;
    var self = this;
    var options = field.options || [];

    var group = document.createElement('div');
    group.className = p + '-radio-group';

    options.forEach(function (option) {
      var item = document.createElement('label');
      item.className = p + '-radio-item';

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'welno_survey_' + field.key;
      radio.value = option;

      var text = document.createTextNode(option);

      radio.addEventListener('change', function () {
        self.state.ratings[field.key] = option;
        // Update selected state
        var items = group.querySelectorAll('.' + p + '-radio-item');
        for (var j = 0; j < items.length; j++) {
          items[j].classList.remove('selected');
        }
        item.classList.add('selected');
        self.updateSubmitState();
      });

      item.appendChild(radio);
      item.appendChild(text);
      group.appendChild(item);
    });

    wrapper.appendChild(group);
  }

  _renderMultipleChoiceField(wrapper, field) {
    var p = this.cssPrefix;
    var self = this;
    var options = field.options || [];

    var group = document.createElement('div');
    group.className = p + '-checkbox-group';

    options.forEach(function (option) {
      var item = document.createElement('label');
      item.className = p + '-checkbox-item';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option;

      var text = document.createTextNode(option);

      checkbox.addEventListener('change', function () {
        if (!Array.isArray(self.state.ratings[field.key])) {
          self.state.ratings[field.key] = [];
        }
        if (checkbox.checked) {
          self.state.ratings[field.key].push(option);
          item.classList.add('selected');
        } else {
          self.state.ratings[field.key] = self.state.ratings[field.key].filter(function (v) { return v !== option; });
          item.classList.remove('selected');
          if (self.state.ratings[field.key].length === 0) {
            delete self.state.ratings[field.key];
          }
        }
        self.updateSubmitState();
      });

      item.appendChild(checkbox);
      item.appendChild(text);
      group.appendChild(item);
    });

    wrapper.appendChild(group);
  }

  updateSubmitState() {
    var self = this;
    var allFilled = this.surveyFields.filter(function (f) {
      return f.required;
    }).every(function (f) {
      var val = self.state.ratings[f.key];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = !allFilled || this.state.isSubmitting;
    }
  }

  renderThanks() {
    var p = this.cssPrefix;
    this.elements.body.innerHTML =
      '<div class="' + p + '-thanks">' +
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

    // submit 핸들러를 저장해서 중복 바인딩 방지
    this._submitHandler = function () { self.submit(); };
    this.elements.submitBtn.addEventListener('click', this._submitHandler);
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
      // 기존 핸들러 제거 후 재등록 (중복 바인딩 방지)
      if (this._submitHandler) {
        this.elements.submitBtn.removeEventListener('click', this._submitHandler);
      }
      this._submitHandler = function () { self.submit(); };
      this.elements.submitBtn.addEventListener('click', this._submitHandler);
    }
  }

  async submit() {
    if (this.state.isSubmitting) return;
    this.state.isSubmitting = true;
    this.elements.submitBtn.disabled = true;
    this.elements.submitBtn.textContent = '제출 중...';

    try {
      var url;
      var body;

      // 항상 dynamic 경로 사용 (template_id=null이면 기본 설문으로 저장)
      url = this.config.baseUrl + '/welno-api/v1/hospital-survey/submit-dynamic';
      body = {
        hospital_id: this.config.hospitalId,
        hospital_name: this.config.hospitalName || undefined,
        template_id: this.templateId || undefined,
        answers: this.state.ratings,
        free_comment: this.elements.comment ? this.elements.comment.value.trim() : '',
        respondent_uuid: this.config.uuid,
        respondent_name: this.config.respondentName || undefined
      };

      var response = await fetch(url, {
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
  try {
    var widget = new WelnoSurveyWidget(config);
    widget.init().catch(function (err) {
      console.warn('[WelnoSurveyWidget] init error:', err.message || err);
    });
    return widget;
  } catch (err) {
    console.warn('[WelnoSurveyWidget] create error:', err.message || err);
    return null;
  }
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
