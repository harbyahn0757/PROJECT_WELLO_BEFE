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
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'WELNO_CHARACTER_DATA') {
        console.log('[CharacterEmbed] postMessage received:', JSON.stringify(event.data.partnerData).slice(0, 200))
        setPartnerData(event.data.partnerData)
      }
    }
    window.addEventListener('message', handleMessage)

    // URL search params fallback (partnerData 또는 data 파라미터)
    const params = new URLSearchParams(window.location.search)
    const dataParam = params.get('partnerData') || params.get('data')
    if (dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam))
        console.log('[CharacterEmbed] URL param data:', JSON.stringify(parsed).slice(0, 200))
        setPartnerData(parsed)
      } catch (e) {
        console.warn('[CharacterEmbed] URL param parse failed:', e)
      }
    }

    // Notify parent that iframe is ready
    window.parent.postMessage({ type: 'WELNO_CHARACTER_READY' }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

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
        <div className="embed-character__zone-tooltip" onClick={handleCloseOverlay}>
          <div className="embed-character__zone-label">{activeMetric.label}</div>
          <div className="embed-character__zone-value">{activeMetric.value}</div>
        </div>
      )}
    </div>
  )
}
