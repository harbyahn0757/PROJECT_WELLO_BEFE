import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { mapCheckupToHealthState, mapCheckupToZoneMetrics } from '../../components/character3d'
import type { PartnerData, ZoneMetric } from '../../components/character3d'
import type { RenderMode } from '../../components/character3d/HealthCharacterModel'
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

  // embed 페이지에서 글로벌 베이지 배경 제거 (html, body, #root 모두)
  useEffect(() => {
    const targets = [document.documentElement, document.body, document.getElementById('root')]
    targets.forEach(el => {
      if (!el) return
      el.style.setProperty('background-color', 'transparent', 'important')
      el.style.setProperty('background', 'transparent', 'important')
    })
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

  // 카메라 전환 목표값 — URL param ?cam=x,y,z,lookY 있을 때만 전환
  const camTarget = (() => {
    const p = new URLSearchParams(window.location.search).get('cam')
    if (p) { const [x, y, z, ly] = p.split(',').map(Number); return { x, y, z, lookY: ly } }
    return undefined  // cam 없으면 전환 안 함
  })()

  // 렌더 모드 — URL param ?mode=flat|realistic (기본값: realistic)
  const renderMode: RenderMode = (() => {
    const m = new URLSearchParams(window.location.search).get('mode')
    return m === 'flat' ? 'flat' : 'realistic'
  })()

  // 터치 모달: 인디케이터 터치 시 해당 zone 모달 표시
  const [selectedZone, setSelectedZone] = useState<number | null>(null)
  const modalOpenTime = React.useRef(0)
  const openModal = (idx: number | null) => {
    if (idx !== null) modalOpenTime.current = Date.now()
    setSelectedZone(idx)
  }
  const closeModal = () => {
    if (Date.now() - modalOpenTime.current < 300) return // 열린 직후 닫기 방지
    setSelectedZone(null)
  }
  const [readyForTouch, setReadyForTouch] = useState(false)
  useEffect(() => {
    if (introComplete && zoneMetrics.length > 0) {
      const timer = setTimeout(() => setReadyForTouch(true), 4200)
      return () => clearTimeout(timer)
    }
  }, [introComplete, zoneMetrics.length])

  // yToPercent/isLeft 제거됨 — 센터 모달이라 좌표→화면% 변환 불필요

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
          onIntroComplete={() => {
            setIntroComplete(true)
            window.parent.postMessage({ type: 'WELNO_INTRO_COMPLETE' }, '*')
          }}
          healthState={healthState}
          zoneMetrics={zoneMetrics}
          enableRotation={true}
          cameraTarget={camTarget}
          renderMode={renderMode}
          onZoneClick={readyForTouch ? (metric) => {
            const idx = zoneMetrics.findIndex(m => m.zone === metric.zone && m.y === metric.y)
            openModal(selectedZone === idx ? null : idx)
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

      {/* 센터 모달 — 인디케이터 터치 시 화면 중앙에 표시 */}
      {selectedZone !== null && zoneMetrics[selectedZone] && (() => {
        const m = zoneMetrics[selectedZone]
        const zk = (m as any).zoneKey || m.zone
        const nameMap: Record<string, string> = { blood: '빈혈', cardio: '심혈관', liver: '간', pancreas: '췌장', body_comp: '체성분', kidney: '신장' }
        const statusColor: Record<string, string> = { normal: '#4CAF50', borderline: '#8BC34A', warning: '#8B4513', unknown: '#D4C5A9' }
        const statusLabel: Record<string, string> = { normal: '정상', borderline: '경계', warning: '이상', unknown: '-' }
        const borderColor = statusColor[m.status] || '#D4C5A9'
        const organSvg: Record<string, string> = {
          blood: '<circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.8"/><path d="M12 2C12 2 6 8 6 12a6 6 0 0 0 12 0c0-4-6-10-6-10z" fill="currentColor" opacity="0.15"/>',
          cardio: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" opacity="0.8"/>',
          liver: '<path d="M4 8c0-2 2-4 5-4 2 0 3 1 4 1s2-1 4-1c3 0 5 2 5 5 0 4-3 7-6 9l-3 2-3-2c-3-2-6-5-6-9z" fill="currentColor" opacity="0.8"/>',
          pancreas: '<ellipse cx="12" cy="12" rx="8" ry="5" fill="currentColor" opacity="0.15"/><ellipse cx="12" cy="12" rx="5" ry="3" fill="currentColor" opacity="0.8"/>',
          body_comp: '<rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" opacity="0.15"/><line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1.5"/>',
          kidney: '<path d="M8 4c-3 0-5 3-5 6 0 4 3 7 5 10 2-3 5-6 5-10 0-3-2-6-5-6z" fill="currentColor" opacity="0.6"/><path d="M16 4c-3 0-5 3-5 6 0 4 3 7 5 10 2-3 5-6 5-10 0-3-2-6-5-6z" fill="currentColor" opacity="0.6"/>',
        }
        return (
          <div style={{ position: 'absolute', inset: 0, zIndex: 25, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}
            onClick={closeModal}>
            <div style={{
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px)',
              borderRadius: '16px', padding: '16px 20px',
              borderTop: `4px solid ${borderColor}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              minWidth: '200px', maxWidth: '280px',
              animation: 'embed-tooltipIn 0.25s ease',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" style={{ color: borderColor, flexShrink: 0 }}
                  dangerouslySetInnerHTML={{ __html: organSvg[zk] || '' }} />
                <span style={{ fontWeight: 700, fontSize: '14px', color: borderColor }}>{nameMap[zk] || zk}</span>
              </div>
              {m.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: j < m.items.length - 1 ? 6 : 0 }}>
                  <span style={{ color: '#666', fontSize: '11px' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: statusColor[item.status] || '#333', fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                    <span style={{ fontSize: '9px', color: statusColor[item.status] || '#999', fontWeight: 600, minWidth: '20px' }}>
                      {statusLabel[item.status] || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
