/**
 * PieChart - 건강 상태 분포 파이 차트
 * 정상/주의/위험 비율 시각화
 */
import React, { useMemo, useRef, useState } from 'react';
import BaseChart, { BaseChartProps, ChartDimensions } from '../BaseChart';
import './styles.scss';

export interface PieChartDataPoint {
  label: string;
  value: number;
  color?: string;
  percentage?: number;
  metadata?: {
    [key: string]: any;
  };
}

export interface PieChartProps extends BaseChartProps {
  data: PieChartDataPoint[];
  innerRadius?: number; // 도넛 차트용 (0-1 비율)
  showLabels?: boolean;
  showPercentages?: boolean;
  showLegend?: boolean;
  animationDuration?: number;
  onSliceClick?: (slice: PieChartDataPoint) => void;
  onSliceHover?: (slice: PieChartDataPoint | null) => void;
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  innerRadius = 0,
  showLabels = true,
  showPercentages = true,
  showLegend = true,
  animationDuration = 300,
  onSliceClick,
  onSliceHover,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' });

  // 데이터 전처리
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return null;

    let currentAngle = -Math.PI / 2; // 12시 방향부터 시작

    const processedData = data.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (item.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      currentAngle = endAngle;

      // 기본 색상 할당
      const defaultColors = [
        'var(--color-success)',
        'var(--color-warning)', 
        'var(--color-danger)',
        'var(--color-primary)',
        'var(--color-gray-500)'
      ];

      return {
        ...item,
        percentage,
        startAngle,
        endAngle,
        color: item.color || defaultColors[index % defaultColors.length]
      };
    });

    return {
      total,
      data: processedData
    };
  }, [data]);

  // SVG 경로 생성
  const createArcPath = (
    centerX: number,
    centerY: number,
    outerRadius: number,
    innerRadiusValue: number,
    startAngle: number,
    endAngle: number
  ) => {
    const x1 = centerX + outerRadius * Math.cos(startAngle);
    const y1 = centerY + outerRadius * Math.sin(startAngle);
    const x2 = centerX + outerRadius * Math.cos(endAngle);
    const y2 = centerY + outerRadius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    let path = `M ${centerX + innerRadiusValue * Math.cos(startAngle)} ${centerY + innerRadiusValue * Math.sin(startAngle)}`;
    path += ` L ${x1} ${y1}`;
    path += ` A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
    path += ` L ${centerX + innerRadiusValue * Math.cos(endAngle)} ${centerY + innerRadiusValue * Math.sin(endAngle)}`;
    
    if (innerRadiusValue > 0) {
      path += ` A ${innerRadiusValue} ${innerRadiusValue} 0 ${largeArcFlag} 0 ${centerX + innerRadiusValue * Math.cos(startAngle)} ${centerY + innerRadiusValue * Math.sin(startAngle)}`;
    }
    
    path += ' Z';

    return path;
  };

  // 라벨 위치 계산
  const getLabelPosition = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius * 0.7;
    
    return {
      x: centerX + labelRadius * Math.cos(midAngle),
      y: centerY + labelRadius * Math.sin(midAngle)
    };
  };

  // 슬라이스 호버 처리
  const handleSliceHover = (
    event: React.MouseEvent,
    slice: PieChartDataPoint | null
  ) => {
    if (!slice) {
      setHoveredSlice(null);
      setTooltip(prev => ({ ...prev, visible: false }));
      onSliceHover?.(null);
      return;
    }

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    setHoveredSlice(slice.label);
    
    const tooltipContent = `
      <div class="wello-chart-tooltip__title">${slice.label}</div>
      <div class="wello-chart-tooltip__value">${slice.value}건</div>
      <div class="wello-chart-tooltip__percentage">${slice.percentage?.toFixed(1)}%</div>
    `;

    setTooltip({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      content: tooltipContent
    });

    onSliceHover?.(slice);
  };

  const handleMouseLeave = () => {
    setHoveredSlice(null);
    setTooltip(prev => ({ ...prev, visible: false }));
    onSliceHover?.(null);
  };

  // 차트 렌더링
  const renderChart = (dimensions: ChartDimensions) => {
    if (!chartData || !chartData.data.length) {
      return (
        <div className="wello-pie-chart__empty">
          <p>표시할 데이터가 없습니다</p>
        </div>
      );
    }

    const { width, height, margin } = dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const centerX = margin.left + chartWidth / 2;
    const centerY = margin.top + chartHeight / 2;
    const outerRadius = Math.min(chartWidth, chartHeight) / 2 - 20;
    const innerRadiusValue = outerRadius * innerRadius;

    return (
      <div className="wello-pie-chart">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="wello-pie-chart__svg"
          role="img"
          aria-label={`${baseProps.title || '파이 차트'} - ${chartData.data.length}개 항목`}
        >
          {/* 파이 슬라이스 */}
          <g className="wello-pie-chart__slices">
            {chartData.data.map((slice, index) => {
              const isHovered = hoveredSlice === slice.label;
              const hoverRadius = isHovered ? outerRadius + 5 : outerRadius;
              
              return (
                <g key={`slice-${index}`}>
                  <path
                    d={createArcPath(
                      centerX,
                      centerY,
                      hoverRadius,
                      innerRadiusValue,
                      slice.startAngle,
                      slice.endAngle
                    )}
                    className={`wello-pie-chart__slice ${isHovered ? 'wello-pie-chart__slice--hovered' : ''}`}
                    style={{ 
                      fill: slice.color,
                      transition: `all ${animationDuration}ms ease`
                    }}
                    onMouseEnter={(e) => handleSliceHover(e, slice)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => onSliceClick?.(slice)}
                  />

                  {/* 라벨 */}
                  {showLabels && slice.percentage! > 5 && (
                    <g>
                      {(() => {
                        const labelPos = getLabelPosition(
                          centerX,
                          centerY,
                          outerRadius,
                          slice.startAngle,
                          slice.endAngle
                        );
                        
                        return (
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            className="wello-pie-chart__label"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {showPercentages ? `${slice.percentage!.toFixed(1)}%` : slice.label}
                          </text>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 중앙 텍스트 (도넛 차트인 경우) */}
          {innerRadius > 0 && (
            <g className="wello-pie-chart__center">
              <text
                x={centerX}
                y={centerY - 8}
                className="wello-pie-chart__center-value"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {chartData.total}
              </text>
              <text
                x={centerX}
                y={centerY + 12}
                className="wello-pie-chart__center-label"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                총 검진
              </text>
            </g>
          )}
        </svg>

        {/* 범례 */}
        {showLegend && (
          <div className="wello-pie-chart__legend">
            {chartData.data.map((slice, index) => (
              <div
                key={`legend-${index}`}
                className={`wello-pie-chart__legend-item ${hoveredSlice === slice.label ? 'wello-pie-chart__legend-item--active' : ''}`}
                onMouseEnter={(e) => handleSliceHover(e, slice)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onSliceClick?.(slice)}
              >
                <div
                  className="wello-pie-chart__legend-color"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="wello-pie-chart__legend-label">
                  {slice.label}
                </span>
                <span className="wello-pie-chart__legend-value">
                  {slice.value}건 ({slice.percentage!.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        )}

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
    <BaseChart {...baseProps} showLegend={false}>
      {renderChart}
    </BaseChart>
  );
};

export default PieChart;
