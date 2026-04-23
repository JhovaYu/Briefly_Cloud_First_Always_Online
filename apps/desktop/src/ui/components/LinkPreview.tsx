import { useState, useEffect } from 'react';
import { Globe, ImageOff } from 'lucide-react';

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

interface LinkPreviewProps {
  url: string;
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function PreviewSkeleton() {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      overflow: 'hidden',
      animation: 'lp-pulse 1.6s ease-in-out infinite',
    }}>
      {/* Imagen placeholder */}
      <div style={{
        width: 64, height: 64, flexShrink: 0,
        borderRadius: '7px',
        background: 'var(--bg-secondary)',
      }} />
      {/* Texto placeholder */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        <div style={{ height: 13, width: '65%', background: 'var(--bg-secondary)', borderRadius: 4 }} />
        <div style={{ height: 11, width: '90%', background: 'var(--bg-secondary)', borderRadius: 4 }} />
        <div style={{ height: 11, width: '45%', background: 'var(--bg-secondary)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;

    setLoading(true);
    setError(false);
    setData(null);

    const baseUrl =
      import.meta.env.VITE_PREVIEW_SERVICE_URL ||
      'http://localhost:3001';

    const apiKey =
      import.meta.env.VITE_EXPORT_API_KEY || 'briefly-secret-key';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    fetch(
      `${baseUrl}/api/v1/preview?url=${encodeURIComponent(url)}`,
      {
        headers: { 'x-api-key': apiKey },
        signal: controller.signal,
      }
    )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<LinkPreviewData>;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('[LinkPreview] fetch error:', err);
        }
        setError(true);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [url]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) return <PreviewSkeleton />;

  // ── Error state ────────────────────────────────────────────────────────
  if (error || !data) {
    const domain = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();

    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          textDecoration: 'none',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          fontFamily: 'var(--font-ui)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
          (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
        }}
      >
        <Globe size={14} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {domain}
        </span>
      </a>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────
  const domain = (() => {
    try { return new URL(data.url).hostname; } catch { return data.url; }
  })();

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        textDecoration: 'none',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--accent)';
        el.style.boxShadow = 'var(--shadow-md)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border-color)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Imagen OG */}
      <div style={{
        width: 64, height: 64, flexShrink: 0,
        borderRadius: '7px',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {data.image ? (
          <img
            src={data.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              // Si la imagen falla, reemplaza con el ícono fallback
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              e.currentTarget.parentElement!.appendChild(
                Object.assign(document.createElement('div'), {
                  innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
                  style: 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--text-tertiary)',
                })
              );
            }}
          />
        ) : (
          <ImageOff size={20} style={{ color: 'var(--text-tertiary)' }} />
        )}
      </div>

      {/* Metadata */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '3px',
        minWidth: 0,
      }}>
        {/* Título */}
        <p style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.title || domain}
        </p>

        {/* Descripción */}
        {data.description && (
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}>
            {data.description}
          </p>
        )}

        {/* Dominio base */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '2px',
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          fontWeight: 500,
        }}>
          <Globe size={10} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {domain}
          </span>
        </div>
      </div>
    </a>
  );
}
