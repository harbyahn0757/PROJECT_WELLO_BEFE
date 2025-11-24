/**
 * 디버깅용 유틸리티 함수
 * HealthDataViewer에서 사용하는 simplifyDataForLog를 공용으로 추출
 */

/**
 * 이미지 데이터 간소화 헬퍼 함수 (디버깅 로그용)
 * 긴 데이터는 키만 표시하여 콘솔 로그 가독성 향상
 */
export const simplifyDataForLog = (
  data: any,
  maxDepth: number = 10,
  currentDepth: number = 0,
  isImportantPath: boolean = false
): any => {
  // 기본 타입은 그대로 반환
  if (data === null || data === undefined || typeof data === 'boolean' || typeof data === 'number') {
    return data;
  }
  
  // 날짜 문자열은 그대로 반환
  if (typeof data === 'string') {
    // 이미지 데이터 체크 (base64 또는 매우 긴 문자열)
    if (data.startsWith('data:image') || 
        (data.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(data) && data.length > 5000)) {
      return `[Image Data: ${data.length} chars]`;
    }
    // 너무 긴 문자열은 잘라서 표시
    if (data.length > 200) {
      return `${data.substring(0, 200)}... [${data.length} chars]`;
    }
    return data;
  }
  
  // 배열 처리
  if (Array.isArray(data)) {
    // Items나 ItemReferences는 중요한 경로이므로 더 깊이 표시
    const effectiveMaxDepth = isImportantPath ? maxDepth + 5 : maxDepth;
    if (currentDepth >= effectiveMaxDepth) {
      return `[Array: ${data.length} items]`;
    }
    // 배열은 처음 5개만 표시
    return data.slice(0, 5).map(item => simplifyDataForLog(item, maxDepth, currentDepth + 1, isImportantPath));
  }
  
  // 객체 처리
  if (typeof data === 'object') {
    // Items나 ItemReferences는 중요한 경로이므로 더 깊이 표시
    const effectiveMaxDepth = isImportantPath ? maxDepth + 5 : maxDepth;
    if (currentDepth >= effectiveMaxDepth) {
      return `[Object: ${Object.keys(data).length} keys]`;
    }
    
    const simplified: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];
        
        // 이미지 관련 키는 값 대신 존재 여부와 길이만 표시
        if (key.toLowerCase().includes('image') || 
            key.toLowerCase().includes('drugimage')) {
          if (typeof value === 'string') {
            simplified[key] = `[Image Data: ${value.length} chars]`;
          } else if (value && typeof value === 'object') {
            simplified[key] = '[Image Object]';
          } else {
            simplified[key] = value;
          }
        } else if (key === 'Items' || key === 'ItemReferences') {
          // Items와 ItemReferences는 중요한 데이터이므로 더 깊이 표시
          simplified[key] = simplifyDataForLog(value, maxDepth, currentDepth, true);
        } else {
          // 나머지는 재귀적으로 처리
          simplified[key] = simplifyDataForLog(value, maxDepth, currentDepth + 1, isImportantPath);
        }
      }
    }
    return simplified;
  }
  
  return data;
};

