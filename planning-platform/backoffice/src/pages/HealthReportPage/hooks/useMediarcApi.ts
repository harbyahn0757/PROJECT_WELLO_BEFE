/**
 * mediArc 엔진 API 호출 — 기존 백오피스 패턴(fetchWithAuth + getApiBase) 준용
 * BE 프록시: /partner-office/mediarc-report/*
 */
import { getApiBase, fetchWithAuth } from '../../../utils/api';

const API = getApiBase();

// ── 타입 ──

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
  diseases: Record<string, { rank: number; rate?: number }>;
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] } | null;
  gauges: { all: Record<string, GaugeItem> } | null;
  patient_info: Record<string, any>;
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
