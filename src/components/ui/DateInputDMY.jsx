import React, { useEffect, useMemo, useState } from 'react';

// A controlled date input using native calendar (value in 'yyyy-MM-dd')
export function DateInputDMY({ name, value, onChange, placeholder = 'Select date', className = '', disabled = false, min, max }) {
  return (
    <input
      type="date"
      name={name}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      disabled={disabled}
      min={min}
      max={max}
    />
  );
}
