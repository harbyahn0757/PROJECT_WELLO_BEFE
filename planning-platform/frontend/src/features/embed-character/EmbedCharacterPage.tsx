import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { mapCheckupToHealthState, mapCheckupToZoneMetrics } from '../../components/character3d'
import type { PartnerData, ZoneMetric } from '../../components/character3d'
import './styles.scss'

const HealthCharacterScene = lazy(() => import('../../components/character3d/HealthCharacterScene'))

export default function EmbedCharacterPage() {
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null)
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
      if (event.data?.type === 'WELNO_CHARACTER_DATA' || event.data?.type === 'WELNO_PARTNER_DATA') {
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

  const healthState = partnerData ? mapCheckupToHealthState(partnerData) : undefined
  const zoneMetrics = mapCheckupToZoneMetrics(partnerData?.checkup_results)

  useEffect(() => {
    console.log('[CharacterEmbed] partnerData:', partnerData ? 'yes' : 'null')
    console.log('[CharacterEmbed] healthState:', healthState?.mood, 'zoneMetrics:', zoneMetrics.length)
  }, [partnerData, healthState, zoneMetrics.length])

  // 스캔 완료 후 카드 표시 (introComplete + healthState 존재 + 약간 딜레이)
  const [showCards, setShowCards] = useState(false)
  useEffect(() => {
    if (introComplete && zoneMetrics.length > 0) {
      const timer = setTimeout(() => setShowCards(true), 4200) // 스캔 3.5초 + 페이드인 0.7초
      return () => clearTimeout(timer)
    }
  }, [introComplete, zoneMetrics.length])

  // 3D y좌표 → 화면 % 변환 (카메라 고정 기준 근사값)
  // 캐릭터 top≈0.70 → 15%, bottom≈-0.20 → 90%
  const yToPercent = (y: number) => Math.max(5, Math.min(92, 15 + (0.70 - y) / 0.90 * 75))
  const isLeft = (x: number) => x < 0

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
          enableRotation={true}
        />
      </Suspense>

      {/* 인디케이터 연결 수치 카드 — 스캔 완료 후 표시 */}
      {showCards && zoneMetrics.map((m, i) => {
        const top = yToPercent(m.y)
        const onLeft = isLeft(m.x)
        const borderColor = m.status === 'normal' ? '#4CAF50' : '#FFB300'
        return (
          <div key={i} className="embed-character__card" style={{
            position: 'absolute',
            top: `${top}%`,
            [onLeft ? 'left' : 'right']: '6px',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(6px)',
            borderRadius: '8px',
            padding: '4px 8px',
            borderLeft: onLeft ? `3px solid ${borderColor}` : 'none',
            borderRight: !onLeft ? `3px solid ${borderColor}` : 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '10px',
            lineHeight: 1.3,
            pointerEvents: 'none',
            zIndex: 20,
            animation: 'embed-tooltipIn 0.4s ease',
            animationDelay: `${i * 0.12}s`,
            animationFillMode: 'backwards',
            minWidth: '48px',
            textAlign: onLeft ? 'left' : 'right',
          }}>
            <div style={{ color: '#999', fontSize: '9px', fontWeight: 500 }}>{m.label}</div>
            <div style={{ color: '#333', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
          </div>
        )
      })}
    </div>
  )
}
