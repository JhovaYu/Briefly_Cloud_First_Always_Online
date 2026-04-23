import { useState, useEffect } from 'react';
import { Type, Plus, X } from 'lucide-react';

export type SidebarStyle = 'floating' | 'header';

export function useSettings() {
  const [fontSize, setFontSize] = useState<number>(() => parseFloat(localStorage.getItem('app-font-size') || '1'));
  const [fontColor, setFontColor] = useState<string>(() => localStorage.getItem('app-font-color') || '');
  const [sidebarStyle, setSidebarStyle] = useState<SidebarStyle>(() => (localStorage.getItem('app-sidebar-style') as SidebarStyle) || 'floating');
  const [customColors, setCustomColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('app-custom-colors') || '[]'); } catch { return []; }
  });

  const addCustomColor = (color: string) => {
    const c = color.toLowerCase();
    if (c === '#ffffff' || c === '#000000' || customColors.includes(c)) return;
    const newColors = [c, ...customColors].slice(0, 3); // Solo guardamos 3 dinámicos (más los 2 fijos son 5)
    setCustomColors(newColors);
    localStorage.setItem('app-custom-colors', JSON.stringify(newColors));
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-multiplier', fontSize.toString());
    localStorage.setItem('app-font-size', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    if (fontColor) {
      document.documentElement.style.setProperty('--custom-text-color', fontColor);
    } else {
      document.documentElement.style.removeProperty('--custom-text-color');
    }
    localStorage.setItem('app-font-color', fontColor);
  }, [fontColor]);

  useEffect(() => {
    localStorage.setItem('app-sidebar-style', sidebarStyle);
  }, [sidebarStyle]);

  return { fontSize, setFontSize, fontColor, setFontColor, sidebarStyle, setSidebarStyle, customColors, addCustomColor };
}

export function SettingsModal({ onClose, settings }: { onClose: () => void, settings: ReturnType<typeof useSettings> }) {
  const [tab, setTab] = useState('accesibilidad');
  return (
    <div className="settings-overlay fade-in" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-sidebar">
          <h2 className="settings-title">Ajustes</h2>
          <button className={`settings-tab ${tab === 'accesibilidad' ? 'active' : ''}`} onClick={() => setTab('accesibilidad')}>
            <Type size={16} /> Accesibilidad
          </button>
        </div>
        <div className="settings-content">
          {tab === 'accesibilidad' && (
            <div className="settings-section">
              <h3>Accesibilidad</h3>
              
              <div className="settings-row">
                <div className="settings-info">
                  <label>Tamaño de letra (x{settings.fontSize})</label>
                  <p className="settings-desc">Ajusta el tamaño del texto en toda la aplicación.</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select 
                    className="login-input" 
                    style={{ width: '80px', padding: '6px' }} 
                    value={[0.5, 1, 1.2, 1.5, 3].includes(settings.fontSize) ? settings.fontSize : 'custom'} 
                    onChange={(e) => { if (e.target.value !== 'custom') settings.setFontSize(Number(e.target.value)) }}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="1.2">1.2x</option>
                    <option value="1.5">1.5x</option>
                    <option value="3">3x</option>
                    <option value="custom">Otro</option>
                  </select>
                  <input 
                    type="number" 
                    className="login-input" 
                    style={{ width: '70px', padding: '6px' }} 
                    step="0.1" min="0.3" max="4" 
                    value={settings.fontSize} 
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) settings.setFontSize(val);
                    }} 
                  />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <label>Color de texto personalizado</label>
                  <p className="settings-desc">Sobrescribe el color base del texto general.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['#ffffff', '#000000', ...settings.customColors].map(c => (
                    <button 
                      key={c} 
                      className="settings-color-btn" 
                      style={{ background: c, border: settings.fontColor === c ? '2px solid var(--accent)' : '1px solid var(--border-color)' }} 
                      onClick={() => settings.setFontColor(c)} 
                      title={c}
                    />
                  ))}
                  <div style={{ position: 'relative', width: 26, height: 26, borderRadius: '50%', border: '1px dashed var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }} title="Elegir nuevo color">
                    <Plus size={14} />
                    <input 
                      type="color" 
                      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, cursor: 'pointer', padding: 0, border: 'none', opacity: 0 }} 
                      value={settings.fontColor || '#000000'} 
                      onChange={e => {
                        const newColor = e.target.value;
                        settings.setFontColor(newColor);
                        settings.addCustomColor(newColor);
                      }} 
                    />
                  </div>
                  {settings.fontColor && <button className="login-btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => settings.setFontColor('')}>Restablecer</button>}
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <label>Botón del panel lateral</label>
                  <p className="settings-desc">Ubicación del botón para alternar el menú en tus espacios.</p>
                </div>
                <select className="login-input" value={settings.sidebarStyle} onChange={e => settings.setSidebarStyle(e.target.value as SidebarStyle)} style={{ width: 'auto' }}>
                  <option value="floating">Botón flotante</option>
                  <option value="header">En el encabezado</option>
                </select>
              </div>

            </div>
          )}
        </div>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>
    </div>
  );
}
