/**
 * BeforeAfterRow — 질환 1행: 현재 vs 개선 후 비교
 * 3-A: 8번째 td Disclosure 추가
 */
import { useState } from 'react';
import type { DiseaseDetail, WillRogersEntry } from '../hooks/useMediarcApi';

interface FormulaDetail {
  disease_key: string;
  orig_ratio: number;
  improved_ratio: number;
  formula: string;
  components: Array<{ label: string; rr: number; source_pmid?: string }>;
  arr_formula: string;
}

interface BeforeAfterRowProps {
  diseaseName: string;
  current: DiseaseDetail;
  willRogers?: WillRogersEntry;
  formulaDetail?: FormulaDetail;
  /** timeDim 모드: override 적용 여부 */
  timeDimOverride?: boolean;
  /** timeDim 모드: 5년 예측값 */
  fiveYearValue?: number | null;
  /** disease key (셀렉터용, 없으면 diseaseName fallback) */
  diseaseKey?: string;
}

export default function BeforeAfterRow({
  diseaseName,
  current,
  willRogers,
  formulaDetail,
  timeDimOverride,
  fiveYearValue,
  diseaseKey,
}: BeforeAfterRowProps) {
  const rowKey = diseaseKey ?? diseaseName;
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  const currentRatio = current.ratio != null ? (current.ratio * 100).toFixed(1) : '-';
  const currentRank = current.rank != null ? `${current.rank}등` : '-';

  const improvedRatio =
    willRogers != null
      ? (willRogers.improved_ratio * 100).toFixed(1)
      : current.improved_ratio != null
      ? (current.improved_ratio * 100).toFixed(1)
      : '-';

  const improvedRank =
    willRogers != null
      ? `${willRogers.improved_rank}등`
      : current.improved_rank != null
      ? `${current.improved_rank}등`
      : '-';

  const rankChange =
    willRogers != null ? willRogers.rank_change : current.rank_change;
  const arrPct =
    willRogers != null ? willRogers.arr_pct : current.arr_pct;

  const rankChangeLabel =
    rankChange != null
      ? rankChange < 0
        ? `${rankChange}등`
        : rankChange > 0
        ? `+${rankChange}등`
        : '변화없음'
      : '-';

  const rankChangeCls =
    rankChange != null && rankChange < 0
      ? 'report-view__rank-change report-view__rank-change--improved'
      : rankChange != null && rankChange > 0
      ? 'report-view__rank-change report-view__rank-change--worse'
      : 'report-view__rank-change';

  return (
    <>
      <tr
        className="report-view__before-after-row"
        data-test={`row-${rowKey}`}
      >
        <td className="report-view__disease-name">{diseaseName}</td>
        <td>{currentRatio}%</td>
        <td>{currentRank}</td>
        <td>{improvedRatio}%</td>
        <td>{improvedRank}</td>
        <td><span className={rankChangeCls}>{rankChangeLabel}</span></td>
        <td>
          {arrPct != null ? `${arrPct.toFixed(1)}%` : '-'}
          {/* row-{key}-5y: 5년 예측값 (timeDim 모드) */}
          {fiveYearValue != null && (
            <span data-test={`row-${rowKey}-5y`} style={{ display: 'none' }}>{fiveYearValue}</span>
          )}
          {/* row-{key}-override: timeDim override 적용 여부 */}
          {timeDimOverride && (
            <span data-test={`row-${rowKey}-override`} style={{ display: 'none' }}>override</span>
          )}
        </td>
        <td>
          <button
            type="button"
            className="report-view__before-after-row__disclosure-trigger"
            aria-expanded={disclosureOpen}
            aria-label={disclosureOpen ? '근거 닫기' : '근거 보기'}
            onClick={() => setDisclosureOpen((v) => !v)}
          >
            {disclosureOpen ? '−' : '근거'}
          </button>
        </td>
      </tr>
      {disclosureOpen && (
        <tr className={`report-view__before-after-row__disclosure-panel report-view__before-after-row__disclosure-panel--open`}>
          <td colSpan={8}>
            {formulaDetail ? (
              <dl>
                <dt>개선 공식</dt>
                <dd className="report-view__before-after-row__formula-line">
                  {formulaDetail.formula}
                </dd>
                {formulaDetail.components.length > 0 && (
                  <>
                    <dt>구성 RR</dt>
                    <dd>
                      <ul>
                        {formulaDetail.components.map((c, i) => (
                          <li key={i}>
                            {c.label}: RR = {c.rr.toFixed(3)}
                            {c.source_pmid && (
                              <span> (PMID {c.source_pmid})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                <dt>ARR 계산</dt>
                <dd className="report-view__before-after-row__formula-line">
                  {formulaDetail.arr_formula} = {arrPct?.toFixed(1) ?? '-'}%
                </dd>
              </dl>
            ) : (
              <dl>
                <dt>현재 상대위험도 (ratio)</dt>
                <dd>
                  (개인 RR) ÷ (같은 연령·성별 코호트 평균 RR) = {currentRatio}%
                  <br />
                  코호트 평균 = exp(&Sigma; p<sub>i</sub> &times; ln(RR<sub>i</sub>)) (Rothman 2008, PMID 18212285)
                </dd>
                <dt>등수 (rank)</dt>
                <dd>
                  ratio 를 분포에 매핑하여 하위 %. 낮을수록 위험 (하위 1% = 가장 위험).
                </dd>
                <dt>개선 후 상대위험도</dt>
                <dd>
                  BMI &lt; 23, 금연, 금주 reset 후 동일 코호트 평균(코호트 고정)으로 나눈 ratio.
                </dd>
                <dt>ARR (절대위험도 감소율)</dt>
                <dd>
                  (원래 ratio &minus; 개선 ratio) &divide; 원래 ratio &times; 100 = {arrPct?.toFixed(1) ?? '-'}%
                </dd>
              </dl>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
