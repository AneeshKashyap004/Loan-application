import React, { useMemo, useRef } from 'react';

export function DateInputDMY({ name, value, onChange, placeholder = 'dd-mm-yyyy', className = '', disabled = false, min, max }) {
  const ref = useRef(null);
  const display = useMemo(() => {
    const s = String(value || '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  }, [value]);

  const openPicker = () => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {display || placeholder}
      </button>
      <input
        ref={ref}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        min={min}
        max={max}
        aria-hidden
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />
    </div>
  );
}
