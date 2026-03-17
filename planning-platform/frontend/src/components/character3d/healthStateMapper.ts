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

export interface ZoneMetricItem {
  label: string
  value: string
  status: HealthStatus
}

export interface ZoneMetric {
  zone: BodyZone
  label: string       // 대표 라벨 (첫 번째 항목)
  value: string       // 대표 값
  status: HealthStatus // 가장 나쁜 상태
  x: number
  y: number
  items: ZoneMetricItem[]  // 해당 zone의 모든 수치
}

// 값 키 → 신체 부위 매핑 (3D 모델 실측 기준)
// x: 양수=화면 오른쪽(캐릭터 왼쪽), 음수=화면 왼쪽(캐릭터 오른쪽)
// blush 참조: 볼 y=0.47, x=±0.09
// zone당 1개만 표시 → 먼저 매칭되는 필드가 대표
type ZoneKey = 'head' | 'heart' | 'liver' | 'belly' | 'legs'
const KEY_ZONE_MAP: Record<string, { zone: BodyZone; zoneKey: ZoneKey; label: string; x: number; y: number }> = {
  // 머리 (y=0.48) — 콜레스테롤 계열 + 헤모글로빈
  total_cholesterol: { zone: 'head', zoneKey: 'head', label: '콜레스테롤', x: 0, y: 0.48 },
  hdl_cholesterol:   { zone: 'head', zoneKey: 'head', label: 'HDL', x: 0, y: 0.48 },
  ldl_cholesterol:   { zone: 'head', zoneKey: 'head', label: 'LDL', x: 0, y: 0.48 },
  hemoglobin:        { zone: 'head', zoneKey: 'head', label: '헤모글로빈', x: 0, y: 0.48 },
  // 심장 (y=0.18) — 혈압 + 중성지방
  systolic_bp:       { zone: 'face', zoneKey: 'heart', label: '혈압', x: 0.05, y: 0.18 },
  triglycerides:     { zone: 'face', zoneKey: 'heart', label: '중성지방', x: 0.05, y: 0.18 },
  // 간 (y=0.12) — AST, ALT, GGT
  sgot_ast:          { zone: 'side', zoneKey: 'liver', label: 'AST', x: -0.06, y: 0.12 },
  sgpt_alt:          { zone: 'side', zoneKey: 'liver', label: 'ALT', x: -0.06, y: 0.12 },
  gamma_gtp:         { zone: 'side', zoneKey: 'liver', label: 'GGT', x: -0.06, y: 0.12 },
  // 배 (y=0.02) — BMI, 체중, 키 (BMI가 먼저 매칭되어 대표)
  bmi:               { zone: 'body', zoneKey: 'belly', label: 'BMI', x: 0, y: 0.02 },
  weight:            { zone: 'body', zoneKey: 'belly', label: '체중', x: 0, y: 0.02 },
  height:            { zone: 'body', zoneKey: 'belly', label: '키', x: 0, y: 0.02 },
  // 하체 (y=-0.12) — 혈당, 신장기능
  fasting_glucose:   { zone: 'lower', zoneKey: 'legs', label: '혈당', x: 0, y: -0.12 },
  creatinine:        { zone: 'lower', zoneKey: 'legs', label: '크레아티닌', x: 0, y: -0.12 },
  gfr:               { zone: 'lower', zoneKey: 'legs', label: 'GFR', x: 0, y: -0.12 },
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

// 우선순위: 같은 zoneKey 안에서 표시 순서
const ZONE_PRIORITY: Record<string, string[]> = {
  head: ['total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'hemoglobin'],
  heart: ['systolic_bp', 'triglycerides'],
  liver: ['sgot_ast', 'sgpt_alt', 'gamma_gtp'],
  belly: ['height', 'weight', 'bmi'],
  legs: ['fasting_glucose', 'creatinine', 'gfr'],
}

export function mapCheckupToZoneMetrics(cr?: CheckupResults): ZoneMetric[] {
  if (!cr) return []

  // zoneKey별로 모든 수치 그룹핑
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
      groups[zoneKey].items.push({
        label: mapping.label,
        value: formatValue(key, cr),
        status,
      })
    }
  }

  // 그룹 → ZoneMetric 변환
  const metrics: ZoneMetric[] = []
  for (const [, group] of Object.entries(groups)) {
    if (group.items.length === 0) continue
    // 가장 나쁜 상태를 인디케이터 색상으로
    const worstStatus = group.items.some(i => i.status === 'danger') ? 'danger'
      : group.items.some(i => i.status === 'warning') ? 'warning' : 'normal'
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
