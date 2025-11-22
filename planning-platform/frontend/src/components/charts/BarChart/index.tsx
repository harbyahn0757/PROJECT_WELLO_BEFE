/**
 * BarChart - 건강 검진 결과 비교 바 차트
 * 연도별, 병원별, 수치별 비교 시각화
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import BaseChart, { BaseChartProps, ChartDimensions } from '../BaseChart';
import { HealthStatus } from '../../../types/health';
import './styles.scss';

export interface BarChartDataPoint {
  label: string; // 연도, 병원명 등
  value: number;
  status?: HealthStatus;
  category?: string; // 검사 구분 (계측검사, 혈액검사 등)
  unit?: string;
  reference?: {
    min?: number;
    max?: number;
    normal?: number;
  };
  metadata?: {
    date?: string;
    location?: string;
    [key: string]: any;
  };
}

export interface BarChartSeries {
  id: string;
  name: string; // 신장, 체중, 혈압, 혈당 등
  data: BarChartDataPoint[];
  color?: string;
  unit?: string;
  type?: 'vertical' | 'horizontal';
}

export interface BarChartProps extends BaseChartProps {
  series: BarChartSeries[];
  orientation?: 'vertical' | 'horizontal';
  groupBy?: 'series' | 'category'; // 시리즈별 그룹화 vs 카테고리별 그룹화
  showValues?: boolean; // 바 위에 값 표시
  showReferenceLines?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  barSpacing?: number; // 바 간격
  groupSpacing?: number; // 그룹 간격
  valueFormat?: (value: number, unit?: string) => string;
  onBarClick?: (point: BarChartDataPoint, series: BarChartSeries) => void;
}

const BarChart: React.FC<BarChartProps> = ({
  series,
  orientation = 'vertical',
  groupBy = 'series',
  showValues = true,
  showReferenceLines = true,
  xAxisLabel,
  yAxisLabel,
  barSpacing = 4,
  groupSpacing = 28, // X축 간격 더 확보 (24 → 28)
  valueFormat = (value, unit) => `${value}${unit ? ` ${unit}` : ''}`,
  onBarClick,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });

  // 데이터 전처리 및 그룹화
  const chartData = useMemo(() => {
    if (!series.length) return null;

    // 모든 데이터 포인트 수집
    const allPoints = series.flatMap(s => s.data);
    if (!allPoints.length) return null;

    // 값 범위 계산 - 실제 데이터 값만 사용 (reference 값 제외)
    const values = allPoints.map(p => p.value).filter(v => 
      typeof v === 'number' && !isNaN(v) && isFinite(v)
    );
    
    // BarChart에서는 reference 값을 Y축 범위 계산에 포함하지 않음
    // (LineChart와 달리 BarChart는 실제 데이터 값 범위만 표시)
    const allValues = values;
    
    // 유효한 값이 없으면 기본값 사용
    if (allValues.length === 0) {
      return {
        minValue: 0,
        maxValue: 100,
        groups: [],
        seriesCount: series.length
      };
    }
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // Y축 최대값을 다음 5의 배수로 올림하여 여유 공간 확보
    // 예: 14 -> 20, 8 -> 10, 15 -> 20
    const roundedMaxValue = Math.ceil(maxValue / 5) * 5;
    const adjustedMaxValue = roundedMaxValue === maxValue ? roundedMaxValue + 5 : roundedMaxValue;
    
    // 여백 추가 (10%)
    const valueRange = adjustedMaxValue - minValue || 1; // 0으로 나누기 방지
    const padding = valueRange * 0.1;

    // 라벨 수집 (연도, 병원 등)
    const labels = Array.from(new Set(allPoints.map(p => p.label)));

    // 그룹화 처리
    let groups: Array<{
      label: string;
      bars: Array<{
        seriesId: string;
        seriesName: string;
        value: number;
        status?: HealthStatus;
        unit?: string;
        color?: string;
        point: BarChartDataPoint;
      }>;
    }> = [];

    if (groupBy === 'series') {
      // 시리즈별 그룹화 (같은 지표끼리)
      groups = labels.map(label => ({
        label,
        bars: series.map(s => {
          const point = s.data.find(p => p.label === label);
          const barValue = point?.value ?? 0;
          
          return {
            seriesId: s.id,
            seriesName: s.name,
            value: barValue,
            status: point?.status,
            unit: s.unit,
            color: s.color,
            point: point!
          };
        }).filter(bar => bar.point)
      }));
    } else {
      // 카테고리별 그룹화 (같은 연도/병원끼리)
      const categories = Array.from(new Set(allPoints.map(p => p.category).filter(Boolean)));
      groups = categories.map(category => ({
        label: category || '기타',
        bars: series.flatMap(s => 
          s.data
            .filter(p => p.category === category)
            .map(point => ({
              seriesId: s.id,
              seriesName: s.name,
              value: point.value,
              status: point.status,
              unit: s.unit,
              color: s.color,
              point
            }))
        )
      }));
    }

    return {
      minValue: minValue - padding,
      maxValue: adjustedMaxValue + padding, // 조정된 최대값 사용
      valueRange: adjustedMaxValue - minValue + (padding * 2),
      labels,
      groups: groups.filter(g => g.bars.length > 0),
      seriesCount: series.length
    };
  }, [series, groupBy]);


  // 그리드 라인 배열 메모이제이션
  const gridLines = useMemo(() => {
    if (orientation === 'vertical') {
      return Array.from({ length: 4 }, (_, i) => i);
    } else {
      return Array.from({ length: 5 }, (_, i) => i);
    }
  }, [orientation]);

  // Y축 레이블 배열 메모이제이션
  const yAxisLabels = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => i);
  }, []);

  // 색상 결정 로직 통합
  const getBarColor = (seriesId: string, status?: HealthStatus) => {
    const seriesColor = series.find(s => s.id === seriesId)?.color;
    if (seriesColor) return seriesColor;
    
    // 상태별 기본 색상
    if (status === 'warning') return 'var(--color-warning)';
    if (status === 'danger') return 'var(--color-danger)';
    if (status === 'normal') return 'var(--color-success)';
    
    return '#7c746a'; // 기본 브랜드 브라운
  };

  // 바 위치 계산
  const getBarDimensions = (
    groupIndex: number,
    barIndex: number,
    value: number,
    dimensions: ChartDimensions
  ) => {
    if (!chartData) return { x: 0, y: 0, width: 0, height: 0 };

    const { width, height, margin } = dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const groupCount = chartData.groups.length;
    const barsPerGroup = Math.max(...chartData.groups.map(g => g.bars.length));
    
    if (orientation === 'vertical') {
      const groupWidth = chartWidth / groupCount;
      const barWidth = Math.max((groupWidth - groupSpacing) / barsPerGroup - barSpacing, 16); // 바 더 두껍게 (12 → 16)
      const groupX = margin.left + groupIndex * groupWidth + groupSpacing / 2;
      const barX = groupX + barIndex * (barWidth + barSpacing);
      const minY = 0;
      const maxY = Math.max(chartData.maxValue, 2);
      const barHeight = Math.max((value - minY) / (maxY - minY) * chartHeight, 2);
      const barY = margin.top + chartHeight - barHeight;

      return { x: barX, y: barY, width: barWidth, height: barHeight };
    } else {
      const groupHeight = chartHeight / groupCount;
      const barHeight = Math.max((groupHeight - groupSpacing) / barsPerGroup - barSpacing, 8);
      const groupY = margin.top + groupIndex * groupHeight + groupSpacing / 2;
      const barY = groupY + barIndex * (barHeight + barSpacing);
      const minY = 0;
      const maxY = Math.max(chartData.maxValue, 2);
      const barWidth = Math.max((value - minY) / (maxY - minY) * chartWidth, 2);
      const barX = margin.left;

      return { x: barX, y: barY, width: barWidth, height: barHeight };
    }
  };

  // 바 호버 처리
  const handleBarHover = (
    event: React.MouseEvent,
    point: BarChartDataPoint,
    seriesName: string,
    unit?: string
  ) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const tooltipContent = `
      <div class="wello-chart-tooltip__title">${seriesName}</div>
      <div class="wello-chart-tooltip__label">${point.label}</div>
      <div class="wello-chart-tooltip__value">${valueFormat(point.value, unit)}</div>
      ${point.status ? `<div class="wello-chart-tooltip__status status-${point.status}">${point.status}</div>` : ''}
      ${point.metadata?.date ? `<div class="wello-chart-tooltip__date">${point.metadata.date}</div>` : ''}
      ${point.metadata?.location ? `<div class="wello-chart-tooltip__location">${point.metadata.location}</div>` : ''}
    `;

    setTooltip({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      content: tooltipContent
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // 차트 렌더링
  const renderChart = (dimensions: ChartDimensions) => {
    if (!chartData || !chartData.groups.length) {
      return (
        <div className="wello-bar-chart__empty">
          <p>표시할 데이터가 없습니다</p>
        </div>
      );
    }

    // X축 라벨을 위한 여유 공간 확보 및 Y축 라벨 공간 최적화
    const adjustedDimensions = {
      ...dimensions,
      margin: {
        ...dimensions.margin,
        top: Math.max(dimensions.margin.top, 10), // 값 레이블을 위한 상단 여백 최소화 (20 → 10)
        bottom: Math.max(dimensions.margin.bottom, 35), // 최소 35px 확보 (하단 고정)
        left: Math.min(dimensions.margin.left, 8), // Y축 라벨 공간 최소화 (12px → 8px)
        right: Math.min(dimensions.margin.right, 0) // 오른쪽 여백 최소화 (0px 유지)
      }
    };
    
    const { width, height, margin } = adjustedDimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 값 레이블을 위한 상단 여유 공간 (값 레이블이 잘리지 않도록 충분히 확보)
    const valueLabelPadding = 15;

    return (
      <div className="wello-bar-chart">
        <svg
          ref={svgRef}
          width={width}
          height={height + valueLabelPadding}
          viewBox={`0 ${-valueLabelPadding} ${width} ${height + valueLabelPadding}`}
          className="wello-bar-chart__svg"
          role="img"
          aria-label={`${baseProps.title || '바 차트'} - ${chartData.groups.length}개 그룹, ${series.length}개 시리즈`}
        >
          {/* 배경 그리드 */}
          <g className="wello-bar-chart__grid">
            {orientation === 'vertical' ? (
              // 세로 차트 - 가로 그리드 라인
              gridLines.map((i) => {
                const y = margin.top + (i / 3) * chartHeight;
                return (
                  <line
                    key={`h-grid-${i}`}
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + chartWidth}
                    y2={y}
                    className="wello-bar-chart__grid-line"
                  />
                );
              })
            ) : (
              // 가로 차트 - 세로 그리드 라인
              gridLines.map((i) => {
                const x = margin.left + (i / 4) * chartWidth;
                return (
                  <line
                    key={`v-grid-${i}`}
                    x1={x}
                    y1={margin.top}
                    x2={x}
                    y2={margin.top + chartHeight}
                    className="wello-bar-chart__grid-line"
                  />
                );
              })
            )}
          </g>

          {/* Y축 값 기준 참조선 (얇은 점선) */}
          {orientation === 'vertical' && (
            <g className="wello-bar-chart__reference-lines">
              {yAxisLabels.map((i) => {
                const ratio = i / 3;
                const minY = 0;
                const maxY = Math.max(chartData.maxValue, 2);
                const value = minY + (1 - ratio) * (maxY - minY);
                const y = margin.top + ratio * chartHeight;
                
                return (
                  <line
                    key={`ref-line-${i}`}
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + chartWidth}
                    y2={y}
                    className="wello-bar-chart__reference-line"
                  />
                );
              })}
            </g>
          )}

          {/* 데이터 기반 참조선 (기존 기능) */}
          {showReferenceLines && series.some(s => s.data.some(p => p.reference)) && (
            <g className="wello-bar-chart__reference-lines">
              {series.map(s => 
                s.data.find(p => p.reference)?.reference && (
                  <g key={`ref-${s.id}`}>
                    {/* 정상값 라인 */}
                    {s.data.find(p => p.reference?.normal) && (
                      <line
                        x1={orientation === 'vertical' ? margin.left : margin.left + (s.data.find(p => p.reference?.normal)!.reference!.normal! - 0) / Math.max(chartData.maxValue, 2) * chartWidth}
                        y1={orientation === 'vertical' ? margin.top + (1 - (s.data.find(p => p.reference?.normal)!.reference!.normal! - 0) / Math.max(chartData.maxValue, 2)) * chartHeight : margin.top}
                        x2={orientation === 'vertical' ? margin.left + chartWidth : margin.left + (s.data.find(p => p.reference?.normal)!.reference!.normal! - 0) / Math.max(chartData.maxValue, 2) * chartWidth}
                        y2={orientation === 'vertical' ? margin.top + (1 - (s.data.find(p => p.reference?.normal)!.reference!.normal! - 0) / Math.max(chartData.maxValue, 2)) * chartHeight : margin.top + chartHeight}
                        className="wello-bar-chart__reference-line wello-bar-chart__reference-line--normal"
                      />
                    )}
                  </g>
                )
              )}
            </g>
          )}

          {/* 바 그룹 및 값 레이블 (같은 그룹에 배치하여 구조 단순화) */}
          {chartData.groups.map((group, groupIndex) => (
            <g key={`group-${groupIndex}`} className="wello-bar-chart__group">
              {group.bars.map((bar, barIndex) => {
                const barDimensions = getBarDimensions(groupIndex, barIndex, bar.value, adjustedDimensions);
                const barColor = getBarColor(bar.seriesId, bar.status);
                
                const labelX = orientation === 'vertical'
                  ? barDimensions.x + barDimensions.width / 2
                  : barDimensions.x + barDimensions.width + 4;
                
                // 값 레이블 위치: 바 위에 표시 (더 위로 올림)
                const labelY = orientation === 'vertical' 
                  ? barDimensions.y - 12
                  : barDimensions.y + barDimensions.height / 2 + 4;

                return (
                  <g key={`${group.label}-${bar.seriesId}`} data-series-id={bar.seriesId}>
                    {/* 바 */}
                    <rect
                      x={barDimensions.x}
                      y={barDimensions.y}
                      width={barDimensions.width}
                      height={barDimensions.height}
                      className={`wello-bar-chart__bar ${bar.status ? `wello-bar-chart__bar--${bar.status}` : ''}`}
                      fill={barColor}
                      data-series-id={bar.seriesId}
                      onMouseEnter={(e) => handleBarHover(e, bar.point, bar.seriesName, bar.unit)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => onBarClick?.(bar.point, series.find(s => s.id === bar.seriesId)!)}
                    />
                    
                    {/* 값 레이블 (바와 같은 그룹에 배치) */}
                    {showValues && bar.value > 0 && (
                      <text
                        x={labelX}
                        y={labelY}
                        className="wello-bar-chart__value-label"
                        textAnchor={orientation === 'vertical' ? 'middle' : 'start'}
                        dominantBaseline={orientation === 'vertical' ? 'hanging' : 'middle'}
                        data-series-id={bar.seriesId}
                      >
                        {valueFormat(bar.value, bar.unit || '')}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}

          {/* X축 */}
          <g className="wello-bar-chart__x-axis">
            <line
              x1={margin.left}
              y1={margin.top + chartHeight}
              x2={margin.left + chartWidth}
              y2={margin.top + chartHeight}
              className="wello-bar-chart__axis-line"
            />
            
            {/* X축 레이블 */}
            {chartData.groups.map((group, index) => {
              const x = orientation === 'vertical' 
                ? margin.left + (index + 0.5) * (chartWidth / chartData.groups.length)
                : margin.left;
              
              return (
                <text
                  key={`x-label-${index}`}
                  x={x}
                  y={margin.top + chartHeight + 20}
                  className="wello-bar-chart__axis-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {group.label}
                </text>
              );
            })}
            
            {xAxisLabel && (
              <text
                x={margin.left + chartWidth / 2}
                y={height - 5}
                className="wello-bar-chart__axis-title"
                textAnchor="middle"
              >
                {xAxisLabel}
              </text>
            )}
          </g>

          {/* Y축 */}
          <g className="wello-bar-chart__y-axis">
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + chartHeight}
              className="wello-bar-chart__axis-line"
            />
            
            {/* Y축 레이블 */}
            {yAxisLabels.map((i) => {
              const ratio = i / 3;
              const minY = 0;
              const maxY = Math.max(chartData.maxValue, 2);
              const value = minY + (1 - ratio) * (maxY - minY);
              const y = margin.top + ratio * chartHeight;
              
              return (
                <text
                  key={`y-label-${i}`}
                  x={margin.left - 2}
                  y={y + 4}
                  className="wello-bar-chart__axis-label"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {Math.round(value)}
                </text>
              );
            })}
            
            {yAxisLabel && (
              <text
                x={15}
                y={margin.top + chartHeight / 2}
                className="wello-bar-chart__axis-title"
                textAnchor="middle"
                transform={`rotate(-90, 15, ${margin.top + chartHeight / 2})`}
              >
                {yAxisLabel}
              </text>
            )}
          </g>
        </svg>

        {/* 툴팁 */}
        {tooltip.visible && (
          <div
            className="wello-chart-tooltip wello-chart-tooltip--visible"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 10
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </div>
    );
  };

  return (
    <BaseChart {...baseProps} showLegend={series.length > 1}>
      {renderChart}
    </BaseChart>
  );
};

export default BarChart;
