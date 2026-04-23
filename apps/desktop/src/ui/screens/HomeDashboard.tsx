import { useState, useEffect } from 'react';
import {
  Clock, FileText, Trash2, FolderPlus,
  Folder, Activity, Plus, Edit2,
  History, Calendar, CheckSquare,
  Users, ListTodo, CalendarClock,
} from 'lucide-react';
import {
  type UserProfile, type PoolInfo,
  getSavedPools, addPool, removePool, updatePoolLastOpened
} from '../../core/domain/UserProfile';
import { useSettings, SettingsModal } from '../components/SettingsModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { Sidebar } from '../components/Sidebar';
import * as Y from 'yjs';
import { TaskService, type Task } from '@tuxnotas/shared';

// ── KPI Card ──────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: string;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, accent, onClick }: KpiCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--accent-light)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border-color)'}`,
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        transform: hovered && onClick ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
      }}
    >
      <div style={{
        width: 48, height: 48,
        borderRadius: '12px',
        background: accent || 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
          {value}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Pool Card ─────────────────────────────────────────────────────────────
interface PoolCardProps {
  pool: PoolInfo;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function PoolCard({ pool, onOpen, onDelete }: PoolCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border-color)'}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', flexShrink: 0,
      }}>
        <Folder size={16} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pool.name}
      </span>
      <button
        onClick={onDelete}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 4, borderRadius: 6,
          color: hovered ? 'var(--color-error)' : 'var(--text-tertiary)',
          transition: 'color 0.15s', display: 'flex',
          opacity: hovered ? 1 : 0,
        }}
        title="Eliminar grupo"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export function HomeDashboard({ user, yjsDoc, onOpenPool, onLogout, onOpenCalendar, onNavigate }: {
  user: UserProfile;
  yjsDoc: Y.Doc;
  onOpenPool: (poolId: string, name: string, signalingUrl?: string) => void;
  onLogout: () => void;
  onOpenCalendar: () => void;
  onNavigate: (route: string) => void;
}) {
  const [pools, setPools] = useState<PoolInfo[]>(getSavedPools());
  const [joinId, setJoinId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('fluent-theme') as 'light' | 'dark') || 'dark'
  );
  const settings = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [nextEvents, setNextEvents] = useState<any[]>([]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fluent-theme', theme);
  }, [theme]);

  // Sincronización de Tareas P2P
  useEffect(() => {
    const svc = new TaskService(yjsDoc);
    const tasksMap = yjsDoc.getMap<Task>('tasks');

    const refreshTasks = () => {
      const existingLists = svc.getTaskLists(user.id);
      if (existingLists.length > 0) {
        const listId = existingLists[0].id;
        const allTasks = svc.getTasks(listId);
        setUpcomingTasks(allTasks.filter(t => t.state !== 'done').slice(0, 5));
      }
    };

    refreshTasks();
    tasksMap.observe(refreshTasks);
    return () => tasksMap.unobserve(refreshTasks);
  }, [yjsDoc, user.id]);

  // Lectura de Horarios desde LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('briefly-schedule-events');
      if (saved) {
        const allEvents = JSON.parse(saved);
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const today = days[new Date().getDay()];

        const todayEvents = allEvents
          .filter((e: any) => e.day === today)
          .sort((a: any, b: any) => a.startHour - b.startHour);

        setNextEvents(todayEvents.slice(0, 4));
      }
    } catch (e) {
      console.error('Error al cargar horarios para el Dashboard', e);
    }
  }, []);

  // ── Handlers (lógica sin cambios) ────────────────────────────────────────
  const handleCreate = async () => {
    let signalingIp = 'localhost';
    try {
      if (window.electronAPI) {
        signalingIp = await window.electronAPI.startSignaling();
      }
    } catch (e) {
      console.error('Error starting signaling:', e);
    }

    const name = newPoolName.trim() || 'Mi espacio';
    const poolId = `pool-${Math.random().toString(36).substr(2, 9)}`;
    const signalingUrl = `ws://${signalingIp}:4444`;

    const pool: PoolInfo = {
      id: poolId, name, icon: 'workspace',
      lastOpened: Date.now(), createdAt: Date.now(), signalingUrl,
    };

    addPool(pool);
    setPools(getSavedPools());
    setCreating(false);
    setNewPoolName('');
    onOpenPool(poolId, name, signalingUrl);
  };

  const handleJoin = async () => {
    if (!joinId.trim()) return;

    try {
      if (window.electronAPI) await window.electronAPI.stopSignaling();
    } catch (e) {
      console.error('Error stopping signaling:', e);
    }

    const input = joinId.trim();
    if (!input) return;

    let poolId = input;
    let signalingUrl: string | undefined;

    if (input.includes('@')) {
      const parts = input.split('@');
      poolId = parts[0];
      signalingUrl = `ws://${parts[1]}:4444`;
    }

    const savedPools = getSavedPools();
    const existingIndex = savedPools.findIndex(p => p.id === poolId);
    const poolName = existingIndex >= 0 ? savedPools[existingIndex].name : poolId;

    const pool: PoolInfo = {
      id: poolId, name: poolName, icon: 'collab',
      lastOpened: Date.now(),
      createdAt: existingIndex >= 0 ? savedPools[existingIndex].createdAt : Date.now(),
      signalingUrl: signalingUrl || (existingIndex >= 0 ? savedPools[existingIndex].signalingUrl : undefined),
    };

    addPool(pool);
    setPools(getSavedPools());
    setJoinId('');
    onOpenPool(pool.id, pool.name, signalingUrl);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removePool(id);
    setPools(getSavedPools());
  };

  const sorted = [...pools].sort((a, b) => b.lastOpened - a.lastOpened);
  const pendingTasksCount = upcomingTasks.length;
  const todayEventsCount = nextEvents.length;


  return (
    <div className="db2-container">
      {/* SIDEBAR */}
      <Sidebar
        user={user}
        currentScreen="dashboard"
        onNavigate={onNavigate}
        onLogout={onLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        onNewNote={() => setCreating(!creating)}
      />

      {/* MAIN */}
      <main className="db2-main">
        <div className="db2-content">

          {/* ── KPI CARDS ────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 36,
          }}>
            <KpiCard
              icon={<Users size={22} />}
              label="Total de Grupos"
              value={sorted.length}
            />
            <KpiCard
              icon={<ListTodo size={22} />}
              label="Tareas Pendientes"
              value={pendingTasksCount}
              onClick={() => onNavigate('tasks')}
            />
            <KpiCard
              icon={<CalendarClock size={22} />}
              label="Eventos Hoy"
              value={todayEventsCount}
              onClick={onOpenCalendar}
            />
          </div>

          {/* ── BENTO GRID ASIMÉTRICO ────────────────────────────────────── */}
          {/* Layout: [Mis grupos 300px | Horarios 1fr]  */}
          {/* debajo:  [Notas recientes 65% | Tareas próximas 35%] */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>

            {/* ── COLUMNA IZQUIERDA: Mis grupos ──────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              <div className="db2-section-header">
                <h3><Folder size={14} fill="currentColor" /> Mis grupos</h3>
                <span className="db2-link" onClick={() => setCreating(!creating)}>
                  {creating ? 'Cancelar' : '+ Nuevo'}
                </span>
              </div>

              {creating && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--accent)',
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <input
                    className="login-input"
                    placeholder="Nombre del grupo..."
                    value={newPoolName}
                    onChange={e => setNewPoolName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    autoFocus
                    style={{ marginBottom: 0 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="login-btn-primary" style={{ padding: '6px 16px', flex: 1 }} onClick={handleCreate}>
                      Crear
                    </button>
                    <button className="login-btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCreating(false)}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {sorted.length === 0 && !creating ? (
                <div style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: 12, padding: '24px 16px',
                  textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12,
                }}>
                  <Folder size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No hay grupos aún</p>
                  <span className="db2-link" style={{ marginTop: 8, display: 'inline-block' }}
                    onClick={() => setCreating(true)}>
                    Crear primero
                  </span>
                </div>
              ) : (
                sorted.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    onOpen={() => { updatePoolLastOpened(pool.id); onOpenPool(pool.id, pool.name, pool.signalingUrl); }}
                    onDelete={(e) => handleDelete(pool.id, e)}
                  />
                ))
              )}

              {/* Unirse a grupo */}
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Unirse con código
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="login-input"
                    placeholder="ID del grupo..."
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
                  />
                  <button className="login-btn-secondary" style={{ padding: '7px 14px', flexShrink: 0 }} onClick={handleJoin}>
                    Unirse
                  </button>
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: Horarios + Notas + Tareas ─────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>

              {/* Horarios de hoy */}
              <div>
                <div className="db2-section-header">
                  <h3><CalendarClock size={14} /> Horario de hoy</h3>
                  <span className="db2-link" onClick={onOpenCalendar}>Ver agenda</span>
                </div>
                <div className="db2-horarios-grid">
                  {nextEvents.length === 0 ? (
                    <div className="db2-horario-card" style={{ opacity: 0.7, alignItems: 'center', justifyContent: 'center', minHeight: 96 }}>
                      <Calendar size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
                      <h4 style={{ margin: 0, fontSize: 13 }}>Día libre</h4>
                    </div>
                  ) : (
                    nextEvents.map(evt => (
                      <div key={evt.id} className="db2-horario-card" onClick={onOpenCalendar}>
                        <div className="db2-icon-badge" style={{ backgroundColor: evt.color || 'var(--accent)', color: '#fff' }}>
                          <Activity size={12} />
                        </div>
                        <h4>{evt.title}</h4>
                        <div className="db2-time">
                          <Clock size={12} /> {evt.startHour}:00 - {evt.endHour}:00
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notas recientes + Tareas próximas — sub-grid 65/35 */}
              <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', gap: 24, minWidth: 0 }}>

                {/* Notas recientes */}
                <div>
                  <div className="db2-section-header">
                    <h3><History size={14} /> Notas recientes</h3>
                  </div>
                  <div className="db2-recent-list" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '4px 4px' }}>
                    {[
                      { title: 'Briefing Cliente - Web 3.0', time: 'hace 15 min' },
                      { title: 'Componentes de Diseño Atómico', time: 'hace 1 hora' },
                      { title: 'Notas Reunión QA', time: 'hace 1 día' },
                    ].map((note, i) => (
                      <div key={i} className="db2-recent-row">
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                          <FileText size={14} />
                        </div>
                        <div className="db2-recent-info">
                          <strong>{note.title}</strong>
                          <span>Modificado {note.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tareas próximas */}
                <div>
                  <div className="db2-section-header">
                    <h3 style={{ fontWeight: 600, fontSize: 13 }}>Tareas próximas</h3>
                    <span className="db2-link" onClick={() => onNavigate('tasks')}>Ver todas</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingTasks.length === 0 ? (
                      <div style={{
                        border: '1px dashed var(--border-color)',
                        borderRadius: 12, padding: '20px 12px',
                        textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12,
                      }}>
                        <CheckSquare size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
                        <p style={{ margin: 0 }}>Sin tareas pendientes</p>
                      </div>
                    ) : (
                      upcomingTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => onNavigate('tasks')}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10, padding: '9px 12px',
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 12, cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                          }}
                        >
                          <CheckSquare size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.text}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* FLOATING ACTIONS */}
        <div className="db2-floating-actions">
          <button className="db2-float-btn secondary">
            <FolderPlus size={16} /> NUEVA CARPETA
          </button>
          <button className="db2-float-btn primary" onClick={() => setCreating(true)}>
            <Edit2 size={16} /> NUEVA NOTA
          </button>
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} settings={settings} />}
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  );
}
