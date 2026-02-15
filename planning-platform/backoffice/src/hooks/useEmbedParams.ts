import { useMemo } from 'react';

export interface EmbedParams {
  apiKey: string | null;
  partnerId: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
}

const isNonEmpty = (v: string | null): v is string => !!v && v.trim().length > 0;

export function useEmbedParams(): { isEmbedMode: boolean; embedParams: EmbedParams } {
  const embedParams = useMemo<EmbedParams>(() => {
    const params = new URLSearchParams(window.location.search);
    const apiKey = params.get('api_key');
    const partnerId = params.get('partner_id');
    const hospitalId = params.get('hospital_id');
    const hospitalName = params.get('hospital_name');
    return {
      apiKey: isNonEmpty(apiKey) ? apiKey : null,
      partnerId: isNonEmpty(partnerId) ? partnerId : null,
      hospitalId: isNonEmpty(hospitalId) ? hospitalId : null,
      hospitalName: isNonEmpty(hospitalName) ? hospitalName : null,
    };
  }, []);

  const isEmbedMode = !!(embedParams.apiKey && embedParams.partnerId);

  return { isEmbedMode, embedParams };
}
