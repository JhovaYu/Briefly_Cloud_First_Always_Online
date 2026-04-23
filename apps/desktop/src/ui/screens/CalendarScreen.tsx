import React, { useState, useEffect } from 'react';
import {
  History, FileText, Calendar, CheckSquare, Clock, Archive, Trash2,
  Settings, LogOut, Sun, Moon, Bell, Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { UserProfile } from '../../core/domain/UserProfile';
import { EventPopup, type CalendarEvent } from '../components/EventPopup';
import { Sidebar } from '../components/Sidebar';

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface CalendarScreenProps {
  user: UserProfile;
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export function CalendarScreen({ user, onBack, onNavigate }: CalendarScreenProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('fluent-theme') as 'light' | 'dark') || 'dark');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  const STORAGE_KEY = 'briefly_calendar_events';

  const loadEvents = (): CalendarEvent[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw).map((e: CalendarEvent) => ({
        ...e,
        date: new Date(e.date)
      }));
    } catch { return []; }
  };

  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const [currentTime, setCurrentTime] = useState(new Date());

  const [popupData, setPopupData] = useState<{ isOpen: boolean; x: number; y: number; date: Date; time?: string }>({
    isOpen: false, x: 0, y: 0, date: new Date()
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fluent-theme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const goToToday = () => setCurrentDate(new Date());

  const navigate = (direction: 1 | -1) => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
      newDate.setDate(1);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  const handleCreateEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = { ...eventData, id: Math.random().toString(36).substr(2, 9) };
    setEvents([...events, newEvent]);
    setPopupData(prev => ({ ...prev, isOpen: false }));
  };

  const openPopup = (e: React.MouseEvent, date: Date, time?: string) => {
    e.stopPropagation();
    setPopupData({ isOpen: true, x: e.clientX, y: e.clientY, date, time });
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);

    const days = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    let nextMonthDay = 1;
    while (days.length % 7 !== 0) {
      days.push({ day: nextMonthDay++, isCurrentMonth: false, date: new Date(year, month + 1, nextMonthDay - 1) });
    }

    const weekDays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', paddingRight: '17px' }}>
          {weekDays.map(wd => (
            <div key={wd} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {wd}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflowY: 'scroll', borderBottom: '1px solid var(--border-color)' }}>
          {days.map((d, i) => {
            const isToday = isSameDay(d.date, new Date());
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), d.date));
            const displayEvents = dayEvents.slice(0, 3);
            const moreEvents = dayEvents.length - 3;

            return (
              <div
                key={i}
                onClick={(e) => openPopup(e, d.date)}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                style={{
                  minHeight: '100px',
                  borderRight: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  padding: '4px',
                  display: 'flex', flexDirection: 'column', cursor: 'pointer',
                  backgroundColor: 'var(--bg-primary)',
                  transition: 'background-color 0.2s',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{
                  fontSize: '12px', fontWeight: isToday ? 700 : 500, margin: '2px 0 4px 2px',
                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? '#fff' : (d.isCurrentMonth ? 'var(--text-primary)' : 'var(--text-tertiary)')
                }}>
                  {d.day}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {displayEvents.map(evt => (
                    <div
                      key={evt.id}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '2px 6px', fontSize: '11px', color: '#fff', borderRadius: '4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        backgroundColor: evt.color,
                        border: `1px solid ${hexToRgba(evt.color, 0.5)}`
                      }}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {moreEvents > 0 && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', paddingLeft: '4px', fontWeight: 600 }}>+ {moreEvents} más</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const HOURS = Array.from({ length: 24 }, (_, i) => i);
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ width: '60px', borderRight: '1px solid var(--border-color)', flexShrink: 0 }}></div>
          {weekDays.map((d, i) => (
            <div key={i} style={{ flex: 1, padding: '8px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{dayNames[i]}</div>
              <div style={{ fontSize: '18px', color: isSameDay(d, new Date()) ? 'var(--accent)' : 'var(--text-primary)', fontWeight: isSameDay(d, new Date()) ? 'bold' : 'normal' }}>
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', background: 'var(--bg-primary)' }}>
          {HOURS.map(hour => (
            <div key={`row-${hour}`} style={{ display: 'flex', position: 'absolute', width: '100%', top: hour * 60, height: '60px' }}>
              <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', height: '60px', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: '2px', paddingRight: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {hour}:00
              </div>
              {weekDays.map((d, colIndex) => (
                <div key={`cell-${colIndex}-${hour}`}
                  onClick={(e) => openPopup(e, d, `${hour.toString().padStart(2, '0')}:00`)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  style={{ flex: 1, borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                />
              ))}
            </div>
          ))}

          {events.map((evt) => {
            const evtDate = new Date(evt.date);
            const dayIndex = evtDate.getDay();
            const startHourValue = parseInt(evt.startTime.split(':')[0]) + parseInt(evt.startTime.split(':')[1]) / 60;
            const endHourValue = parseInt(evt.endTime.split(':')[0]) + parseInt(evt.endTime.split(':')[1]) / 60;
            const duration = endHourValue - startHourValue;

            if (evtDate >= startOfWeek && evtDate < new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)) {
              return (
                <div key={evt.id} style={{
                  position: 'absolute', borderRadius: '4px', padding: '4px', overflow: 'hidden', fontSize: '11px', color: '#fff',
                  borderLeft: '4px solid rgba(255,255,255,0.5)',
                  left: `calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 2px)`,
                  width: `calc(((100% - 60px) / 7) - 4px)`,
                  top: `calc(${startHourValue * 60}px + 1px)`,
                  height: `calc(${duration * 60}px - 2px)`,
                  backgroundColor: evt.color,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.title}</div>
                  <div style={{ opacity: 0.8, fontSize: '10px' }}>{evt.startTime} - {evt.endTime}</div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="db2-container">
      <Sidebar
        user={user}
        currentScreen="calendar"
        onNavigate={onNavigate}
        onLogout={() => { }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="db2-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', userSelect: 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
              {currentDate.getFullYear()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', lineHeight: 1 }}>
                {view === 'month' ? monthNames[currentDate.getMonth()] : `Semana ${getWeekNumber(currentDate)}`}
              </h1>
            </div>
            {view === 'week' && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
                {(() => {
                  const start = new Date(currentDate);
                  start.setDate(currentDate.getDate() - currentDate.getDay());
                  const end = new Date(start);
                  end.setDate(start.getDate() + 6);
                  if (start.getMonth() === end.getMonth()) {
                    return `${start.getDate()} - ${end.getDate()} de ${monthNames[start.getMonth()]}`;
                  }
                  return `${start.getDate()} de ${monthNames[start.getMonth()]} - ${end.getDate()} de ${monthNames[end.getMonth()]}`;
                })()}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px', gap: '4px' }}>
              <button
                onClick={goToToday}
                style={{ padding: '6px 12px', fontSize: '13px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
              >
                Hoy
              </button>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }} />
              <button onClick={() => navigate(-1)} className="db2-user-icon-btn"><ChevronLeft size={18} /></button>
              <button onClick={() => navigate(1)} className="db2-user-icon-btn"><ChevronRight size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button onClick={() => setView('month')} style={{ padding: '6px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, border: 'none', background: view === 'month' ? 'var(--bg-primary)' : 'transparent', color: view === 'month' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: view === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}>Mes</button>
              <button onClick={() => setView('week')} style={{ padding: '6px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, border: 'none', background: view === 'week' ? 'var(--bg-primary)' : 'transparent', color: view === 'week' ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: view === 'week' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}>Semana</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {view === 'month' ? renderMonthView() : renderWeekView()}
        </div>
      </main>

      <EventPopup isOpen={popupData.isOpen} onClose={() => setPopupData(prev => ({ ...prev, isOpen: false }))} onSave={handleCreateEvent} initialDate={popupData.date} initialTime={popupData.time} x={popupData.x} y={popupData.y} />
    </div>
  );
}
