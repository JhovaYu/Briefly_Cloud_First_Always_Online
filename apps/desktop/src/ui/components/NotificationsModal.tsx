import { Bell, Clock, ListChecks, X } from 'lucide-react';

export function NotificationsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-overlay fade-in" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-sidebar">
          <h2 className="settings-title">Notificaciones</h2>
          <button className="settings-tab active">
            <Bell size={16} /> Recientes
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <h3>Novedades</h3>
            
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '6px', borderRadius: '50%' }}>
                  <Clock size={16} />
                </div>
                <strong style={{ color: 'var(--text-primary)' }}>Nueva actualización de horarios</strong>
              </div>
              <span className="settings-desc" style={{ marginTop: '4px' }}>Se han modificado las fechas de entrega para Matemáticas.</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Hace 2 horas</span>
            </div>

            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                 <div style={{ background: 'var(--accent)', color: '#fff', padding: '6px', borderRadius: '50%' }}>
                   <ListChecks size={16} />
                 </div>
                 <strong style={{ color: 'var(--text-primary)' }}>Se ha añadido una nueva tarea</strong>
               </div>
               <span className="settings-desc" style={{ marginTop: '4px' }}>Un miembro de tu grupo "Interfaces" ha agregado "Revisión de Wireframes".</span>
               <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Hace 5 horas</span>
            </div>

          </div>
        </div>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>
    </div>
  );
}
