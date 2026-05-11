import { useState, useEffect } from 'react';
import {
    X, User, Shield, Sliders, Moon, Sun, Check, Star, Leaf, Cloud, Coffee, Zap,
    LogOut, Trash2, RefreshCw, AlertTriangle
} from 'lucide-react';
import type { UserProfile } from '../../core/domain/UserProfile';
import { getPreferences, savePreferences, applyPreferences, resetPreferences, clearUserProfile, type LocalPreferences, type FontSize } from '../../core/preferences/LocalPreferences';

export interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onSave: (updates: Partial<UserProfile>) => void;
    // Auth info from App
    authEmail?: string;
    authProvider?: string;
    lastSignInAt?: string;
    cloudSessionAvailable?: boolean;
    onLogout: () => void;
    onResetProfile?: () => void;
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

const fontSizes: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'Pequeño' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Grande' },
];

export function ProfileDrawer({
    isOpen, onClose, user, onSave,
    authEmail, authProvider, lastSignInAt, cloudSessionAvailable,
    onLogout, onResetProfile
}: ProfileDrawerProps) {
    const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'preferencias'>('perfil');

    // Perfil state — all localStorage-first, no backend calls
    const [name, setName] = useState(user.name);
    const [color, setColor] = useState(user.color);
    const [avatarIcon, setAvatarIcon] = useState(user.avatarIcon || 'user');
    const [displayUsername, setDisplayUsername] = useState(user.displayUsername || '');
    const [institution, setInstitution] = useState(user.institution || '');
    const [career, setCareer] = useState(user.career || '');
    const [saved, setSaved] = useState(false);

    // Preferences state — from localStorage
    const [prefs, setPrefs] = useState<LocalPreferences>(() => getPreferences());

    // Security tab confirmation states
    const [showResetPrefsConfirm, setShowResetPrefsConfirm] = useState(false);
    const [showResetProfileConfirm, setShowResetProfileConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(user.name);
            setColor(user.color);
            setAvatarIcon(user.avatarIcon || 'user');
            setDisplayUsername(user.displayUsername || '');
            setInstitution(user.institution || '');
            setCareer(user.career || '');
            setSaved(false);
            setPrefs(getPreferences());
            setShowResetPrefsConfirm(false);
            setShowResetProfileConfirm(false);
        }
    }, [isOpen, user]);

    useEffect(() => {
        if (isOpen) {
            applyPreferences(prefs);
        }
    }, [prefs, isOpen]);

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

    const handlePrefChange = <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => {
        const updated = { ...prefs, [key]: value };
        setPrefs(updated);
        savePreferences({ [key]: value });
    };

    const handleResetPrefsConfirm = () => {
        resetPreferences();
        setPrefs(getPreferences());
        setShowResetPrefsConfirm(false);
    };

    const handleResetProfileConfirm = () => {
        clearUserProfile();
        onResetProfile?.();
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
                        <Shield size={16} /> Cuenta
                    </button>
                    <button
                        className={`profile-drawer-tab ${activeTab === 'preferencias' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferencias')}
                    >
                        <Sliders size={16} /> Preferencias
                    </button>
                </div>

                <div className="profile-drawer-content">
                    {/* ─── TAB: PERFIL ─── */}
                    {activeTab === 'perfil' && (
                        <div className="profile-tab-content fade-in">
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
                                    value={authEmail || 'Vinculado a tu cuenta · Solo lectura'}
                                    disabled
                                    style={{ opacity: 0.7 }}
                                />
                                <div className="profile-hint">No editable desde este panel.</div>
                            </div>

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

                    {/* ─── TAB: SEGURIDAD — "Cuenta y acceso" ─── */}
                    {activeTab === 'seguridad' && (
                        <div className="profile-tab-content fade-in">

                            {/* Card 1: Tu cuenta */}
                            <div className="account-card">
                                <div className="account-card-label">Tu cuenta</div>

                                <div className="account-row">
                                    <span className="account-row-label">Email</span>
                                    <span className="account-row-value">
                                        {authEmail || 'No disponible'}
                                    </span>
                                </div>

                                <div className="account-row">
                                    <span className="account-row-label">Proveedor</span>
                                    <span className="account-row-value">
                                        {authProvider || (user.identityType ? user.identityType : 'Cuenta local')}
                                    </span>
                                </div>

                                <div className="account-row">
                                    <span className="account-row-label">Tipo de identidad</span>
                                    <span className="account-row-value">
                                        {user.identityType || 'Local'}
                                    </span>
                                </div>

                                <div className="account-row">
                                    <span className="account-row-label">Sesión</span>
                                    <span className={`account-badge ${cloudSessionAvailable ? 'account-badge-active' : 'account-badge-local'}`}>
                                        {cloudSessionAvailable ? '● Activa' : '○ Sesión local'}
                                    </span>
                                </div>

                                {lastSignInAt && (
                                    <div className="account-row">
                                        <span className="account-row-label">Último inicio</span>
                                        <span className="account-row-value" style={{ fontSize: 11 }}>
                                            {new Date(lastSignInAt).toLocaleString('es-ES', {
                                                dateStyle: 'short',
                                                timeStyle: 'short'
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Acciones */}
                            <div className="action-card">
                                <div className="action-row">
                                    <button className="action-row-btn" onClick={onLogout}>
                                        <LogOut size={15} />
                                        Cerrar sesión
                                    </button>
                                </div>
                            </div>

                            <div className="action-card">
                                <div className="action-row">
                                    <button className="action-row-btn" onClick={() => setShowResetPrefsConfirm(true)}>
                                        <RefreshCw size={15} />
                                        Restablecer preferencias visuales
                                    </button>
                                </div>
                                {showResetPrefsConfirm && (
                                    <div style={{ marginTop: 10, padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                            ¿Restablecer aparência, tema y tamaño de fuente?
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn-secondary" onClick={() => setShowResetPrefsConfirm(false)}>
                                                Cancelar
                                            </button>
                                            <button className="btn-danger" onClick={handleResetPrefsConfirm}>
                                                Confirmar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="action-card">
                                <div className="action-row">
                                    <button className="action-row-btn" onClick={() => setShowResetProfileConfirm(true)}>
                                        <Trash2 size={15} />
                                        Restablecer perfil local
                                    </button>
                                </div>
                                {showResetProfileConfirm && (
                                    <div style={{ marginTop: 10, padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                            Esto eliminará tu perfil local y te redirigirá al inicio. No elimina sesiones cloud.
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn-secondary" onClick={() => setShowResetProfileConfirm(false)}>
                                                Cancelar
                                            </button>
                                            <button className="btn-danger" onClick={handleResetProfileConfirm}>
                                                Eliminar perfil
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Future card */}
                            <div className="profile-sync-card" style={{ marginTop: 20, background: 'transparent', border: '1px solid rgba(174, 180, 255, 0.2)' }}>
                                <Shield size={20} color="#aeb4ff" />
                                <div className="profile-sync-text">
                                    <strong style={{ color: '#aeb4ff' }}>Cambio de contraseña y email</strong>
                                    <span>Estarán disponibles en una actualización futura.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB: PREFERENCIAS ─── */}
                    {activeTab === 'preferencias' && (
                        <div className="profile-tab-content fade-in">

                            {/* Sección: Apariencia */}
                            <label className="profile-label">Apariencia</label>

                            <label className="profile-label" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 8 }}>Tema</label>
                            <div className="segmented-control">
                                <button
                                    className={`segmented-control-btn ${prefs.theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => handlePrefChange('theme', 'dark')}
                                >
                                    <Moon size={14} /> Oscuro
                                </button>
                                <button
                                    className={`segmented-control-btn ${prefs.theme === 'light' ? 'active' : ''}`}
                                    onClick={() => handlePrefChange('theme', 'light')}
                                >
                                    <Sun size={14} /> Claro
                                </button>
                            </div>

                            <label className="profile-label" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 16, marginBottom: 8 }}>Tamaño de fuente</label>
                            <div className="segmented-control">
                                {fontSizes.map(f => (
                                    <button
                                        key={f.value}
                                        className={`segmented-control-btn ${prefs.fontSize === f.value ? 'active' : ''}`}
                                        onClick={() => handlePrefChange('fontSize', f.value)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* Toggle row */}
                            <div className="toggle-row" style={{ marginTop: 16 }}>
                                <div>
                                    <div className="toggle-row-label">Reducir animaciones</div>
                                    <div className="toggle-row-hint">Efectos más rápidos y suaves</div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={prefs.reduceMotion}
                                        onChange={e => handlePrefChange('reduceMotion', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {/* Sección: Sidebar */}
                            <label className="profile-label" style={{ marginTop: 24 }}>Sidebar</label>

                            <div className="toggle-row">
                                <div>
                                    <div className="toggle-row-label">Mostrar institución</div>
                                    <div className="toggle-row-hint">Visible si tienes institución configurada</div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={prefs.showInstitution}
                                        onChange={e => handlePrefChange('showInstitution', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="toggle-row">
                                <div>
                                    <div className="toggle-row-label">Mostrar carrera</div>
                                    <div className="toggle-row-hint">Visible si tienes carrera configurada</div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={prefs.showCareer}
                                        onChange={e => handlePrefChange('showCareer', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {/* Sección: Comportamiento */}
                            <label className="profile-label" style={{ marginTop: 24 }}>Comportamiento</label>

                            <div className="toggle-row">
                                <div>
                                    <div className="toggle-row-label">Abrir último workspace al iniciar</div>
                                    <div className="toggle-row-hint">Reanuda donde quedaste</div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={prefs.openLastWorkspace}
                                        onChange={e => handlePrefChange('openLastWorkspace', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {/* Footer */}
                            <div className="preferences-footer">
                                <p className="preferences-footer-text">
                                    Tus preferencias se guardan en este navegador.
                                </p>
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