import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { mapCheckupToHealthState, getMetricSummary } from '../../components/character3d'
import type { PartnerData } from '../../components/character3d'
import './styles.scss'

const HealthCharacterScene = lazy(() => import('../../components/character3d/HealthCharacterScene'))

type HealthStatus = 'normal' | 'warning' | 'danger'

const STATUS_ICON: Record<HealthStatus, string> = {
  normal: '\u2705',
  warning: '\u26A0\uFE0F',
  danger: '\u274C',
}

export default function EmbedCharacterPage() {
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const [introComplete, setIntroComplete] = useState(false)

  // Receive partnerData via postMessage from parent window
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'WELNO_CHARACTER_DATA') {
        setPartnerData(event.data.partnerData)
      }
    }
    window.addEventListener('message', handleMessage)

    // Also check URL search params as fallback
    const params = new URLSearchParams(window.location.search)
    const dataParam = params.get('data')
    if (dataParam) {
      try {
        setPartnerData(JSON.parse(decodeURIComponent(dataParam)))
      } catch { /* ignore */ }
    }

    // Notify parent that iframe is ready
    window.parent.postMessage({ type: 'WELNO_CHARACTER_READY' }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const healthState = partnerData ? mapCheckupToHealthState(partnerData) : undefined
  const metrics = getMetricSummary(partnerData?.checkup_results)

  const handleCharacterClick = useCallback(() => {
    if (introComplete && metrics.length > 0) {
      setShowOverlay(prev => !prev)
    }
  }, [introComplete, metrics.length])

  const handleCloseOverlay = useCallback(() => {
    setShowOverlay(false)
  }, [])

  return (
    <div className="embed-character">
      <Suspense fallback={
        <div className="embed-character__loading">
          <div className="embed-character__spinner" />
        </div>
      }>
        <HealthCharacterScene
          width="100%"
          height="100%"
          backgroundColor="transparent"
          onIntroComplete={() => setIntroComplete(true)}
          onCharacterClick={handleCharacterClick}
          healthState={healthState}
          enableRotation={true}
        />
      </Suspense>

      {showOverlay && metrics.length > 0 && (
        <div className="embed-character__overlay" onClick={handleCloseOverlay}>
          <div className="embed-character__panel" onClick={e => e.stopPropagation()}>
            <div className="embed-character__panel-header">
              <span>나의 건강 상태</span>
              <button className="embed-character__close" onClick={handleCloseOverlay}>
                &times;
              </button>
            </div>
            {healthState && (
              <div className="embed-character__score">
                종합 점수: <strong>{healthState.overallScore}</strong>점
              </div>
            )}
            <div className="embed-character__divider" />
            <ul className="embed-character__metrics">
              {metrics.map((m, i) => (
                <li key={i} className={`embed-character__metric embed-character__metric--${m.status}`}>
                  <span className="embed-character__metric-icon">{STATUS_ICON[m.status]}</span>
                  <span className="embed-character__metric-label">{m.label}</span>
                  <span className="embed-character__metric-value">{m.value}</span>
                </li>
              ))}
            </ul>
            {partnerData?.checkup_results?.exam_date && (
              <div className="embed-character__date">
                검진일: {partnerData.checkup_results.exam_date}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
