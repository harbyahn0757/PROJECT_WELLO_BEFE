import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { mapCheckupToHealthState, mapCheckupToZoneMetrics } from '../../components/character3d'
import type { PartnerData, ZoneMetric } from '../../components/character3d'
import './styles.scss'

const HealthCharacterScene = lazy(() => import('../../components/character3d/HealthCharacterScene'))

export default function EmbedCharacterPage() {
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const [introComplete, setIntroComplete] = useState(false)

  // Receive partnerData via postMessage from parent window
  // 서버 로그 전송 (nginx access log에 남음)
  const sendLog = useCallback((msg: string, data?: Record<string, unknown>) => {
    const params = new URLSearchParams({ msg, ...(data ? { d: JSON.stringify(data).slice(0, 500) } : {}) })
    fetch(`/welno-api/v1/character-log?${params}`).catch(() => {})
  }, [])

  useEffect(() => {
    sendLog('iframe_loaded')

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'WELNO_CHARACTER_DATA') {
        const pd = event.data.partnerData
        const keys = pd?.checkup_results ? Object.keys(pd.checkup_results) : []
        sendLog('postMessage_received', { keys, hasPatient: !!pd?.patient, resultCount: keys.length })
        setPartnerData(pd)
      }
    }
    window.addEventListener('message', handleMessage)

    const params = new URLSearchParams(window.location.search)

    // 방법 1: URL param에서 partnerData 직접 파싱 (위젯 JS가 전달)
    const dataParam = params.get('partnerData') || params.get('data')
    if (dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam))
        const keys = parsed?.checkup_results ? Object.keys(parsed.checkup_results) : []
        sendLog('url_param_received', { keys, resultCount: keys.length })
        setPartnerData(parsed)
      } catch { sendLog('url_param_parse_failed') }
    } else {
      sendLog('no_url_data', { search: window.location.search.slice(0, 200) })
    }

    window.parent.postMessage({ type: 'WELNO_CHARACTER_READY' }, '*')
    return () => window.removeEventListener('message', handleMessage)
  }, [sendLog])

  const [activeMetric, setActiveMetric] = useState<ZoneMetric | null>(null)

  const healthState = partnerData ? mapCheckupToHealthState(partnerData) : undefined
  const zoneMetrics = mapCheckupToZoneMetrics(partnerData?.checkup_results)

  useEffect(() => {
    console.log('[CharacterEmbed] partnerData:', partnerData ? 'yes' : 'null')
    console.log('[CharacterEmbed] healthState:', healthState?.mood, 'zoneMetrics:', zoneMetrics.length)
  }, [partnerData, healthState, zoneMetrics.length])

  const handleZoneClick = useCallback((metric: ZoneMetric) => {
    setActiveMetric(prev => prev?.zone === metric.zone ? null : metric)
    // 3초 후 자동 닫기
    setTimeout(() => setActiveMetric(null), 4000)
  }, [])

  const handleCloseOverlay = useCallback(() => {
    setActiveMetric(null)
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
          healthState={healthState}
          zoneMetrics={zoneMetrics}
          onZoneClick={handleZoneClick}
          enableRotation={true}
        />
      </Suspense>

      {/* 부위 클릭 시 뜨는 투명 모달 — 캐릭터 옆에 표시 */}
      {activeMetric && (
        <div className={`embed-character__zone-tooltip embed-character__zone-tooltip--${activeMetric.status}`} onClick={handleCloseOverlay}>
          <div className="embed-character__zone-label">{activeMetric.label}</div>
          <div className="embed-character__zone-value">{activeMetric.value}</div>
          {activeMetric.status !== 'normal' && (
            <div className="embed-character__zone-status">주의</div>
          )}
        </div>
      )}
    </div>
  )
}
