export const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};

const DEFAULT_TIMEOUT_MS = 60_000;  // 30s → 60s (DB 집계 쿼리 장시간 대응)

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = sessionStorage.getItem('po_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 타임아웃 처리 — abort 시 명확한 사유 명시 (AbortError without reason 방지)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    const reason = new DOMException(
      `응답 시간 초과 (${DEFAULT_TIMEOUT_MS / 1000}초) — ${url.split('?')[0]}`,
      'TimeoutError'
    );
    controller.abort(reason);
  }, DEFAULT_TIMEOUT_MS);

  const signal = options.signal
    ? options.signal
    : controller.signal;

  try {
    const resp = await fetch(url, { ...options, headers, signal });
    clearTimeout(timeoutId);
    // 401: 토큰 만료/없음, 403: scope 불일치 — 둘 다 재로그인 유도
    if (resp.status === 401 || resp.status === 403) {
      sessionStorage.removeItem('po_token');
      sessionStorage.removeItem('po_user');
      console.warn(`[auth] 인증 오류(${resp.status}) — 로그인 페이지로 이동합니다.`);
      window.location.href = '/backoffice/login';
    }
    return resp;
  } catch (e) {
    clearTimeout(timeoutId);
    // AbortError 발생 시 더 명확한 에러로 변환
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      const reason = (controller.signal as any).reason;
      const msg = reason?.message || `응답 시간 초과 — ${url.split('?')[0]}`;
      const timeoutErr = new Error(msg);
      (timeoutErr as any).name = 'TimeoutError';
      (timeoutErr as any).url = url;
      throw timeoutErr;
    }
    throw e;
  }
};
