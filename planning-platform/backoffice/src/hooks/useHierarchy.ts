import { useState, useCallback, useMemo } from 'react';
import { EmbedParams } from './useEmbedParams';

export interface PartnerHierarchy {
  partner_id: string;
  partner_name: string;
  is_active: boolean;
  hospitals: {
    partner_id: string;
    partner_name: string;
    hospital_id: string;
    hospital_name: string;
    chat_count_today: number;
    survey_count_today: number;
    has_embedding?: boolean;
    has_uploads?: boolean;
    document_count?: number;
  }[];
}

export interface UseHierarchyReturn {
  hierarchy: PartnerHierarchy[];
  selectedPartnerId: string | null;
  selectedHospitalId: string | null;
  setSelectedPartnerId: (id: string | null) => void;
  setSelectedHospitalId: (id: string | null) => void;
  collapsedPartners: Set<string>;
  togglePartner: (id: string) => void;
  loading: boolean;
  fetchHierarchy: () => Promise<void>;
  sortedHierarchy: PartnerHierarchy[];
  selectedHospitalName: string;
}

export function useHierarchy(apiBase: string, embedParams?: EmbedParams): UseHierarchyReturn {
  const [hierarchy, setHierarchy] = useState<PartnerHierarchy[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    embedParams?.partnerId || null
  );
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(
    embedParams?.hospitalId || null
  );
  const [collapsedPartners, setCollapsedPartners] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/hierarchy`);
      if (!res.ok) throw new Error(res.statusText);
      const data: PartnerHierarchy[] = await res.json();
      setHierarchy(data);
      if (data.length > 0 && !selectedPartnerId) {
        const firstPartner = data[0];
        setSelectedPartnerId(firstPartner.partner_id);
        if (firstPartner.hospitals.length > 0 && !selectedHospitalId) {
          setSelectedHospitalId(firstPartner.hospitals[0].hospital_id);
        }
      }
    } catch (e) {
      console.error('Hierarchy fetch failed:', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const togglePartner = useCallback((id: string) => {
    setCollapsedPartners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sortedHierarchy = useMemo(() => {
    return [...hierarchy].sort((a, b) => {
      const aHas = a.hospitals.length > 0 ? 0 : 1;
      const bHas = b.hospitals.length > 0 ? 0 : 1;
      return aHas - bHas;
    });
  }, [hierarchy]);

  const selectedHospitalName = useMemo(() => {
    for (const p of hierarchy) {
      for (const h of p.hospitals) {
        if (h.hospital_id === selectedHospitalId && p.partner_id === selectedPartnerId) {
          return h.hospital_name;
        }
      }
    }
    return '';
  }, [hierarchy, selectedHospitalId, selectedPartnerId]);

  return {
    hierarchy,
    selectedPartnerId,
    selectedHospitalId,
    setSelectedPartnerId,
    setSelectedHospitalId,
    collapsedPartners,
    togglePartner,
    loading,
    fetchHierarchy,
    sortedHierarchy,
    selectedHospitalName,
  };
}
