import useAiSummary from '../hooks/useAiSummary';
import AiSummaryText from './AiSummaryText';

interface AiSummaryButtonProps {
  uuid: string;
  hospitalId?: string;
}

export default function AiSummaryButton({ uuid, hospitalId }: AiSummaryButtonProps) {
  const { summary, generatedAt, model, stale, loading, error, generate, regenerate } =
    useAiSummary(uuid, hospitalId);

  // 초기 로딩 (요약 없는 상태에서 패치 중)
  if (loading && !summary) {
    return <div className="report-view__ai-summary-loading">AI 요약 불러오는 중...</div>;
  }

  // 요약 미생성 상태 — 생성 버튼 표시
  if (!summary) {
    return (
      <div className="report-view__ai-summary-empty">
        {error ? <div className="report-view__ai-summary-error">{error}</div> : null}
        <button
          type="button"
          className="btn btn--primary report-view__ai-summary-generate-btn"
          onClick={generate}
          disabled={loading}
        >
          {loading ? '생성 중...' : 'AI 요약 생성'}
        </button>
      </div>
    );
  }

  // 요약 존재 — 텍스트 + 재생성 버튼
  return (
    <div className="report-view__ai-summary-wrap">
      <AiSummaryText
        summary={summary}
        generatedAt={generatedAt}
        model={model}
        stale={stale}
      />
      {error ? <div className="report-view__ai-summary-error">{error}</div> : null}
      <button
        type="button"
        className="btn btn--secondary report-view__ai-summary-regen-btn"
        onClick={regenerate}
        disabled={loading}
      >
        {loading ? '재생성 중...' : '재생성'}
      </button>
    </div>
  );
}
