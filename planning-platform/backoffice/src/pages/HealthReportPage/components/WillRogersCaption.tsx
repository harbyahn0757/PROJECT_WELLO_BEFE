/**
 * WillRogersCaption — BeforeAfterBlock 하단 코호트 주석
 * 3-A: 접힘/펼침 Disclosure 패턴으로 확장
 */
import { useState } from 'react';
import type { WillRogersEntry } from '../hooks/useMediarcApi';
import Term from './Term';

interface WillRogersCaptionProps {
  willRogers?: WillRogersEntry[];
  /** timeDim 모드에서 코호트 override 적용 여부 */
  override?: boolean;
}

export default function WillRogersCaption({ willRogers, override }: WillRogersCaptionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="report-view__will-rogers" data-test="will-rogers">
      <button
        type="button"
        className="report-view__will-rogers-trigger"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <Term keyword="코호트">기준 집단</Term>을 고정해 계산했습니다 {expanded ? '(접기)' : '(자세히)'}
      </button>
      {expanded && (
        <div className="report-view__will-rogers-detail">
          <p>
            생활습관을 바꿔도 비교 대상 집단(<Term keyword="코호트">코호트</Term>)이 바뀌지 않도록 기준을 고정해서 <Term keyword="등수">등수</Term>를
            계산했습니다. 이게 바로 <Term keyword="Will Rogers 현상">Will Rogers 현상</Term>을 방지하는 방법이에요.
            그렇지 않으면 "금연했더니 비흡연자 그룹으로 이동해 등수가 변하지 않는" 착시가 생깁니다.
          </p>
          {willRogers && willRogers.length > 0 && (
            <ul>
              <li>현재 rank → 개선 rank 변화 계산 방식: 코호트 평균 RR 고정 분포 매핑</li>
              <li>rank 개선 수치가 보이는 이유: 개인 RR 만 변화, 비교 기준 집단 불변</li>
            </ul>
          )}
          <p className="report-view__will-rogers-ref">
            방법론 근거: Feinstein 1985, Will Rogers phenomenon (PMID 4000199)
          </p>
          {override && (
            <p data-test="will-rogers-override" className="report-view__will-rogers-override">
              시간축 모드: 코호트 고정 기준 override 적용됨
            </p>
          )}
        </div>
      )}
    </section>
  );
}
