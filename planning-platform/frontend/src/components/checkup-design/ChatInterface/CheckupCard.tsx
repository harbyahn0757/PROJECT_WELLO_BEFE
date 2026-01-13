/**
 * 검진 카드 컴포넌트
 */
import React, { useState, useMemo } from 'react';
import './styles.scss';

interface CheckupCardProps {
  id: string;
  year: string;
  date: string;
  location: string;
  abnormalCount: number;
  warningCount: number;
  onClick: (id: string) => void;
  onItemSelect?: (id: string, items: string[]) => void; // 세부 항목 선택 콜백 추가
  selected?: boolean;
  animationDelay?: number; // 애니메이션 딜레이 (ms)
  checkup?: any; // 검진 상세 데이터
}

const CheckupCard: React.FC<CheckupCardProps> = ({
  id,
  year,
  date,
  location,
  abnormalCount,
  warningCount,
  onClick,
  onItemSelect,
  selected = false,
  animationDelay = 0,
  checkup
}) => {
  // year에서 "년" 제거 (이미 포함되어 있을 수 있음)
  const cleanYear = year.toString().replace('년', '').trim();
  
  // 날짜를 뱃지 형식으로 변환 (예: "09/28" -> "21.09")
  const formatDateBadge = (dateStr: string, yearStr: string): string => {
    if (!dateStr) return '';
    // "09/28" 형태에서 월 추출
    const parts = dateStr.split('/');
    if (parts.length >= 1) {
      const month = parts[0].padStart(2, '0');
      // 년도 2자리 (예: 2021 -> 21)
      const yearShort = yearStr.length > 2 ? yearStr.slice(-2) : yearStr;
      return `${yearShort}.${month}`;
    }
    return '';
  };
  
  const dateBadge = formatDateBadge(date, cleanYear);
  const [expanded, setExpanded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 검진 상태 분석
  const { statusCounts, groupedItems } = useMemo(() => {
    const counts = { normal: 0, warning: 0, abnormal: 0 };
    const groups: any = {};
    
    if (!checkup?.Inspections) {
      return { statusCounts: counts, groupedItems: groups };
    }
    
    const bodyMeasurements: any = {};
    
    const determineItemStatus = (item: any): 'normal' | 'warning' | 'abnormal' => {
      if (!item.Value || !item.ItemReferences || item.ItemReferences.length === 0) {
        return 'normal';
      }
      
      const value = item.Value.toString().toLowerCase();
      if (value.includes('정상') || value.includes('음성')) return 'normal';
      if (value.includes('의심') || value.includes('양성')) return 'abnormal';
      
      const numValue = parseFloat(item.Value.toString().replace(/[^0-9.-]/g, ''));
      if (isNaN(numValue)) return 'normal';
      
      const isInRange = (val: number, rangeStr: string): boolean => {
        if (rangeStr.includes('이상')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val >= threshold;
        }
        if (rangeStr.includes('미만')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val < threshold;
        }
        if (rangeStr.includes('이하')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val <= threshold;
        }
        if (rangeStr.includes('-')) {
          const [min, max] = rangeStr.split('-').map(s => parseFloat(s.replace(/[^0-9.-]/g, '')));
          return !isNaN(min) && !isNaN(max) && val >= min && val <= max;
        }
        return false;
      };
      
      // 정상 범위 체크 (우선순위 1) - "정상", "정상(A)", "정상(B)" 모두 포함
      const normal = item.ItemReferences.find((ref: any) => 
        ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
      );
      if (normal && isInRange(numValue, normal.Value)) return 'normal';
      
      // 질환의심 범위 체크 (우선순위 2)
      const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
      if (abnormal && isInRange(numValue, abnormal.Value)) return 'abnormal';
      
      // 정상(B) 또는 경계 범위 체크 (우선순위 3)
      const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
      if (normalB && isInRange(numValue, normalB.Value)) return 'warning';
      
      return 'normal';
    };
    
    checkup.Inspections.forEach((inspection: any) => {
      const groupName = inspection.Gubun;
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      
      if (inspection.Illnesses) {
        inspection.Illnesses.forEach((illness: any) => {
          if (illness.Items) {
            illness.Items.forEach((item: any) => {
              const itemName = item.Name;
              
              if (itemName === '신장' || itemName === '체중' || itemName === '허리둘레') {
                bodyMeasurements[itemName] = {
                  name: itemName,
                  value: item.Value,
                  unit: item.Unit || '',
                  references: item.ItemReferences || [],
                  status: determineItemStatus(item),
                  illnessName: illness.Name
                };
                return;
              }
              
              const status = determineItemStatus(item);
              counts[status]++;
              
              groups[groupName].push({
                name: item.Name,
                value: item.Value,
                unit: item.Unit || '',
                references: item.ItemReferences || [],
                status: status,
                illnessName: illness.Name
              });
            });
          }
        });
      }
    });
    
    // 신체계측 통합 카드
    if (bodyMeasurements['신장'] || bodyMeasurements['체중'] || bodyMeasurements['허리둘레']) {
      const waistStatus = bodyMeasurements['허리둘레']?.status || 'normal';
      counts[waistStatus as keyof typeof counts]++;
      
      const availableGroups = Object.keys(groups);
      const targetGroup = availableGroups.find(group => 
        group.includes('기본') || group.includes('일반') || group.includes('신체') || group.includes('계측')
      ) || availableGroups[0] || '기본검사';
      
      if (!groups[targetGroup]) {
        groups[targetGroup] = [];
      }
      
      groups[targetGroup].unshift({
        name: '신체계측',
        isBodyMeasurement: true,
        measurements: bodyMeasurements,
        status: waistStatus,
        value: '',
        unit: '',
        references: []
      });
    }
    
    return { statusCounts: counts, groupedItems: groups };
  }, [checkup]);

  // 선택된 항목이 변경될 때 상위로 알림을 보내는 헬퍼 함수
  const notifySelectionChange = (newSet: Set<string>) => {
    if (!onItemSelect) return;

    const selectedDetails: string[] = [];
    
    // groupedItems를 순회하며 선택된 항목 찾기
    Object.entries(groupedItems).forEach(([groupName, items]: [string, any]) => {
      items.forEach((item: any, index: number) => {
        const itemId = `${id}-${groupName}-${index}`;
        if (newSet.has(itemId)) {
          // 이름과 상태를 함께 전달 (예: "공복혈당(이상)")
          const statusText = item.status === 'abnormal' ? '이상' : item.status === 'warning' ? '경계' : '정상';
          selectedDetails.push(`${item.name}(${statusText})`);
        }
      });
    });

    onItemSelect(id, selectedDetails);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.checkup-card__checkbox') ||
        (e.target as HTMLElement).closest('.checkup-card__detail-button') ||
        (e.target as HTMLElement).closest('.checkup-card__details')) {
      return;
    }
    onClick(id);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(id);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpanded(!expanded);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'normal': return 'status-normal';
      case 'warning': return 'status-warning';
      case 'abnormal': return 'status-abnormal';
      default: return 'status-normal';
    }
  };

  const renderCheckupDetails = () => {
    if (!expanded || !checkup) return null;
    
    const currentGroup = selectedGroup || Object.keys(groupedItems)[0] || '';
    const items = groupedItems[currentGroup] || [];
    
    return (
      <div className="checkup-card__details">
        {/* 그룹 탭 */}
        {Object.keys(groupedItems).length > 1 && (
          <div className="checkup-card__group-slider">
            {Object.keys(groupedItems).map((groupName) => (
              <button
                key={groupName}
                className={`checkup-card__group-tab ${selectedGroup === groupName ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGroup(groupName);
                  setCurrentSlideIndex(0);
                }}
              >
                {groupName}
              </button>
            ))}
          </div>
        )}
        
        {/* 상태 뱃지 */}
        <div className="checkup-card__status-badges">
          {statusCounts.normal > 0 && (
            <span className="checkup-card__status-badge status-normal">
              정상 {statusCounts.normal}개
            </span>
          )}
          {statusCounts.warning > 0 && (
            <span className="checkup-card__status-badge status-warning">
              경계 {statusCounts.warning}개
            </span>
          )}
          {statusCounts.abnormal > 0 && (
            <span className="checkup-card__status-badge status-abnormal">
              이상 {statusCounts.abnormal}개
            </span>
          )}
        </div>
        
        {/* 항목 슬라이더 */}
        <div 
          className={`checkup-card__items-slider ${
            items.length === 0 
              ? 'checkup-card__items-slider--empty'
              : items.length === 1
              ? 'checkup-card__items-slider--single'
              : 'checkup-card__items-slider--multiple'
          }`}
        >
          {items.length === 0 ? (
            <div className="checkup-card__items-empty">선택 가능한 항목이 없습니다.</div>
          ) : (
            items.map((item: any, index: number) => {
            const itemId = `${id}-${currentGroup}-${index}`;
            const isItemSelected = selectedItems.has(itemId);
            
            const handleItemClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              const newSet = new Set(selectedItems);
              if (newSet.has(itemId)) {
                newSet.delete(itemId);
              } else {
                newSet.add(itemId);
              }
              setSelectedItems(newSet);
              notifySelectionChange(newSet);
            };

            const handleItemCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              e.stopPropagation();
              const newSet = new Set(selectedItems);
              if (newSet.has(itemId)) {
                newSet.delete(itemId);
              } else {
                newSet.add(itemId);
              }
              setSelectedItems(newSet);
              notifySelectionChange(newSet);
            };

            return (
              <div 
                key={index} 
                className={`checkup-card__item ${getStatusBadgeClass(item.status)} ${isItemSelected ? 'checkup-card__item--selected' : ''}`}
                onClick={handleItemClick}
              >
                <div className="checkup-card__item-checkbox-wrapper">
                  <input
                    type="checkbox"
                    className="checkup-card__item-checkbox"
                    checked={isItemSelected}
                    onChange={handleItemCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${item.name} 선택`}
                  />
                </div>
                <div className={`checkup-card__item-badge ${getStatusBadgeClass(item.status)}`}>
                  {item.status === 'normal' ? '정' : item.status === 'warning' ? '경' : '이'}
                </div>
                
                {item.isBodyMeasurement ? (
                  <>
                    <div className="checkup-card__item-name">{item.name}</div>
                    <div className="checkup-card__body-measurements">
                      {item.measurements['신장'] && (
                        <div className="checkup-card__measurement">
                          <span className="checkup-card__measurement-label">신장</span>
                          <span className="checkup-card__measurement-value">
                            {item.measurements['신장'].value}
                            <span className="checkup-card__measurement-unit">{item.measurements['신장'].unit}</span>
                          </span>
                        </div>
                      )}
                      {item.measurements['체중'] && (
                        <div className="checkup-card__measurement">
                          <span className="checkup-card__measurement-label">체중</span>
                          <span className="checkup-card__measurement-value">
                            {item.measurements['체중'].value}
                            <span className="checkup-card__measurement-unit">{item.measurements['체중'].unit}</span>
                          </span>
                        </div>
                      )}
                      {item.measurements['허리둘레'] && (
                        <div className="checkup-card__measurement">
                          <span className="checkup-card__measurement-label">허리둘레</span>
                          <span className="checkup-card__measurement-value">
                            {item.measurements['허리둘레'].value}
                            <span className="checkup-card__measurement-unit">{item.measurements['허리둘레'].unit}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="checkup-card__item-name">{item.name}</div>
                    <div className="checkup-card__item-value">
                      {item.value}
                      <span className="checkup-card__item-unit">{item.unit}</span>
                    </div>
                    {item.references.length > 0 && (
                      <div className="checkup-card__item-references">
                        {item.references.map((ref: any, refIndex: number) => (
                          <div key={refIndex} className="checkup-card__reference">
                            <span className="checkup-card__reference-label">{ref.Name}</span>
                            <span className="checkup-card__reference-range">{ref.Value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          }))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`checkup-card ${selected ? 'checkup-card--selected' : ''} ${expanded ? 'checkup-card--expanded' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className="checkup-card__main"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
      >
        <div className="checkup-card__header">
          <div className="checkup-card__header-left">
          <div className="checkup-card__checkbox-wrapper">
            <input
              type="checkbox"
              className="checkup-card__checkbox"
              checked={selected}
              onChange={() => {}}
              onClick={handleCheckboxClick}
                aria-label={`${cleanYear}년 건강검진 선택`}
            />
          </div>
            {dateBadge && (
              <span className="checkup-card__date-badge">{dateBadge}</span>
          )}
        </div>
          <div className="checkup-card__header-right">
          <div className="checkup-card__status">
            {abnormalCount > 0 && (
              <span className="checkup-card__badge checkup-card__badge--abnormal">
                이상 {abnormalCount}건
              </span>
            )}
            {warningCount > 0 && (
              <span className="checkup-card__badge checkup-card__badge--warning">
                경계 {warningCount}건
              </span>
            )}
            {abnormalCount === 0 && warningCount === 0 && (
              <span className="checkup-card__badge checkup-card__badge--normal">
                정상
              </span>
            )}
          </div>
          </div>
        </div>
        <div className="checkup-card__body">
          <div className="checkup-card__location">{location}</div>
          {checkup && (
            <button
              className="checkup-card__detail-button"
              onClick={handleExpandClick}
              aria-label={expanded ? '접기' : '상세 항목보기'}
            >
              {expanded ? '접기' : '상세 항목보기'}
            </button>
          )}
        </div>
      </div>
      {renderCheckupDetails()}
    </div>
  );
};

export default CheckupCard;

