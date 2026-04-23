import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Extension } from '@tiptap/core';
import * as Y from 'yjs';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    ListChecks,
    Table as TableIcon,
    Quote,
    Minus,

    Pilcrow,
    Trash2,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Columns,
    Rows,
    SlidersHorizontal,
    Maximize2,
    Wand2,
    Loader2,
} from 'lucide-react';

interface EditorProps {
    doc: Y.Doc;
    provider: any;
    user: { name: string; color: string };
    noteId: string;          // ← NEW: which note we're editing
    noteTitle: string;
    onTitleChange: (title: string) => void;
}

// ─── Tab Indentation Extension ───
// Captures Tab / Shift+Tab so it indents content instead of moving focus
const TabIndentation = Extension.create({
    name: 'tabIndentation',

    addKeyboardShortcuts() {
        return {
            Tab: ({ editor }) => {
                // Inside a list → sink the item deeper
                if (editor.isActive('listItem') || editor.isActive('taskItem')) {
                    return editor.chain().focus().sinkListItem('listItem').run()
                        || editor.chain().focus().sinkListItem('taskItem').run();
                }
                // Otherwise insert 4 spaces as indentation
                editor.chain().focus().insertContent('    ').run();
                return true; // prevent default Tab behavior
            },
            'Shift-Tab': ({ editor }) => {
                // Inside a list → lift the item up
                if (editor.isActive('listItem') || editor.isActive('taskItem')) {
                    return editor.chain().focus().liftListItem('listItem').run()
                        || editor.chain().focus().liftListItem('taskItem').run();
                }
                return true; // prevent default
            },
        };
    },
});

// ─── Table Context Menu ───
interface TableMenuState {
    visible: boolean;
    x: number;
    y: number;
}

function TableContextMenu({
    state,
    editor,
    onClose,
}: {
    state: TableMenuState;
    editor: any;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [onClose]);

    if (!state.visible) return null;

    const items = [
        { label: 'Insertar fila arriba', icon: <ArrowUp size={14} />, action: () => editor.chain().focus().addRowBefore().run() },
        { label: 'Insertar fila abajo', icon: <ArrowDown size={14} />, action: () => editor.chain().focus().addRowAfter().run() },
        { label: 'Insertar columna izquierda', icon: <ArrowLeft size={14} />, action: () => editor.chain().focus().addColumnBefore().run() },
        { label: 'Insertar columna derecha', icon: <ArrowRight size={14} />, action: () => editor.chain().focus().addColumnAfter().run() },
        { type: 'separator' as const },
        { label: 'Eliminar fila', icon: <Rows size={14} />, action: () => editor.chain().focus().deleteRow().run(), danger: true },
        { label: 'Eliminar columna', icon: <Columns size={14} />, action: () => editor.chain().focus().deleteColumn().run(), danger: true },
        { label: 'Eliminar tabla', icon: <Trash2 size={14} />, action: () => editor.chain().focus().deleteTable().run(), danger: true },
    ];

    return (
        <div ref={ref} className="context-menu" style={{ top: state.y, left: state.x }}>
            {items.map((item, i) =>
                'type' in item && item.type === 'separator' ? (
                    <div key={i} className="context-menu-separator" />
                ) : (
                    <button
                        key={i}
                        className={`context-menu-item ${'danger' in item && item.danger ? 'danger' : ''}`}
                        tabIndex={-1}
                        onClick={() => {
                            if ('action' in item) item.action();
                            onClose();
                        }}
                    >
                        {'icon' in item && item.icon}
                        <span>{'label' in item && item.label}</span>
                    </button>
                )
            )}
        </div>
    );
}

// ─── Analysis Data Types ───
interface StatsData {
    wordCount: number;
    charCount: number;
    readingTimeMinutes: number;
}

interface AnalysisData {
    stats: StatsData;
    summary: string;
}

// ─── Analysis Popover ───
function AnalysisPopover({
    isAnalyzing,
    data,
    error,
    onClose,
    anchorRect,
}: {
    isAnalyzing: boolean;
    data: AnalysisData | null;
    error: string | null;
    onClose: () => void;
    anchorRect: DOMRect | null;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        setTimeout(() => document.addEventListener('mousedown', onClick), 0);
        return () => document.removeEventListener('mousedown', onClick);
    }, [onClose]);

    if (!anchorRect) return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        top: anchorRect.bottom + 8,
        // Ancla a la derecha del botón, max 340px de ancho
        right: Math.max(8, window.innerWidth - anchorRect.right),
        zIndex: 9999,
        width: 340,
    };

    return createPortal(
        <div ref={ref} className="margin-popover" style={style}>
            <div className="margin-popover-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 size={14} />
                Análisis con IA
            </div>

            {/* Estado: cargando */}
            {isAnalyzing && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 0' }}>
                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Analizando con Gemini...</span>
                </div>
            )}

            {/* Estado: error */}
            {!isAnalyzing && error && (
                <p style={{ fontSize: 12, color: 'var(--color-error)', margin: '12px 0 0', lineHeight: 1.5 }}>
                    {error}
                </p>
            )}

            {/* Estado: datos listos */}
            {!isAnalyzing && data && (
                <>
                    {/* Estadísticas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0' }}>
                        {([
                            { label: 'Palabras', value: data.stats.wordCount },
                            { label: 'Caracteres', value: data.stats.charCount },
                            { label: 'Lectura', value: `${data.stats.readingTimeMinutes} min` },
                        ] as { label: string; value: string | number }[]).map(({ label, value }) => (
                            <div key={label} style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: 8, padding: '8px 10px',
                                textAlign: 'center',
                            }}>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {value}
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Separador */}
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0 10px' }} />

                    {/* Resumen IA */}
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Resumen IA
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {data.summary}
                    </p>
                </>
            )}
        </div>,
        document.body
    );
}

// ─── Margin Settings Popover ───
function MarginPopover({
    margin,
    onChange,
    onFullWidth,
    onClose,
    anchorRect,
}: {
    margin: number;
    onChange: (v: number) => void;
    onFullWidth: () => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        setTimeout(() => document.addEventListener('mousedown', onClick), 0);
        return () => document.removeEventListener('mousedown', onClick);
    }, [onClose]);

    if (!anchorRect) return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left: anchorRect.right - 240,
        zIndex: 9999,
    };

    return createPortal(
        <div ref={ref} className="margin-popover" style={style}>
            <div className="margin-popover-title">Márgenes de página</div>
            <div className="margin-popover-row">
                <label className="margin-popover-label">Ancho</label>
                <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={margin}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="margin-slider"
                />
                <span className="margin-popover-value">{margin}%</span>
            </div>
            <div className="margin-popover-presets">
                <button className="margin-preset-btn" tabIndex={-1} onClick={() => onChange(0)}>Sin margen</button>
                <button className="margin-preset-btn" tabIndex={-1} onClick={() => onChange(5)}>Pequeño</button>
                <button className="margin-preset-btn" tabIndex={-1} onClick={() => onChange(10)}>Mediano</button>
                <button className="margin-preset-btn" tabIndex={-1} onClick={() => onChange(20)}>Grande</button>
            </div>
            <button className="margin-fullwidth-btn" tabIndex={-1} onClick={onFullWidth}>
                <Maximize2 size={14} />
                Ancho completo
            </button>
        </div>,
        document.body
    );
}

export const Editor = ({ doc, provider, user, noteId, noteTitle, onTitleChange }: EditorProps) => {
    const [tableMenu, setTableMenu] = useState<TableMenuState>({ visible: false, x: 0, y: 0 });
    const [showMarginPopover, setShowMarginPopover] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    // ─── AI Analysis state ───
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisAnchorRect, setAnalysisAnchorRect] = useState<DOMRect | null>(null);

    // ─── Persistent margin state (localStorage) ───
    const [marginPercent, setMarginPercent] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('tuxnotas-editor-margin');
            return saved !== null ? Number(saved) : 5;
        } catch { return 5; }
    });

    useEffect(() => {
        localStorage.setItem('tuxnotas-editor-margin', String(marginPercent));
    }, [marginPercent]);

    // ─── Draggable margin handles ───
    const wrapperRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<'left' | 'right' | null>(null);

    const handleDragStart = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
        e.preventDefault();
        draggingRef.current = side;

        const onMove = (ev: MouseEvent) => {
            if (!wrapperRef.current || !draggingRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            const totalWidth = rect.width;
            let pxFromEdge: number;
            if (draggingRef.current === 'left') {
                pxFromEdge = ev.clientX - rect.left;
            } else {
                pxFromEdge = rect.right - ev.clientX;
            }
            let pct = Math.round((pxFromEdge / totalWidth) * 100);
            pct = Math.max(0, Math.min(30, pct));
            setMarginPercent(pct);
        };

        const onUp = () => {
            draggingRef.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);

    // Set awareness user info
    useEffect(() => {
        if (provider?.awareness) {
            provider.awareness.setLocalStateField('user', {
                name: user.name,
                color: user.color,
            });
        }
    }, [provider, user]);

    // ★ KEY FIX: Each note gets its own XmlFragment in the shared Y.Doc
    // This isolates content so notes don't bleed into each other
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false,
            } as any),
            Collaboration.configure({
                document: doc,
                fragment: doc.getXmlFragment(`note-${noteId}`),
            }),
            TabIndentation,
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
    }, [noteId]); // ← re-create editor when noteId changes

    // Right-click handler for tables
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (!editor) return;
            const isInTable = editor.isActive('table');
            if (isInTable) {
                e.preventDefault();
                setTableMenu({ visible: true, x: e.clientX, y: e.clientY });
            }
        },
        [editor]
    );

    if (!editor) {
        return (
            <div className="editor-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="pulse" style={{ color: 'var(--text-tertiary)' }}>Cargando editor...</div>
            </div>
        );
    }

    const ToolbarButton = ({
        onClick,
        isActive = false,
        children,
        title,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            onClick={onClick}
            className={`toolbar-btn ${isActive ? 'is-active' : ''}`}
            title={title}
            type="button"
            tabIndex={-1}
        >
            {children}
        </button>
    );

    const Divider = () => <div className="divider" />;

    const marginStyle = { '--editor-margin': `${marginPercent}%` } as React.CSSProperties;

    return (
        <div className="editor-wrapper" ref={wrapperRef} style={marginStyle}>
            <TableContextMenu
                state={tableMenu}
                editor={editor}
                onClose={() => setTableMenu({ visible: false, x: 0, y: 0 })}
            />

            {/* Floating Toolbar */}
            <div className="editor-toolbar">
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Negrita">
                    <Bold />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Cursiva">
                    <Italic />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Tachado">
                    <Strikethrough />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Código">
                    <Code />
                </ToolbarButton>

                <Divider />

                <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')} title="Párrafo">
                    <Pilcrow />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Título 1">
                    <Heading1 />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Título 2">
                    <Heading2 />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Título 3">
                    <Heading3 />
                </ToolbarButton>

                <Divider />

                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Lista">
                    <List />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Lista ordenada">
                    <ListOrdered />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Lista de tareas">
                    <ListChecks />
                </ToolbarButton>

                <Divider />

                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Cita">
                    <Quote />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea horizontal">
                    <Minus />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla">
                    <TableIcon />
                </ToolbarButton>

                <Divider />

                {/* Margin settings button */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="toolbar-btn"
                        title="Ajustar márgenes"
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                            setAnchorRect(e.currentTarget.getBoundingClientRect());
                            setShowMarginPopover(!showMarginPopover);
                            setShowAnalysis(false);
                        }}
                    >
                        <SlidersHorizontal />
                    </button>
                    {showMarginPopover && (
                        <MarginPopover
                            margin={marginPercent}
                            onChange={setMarginPercent}
                            onFullWidth={() => { setMarginPercent(0); setShowMarginPopover(false); }}
                            onClose={() => setShowMarginPopover(false)}
                            anchorRect={anchorRect}
                        />
                    )}
                </div>

                {/* AI Analysis button */}
                <div style={{ position: 'relative' }}>
                    <button
                        className={`toolbar-btn ${showAnalysis ? 'is-active' : ''}`}
                        title="Analizar con IA"
                        type="button"
                        tabIndex={-1}
                        onClick={async (e) => {
                            const text = editor.getText().trim();
                            if (!text) return;

                            const rect = e.currentTarget.getBoundingClientRect();
                            setAnalysisAnchorRect(rect);
                            setShowMarginPopover(false);

                            // Toggle: si ya estaba abierto con datos, cierra
                            if (showAnalysis) {
                                setShowAnalysis(false);
                                return;
                            }

                            setShowAnalysis(true);
                            setIsAnalyzing(true);
                            setAnalysisData(null);
                            setAnalysisError(null);

                            const statsUrl = import.meta.env.VITE_STATS_SERVICE_URL || 'http://localhost:8082';
                            const summaryUrl = import.meta.env.VITE_SUMMARY_SERVICE_URL || 'http://localhost:8083';
                            const apiKey = import.meta.env.VITE_API_KEY || 'briefly-secret-key';

                            const headers = {
                                'Content-Type': 'application/json',
                                'x-api-key': apiKey,
                            };
                            const body = JSON.stringify({ text });

                            try {
                                const [statsRes, summaryRes] = await Promise.all([
                                    fetch(`${statsUrl}/api/v1/stats`, { method: 'POST', headers, body }),
                                    fetch(`${summaryUrl}/api/v1/summary`, { method: 'POST', headers, body }),
                                ]);

                                if (!statsRes.ok) throw new Error(`Stats service: HTTP ${statsRes.status}`);
                                if (!summaryRes.ok) throw new Error(`Summary service: HTTP ${summaryRes.status}`);

                                const [stats, summaryData] = await Promise.all([
                                    statsRes.json() as Promise<StatsData>,
                                    summaryRes.json() as Promise<{ summary: string }>,
                                ]);

                                setAnalysisData({ stats, summary: summaryData.summary });
                            } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Error desconocido';
                                setAnalysisError(`No se pudo completar el análisis. Verifica que los servicios estén activos.\n${msg}`);
                            } finally {
                                setIsAnalyzing(false);
                            }
                        }}
                    >
                        <Wand2 />
                    </button>
                    {showAnalysis && (
                        <AnalysisPopover
                            isAnalyzing={isAnalyzing}
                            data={analysisData}
                            error={analysisError}
                            onClose={() => setShowAnalysis(false)}
                            anchorRect={analysisAnchorRect}
                        />
                    )}
                </div>
            </div>

            {/* Note Title */}
            <input
                className="editor-title-input"
                type="text"
                placeholder="Sin título"
                value={noteTitle}
                onChange={(e) => onTitleChange(e.target.value)}
            />

            {/* Draggable margin handles + Editor Content */}
            <div className="editor-content-area">
                <div
                    className="margin-handle margin-handle-left"
                    onMouseDown={handleDragStart('left')}
                    title="Arrastra para ajustar margen"
                />
                <div className="editor-container" onContextMenu={handleContextMenu}>
                    <EditorContent editor={editor} />
                </div>
                <div
                    className="margin-handle margin-handle-right"
                    onMouseDown={handleDragStart('right')}
                    title="Arrastra para ajustar margen"
                />
            </div>
        </div>
    );
};
