/**
 * LineChart - 건강 수치 추이를 보여주는 라인 차트
 * 혈압, 혈당, 콜레스테롤 등 시계열 건강 데이터 시각화
 */
import React, { useMemo, useRef, useState } from 'react';
import BaseChart, { BaseChartProps, ChartDimensions } from '../BaseChart';
import { HealthStatus } from '../../../types/health';
import './styles.scss';

export interface LineChartDataPoint {
  date: string;
  value: number;
  label?: string;
  status?: HealthStatus;
  reference?: {
    min?: number;
    max?: number;
    optimal?: number;
  };
}

export interface LineChartSeries {
  id: string;
  name: string;
  data: LineChartDataPoint[];
  color?: string;
  strokeWidth?: number;
  showPoints?: boolean;
  showArea?: boolean;
  unit?: string;
}

export interface LineChartProps extends BaseChartProps {
  series: LineChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  showGrid?: boolean;
  showReferenceLines?: boolean;
  dateFormat?: 'short' | 'long';
  valueFormat?: (value: number) => string;
  onPointHover?: (point: LineChartDataPoint, series: LineChartSeries) => void;
}

const LineChart: React.FC<LineChartProps> = ({
  series,
  xAxisLabel,
  yAxisLabel,
  showGrid = true,
  showReferenceLines = true,
  dateFormat = 'short',
  valueFormat = (value) => value.toString(),
  onPointHover,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });

  // 데이터 전처리 및 스케일 계산
  const chartData = useMemo(() => {
    if (!series.length) return null;

    // 모든 데이터 포인트 수집
    const allPoints = series.flatMap(s => s.data);
    if (!allPoints.length) return null;

    // 날짜 범위 계산
    const dates = allPoints.map(p => new Date(p.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // 값 범위 계산 (참조선 포함)
    const values = allPoints.map(p => p.value);
    const referenceValues = allPoints.flatMap(p => 
      p.reference ? [p.reference.min, p.reference.max, p.reference.optimal].filter(Boolean) : []
    ) as number[];
    
    const allValues = [...values, ...referenceValues];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // 여백 추가 (10%)
    const valueRange = maxValue - minValue;
    const padding = valueRange * 0.1;

    return {
      minDate,
      maxDate,
      minValue: minValue - padding,
      maxValue: maxValue + padding,
      dateRange: maxDate.getTime() - minDate.getTime()
    };
  }, [series]);

  // 좌표 변환 함수
  const getCoordinates = (
    point: LineChartDataPoint,
    dimensions: ChartDimensions
  ) => {
    if (!chartData) return { x: 0, y: 0 };

    const { width, height, margin } = dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const date = new Date(point.date);
    const x = margin.left + (date.getTime() - chartData.minDate.getTime()) / chartData.dateRange * chartWidth;
    const y = margin.top + (1 - (point.value - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight;

    return { x, y };
  };

  // SVG 패스 생성
  const createPath = (seriesData: LineChartSeries, dimensions: ChartDimensions) => {
    if (!seriesData.data.length) return '';

    const points = seriesData.data.map(point => getCoordinates(point, dimensions));
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  // 영역 패스 생성 (showArea가 true인 경우)
  const createAreaPath = (seriesData: LineChartSeries, dimensions: ChartDimensions) => {
    if (!seriesData.data.length || !seriesData.showArea) return '';

    const { height, margin } = dimensions;
    const chartHeight = height - margin.top - margin.bottom;
    const bottomY = margin.top + chartHeight;

    const points = seriesData.data.map(point => getCoordinates(point, dimensions));
    
    let path = `M ${points[0].x} ${bottomY}`;
    path += ` L ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    path += ` L ${points[points.length - 1].x} ${bottomY} Z`;

    return path;
  };

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    if (dateFormat === 'short') {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('ko-KR');
  };

  // 포인트 호버 처리
  const handlePointHover = (
    event: React.MouseEvent,
    point: LineChartDataPoint,
    seriesData: LineChartSeries
  ) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const tooltipContent = `
      <div class="wello-chart-tooltip__title">${seriesData.name}</div>
      <div class="wello-chart-tooltip__date">${formatDate(new Date(point.date))}</div>
      <div class="wello-chart-tooltip__value">${valueFormat(point.value)} ${seriesData.unit || ''}</div>
      ${point.status ? `<div class="wello-chart-tooltip__status status-${point.status}">${point.status}</div>` : ''}
    `;

    setTooltip({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      content: tooltipContent
    });

    onPointHover?.(point, seriesData);
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // 차트 렌더링
  const renderChart = (dimensions: ChartDimensions) => {
    if (!chartData || !series.length) {
      return (
        <div className="wello-line-chart__empty">
          <p>표시할 데이터가 없습니다</p>
        </div>
      );
    }

    const { width, height, margin } = dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    return (
      <div className="wello-line-chart">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="wello-line-chart__svg"
          role="img"
          aria-label={`${baseProps.title || '라인 차트'} - ${series.length}개 데이터 시리즈`}
        >
          {/* 배경 그리드 */}
          {showGrid && (
            <g className="wello-line-chart__grid">
              {/* 세로 그리드 라인 */}
              {Array.from({ length: 5 }, (_, i) => {
                const x = margin.left + (i / 4) * chartWidth;
                return (
                  <line
                    key={`v-grid-${i}`}
                    x1={x}
                    y1={margin.top}
                    x2={x}
                    y2={margin.top + chartHeight}
                    className="wello-line-chart__grid-line"
                  />
                );
              })}
              
              {/* 가로 그리드 라인 */}
              {Array.from({ length: 5 }, (_, i) => {
                const y = margin.top + (i / 4) * chartHeight;
                return (
                  <line
                    key={`h-grid-${i}`}
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + chartWidth}
                    y2={y}
                    className="wello-line-chart__grid-line"
                  />
                );
              })}
            </g>
          )}

          {/* 참조선 */}
          {showReferenceLines && series.map(seriesData => 
            seriesData.data.some(p => p.reference) && (
              <g key={`ref-${seriesData.id}`} className="wello-line-chart__reference-lines">
                {/* 최적값 라인 */}
                {seriesData.data[0]?.reference?.optimal && (
                  <line
                    x1={margin.left}
                    y1={margin.top + (1 - (seriesData.data[0].reference.optimal - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight}
                    x2={margin.left + chartWidth}
                    y2={margin.top + (1 - (seriesData.data[0].reference.optimal - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight}
                    className="wello-line-chart__reference-line wello-line-chart__reference-line--optimal"
                  />
                )}
              </g>
            )
          )}

          {/* 데이터 시리즈 */}
          {series.map((seriesData, seriesIndex) => (
            <g key={seriesData.id} className="wello-line-chart__series">
              {/* 영역 (showArea가 true인 경우) */}
              {seriesData.showArea && (
                <path
                  d={createAreaPath(seriesData, dimensions)}
                  className="wello-line-chart__area"
                  style={{
                    fill: seriesData.color || (seriesIndex === 0 ? 'var(--color-primary)' : 'var(--color-gray-500)'),
                    fillOpacity: 0.1
                  }}
                />
              )}

              {/* 라인 */}
              <path
                d={createPath(seriesData, dimensions)}
                className="wello-line-chart__line"
                style={{
                  stroke: seriesData.color || (seriesIndex === 0 ? 'var(--color-primary)' : 'var(--color-gray-600)'),
                  strokeWidth: seriesData.strokeWidth || 2,
                  fill: 'none'
                }}
              />

              {/* 데이터 포인트 */}
              {(seriesData.showPoints !== false) && seriesData.data.map((point, pointIndex) => {
                const { x, y } = getCoordinates(point, dimensions);
                return (
                  <circle
                    key={`${seriesData.id}-point-${pointIndex}`}
                    cx={x}
                    cy={y}
                    r={4}
                    className={`wello-line-chart__point ${point.status ? `wello-line-chart__point--${point.status}` : ''}`}
                    style={{
                      fill: seriesData.color || (seriesIndex === 0 ? 'var(--color-primary)' : 'var(--color-gray-600)'),
                      stroke: 'var(--bg-primary)',
                      strokeWidth: 2
                    }}
                    onMouseEnter={(e) => handlePointHover(e, point, seriesData)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </g>
          ))}

          {/* X축 */}
          <g className="wello-line-chart__x-axis">
            <line
              x1={margin.left}
              y1={margin.top + chartHeight}
              x2={margin.left + chartWidth}
              y2={margin.top + chartHeight}
              className="wello-line-chart__axis-line"
            />
            
            {/* X축 레이블 */}
            {Array.from({ length: 5 }, (_, i) => {
              const ratio = i / 4;
              const date = new Date(chartData.minDate.getTime() + ratio * chartData.dateRange);
              const x = margin.left + ratio * chartWidth;
              
              return (
                <g key={`x-label-${i}`}>
                  <text
                    x={x}
                    y={margin.top + chartHeight + 20}
                    className="wello-line-chart__axis-label"
                    textAnchor="middle"
                  >
                    {formatDate(date)}
                  </text>
                </g>
              );
            })}
            
            {xAxisLabel && (
              <text
                x={margin.left + chartWidth / 2}
                y={height - 5}
                className="wello-line-chart__axis-title"
                textAnchor="middle"
              >
                {xAxisLabel}
              </text>
            )}
          </g>

          {/* Y축 */}
          <g className="wello-line-chart__y-axis">
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + chartHeight}
              className="wello-line-chart__axis-line"
            />
            
            {/* Y축 레이블 */}
            {Array.from({ length: 5 }, (_, i) => {
              const ratio = i / 4;
              const value = chartData.minValue + (1 - ratio) * (chartData.maxValue - chartData.minValue);
              const y = margin.top + ratio * chartHeight;
              
              return (
                <g key={`y-label-${i}`}>
                  <text
                    x={margin.left - 10}
                    y={y + 4}
                    className="wello-line-chart__axis-label"
                    textAnchor="end"
                  >
                    {valueFormat(value)}
                  </text>
                </g>
              );
            })}
            
            {yAxisLabel && (
              <text
                x={15}
                y={margin.top + chartHeight / 2}
                className="wello-line-chart__axis-title"
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

export default LineChart;
