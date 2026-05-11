import { useState } from 'react';
import {
    History, FileText, Calendar, CheckSquare, Clock, Archive, Trash2,
    Settings, LogOut, Sun, Moon, Bell, Plus
} from 'lucide-react';
import { type UserProfile, saveUserProfile } from '../../core/domain/UserProfile';
import { ProfileDrawer } from './ProfileDrawer';

export interface SidebarProps {
    user: UserProfile;
    currentScreen: 'dashboard' | 'notes' | 'calendar' | 'tasks' | 'schedule' | 'boards' | 'trash';
    onNavigate: (screen: 'dashboard' | 'notes' | 'calendar' | 'tasks' | 'schedule' | 'boards' | 'trash') => void;
    onLogout: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onOpenSettings?: () => void;
    onOpenNotifications?: () => void;
    onOpenProfile?: () => void;
    onNewNote?: () => void;
    // Auth info for ProfileDrawer
    authEmail?: string;
    authProvider?: string;
    lastSignInAt?: string;
    cloudSessionAvailable?: boolean;
    onResetProfile?: () => void;
}

export function Sidebar({
    user,
    currentScreen,
    onNavigate,
    onLogout,
    theme,
    onToggleTheme,
    onOpenSettings,
    onOpenNotifications,
    onOpenProfile,
    onNewNote,
    authEmail,
    authProvider,
    lastSignInAt,
    cloudSessionAvailable,
    onResetProfile,
}: SidebarProps) {
    const [isProfileOpen, setProfileOpen] = useState(false);

    const handleSaveProfile = (updates: Partial<UserProfile>) => {
        const newProfile = { ...user, ...updates };
        saveUserProfile(newProfile);
        window.dispatchEvent(new CustomEvent('briefly-user-updated', { detail: newProfile }));
    };

    return (
        <aside className="db2-sidebar">
            <div className="db2-brand">
                <div className="db2-logo" style={{ background: 'transparent' }}>
                    <img src="./logo.png" alt="Briefly Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                </div>
                <div className="db2-brand-text">
                    <h2>Briefly</h2>
                    <span>Estudio Personal</span>
                </div>
            </div>

            <div className="db2-new-btn-wrapper">
                <button className="db2-btn-primary" onClick={onNewNote}>
                    <Plus size={16} /> Nueva Nota
                </button>
            </div>

            <nav className="db2-nav">
                <button className={`db2-nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}><History size={16} /> Dashboard</button>
                <button className={`db2-nav-item ${currentScreen === 'notes' ? 'active' : ''}`} onClick={() => onNavigate('notes')}><FileText size={16} /> Notas</button>
                <button className={`db2-nav-item ${currentScreen === 'calendar' ? 'active' : ''}`} onClick={() => onNavigate('calendar')}><Calendar size={16} /> Calendario</button>
                <button className={`db2-nav-item ${currentScreen === 'tasks' ? 'active' : ''}`} onClick={() => onNavigate('tasks')}><CheckSquare size={16} /> Tareas</button>
                <button className={`db2-nav-item ${currentScreen === 'schedule' ? 'active' : ''}`} onClick={() => onNavigate('schedule')}><Clock size={16} /> Horario</button>
                <button className={`db2-nav-item ${currentScreen === 'boards' ? 'active' : ''}`} onClick={() => onNavigate('boards')}><Archive size={16} /> Tableros</button>
                <button className={`db2-nav-item ${currentScreen === 'trash' ? 'active' : ''}`} onClick={() => onNavigate('trash')}><Trash2 size={16} /> Papelera</button>
            </nav>

            <div className="db2-bottom-nav">
                <div className="db2-user-profile" onClick={() => { onOpenProfile?.(); setProfileOpen(true); }} style={{ cursor: 'pointer' }}>
                    <div className="db2-user-avatar2" style={{ background: user.color }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="db2-user-name2" title={user.name}>
                        {user.name}
                    </div>
                    <button className="db2-user-icon-btn" onClick={(e) => { e.stopPropagation(); onToggleTheme(); }} title="Cambiar tema">
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="db2-user-icon-btn" onClick={(e) => { e.stopPropagation(); onOpenNotifications && onOpenNotifications(); }} title="Notificaciones">
                        <Bell size={18} />
                    </button>
                </div>
                <div className="db2-bottom-divider"></div>

                <button className="db2-nav-item" onClick={onOpenSettings}><Settings size={16} /> Ajustes</button>
                <button className="db2-nav-item" onClick={onLogout}><LogOut size={16} /> Cerrar sesión</button>
            </div>
            <ProfileDrawer
                isOpen={isProfileOpen}
                onClose={() => setProfileOpen(false)}
                user={user}
                onSave={handleSaveProfile}
                authEmail={authEmail}
                authProvider={authProvider}
                lastSignInAt={lastSignInAt}
                cloudSessionAvailable={cloudSessionAvailable}
                onLogout={onLogout}
                onResetProfile={onResetProfile}
            />
        </aside>
    );
}