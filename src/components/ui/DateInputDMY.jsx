import React, { useEffect, useMemo, useState } from 'react';

// Convert 'yyyy-MM-dd' to 'dd-MM-yyyy' without timezone effects
function ymdToDmy(ymd) {
  if (!ymd || typeof ymd !== 'string') return '';
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}

// Convert 'dd-MM-yyyy' to 'yyyy-MM-dd' if valid
function dmyToYmd(dmy) {
  if (!dmy || typeof dmy !== 'string') return '';
  const m = dmy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m;
  // Basic sanity check for calendar ranges
  const dd = Number(d), mm = Number(mo), yyyy = Number(y);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return '';
  return `${y}-${mo}-${d}`;
}

// A controlled text-based date input that displays dd-MM-yyyy but exposes yyyy-MM-dd in onChange
export function DateInputDMY({ name, value, onChange, placeholder = 'dd-mm-yyyy', className = '', disabled = false }) {
  const initial = useMemo(() => ymdToDmy(value || ''), [value]);
  const [display, setDisplay] = useState(initial);

  useEffect(() => {
    setDisplay(ymdToDmy(value || ''));
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9-]/g, '').slice(0, 10);
    setDisplay(v);
    const ymd = dmyToYmd(v);
    if (ymd && onChange) {
      onChange({ target: { name, value: ymd } });
    }
  };

  const handleBlur = () => {
    const ymd = dmyToYmd(display);
    if (!ymd) {
      // revert to last valid
      setDisplay(ymdToDmy(value || ''));
    }
  };

  return (
    <input
      type="text"
      name={name}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      disabled={disabled}
      inputMode="numeric"
      pattern="\d{2}-\d{2}-\d{4}"
    />
  );
}
