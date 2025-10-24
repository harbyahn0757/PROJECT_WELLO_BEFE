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

    // 값 범위 계산 (참조선 포함) - 유효한 값만 필터링
    const values = allPoints.map(p => p.value).filter(v => 
      typeof v === 'number' && !isNaN(v) && isFinite(v)
    );
    const referenceValues = allPoints.flatMap(p => 
      p.reference ? [p.reference.min, p.reference.max, p.reference.optimal].filter(v => 
        typeof v === 'number' && !isNaN(v) && isFinite(v)
      ) : []
    ) as number[];
    
    const allValues = [...values, ...referenceValues];
    
    // 유효한 값이 없으면 기본값 사용
    if (allValues.length === 0) {
      return {
        minDate: new Date(),
        maxDate: new Date(),
        minValue: 0,
        maxValue: 100,
        dateRange: 1
      };
    }
    
    // 값 범위 계산 (최소값을 0으로 고정)
    const minValue = 0; // 항상 0부터 시작
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100;
    
    // 여백 추가 (상단만 10%)
    const valueRange = maxValue - minValue || 1; // 0으로 나누기 방지
    const padding = valueRange * 0.1;

    return {
      minDate,
      maxDate,
      minValue: minValue, // 0으로 고정
      maxValue: maxValue + padding,
      dateRange: maxDate.getTime() - minDate.getTime() || 1 // 0으로 나누기 방지
    };
  }, [series]);

  // 좌표 변환 함수 (NaN 방지)
  const getCoordinates = (
    point: LineChartDataPoint,
    dimensions: ChartDimensions
  ) => {
    if (!chartData) return { x: 0, y: 0 };

    const { width, height, margin } = dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // 날짜 유효성 검사
    const date = new Date(point.date);
    if (isNaN(date.getTime())) {
      console.warn('유효하지 않은 날짜:', point.date);
      return { x: 0, y: 0 };
    }

    // 값 유효성 검사
    const value = parseFloat(point.value.toString());
    if (isNaN(value) || !isFinite(value)) {
      console.warn('유효하지 않은 값:', point.value);
      return { x: 0, y: 0 };
    }

    // 범위 유효성 검사
    if (chartData.dateRange <= 0 || (chartData.maxValue - chartData.minValue) <= 0) {
      console.warn('유효하지 않은 차트 범위:', { dateRange: chartData.dateRange, valueRange: chartData.maxValue - chartData.minValue });
      return { x: margin.left, y: margin.top + chartHeight / 2 };
    }

    // 데이터가 있는 년도 기준으로 X 좌표 계산
    const pointYear = date.getFullYear();
    
    // 모든 시리즈에서 년도 추출
    const allYears = new Set<number>();
    series.forEach(s => {
      s.data.forEach(p => {
        if (p.date) {
          const year = new Date(p.date).getFullYear();
          if (!isNaN(year)) {
            allYears.add(year);
          }
        }
      });
    });
    
    // 최신 5년만 선택하여 최신 순 유지
    const sortedYears = Array.from(allYears)
      .sort((a, b) => b - a) // 최신 년도 순
      .slice(0, 5); // 최대 5개 (최신 순 유지)
    
    // 해당 년도의 인덱스 찾기
    const yearIndex = sortedYears.indexOf(pointYear);
    if (yearIndex === -1) {
      // 데이터에 없는 년도면 가장 가까운 위치로
      return { x: margin.left, y: margin.top + chartHeight / 2 };
    }
    
    const x = margin.left + (chartWidth / 4) * yearIndex;
    
    // Y축 라벨과 동일한 스케일 사용 (110% 높이, 5% 상단 패딩)
    const usableHeight = chartHeight * 1.1;
    const topPadding = chartHeight * 0.05;
    const y = margin.top + topPadding + (1 - (value - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * usableHeight;

    // 최종 좌표 유효성 검사
    const finalX = isNaN(x) || !isFinite(x) ? margin.left : x;
    const finalY = isNaN(y) || !isFinite(y) ? margin.top + chartHeight / 2 : y;

    return { x: finalX, y: finalY };
  };

  // SVG 패스 생성 (NaN 방지)
  const createPath = (seriesData: LineChartSeries, dimensions: ChartDimensions) => {
    if (!seriesData.data.length) return '';

    const points = seriesData.data
      .map(point => getCoordinates(point, dimensions))
      .filter(coord => !isNaN(coord.x) && !isNaN(coord.y) && isFinite(coord.x) && isFinite(coord.y));
    
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  // 영역 패스 생성 (showArea가 true인 경우, NaN 방지)
  const createAreaPath = (seriesData: LineChartSeries, dimensions: ChartDimensions) => {
    if (!seriesData.data.length || !seriesData.showArea) return '';

    const { height, margin } = dimensions;
    const chartHeight = height - margin.top - margin.bottom;
    const bottomY = margin.top + chartHeight;

    const points = seriesData.data
      .map(point => getCoordinates(point, dimensions))
      .filter(coord => !isNaN(coord.x) && !isNaN(coord.y) && isFinite(coord.x) && isFinite(coord.y));
    
    if (points.length === 0) return '';
    
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
                    fill: seriesData.color || (seriesIndex === 0 ? '#7c746a' : '#9ca3af'), // 브랜드 브라운 색상
                    fillOpacity: 0.1
                  }}
                />
              )}

              {/* 라인 제거 - 점만 표시 */}

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
                      fill: '#7c746a', // 플로팅 버튼 색상으로 고정
                      stroke: '#ffffff',
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
            
              {/* X축 레이블 - 데이터가 있는 년도와 빈 슬롯에 파비콘 표시 */}
              {(() => {
                // 실제 데이터에서 년도 추출
                const dataYears = new Set<number>();
                series.forEach(s => {
                  s.data.forEach(point => {
                    if (point.date) {
                      const year = new Date(point.date).getFullYear();
                      if (!isNaN(year)) {
                        dataYears.add(year);
                      }
                    }
                  });
                });
                
                // 최신 5년만 선택하여 최신 순 유지
                const sortedYears = Array.from(dataYears)
                  .sort((a, b) => b - a) // 최신 년도 순
                  .slice(0, 5); // 최대 5개 (최신 순 유지)
                
                // 5개 고정 슬롯 생성 (데이터가 있는 곳은 년도, 없는 곳은 파비콘)
                return Array.from({ length: 5 }, (_, index) => {
                  const x = margin.left + (chartWidth / 4) * index;
                  const year = sortedYears[index];
                  
                  if (year) {
                    // 데이터가 있는 경우 년도 표시
                    return (
                      <g key={`x-label-${year}`}>
                        <text
                          x={x}
                          y={margin.top + chartHeight + 12}
                          className="wello-line-chart__axis-label"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {year.toString().slice(-2)}년
                        </text>
                      </g>
                    );
                  } else {
                    // 빈 슬롯에는 파비콘 표시
                    return (
                      <g key={`x-empty-${index}`}>
                        <image
                          x={x - 8}
                          y={margin.top + chartHeight + 4}
                          width="16"
                          height="16"
                          href="/wello/wello-icon.png"
                          opacity="0.3"
                        />
                      </g>
                    );
                  }
                });
            })()}
            
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
            
            {/* Y축 레이블 (0만 제외, 간격 넓게) */}
            {Array.from({ length: 4 }, (_, i) => {
              const ratio = i / 3; // 4개로 간격 넓게
              const value = chartData.minValue + (1 - ratio) * (chartData.maxValue - chartData.minValue);
              const roundedValue = Math.round(value);
              
              // 0은 표시하지 않음
              if (roundedValue === 0) return null;
              
              // Y축 위쪽은 고정하고 아래쪽으로 더 늘려서 라벨 간격 넓히기
              const usableHeight = chartHeight * 1.1; // 110% 높이 사용 (아래로 더 확장)
              const topPadding = chartHeight * 0.05;   // 위쪽은 5% 고정
              const y = margin.top + topPadding + ratio * usableHeight;
              
              return (
                <g key={`y-label-${i}`}>
                  <text
                    x={margin.left - 35}
                    y={y + 4}
                    className="wello-line-chart__axis-label"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {roundedValue}
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
