import type { CharacterMood, HealthCharacterState, BodyHighlight } from './HealthCharacterModel'

// 파트너사 스펙: 값 키 + {키}_abnormal + {키}_range 쌍으로 전달
// 예: systolic_bp: 128, systolic_bp_abnormal: "정상", systolic_bp_range: "120 미만"
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

type HealthStatus = 'normal' | 'warning' | 'danger'

interface MetricResult {
  key: string
  label: string
  value: number
  status: HealthStatus
  zone: BodyHighlight['zone']
}

function evaluateMetric(
  key: string, label: string, value: number | undefined,
  zone: BodyHighlight['zone'],
  normalMax: number, warningMax: number
): MetricResult | null {
  if (value == null) return null
  let status: HealthStatus = 'normal'
  if (value > warningMax) status = 'danger'
  else if (value > normalMax) status = 'warning'
  return { key, label, value, status, zone }
}

const STATUS_COLORS: Record<HealthStatus, string> = {
  normal: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
}

export function mapCheckupToHealthState(data?: PartnerData): HealthCharacterState | undefined {
  if (!data?.checkup_results) return undefined

  const cr = data.checkup_results
  const metrics: MetricResult[] = []

  const m1 = evaluateMetric('bmi', 'BMI', cr.bmi, 'full', 24.9, 29.9)
  if (m1) metrics.push(m1)

  const m2 = evaluateMetric('systolic_bp', '혈압(수축기)', cr.systolic_bp, 'chest', 120, 139)
  if (m2) metrics.push(m2)

  const m3 = evaluateMetric('fasting_glucose', '공복혈당', cr.fasting_glucose, 'abdomen', 100, 125)
  if (m3) metrics.push(m3)

  const m4 = evaluateMetric('total_cholesterol', '총콜레스테롤', cr.total_cholesterol, 'chest', 200, 239)
  if (m4) metrics.push(m4)

  const warningCount = metrics.filter(m => m.status === 'warning').length
  const dangerCount = metrics.filter(m => m.status === 'danger').length
  const normalCount = metrics.filter(m => m.status === 'normal').length

  let mood: CharacterMood = 'neutral'
  if (dangerCount >= 2) mood = 'worried'
  else if (dangerCount >= 1) mood = 'concerned'
  else if (warningCount >= 3) mood = 'concerned'
  else if (warningCount >= 1) mood = 'neutral'
  else if (normalCount === metrics.length && metrics.length > 0) mood = 'happy'

  const highlights: BodyHighlight[] = metrics
    .filter(m => m.status !== 'normal')
    .map(m => ({
      zone: m.zone,
      color: STATUS_COLORS[m.status],
      intensity: m.status === 'danger' ? 0.8 : 0.5,
      label: `${m.label} ${m.status === 'danger' ? '위험' : '주의'}`,
    }))

  const total = metrics.length || 1
  const overallScore = Math.round(((normalCount / total) * 100))

  return { mood, highlights, overallScore, alertCount: warningCount + dangerCount }
}

// 신체 부위별 메트릭 매핑 (3D 캐릭터 인디케이터용)
type BodyZone = 'head' | 'face' | 'body' | 'side' | 'lower'

export interface ZoneMetric {
  zone: BodyZone
  label: string
  value: string
  status: HealthStatus
  y: number  // 3D Y position
}

// 값 키 → 신체 부위 매핑
const KEY_ZONE_MAP: Record<string, { zone: BodyZone; label: string; y: number }> = {
  total_cholesterol: { zone: 'head', label: '콜레스테롤', y: 0.55 },
  hemoglobin:        { zone: 'head', label: '헤모글로빈', y: 0.55 },
  systolic_bp:       { zone: 'face', label: '혈압', y: 0.38 },
  sgot_ast:          { zone: 'face', label: 'AST', y: 0.38 },
  sgpt_alt:          { zone: 'face', label: 'ALT', y: 0.38 },
  bmi:               { zone: 'body', label: 'BMI', y: 0.18 },
  weight:            { zone: 'body', label: '체중', y: 0.18 },
  fasting_glucose:   { zone: 'lower', label: '혈당', y: -0.02 },
  creatinine:        { zone: 'lower', label: '크레아티닌', y: -0.02 },
  gfr:               { zone: 'lower', label: 'GFR', y: -0.02 },
}

// _abnormal 값에서 정상/비정상 판단 (파트너사가 제공)
function parseAbnormal(abnormalVal?: string | number): HealthStatus {
  if (abnormalVal == null) return 'normal'
  const s = String(abnormalVal).trim()
  if (s === '정상' || s === 'normal' || s === '') return 'normal'
  return 'warning'  // "비정상", "주의", "질환의심" 등 → 노랑
}

function formatValue(key: string, cr: CheckupResults): string {
  const val = cr[key]
  if (val == null) return ''
  // 혈압: 수축기/이완기 조합
  if (key === 'systolic_bp' && cr.diastolic_bp != null) {
    return `${val}/${cr.diastolic_bp}`
  }
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(1)
  return String(val)
}

export function mapCheckupToZoneMetrics(cr?: CheckupResults): ZoneMetric[] {
  if (!cr) return []
  const metrics: ZoneMetric[] = []
  const usedZones = new Set<string>()

  for (const [key, val] of Object.entries(cr)) {
    // _abnormal, _range, 문자열 메타 키는 건너뜀
    if (val == null || key.endsWith('_abnormal') || key.endsWith('_range')) continue
    if (typeof val === 'string') continue // 값은 숫자만 (문자열은 메타)

    const mapping = KEY_ZONE_MAP[key]
    if (!mapping) continue
    if (usedZones.has(mapping.zone)) continue
    usedZones.add(mapping.zone)

    // _abnormal 키가 있으면 파트너사 판정 사용, 없으면 정상 처리
    const abnormalKey = `${key}_abnormal`
    const status = parseAbnormal(cr[abnormalKey])

    metrics.push({
      zone: mapping.zone,
      label: mapping.label,
      value: formatValue(key, cr),
      status,
      y: mapping.y,
    })
  }
  return metrics
}

export function getMetricSummary(cr?: CheckupResults): Array<{
  label: string
  value: string
  status: HealthStatus
}> {
  if (!cr) return []

  const items: Array<{ label: string; value: string; status: HealthStatus }> = []

  if (cr.bmi != null) {
    items.push({
      label: 'BMI',
      value: cr.bmi.toFixed(1),
      status: cr.bmi > 29.9 ? 'danger' : cr.bmi > 24.9 ? 'warning' : 'normal',
    })
  }
  if (cr.systolic_bp != null && cr.diastolic_bp != null) {
    items.push({
      label: '혈압',
      value: `${cr.systolic_bp}/${cr.diastolic_bp}`,
      status: cr.systolic_bp > 139 ? 'danger' : cr.systolic_bp > 120 ? 'warning' : 'normal',
    })
  }
  if (cr.fasting_glucose != null) {
    items.push({
      label: '혈당',
      value: String(cr.fasting_glucose),
      status: cr.fasting_glucose > 125 ? 'danger' : cr.fasting_glucose > 100 ? 'warning' : 'normal',
    })
  }
  if (cr.total_cholesterol != null) {
    items.push({
      label: '콜레스테롤',
      value: String(cr.total_cholesterol),
      status: cr.total_cholesterol > 239 ? 'danger' : cr.total_cholesterol > 200 ? 'warning' : 'normal',
    })
  }
  return items
}
