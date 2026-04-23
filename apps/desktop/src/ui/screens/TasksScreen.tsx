import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  History, FileText, Calendar, CheckSquare, Clock, Archive,
  Trash2, Settings, LogOut, Bell, Plus, X,
  CheckCircle2, AlertCircle,
  LayoutList, LayoutGrid, Search, MoreHorizontal,
  Flag,
} from 'lucide-react';
import * as Y from 'yjs';
import type { Task, TaskState, TaskPriority, TaskList } from '@tuxnotas/shared';
import { TaskService } from '@tuxnotas/shared';
import type { UserProfile } from '../../core/domain/UserProfile';
import { Sidebar } from '../components/Sidebar';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const STATUS_META: Record<TaskState, { label: string; color: string; bgVar: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendiente', color: 'var(--text-tertiary)', bgVar: 'var(--bg-secondary)', icon: <CheckSquare size={14} /> },
  working: { label: 'En progreso', color: 'var(--accent)', bgVar: 'var(--accent-light)', icon: <Clock size={14} /> },
  done: { label: 'Completada', color: 'var(--color-success)', bgVar: 'rgba(16,185,129,0.08)', icon: <CheckCircle2 size={14} /> },
};

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Baja', color: 'var(--text-secondary)' },
  medium: { label: 'Media', color: 'var(--color-warning)' },
  high: { label: 'Alta', color: 'var(--color-error)' },
};

// Converts a Unix timestamp to yyyy-mm-dd for <input type="date">
function tsToDateInput(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

// Converts yyyy-mm-dd string to start-of-day Unix timestamp
function dateInputToTs(s: string): number | undefined {
  if (!s) return undefined;
  return new Date(s).getTime();
}

// ─────────────────────────────────────────────
// SHARED FORM STYLES  (top-level to avoid recreating on every render)
// ─────────────────────────────────────────────

const FORM_OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const FORM_MODAL_STYLE: React.CSSProperties = {
  background: 'var(--bg-modal)', border: '1px solid var(--border-color)',
  borderRadius: '12px', boxShadow: 'var(--shadow-lg)', width: '480px', maxWidth: '95vw',
  padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px',
};

const FORM_LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px',
};

const FORM_INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '6px',
  border: '1px solid var(--border-input)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const FORM_SELECT_STYLE: React.CSSProperties = { ...FORM_INPUT_STYLE, cursor: 'pointer' };

// ─────────────────────────────────────────────
// SCREEN PROPS
// ─────────────────────────────────────────────

// Shared type for all navigable screens in the app
type AppScreen = 'dashboard' | 'notes' | 'calendar' | 'tasks' | 'schedule' | 'boards' | 'trash';

interface TasksScreenProps {
  user: UserProfile;
  yjsDoc: Y.Doc;  // The user's personal Y.Doc (IndexedDB-backed)
  onNavigate: (screen: AppScreen) => void;
  onBack: () => void;
}

// ─────────────────────────────────────────────
// TASK FORM MODAL
// ─────────────────────────────────────────────

interface TaskFormProps {
  initial?: Partial<Task> & { dueDateStr?: string }; // dueDateStr is yyyy-mm-dd
  onSave: (data: {
    text: string;
    description: string;
    state: TaskState;
    priority: TaskPriority;
    tags: string[];
    dueDateStr: string;
  }) => void;
  onClose: () => void;
}

function TaskForm({ initial, onSave, onClose }: TaskFormProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [state, setState] = useState<TaskState>(initial?.state ?? 'pending');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [dueDateStr, setDueDateStr] = useState(initial?.dueDateStr ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ text: text.trim(), description: description.trim(), state, priority, tags, dueDateStr });
  };

  // Styles are defined at module level (FORM_*_STYLE) to avoid object recreation.
  return (
    <motion.div
      style={FORM_OVERLAY_STYLE}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        style={FORM_MODAL_STYLE}
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {initial?.id ? 'Editar tarea' : 'Nueva tarea'}
          </h3>
          <button type="button" onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div>
          <label style={FORM_LABEL_STYLE}>Título *</label>
          <input ref={textRef} style={FORM_INPUT_STYLE} value={text} onChange={e => setText(e.target.value)} placeholder="¿Qué hay que hacer?" />
        </div>

        {/* Description */}
        <div>
          <label style={FORM_LABEL_STYLE}>Descripción</label>
          <textarea style={{ ...FORM_INPUT_STYLE, minHeight: '72px', resize: 'vertical' } as React.CSSProperties}
            value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles opcionales..." />
        </div>

        {/* Row: State + Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={FORM_LABEL_STYLE}>Estado</label>
            <select style={FORM_SELECT_STYLE} value={state} onChange={e => setState(e.target.value as TaskState)}>
              <option value="pending">Pendiente</option>
              <option value="working">En progreso</option>
              <option value="done">Completada</option>
            </select>
          </div>
          <div>
            <label style={FORM_LABEL_STYLE}>Prioridad</label>
            <select style={FORM_SELECT_STYLE} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label style={FORM_LABEL_STYLE}>Fecha límite</label>
          <input type="date" style={FORM_INPUT_STYLE} value={dueDateStr} onChange={e => setDueDateStr(e.target.value)} />
        </div>

        {/* Tags */}
        <div>
          <label style={FORM_LABEL_STYLE}>Etiquetas (Enter para añadir)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {tags.map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12px', fontWeight: 500 }}>
                {t}
                <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, display: 'flex', lineHeight: 1 }}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <input style={FORM_INPUT_STYLE} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="ej: frontend, urgente" />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Cancelar
          </button>
          <button type="submit"
            style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            {initial?.id ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// TASK CARD (List view)
// ─────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onStateCycle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onInlineRename: (id: string, newText: string) => void;
}

function TaskCard({ task, onStateCycle, onEdit, onDelete, onInlineRename }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(task.text);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const meta = STATUS_META[task.state];
  const pMeta = task.priority ? PRIORITY_META[task.priority] : null;

  // dueDate is a timestamp; compare with today for overdue
  const isOverdue = task.dueDate && task.state !== 'done' && task.dueDate < Date.now();
  const dueDateDisplay = task.dueDate ? tsToDateInput(task.dueDate) : null;

  useEffect(() => {
    if (isEditing) {
      inlineInputRef.current?.focus();
      inlineInputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = draftText.trim();
    if (trimmed && trimmed !== task.text) onInlineRename(task.id, trimmed);
    else setDraftText(task.text); // revert if empty or unchanged
    setIsEditing(false);
  };

  const cancelRename = () => {
    setDraftText(task.text);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px',
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '12px',
        transition: 'border-color 0.15s, box-shadow 0.15s', cursor: 'default',
        opacity: task.state === 'done' ? 0.7 : 1,
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* State toggle — stopPropagation prevents DraggableCard from intercepting the click as a drag */}
      <button
        onClick={e => { e.stopPropagation(); onStateCycle(task.id); }}
        onMouseDown={e => e.stopPropagation()}
        title={`Estado: ${meta.label} — clic para cambiar`}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: meta.color, padding: '2px', marginTop: '1px', flexShrink: 0 }}>
        {meta.icon}
      </button>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isEditing ? (
            <input
              ref={inlineInputRef}
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
              }}
              style={{
                fontSize: '14px', fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'var(--bg-input)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                padding: '1px 6px',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => { setDraftText(task.text); setIsEditing(true); }}
              title="Doble clic para renombrar"
              style={{
                fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
                textDecoration: task.state === 'done' ? 'line-through' : 'none',
                wordBreak: 'break-word', cursor: 'text',
              }}
            >{task.text}</span>
          )}
          {/* Priority flag — only when medium or high */}
          {pMeta && task.priority !== 'low' && (
            <Flag size={12} style={{ color: pMeta.color, flexShrink: 0 }} />
          )}
        </div>
        {task.description && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
            {task.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {/* State chip */}
          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: meta.bgVar, color: meta.color }}>
            {meta.label}
          </span>
          {/* Tags */}
          {(task.tags ?? []).map(t => (
            <span key={t} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '20px', background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>{t}</span>
          ))}
          {/* Due date */}
          {dueDateDisplay && (
            <span style={{ fontSize: '11px', color: isOverdue ? 'var(--color-error)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {isOverdue && <AlertCircle size={11} />}
              {isOverdue ? 'Vencida: ' : ''}{dueDateDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Context menu — hidden while inline editing */}
      {!isEditing && (
        <ContextMenu
          task={task}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// CONTEXT MENU  (extracted to isolate hover state + outside-click logic)
// ─────────────────────────────────────────────

interface ContextMenuProps {
  task: Task;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

function ContextMenu({ task, menuOpen, setMenuOpen, onEdit, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoverEdit, setHoverEdit] = useState(false);
  const [hoverDelete, setHoverDelete] = useState(false);

  // Close when the user clicks outside the menu container
  useEffect(() => {
    if (!menuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuOpen, setMenuOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', borderRadius: '4px', display: 'flex' }}
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px', zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: 'var(--shadow-md)', minWidth: '140px', padding: '4px', animation: 'fadeIn 100ms ease',
        }}>
          {/* useState hover avoids direct DOM mutation (anti-pattern) */}
          <button
            onClick={() => { onEdit(task); setMenuOpen(false); }}
            onMouseEnter={() => setHoverEdit(true)}
            onMouseLeave={() => setHoverEdit(false)}
            style={{
              width: '100%', background: hoverEdit ? 'var(--bg-hover)' : 'transparent',
              border: 'none', cursor: 'pointer', padding: '7px 12px', textAlign: 'left',
              fontSize: '13px', color: 'var(--text-primary)', borderRadius: '5px',
              fontFamily: 'var(--font-ui)', transition: 'background 0.1s',
            }}
          >Editar</button>
          <button
            onClick={() => { onDelete(task.id); setMenuOpen(false); }}
            onMouseEnter={() => setHoverDelete(true)}
            onMouseLeave={() => setHoverDelete(false)}
            style={{
              width: '100%', background: hoverDelete ? 'rgba(239,68,68,0.06)' : 'transparent',
              border: 'none', cursor: 'pointer', padding: '7px 12px', textAlign: 'left',
              fontSize: '13px', color: 'var(--color-error)', borderRadius: '5px',
              fontFamily: 'var(--font-ui)', transition: 'background 0.1s',
            }}
          >Eliminar</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DRAGGABLE CARD WRAPPER
// ─────────────────────────────────────────────

interface DraggableCardProps {
  task: Task;
  onStateCycle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onInlineRename: (id: string, newText: string) => void;
}

function DraggableCard({ task, onStateCycle, onEdit, onDelete, onInlineRename }: DraggableCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => {
        // Ignore drag events originating from interactive children (buttons)
        if ((e.target as HTMLElement).closest('button')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('taskId', task.id);
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.45 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.15s, transform 0.15s',
        boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
        borderRadius: '8px',
      }}
    >
      <TaskCard task={task} onStateCycle={onStateCycle} onEdit={onEdit} onDelete={onDelete} onInlineRename={onInlineRename} />
    </div>
  );
}

// ─────────────────────────────────────────────
// KANBAN COLUMN
// ─────────────────────────────────────────────

interface KanbanColProps {
  state: TaskState;
  tasks: Task[];
  onStateCycle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDrop: (taskId: string, newState: TaskState) => void;
  onAddQuick: (state: TaskState) => void;
  onInlineRename: (id: string, newText: string) => void;
}

function KanbanCol({ state, tasks, onStateCycle, onEdit, onDelete, onDrop, onAddQuick, onInlineRename }: KanbanColProps) {
  const meta = STATUS_META[state];
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverAddBtn, setHoverAddBtn] = useState(false); // hover state replaces inline DOM mutation

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onDrop(taskId, state);
  };

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      style={{
        flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '8px',
        background: isDragOver ? meta.bgVar : 'transparent',
        border: isDragOver ? `2px dashed ${meta.color}` : '2px dashed transparent',
        borderRadius: '10px', padding: '8px', transition: 'background 0.15s, border-color 0.15s',
        boxSizing: 'border-box',
      }}
    >
      {/* Col header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '1px 7px', borderRadius: '20px', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
            {tasks.length}
          </span>
        </div>
        <button onClick={() => onAddQuick(state)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: hoverAddBtn ? 'var(--accent)' : 'var(--text-tertiary)',
            padding: '3px', borderRadius: '4px', display: 'flex', transition: 'color 0.1s',
          }}
          onMouseEnter={() => setHoverAddBtn(true)}
          onMouseLeave={() => setHoverAddBtn(false)}
          title="Añadir tarea"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Cards */}
      {tasks.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          <CheckSquare size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Sin tareas aquí</span>
        </div>
      ) : (
        tasks.map(task => (
          <DraggableCard key={task.id} task={task} onStateCycle={onStateCycle} onEdit={onEdit} onDelete={onDelete} onInlineRename={onInlineRename} />
        ))
      )}
      {/* Drop zone placeholder — visible only when dragging over this column */}
      {isDragOver && (
        <div style={{
          height: '60px', borderRadius: '8px',
          border: '2px dashed var(--accent)',
          background: 'var(--accent-light)',
          opacity: 0.5,
          flexShrink: 0,
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export function TasksScreen({ user, yjsDoc, onBack, onNavigate }: TasksScreenProps) {
  const serviceRef = useRef<TaskService | null>(null);
  const [personalListId, setPersonalListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filterState, setFilterState] = useState<TaskState | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'priority' | 'dueDate'>('createdAt');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [defaultState, setDefaultState] = useState<TaskState>('pending');
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    text: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('fluent-theme') as 'light' | 'dark') || 'dark');
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('fluent-theme', newTheme);
  };

  // Initialize TaskService and resolve (or create) the personal TaskList
  useEffect(() => {
    const svc = new TaskService(yjsDoc);
    serviceRef.current = svc;

    const existingLists = svc.getTaskLists(user.id);
    const list: TaskList = existingLists.length > 0
      ? existingLists[0]
      : svc.createTaskList('Personal', user.id);

    setPersonalListId(list.id);
  }, [yjsDoc, user.id]);

  // Reactively read tasks from Y.Map — re-renders on remote changes too
  useEffect(() => {
    if (!personalListId) return;
    const tasksMap = yjsDoc.getMap<Task>('tasks');
    const refresh = () => {
      setTasks(serviceRef.current?.getTasks(personalListId) ?? []);
    };
    refresh(); // initial load
    tasksMap.observe(refresh);
    return () => tasksMap.unobserve(refresh);
  }, [yjsDoc, personalListId]);

  // ── Shortcut global: Shift+N → abrir modal de nueva tarea ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (formOpen) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'N' && e.shiftKey) {
        e.preventDefault(); // evita que la 'N' se escriba en el input que recibe foco
        setEditingTask(undefined);
        setDefaultState('pending');
        setFormOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [formOpen]);

  // ── Cleanup pending-delete timer on unmount ──
  useEffect(() => {
    return () => { if (pendingDelete) clearTimeout(pendingDelete.timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CRUD ──────────────────────────────────────

  const handleCreate = (data: {
    text: string;
    description: string;
    state: TaskState;
    priority: TaskPriority;
    tags: string[];
    dueDateStr: string;
  }) => {
    if (!serviceRef.current || !personalListId) return;

    serviceRef.current.addTask(
      personalListId,
      data.text,
      user.id,
      dateInputToTs(data.dueDateStr),
    );

    // DEBT(tasks): TaskService.addTask() no acepta priority/tags/state/description.
    //              Se hace un segundo updateTask() como workaround.
    //              Resolver cuando se refactorice TaskService en Fase 2.
    const all = serviceRef.current.getTasks(personalListId);
    const created = all.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (created && (data.priority || data.tags.length || data.state !== 'pending' || data.description)) {
      serviceRef.current.updateTask(created.id, {
        priority: data.priority,
        tags: data.tags,
        state: data.state,
        description: data.description || undefined,
      });
    }

    setFormOpen(false);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleUpdate = (data: {
    text: string;
    description: string;
    state: TaskState;
    priority: TaskPriority;
    tags: string[];
    dueDateStr: string;
  }) => {
    if (!editingTask || !serviceRef.current) return;
    serviceRef.current.updateTask(editingTask.id, {
      text: data.text,
      description: data.description || undefined,
      state: data.state,
      priority: data.priority,
      tags: data.tags,
      dueDate: dateInputToTs(data.dueDateStr),
    });
    setFormOpen(false);
    setEditingTask(undefined);
  };

  const handleDelete = (id: string) => {
    // If there's already a pending delete, flush it immediately before queuing a new one
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      serviceRef.current?.deleteTask(pendingDelete.id);
    }
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    const timeoutId = setTimeout(() => {
      serviceRef.current?.deleteTask(id);
      setPendingDelete(null);
    }, 5000);

    setPendingDelete({ id, text: taskToDelete.text, timeoutId });
  };

  const cycleState = (id: string) => {
    const order: TaskState[] = ['pending', 'working', 'done'];
    const task = tasks.find(t => t.id === id);
    if (!task || !serviceRef.current) return;
    const next = order[(order.indexOf(task.state) + 1) % order.length];
    serviceRef.current.updateTask(id, { state: next });
  };

  const handleKanbanDrop = (taskId: string, newState: TaskState) => {
    serviceRef.current?.updateTask(taskId, { state: newState });
  };

  const handleInlineRename = (id: string, newText: string) => {
    serviceRef.current?.updateTask(id, { text: newText });
  };

  const openCreateWithState = (s: TaskState) => {
    setDefaultState(s);
    setEditingTask(undefined);
    setFormOpen(true);
  };

  // ── FILTERING / SORTING ────────────────────

  const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

  const filteredTasks = tasks
    .filter(t => t.id !== pendingDelete?.id) // hide soft-deleted task immediately
    .filter(t => filterState === 'all' || t.state === filterState)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.text.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.tags ?? []).some(tag => tag.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const pa = a.priority ? PRIORITY_ORDER[a.priority] : 99;
        const pb = b.priority ? PRIORITY_ORDER[b.priority] : 99;
        return pa - pb;
      }
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1; if (!b.dueDate) return -1;
        return a.dueDate - b.dueDate;
      }
      return b.createdAt - a.createdAt;
    });

  // Stats for header chips
  const total = tasks.length;
  const pending = tasks.filter(t => t.state === 'pending').length;
  const working = tasks.filter(t => t.state === 'working').length;
  const done = tasks.filter(t => t.state === 'done').length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;



  // ── RENDER ────────────────────────────────

  return (
    <>
      <div className="db2-container">
        {/* ─── SIDEBAR ─── */}
        <Sidebar
          user={user}
          currentScreen="tasks"
          onNavigate={onNavigate}
          onLogout={() => { }}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNewNote={() => { setEditingTask(undefined); setDefaultState('pending'); setFormOpen(true); }}
        />

        {/* ─── MAIN ─── */}
        <main className="db2-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px', boxSizing: 'border-box', gap: '20px', overflow: 'hidden' }}>

          {/* ── Page Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Tareas</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                {total} tarea{total !== 1 ? 's' : ''} · {progressPct}% completada{progressPct !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Stat chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {([['pending', pending, STATUS_META.pending], ['working', working, STATUS_META.working], ['done', done, STATUS_META.done]] as const).map(([s, count, m]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: m.bgVar, color: m.color, fontSize: '12px', fontWeight: 600 }}>
                  {m.icon}
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Progress Bar ── */}
          {total > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ height: '4px', borderRadius: '4px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--color-success)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid var(--border-input)', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Filter: State */}
            <select value={filterState} onChange={e => setFilterState(e.target.value as TaskState | 'all')}
              style={{ padding: '7px 10px', border: '1px solid var(--border-input)', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="working">En progreso</option>
              <option value="done">Completada</option>
            </select>

            {/* Filter: Priority */}
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
              style={{ padding: '7px 10px', border: '1px solid var(--border-input)', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>

            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'createdAt' | 'priority' | 'dueDate')}
              style={{ padding: '7px 10px', border: '1px solid var(--border-input)', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', outline: 'none' }}>
              <option value="createdAt">Más recientes</option>
              <option value="priority">Prioridad</option>
              <option value="dueDate">Fecha límite</option>
            </select>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* View toggle with animated pill */}
            <div style={{ position: 'relative', display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '7px', border: '1px solid var(--border-color)' }}>
              {(['list', 'kanban'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    position: 'relative', zIndex: 1,
                    padding: '5px 12px', borderRadius: '5px', fontSize: '13px', fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: 'transparent',
                    color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                  }}
                >
                  {/* Animated background pill */}
                  {viewMode === mode && (
                    <motion.span
                      layoutId="view-toggle-pill"
                      style={{
                        position: 'absolute', inset: 0, borderRadius: '5px',
                        background: 'var(--bg-primary)', boxShadow: 'var(--shadow-sm)',
                        zIndex: -1,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  {mode === 'list' ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
                  {mode === 'list' ? 'Lista' : 'Kanban'}
                </button>
              ))}
            </div>

            {/* New task btn */}
            <button onClick={() => { setEditingTask(undefined); setDefaultState('pending'); setFormOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
              <Plus size={14} /> Nueva tarea
            </button>
          </div>

          {/* ── Content ── */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {filteredTasks.length === 0 && tasks.length === 0 ? (
              // Empty state
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-tertiary)' }}>
                <CheckSquare size={48} style={{ opacity: 0.2 }} />
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Sin tareas todavía</p>
                <p style={{ margin: 0, fontSize: '13px', maxWidth: '30ch', textAlign: 'center' }}>Crea tu primera tarea para empezar a organizarte.</p>
                <button onClick={() => { setEditingTask(undefined); setDefaultState('pending'); setFormOpen(true); }}
                  style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                  <Plus size={14} /> Crear primera tarea
                </button>
              </div>
            ) : filteredTasks.length === 0 ? (
              // No results
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                <Search size={36} style={{ opacity: 0.25 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Sin resultados para los filtros actuales</p>
              </div>
            ) : viewMode === 'list' ? (
              // ── LIST VIEW ──────────────────────────────────────────
              <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                {filteredTasks.map(task => (
                  <TaskCard key={task.id} task={task} onStateCycle={cycleState} onEdit={handleEdit} onDelete={handleDelete} onInlineRename={handleInlineRename} />
                ))}
              </div>
            ) : (
              // ── KANBAN VIEW ────────────────────────────────────────
              <div style={{ height: '100%', display: 'flex', gap: '16px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px' }}>
                {(['pending', 'working', 'done'] as TaskState[]).map(s => (
                  <KanbanCol
                    key={s}
                    state={s}
                    tasks={filteredTasks.filter(t => t.state === s)}
                    onStateCycle={cycleState}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDrop={handleKanbanDrop}
                    onAddQuick={openCreateWithState}
                    onInlineRename={handleInlineRename}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ─── TASK FORM MODAL ─── */}
      <AnimatePresence>
        {formOpen && (
          <TaskForm
            initial={
              editingTask
                ? { ...editingTask, dueDateStr: tsToDateInput(editingTask.dueDate) }
                : { state: defaultState }
            }
            onSave={editingTask ? handleUpdate : handleCreate}
            onClose={() => { setFormOpen(false); setEditingTask(undefined); }}
          />
        )}
      </AnimatePresence>

      {/* ─── UNDO TOAST — Soft delete con 5s de ventana ─── */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', bottom: '24px', left: '24px', zIndex: 9998,
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '8px', boxShadow: 'var(--shadow-md)',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
              fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
            }}
          >
            <Trash2 size={14} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{pendingDelete.text}" eliminada
            </span>
            <button
              onClick={() => {
                clearTimeout(pendingDelete.timeoutId);
                setPendingDelete(null);
                // La tarea nunca se borró de Yjs — solo se retira del estado pendingDelete
              }}
              style={{
                background: 'var(--accent-light)', border: 'none', borderRadius: '4px',
                color: 'var(--accent)', fontSize: '12px', fontWeight: 600,
                padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                flexShrink: 0,
              }}
            >
              Deshacer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
