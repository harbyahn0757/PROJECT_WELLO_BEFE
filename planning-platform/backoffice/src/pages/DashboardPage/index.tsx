import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { downloadWorkbook, downloadJson, dateSuffix } from '../../utils/excelExport';
import { ExportButtons } from '../../components/ExportButtons';
import {
  PIE_PALETTE as PIE_COLORS,
  BRAND_BROWN as COLOR_BROWN,
  ACCENT_ORANGE_CALM as COLOR_ORANGE,
  BRAND_BROWN_DARKER as COLOR_DARK_BROWN,
  ACCENT_ORANGE_DARK as COLOR_WARM_ORANGE,
  BEIGE_400 as COLOR_BEIGE,
  CHART_BLUE as COLOR_BLUE_ACCENT,
  SUCCESS as COLOR_GREEN,
} from '../../styles/colorTokens';
import { formatDateOnly } from '../../utils/dateFormat';
import { Spinner } from '../../components/Spinner';
import './styles.scss';

const API = getApiBase();

interface Partner { partner_id: string; partner_name: string; }
interface Hospital { hospital_id: string; hospital_name: string; partner_id: string; }

const DATE_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

const fmt = formatDateOnly;

/* 파이 차트 반응형 라벨: 텍스트가 영역 밖으로 나가지 않도록 축약 */
const renderPieLabel = ({ name, percent, cx, outerRadius, midAngle, x, y }: any) => {
  const pct = `${(percent * 100).toFixed(0)}%`;
  // 라벨 영역이 좁으면 퍼센트만 표시
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const lx = cx + radius * Math.cos(-midAngle * RADIAN);
  const anchor = lx > cx ? 'start' : 'end';
  const displayName = name.length > 6 ? name.slice(0, 5) + '…' : name;
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" style={{ fontSize: 11 }}>
      {displayName} {pct}
    </text>
  );
};

const DashboardPage: React.FC = () => {
  useAuth(); // ensure authenticated
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [allHospitals, setAllHospitals] = useState<Hospital[]>([]);
  const [hospitalId, setHospitalId] = useState('');
  const [presetIdx, setPresetIdx] = useState(2); // 30일 default

  const [summary, setSummary] = useState<any>(null);
  const [riskDist, setRiskDist] = useState<any[]>([]);
  const [interestTags, setInterestTags] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [intentDist, setIntentDist] = useState<any[]>([]);
  const [sentimentDist, setSentimentDist] = useState<any[]>([]);
  const [nutritionDist, setNutritionDist] = useState<any[]>([]);

  const [journey, setJourney] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 병원 목록 + 파트너 목록
  useEffect(() => {
    fetchWithAuth(`${API}/partner-office/hospitals`)
      .then(r => r.json())
      .then(d => {
        const h = d.hospitals || [];
        setAllHospitals(h);
        setHospitals(h);
        // 파트너 목록 추출 (중복 제거)
        const pMap = new Map<string, string>();
        h.forEach((row: any) => { if (row.partner_id) pMap.set(row.partner_id, row.partner_name || row.partner_id); });
        setPartners(Array.from(pMap.entries()).map(([id, name]) => ({ partner_id: id, partner_name: name })));
      })
      .catch(() => {});
  }, []);

  // 파트너 선택 시 병원 필터
  useEffect(() => {
    if (partnerId) {
      setHospitals(allHospitals.filter(h => h.partner_id === partnerId));
    } else {
      setHospitals(allHospitals);
    }
    setHospitalId('');
  }, [partnerId, allHospitals]);

  // 대시보드 통계
  const loadStats = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const preset = DATE_PRESETS[presetIdx];
    const dateTo = fmt(now);
    const dateFrom = preset.days === 0
      ? dateTo
      : fmt(new Date(now.getTime() - preset.days * 86400000));

    // 3개 API 병렬 호출
    const statsP = fetchWithAuth(`${API}/partner-office/dashboard/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: partnerId || null, hospital_id: hospitalId || null, date_from: dateFrom, date_to: dateTo }),
    }).then(r => r.json()).catch(() => null);

    const overviewP = fetchWithAuth(`${API}/partner-office/dashboard/overview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
    }).then(r => r.json()).catch(() => null);

    const qs = new URLSearchParams();
    if (hospitalId) qs.set('hospital_id', hospitalId);
    qs.set('date_from', dateFrom);
    qs.set('date_to', dateTo);
    const journeyP = fetchWithAuth(`${API}/partner-office/journey/stats?${qs}`)
      .then(r => r.json()).catch(() => null);

    const [statsData, overviewData, journeyData] = await Promise.all([statsP, overviewP, journeyP]);

    if (statsData) {
      setSummary(statsData.summary);
      setRiskDist(statsData.risk_distribution || []);
      setInterestTags(statsData.interest_tags || []);
      setDailyTrend(statsData.daily_trend || []);
      setIntentDist(statsData.intent_distribution || []);
      setSentimentDist(statsData.sentiment_distribution || []);
      setNutritionDist(statsData.nutrition_distribution || []);
    }

    setOverview(overviewData);
    setJourney(journeyData);
    setLoading(false);
  }, [partnerId, hospitalId, presetIdx]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExcelExport = () => {
    const sheets: { name: string; data: Record<string, any>[] }[] = [];

    // 1) 퍼널 일별 추이
    if (overview?.daily) {
      sheets.push({
        name: '퍼널_일별추이',
        data: overview.daily.map((d: any) => ({
          날짜: d.date, 유입_유저: d.users, 이벤트: d.events, 상담: d.chats, 서베이: d.surveys,
        })),
      });
      sheets.push({
        name: '퍼널_요약',
        data: [{
          총유입: overview.total_users, 총이벤트: overview.total_events,
          총상담: overview.total_chats, 총서베이: overview.total_surveys,
          상담전환율: overview.chat_rate, 서베이전환율: overview.survey_rate,
        }],
      });
    }

    // 2) 상담 태깅 분석
    if (dailyTrend.length) sheets.push({ name: '상담_일별추이', data: dailyTrend.map(d => ({ 날짜: d.date, 건수: d.count })) });
    if (riskDist.length) sheets.push({ name: '위험도_분포', data: riskDist.map(d => ({ 위험도: d.name, 건수: d.value })) });
    if (interestTags.length) sheets.push({ name: '관심사_TOP', data: interestTags.map(d => ({ 관심사: d.name, 건수: d.value })) });
    if (sentimentDist.length) sheets.push({ name: '감정_분포', data: sentimentDist.map(d => ({ 감정: d.name, 건수: d.value })) });
    if (intentDist.length) sheets.push({ name: '행동의향_분포', data: intentDist.map(d => ({ 의향: d.name, 건수: d.value })) });
    if (nutritionDist.length) sheets.push({ name: '영양_관심태그', data: nutritionDist.map(d => ({ 태그: d.name, 건수: d.value })) });

    // 3) 여정 분석
    if (journey) {
      if (journey.daily_visits?.length) sheets.push({ name: '여정_일별방문', data: journey.daily_visits.map((d: any) => ({ 날짜: d.date, 이벤트수: d.count })) });
      if (journey.device_distribution?.length) sheets.push({ name: '디바이스_분포', data: journey.device_distribution });
      if (journey.action_distribution?.length) sheets.push({ name: '액션_유형', data: journey.action_distribution });
      if (journey.top_hospitals?.length) sheets.push({ name: '병원별_활동TOP', data: journey.top_hospitals });
      if (journey.os_distribution?.length) sheets.push({ name: 'OS_분포', data: journey.os_distribution });
    }

    if (sheets.length === 0) return;
    downloadWorkbook(sheets, `대시보드_${dateSuffix()}.xlsx`);
  };

  const handleJsonExport = async () => {
    const now = new Date();
    const preset = DATE_PRESETS[presetIdx];
    const dateTo = fmt(now);
    const dateFrom = preset.days === 0 ? dateTo : fmt(new Date(now.getTime() - preset.days * 86400000));
    try {
      const resp = await fetchWithAuth(`${API}/partner-office/export/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospital_id: hospitalId || null, date_from: dateFrom, date_to: dateTo }),
      });
      const data = await resp.json();
      downloadJson(data, `welno_전체데이터_${dateSuffix()}.json`);
    } catch (err) { console.error('JSON export failed:', err); }
  };

  const fmtNum = (n: any) => n != null ? Number(n).toLocaleString() : '-';
  const fmtDwell = (sec: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="dashboard-page">
      {/* 필터 바 */}
      <div className="dashboard-page__filters">
        <select
          className="dashboard-page__select"
          value={partnerId}
          onChange={e => setPartnerId(e.target.value)}
        >
          <option value="">전체 파트너</option>
          {partners.map(p => (
            <option key={p.partner_id} value={p.partner_id}>{p.partner_name}</option>
          ))}
        </select>
        <select
          className="dashboard-page__select"
          value={hospitalId}
          onChange={e => setHospitalId(e.target.value)}
        >
          <option value="">전체 병원</option>
          {hospitals.map(h => (
            <option key={h.hospital_id} value={h.hospital_id}>{h.hospital_name}</option>
          ))}
        </select>
        <div className="dashboard-page__presets">
          {DATE_PRESETS.map((p, i) => (
            <button
              key={i}
              className={`dashboard-page__preset${presetIdx === i ? ' active' : ''}`}
              onClick={() => setPresetIdx(i)}
            >{p.label}</button>
          ))}
        </div>
        <ExportButtons onExcel={handleExcelExport} onJson={handleJsonExport} disabled={loading} />
      </div>

      {loading && !summary && <Spinner message="대시보드 로딩 중..." />}

      {/* ── 유입 퍼널 ── */}
      {overview && (() => {
        const users = Number(overview.total_users) || 0;
        const events = Number(overview.total_events) || 0;
        const chats = Number(overview.total_chats) || 0;
        const surveys = Number(overview.total_surveys) || 0;
        const eventRate = users ? ((events / users) * 100).toFixed(1) : '0';
        const chatRate = events ? ((chats / events) * 100).toFixed(1) : '0';
        const surveyRate = chats ? ((surveys / chats) * 100).toFixed(1) : '0';
        return (<>
          <div className="dashboard-page__funnel-cards">
            <div className="dashboard-page__funnel-card">
              <div className="dashboard-page__funnel-label">총 유입</div>
              <div className="dashboard-page__funnel-value">{fmtNum(users)}명</div>
            </div>
            <div className="dashboard-page__funnel-card">
              <div className="dashboard-page__funnel-label">총 이벤트</div>
              <div className="dashboard-page__funnel-value">{fmtNum(events)}건</div>
              <div className="dashboard-page__funnel-rate">전환 {eventRate}%</div>
              <div className="dashboard-page__funnel-base">유입 대비</div>
            </div>
            <div className="dashboard-page__funnel-card">
              <div className="dashboard-page__funnel-label">상담</div>
              <div className="dashboard-page__funnel-value">{fmtNum(chats)}건</div>
              <div className="dashboard-page__funnel-rate">전환 {chatRate}%</div>
              <div className="dashboard-page__funnel-base">이벤트 대비</div>
            </div>
            <div className="dashboard-page__funnel-card">
              <div className="dashboard-page__funnel-label">서베이</div>
              <div className="dashboard-page__funnel-value">{fmtNum(surveys)}건</div>
              <div className="dashboard-page__funnel-rate">전환 {surveyRate}%</div>
              <div className="dashboard-page__funnel-base">상담 대비</div>
            </div>
          </div>

          <div className="dashboard-page__chart dashboard-page__chart--full">
            <h3 className="dashboard-page__chart-title">일별 유입 · 상담 · 서베이 추이</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={overview.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="users" name="유입" stroke={COLOR_ORANGE} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="chats" name="상담" stroke={COLOR_BLUE_ACCENT} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="surveys" name="서베이" stroke={COLOR_GREEN} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-page__section-divider">상담 분석</div>
        </>);
      })()}

      {/* 요약 카드 */}
      <div className="dashboard-page__cards">
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">총 상담</div>
          <div className="dashboard-page__card-value">{fmtNum(summary?.total_chats)}</div>
        </div>
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">오늘 상담</div>
          <div className="dashboard-page__card-value">{fmtNum(summary?.today_chats)}</div>
        </div>
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">오늘 서베이</div>
          <div className="dashboard-page__card-value">{fmtNum(summary?.today_surveys)}</div>
        </div>
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">고위험</div>
          <div className="dashboard-page__card-value dashboard-page__card-value--danger">{fmtNum(summary?.high_risk_count)}</div>
        </div>
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">평균 참여도</div>
          <div className="dashboard-page__card-value">{summary?.avg_engagement ?? '-'}</div>
        </div>
      </div>

      {/* 차트 그리드 */}
      <div className="dashboard-page__grid">
        {/* 일별 상담 추이 */}
        <div className="dashboard-page__chart dashboard-page__chart--wide">
          <h3 className="dashboard-page__chart-title">일별 상담 추이</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={COLOR_ORANGE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 위험도 분포 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">위험도 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={renderPieLabel}>
                {riskDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 관심사 TOP 10 */}
        <div className="dashboard-page__chart dashboard-page__chart--wide">
          <h3 className="dashboard-page__chart-title">관심사 TOP 10</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={interestTags} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLOR_BROWN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 감정 분포 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">감정 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sentimentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={renderPieLabel}>
                {sentimentDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 행동의향 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">행동의향 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={intentDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLOR_DARK_BROWN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 영양 관심 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">영양 관심 태그</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={nutritionDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLOR_WARM_ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 사용자 여정 분석 (ES 데이터) ── */}
      <div className="dashboard-page__section-divider">사용자 여정 분석</div>

      {journey?.warning && (
        <div className="dashboard-page__warning">{journey.warning}</div>
      )}

      <div className="dashboard-page__cards dashboard-page__cards--compact">
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">총 이벤트</div>
          <div className="dashboard-page__card-value">{fmtNum(journey?.total_events || 0)}</div>
        </div>
        <div className="dashboard-page__card">
          <div className="dashboard-page__card-label">ES 전체 데이터</div>
          <div className="dashboard-page__card-value">{fmtNum(journey?.es_total || 0)}</div>
        </div>
      </div>

      <div className="dashboard-page__grid dashboard-page__grid--journey">
        {/* 디바이스 분포 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">디바이스 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={journey?.device_distribution || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={renderPieLabel}>
                {(journey?.device_distribution || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 액션 유형 분포 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">액션 유형</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={journey?.action_distribution || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={renderPieLabel}>
                {(journey?.action_distribution || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 일별 방문 추이 */}
        <div className="dashboard-page__chart dashboard-page__chart--journey-full">
          <h3 className="dashboard-page__chart-title">일별 이벤트 추이</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={journey?.daily_visits || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={COLOR_ORANGE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 병원별 활동 TOP 10 */}
        <div className="dashboard-page__chart dashboard-page__chart--journey-full">
          <h3 className="dashboard-page__chart-title">병원별 활동 TOP 10</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={journey?.top_hospitals || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLOR_BROWN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* OS 분포 */}
        <div className="dashboard-page__chart">
          <h3 className="dashboard-page__chart-title">OS 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={journey?.os_distribution || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={renderPieLabel}>
                {(journey?.os_distribution || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
