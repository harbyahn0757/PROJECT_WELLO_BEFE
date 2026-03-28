/**
 * 검진설계 캠페인 랜딩 페이지
 * 알림톡 → 이 페이지 → 검진설계 시작
 */
import React, { useState } from 'react';
import './landing.scss';

interface CheckupDesignStatus {
  success: boolean;
  case_id: string;
  action: string;
  has_design: boolean;
  has_health_data: boolean;
  message?: string;
  available_years?: number[];
  latest_year?: number;
}

interface Props {
  uuid: string;
  partnerId: string;
  hospitalId: string;
  status: CheckupDesignStatus | null;
  healthData: any;
  onStartDesign: () => void;
  onStartDesignWithData: (data: any) => void;
  onAuth: () => void;
  onAuthMultiYear: () => void;
  onViewResult: () => void;
}

// 건강 항목 정의 (동적 카드용)
interface HealthItemDef {
  key: string;
  label: string;
  icon: string;
  subKey?: string;
  format?: (v: number, data: any) => string;
  inverted?: boolean; // true면 높을수록 좋음
  thresholds: [number, number]; // [정상 상한, 경계 상한]
  labels: [string, string, string]; // [정상, 경계, 위험]
}

const HEALTH_ITEMS: HealthItemDef[] = [
  { key: 'bmi', label: 'BMI', icon: '/icons/health-body.png', thresholds: [23, 25], labels: ['정상', '과체중', '비만'] },
  { key: 'bphigh', label: '혈압', icon: '/icons/health-blood-pressure.png', subKey: 'bplwst', thresholds: [120, 140], labels: ['정상', '경계', '고혈압'], format: (v, d) => `${v}/${d.bplwst || '-'}` },
  { key: 'blds', label: '혈당', icon: '/icons/health-diabetes.png', thresholds: [100, 126], labels: ['정상', '경계', '고혈당'] },
  { key: 'totchole', label: '콜레스테롤', icon: '/icons/health-cholesterol.png', thresholds: [200, 240], labels: ['정상', '경계', '주의'] },
  { key: 'hdlchole', label: 'HDL', icon: '/icons/health-cholesterol.png', thresholds: [40, 60], labels: ['낮음', '경계', '정상'], inverted: true },
  { key: 'ldlchole', label: 'LDL', icon: '/icons/health-cholesterol.png', thresholds: [130, 160], labels: ['정상', '경계', '주의'] },
  { key: 'triglyceride', label: '중성지방', icon: '/icons/health-cholesterol.png', thresholds: [150, 200], labels: ['정상', '경계', '주의'] },
  { key: 'hmg', label: '혈색소', icon: '/icons/health-anemia.png', thresholds: [12, 13], labels: ['낮음', '경계', '정상'], inverted: true },
  { key: 'gfr', label: 'GFR', icon: '/icons/health-kidney.png', thresholds: [60, 90], labels: ['주의', '경계', '정상'], inverted: true },
];

const getLevel = (item: HealthItemDef, val: number): 'normal' | 'warning' | 'danger' => {
  const [t1, t2] = item.thresholds;
  if (item.inverted) {
    return val >= t2 ? 'normal' : val >= t1 ? 'warning' : 'danger';
  }
  return val < t1 ? 'normal' : val < t2 ? 'warning' : 'danger';
};

// 하위 호환용
const statusLabel: Record<string, Record<string, string>> = {
  bmi: { normal: '정상', warning: '과체중', danger: '비만' },
  bphigh: { normal: '정상', warning: '경계', danger: '고혈압' },
  blds: { normal: '정상', warning: '경계', danger: '고혈당' },
  totchole: { normal: '정상', warning: '경계', danger: '주의' },
};

const IntroLandingPage: React.FC<Props> = ({
  uuid, partnerId, hospitalId, status, healthData,
  onStartDesign, onStartDesignWithData, onAuth, onAuthMultiYear, onViewResult,
}) => {
  const hasLinkData = healthData && (healthData.bmi || healthData.bphigh || healthData.blds);
  const hasDbData = status?.has_health_data;
  const hasAnyData = hasLinkData || hasDbData;
  const isProcessing = status?.action === 'show_processing';
  const name = healthData?.name || '';
  const hospitalName = healthData?.hosnm || '';

  const [showModal, setShowModal] = useState(false);

  // 결과 보기
  if (status?.action === 'show_result') {
    return (
      <div className="landing">
        <div className="landing__hero">
          <div className="landing__hero-inner">
            {hospitalName && <div className="landing__hospital">{hospitalName}</div>}
            <h1 className="landing__title">검진설계가<br />완료되었습니다</h1>
            <p className="landing__subtitle">맞춤 검진 항목을 확인해보세요</p>
          </div>
        </div>
        <div className="landing__cta">
          <button className="landing__cta-primary" onClick={onViewResult}>
            <span className="landing__cta-primary-text">내 검진설계 결과 보기</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      {/* 히어로 */}
      <div className="landing__hero">
        <div className="landing__hero-inner">
          <div className="landing__logo">
            <img src="/welno_logo.png" alt="WELNO" className="landing__logo-img" />
          </div>

          {hospitalName && (
            <div className="landing__hospital-greeting">
              안녕하세요. {hospitalName}입니다.
            </div>
          )}

          <div className="landing__hero-content">
            <div className="landing__hero-text">
              {name && <div className="landing__greeting">{name}님,</div>}
              <h1 className="landing__title">
                올해 검진,<br />
                뭘 받아야 할지<br />
                모르겠다면
              </h1>
              <p className="landing__subtitle">
                내 검진 결과를 보고,<br />
                꼭 필요한 항목만 골라줘요
              </p>
            </div>
            <div className="landing__hero-illust">
              <img src="/images/landing-illust.png" alt="" />
            </div>
          </div>
        </div>
      </div>

      {/* 질문 텍스트 (히어로 → 플래닝 사이) */}
      <div className="landing__value-question">
        나한테 딱 맞는 검진,<br />
        받고 있나요?
      </div>

      {/* 검진설계 미리보기 */}
      <div className="landing__design-img">
        <img src="/images/preview-planning.png" alt="검진설계 미리보기" />
      </div>

      {/* 건강 데이터 카드 */}
      {hasLinkData && (
        <div className="landing__health">
          <div className="landing__health-title">최근 검진 결과 요약</div>
          <div className="landing__health-grid">
            {HEALTH_ITEMS.map(item => {
              const rawVal = healthData[item.key];
              if (!rawVal) return null;
              const v = parseFloat(rawVal);
              if (isNaN(v)) return null;
              const lv = getLevel(item, v);
              const displayVal = item.format ? item.format(v, healthData) : (item.key === 'bmi' ? v.toFixed(1) : String(rawVal));
              return (
                <div key={item.key} className="landing__health-item">
                  <img className="landing__health-icon" src={item.icon} alt={item.label} />
                  <span className="landing__health-label">{item.label}</span>
                  <span className={`landing__health-value landing__health-value--${lv}`}>{displayVal}</span>
                  <span className={`landing__health-status landing__health-status--${lv}`}>{item.labels[lv === 'normal' ? 0 : lv === 'warning' ? 1 : 2]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 프리뷰 */}
      <div className="landing__preview">
        <h3 className="landing__preview-title">
          이런 결과를<br />받아볼 수 있어요
        </h3>
        <div className="landing__preview-scroll">
          <div className="landing__preview-card">
            <div className="landing__preview-phone">
              <img src="/images/preview-planning.png" alt="검진항목 추천" />
            </div>
            <div className="landing__preview-label">맞춤 검진항목 추천</div>
          </div>
          <div className="landing__preview-card">
            <div className="landing__preview-phone">
              <img src="/images/preview-report.png" alt="질병예측 리포트" />
            </div>
            <div className="landing__preview-label">AI 건강 리포트</div>
          </div>
          <div className="landing__preview-card">
            <div className="landing__preview-phone">
              <img src="/images/preview-trend.png" alt="건강 추이" />
            </div>
            <div className="landing__preview-label">내 건강 추이 한눈에</div>
          </div>
          <div className="landing__preview-card">
            <div className="landing__preview-phone">
              <img src="/images/preview-timeline.png" alt="의료기록" />
            </div>
            <div className="landing__preview-label">나의 의료기록 타임라인</div>
          </div>
        </div>
      </div>

      {/* 건강 노트 */}
      <div className="landing__health-note">
        내 몸에 맞는 검진,<br />
        같이 만들어볼까요?
      </div>

      {/* 가치 카드 */}
      <div className="landing__value-cards">
        <div className="landing__value-card">
          <img className="landing__value-icon" src="/images/value-trend.png" alt="" />
          <div className="landing__value-card-text">
            <strong>내 건강 변화 추이</strong>
            <span>해마다 달라진 건강 변화를 미리 살펴봐요</span>
          </div>
        </div>
        <div className="landing__value-card">
          <img className="landing__value-icon" src="/images/value-recommend.png" alt="" />
          <div className="landing__value-card-text">
            <strong>나한테 맞는 항목만</strong>
            <span>남들 다 받는 거 말고, 나한테 필요한 것만 골라줘요</span>
          </div>
        </div>
        <div className="landing__value-card">
          <img className="landing__value-icon" src="/images/value-lifestyle.png" alt="" />
          <div className="landing__value-card-text">
            <strong>약, 생활습관도 반영</strong>
            <span>지금 드시는 약, 생활습관까지 같이 봐요</span>
          </div>
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div className="landing__sticky-cta">
        {hasAnyData && !isProcessing && (
          <button className="landing__cta-primary" onClick={() => setShowModal(true)}>
            <span className="landing__cta-primary-text">나만의 검진 시작하기</span>
            <span className="landing__cta-primary-sub">
              {status?.latest_year ? `${status.latest_year}년 검진 결과로` : '내 검진 결과로'} · 약 1분
            </span>
          </button>
        )}
        {!hasAnyData && !isProcessing && (
          <button className="landing__cta-primary" onClick={onAuth}>
            <span className="landing__cta-primary-text">간편 인증하고 시작하기</span>
            <span className="landing__cta-primary-sub">검진 기록 연동 · 약 2분</span>
          </button>
        )}
        {isProcessing && (
          <button className="landing__cta-primary" style={{ opacity: 0.5 }} disabled>
            <span className="landing__cta-primary-text">만들고 있어요...</span>
          </button>
        )}
      </div>

      {/* 설계 방식 선택 모달 */}
      {showModal && (
        <div className="landing__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="landing__modal" onClick={e => e.stopPropagation()}>
            <button className="landing__modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="landing__modal-title">어떻게 시작할까요?</h3>
            <p className="landing__modal-desc">
              어떤 결과를 가지고 만들어볼까요?
            </p>

            <button
              className="landing__modal-option landing__modal-option--primary"
              onClick={() => { setShowModal(false); hasLinkData ? onStartDesignWithData(healthData) : onStartDesign(); }}
            >
              <span className="landing__modal-option-title">내 검진 결과로 바로 시작</span>
              <span className="landing__modal-option-desc">
                {status?.latest_year ? `${status.latest_year}년 결과 활용` : '지금 가진 결과로'} · 약 1분
              </span>
            </button>

            <button
              className="landing__modal-option"
              onClick={() => { setShowModal(false); onAuthMultiYear(); }}
            >
              <span className="landing__modal-option-title">과거 기록까지 같이 보기</span>
              <span className="landing__modal-option-desc">
                건보공단 간편인증으로 몇 년치 결과 한번에 · 약 2분
              </span>
            </button>
          </div>
        </div>
      )}

      {!uuid && <p className="landing__no-link">파트너 링크를 통해 접속해주세요</p>}
    </div>
  );
};

export default IntroLandingPage;
