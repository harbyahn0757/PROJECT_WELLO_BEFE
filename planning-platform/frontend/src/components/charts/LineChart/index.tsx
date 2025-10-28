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
  normalRange?: { min: number; max: number }; // 정상 범위 표시
  healthRanges?: { // 다중 건강 범위 표시
    normal: { min: number; max: number } | null;
    borderline: { min: number; max: number } | null;
    abnormal: { min: number; max: number } | null;
  };
}

const LineChart: React.FC<LineChartProps> = ({
  series,
  xAxisLabel,
  yAxisLabel,
  showGrid = true,
  showReferenceLines = true,
  dateFormat = 'short',
  normalRange,
  healthRanges,
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
    
    // Y축 라벨 범위 확장에 맞게 점 위치도 조정
    const valueRatio = (value - chartData.minValue) / (chartData.maxValue - chartData.minValue);
    const expandedHeight = chartHeight * 1.2; // Y축 라벨과 동일한 확장 비율 (120%)
    const expandedTopPadding = chartHeight * 0.05; // Y축 라벨과 동일한 상단 패딩 (5% 고정)
    const y = margin.top + expandedTopPadding + (1 - valueRatio) * expandedHeight;

    // 최종 좌표 유효성 검사
    const finalX = isNaN(x) || !isFinite(x) ? margin.left : x;
    const finalY = isNaN(y) || !isFinite(y) ? margin.top + chartHeight / 2 : y;

    // 데이터 점 위치 계산 완료 - 디버깅 로그 제거

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

  // 상태 텍스트 한국어 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '정상';
      case 'warning': return '경계';
      case 'danger': return '이상';
      case 'abnormal': return '이상';
      default: return status;
    }
  };

  // 포인트 호버 처리
  const handlePointHover = (
    event: React.MouseEvent,
    point: LineChartDataPoint,
    seriesData: LineChartSeries
  ) => {
    console.log('🔍 [툴팁] 포인트 호버 이벤트:', { point, seriesData: seriesData.name });
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      console.warn('⚠️ [툴팁] SVG rect를 찾을 수 없음');
      return;
    }

    // 🔧 간단한 툴팁 내용 (병원명 | 상태, 수치만)
    const statusText = point.status ? getStatusText(point.status) : '';
    // 실제 데이터에서 병원명 추출
    const locationText = (point as any).location || 
                        (point as any).hospitalName || 
                        (point as any).item?.Location ||
                        "병원";
    
    console.log('🔍 [툴팁] 데이터 추출:', { 
      statusText, 
      locationText, 
      pointData: point,
      hasLocation: !!(point as any).location,
      hasHospitalName: !!(point as any).hospitalName,
      hasItemLocation: !!(point as any).item?.Location
    });
    
    // 🔧 신장 같은 경우 상태가 없으므로 병원명만 표시
    const headerText = statusText ? `${locationText} | ${statusText}` : locationText;
    
    const tooltipContent = `
      <div class="wello-chart-tooltip__header">${headerText}</div>
      <div class="wello-chart-tooltip__value">${valueFormat(point.value)}${seriesData.unit ? ` ${seriesData.unit}` : ''}</div>
    `;

    console.log('🔍 [툴팁] 툴팁 설정:', { 
      x: event.clientX - rect.left, 
      y: event.clientY - rect.top, 
      content: tooltipContent 
    });

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

          {/* 🔧 건강범위 음영을 포인트보다 먼저 렌더링 (포인트가 위에 표시되도록) */}
          {healthRanges && (() => {
            const renderRangeZone = (range: { min: number; max: number } | null, color: string, opacity: number, label: string, strokeOpacity: number = 0.3) => {
              if (!range) return null;
              
              const rangeMinY = margin.top + chartHeight * 0.05 + (1 - (range.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
              const rangeMaxY = margin.top + chartHeight * 0.05 + (1 - (range.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
              
              // 범위가 차트 범위와 겹치는 경우만 표시
              if (range.max >= chartData.minValue && range.min <= chartData.maxValue) {
                const clampedMinY = Math.max(rangeMinY, margin.top);
                const clampedMaxY = Math.min(rangeMaxY, margin.top + chartHeight);
                const rectHeight = Math.max(0, clampedMaxY - clampedMinY);
                
                if (rectHeight > 5) { // 최소 높이 확보
                  return (
                    <rect
                      key={label}
                      x={margin.left}
                      y={clampedMinY}
                      width={chartWidth}
                      height={rectHeight}
                      fill={`rgba(${color}, ${opacity})`}
                      stroke={`rgba(${color}, ${strokeOpacity})`}
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      style={{ pointerEvents: 'none' }} // 🔧 마우스 이벤트 차단 방지
                    />
                  );
                }
              }
              return null;
            };

            return (
              <g className="wello-line-chart__health-zones" style={{ pointerEvents: 'none' }}>
                {/* 정상 범위 (초록색) */}
                {renderRangeZone(healthRanges.normal, '34, 197, 94', 0.15, '정상')}
                
                {/* 경계 범위 (더 진한 주황색) */}
                {renderRangeZone(healthRanges.borderline, '251, 146, 60', 0.15, '경계')}
                
                {/* 이상 범위 (더 진한 빨간색) */}
                {renderRangeZone(healthRanges.abnormal, '220, 38, 127', 0.12, '이상')}
                
                {/* 범위 라벨들 - 각 영역 내부에 배치 */}
                {healthRanges.normal && (() => {
                  const normalMinY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.normal.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const normalMaxY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.normal.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const clampedMinY = Math.max(normalMinY, margin.top);
                  const clampedMaxY = Math.min(normalMaxY, margin.top + chartHeight);
                  const centerY = clampedMinY + (clampedMaxY - clampedMinY) / 2;
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={centerY}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="rgba(34, 197, 94, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        정상
                      </text>
                    );
                  }
                  return null;
                })()}
                
                {healthRanges.borderline && (() => {
                  const borderlineMinY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.borderline.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const borderlineMaxY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.borderline.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const clampedMinY = Math.max(borderlineMinY, margin.top);
                  const clampedMaxY = Math.min(borderlineMaxY, margin.top + chartHeight);
                  const centerY = clampedMinY + (clampedMaxY - clampedMinY) / 2;
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={centerY}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="rgba(251, 146, 60, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        경계
                      </text>
                    );
                  }
                  return null;
                })()}
                
                {healthRanges.abnormal && (() => {
                  const abnormalMinY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.abnormal.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const abnormalMaxY = margin.top + chartHeight * 0.05 + (1 - (healthRanges.abnormal.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
                  const clampedMinY = Math.max(abnormalMinY, margin.top);
                  const clampedMaxY = Math.min(abnormalMaxY, margin.top + chartHeight);
                  const centerY = clampedMinY + (clampedMaxY - clampedMinY) / 2;
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={centerY}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="rgba(220, 38, 127, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        이상
                      </text>
                    );
                  }
                  return null;
                })()}
              </g>
            );
          })()}

          {/* 기존 단일 정상 범위 (healthRanges가 없을 때만) */}
          {!healthRanges && normalRange && (() => {
            const normalMinY = margin.top + chartHeight * 0.05 + (1 - (normalRange.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
            const normalMaxY = margin.top + chartHeight * 0.05 + (1 - (normalRange.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.2;
            
            if (normalRange.max >= chartData.minValue && normalRange.min <= chartData.maxValue) {
              const clampedMinY = Math.max(normalMinY, margin.top);
              const clampedMaxY = Math.min(normalMaxY, margin.top + chartHeight);
              const rectHeight = Math.max(0, clampedMaxY - clampedMinY);
              
              if (rectHeight > 0) {
                return (
                  <g className="wello-line-chart__normal-zone" style={{ pointerEvents: 'none' }}>
                    <rect
                      x={margin.left}
                      y={clampedMinY}
                      width={chartWidth}
                      height={rectHeight}
                      fill="rgba(34, 197, 94, 0.15)"
                      stroke="rgba(34, 197, 94, 0.3)"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={margin.left + chartWidth - 5}
                      y={clampedMinY + rectHeight / 2}
                      className="wello-line-chart__normal-zone-label"
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="rgba(34, 197, 94, 0.8)"
                      fontSize="10"
                      fontWeight="500"
                      style={{ pointerEvents: 'none' }}
                    >
                      정상범위
                    </text>
                  </g>
                );
              }
            }
            return null;
          })()}

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
                    key={`${seriesData.id}-point-${point.date}-${pointIndex}`}
                    cx={x}
                    cy={y}
                    r={6} // 🔧 반지름을 늘려서 클릭 영역 확대
                    className={`wello-line-chart__point ${point.status ? `wello-line-chart__point--${point.status}` : ''}`}
                    style={{
                      fill: '#7c746a', // 플로팅 버튼 색상으로 고정
                      stroke: '#ffffff',
                      strokeWidth: 2,
                      cursor: 'pointer', // 🔧 커서 포인터 추가
                      pointerEvents: 'all' // 🔧 포인터 이벤트 명시적 활성화
                    }}
                    onMouseEnter={(e) => {
                      console.log(`🔍 [툴팁] 포인트 마우스 엔터: ${seriesData.name}, 값: ${point.value}`);
                      handlePointHover(e, point, seriesData);
                    }}
                    onMouseLeave={() => {
                      console.log(`🔍 [툴팁] 포인트 마우스 리브: ${seriesData.name}`);
                      handleMouseLeave();
                    }}
                    onClick={(e) => {
                      console.log(`🔍 [툴팁] 포인트 클릭: ${seriesData.name}, 값: ${point.value}`);
                      handlePointHover(e, point, seriesData);
                    }}
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
              
              // Y축 라벨 범위 확장 - 위는 고정, 아래만 늘림
              const usableHeight = chartHeight * 1.2; // 120% 사용 (아래쪽으로 확장)
              const topPadding = chartHeight * 0.05; // 위쪽 고정 (5% 여유)
              const y = margin.top + topPadding + ratio * usableHeight;
              
              // Y축 계산 완료 - 디버깅 로그 제거
              
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
            onMouseEnter={() => console.log('🔍 [툴팁] 툴팁 렌더링됨:', tooltip)}
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
