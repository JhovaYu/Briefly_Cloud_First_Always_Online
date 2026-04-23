import React, { useState, useEffect, useRef } from 'react';
import {
  History, FileText, Calendar, CheckSquare, Clock, Archive, Trash2,
  Settings, LogOut, Sun, Moon, Bell, Plus, FileText as FileTextIcon, Sigma, Edit2,
  RotateCcw, CalendarOff
} from 'lucide-react';
import type { UserProfile } from '../../core/domain/UserProfile';
import { Sidebar } from '../components/Sidebar';

interface ScheduleEvent {
  id: string;
  title: string;
  category: string;
  color: string;
  day: string;
  startHour: number;
  endHour: number;
  icon: 'file' | 'sigma' | 'clock';
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ScheduleConfig {
  name: string;
  days: string[];
  startHour: number;
  endHour: number;
}

const STORAGE_KEYS = {
  events: 'briefly-schedule-events',
  categories: 'briefly-schedule-categories',
  config: 'briefly-schedule-config',
};

const PRESET_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#d97706', '#0891b2', '#be185d', '#65a30d'];
const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const initialCategories: Category[] = [
  { id: '1', name: 'TIME NOTA', color: '#7c3aed' },
  { id: '2', name: 'MATEMÁTICAS', color: '#2563eb' }
];

const initialConfig: ScheduleConfig = {
  name: 'Horario',
  days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  startHour: 8,
  endHour: 19
};

interface ScheduleScreenProps {
  user: UserProfile;
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export function ScheduleScreen({ user, onBack, onNavigate }: ScheduleScreenProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('fluent-theme') as 'light' | 'dark') || 'dark'
  );

  const [scheduleInitialized, setScheduleInitialized] = useState<boolean>(() => {
    return localStorage.getItem('briefly-schedule-initialized') === 'true';
  });

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.events);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.categories);
      return saved ? JSON.parse(saved) : initialCategories;
    } catch { return initialCategories; }
  });

  const [config, setConfig] = useState<ScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.config);
      return saved ? JSON.parse(saved) : initialConfig;
    } catch { return initialConfig; }
  });

  const [tempConfig, setTempConfig] = useState<ScheduleConfig>(config);

  const [modalData, setModalData] = useState<ScheduleEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; eventId?: string; emptySlot?: { day: string; startHour: number } } | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<ScheduleEvent | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [showScheduleConfig, setShowScheduleConfig] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('fluent-theme', newTheme);
  };

  const HOURS = Array.from({ length: config.endHour - config.startHour }, (_, i) => i + config.startHour);
  const HOUR_HEIGHT = 80;

  const renderIcon = (iconName: string, size = 14) => {
    if (iconName === 'sigma') return <Sigma size={size} />;
    if (iconName === 'clock') return <Clock size={size} />;
    return <FileTextIcon size={size} />;
  };

  const handleOpenCreate = (day: string, startHour: number) => {
    setModalData({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      category: '',
      color: PRESET_COLORS[0],
      day,
      startHour,
      endHour: startHour + 1,
      icon: 'file'
    });
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setIsEditing(false);
  };

  const handleOpenEdit = (evt: ScheduleEvent) => {
    setModalData({ ...evt });
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!modalData) return;
    let finalData = { ...modalData };

    if (isCreatingCategory && newCategoryName.trim()) {
      const newCat: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: newCategoryName.trim(),
        color: modalData.color
      };
      setCategories([...categories, newCat]);
      finalData.category = newCat.name;
    } else if (isCreatingCategory && !newCategoryName.trim()) {
      finalData.category = '';
    }

    if (isEditing) {
      setEvents(events.map(e => e.id === finalData.id ? finalData : e));
    } else {
      setEvents([...events, finalData]);
    }
    setModalData(null);
  };

  const handleDelete = () => {
    if (!modalData) return;
    setEvents(events.filter(e => e.id !== modalData.id));
    setModalData(null);
  };

  const handleOpenConfig = () => {
    setTempConfig(config);
    setShowScheduleConfig(true);
  };

  const handleSaveConfig = () => {
    console.log('[Schedule] Guardando config:', tempConfig);
    setConfig(tempConfig);
    setScheduleInitialized(true);
    localStorage.setItem('briefly-schedule-initialized', 'true');
    setShowScheduleConfig(false);
  };

  return (
    <div className="db2-container">
      <style>{`
        .db2-empty-slot {
          position: absolute;
          width: 100%;
          height: 80px;
          cursor: pointer;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.2s;
          z-index: 5;
        }
        .db2-empty-slot:hover {
          opacity: 1;
          /* Using var directly is fine if it handles transparency gracefully, else use subtle background */
          background-color: var(--bg-tertiary);
          box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
        }
        .empty-slot-icon {
          color: var(--accent);
          opacity: 0.6;
        }
        
        .db2-schedule-event {
          position: absolute;
          left: 4px;
          right: 4px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-left: 3px solid var(--event-color, var(--accent));
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          cursor: pointer;
          z-index: 10;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .db2-schedule-event:hover {
          border-color: var(--event-color, rgba(139, 92, 246, 0.7));
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .db2-event-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 20;
          border-radius: inherit;
        }
        .db2-schedule-event:hover .db2-event-overlay {
          opacity: 1;
        }

        .db2-modal-input {
          width: 100%;
          padding: 8px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          margin-bottom: 12px;
          box-sizing: border-box;
          font-size: 13px;
          font-family: inherit;
        }
        .db2-modal-input:focus {
          border-color: var(--accent);
          outline: none;
        }
        select.db2-modal-input {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 32px;
        }
        
        .db2-context-menu {
          position: fixed;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          min-width: 160px;
          display: flex;
          flex-direction: column;
          padding: 4px;
        }
        .db2-context-menu-item {
          background: transparent;
          border: none;
          text-align: left;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
          border-radius: 4px;
          font-family: inherit;
        }
        .db2-context-menu-item:hover {
          background: var(--bg-hover);
        }
        .db2-context-menu-item.danger {
          color: #ef4444;
        }
        .db2-context-menu-item.danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }
        
        .db2-checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-primary);
          cursor: pointer;
        }
        .db2-checkbox-label input {
          cursor: pointer;
          accent-color: var(--accent);
        }
      `}</style>

      {/* SIDEBAR COPIADO EXACTAMENTE */}
      <Sidebar
        user={user}
        currentScreen="schedule"
        onNavigate={onNavigate}
        onLogout={() => { }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* MAIN SCHEDULE VIEW */}
      <main className="db2-main" style={styles.mainArea}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <img src="./logo.png" alt="Briefly Logo" style={styles.headerLogo} />
            <h1 style={styles.headerTitle}>{config.name}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {events.length > 0 && (
              <button
                className="db2-user-icon-btn"
                onClick={() => setShowResetConfirm(true)}
                title="Borrar todos los eventos"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              className="db2-user-icon-btn"
              onClick={handleOpenConfig}
              title="Configuración del horario"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {!scheduleInitialized ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px 32px 32px' }}>
            <div
              onClick={handleOpenConfig}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-secondary)', border: '2px dashed var(--border-color)', borderRadius: '12px',
                padding: '48px', cursor: 'pointer', transition: 'all 0.2s', width: '100%', maxWidth: '400px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none' }}
            >
              <CalendarOff size={48} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>Ningún horario aquí</h3>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px' }}>Haz click para configurar tu horario</p>
            </div>
          </div>
        ) : (
          <div style={styles.scheduleWrapper}>

            {/* Top axis: Days */}
            <div style={styles.scheduleHeader}>
              <div style={styles.timeColHeader}></div>
              {config.days.map(day => (
                <div key={day} style={styles.dayHeader}>{day}</div>
              ))}
            </div>

            <div style={styles.scheduleBody}>
              {/* Background Grid Lines */}
              <div style={styles.gridLinesContainer}>
                {HOURS.map((hour, i) => (
                  <div key={`line-${hour}`} style={{ ...styles.gridLineRow, top: i * HOUR_HEIGHT }}>
                    <div style={styles.timeColHeader}></div>
                    {config.days.map((_, j) => (
                      <div key={`col-${j}`} style={styles.gridLineCell}></div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Foreground content: Time labels and Events */}
              <div style={styles.scheduleContent}>

                {/* Left axis: Times */}
                <div style={styles.timeAxis}>
                  {HOURS.map((hour, i) => (
                    <div key={`time-${hour}`} style={{ ...styles.timeLabelObj, top: i * HOUR_HEIGHT }}>
                      {hour}:00
                    </div>
                  ))}
                </div>

                {/* Day Columns containing absolute events and empty slots */}
                <div style={styles.dayColumnsAxis}>
                  {config.days.map(day => {
                    const dayEvents = events.filter(e => e.day === day);
                    return (
                      <div key={day} style={styles.dayCol}>

                        {/* Empty Hoverable Slots */}
                        {HOURS.map(hour => (
                          <div
                            key={`empty-${day}-${hour}`}
                            className="db2-empty-slot"
                            style={{ top: `${(hour - config.startHour) * HOUR_HEIGHT}px` }}
                            onClick={() => handleOpenCreate(day, hour)}
                            onContextMenu={(e) => {
                              if (copiedEvent) {
                                e.preventDefault();
                                let x = e.clientX;
                                let y = e.clientY;
                                if (x > window.innerWidth - 170) x = window.innerWidth - 170;
                                if (y > window.innerHeight - 50) y = window.innerHeight - 50;
                                setContextMenu({ x, y, emptySlot: { day, startHour: hour } });
                              }
                            }}
                          >
                            <Plus className="empty-slot-icon" size={24} />
                          </div>
                        ))}

                        {/* Display Events */}
                        {dayEvents.map(evt => {
                          const topPos = (evt.startHour - config.startHour) * HOUR_HEIGHT;
                          const heightPos = (evt.endHour - evt.startHour) * HOUR_HEIGHT;

                          // Only render if it's within the configured hours
                          if (evt.endHour <= config.startHour || evt.startHour >= config.endHour) return null;

                          // Trim visually if it overflows the view bounds
                          const visibleTop = Math.max(0, topPos);
                          const overflowTop = topPos < 0 ? Math.abs(topPos) : 0;
                          const visibleHeight = heightPos - overflowTop;

                          if (visibleHeight <= 0) return null;

                          return (
                            <div
                              key={evt.id}
                              className="db2-schedule-event"
                              style={{
                                top: `${visibleTop + 4}px`,
                                height: `${visibleHeight - 8}px`,
                                '--event-color': evt.color,
                              } as React.CSSProperties}
                              onClick={() => handleOpenEdit(evt)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                let x = e.clientX;
                                let y = e.clientY;
                                if (x > window.innerWidth - 170) x = window.innerWidth - 170;
                                if (y > window.innerHeight - 130) y = window.innerHeight - 130;
                                setContextMenu({ x, y, eventId: evt.id });
                              }}
                            >
                              <div className="db2-event-overlay">
                                <Edit2 size={24} color="#fff" />
                              </div>

                              {evt.category && (
                                <span style={{
                                  ...styles.eventCategory,
                                  color: evt.color,
                                  background: hexToRgba(evt.color, 0.2)
                                }}>
                                  {evt.category}
                                </span>
                              )}
                              <strong style={styles.eventName}>{evt.title}</strong>
                              <span style={styles.eventTime}>{evt.startHour}:00 - {evt.endHour}:00</span>
                              <div style={styles.eventIconContainer}>
                                {renderIcon(evt.icon)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="db2-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.eventId ? (
            <>
              <button
                className="db2-context-menu-item"
                onClick={() => {
                  const evt = events.find(e => e.id === contextMenu.eventId);
                  if (evt) handleOpenEdit(evt);
                  setContextMenu(null);
                }}>
                Editar
              </button>
              <button
                className="db2-context-menu-item"
                onClick={() => {
                  const evt = events.find(e => e.id === contextMenu.eventId);
                  if (evt) setCopiedEvent(evt);
                  setContextMenu(null);
                }}>
                Copiar evento
              </button>
              <button
                className="db2-context-menu-item danger"
                onClick={() => {
                  setEvents(events.filter(e => e.id !== contextMenu.eventId));
                  setContextMenu(null);
                }}>
                Eliminar
              </button>
            </>
          ) : contextMenu.emptySlot && copiedEvent ? (
            <button
              className="db2-context-menu-item"
              onClick={() => {
                const duration = copiedEvent.endHour - copiedEvent.startHour;
                const newEvent = {
                  ...copiedEvent,
                  id: Math.random().toString(36).substr(2, 9),
                  day: contextMenu.emptySlot!.day,
                  startHour: contextMenu.emptySlot!.startHour,
                  endHour: contextMenu.emptySlot!.startHour + duration,
                };
                setEvents([...events, newEvent]);
                setContextMenu(null);
              }}>
              Pegar evento aquí
            </button>
          ) : null}
        </div>
      )}

      {/* MODAL RESET CONFIRM */}
      {showResetConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 18, marginBottom: 12 }}>
              ¿Borrar todos los eventos?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Esta acción eliminará todos los eventos de tu horario actual y no se puede deshacer. Se mantendrán tus categorías y configuraciones de día/hora.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={styles.btnCancel} onClick={() => setShowResetConfirm(false)}>Cancelar</button>
              <button style={styles.btnDanger} onClick={() => {
                setEvents([]);
                setScheduleInitialized(false);
                localStorage.setItem('briefly-schedule-initialized', 'false');
                setShowResetConfirm(false);
              }}>Borrar todo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIG */}
      {showScheduleConfig && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 18, marginBottom: 20 }}>
              Configuración del horario
            </h2>

            <label style={styles.inputLabel}>Nombre del horario</label>
            <input
              className="db2-modal-input"
              value={tempConfig.name}
              onChange={e => setTempConfig({ ...tempConfig, name: e.target.value })}
            />

            <label style={styles.inputLabel}>Días visibles</label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {ALL_DAYS.map(day => (
                <label key={day} className="db2-checkbox-label">
                  <input
                    type="checkbox"
                    checked={tempConfig.days.includes(day)}
                    onChange={e => {
                      if (e.target.checked) {
                        setTempConfig({ ...tempConfig, days: [...tempConfig.days, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)) });
                      } else {
                        // Keep at least 1 day
                        if (tempConfig.days.length > 1) {
                          setTempConfig({ ...tempConfig, days: tempConfig.days.filter(d => d !== day) });
                        }
                      }
                    }}
                  />
                  {day.substr(0, 3)}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.inputLabel}>Hora inicio</label>
                <select
                  className="db2-modal-input"
                  value={tempConfig.startHour}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    let newEnd = tempConfig.endHour;
                    if (val >= newEnd) newEnd = val + 1;
                    setTempConfig({ ...tempConfig, startHour: val, endHour: newEnd });
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.inputLabel}>Hora fin</label>
                <select
                  className="db2-modal-input"
                  value={tempConfig.endHour}
                  onChange={e => setTempConfig({ ...tempConfig, endHour: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 24 - tempConfig.startHour }, (_, i) => i + tempConfig.startHour + 1).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button style={styles.btnCancel} onClick={() => setShowScheduleConfig(false)}>Cancelar</button>
              <button style={styles.btnPrimary} onClick={handleSaveConfig}>Guardar configuración</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT/CREATE */}
      {modalData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 18, marginBottom: 20 }}>
              {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>

            <label style={styles.inputLabel}>Título del evento</label>
            <input
              className="db2-modal-input"
              value={modalData.title}
              onChange={e => setModalData({ ...modalData, title: e.target.value })}
              placeholder="Ej. Revisión semanal"
            />

            <label style={styles.inputLabel}>Materia / Categoría</label>
            <select
              className="db2-modal-input"
              value={isCreatingCategory ? '__new__' : modalData.category}
              onChange={e => {
                const val = e.target.value;
                if (val === '__new__') {
                  setIsCreatingCategory(true);
                  setNewCategoryName('');
                } else {
                  setIsCreatingCategory(false);
                  const selectedCat = categories.find(c => c.name === val);
                  setModalData({ ...modalData, category: val, color: selectedCat ? selectedCat.color : modalData.color });
                }
              }}
            >
              <option value="">Ninguna</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              <option value="__new__">+ Nueva categoría</option>
            </select>

            {isCreatingCategory && (
              <div style={{ marginBottom: 12 }}>
                <label style={styles.inputLabel}>Nombre de nueva categoría</label>
                <input
                  className="db2-modal-input"
                  style={{ marginBottom: 0 }}
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Ej. Física"
                />
              </div>
            )}

            <label style={styles.inputLabel}>Color</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <div key={c} onClick={() => setModalData({ ...modalData, color: c })}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                    outline: modalData.color === c ? `2px solid var(--text-primary)` : 'none',
                    outlineOffset: '2px',
                    marginRight: '2px'
                  }} />
              ))}
              <input type="color" value={modalData.color} onChange={e => setModalData({ ...modalData, color: e.target.value })}
                style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 'auto' }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.inputLabel}>Día</label>
                <select
                  className="db2-modal-input"
                  value={modalData.day}
                  onChange={e => setModalData({ ...modalData, day: e.target.value })}
                >
                  {config.days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.inputLabel}>Hora inicio</label>
                <select
                  className="db2-modal-input"
                  value={modalData.startHour}
                  onChange={e => {
                    const newStart = parseInt(e.target.value);
                    let newEnd = modalData.endHour;
                    if (newStart >= newEnd) newEnd = newStart + 1;
                    setModalData({ ...modalData, startHour: newStart, endHour: newEnd });
                  }}
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.inputLabel}>Hora fin</label>
                <select
                  className="db2-modal-input"
                  value={modalData.endHour}
                  onChange={e => setModalData({ ...modalData, endHour: parseInt(e.target.value) })}
                >
                  {Array.from({ length: config.endHour - modalData.startHour }, (_, i) => i + modalData.startHour + 1).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={styles.inputLabel}>Ícono visual</label>
            <select
              className="db2-modal-input"
              value={modalData.icon}
              onChange={e => setModalData({ ...modalData, icon: e.target.value as any })}
            >
              <option value="file">Archivo (FileText)</option>
              <option value="sigma">Matemáticas (Sigma)</option>
              <option value="clock">Tiempo (Clock)</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button style={styles.btnCancel} onClick={() => setModalData(null)}>Cancelar</button>
              {isEditing && <button style={styles.btnDanger} onClick={handleDelete}>Eliminar</button>}
              <button style={styles.btnPrimary} onClick={handleSave}>
                {isEditing ? 'Guardar cambios' : 'Añadir evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline constant for styles
const styles: Record<string, React.CSSProperties> = {
  mainArea: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden',
    height: '100vh',
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '32px 32px 16px 32px',
  },
  headerLogo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  scheduleWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '0 32px 32px 32px',
  },
  scheduleHeader: {
    display: 'flex',
    paddingBottom: '16px',
    minWidth: '900px',
  },
  timeColHeader: {
    width: '60px',
    flexShrink: 0,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 500,
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  scheduleBody: {
    position: 'relative',
    minWidth: '900px',
    borderTop: '1px solid var(--border-color)',
    borderLeft: '1px solid var(--border-color)',
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  gridLineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '80px',
    display: 'flex',
  },
  gridLineCell: {
    flex: 1,
    borderBottom: '1px solid var(--border-color)',
    borderRight: '1px solid var(--border-color)',
  },
  scheduleContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
  },
  timeAxis: {
    width: '60px',
    flexShrink: 0,
    position: 'relative',
    borderRight: '1px solid transparent',
  },
  timeLabelObj: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    transform: 'translateY(-50%)',
    fontWeight: 500,
  },
  dayColumnsAxis: {
    flex: 1,
    display: 'flex',
  },
  dayCol: {
    flex: 1,
    position: 'relative',
  },
  eventCategory: {
    fontSize: '10px',
    padding: '4px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  eventName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  },
  eventTime: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginBottom: 'auto',
  },
  eventIconContainer: {
    color: 'var(--text-tertiary)',
    display: 'flex',
    marginTop: '8px',
  },

  /* MODAL STYLES */
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    fontWeight: 500,
  },
  btnCancel: {
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnDanger: {
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnPrimary: {
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'var(--accent)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  }
};
