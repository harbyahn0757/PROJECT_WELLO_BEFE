import type { CharacterMood, HealthCharacterState, BodyHighlight } from './HealthCharacterModel'

// 파트너사 스펙: 값 키 + {키}_abnormal + {키}_range 쌍으로 전달
export interface CheckupResults {
  [key: string]: number | string | undefined
}

export interface PartnerData {
  patient?: {
    name?: string
    birth_date?: string
    sex?: string
    phone?: string
  }
  checkup_results?: CheckupResults
  medical_history?: string[]
}

// normal=정상, warning=비정상/주의, unknown=판정 없음(베이지)
type HealthStatus = 'normal' | 'warning' | 'unknown'

// _abnormal 값 파싱 — 파트너사가 준 판정만 사용, 자체 판단 절대 안 함
function parseAbnormal(abnormalVal?: string | number): HealthStatus {
  if (abnormalVal == null) return 'unknown'
  const s = String(abnormalVal).trim()
  if (s === '') return 'unknown'
  if (s === '정상' || s === 'normal') return 'normal'
  return 'warning'  // "비정상", "주의", "질환의심" 등
}

function formatValue(key: string, cr: CheckupResults): string {
  const val = cr[key]
  if (val == null) return ''
  if (key === 'systolic_bp' && cr.diastolic_bp != null) {
    return `${val}/${cr.diastolic_bp}`
  }
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(1)
  return String(val)
}

// ===== 캐릭터 mood + highlights (파트너사 _abnormal 기반) =====

export function mapCheckupToHealthState(data?: PartnerData): HealthCharacterState | undefined {
  if (!data?.checkup_results) return undefined
  const cr = data.checkup_results

  // _abnormal 키 전부 수집
  let warningCount = 0
  let normalCount = 0
  let totalChecked = 0

  for (const [key, val] of Object.entries(cr)) {
    if (!key.endsWith('_abnormal') || val == null) continue
    totalChecked++
    const status = parseAbnormal(val)
    if (status === 'warning') warningCount++
    else if (status === 'normal') normalCount++
  }

  let mood: CharacterMood = 'neutral'
  if (warningCount >= 3) mood = 'worried'
  else if (warningCount >= 1) mood = 'concerned'
  else if (normalCount === totalChecked && totalChecked > 0) mood = 'happy'

  const highlights: BodyHighlight[] = []
  // 비정상 항목만 하이라이트
  const BODY_ZONE_MAP: Record<string, BodyHighlight['zone']> = {
    systolic_bp: 'chest', diastolic_bp: 'chest',
    bmi: 'full',
    fasting_glucose: 'abdomen',
    total_cholesterol: 'head', hemoglobin: 'head',
    sgot_ast: 'abdomen', sgpt_alt: 'abdomen', gamma_gtp: 'abdomen',
  }
  for (const [key, val] of Object.entries(cr)) {
    if (!key.endsWith('_abnormal')) continue
    const baseKey = key.replace('_abnormal', '')
    const status = parseAbnormal(val)
    if (status !== 'warning') continue
    const zone = BODY_ZONE_MAP[baseKey] || 'full'
    highlights.push({
      zone,
      color: '#FF9800',
      intensity: 0.6,
      label: `${baseKey} 주의`,
    })
  }

  const overallScore = totalChecked > 0 ? Math.round((normalCount / totalChecked) * 100) : 100
  return { mood, highlights, overallScore, alertCount: warningCount }
}

// ===== 인디케이터 zone 매핑 =====

type BodyZone = 'head' | 'face' | 'body' | 'side' | 'lower'

export interface ZoneMetricItem {
  label: string
  value: string
  status: HealthStatus
}

export interface ZoneMetric {
  zone: BodyZone
  label: string
  value: string
  status: HealthStatus  // normal=초록, warning=노랑, unknown=베이지
  x: number
  y: number
  items: ZoneMetricItem[]
}

type ZoneKey = 'head' | 'heart' | 'liver' | 'belly' | 'legs'
const KEY_ZONE_MAP: Record<string, { zone: BodyZone; zoneKey: ZoneKey; label: string; x: number; y: number }> = {
  total_cholesterol: { zone: 'head', zoneKey: 'head', label: '콜레스테롤', x: 0, y: 0.48 },
  hdl_cholesterol:   { zone: 'head', zoneKey: 'head', label: 'HDL', x: 0, y: 0.48 },
  ldl_cholesterol:   { zone: 'head', zoneKey: 'head', label: 'LDL', x: 0, y: 0.48 },
  hemoglobin:        { zone: 'head', zoneKey: 'head', label: '헤모글로빈', x: 0, y: 0.48 },
  systolic_bp:       { zone: 'face', zoneKey: 'heart', label: '혈압', x: 0.05, y: 0.18 },
  triglycerides:     { zone: 'face', zoneKey: 'heart', label: '중성지방', x: 0.05, y: 0.18 },
  sgot_ast:          { zone: 'side', zoneKey: 'liver', label: 'AST', x: -0.06, y: 0.12 },
  sgpt_alt:          { zone: 'side', zoneKey: 'liver', label: 'ALT', x: -0.06, y: 0.12 },
  gamma_gtp:         { zone: 'side', zoneKey: 'liver', label: 'GGT', x: -0.06, y: 0.12 },
  bmi:               { zone: 'body', zoneKey: 'belly', label: 'BMI', x: 0, y: 0.02 },
  weight:            { zone: 'body', zoneKey: 'belly', label: '체중', x: 0, y: 0.02 },
  height:            { zone: 'body', zoneKey: 'belly', label: '키', x: 0, y: 0.02 },
  fasting_glucose:   { zone: 'lower', zoneKey: 'legs', label: '혈당', x: 0, y: -0.12 },
  creatinine:        { zone: 'lower', zoneKey: 'legs', label: '크레아티닌', x: 0, y: -0.12 },
  gfr:               { zone: 'lower', zoneKey: 'legs', label: 'GFR', x: 0, y: -0.12 },
}

const ZONE_PRIORITY: Record<string, string[]> = {
  head: ['total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'hemoglobin'],
  heart: ['systolic_bp', 'triglycerides'],
  liver: ['sgot_ast', 'sgpt_alt', 'gamma_gtp'],
  belly: ['height', 'weight', 'bmi'],
  legs: ['fasting_glucose', 'creatinine', 'gfr'],
}

export function mapCheckupToZoneMetrics(cr?: CheckupResults): ZoneMetric[] {
  if (!cr) return []

  const groups: Record<string, { mapping: typeof KEY_ZONE_MAP[string]; items: ZoneMetricItem[] }> = {}

  for (const [zoneKey, keys] of Object.entries(ZONE_PRIORITY)) {
    for (const key of keys) {
      const val = cr[key]
      if (val == null || typeof val === 'string') continue
      const mapping = KEY_ZONE_MAP[key]
      if (!mapping) continue

      if (!groups[zoneKey]) {
        groups[zoneKey] = { mapping, items: [] }
      }

      const status = parseAbnormal(cr[`${key}_abnormal`])
      groups[zoneKey].items.push({ label: mapping.label, value: formatValue(key, cr), status })
    }
  }

  const metrics: ZoneMetric[] = []
  for (const [, group] of Object.entries(groups)) {
    if (group.items.length === 0) continue
    // 가장 나쁜 상태: warning > unknown > normal
    const worstStatus = group.items.some(i => i.status === 'warning') ? 'warning'
      : group.items.some(i => i.status === 'unknown') ? 'unknown' : 'normal'
    metrics.push({
      zone: group.mapping.zone,
      label: group.items[0].label,
      value: group.items[0].value,
      status: worstStatus,
      x: group.mapping.x,
      y: group.mapping.y,
      items: group.items,
    })
  }
  return metrics
}
