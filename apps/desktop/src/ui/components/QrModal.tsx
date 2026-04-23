import { useState, useEffect } from 'react';

export function QrModal({ value, onClose }: { value: string; onClose: () => void }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) return;

    setImgSrc(null);
    setError(false);

    const baseUrl =
      import.meta.env.VITE_QR_SERVICE_URL || 'http://localhost:8081';
    const apiKey =
      import.meta.env.VITE_API_KEY || 'briefly-secret-key';

    let objectUrl: string | null = null;

    fetch(
      `${baseUrl}/api/v1/qr?text=${encodeURIComponent(value)}`,
      { headers: { 'x-api-key': apiKey } }
    )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setImgSrc(objectUrl);
      })
      .catch(err => {
        console.error('[QrModal] Error fetching QR:', err);
        setError(true);
      });

    // Limpieza del object URL para evitar memory leaks
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Imagen del QR ── */}
        <div style={{
          width: 240, height: 240,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#ffffff', borderRadius: 12,
          margin: '0 auto',
        }}>
          {error ? (
            <p style={{ fontSize: 12, color: 'var(--color-error)', textAlign: 'center', padding: 16 }}>
              Error generando QR.<br />Verifica que el servicio esté activo.
            </p>
          ) : imgSrc ? (
            <img
              src={imgSrc}
              alt={`QR code para: ${value}`}
              style={{ width: 220, height: 220, display: 'block' }}
            />
          ) : (
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)',
              textAlign: 'center', margin: 0,
              animation: 'lp-pulse 1.4s ease-in-out infinite',
            }}>
              Generando QR seguro...
            </p>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Escanea para unirte al espacio
        </p>
        <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}>
          {value}
        </p>
        <button className="login-btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
