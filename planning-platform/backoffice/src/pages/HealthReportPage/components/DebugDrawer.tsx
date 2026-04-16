/**
 * DebugDrawer — 환자 디버그 정보 드로어
 * W1 블로커 신규 파일 (data-test 속성 사용, data-testid 혼용 금지)
 * process.env.NODE_ENV !== 'production' 일 때만 트리거 버튼 노출
 * URL ?debug=1 또는 window.__WELNO_DEBUG__ === true 일 때 활성화
 */
import { Drawer } from '../../../components/Drawer/Drawer';
import type { PatientInfo } from '../hooks/useMediarcApi';

declare global {
  interface Window {
    __WELNO_DEBUG__?: boolean;
  }
}

interface DebugDrawerProps {
  patientInfo: PatientInfo;
  open: boolean;
  onClose: () => void;
}

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1' || window.__WELNO_DEBUG__ === true;
}

export default function DebugDrawer({ patientInfo, open, onClose }: DebugDrawerProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev && !isDebugEnabled()) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Debug: 환자 원본 데이터"
      width="md"
    >
      <div
        data-test="imputed-fields"
        style={{ marginBottom: '1rem' }}
      >
        <h4 style={{ marginBottom: '0.5rem' }}>imputed_fields</h4>
        <pre style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', fontSize: '12px', overflowX: 'auto' }}>
          {JSON.stringify(patientInfo.imputed_fields ?? [], null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>missing_fields</h4>
        <pre style={{ background: '#fff3cd', padding: '0.75rem', borderRadius: '4px', fontSize: '12px', overflowX: 'auto' }}>
          {JSON.stringify(patientInfo.missing_fields ?? [], null, 2)}
        </pre>
      </div>

      <div>
        <h4 style={{ marginBottom: '0.5rem' }}>patient_info (원본)</h4>
        <pre style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', maxHeight: '400px' }}>
          {JSON.stringify(patientInfo, null, 2)}
        </pre>
      </div>
    </Drawer>
  );
}
