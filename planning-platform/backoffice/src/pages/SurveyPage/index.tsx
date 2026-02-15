/**
 * 백오피스 - 병원 만족도 설문 통계 페이지
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import { useHierarchy } from '../../hooks/useHierarchy';
import { useDatePresets } from '../../hooks/useDatePresets';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { downloadWorkbook, downloadJson, dateSuffix } from '../../utils/excelExport';
import DemoBanner from '../../components/DemoBanner';
import { ExportButtons } from '../../components/ExportButtons';
import {
  BRAND_BROWN, SATISFACTION_VERY_LOW, SATISFACTION_LOW, SATISFACTION_MID,
  SATISFACTION_HIGH, SATISFACTION_VERY_HIGH,
  TREND_PALETTE, GRAY_300, GRAY_700,
} from '../../styles/colorTokens';
import { Spinner } from '../../components/Spinner';
import { SearchableSelect } from '../../components/SearchableSelect';
import './styles.scss';

const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};
const API_BASE = getApiBase();

const EMBEDDING_API_BASE = (() => {
  if (typeof window === 'undefined') return '/api/v1/admin/embedding';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1/admin/embedding';
  return '/api/v1/admin/embedding';
})();

interface SurveyStats {
  total_count: number;
  averages: Record<string, number>;
  field_labels: Record<string, string>;
  daily_trend: Record<string, any>[];
  template_id?: number | null;
}

interface SurveyResponse {
  id: number;
  partner_id: string;
  hospital_id: string;
  reservation_process?: number;
  facility_cleanliness?: number;
  staff_kindness?: number;
  waiting_time?: number;
  overall_satisfaction?: number;
  answers?: Record<string, any>;
  free_comment: string;
  respondent_uuid: string | null;
  created_at: string;
}

interface SurveyQuestion {
    question_key: string;
    question_label: string;
    question_type: 'rating' | 'text' | 'single_choice' | 'multiple_choice';
    is_required: boolean;
    options: string[] | null;
    display_order: number;
    config: Record<string, any>;
}

interface SurveyTemplate {
    id: number;
    partner_id: string;
    hospital_id: string;
    template_name: string;
    description: string;
    is_active: boolean;
    version: number;
    question_count?: number;
    questions?: SurveyQuestion[];
    created_at: string;
    updated_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  overall_satisfaction: '전반적 만족도',
  reservation_process: '예약 과정',
  facility_cleanliness: '시설 청결',
  staff_kindness: '직원 친절',
  waiting_time: '대기 시간',
  result_explanation: '결과 설명',
  revisit_intention: '재방문 의향',
  recommendation: '추천 의향',
};

const RATING_LABELS = ['매우불만족', '불만족', '보통', '만족', '매우만족'];
const NPS_LABELS = ['전혀 아니다', '아니다', '보통', '그렇다', '매우 그렇다'];

const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  // 전반적 만족도 — 별도 섹션 (section: 'overall')
  { question_key: 'overall_satisfaction', question_label: '전반적 만족도', question_type: 'rating', is_required: true, options: null, display_order: 0, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'pie', section: 'overall' } },
  // 세부 항목
  { question_key: 'reservation_process', question_label: '예약 과정', question_type: 'rating', is_required: true, options: null, display_order: 1, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'bar' } },
  { question_key: 'facility_cleanliness', question_label: '시설 청결', question_type: 'rating', is_required: true, options: null, display_order: 2, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'bar' } },
  { question_key: 'staff_kindness', question_label: '직원 친절', question_type: 'rating', is_required: true, options: null, display_order: 3, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'bar' } },
  { question_key: 'waiting_time', question_label: '대기 시간', question_type: 'rating', is_required: true, options: null, display_order: 4, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'bar' } },
  { question_key: 'result_explanation', question_label: '검진 결과 설명', question_type: 'rating', is_required: true, options: null, display_order: 5, config: { min: 1, max: 5, labels: RATING_LABELS, chart_type: 'bar' } },
  // 충성도 지표
  { question_key: 'revisit_intention', question_label: '재방문 의향', question_type: 'rating', is_required: true, options: null, display_order: 6, config: { min: 1, max: 5, labels: NPS_LABELS, chart_type: 'bar' } },
  { question_key: 'recommendation', question_label: '추천 의향', question_type: 'rating', is_required: true, options: null, display_order: 7, config: { min: 1, max: 5, labels: NPS_LABELS, chart_type: 'bar' } },
  // 주관식
  { question_key: 'best_experience', question_label: '가장 좋았던 점', question_type: 'text', is_required: false, options: null, display_order: 8, config: {} },
  { question_key: 'improvement_suggestion', question_label: '개선이 필요한 점', question_type: 'text', is_required: false, options: null, display_order: 9, config: {} },
  { question_key: 'free_text', question_label: '기타 하실 말씀', question_type: 'text', is_required: false, options: null, display_order: 10, config: {} },
];

const SurveyPage: React.FC = () => {
  const auth = useAuth();

  // embed 모드 감지 (iframe에서 쿼리 파라미터로 접속)
  const { isEmbedMode, embedParams } = useEmbedParams();

  // 파트너/병원 계층 구조
  const {
    hierarchy,
    selectedPartnerId, setSelectedPartnerId,
    selectedHospitalId, setSelectedHospitalId,
    collapsedPartners, togglePartner,
    fetchHierarchy, selectedHospitalName,
  } = useHierarchy(EMBEDDING_API_BASE, isEmbedMode ? embedParams : undefined);

  // 날짜 프리셋
  const { dateFrom, dateTo, setPreset: handleDatePreset, setDateRange, resetDates } = useDatePresets();

  const [summaryCounts, setSummaryCounts] = useState<{new_chats: number; new_surveys: number}>({new_chats: 0, new_surveys: 0});

  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [, setLoading] = useState(false);

  const [commentModal, setCommentModal] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<SurveyResponse | null>(null);

  // Today summary (카드 그리드용)
  const [todaySummary, setTodaySummary] = useState<{
    date?: string;
    hospitals: { hospital_id: string; hospital_name: string; today_count: number; avg_satisfaction: number }[];
    summary: { today_total: number; today_avg_score: number; active_hospitals: number; total_hospitals: number };
  } | null>(null);
  const [todaySummaryLoading, setTodaySummaryLoading] = useState(false);
  const [landingDate, setLandingDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Tab state
  const [activeTab, setActiveTab] = useState<'stats' | 'report' | 'templates'>('stats');

  // Per-question chart type state (persisted in localStorage)
  const [chartTypePerQ, setChartTypePerQ] = useState<Record<string, string>>(() => {
      try {
        const saved = localStorage.getItem('survey_chart_type_per_q');
        return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
  });

  // Template management state
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
      template_name: '',
      description: '',
      questions: [] as SurveyQuestion[]
  });
  const [activeTemplate, setActiveTemplate] = useState<SurveyTemplate | null>(null);

  // Persist per-question chart type to localStorage
  useEffect(() => {
      localStorage.setItem('survey_chart_type_per_q', JSON.stringify(chartTypePerQ));
  }, [chartTypePerQ]);

  // Get chart type for a question (fallback to template config, then 'bar')
  const getChartType = (q: SurveyQuestion) => {
    return chartTypePerQ[q.question_key] || q.config?.chart_type || 'bar';
  };

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
      if (!selectedPartnerId || !selectedHospitalId) return;
      try {
          const res = await fetch(`${API_BASE}/hospital-survey/templates?partner_id=${selectedPartnerId}&hospital_id=${selectedHospitalId}`);
          const data = await res.json();
          const tplList: SurveyTemplate[] = data.templates || [];
          setTemplates(tplList);
          const active = tplList.find(t => t.is_active);
          setActiveTemplate(active || null);
      } catch (e) { console.error('Failed to fetch templates:', e); alert('템플릿 목록 조회에 실패했습니다.'); }
  }, [selectedPartnerId, selectedHospitalId]);

  const saveTemplate = async () => {
      const body = {
          ...templateForm,
          partner_id: selectedPartnerId,
          hospital_id: selectedHospitalId,
          questions: templateForm.questions.map((q, i) => ({ ...q, display_order: i }))
      };
      try {
          const url = editingTemplate
              ? `${API_BASE}/hospital-survey/templates/${editingTemplate.id}`
              : `${API_BASE}/hospital-survey/templates`;
          const res = await fetch(url, {
              method: editingTemplate ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
          if (res.ok) {
              setEditingTemplate(null);
              setIsCreatingTemplate(false);
              fetchTemplates();
          }
      } catch (e) { console.error('Failed to save template:', e); alert('템플릿 저장에 실패했습니다.'); }
  };

  const toggleTemplateActive = async (id: number) => {
      try {
          await fetch(`${API_BASE}/hospital-survey/templates/${id}/activate`, { method: 'PUT' });
          fetchTemplates();
      } catch (e) { console.error('Failed to toggle template:', e); alert('템플릿 활성화 변경에 실패했습니다.'); }
  };

  const deleteTemplate = async (id: number) => {
      if (!window.confirm('이 템플릿을 삭제하시겠습니까?')) return;
      try {
          const res = await fetch(`${API_BASE}/hospital-survey/templates/${id}`, { method: 'DELETE' });
          if (res.status === 409) {
              alert('응답이 존재하는 템플릿은 삭제할 수 없습니다.');
              return;
          }
          fetchTemplates();
      } catch (e) { console.error('Failed to delete template:', e); alert('템플릿 삭제에 실패했습니다.'); }
  };

  const startEditTemplate = async (template: SurveyTemplate) => {
      try {
          const res = await fetch(`${API_BASE}/hospital-survey/templates/${template.id}`);
          const data = await res.json();
          setTemplateForm({
              template_name: data.template_name,
              description: data.description || '',
              questions: Array.isArray(data.questions) ? data.questions : []
          });
          setEditingTemplate(data);
          setIsCreatingTemplate(false);
      } catch (e) { console.error('Failed to load template:', e); alert('템플릿 불러오기에 실패했습니다.'); }
  };

  const startCreateTemplate = () => {
      setTemplateForm({ template_name: '', description: '', questions: [...DEFAULT_QUESTIONS] });
      setEditingTemplate(null);
      setIsCreatingTemplate(true);
  };

  const startEditDefault = () => {
      setTemplateForm({ template_name: '기본 만족도 설문', description: '기본 5개 항목 설문', questions: [...DEFAULT_QUESTIONS] });
      setEditingTemplate(null);
      setIsCreatingTemplate(true);
  };

  const cancelEdit = () => {
      setEditingTemplate(null);
      setIsCreatingTemplate(false);
  };

  // Question management helpers
  const addQuestion = () => {
      setTemplateForm(prev => ({
          ...prev,
          questions: [...prev.questions, {
              question_key: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              question_label: '',
              question_type: 'rating' as const,
              is_required: true,
              options: null,
              display_order: prev.questions.length,
              config: { min: 1, max: 5 }
          }]
      }));
  };

  const removeQuestion = (index: number) => {
      setTemplateForm(prev => ({
          ...prev,
          questions: prev.questions.filter((_, i) => i !== index)
      }));
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
      setTemplateForm(prev => ({
          ...prev,
          questions: prev.questions.map((q, i) => i === index ? { ...q, ...updates } : q)
      }));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      setTemplateForm(prev => {
          const questions = [...prev.questions];
          [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
          return { ...prev, questions };
      });
  };

  // Fetch stats
  const fetchStats = useCallback(async (hospitalId: string, partnerId: string, tplId?: number | null) => {
    try {
      const params = new URLSearchParams({ partner_id: partnerId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (tplId) params.append('template_id', String(tplId));
      const res = await fetch(`${API_BASE}/hospital-survey/${hospitalId}/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error('Stats fetch failed:', e);
    }
  }, [dateFrom, dateTo]);

  // Fetch responses
  const fetchResponses = useCallback(async (hospitalId: string, partnerId: string, p: number, tplId?: number | null) => {
    try {
      const params = new URLSearchParams({
        partner_id: partnerId,
        page: String(p),
        page_size: String(pageSize),
      });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (tplId) params.append('template_id', String(tplId));
      const res = await fetch(`${API_BASE}/hospital-survey/${hospitalId}/responses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responses);
        setTotalResponses(data.total);
      }
    } catch (e) {
      console.error('Responses fetch failed:', e);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isEmbedMode && embedParams.partnerId && embedParams.hospitalId) {
      setSelectedPartnerId(embedParams.partnerId);
      setSelectedHospitalId(embedParams.hospitalId);
    }
    fetchHierarchy();
    fetch(`${EMBEDDING_API_BASE}/summary-counts`).then(r => r.json()).then(setSummaryCounts).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 병원 미선택 시 today-summary fetch (날짜 변경 시 재조회)
  useEffect(() => {
    if (!selectedHospitalId && !isEmbedMode) {
      setTodaySummaryLoading(true);
      fetch(`${API_BASE}/hospital-survey/today-summary?target_date=${landingDate}`)
        .then(r => r.json())
        .then(d => setTodaySummary(d))
        .catch(() => setTodaySummary(null))
        .finally(() => setTodaySummaryLoading(false));
    }
  }, [selectedHospitalId, isEmbedMode, landingDate]);

  const shiftLandingDate = (days: number) => {
    const d = new Date(landingDate);
    d.setDate(d.getDate() + days);
    setLandingDate(d.toISOString().slice(0, 10));
  };
  const isLandingToday = landingDate === new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (selectedHospitalId && selectedPartnerId) {
      const tplId = activeTemplate?.id || null;
      setLoading(true);
      Promise.all([
        fetchStats(selectedHospitalId, selectedPartnerId, tplId),
        fetchResponses(selectedHospitalId, selectedPartnerId, 1, tplId),
      ]).finally(() => setLoading(false));
      setPage(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId, selectedPartnerId, activeTemplate, fetchStats, fetchResponses]);

  // Fetch templates when partner/hospital changes
  useEffect(() => {
    if (selectedPartnerId && selectedHospitalId) {
      fetchTemplates();
    }
  }, [selectedPartnerId, selectedHospitalId, fetchTemplates]);

  const handleFilter = () => {
    if (!selectedHospitalId || !selectedPartnerId) return;
    const tplId = activeTemplate?.id || null;
    setLoading(true);
    Promise.all([
      fetchStats(selectedHospitalId, selectedPartnerId, tplId),
      fetchResponses(selectedHospitalId, selectedPartnerId, 1, tplId),
    ]).finally(() => setLoading(false));
    setPage(1);
  };

  const handleResetFilter = () => {
    resetDates();
  };

  const handleExcelExport = () => {
    const sheets: { name: string; data: Record<string, any>[] }[] = [];

    // 1) 개별 응답 (전체 필드)
    if (responses.length) {
      sheets.push({
        name: '개별응답',
        data: responses.map(r => {
          const row: Record<string, any> = {
            응답일시: r.created_at,
            파트너ID: r.partner_id,
            병원ID: r.hospital_id,
            응답자UUID: r.respondent_uuid || '',
          };
          // 각 문항 점수
          ratingQuestions.forEach(q => {
            const val = r.answers ? r.answers[q.question_key] : (r as any)[q.question_key];
            row[q.question_label] = val ?? '';
          });
          // 텍스트 문항
          currentQuestions.filter(q => q.question_type === 'text').forEach(q => {
            row[q.question_label] = r.answers ? (r.answers[q.question_key] || '') : '';
          });
          row['자유의견'] = r.free_comment || '';
          return row;
        }),
      });
    }

    // 2) 문항별 평균
    if (stats?.averages) {
      sheets.push({
        name: '문항별평균',
        data: ratingQuestions.map(q => ({
          문항: q.question_label,
          평균: stats.averages[q.question_key]?.toFixed(2) ?? '',
        })),
      });
    }

    // 3) 일별 추이
    if (stats?.daily_trend?.length) {
      sheets.push({
        name: '일별추이',
        data: stats.daily_trend.map((d: any) => {
          const row: Record<string, any> = { 날짜: d.date, 응답수: d.count };
          ratingQuestions.forEach(q => { row[q.question_label] = d[q.question_key] ?? ''; });
          return row;
        }),
      });
    }

    // 4) 문항별 분포
    ratingQuestions.forEach(q => {
      const dist = questionDistMap[q.question_key];
      if (dist?.length) {
        sheets.push({
          name: `분포_${q.question_label}`.slice(0, 31),
          data: dist.map(d => ({ 응답: d.name, 건수: d.value })),
        });
      }
    });

    if (sheets.length === 0) return;
    downloadWorkbook(sheets, `만족도조사_${selectedHospitalName || 'all'}_${dateSuffix()}.xlsx`);
  };

  const handleJsonExport = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      hospital: selectedHospitalName || 'all',
      stats,
      responses,
      question_distribution: questionDistMap,
    };
    downloadJson(exportData, `만족도조사_${selectedHospitalName || 'all'}_${dateSuffix()}.json`);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    if (selectedHospitalId && selectedPartnerId) {
      fetchResponses(selectedHospitalId, selectedPartnerId, p, activeTemplate?.id || null);
    }
  };

  // Dynamic field labels: use stats.field_labels if available, otherwise default
  const dynamicLabels = useMemo(() => {
    if (stats?.field_labels && Object.keys(stats.field_labels).length > 0) return stats.field_labels;
    return FIELD_LABELS;
  }, [stats]);

  // Get current question configs (from active template or defaults)
  const currentQuestions = useMemo(() => {
    if (activeTemplate?.questions) return activeTemplate.questions;
    return DEFAULT_QUESTIONS;
  }, [activeTemplate]);

  // Rating questions only (for chart rendering)
  const ratingQuestions = useMemo(() => {
    return currentQuestions.filter(q => q.question_type === 'rating');
  }, [currentQuestions]);

  // 전반적 만족도 (별도 섹션용)
  const overallQuestion = useMemo(() => {
    return ratingQuestions.find(q => q.config?.section === 'overall' || q.question_key === 'overall_satisfaction') || null;
  }, [ratingQuestions]);

  // 세부 문항 (전반적 만족도 제외)
  const detailRatingQuestions = useMemo(() => {
    return ratingQuestions.filter(q => q.question_key !== (overallQuestion?.question_key));
  }, [ratingQuestions, overallQuestion]);

  // 만족도별 고정 색상 (디자인 토큰)
  const SATISFACTION_COLOR_MAP: Record<string, string> = {
    '매우불만족': SATISFACTION_VERY_LOW,
    '불만족': SATISFACTION_LOW,
    '보통': SATISFACTION_MID,
    '만족': SATISFACTION_HIGH,
    '매우만족': SATISFACTION_VERY_HIGH,
    '전혀 아니다': SATISFACTION_VERY_LOW,
    '아니다': SATISFACTION_LOW,
    '그렇다': SATISFACTION_HIGH,
    '매우 그렇다': SATISFACTION_VERY_HIGH,
  };

  // Per-question distribution data (for pie/bar)
  const questionDistMap = useMemo(() => {
    if (!responses || responses.length === 0) return {};
    const result: Record<string, { name: string; value: number }[]> = {};
    ratingQuestions.forEach(q => {
      const dist = [0, 0, 0, 0, 0];
      responses.forEach(r => {
        const s = r.answers ? Number(r.answers[q.question_key]) : (r as any)[q.question_key];
        if (s >= 1 && s <= 5) dist[s - 1]++;
      });
      result[q.question_key] = [
        { name: '매우불만족', value: dist[0] },
        { name: '불만족', value: dist[1] },
        { name: '보통', value: dist[2] },
        { name: '만족', value: dist[3] },
        { name: '매우만족', value: dist[4] },
      ];
    });
    return result;
  }, [responses, ratingQuestions]);

  const scoreClass = (score: number) => {
    if (score >= 4) return 'survey-page__score-cell--high';
    if (score >= 3) return 'survey-page__score-cell--mid';
    return 'survey-page__score-cell--low';
  };

  // daily_trend에서 오늘/어제 응답수 추출 (로컬 시간대 기준)
  const todayYesterdayCounts = useMemo(() => {
    if (!stats?.daily_trend || stats.daily_trend.length === 0) return { today: 0, yesterday: 0, diff: 0 };
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const ydDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterday = `${ydDate.getFullYear()}-${pad(ydDate.getMonth() + 1)}-${pad(ydDate.getDate())}`;
    const todayRow = stats.daily_trend.find((d: any) => d.date === today);
    const ydRow = stats.daily_trend.find((d: any) => d.date === yesterday);
    const t = todayRow?.count ?? 0;
    const y = ydRow?.count ?? 0;
    return { today: t, yesterday: y, diff: t - y };
  }, [stats]);

  // === 종합 대시보드 데이터 ===
  // 전반적 만족도 점수 (별도 표시용)
  const overallSatisfactionScore = useMemo(() => {
    if (!stats?.averages || !overallQuestion) return 0;
    return stats.averages[overallQuestion.question_key] ?? 0;
  }, [stats, overallQuestion]);

  // 세부 문항 평균 (전반적 만족도 제외)
  const detailAvg = useMemo(() => {
    if (!stats?.averages) return 0;
    const vals = detailRatingQuestions.map(q => stats.averages[q.question_key]).filter(v => v != null && !isNaN(v));
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [stats, detailRatingQuestions]);

  // 전체 평균 (보고서 등에서 사용)
  const overallAvg = useMemo(() => {
    if (!stats?.averages) return 0;
    const vals = ratingQuestions.map(q => stats.averages[q.question_key]).filter(v => v != null && !isNaN(v));
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [stats, ratingQuestions]);

  const rankedQuestions = useMemo(() => {
    if (!stats?.averages) return [];
    return [...detailRatingQuestions]
      .map(q => ({ ...q, avg: stats.averages[q.question_key] ?? 0 }))
      .sort((a, b) => b.avg - a.avg);
  }, [stats, detailRatingQuestions]);

  const radarData = useMemo(() => {
    if (!stats?.averages) return [];
    return detailRatingQuestions.map(q => ({
      field: q.question_label,
      score: stats.averages[q.question_key] ?? 0,
      fullMark: 5,
    }));
  }, [stats, detailRatingQuestions]);

  // === 보고서: 자유 의견 (최근 5건) ===
  const recentComments = useMemo(() => {
    return responses
      .filter(r => r.free_comment && r.free_comment.trim() !== '')
      .slice(0, 5)
      .map(r => ({ comment: r.free_comment, date: r.created_at }));
  }, [responses]);

  // === 보고서: 일별 추이 (전 문항 오버레이) ===
  const TREND_COLORS = TREND_PALETTE;

  const totalPages = Math.ceil(totalResponses / pageSize);

  return (
    <div className={`survey-page${isEmbedMode ? ' survey-page--embed' : ''}`}>
      <DemoBanner />

      <div className="survey-page__layout">
        {/* 인라인 병원 선택 (파트너오피스 모드) */}
        {!isEmbedMode && (
          <div className="survey-page__inline-selector">
            <SearchableSelect
              placeholder="병원 선택"
              value={selectedHospitalId || ''}
              options={hierarchy.flatMap(p => p.hospitals).map(h => ({
                value: h.hospital_id,
                label: h.hospital_name,
              }))}
              onChange={(hid) => {
                if (hid) {
                  for (const p of hierarchy) {
                    const found = p.hospitals.find(h => h.hospital_id === hid);
                    if (found) { setSelectedPartnerId(p.partner_id); break; }
                  }
                  setSelectedHospitalId(hid);
                }
              }}
            />
          </div>
        )}

        {/* Main */}
        <main className="survey-page__main">
          {!selectedHospitalId ? (
            <div className="survey-page__landing">
              {/* 날짜 네비게이션 */}
              <div className="date-nav">
                <button className="date-nav__btn" onClick={() => shiftLandingDate(-1)}>&lsaquo;</button>
                <span className="date-nav__label">{landingDate}</span>
                <button className="date-nav__btn" onClick={() => shiftLandingDate(1)} disabled={isLandingToday}>&rsaquo;</button>
                {!isLandingToday && (
                  <button className="date-nav__today" onClick={() => setLandingDate(new Date().toISOString().slice(0, 10))}>오늘</button>
                )}
              </div>

              {todaySummaryLoading ? (
                <Spinner message="설문 데이터를 불러오는 중..." />
              ) : todaySummary ? (
                <>
                  {/* KPI 카드 */}
                  <div className="landing-kpi-row">
                    <div className="landing-kpi-card">
                      <div className="landing-kpi-value">{todaySummary.summary.today_total}</div>
                      <div className="landing-kpi-label">{isLandingToday ? '오늘' : landingDate} 응답</div>
                    </div>
                    <div className="landing-kpi-card">
                      <div className="landing-kpi-value">{todaySummary.summary.today_avg_score.toFixed(1)}</div>
                      <div className="landing-kpi-label">평균 점수</div>
                    </div>
                    <div className="landing-kpi-card">
                      <div className="landing-kpi-value">{todaySummary.summary.active_hospitals}</div>
                      <div className="landing-kpi-label">응답 병원</div>
                    </div>
                    <div className="landing-kpi-card">
                      <div className="landing-kpi-value">{todaySummary.summary.total_hospitals}</div>
                      <div className="landing-kpi-label">전체 병원</div>
                    </div>
                  </div>

                  {/* 병원 카드 그리드 */}
                  <h3 className="landing-title">{isLandingToday ? '오늘' : landingDate} 응답이 있는 병원</h3>
                  {todaySummary.hospitals.length === 0 ? (
                    <div className="landing-empty">해당 날짜에 설문 응답이 없습니다.</div>
                  ) : (
                    <div className="landing-hospital-grid">
                      {todaySummary.hospitals.map(h => (
                        <div
                          key={h.hospital_id}
                          className="landing-hospital-card"
                          onClick={() => {
                            for (const p of hierarchy) {
                              const found = p.hospitals.find(hp => hp.hospital_id === h.hospital_id);
                              if (found) { setSelectedPartnerId(p.partner_id); break; }
                            }
                            setSelectedHospitalId(h.hospital_id);
                          }}
                        >
                          <div className="landing-hospital-card__name">{h.hospital_name || h.hospital_id}</div>
                          <div className="landing-hospital-card__stats">
                            <span className="landing-hospital-card__count">{h.today_count}건</span>
                            <span className={`landing-hospital-card__badge landing-hospital-card__badge--${h.avg_satisfaction >= 4 ? 'high' : h.avg_satisfaction >= 3 ? 'mid' : 'low'}`}>
                              {h.avg_satisfaction > 0 ? h.avg_satisfaction.toFixed(1) : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="landing-empty">
                  병원을 선택하면 설문 통계를 확인할 수 있습니다.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Hospital header card — 임베딩 페이지와 동일 구조 */}
              <div className="survey-page__card">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <h2 className="survey-page__card-title">{selectedHospitalName}</h2>
                    <p className="survey-page__muted" style={{marginTop: 4}}>만족도 조사 · 총 응답 {stats?.total_count ?? 0}건</p>
                  </div>
                  <ExportButtons onExcel={handleExcelExport} onJson={handleJsonExport} />
                </div>
              </div>

              {/* Content card — 탭 + 내용 */}
              <div className="survey-page__content-card">
              {/* Top tabs */}
              <div className="survey-page__top-tabs">
                <button
                  className={`survey-page__top-tab ${activeTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >통계</button>
                <button
                  className={`survey-page__top-tab ${activeTab === 'report' ? 'active' : ''}`}
                  onClick={() => setActiveTab('report')}
                >결과 보고서</button>
                <button
                  className={`survey-page__top-tab ${activeTab === 'templates' ? 'active' : ''}`}
                  onClick={() => setActiveTab('templates')}
                >템플릿 관리</button>
              </div>

              {/* Stats tab content */}
              {activeTab === 'stats' && (
                <>
                  {/* Date filter */}
                  <div className="survey-page__filters">
                    <div className="survey-page__date-presets">
                      <button className="survey-page__preset-btn" onClick={() => handleDatePreset(1)}>오늘</button>
                      <button className="survey-page__preset-btn" onClick={() => handleDatePreset(7)}>1주일</button>
                      <button className="survey-page__preset-btn" onClick={() => handleDatePreset(30)}>1개월</button>
                      <button className="survey-page__preset-btn" onClick={() => handleDatePreset(90)}>3개월</button>
                    </div>
                    <input type="date" className="survey-page__date-input" value={dateFrom} onChange={e => setDateRange(e.target.value, dateTo)} />
                    <span className="survey-page__filter-label">~</span>
                    <input type="date" className="survey-page__date-input" value={dateTo} onChange={e => setDateRange(dateFrom, e.target.value)} />
                    <button className="survey-page__filter-btn" onClick={handleFilter}>조회</button>
                    {(dateFrom || dateTo) && (
                      <button className="survey-page__filter-reset" onClick={handleResetFilter}>초기화</button>
                    )}
                  </div>

                  {/* Active template indicator */}
                  {activeTemplate && (
                    <div className="survey-page__active-template-info">
                      활성 템플릿: <strong>{activeTemplate.template_name}</strong>
                    </div>
                  )}

                  {/* 전반적 만족도 — 별도 섹션 */}
                  {overallQuestion && (
                    <div className="survey-page__overall-section">
                      <div className="survey-page__overall-left">
                        <span className="survey-page__overall-title">전반적 만족도</span>
                        <div className="survey-page__overall-score-row">
                          <span className="survey-page__overall-score">{overallSatisfactionScore.toFixed(1)}</span>
                          <span className="survey-page__overall-max">/ 5.0</span>
                          <div className="survey-page__overall-stars">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className={`survey-page__report-star ${n <= Math.round(overallSatisfactionScore) ? 'filled' : ''}`}>&#9733;</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="survey-page__overall-right">
                        <div className="survey-page__overall-stat">
                          <span className="survey-page__overall-stat-num">{stats?.total_count ?? 0}</span>
                          <span className="survey-page__overall-stat-label">총 응답</span>
                        </div>
                        {todayYesterdayCounts.today > 0 && (
                          <div className="survey-page__overall-stat">
                            <span className="survey-page__overall-stat-num">
                              {todayYesterdayCounts.today}
                              {todayYesterdayCounts.diff !== 0 && (
                                <span className={`survey-page__stat-badge ${todayYesterdayCounts.diff > 0 ? 'survey-page__stat-badge--up' : 'survey-page__stat-badge--down'}`}>
                                  {todayYesterdayCounts.diff > 0 ? `+${todayYesterdayCounts.diff}` : todayYesterdayCounts.diff}
                                </span>
                              )}
                            </span>
                            <span className="survey-page__overall-stat-label">오늘</span>
                          </div>
                        )}
                        <div className="survey-page__overall-stat">
                          <span className="survey-page__overall-stat-num">{detailAvg.toFixed(1)}</span>
                          <span className="survey-page__overall-stat-label">세부 평균</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 세부 항목 대시보드 */}
                  <div className="survey-page__dashboard">
                    <div className="survey-page__dashboard-header">
                      <div className="survey-page__dashboard-overall">
                        <span className="survey-page__dashboard-overall-label">세부 항목 분석</span>
                      </div>
                      <div className="survey-page__dashboard-meta">
                        <span>세부 평균 <strong>{detailAvg.toFixed(1)}</strong> / 5.0</span>
                      </div>
                    </div>

                    <div className="survey-page__dashboard-body">
                      {/* 좌측: 레이더 차트 */}
                      <div className="survey-page__dashboard-radar">
                        {radarData.length > 0 && (stats?.total_count ?? 0) > 0 ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                              <PolarGrid stroke={GRAY_300} />
                              <PolarAngleAxis dataKey="field" tick={{ fontSize: 11, fill: GRAY_700 }} />
                              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                              <Radar name="평균" dataKey="score" stroke={BRAND_BROWN} fill={BRAND_BROWN} fillOpacity={0.25} strokeWidth={2} />
                            </RadarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="survey-page__dashboard-empty">데이터 없음</div>
                        )}
                      </div>

                      {/* 우측: 문항별 순위 + 바 게이지 */}
                      <div className="survey-page__rank-list">
                        <h4 className="survey-page__rank-list-title">문항별 평균 순위</h4>
                        {rankedQuestions.length > 0 ? rankedQuestions.map((q, idx) => (
                          <div key={q.question_key} className="survey-page__rank-item">
                            <span className="survey-page__rank-num">{idx + 1}</span>
                            <span className="survey-page__rank-label">{q.question_label}</span>
                            <div className="survey-page__rank-bar-wrap">
                              <div
                                className="survey-page__rank-bar"
                                style={{ width: `${(q.avg / 5) * 100}%` }}
                              />
                            </div>
                            <span className="survey-page__rank-score">{q.avg.toFixed(1)}</span>
                          </div>
                        )) : (
                          <div className="survey-page__dashboard-empty">데이터 없음</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Charts — per question, each with its own chart type selector */}
                  {stats && stats.total_count > 0 && (
                    <div className="survey-page__charts">
                      {ratingQuestions.map(q => {
                        const ct = getChartType(q);
                        const avg = stats.averages[q.question_key] ?? 0;
                        const dist = questionDistMap[q.question_key] || [];
                        const distFiltered = dist.filter(d => d.value > 0);

                        return (
                          <div key={q.question_key} className="survey-page__chart-card">
                            <div className="survey-page__chart-card-header">
                              <h3 className="survey-page__chart-title">{q.question_label} <span className="survey-page__chart-count">({dist.reduce((a, d) => a + d.value, 0)}건)</span></h3>
                              <select
                                className="survey-page__chart-type-select"
                                value={ct}
                                onChange={e => setChartTypePerQ(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                              >
                                <option value="bar">막대</option>
                                <option value="pie">파이</option>
                                <option value="radar">레이더</option>
                                <option value="line">일별 추이</option>
                              </select>
                            </div>

                            {ct === 'bar' && (
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={distFiltered}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Bar dataKey="value" name="응답수">
                                    {distFiltered.map((entry, idx) => (
                                      <Cell key={idx} fill={SATISFACTION_COLOR_MAP[entry.name] || BRAND_BROWN} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}

                            {ct === 'pie' && distFiltered.length > 0 && (
                              <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                  <Pie
                                    data={distFiltered}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={70}
                                    dataKey="value"
                                    label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}
                                    labelLine={{ strokeWidth: 1 }}
                                    style={{ fontSize: 10 }}
                                  >
                                    {distFiltered.map((entry, idx) => (
                                      <Cell key={idx} fill={SATISFACTION_COLOR_MAP[entry.name] || BRAND_BROWN} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}

                            {ct === 'radar' && (
                              <ResponsiveContainer width="100%" height={220}>
                                <RadarChart data={[{ field: q.question_label, score: avg, fullMark: 5 }]}>
                                  <PolarGrid />
                                  <PolarAngleAxis dataKey="field" tick={{ fontSize: 11 }} />
                                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                                  <Radar name="평균" dataKey="score" stroke={BRAND_BROWN} fill={BRAND_BROWN} fillOpacity={0.3} />
                                </RadarChart>
                              </ResponsiveContainer>
                            )}

                            {ct === 'line' && stats.daily_trend.length > 1 && (
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={stats.daily_trend}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Line
                                    type="monotone"
                                    dataKey={q.question_key}
                                    name={q.question_label}
                                    stroke={BRAND_BROWN}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            )}

                            <div className="survey-page__chart-avg">평균 {avg.toFixed(1)} / 5.0</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Responses table */}
                  <div className="survey-page__table-card">
                    <div className="survey-page__table-header">
                      <h3 className="survey-page__chart-title" style={{ margin: 0 }}>개별 응답 ({totalResponses}건)</h3>
                    </div>
                    <div className="survey-page__table-wrapper">
                      <table className="survey-page__table">
                        <thead>
                          <tr>
                            <th>날짜</th>
                            {Object.values(dynamicLabels).map((label, i) => (
                              <th key={i}>{label}</th>
                            ))}
                            <th>의견</th>
                          </tr>
                        </thead>
                        <tbody>
                          {responses.length === 0 ? (
                            <tr><td colSpan={Object.keys(dynamicLabels).length + 2} style={{ textAlign: 'center', color: GRAY_300, padding: 32 }}>설문 응답이 없습니다.</td></tr>
                          ) : responses.map(r => (
                            <tr
                              key={r.id}
                              className={!isEmbedMode ? 'survey-page__row-clickable' : ''}
                              onClick={() => { if (!isEmbedMode) setDetailModal(r); }}
                            >
                              <td>{new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                              {Object.keys(dynamicLabels).map((key, i) => {
                                const val = r.answers ? r.answers[key] : (r as any)[key];
                                const numVal = Number(val);
                                return (
                                  <td key={i}>
                                    {typeof val === 'number' || (typeof val === 'string' && !isNaN(numVal) && val !== '') ? (
                                      <span className={`survey-page__score-cell ${scoreClass(numVal)}`}>{numVal}</span>
                                    ) : (
                                      <span>{val != null ? String(val) : '-'}</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td>
                                {r.free_comment ? (
                                  <span className="survey-page__comment-cell" onClick={e => { e.stopPropagation(); setCommentModal(r.free_comment); }} title={r.free_comment}>
                                    {r.free_comment}
                                  </span>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="survey-page__pagination">
                        <button className="survey-page__page-btn" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>이전</button>
                        {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                          const startPage = Math.max(1, Math.min(page - 4, totalPages - 9));
                          const p = startPage + i;
                          if (p > totalPages) return null;
                          return (
                            <button
                              key={p}
                              className={`survey-page__page-btn ${p === page ? 'active' : ''}`}
                              onClick={() => handlePageChange(p)}
                            >{p}</button>
                          );
                        })}
                        <button className="survey-page__page-btn" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>다음</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 결과 보고서 tab */}
              {activeTab === 'report' && (
                <div className="survey-page__report">
                  {/* 템플릿 선택 */}
                  <div className="survey-page__report-toolbar">
                    <label className="survey-page__report-tpl-label">템플릿 선택:</label>
                    <select
                      className="survey-page__report-tpl-select"
                      value={activeTemplate?.id ?? 'default'}
                      onChange={e => {
                        if (e.target.value === 'default') {
                          setActiveTemplate(null);
                        } else {
                          const tpl = templates.find(t => t.id === Number(e.target.value));
                          if (tpl) setActiveTemplate(tpl);
                        }
                      }}
                    >
                      <option value="default">기본 만족도 설문</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.template_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 보고서 헤더 */}
                  <div className="survey-page__report-header">
                    <h3>{activeTemplate?.template_name ?? '기본 만족도 설문'} 결과 보고서</h3>
                    <p className="survey-page__report-period">
                      {dateFrom && dateTo ? `${dateFrom} ~ ${dateTo}` : '전체 기간'}
                      {' | '}총 <strong>{stats?.total_count ?? 0}</strong>건
                    </p>
                  </div>

                  {(stats?.total_count ?? 0) === 0 ? (
                    <div className="survey-page__report-empty">
                      <p>해당 기간의 응답 데이터가 없습니다.</p>
                    </div>
                  ) : (
                    <>
                      {/* 전반적 만족도 + 문항별 바 */}
                      <div className="survey-page__report-scores">
                        <div className="survey-page__report-score-card">
                          <div className="survey-page__report-score-value">{overallSatisfactionScore.toFixed(1)}<span>/5.0</span></div>
                          <div className="survey-page__report-stars">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className={`survey-page__report-star ${n <= Math.round(overallSatisfactionScore) ? 'filled' : ''}`}>&#9733;</span>
                            ))}
                          </div>
                          <div className="survey-page__report-score-label">전반적 만족도</div>
                        </div>

                        <div className="survey-page__report-bars">
                          <h4>문항별 점수</h4>
                          {rankedQuestions.map(q => (
                            <div key={q.question_key} className="survey-page__report-bar-row">
                              <span className="survey-page__report-bar-label">{q.question_label}</span>
                              <div className="survey-page__report-bar-track">
                                <div
                                  className="survey-page__report-bar-fill"
                                  style={{ width: `${(q.avg / 5) * 100}%` }}
                                />
                              </div>
                              <span className="survey-page__report-bar-value">{q.avg.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 일별 추이 라인차트 (전 문항 오버레이) */}
                      {stats?.daily_trend && stats.daily_trend.length > 1 && (
                        <div className="survey-page__report-trend">
                          <h4>일별 추이</h4>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={stats.daily_trend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              {ratingQuestions.map((q, i) => (
                                <Line
                                  key={q.question_key}
                                  type="monotone"
                                  dataKey={q.question_key}
                                  name={q.question_label}
                                  stroke={TREND_COLORS[i % TREND_COLORS.length]}
                                  strokeWidth={2}
                                  dot={{ r: 2 }}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* 주요 의견 */}
                      <div className="survey-page__report-comments">
                        <h4>주요 의견</h4>
                        {recentComments.length > 0 ? (
                          <ul className="survey-page__report-comment-list">
                            {recentComments.map((c, i) => (
                              <li key={i} className="survey-page__report-comment-item">
                                <span className="survey-page__report-comment-text">"{c.comment}"</span>
                                <span className="survey-page__report-comment-date">
                                  {new Date(c.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="survey-page__report-no-comments">자유 의견이 없습니다.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Templates tab content */}
              {activeTab === 'templates' && (
                <>
                  {(isCreatingTemplate || editingTemplate) ? (
                    <div className="survey-page__template-editor">
                      <h3>{editingTemplate ? '템플릿 수정' : '새 템플릿 만들기'}</h3>

                      <div className="survey-page__form-group">
                        <label>템플릿명</label>
                        <input
                          type="text"
                          value={templateForm.template_name}
                          onChange={e => setTemplateForm(prev => ({ ...prev, template_name: e.target.value }))}
                          placeholder="예: 커스텀 만족도 설문"
                        />
                      </div>

                      <div className="survey-page__form-group">
                        <label>설명</label>
                        <textarea
                          value={templateForm.description}
                          onChange={e => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="템플릿 설명 (선택사항)"
                          rows={2}
                        />
                      </div>

                      <div className="survey-page__questions-section">
                        <div className="survey-page__questions-header">
                          <h4>질문 목록</h4>
                          <button className="survey-page__btn-secondary" onClick={addQuestion}>+ 질문 추가</button>
                        </div>

                        {templateForm.questions.map((q, index) => (
                          <div key={index} className="survey-page__question-item">
                            <div className="survey-page__question-order">
                              <button disabled={index === 0} onClick={() => moveQuestion(index, 'up')}>&#9650;</button>
                              <span>{index + 1}</span>
                              <button disabled={index === templateForm.questions.length - 1} onClick={() => moveQuestion(index, 'down')}>&#9660;</button>
                            </div>

                            <div className="survey-page__question-fields">
                              <input
                                type="text"
                                value={q.question_label}
                                onChange={e => updateQuestion(index, { question_label: e.target.value })}
                                placeholder="질문 내용"
                                className="survey-page__question-label-input"
                              />

                              <div className="survey-page__question-meta">
                                <select
                                  value={q.question_type}
                                  onChange={e => {
                                    const type = e.target.value as SurveyQuestion['question_type'];
                                    const updates: Partial<SurveyQuestion> = { question_type: type };
                                    if (type === 'single_choice' || type === 'multiple_choice') {
                                      updates.options = q.options || ['옵션 1', '옵션 2'];
                                      updates.config = {};
                                    } else if (type === 'rating') {
                                      updates.options = null;
                                      updates.config = { min: 1, max: 5, labels: [...RATING_LABELS], chart_type: 'bar' };
                                    } else {
                                      updates.options = null;
                                      updates.config = {};
                                    }
                                    updateQuestion(index, updates);
                                  }}
                                >
                                  <option value="rating">만족도 척도</option>
                                  <option value="text">텍스트</option>
                                  <option value="single_choice">단일 선택</option>
                                  <option value="multiple_choice">복수 선택</option>
                                </select>

                                <label className="survey-page__question-required">
                                  <input
                                    type="checkbox"
                                    checked={q.is_required}
                                    onChange={e => updateQuestion(index, { is_required: e.target.checked })}
                                  />
                                  필수
                                </label>

                                {q.question_type === 'rating' && (
                                  <select
                                    value={q.config?.chart_type || 'bar'}
                                    onChange={e => updateQuestion(index, { config: { ...q.config, chart_type: e.target.value } })}
                                    className="survey-page__chart-type-select"
                                  >
                                    <option value="bar">막대 차트</option>
                                    <option value="pie">파이 차트</option>
                                    <option value="radar">레이더 차트</option>
                                    <option value="none">차트 없음</option>
                                  </select>
                                )}
                              </div>

                              {/* Rating labels editor */}
                              {q.question_type === 'rating' && (
                                <div className="survey-page__question-options">
                                  <span className="survey-page__option-label">척도 라벨 (1점~5점):</span>
                                  {(q.config?.labels || RATING_LABELS).map((lbl: string, li: number) => (
                                    <div key={li} className="survey-page__option-item">
                                      <span className="survey-page__option-num">{li + 1}.</span>
                                      <input
                                        type="text"
                                        value={lbl}
                                        onChange={e => {
                                          const newLabels = [...(q.config?.labels || RATING_LABELS)];
                                          newLabels[li] = e.target.value;
                                          updateQuestion(index, { config: { ...q.config, labels: newLabels } });
                                        }}
                                        placeholder={RATING_LABELS[li]}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Options editor for choice types */}
                              {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
                                <div className="survey-page__question-options">
                                  {(q.options || []).map((opt, oi) => (
                                    <div key={oi} className="survey-page__option-item">
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => {
                                          const newOptions = [...(q.options || [])];
                                          newOptions[oi] = e.target.value;
                                          updateQuestion(index, { options: newOptions });
                                        }}
                                        placeholder={`옵션 ${oi + 1}`}
                                      />
                                      <button onClick={() => {
                                        const newOptions = (q.options || []).filter((_, i) => i !== oi);
                                        updateQuestion(index, { options: newOptions });
                                      }}>&#215;</button>
                                    </div>
                                  ))}
                                  <button
                                    className="survey-page__btn-add-option"
                                    onClick={() => updateQuestion(index, { options: [...(q.options || []), ''] })}
                                  >
                                    + 옵션 추가
                                  </button>
                                </div>
                              )}
                            </div>

                            <button className="survey-page__question-delete" onClick={() => removeQuestion(index)}>&#128465;</button>
                          </div>
                        ))}
                      </div>

                      <div className="survey-page__editor-actions">
                        <button className="survey-page__btn-primary" onClick={saveTemplate}>
                          {editingTemplate ? '수정 저장' : '템플릿 생성'}
                        </button>
                        <button className="survey-page__btn-cancel" onClick={cancelEdit}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="survey-page__template-section">
                      <div className="survey-page__template-header">
                        <h3>설문 템플릿</h3>
                        <button className="survey-page__btn-primary" onClick={startCreateTemplate}>
                          + 새 템플릿
                        </button>
                      </div>
                        <table className="survey-page__table">
                          <thead>
                            <tr>
                              <th>템플릿명</th>
                              <th>질문 수</th>
                              <th>상태</th>
                              <th>생성일</th>
                              <th>관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* 기본 설문 행 — 항상 표시 */}
                            <tr className="survey-page__default-row">
                              <td>기본 만족도 설문</td>
                              <td>5</td>
                              <td>
                                <span className={!activeTemplate ? 'badge-active' : 'badge-inactive'}>
                                  {!activeTemplate ? '활성 (기본)' : '비활성'}
                                </span>
                              </td>
                              <td>-</td>
                              <td className="survey-page__actions">
                                <button onClick={startEditDefault}>복사 편집</button>
                              </td>
                            </tr>
                            {/* 커스텀 템플릿 행들 */}
                            {templates.map(t => (
                              <tr key={t.id}>
                                <td>{t.template_name}</td>
                                <td>{t.question_count ?? 0}</td>
                                <td>
                                  <span className={t.is_active ? 'badge-active' : 'badge-inactive'}>
                                    {t.is_active ? '활성' : '비활성'}
                                  </span>
                                </td>
                                <td>{new Date(t.created_at).toLocaleDateString('ko-KR')}</td>
                                <td className="survey-page__actions">
                                  <button onClick={() => startEditTemplate(t)}>편집</button>
                                  <button onClick={() => toggleTemplateActive(t.id)}>
                                    {t.is_active ? '비활성화' : '활성화'}
                                  </button>
                                  <button onClick={() => deleteTemplate(t.id)}>삭제</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    </div>
                  )}
                </>
              )}
              </div>{/* end content-card */}
            </>
          )}
        </main>
      </div>

      {/* Response detail modal (non-embed only) */}
      {detailModal !== null && !isEmbedMode && (
        <div className="survey-page__comment-modal" onClick={() => setDetailModal(null)}>
          <div className="survey-page__detail-modal-content" onClick={e => e.stopPropagation()}>
            <h3>응답 상세</h3>
            <div className="survey-page__detail-grid">
              <div className="survey-page__detail-row">
                <span className="survey-page__detail-label">응답일시</span>
                <span className="survey-page__detail-value">
                  {new Date(detailModal.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {detailModal.respondent_uuid && (
                <div className="survey-page__detail-row">
                  <span className="survey-page__detail-label">응답자 ID</span>
                  <span className="survey-page__detail-value">{detailModal.respondent_uuid}</span>
                </div>
              )}
              {/* answers에 개인정보 필드가 있으면 표시 */}
              {detailModal.answers && (() => {
                const personalKeys: Record<string, string> = {
                  respondent_name: '이름', name: '이름',
                  phone: '전화번호', phone_number: '전화번호', tel: '전화번호',
                  exam_date: '검진 날짜', checkup_date: '검진 날짜', visit_date: '방문 날짜',
                  email: '이메일',
                  birth_date: '생년월일', birthday: '생년월일',
                  age: '나이',
                  gender: '성별',
                };
                const found = Object.entries(detailModal.answers).filter(
                  ([k, v]) => personalKeys[k] && v != null && v !== ''
                );
                return found.length > 0 ? found.map(([k, v]) => (
                  <div key={k} className="survey-page__detail-row">
                    <span className="survey-page__detail-label">{personalKeys[k]}</span>
                    <span className="survey-page__detail-value">{String(v)}</span>
                  </div>
                )) : null;
              })()}

              {/* 문항별 점수 */}
              <div className="survey-page__detail-divider" />
              {ratingQuestions.map(q => {
                const val = detailModal.answers ? detailModal.answers[q.question_key] : (detailModal as any)[q.question_key];
                const numVal = Number(val);
                return (
                  <div key={q.question_key} className="survey-page__detail-row">
                    <span className="survey-page__detail-label">{q.question_label}</span>
                    <span className="survey-page__detail-value">
                      {!isNaN(numVal) && val != null ? (
                        <span className={`survey-page__score-cell ${scoreClass(numVal)}`}>{numVal} / 5</span>
                      ) : '-'}
                    </span>
                  </div>
                );
              })}

              {/* 자유 의견 */}
              {detailModal.free_comment && (
                <>
                  <div className="survey-page__detail-divider" />
                  <div className="survey-page__detail-row survey-page__detail-row--full">
                    <span className="survey-page__detail-label">자유 의견</span>
                    <p className="survey-page__detail-comment">{detailModal.free_comment}</p>
                  </div>
                </>
              )}
            </div>
            <button className="survey-page__comment-modal-close" onClick={() => setDetailModal(null)}>닫기</button>
          </div>
        </div>
      )}

      {/* Comment modal */}
      {commentModal !== null && (
        <div className="survey-page__comment-modal" onClick={() => setCommentModal(null)}>
          <div className="survey-page__comment-modal-content" onClick={e => e.stopPropagation()}>
            <h3>자유 의견</h3>
            <p>{commentModal}</p>
            <button className="survey-page__comment-modal-close" onClick={() => setCommentModal(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyPage;
