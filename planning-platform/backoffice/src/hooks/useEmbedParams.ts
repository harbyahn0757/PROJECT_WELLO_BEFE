import { useMemo } from 'react';

export interface EmbedParams {
  apiKey: string | null;
  partnerId: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
}

export function useEmbedParams(): { isEmbedMode: boolean; embedParams: EmbedParams } {
  const embedParams = useMemo<EmbedParams>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      apiKey: params.get('api_key'),
      partnerId: params.get('partner_id'),
      hospitalId: params.get('hospital_id'),
      hospitalName: params.get('hospital_name'),
    };
  }, []);

  const isEmbedMode = !!(embedParams.apiKey && embedParams.partnerId);

  return { isEmbedMode, embedParams };
}
