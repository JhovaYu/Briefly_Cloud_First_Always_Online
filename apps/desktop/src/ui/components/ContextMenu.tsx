import { useEffect, useRef } from 'react';

export function ContextMenu({ x, y, items, onClose }: {
  x: number; y: number;
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const ax = Math.min(x, window.innerWidth - 220);
  const ay = Math.min(y, window.innerHeight - items.length * 36 - 20);
  return (
    <div ref={ref} className="context-menu" style={{ top: ay, left: ax }}>
      {items.map((item, i) => (
        <button key={i} className={`context-menu-item ${item.danger ? 'danger' : ''}`}
          onClick={() => { item.onClick(); onClose(); }}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
