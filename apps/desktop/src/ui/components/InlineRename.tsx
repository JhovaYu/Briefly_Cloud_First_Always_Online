import { useState, useRef, useEffect } from 'react';

export function InlineRename({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input ref={ref} className="inline-rename-input" value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel(); }}
      onClick={(e) => e.stopPropagation()} />
  );
}
