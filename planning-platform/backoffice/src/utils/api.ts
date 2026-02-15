export const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};

const DEFAULT_TIMEOUT_MS = 30_000;

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = sessionStorage.getItem('po_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 타임아웃 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const signal = options.signal
    ? options.signal
    : controller.signal;

  try {
    const resp = await fetch(url, { ...options, headers, signal });
    clearTimeout(timeoutId);
    if (resp.status === 401) {
      sessionStorage.removeItem('po_token');
      sessionStorage.removeItem('po_user');
      console.warn('[auth] 세션 만료 — 로그인 페이지로 이동합니다.');
      window.location.href = '/backoffice/login';
    }
    return resp;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};
