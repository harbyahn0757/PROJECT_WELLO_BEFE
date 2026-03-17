import type { CharacterMood, HealthCharacterState, BodyHighlight } from './HealthCharacterModel'

export interface CheckupResults {
  height?: number
  weight?: number
  bmi?: number
  systolic_bp?: number
  diastolic_bp?: number
  fasting_glucose?: number
  total_cholesterol?: number
  exam_date?: string
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

// 키 → 부위/라벨 매핑 (판단하지 않고 값만 표시)
const KEY_ZONE_MAP: Record<string, { zone: BodyZone; label: string; y: number }> = {
  total_cholesterol: { zone: 'head', label: '콜레스테롤', y: 0.55 },
  systolic_bp:       { zone: 'face', label: '혈압', y: 0.38 },
  bmi:               { zone: 'body', label: 'BMI', y: 0.18 },
  weight:            { zone: 'body', label: '체중', y: 0.18 },
  fasting_glucose:   { zone: 'lower', label: '혈당', y: -0.02 },
  height:            { zone: 'head', label: '신장', y: 0.55 },
}

export function mapCheckupToZoneMetrics(cr?: CheckupResults): ZoneMetric[] {
  if (!cr) return []
  const metrics: ZoneMetric[] = []
  const usedZones = new Set<string>()

  // 혈압은 수축기/이완기 조합
  if (cr.systolic_bp != null && cr.diastolic_bp != null) {
    metrics.push({
      zone: 'face', label: '혈압', value: `${cr.systolic_bp}/${cr.diastolic_bp}`,
      status: 'normal', y: 0.38,
    })
    usedZones.add('face')
  }

  // 나머지 키값 순회 — 들어온 데이터 그대로 매핑
  for (const [key, val] of Object.entries(cr)) {
    if (val == null || key === 'exam_date' || key === 'diastolic_bp' || key === 'systolic_bp') continue
    const mapping = KEY_ZONE_MAP[key]
    if (!mapping) continue
    if (usedZones.has(mapping.zone)) continue // 같은 부위 중복 방지
    usedZones.add(mapping.zone)
    metrics.push({
      zone: mapping.zone, label: mapping.label,
      value: typeof val === 'number' ? (Number.isInteger(val) ? String(val) : val.toFixed(1)) : String(val),
      status: 'normal', // 판단 안 함 — 파트너사 데이터 그대로
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
