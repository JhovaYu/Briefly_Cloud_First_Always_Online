import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CalendarEvent {
  id: string;
  title: string;
  note?: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: 'personal' | 'estudio' | 'trabajo' | 'otro';
  color: string;
  reminder?: string;
}

interface EventPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  initialDate: Date;
  initialTime?: string;
  x: number;
  y: number;
}

const PRESET_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#65a30d'];
const REMINDERS = ['Sin recordatorio', '5 min', '15 min', '30 min', '1 hora'];

export function EventPopup({ isOpen, onClose, onSave, initialDate, initialTime, x, y }: EventPopupProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startTime, setStartTime] = useState(initialTime || '09:00');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('personal');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [reminder, setReminder] = useState(REMINDERS[0]);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setNote('');
      setShowAdvanced(false);
      setStartTime(initialTime || '09:00');
      let startH = parseInt((initialTime || '09:00').split(':')[0]);
      let endH = (startH + 1) % 24;
      setEndTime(`${endH.toString().padStart(2, '0')}:00`);
      setType('personal');
      setColor(PRESET_COLORS[0]);
      setReminder(REMINDERS[0]);
    }
  }, [isOpen, initialDate, initialTime]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), note: note.trim() || undefined, date: initialDate, startTime, endTime, type, color, reminder: reminder === 'Sin recordatorio' ? undefined : reminder });
  };

  if (!isOpen) return null;

  const width = 320;
  const height = showAdvanced ? 450 : 180;
  const safeX = Math.min(x, window.innerWidth - width - 20);
  const safeY = Math.min(y, window.innerHeight - height - 20);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    color: 'var(--text-primary)', marginBottom: '12px', boxSizing: 'border-box',
    outline: 'none', fontSize: '13px', fontFamily: 'inherit'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px'
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed', zIndex: 1000, top: safeY, left: safeX, width,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box'
        }}
      >
        <input autoFocus type="text" placeholder="Nombre del evento" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          style={{ ...inputStyle, border: 'none', background: 'transparent', fontSize: '16px', fontWeight: 600, padding: '0 0 8px 0', borderBottom: '1px solid var(--border-color)', borderRadius: 0 }}
        />
        <textarea placeholder="Añadir nota opcional..." rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: 'none', height: '60px' }}
        />
        
        <div 
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center' }}
        >
          {showAdvanced ? 'Ocultar ajustes' : 'Ajustes avanzados'}
          <span style={{ marginLeft: '4px', transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </div>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Inicio</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fin</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <label style={labelStyle}>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} style={inputStyle}>
                <option value="personal">Personal</option><option value="estudio">Estudio</option><option value="trabajo">Trabajo</option><option value="otro">Otro</option>
              </select>
              <label style={labelStyle}>Recordatorio</label>
              <select value={reminder} onChange={(e) => setReminder(e.target.value)} style={inputStyle}>
                {REMINDERS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label style={labelStyle}>Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={() => setColor(c)} style={{
                      width: 20, height: 20, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                      boxShadow: color === c ? '0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--text-primary)' : 'none'
                    }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: 'var(--bg-hover)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
          <button disabled={!title.trim()} onClick={handleSave} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: '13px', opacity: title.trim() ? 1 : 0.5 }}>Crear</button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
