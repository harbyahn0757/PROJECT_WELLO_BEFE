interface AiSummaryTextProps {
  summary: string;
  generatedAt?: string | null;
  model?: string | null;
  stale?: boolean;
}

export default function AiSummaryText({ summary, generatedAt, model, stale }: AiSummaryTextProps) {
  return (
    <div className="report-view__ai-summary">
      <p className="report-view__ai-summary-text">{summary}</p>
      <div className="report-view__ai-summary-meta">
        {generatedAt ? (
          <span>생성 {new Date(generatedAt).toLocaleString('ko-KR')}</span>
        ) : null}
        {model ? <span> · {model}</span> : null}
        {stale ? (
          <span className="report-view__ai-summary-stale"> · 입력 변경됨 — 재생성 권장</span>
        ) : null}
      </div>
    </div>
  );
}
