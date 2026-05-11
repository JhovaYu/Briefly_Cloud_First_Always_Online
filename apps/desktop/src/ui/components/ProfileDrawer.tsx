import { useState, useEffect } from 'react';
import { 
    X, User, Shield, Sliders, Moon, Sun, 
    Monitor, Check, Star, Leaf, Cloud, Coffee, Zap 
} from 'lucide-react';
import type { UserProfile } from '../../core/domain/UserProfile';

export interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onSave: (updates: Partial<UserProfile>) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#795548', '#607d8b'];

const icons = [
    { id: 'user', icon: User },
    { id: 'star', icon: Star },
    { id: 'leaf', icon: Leaf },
    { id: 'moon', icon: Moon },
    { id: 'cloud', icon: Cloud },
    { id: 'coffee', icon: Coffee },
    { id: 'zap', icon: Zap }
];

export function ProfileDrawer({ isOpen, onClose, user, onSave, theme, onToggleTheme }: ProfileDrawerProps) {
    const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'preferencias'>('perfil');

    // Perfil state — all localStorage-first, no backend calls
    const [name, setName] = useState(user.name);
    const [color, setColor] = useState(user.color);
    const [avatarIcon, setAvatarIcon] = useState(user.avatarIcon || 'user');
    const [displayUsername, setDisplayUsername] = useState(user.displayUsername || '');
    const [institution, setInstitution] = useState(user.institution || '');
    const [career, setCareer] = useState(user.career || '');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(user.name);
            setColor(user.color);
            setAvatarIcon(user.avatarIcon || 'user');
            setDisplayUsername(user.displayUsername || '');
            setInstitution(user.institution || '');
            setCareer(user.career || '');
            setSaved(false);
        }
    }, [isOpen, user]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const SelectedIcon = icons.find(i => i.id === avatarIcon)?.icon || User;

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            color,
            avatarIcon,
            displayUsername: displayUsername.trim() || undefined,
            institution: institution.trim() || undefined,
            career: career.trim() || undefined,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="profile-drawer-backdrop" onClick={onClose}>
            <div className="profile-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
                
                <div className="profile-drawer-header">
                    <div className="profile-drawer-title-group">
                        <div className="profile-drawer-logo">
                            <img src="./logo.png" alt="Briefly" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        </div>
                        <h2 id="drawer-title">Perfil</h2>
                    </div>
                    <button className="profile-drawer-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="profile-drawer-subtitle">
                    Tu identidad dentro de Briefly.
                </div>

                <div className="profile-drawer-tabs">
                    <button 
                        className={`profile-drawer-tab ${activeTab === 'perfil' ? 'active' : ''}`}
                        onClick={() => setActiveTab('perfil')}
                    >
                        <User size={16} /> Perfil
                    </button>
                    <button 
                        className={`profile-drawer-tab ${activeTab === 'seguridad' ? 'active' : ''}`}
                        onClick={() => setActiveTab('seguridad')}
                    >
                        <Shield size={16} /> Seguridad
                    </button>
                    <button 
                        className={`profile-drawer-tab ${activeTab === 'preferencias' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferencias')}
                    >
                        <Sliders size={16} /> Preferencias
                    </button>
                </div>

                <div className="profile-drawer-content">
                    {activeTab === 'perfil' && (
                        <div className="profile-tab-content fade-in">
                            {/* ── Sección: Identidad ── */}
                            <div className="profile-section-header">Identidad</div>

                            <div className="profile-avatar-section">
                                <div className="profile-avatar-preview" style={{ background: color }}>
                                    <SelectedIcon size={32} color="#fff" />
                                </div>
                                <div className="profile-color-picker">
                                    <label className="profile-label">Color del avatar</label>
                                    <div className="profile-colors">
                                        {colors.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={`profile-color-btn ${color === c ? 'selected' : ''}`}
                                                style={{ background: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="profile-icon-picker">
                                <label className="profile-label">Icono de perfil</label>
                                <div className="profile-icons">
                                    {icons.map(i => {
                                        const IconComp = i.icon;
                                        return (
                                            <button
                                                key={i.id}
                                                onClick={() => setAvatarIcon(i.id)}
                                                className={`profile-icon-btn ${avatarIcon === i.id ? 'selected' : ''}`}
                                            >
                                                <IconComp size={18} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="profile-form-group">
                                <label className="profile-label">Nombre visible</label>
                                <input
                                    className="profile-input"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Tu nombre visible"
                                />
                            </div>

                            <div className="profile-form-group">
                                <label className="profile-label">Usuario visible</label>
                                <input
                                    className="profile-input"
                                    value={displayUsername}
                                    onChange={e => setDisplayUsername(e.target.value)}
                                    placeholder="@tu-usuario"
                                />
                                <div className="profile-hint">Visible solo para ti por ahora.</div>
                            </div>

                            <div className="profile-form-group">
                                <label className="profile-label">Email</label>
                                <input
                                    className="profile-input"
                                    value="Vinculado a tu cuenta · Solo lectura"
                                    disabled
                                    style={{ opacity: 0.7 }}
                                />
                                <div className="profile-hint">No editable desde este panel.</div>
                            </div>

                            {/* ── Sección: Académico ── */}
                            <div className="profile-section-header" style={{ marginTop: 20 }}>Académico</div>

                            <div className="profile-form-group">
                                <label className="profile-label">Institución</label>
                                <input
                                    className="profile-input"
                                    value={institution}
                                    onChange={e => setInstitution(e.target.value)}
                                    placeholder="Ej. Universidad Autónoma de Chiapas"
                                />
                            </div>

                            <div className="profile-form-group">
                                <label className="profile-label">Carrera o área de estudio</label>
                                <input
                                    className="profile-input"
                                    value={career}
                                    onChange={e => setCareer(e.target.value)}
                                    placeholder="Ej. Ingeniería en Software"
                                />
                            </div>

                            <div className="profile-sync-card" style={{ marginTop: 24 }}>
                                <Cloud size={20} color="#2ecc71" />
                                <div className="profile-sync-text">
                                    <strong>Guardado localmente</strong>
                                    <span>Preferencias guardadas en este dispositivo.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'seguridad' && (
                        <div className="profile-tab-content fade-in">
                            <div className="profile-security-grouped">
                                <Shield size={24} color="#aeb4ff" style={{ flexShrink: 0 }} />
                                <div>
                                    <strong>Opciones de seguridad avanzada disponibles próximamente</strong>
                                    <p>Contraseña, email y sesiones activas se gestionarán desde el panel de seguridad de tu cuenta.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferencias' && (
                        <div className="profile-tab-content fade-in">
                            <label className="profile-label">Tema</label>
                            <div className="profile-theme-toggle">
                                <button className="profile-theme-btn" disabled>
                                    <Monitor size={16}/> Sistema
                                </button>
                                <button 
                                    className={`profile-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => { if(theme !== 'dark') onToggleTheme(); }}
                                >
                                    <Moon size={16}/> Oscuro
                                </button>
                                <button 
                                    className={`profile-theme-btn ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => { if(theme !== 'light') onToggleTheme(); }}
                                >
                                    <Sun size={16}/> Claro
                                </button>
                            </div>

                            <label className="profile-label" style={{ marginTop: 24 }}>Notificaciones</label>
                            <button className="profile-security-btn" disabled>
                                <span>Recordatorios de tareas</span>
                                <span className="profile-badge-soon">Próximamente</span>
                            </button>
                            <button className="profile-security-btn" disabled>
                                <span>Actividad de workspace</span>
                                <span className="profile-badge-soon">Próximamente</span>
                            </button>

                            <label className="profile-label" style={{ marginTop: 24 }}>Personalización académica</label>
                            <button className="profile-security-btn" disabled>
                                <span>Mostrar institución en perfil</span>
                                <span className="profile-badge-soon">Próximamente</span>
                            </button>
                            <button className="profile-security-btn" disabled>
                                <span>Mostrar carrera en perfil</span>
                                <span className="profile-badge-soon">Próximamente</span>
                            </button>

                            <div className="profile-sync-card" style={{ marginTop: 24, background: 'transparent', border: '1px solid rgba(174, 180, 255, 0.2)' }}>
                                <Sliders size={20} color="#aeb4ff" />
                                <div className="profile-sync-text">
                                    <strong style={{ color: '#aeb4ff' }}>Experiencia personalizada</strong>
                                    <span>Ajusta Briefly a tu forma de estudiar.</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="profile-drawer-footer">
                    <button className="profile-btn-cancel" onClick={onClose}>Cancelar</button>
                    {activeTab === 'perfil' && (
                        <button 
                            className="profile-btn-save glow" 
                            onClick={handleSave}
                            disabled={!name.trim()}
                        >
                            {saved ? <><Check size={16}/> Guardado</> : 'Guardar cambios'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
