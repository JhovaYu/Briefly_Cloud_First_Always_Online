import React, { useState } from 'react';
import type { WorkspaceService } from '@tuxnotas/shared';

interface SharedTextPanelProps {
  workspaceService: WorkspaceService;
  workspaceId: string | null;
  activeNoteId: string | null;
  /** Returns the current plain text from the TipTap editor instance. */
  getCurrentNoteText: () => string;
}

type Status = 'idle' | 'publishing' | 'published' | 'fetching' | 'error' | 'empty';

export const SharedTextPanel: React.FC<SharedTextPanelProps> = ({
  workspaceService,
  workspaceId,
  activeNoteId,
  getCurrentNoteText,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [sharedContent, setSharedContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!workspaceId || !activeNoteId) return;

    setStatus('publishing');
    setErrorMessage(null);

    try {
      const content = getCurrentNoteText();

      if (!content.trim()) {
        setErrorMessage('El editor esta vacio. Escribe algo antes de publicar.');
        setStatus('empty');
        setTimeout(() => setStatus('idle'), 3000);
        return;
      }

      await workspaceService.updateSharedText(workspaceId, content);
      setStatus('published');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      setErrorMessage(err.message.slice(0, 80));
      setStatus('error');
    }
  };

  const handleRefresh = async () => {
    if (!workspaceId) return;
    setStatus('fetching');

    try {
      const data = await workspaceService.getSharedText(workspaceId);
      setSharedContent(data?.content ?? '');
      setStatus('idle');
    } catch (err: any) {
      if (err.status === 404) {
        setSharedContent('');
        setStatus('idle');
      } else {
        setErrorMessage(err.message);
        setStatus('error');
      }
    }
  };

  const statusLabel: Record<Status, string> = {
    idle: '',
    publishing: 'Publicando...',
    published: 'Actualizado',
    fetching: 'Obteniendo...',
    error: 'Error',
    empty: 'Vacio',
  };

  return (
    <div className="shared-text-panel">
      <div
        className="shared-text-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded);
        }}
      >
        <span className="shared-text-panel-title">
        {workspaceId ? 'Texto compartido' : 'Texto compartido (cloud)'}
      </span>
        {status !== 'idle' && (
          <span className="shared-text-panel-badge">{statusLabel[status]}</span>
        )}
        <span className="shared-text-panel-chevron">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {isExpanded && (
        <div className="shared-text-panel-body">
          <p className="shared-text-panel-disclaimer">
            Texto simple para movil. El formato avanzado permanece en escritorio.
          </p>

          <div className="shared-text-panel-buttons">
            <button
              className="shared-text-panel-btn"
              onClick={handlePublish}
              disabled={!activeNoteId || status === 'publishing'}
            >
              Publicar texto actual
            </button>
            <button
              className="shared-text-panel-btn"
              onClick={handleRefresh}
              disabled={status === 'fetching'}
            >
              Actualizar
            </button>
          </div>

          {sharedContent !== null && (
            <textarea
              className="shared-text-panel-textarea"
              readOnly
              value={sharedContent}
              rows={6}
            />
          )}

          {errorMessage && (
            <div className="shared-text-panel-error">{errorMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};
