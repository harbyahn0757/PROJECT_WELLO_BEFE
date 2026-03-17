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

  // 터치 모달: 인디케이터 터치 시 해당 zone 모달 표시
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const [readyForTouch, setReadyForTouch] = useState(false)
  useEffect(() => {
    if (introComplete && zoneMetrics.length > 0) {
      const timer = setTimeout(() => setReadyForTouch(true), 4200)
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
          onZoneClick={readyForTouch ? (metric) => {
            const idx = zoneMetrics.findIndex(m => m.zone === metric.zone && m.y === metric.y)
            setSelectedZone(prev => prev === idx ? null : idx)
          } : undefined}
        />
      </Suspense>

      {/* 실시간 좌표 조정 패널 — 주석 해제하면 슬라이더로 위치 조정 가능 */}
      {false && zoneMetrics.length > 0 && (
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

      {/* 터치 모달 — 인디케이터 터치 시 근처에 표시 */}
      {selectedZone !== null && zoneMetrics[selectedZone] && (() => {
        const m = zoneMetrics[selectedZone]
        const zk = (m as any).zoneKey || m.zone
        const nameMap: Record<string, string> = { blood: '빈혈', cardio: '심혈관', liver: '간', pancreas: '췌장', body_comp: '체성분', kidney: '신장' }
        const top = yToPercent(m.y)
        const onLeft = isLeft(m.x)
        const statusColor: Record<string, string> = { normal: '#4CAF50', borderline: '#8BC34A', warning: '#A1887F', unknown: '#D4C5A9' }
        const statusLabel: Record<string, string> = { normal: '정상', borderline: '경계', warning: '이상', unknown: '-' }
        const borderColor = statusColor[m.status] || '#D4C5A9'
        return (
          <>
            {/* 배경 터치로 닫기 */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 25 }}
              onClick={() => setSelectedZone(null)} />
            <div style={{
              position: 'absolute',
              top: `${Math.max(5, Math.min(75, top - 5))}%`,
              [onLeft ? 'left' : 'right']: '10px',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: '10px 14px',
              borderLeft: onLeft ? `4px solid ${borderColor}` : 'none',
              borderRight: !onLeft ? `4px solid ${borderColor}` : 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              fontSize: '11px',
              lineHeight: 1.5,
              zIndex: 30,
              animation: 'embed-tooltipIn 0.25s ease',
              minWidth: '120px',
              maxWidth: '200px',
            }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: borderColor, marginBottom: 6 }}>
                {nameMap[zk] || zk}
              </div>
              {m.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: j < m.items.length - 1 ? 4 : 0 }}>
                  <span style={{ color: '#666', fontSize: '10px' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: statusColor[item.status] || '#333', fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                    <span style={{ fontSize: '8px', color: statusColor[item.status] || '#999', fontWeight: 500 }}>
                      {statusLabel[item.status] || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      })()}
    </div>
  )
}
