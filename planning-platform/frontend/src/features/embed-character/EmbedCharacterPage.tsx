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
  const zoneMetricsRaw = mapCheckupToZoneMetrics(partnerData?.checkup_results)

  // 실시간 좌표 조정 (슬라이더)
  const [adj, setAdj] = useState<Record<string, { x: number; y: number }>>({})
  const zoneMetrics = zoneMetricsRaw.map(m => {
    const zk = (m as any).zoneKey || m.zone
    const a = adj[zk]
    return a ? { ...m, x: m.x + a.x, y: m.y + a.y } : m
  })

  useEffect(() => {
    console.log('[CharacterEmbed v4] partnerData:', partnerData ? 'yes' : 'null')
    console.log('[CharacterEmbed v4] healthState:', healthState?.mood, 'zoneMetrics:', zoneMetrics.length)
    if (partnerData?.checkup_results) {
      const cr = partnerData.checkup_results
      const abnormalKeys = Object.keys(cr).filter(k => k.endsWith('_abnormal'))
      console.log('[CharacterEmbed v4] _abnormal:', abnormalKeys.map(k => `${k}=${cr[k]}`).join(', '))
      console.log('[CharacterEmbed v4] missing _abnormal:', ['hdl_cholesterol','ldl_cholesterol','triglycerides','creatinine','gfr'].filter(k => cr[`${k}_abnormal`] == null).join(', '))
    }
    if (zoneMetrics.length > 0) {
      console.log('[CharacterEmbed v4] zones:', zoneMetrics.map(m => `${m.zone}(y=${m.y},st=${m.status})`).join(' | '))
      zoneMetrics.forEach(m => {
        console.log(`[CharacterEmbed v4] ${m.zone} items:`, m.items.map(i => `${i.label}=${i.value}[${i.status}]`).join(', '))
      })
    }
  }, [partnerData, healthState, zoneMetrics.length])

  // 스캔 완료 후 카드 표시 (introComplete + healthState 존재 + 약간 딜레이)
  const [showCards, setShowCards] = useState(false)
  useEffect(() => {
    if (introComplete && zoneMetrics.length > 0) {
      const timer = setTimeout(() => setShowCards(true), 4200) // 스캔 3.5초 + 페이드인 0.7초
      return () => clearTimeout(timer)
    }
  }, [introComplete, zoneMetrics.length])

  // 3D y좌표 → 화면 % 변환 — 실제 스크린샷 기준 구간별 보정
  // 3D 카메라 원근법이 비선형이라 구간별 선형 보간 사용
  // 실측: y=0.55→22%, y=0.28→33%, y=0.10→55%
  const yToPercent = (y: number) => {
    if (y >= 0.55) return Math.max(5, 22 - (y - 0.55) * 40)
    if (y >= 0.28) return 22 + (0.55 - y) / 0.27 * 11
    if (y >= 0.10) return 33 + (0.28 - y) / 0.18 * 22
    return Math.min(92, 55 + (0.10 - y) / 0.15 * 12)
  }
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
          enableRotation={false}
        />
      </Suspense>

      {/* 실시간 좌표 조정 패널 (확정 후 제거) */}
      {zoneMetrics.length > 0 && (
        <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: '9px', color: '#333', zIndex: 99, background: 'rgba(255,255,255,0.92)', padding: '6px 8px', borderRadius: 6, lineHeight: 1.6, maxWidth: '55%', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>v5 좌표 조정</span>
            <button style={{ fontSize: '8px', padding: '2px 6px', cursor: 'pointer' }} onClick={() => {
              const txt = zoneMetrics.map(m => `${(m as any).zoneKey || m.zone}: x=${m.x.toFixed(2)}, y=${m.y.toFixed(2)}`).join('\n')
              navigator.clipboard?.writeText(txt)
              alert('좌표 복사됨!\n' + txt)
            }}>좌표 복사</button>
          </div>
          {zoneMetrics.map((m, i) => {
            const zk = (m as any).zoneKey || m.zone
            const nameMap: Record<string, string> = { blood: '빈혈', cardio: '심혈관', liver: '간', pancreas: '췌장', body_comp: '체성분', kidney: '신장' }
            const a = adj[zk] || { x: 0, y: 0 }
            return (
              <div key={i} style={{ marginBottom: 3, borderBottom: '1px solid #eee', paddingBottom: 3 }}>
                <div><b>{nameMap[zk] || zk}</b> x={m.x.toFixed(2)} y={m.y.toFixed(2)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>x</span>
                  <input type="range" min={-0.3} max={0.3} step={0.01} value={a.x}
                    style={{ width: '80px', height: '12px' }}
                    onChange={e => setAdj(p => ({ ...p, [zk]: { ...a, x: parseFloat(e.target.value) } }))} />
                  <span>y</span>
                  <input type="range" min={-0.5} max={0.5} step={0.01} value={a.y}
                    style={{ width: '80px', height: '12px' }}
                    onChange={e => setAdj(p => ({ ...p, [zk]: { ...a, y: parseFloat(e.target.value) } }))} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 인디케이터 연결 수치 카드 — 스캔 완료 후 표시 */}
      {showCards && zoneMetrics.map((m, i) => {
        const top = yToPercent(m.y)
        const onLeft = isLeft(m.x)
        const borderColor = m.status === 'normal' ? '#4CAF50' : m.status === 'warning' ? '#FFB300' : '#D4C5A9'
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
            {m.items.map((item, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: j < m.items.length - 1 ? '2px' : 0 }}>
                <span style={{ color: '#999', fontSize: '9px', fontWeight: 500, minWidth: '24px' }}>{item.label}</span>
                <span style={{
                  color: item.status === 'warning' ? '#E65100' : item.status === 'unknown' ? '#888' : '#333',
                  fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums'
                }}>{item.value}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
