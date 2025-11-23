/**
 * LineChart - 건강 수치 추이를 보여주는 라인 차트
 * 혈압, 혈당, 콜레스테롤 등 시계열 건강 데이터 시각화
 */
import React, { useMemo, useRef, useState } from 'react';
import BaseChart, { BaseChartProps, ChartDimensions } from '../BaseChart';
import { HealthStatus } from '../../../types/health';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
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
  healthRanges?: { // 다중 건강 범위 표시 - ItemReferences의 Name 포함
    normal: { min: number; max: number; name?: string } | null;
    borderline: { min: number; max: number; name?: string } | null;
    abnormal: { min: number; max: number; name?: string } | null;
  };
  allYears?: number[]; // 통합 년도 목록 (외부에서 전달받음)
  metric?: string; // 지표명 (체중, 신장 등) - Y축 범위 계산에 사용
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
  allYears,
  metric,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });
  
  // 선택된 포인트 상태 관리 (시리즈별로 관리)
  const [selectedPoints, setSelectedPoints] = useState<{ [seriesId: string]: string | null }>({});

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
      typeof v === 'number' && !isNaN(v) && isFinite(v) && v > 0
    );
    
    // 유효한 값이 없으면 기본값 사용
    if (values.length === 0) {
      return {
        minDate: new Date(),
        maxDate: new Date(),
        minValue: 0,
        maxValue: 100,
        dateRange: 1
      };
    }
    
    // 실제 데이터의 최소값과 최대값 계산
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    
    // 값 범위 계산 - healthRanges를 고려하여 Y축 범위 설정
    let minValue: number;
    let maxValue: number;
    
    // 체중/신장의 경우 실제 데이터 값만 사용 (healthRanges 무시)
    if (metric === '체중' || metric === '신장') {
      minValue = dataMin;
      maxValue = dataMax;
    } else if (!healthRanges) {
      // healthRanges가 없을 때는 실제 데이터 값 범위 사용
      minValue = dataMin;
      maxValue = dataMax;
    } else {
      // healthRanges가 있을 때는 기존 로직 사용
      const referenceValues = allPoints.flatMap(p => 
        p.reference ? [p.reference.min, p.reference.max, p.reference.optimal].filter(v => 
          typeof v === 'number' && !isNaN(v) && isFinite(v)
        ) : []
      ) as number[];
      
      const allValues = [...values, ...referenceValues];
      
      // healthRanges에서 범위 값 추출 (Y축 동적 설정을 위해)
      const healthRangeValues: number[] = [];
      if (healthRanges.normal && healthRanges.normal.min !== null && healthRanges.normal.max !== null) {
        healthRangeValues.push(healthRanges.normal.min, healthRanges.normal.max);
      }
      if (healthRanges.borderline && healthRanges.borderline.min !== null && healthRanges.borderline.max !== null) {
        healthRangeValues.push(healthRanges.borderline.min, healthRanges.borderline.max);
      }
      if (healthRanges.abnormal && healthRanges.abnormal.min !== null && healthRanges.abnormal.max !== null) {
        healthRangeValues.push(healthRanges.abnormal.min, healthRanges.abnormal.max);
      }
      
      // 모든 값 통합 (데이터 값 + 참조선 값 + healthRanges 값)
      const allRangeValues = [...allValues, ...healthRangeValues];
      
      if (allRangeValues.length === 0) {
        minValue = dataMin;
        maxValue = dataMax;
      } else {
        // healthRanges가 있으면 범위를 더 넓게 설정하여 모든 영역이 보이도록
        const rangeMinValues: number[] = [];
        const rangeMaxValues: number[] = [];
        
        if (healthRanges.normal && healthRanges.normal.min !== null && healthRanges.normal.max !== null) {
          rangeMinValues.push(healthRanges.normal.min);
          rangeMaxValues.push(healthRanges.normal.max);
        }
        if (healthRanges.borderline && healthRanges.borderline.min !== null && healthRanges.borderline.max !== null) {
          rangeMinValues.push(healthRanges.borderline.min);
          rangeMaxValues.push(healthRanges.borderline.max);
        }
        if (healthRanges.abnormal && healthRanges.abnormal.min !== null && healthRanges.abnormal.max !== null) {
          rangeMinValues.push(healthRanges.abnormal.min);
          rangeMaxValues.push(healthRanges.abnormal.max);
        }
        
        // healthRanges의 최소값과 최대값을 고려
        if (rangeMinValues.length > 0) {
          const rangeMin = Math.min(...rangeMinValues);
          minValue = Math.min(dataMin, rangeMin);
        } else {
          minValue = dataMin;
        }
        
        if (rangeMaxValues.length > 0) {
          const rangeMax = Math.max(...rangeMaxValues);
          // healthRanges.max가 실제 데이터보다 훨씬 크면 실제 데이터 범위 + 여백 사용
          if (rangeMax > dataMax * 3) {
            const normalMin = healthRanges.normal?.min;
            if (normalMin && normalMin > dataMax) {
              maxValue = Math.max(dataMax * 1.2, normalMin * 1.1);
            } else {
              maxValue = dataMax * 1.2;
            }
          } else {
            maxValue = Math.max(dataMax, rangeMax);
          }
        } else {
          const normalMin = healthRanges.normal?.min;
          if (normalMin && normalMin > dataMax) {
            maxValue = Math.max(dataMax * 1.2, normalMin * 1.1);
          } else {
            maxValue = dataMax;
          }
        }
      }
    }
    
    // 지표별 Y축 범위 계산
    let finalMinValue = minValue;
    let finalMaxValue = maxValue;
    
    if (metric === '체중') {
      // 체중: 실제 데이터 최소값/최대값 기준으로 위아래 10kg씩 여유
      // dataMin, dataMax는 이미 계산되어 있음
      finalMinValue = Math.max(0, dataMin - 10); // 음수 방지
      finalMaxValue = dataMax + 10;
    } else if (metric === '신장') {
      // 신장: 실제 데이터 최소값/최대값 기준으로 위아래 10cm씩 여유
      // dataMin, dataMax는 이미 계산되어 있음
      finalMinValue = Math.max(0, dataMin - 10); // 음수 방지
      finalMaxValue = dataMax + 10;
    } else {
      // 기타 지표: 기존 로직 유지 (상단 5%, 하단 5% 여백)
      const valueRange = maxValue - minValue || 1; // 0으로 나누기 방지
      const topPadding = valueRange * 0.05;
      const bottomPadding = valueRange * 0.05;
      finalMinValue = Math.max(0, minValue - bottomPadding); // 음수 방지
      finalMaxValue = maxValue + topPadding;
    }

    return {
      minDate,
      maxDate,
      minValue: finalMinValue,
      maxValue: finalMaxValue,
      dateRange: maxDate.getTime() - minDate.getTime() || 1 // 0으로 나누기 방지
    };
  }, [series, healthRanges, metric]);

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
    
    // 통합 년도 목록 사용 (외부에서 전달받거나 시리즈에서 추출)
    let sortedYears: number[];
    if (allYears && allYears.length > 0) {
      // 외부에서 전달받은 통합 년도 목록 사용
      sortedYears = [...allYears].sort((a, b) => b - a); // 최신 년도 순
    } else {
      // 기존 로직: 모든 시리즈에서 년도 추출
      const allYearsSet = new Set<number>();
      series.forEach(s => {
        s.data.forEach(p => {
          if (p.date) {
            const year = new Date(p.date).getFullYear();
            if (!isNaN(year)) {
              allYearsSet.add(year);
            }
          }
        });
      });
      sortedYears = Array.from(allYearsSet).sort((a, b) => b - a); // 최신 년도 순
    }
    
    // 해당 년도의 인덱스 찾기
    const yearIndex = sortedYears.indexOf(pointYear);
    if (yearIndex === -1) {
      // 데이터에 없는 년도면 가장 가까운 위치로
      return { x: margin.left, y: margin.top + chartHeight / 2 };
    }
    
    // X축 좌표 계산: 년도 개수에 맞게 동적 계산
    const x = margin.left + (chartWidth / (sortedYears.length - 1 || 1)) * yearIndex;
    
    // Y축 라벨 범위 확장에 맞게 점 위치도 조정
    const valueRatio = (value - chartData.minValue) / (chartData.maxValue - chartData.minValue);
    const expandedHeight = chartHeight * 1.02; // Y축 라벨과 동일한 확장 비율 (102%로 최소화)
    const expandedTopPadding = chartHeight * 0.005; // Y축 라벨과 동일한 상단 패딩 (0.5%로 최소화)
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
    
    // 🔧 신장 같은 경우 상태가 없으므로 병원명만 표시
    const headerText = statusText ? `${locationText} | ${statusText}` : locationText;
    
    const tooltipContent = `
      <div class="wello-chart-tooltip__header">${headerText}</div>
      <div class="wello-chart-tooltip__value">${valueFormat(point.value)}${seriesData.unit ? ` ${seriesData.unit}` : ''}</div>
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
      <div className="wello-line-chart" style={{ overflow: 'visible' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="wello-line-chart__svg"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label={`${baseProps.title || '라인 차트'} - ${series.length}개 데이터 시리즈`}
        >
          {/* 배경 그리드 */}
          {showGrid && (() => {
            // Y축 그리드 라인을 4개로 증가 (기존 3개에서 변경)
            const yGridLines = Array.from({ length: 5 }, (_, i) => i); // 0, 1, 2, 3, 4 (4개 구간)
            // X축 그리드 라인: 통합 년도 목록에 맞게 동적 생성
            const sortedYears = allYears && allYears.length > 0 
              ? [...allYears].sort((a, b) => b - a)
              : (() => {
                  const allYearsSet = new Set<number>();
                  series.forEach(s => {
                    s.data.forEach(p => {
                      if (p.date) {
                        const year = new Date(p.date).getFullYear();
                        if (!isNaN(year)) {
                          allYearsSet.add(year);
                        }
                      }
                    });
                  });
                  return Array.from(allYearsSet).sort((a, b) => b - a);
                })();
            const xGridLines = Array.from({ length: sortedYears.length }, (_, i) => i);
            return (
              <g className="wello-line-chart__grid">
                {/* 세로 그리드 라인 */}
                {xGridLines.map((i) => {
                  const x = margin.left + (i / (sortedYears.length - 1 || 1)) * chartWidth;
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
                
                {/* 가로 그리드 라인 - 4개 구간으로 분할 */}
                {yGridLines.map((i) => {
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
            );
          })()}

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
              
              // 🔧 범위가 실제 데이터 범위를 벗어나는 경우 처리
              // 예: 정상(A)가 "60이상"이고 max가 600인데, 실제 데이터는 35-55 범위인 경우
              // 정상 범위의 min이 실제 데이터 max보다 크면 차트 상단까지 확장
              let effectiveMin = range.min;
              let effectiveMax = range.max;
              
              // 범위의 min이 실제 데이터 max보다 크면 (예: 정상 60이상, 데이터 35-55)
              // 차트 상단까지 확장하여 표시
              if (range.min > chartData.maxValue) {
                // 범위가 차트 범위를 완전히 벗어나면 표시하지 않음
                // 하지만 사용자가 볼 수 있도록 차트 상단에 작은 영역으로 표시
                effectiveMin = chartData.maxValue;
                effectiveMax = Math.max(chartData.maxValue * 1.1, range.min); // 최소한 range.min까지
              }
              
              // 범위의 max가 실제 데이터 min보다 작으면 차트 하단까지 확장
              if (range.max < chartData.minValue) {
                effectiveMin = Math.min(chartData.minValue * 0.9, range.max);
                effectiveMax = chartData.minValue;
              }
              
              // 여백 최소화: 상단 0.5%, 확장 비율 102%
              const rangeMinY = margin.top + chartHeight * 0.005 + (1 - (effectiveMax - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
              const rangeMaxY = margin.top + chartHeight * 0.005 + (1 - (effectiveMin - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
              
              // 범위가 차트 범위와 겹치는 경우만 표시 (또는 범위가 차트 범위를 포함하는 경우)
              if (effectiveMax >= chartData.minValue && effectiveMin <= chartData.maxValue) {
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

            // 🔧 영역 간 빈 공간 제거를 위한 범위 조정
            const adjustRangesForContinuity = () => {
              const adjusted = {
                normal: healthRanges.normal ? { ...healthRanges.normal } : null,
                borderline: healthRanges.borderline ? { ...healthRanges.borderline } : null,
                abnormal: healthRanges.abnormal ? { ...healthRanges.abnormal } : null
              };
              
              // 정상과 경계 사이 빈 공간 제거
              if (adjusted.normal && adjusted.borderline) {
                // 정상의 max가 경계의 min보다 작으면 경계의 min을 정상의 max로 조정
                if (adjusted.normal.max < adjusted.borderline.min) {
                  adjusted.borderline.min = adjusted.normal.max;
                }
                // 경계의 min이 정상의 max보다 크면 정상의 max를 경계의 min으로 조정
                if (adjusted.borderline.min > adjusted.normal.max) {
                  adjusted.normal.max = adjusted.borderline.min;
                }
              }
              
              // 경계와 이상 사이 빈 공간 제거
              if (adjusted.borderline && adjusted.abnormal) {
                // 경계의 max가 이상의 min보다 작으면 이상의 min을 경계의 max로 조정
                if (adjusted.borderline.max < adjusted.abnormal.min) {
                  adjusted.abnormal.min = adjusted.borderline.max;
                }
                // 이상의 min이 경계의 max보다 크면 경계의 max를 이상의 min으로 조정
                if (adjusted.abnormal.min > adjusted.borderline.max) {
                  adjusted.borderline.max = adjusted.abnormal.min;
                }
              }
              
              // 정상과 이상 사이 빈 공간 제거 (경계가 없는 경우)
              if (adjusted.normal && adjusted.abnormal && !adjusted.borderline) {
                // 정상의 max와 이상의 min 사이의 빈 공간 제거
                // 예: 정상 max가 89.9이고 이상 min이 90이면, 둘 다 90으로 맞춤
                if (adjusted.normal.max < adjusted.abnormal.min) {
                  // 정상의 max를 이상의 min으로 조정 (연속성 확보)
                  adjusted.normal.max = adjusted.abnormal.min;
                }
                // 이상의 min이 정상의 max보다 크면 정상의 max를 이상의 min으로 조정
                if (adjusted.abnormal.min > adjusted.normal.max) {
                  adjusted.normal.max = adjusted.abnormal.min;
                }
                // 이상의 min이 정상의 max보다 작으면 이상의 min을 정상의 max로 조정
                if (adjusted.abnormal.min < adjusted.normal.max) {
                  adjusted.abnormal.min = adjusted.normal.max;
                }
              }
              
              return adjusted;
            };
            
            const adjustedRanges = adjustRangesForContinuity();

            return (
              <g className="wello-line-chart__health-zones" style={{ pointerEvents: 'none' }}>
                {/* 정상 범위 (초록색) - ItemReferences의 Name 사용 */}
                {renderRangeZone(adjustedRanges.normal, '34, 197, 94', 0.15, adjustedRanges.normal?.name || '정상')}
                
                {/* 경계 범위 (더 진한 주황색) - ItemReferences의 Name 사용 */}
                {renderRangeZone(adjustedRanges.borderline, '251, 146, 60', 0.15, adjustedRanges.borderline?.name || '경계')}
                
                {/* 이상 범위 (더 진한 빨간색) - ItemReferences의 Name 사용 */}
                {renderRangeZone(adjustedRanges.abnormal, '220, 38, 127', 0.12, adjustedRanges.abnormal?.name || '이상')}
                
                {/* 범위 라벨들 - 각 영역의 왼쪽 상단 모서리에 배치, ItemReferences의 Name 사용 */}
                {adjustedRanges.normal && (() => {
                  const normalMinY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.normal.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const normalMaxY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.normal.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const clampedMinY = Math.max(normalMinY, margin.top);
                  const clampedMaxY = Math.min(normalMaxY, margin.top + chartHeight);
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={clampedMinY + 4}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="hanging"
                        fill="rgba(34, 197, 94, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {adjustedRanges.normal.name || '정상'}
                      </text>
                    );
                  }
                  return null;
                })()}
                
                {adjustedRanges.borderline && (() => {
                  const borderlineMinY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.borderline.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const borderlineMaxY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.borderline.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const clampedMinY = Math.max(borderlineMinY, margin.top);
                  const clampedMaxY = Math.min(borderlineMaxY, margin.top + chartHeight);
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={clampedMinY + 4}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="hanging"
                        fill="rgba(251, 146, 60, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {adjustedRanges.borderline.name || '경계'}
                      </text>
                    );
                  }
                  return null;
                })()}
                
                {adjustedRanges.abnormal && (() => {
                  const abnormalMinY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.abnormal.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const abnormalMaxY = margin.top + chartHeight * 0.005 + (1 - (adjustedRanges.abnormal.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
                  const clampedMinY = Math.max(abnormalMinY, margin.top);
                  const clampedMaxY = Math.min(abnormalMaxY, margin.top + chartHeight);
                  
                  if (clampedMaxY - clampedMinY > 15) { // 충분한 높이가 있을 때만 표시
                    return (
                      <text
                        x={margin.left + 8}
                        y={clampedMinY + 4}
                        className="wello-line-chart__range-label"
                        textAnchor="start"
                        dominantBaseline="hanging"
                        fill="rgba(220, 38, 127, 0.9)"
                        fontSize="10"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {adjustedRanges.abnormal.name || '이상'}
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
            const normalMinY = margin.top + chartHeight * 0.005 + (1 - (normalRange.max - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
            const normalMaxY = margin.top + chartHeight * 0.005 + (1 - (normalRange.min - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * chartHeight * 1.02;
            
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
                
                // 🔧 선택된 포인트 확인: 클릭된 포인트 또는 초기 상태에서 최신 날짜(첫 번째 포인트)
                // 데이터는 최신 년도 순으로 정렬되어 있으므로 첫 번째 포인트가 최신 데이터
                const isFirstPoint = pointIndex === 0;
                const selectedPointKey = selectedPoints[seriesData.id];
                const isSelected = selectedPointKey 
                  ? selectedPointKey === `${point.date}-${pointIndex}` 
                  : isFirstPoint; // 🔧 초기 상태에서는 첫 번째 포인트(최신 날짜)가 선택된 것처럼
                
                // 🔧 원 크기 고정: 선택된 포인트 22px (radius 11), 비선택 11px (radius 5.5)
                const radius = isSelected ? 11 : 5.5; // 선택된 포인트: 22*22 (radius 11), 비선택: 11*11 (radius 5.5)
                const strokeWidth = 2; // 테두리 두께 고정
                const innerRadius = isSelected ? 4.4 : 2.2; // 중앙 흰색 원 크기 - 선택/비선택에 비례 (선택: 8.8*8.8, 비선택: 4.4*4.4)
                
                // 상태에 따른 원 색상 결정 (뱃지 색상과 동일)
                // 문제 발생 시에만 로그 출력
                if (!point.status) {
                  console.warn(`⚠️ [포인트 상태 없음] ${seriesData.name}, 날짜: ${point.date}, 값: ${point.value}`);
                }
                
                let circleColor = '#A16A51'; // 기본값: 측정 (갈색)
                if (point.status === 'normal') {
                  circleColor = '#61A82C'; // 정상: 초록색
                } else if (point.status === 'warning') {
                  circleColor = '#EE6A31'; // 경계: 주황색
                } else if (point.status === 'abnormal' || point.status === 'danger') {
                  circleColor = '#D73F3F'; // 이상: 빨간색
                } else if (point.status === 'neutral' || point.status === 'unknown') {
                  circleColor = '#A16A51'; // 측정: 갈색
                } else {
                  // 상태가 없거나 알 수 없는 경우 기본 갈색
                  circleColor = '#A16A51';
                }
                
                return (
                  <g key={`${seriesData.id}-point-${point.date}-${pointIndex}`}>
                    {/* 외부 원 (상태별 색상) - fill로 색상 채우고 내부 흰색 원을 위에 그리기 */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius} // 🔧 SVG 속성으로 직접 설정 - CSS 오버라이딩 방지
                      className={`wello-line-chart__point ${point.status ? `wello-line-chart__point--${point.status}` : 'wello-line-chart__point--neutral'} ${isSelected ? 'wello-line-chart__point--selected' : ''}`}
                      style={{
                        fill: circleColor, // 🔧 fill로 색상 채워서 원 크기가 명확하게 보이도록
                        stroke: circleColor, // 외곽선도 동일한 색상
                        strokeWidth: strokeWidth,
                        cursor: 'pointer',
                        pointerEvents: 'all',
                        // 🔧 SVG의 r 속성은 transition으로 제어할 수 없으므로 제거
                        transition: 'stroke-width 0.2s ease, fill-opacity 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        handlePointHover(e, point, seriesData);
                      }}
                      onMouseLeave={() => {
                        handleMouseLeave();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const pointKey = `${point.date}-${pointIndex}`;
                        setSelectedPoints(prev => ({
                          ...prev,
                          [seriesData.id]: prev[seriesData.id] === pointKey ? null : pointKey // 같은 포인트 클릭 시 해제, 다른 포인트 클릭 시 선택
                        }));
                        handlePointHover(e, point, seriesData);
                      }}
                    />
                    {/* 중앙 흰색 원 - 외부 원 위에 그려서 내부 흰색 원이 보이도록 */}
                    <circle
                      cx={x}
                      cy={y}
                      r={innerRadius}
                      style={{
                        fill: '#ffffff', // 흰색
                        pointerEvents: 'none' // 클릭 이벤트는 외부 원에서만 처리
                      }}
                    />
                  </g>
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
                
                // 통합 년도 목록 사용 (외부에서 전달받거나 시리즈에서 추출)
                let sortedYears: number[];
                if (allYears && allYears.length > 0) {
                  // 외부에서 전달받은 통합 년도 목록 사용
                  sortedYears = [...allYears].sort((a, b) => b - a); // 최신 년도 순
                } else {
                  // 기존 로직: 모든 시리즈에서 년도 추출
                  sortedYears = Array.from(dataYears)
                    .sort((a, b) => b - a);
                }
                
                // 년도 개수에 맞게 동적 슬롯 생성
                const xAxisSlots = Array.from({ length: sortedYears.length }, (_, index) => index);
                return xAxisSlots.map((index) => {
                  const x = margin.left + (chartWidth / (sortedYears.length - 1 || 1)) * index;
                  const year = sortedYears[index];
                  
                  if (year) {
                    return (
                      <g key={`x-label-${year}`}>
                        <text
                          x={x}
                          y={margin.top + chartHeight + 20}
                          className="wello-line-chart__axis-label"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ fontSize: '10px' }}
                        >
                          {year.toString().slice(-2)}년
                        </text>
                      </g>
                    );
                  } else {
                    // 데이터가 없는 년도에 웰노 이미지 표시
                    return (
                      <g key={`x-empty-${index}`}>
                        <image
                          x={x - 8}
                          y={margin.top + chartHeight + 10}
                          width="16"
                          height="16"
                          href={WELLO_LOGO_IMAGE || "/wello/wello-icon.png"}
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
            
            {/* Y축 레이블 - 4개로 증가 (기존 3개에서 변경) */}
            {Array.from({ length: 5 }, (_, i) => {
              const ratio = i / 4; // 5개 구간으로 분할 (0, 0.25, 0.5, 0.75, 1.0)
              const value = chartData.minValue + (1 - ratio) * (chartData.maxValue - chartData.minValue);
              const roundedValue = Math.round(value);
              
              // 0은 표시하지 않음
              if (roundedValue === 0) return null;
              
              // Y축 라벨 범위 확장 - 위는 고정, 아래만 늘림 (여백 최소화)
              const usableHeight = chartHeight * 1.02; // 102% 사용 (여백 최소화)
              const topPadding = chartHeight * 0.005; // 위쪽 여유 최소화 (0.5%)
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
