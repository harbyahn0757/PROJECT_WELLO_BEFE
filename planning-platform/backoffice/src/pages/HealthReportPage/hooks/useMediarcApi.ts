/**
 * mediArc 엔진 API 호출 — 기존 백오피스 패턴(fetchWithAuth + getApiBase) 준용
 * BE 프록시: /partner-office/mediarc-report/*
 */
import { getApiBase, fetchWithAuth } from '../../../utils/api';

const API = getApiBase();

// ── 타입 ──

export interface DiseaseChip {
  name: string;
  present: boolean;
}

export interface AppliedFactor {
  factor?: string;
  name?: string;
  rr: number;
  pmid?: string;
  source?: string;
  confidence?: string;
}

export interface WillRogersEntry {
  orig_ratio: number;
  improved_ratio: number;
  orig_rank: number;
  improved_rank: number;
  rank_change: number;
  arr_pct: number;
  cohort_fixed: boolean;
}

export interface ImprovedScenario {
  labels?: { bmi?: string; smoking?: string; drinking?: string };
  improved_sbp?: number;
  improved_dbp?: number;
  improved_fbg?: number;
  ratios?: Record<string, number>;
  five_year_improved?: Record<string, number[]>;
  will_rogers?: Record<string, WillRogersEntry>;
  has_improvement?: boolean;
}

// ── 3-C: 시뮬레이션 API 타입 (simulate 엔드포인트) ──

/** POST /partner-office/mediarc-report/{uuid}/simulate request body */
export interface SimulateInput {
  bmi_target?: number;
  weight_delta_kg?: number;
  smoking_target?: 'current' | 'quit';
  drinking_target?: 'none';
  /** 0=현재 / 6=6개월 / 12=1년 / 60=5년 */
  time_horizon_months?: 0 | 6 | 12 | 60;
  force?: boolean;
}

/** POST /partner-office/mediarc-report/{uuid}/simulate response */
export interface SimulateResponse {
  uuid: string;
  hospital_id: string;
  /** request echo */
  input: SimulateInput;
  /** sha256 prefix-16 digest */
  input_digest: string;
  labels: {
    bmi?: string;
    smoking?: string;
    drinking?: string;
    time?: string;
  };
  improved_sbp: number;
  improved_dbp: number;
  improved_fbg: number;
  /** 질환별 개선 위험비 */
  ratios: Record<string, number>;
  /** 질환별 5년 연도별 예측 배열 */
  five_year_improved: Record<string, number[]>;
  /** 윌 로저스 방지 — 코호트 고정 등수 */
  will_rogers: Record<string, WillRogersEntry>;
  /** 질환별 시간축 감쇠계수 α */
  applied_attenuation: Record<string, number>;
  has_improvement: boolean;
  /** DB 캐시 hit 여부 */
  cached: boolean;
  /** ISO 8601 생성 시각 */
  generated_at: string;
  /** 고정값 "v1" */
  engine_version: string;
}

export interface PatientInfo {
  imputed_fields?: string[];
  missing_fields?: string[];
  /** 체중(kg) — facade patient_info에서 전달 */
  bmi?: number;
  /** 키(cm) — facade patient_info에서 전달 */
  height?: number;
  /** 체중(kg) — facade patient_info에서 전달 */
  weight?: number;
}

export interface BioageGbResult {
  score?: number;
  percentile?: number;
  [k: string]: any;
}

export interface DiseaseDetail {
  rank: number;
  rate?: number;
  chips?: DiseaseChip[];
  chips_present?: number;
  chips_total?: number;
  five_year?: number[];
  applied_factors?: AppliedFactor[];
  individual_rr?: number;
  cohort_mean_rr?: number;
  ratio?: number;
  grade?: string;
  improved_ratio?: number;
  improved_rank?: number;
  rank_change?: number;
  arr_pct?: number;
}

export interface PatientListItem {
  uuid: string;
  name: string;
  gender: string;
  birth_date: string | null;
  age: number | null;
  checkup_date: string | null;
  has_health_data: boolean;
  has_twobecon: boolean;
  source: string;
}

export interface BodyAge {
  bodyage: number;
  delta: number;
  bioage_gb?: BioageGbResult;
}

export interface GaugeItem {
  value: number;
  label: string;
  range: string;
}

export interface NutrientItem {
  name: string;
  tag: string;
  desc: string;
}

export interface ReportData {
  name: string;
  age: number;
  sex: string;
  group: string;
  bodyage: BodyAge;
  rank: number;
  diseases: Record<string, DiseaseDetail>;
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] } | null;
  gauges: { all: Record<string, GaugeItem> } | null;
  patient_info?: PatientInfo;
  improved?: ImprovedScenario;
  disease_ages?: Record<string, number>;
  /**
   * 3-B/3-C: BMI 마일스톤 5단계 시뮬레이션 결과 (옵셔널 — 기존 소비자 영향 없음)
   * 키: "current" | "minus2kg" | "minus5kg" | "minus10kg" | "normal_bmi"
   */
  milestones?: Record<string, SimulateResponse>;
}

export interface ComparisonItem {
  disease: string;
  twobecon_rate: number;
  mediarc_ratio: number;
  diff: number;
  match: boolean;
  twobecon_label?: string;
  mediarc_grade?: string;
  grade_match: boolean;
}

export interface ComparisonData {
  patient: { name: string; age: number; sex: string };
  twobecon: { bodyage: number; rank: number };
  mediarc: { bodyage: BodyAge; rank: number };
  match_rate: string;
  comparison: ComparisonItem[];
}

export interface EngineStats {
  total_rr: number;
  pmid_coverage: string;
  confidence: Record<string, number>;
  diseases: number;
  validation: string;
}

export interface VerificationData {
  total_patients: number;
  match_rate: string;
  disease_summary: Record<string, {
    match_rate: string;
    avg_diff: number;
    direction: string;
  }>;
  anomalies: any[];
  top_match: any[];
  worst_match: any[];
}

// ── API 함수 (fetchWithAuth 패턴) ──

export const fetchPatients = async (limit = 200) => {
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/patients?limit=${limit}`);
  return r.json() as Promise<{ patients: PatientListItem[]; total: number }>;
};

export const fetchReport = async (uuid: string) => {
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/${uuid}`);
  return r.json() as Promise<ReportData>;
};

export const fetchComparison = async (uuid: string) => {
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/${uuid}/compare`);
  return r.json() as Promise<ComparisonData>;
};

export const fetchEngineStats = async () => {
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/engine/stats`);
  return r.json() as Promise<EngineStats>;
};

export const fetchVerifyAll = async () => {
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/verify-all`);
  return r.json() as Promise<VerificationData>;
};

// ── AI 요약 (Phase 2) ──

export interface AiSummaryResponse {
  summary: string | null;
  generated_at: string | null;  // ISO 8601
  model: string | null;
  stale?: boolean;              // input_digest 변경 감지 플래그
}

// GET: 캐시된 요약 조회 (없으면 summary null 반환, 404 아님)
export const fetchAiSummary = async (uuid: string, hospitalId?: string): Promise<AiSummaryResponse> => {
  const qs = hospitalId ? `?hospital_id=${encodeURIComponent(hospitalId)}` : '';
  const r = await fetchWithAuth(`${API}/partner-office/mediarc-report/${uuid}/ai-summary${qs}`);
  return r.json();
};

// POST: 요약 생성 (force=true 로 강제 재생성)
export const generateAiSummary = async (
  uuid: string,
  hospitalId?: string,
  force: boolean = false,
): Promise<AiSummaryResponse> => {
  const qs = new URLSearchParams();
  if (hospitalId) qs.set('hospital_id', hospitalId);
  if (force) qs.set('force', '1');
  const r = await fetchWithAuth(
    `${API}/partner-office/mediarc-report/${uuid}/ai-summary${qs.toString() ? '?' + qs : ''}`,
    { method: 'POST' },
  );
  if (!r.ok) {
    const errTxt = await r.text().catch(() => '');
    throw new Error(`AI 요약 생성 실패 (HTTP ${r.status}): ${errTxt.slice(0, 200)}`);
  }
  return r.json();
};

// ── 3-C: simulate (시나리오 시뮬레이션) ──

/**
 * POST /partner-office/mediarc-report/{uuid}/simulate
 *
 * BMI 목표 / 금연 / 금주 / 시간축 조합으로 위험 개선 시나리오를 계산한다.
 * 동일 input 에 대해 BE가 DB 캐시(welno_mediarc_simulations)를 사용하므로
 * 재호출 시 즉시 반환된다.
 *
 * @param uuid        환자 UUID
 * @param input       시뮬레이션 파라미터
 * @param hospitalId  파트너오피스 병원 ID (없으면 빈 문자열)
 */
export const simulate = async (
  uuid: string,
  input: SimulateInput,
  hospitalId?: string,
): Promise<SimulateResponse> => {
  const qs = hospitalId ? `?hospital_id=${encodeURIComponent(hospitalId)}` : '';
  const r = await fetchWithAuth(
    `${API}/partner-office/mediarc-report/${uuid}/simulate${qs}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!r.ok) {
    const errTxt = await r.text().catch(() => '');
    throw new Error(`시뮬레이션 실패 (HTTP ${r.status}): ${errTxt.slice(0, 200)}`);
  }
  return r.json() as Promise<SimulateResponse>;
};
