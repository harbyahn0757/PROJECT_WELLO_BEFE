/**
 * 검진설계 캠페인 랜딩 페이지
 * 알림톡 → 이 페이지 → 검진설계 시작
 */
import React from 'react';
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

// 수치 상태 판정
const getLevel = (type: string, val: number): 'normal' | 'warning' | 'danger' => {
  if (type === 'bmi') return val < 23 ? 'normal' : val < 25 ? 'warning' : 'danger';
  if (type === 'bphigh') return val < 120 ? 'normal' : val < 140 ? 'warning' : 'danger';
  if (type === 'blds') return val < 100 ? 'normal' : val < 126 ? 'warning' : 'danger';
  if (type === 'totchole') return val < 200 ? 'normal' : val < 240 ? 'warning' : 'danger';
  return 'normal';
};
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
                검진 데이터를 분석해서<br />
                꼭 필요한 항목만 알려드립니다
              </p>
            </div>
            <div className="landing__hero-illust">
              <img src="/images/landing-illust.webp" alt="" />
            </div>
          </div>
        </div>
      </div>

      {/* 건강 데이터 카드 */}
      {hasLinkData && (
        <div className="landing__health">
          <div className="landing__health-title">최근 검진 결과 요약</div>
          <div className="landing__health-grid">
            {healthData.bmi && (() => {
              const v = parseFloat(healthData.bmi);
              const lv = getLevel('bmi', v);
              return (
                <div className="landing__health-item">
                  <span className="landing__health-label">BMI</span>
                  <span className={`landing__health-value landing__health-value--${lv}`}>{v.toFixed(1)}</span>
                  <span className={`landing__health-status landing__health-status--${lv}`}>{statusLabel.bmi[lv]}</span>
                </div>
              );
            })()}
            {healthData.bphigh && (() => {
              const v = parseFloat(healthData.bphigh);
              const lv = getLevel('bphigh', v);
              return (
                <div className="landing__health-item">
                  <span className="landing__health-label">혈압</span>
                  <span className={`landing__health-value landing__health-value--${lv}`}>
                    {healthData.bphigh}/{healthData.bplwst || '-'}
                  </span>
                  <span className={`landing__health-status landing__health-status--${lv}`}>{statusLabel.bphigh[lv]}</span>
                </div>
              );
            })()}
            {healthData.blds && (() => {
              const v = parseFloat(healthData.blds);
              const lv = getLevel('blds', v);
              return (
                <div className="landing__health-item">
                  <span className="landing__health-label">혈당</span>
                  <span className={`landing__health-value landing__health-value--${lv}`}>{healthData.blds}</span>
                  <span className={`landing__health-status landing__health-status--${lv}`}>{statusLabel.blds[lv]}</span>
                </div>
              );
            })()}
            {healthData.totchole && (() => {
              const v = parseFloat(healthData.totchole);
              const lv = getLevel('totchole', v);
              return (
                <div className="landing__health-item">
                  <span className="landing__health-label">콜레스테롤</span>
                  <span className={`landing__health-value landing__health-value--${lv}`}>{healthData.totchole}</span>
                  <span className={`landing__health-status landing__health-status--${lv}`}>{statusLabel.totchole[lv]}</span>
                </div>
              );
            })()}
          </div>
          <div className="landing__health-note">
            이 수치들을 기반으로 맞춤 검진을 설계합니다
          </div>
        </div>
      )}

      {/* 가치 */}
      <div className="landing__value">
        <div className="landing__value-question">
          같은 검진비인데<br />
          나한테 안 맞는 항목을<br />
          받고 있진 않으셨나요?
        </div>
        <ul className="landing__value-list">
          <li className="landing__value-item">
            과거 검진 추이를 분석해서 위험 요인을 미리 파악합니다
          </li>
          <li className="landing__value-item">
            불필요한 검사는 줄이고 꼭 필요한 항목을 추천합니다
          </li>
          <li className="landing__value-item">
            약물 복용과 생활습관까지 반영한 정밀 설계입니다
          </li>
        </ul>
      </div>

      {/* 하단 */}
      <div className="landing__footer">
        <div className="landing__footer-item">개인정보는 암호화 처리됩니다</div>
        <div className="landing__footer-item">소요 시간 약 1~3분</div>
        {hospitalName && <div className="landing__footer-item">{hospitalName} 제공</div>}
        {hasAnyData && !isProcessing && (
          <button className="landing__footer-link" onClick={onAuthMultiYear}>
            과거 검진 기록까지 종합 분석하기
          </button>
        )}
      </div>

      {/* 하단 고정 CTA */}
      <div className="landing__sticky-cta">
        {hasAnyData && !isProcessing && (
          <button className="landing__cta-primary" onClick={() => hasLinkData ? onStartDesignWithData(healthData) : onStartDesign()}>
            <span className="landing__cta-primary-text">지금 바로 설계 시작</span>
            <span className="landing__cta-primary-sub">
              {status?.latest_year ? `${status.latest_year}년 데이터 기반` : '기존 데이터 기반'} · 약 1분
            </span>
          </button>
        )}
        {!hasAnyData && !isProcessing && (
          <button className="landing__cta-primary" onClick={onAuth}>
            <span className="landing__cta-primary-text">본인 인증하고 시작하기</span>
            <span className="landing__cta-primary-sub">검진 기록 연동 · 약 2분</span>
          </button>
        )}
        {isProcessing && (
          <button className="landing__cta-primary" style={{ opacity: 0.5 }} disabled>
            <span className="landing__cta-primary-text">분석 진행 중...</span>
          </button>
        )}
      </div>

      {!uuid && <p className="landing__no-link">파트너 링크를 통해 접속해주세요</p>}
    </div>
  );
};

export default IntroLandingPage;
