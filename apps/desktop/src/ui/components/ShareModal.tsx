import { useState } from 'react';
import { X, Copy, Check, Users } from 'lucide-react';

interface ShareModalProps {
  onClose: () => void;
  workspaceId: string | null;
  userName: string;
  userColor: string;
}

type AccessMode = 'private' | 'link' | 'invite';

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
      // fallback: select the text
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
          <div>
            <h2 className="share-title">Compartir workspace</h2>
            <p className="share-subtitle">Controla quién puede unirse y colaborar en este espacio.</p>
          </div>
          <button className="share-close" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Acceso */}
        <div className="share-section">
          <label className="share-section-label">Acceso</label>
          <div className="share-access-toggle">
            {(['private', 'link', 'invite'] as AccessMode[]).map(mode => (
              <button
                key={mode}
                className={`share-access-btn ${accessMode === mode ? 'active' : ''}`}
                onClick={() => setAccessMode(mode)}
              >
                {mode === 'private' && 'Privado'}
                {mode === 'link' && 'Con enlace'}
                {mode === 'invite' && 'Solo invitación'}
              </button>
            ))}
          </div>
        </div>

        {/* Código de unión */}
        <div className="share-section">
          <label className="share-section-label">Código de unión</label>
          <div className="share-code-row">
            <div className="share-code-display">
              <code className="share-code">{joinCode || '—'}</code>
              <span className="share-code-badge">Código activo</span>
            </div>
            <button
              className={`share-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              disabled={!joinCode}
              title="Copiar código"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copiado' : 'Copiar código'}
            </button>
          </div>
          <p className="share-hint">
            {accessMode === 'private' && 'Solo tú puedes ver este workspace.'}
            {accessMode === 'link' && 'Cualquier persona con el código puede unirse.'}
            {accessMode === 'invite' && 'Solo con invitación directa.'}
          </p>
        </div>

        {/* Miembros (visual only MVP) */}
        <div className="share-section">
          <label className="share-section-label">
            <Users size={13} style={{ display: 'inline', marginRight: 6 }} />
            Miembros
          </label>
          <div className="share-members-list">
            {/* Owner — always shown */}
            <div className="share-member-row">
              <div className="share-member-avatar" style={{ background: userColor }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="share-member-info">
                <span className="share-member-name">{userName}</span>
                <span className="share-member-role">Propietario</span>
              </div>
            </div>
            {/* Placeholder for future members */}
            <div className="share-members-placeholder">
              <span>Próximamente: gestión de miembros</span>
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
