import { useState } from 'react';
import { X, Copy, Check, Users, Lock, Link2, Mail } from 'lucide-react';

interface ShareModalProps {
  onClose: () => void;
  workspaceId: string | null;
  userName: string;
  userColor: string;
}

type AccessMode = 'private' | 'link' | 'invite';

const ACCESS_CONFIG = {
  private: { icon: Lock, label: 'Privado', hint: 'Solo tú puedes ver este workspace.' },
  link: { icon: Link2, label: 'Con enlace', hint: 'Cualquier persona con el código puede unirse.' },
  invite: { icon: Mail, label: 'Solo invitación', hint: 'Solo con invitación directa.' },
};

export function ShareModal({ onClose, workspaceId, userName, userColor }: ShareModalProps) {
  const [accessMode, setAccessMode] = useState<AccessMode>('link');
  const [copied, setCopied] = useState(false);

  const joinCode = workspaceId ?? '';

  const handleCopy = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="share-overlay fade-in" onClick={handleBackdropClick}>
      <div className="share-modal">
        {/* Header */}
        <div className="share-header">
          <div className="share-header-text">
            <h2 className="share-title">Compartir workspace</h2>
            <p className="share-subtitle">Controla quién puede unirse y colaborar en este espacio.</p>
          </div>
          <button className="share-close" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="share-body">

          {/* Acceso */}
          <div className="share-section">
            <label className="share-section-label">Acceso</label>
            <div className="share-access-toggle">
              {(Object.keys(ACCESS_CONFIG) as AccessMode[]).map(mode => {
                const { icon: Icon, label } = ACCESS_CONFIG[mode];
                return (
                  <button
                    key={mode}
                    className={`share-access-btn ${accessMode === mode ? 'active' : ''}`}
                    onClick={() => setAccessMode(mode)}
                  >
                    <Icon size={14} strokeWidth={1.8} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="share-hint">{ACCESS_CONFIG[accessMode].hint}</p>
          </div>

          {/* Código de unión */}
          <div className="share-section">
            <label className="share-section-label">Código de unión</label>
            <div className="share-code-row">
              <div className="share-code-wrapper">
                <code className="share-code" title={joinCode}>{joinCode || '—'}</code>
              </div>
              <button
                className={`share-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                disabled={!joinCode}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="share-code-status">
              <span className="share-code-badge">
                <span className="share-code-dot" />
                Código activo
              </span>
            </div>
          </div>

          {/* Miembros */}
          <div className="share-section">
            <label className="share-section-label">
              <Users size={13} />
              Miembros
            </label>
            <div className="share-members-list">
              <div className="share-member-row">
                <div className="share-member-avatar" style={{ background: userColor }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="share-member-info">
                  <span className="share-member-name">{userName}</span>
                  <span className="share-member-role">Propietario</span>
                </div>
              </div>
              <div className="share-members-coming">
                <span>Gestión de miembros próximamente</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="share-footer">
          <button className="share-cancel-btn" onClick={onClose}>Cancelar</button>
          <button className="share-save-btn" onClick={onClose} disabled>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
