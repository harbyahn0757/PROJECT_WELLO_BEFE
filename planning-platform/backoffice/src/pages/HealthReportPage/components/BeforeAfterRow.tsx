/**
 * BeforeAfterRow — 질환 1행: 현재 vs 개선 후 비교
 */
import type { DiseaseDetail, WillRogersEntry } from '../hooks/useMediarcApi';

interface BeforeAfterRowProps {
  diseaseName: string;
  current: DiseaseDetail;
  willRogers?: WillRogersEntry;
}

export default function BeforeAfterRow({
  diseaseName,
  current,
  willRogers,
}: BeforeAfterRowProps) {
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
    <tr className="report-view__before-after-row">
      <td className="report-view__disease-name">{diseaseName}</td>
      <td>{currentRatio}%</td>
      <td>{currentRank}</td>
      <td>{improvedRatio}%</td>
      <td>{improvedRank}</td>
      <td><span className={rankChangeCls}>{rankChangeLabel}</span></td>
      <td>{arrPct != null ? `${arrPct.toFixed(1)}%` : '-'}</td>
    </tr>
  );
}
