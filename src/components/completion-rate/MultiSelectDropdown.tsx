'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  placeholder = 'All',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="glass-input w-full px-3 py-2 rounded-md text-left flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/20 hover:border-white/40 cursor-pointer"
      >
        <span className="text-slate-100 font-medium">{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-white/30 shadow-2xl" style={{ background: '#1a1440' }}>
          {/* Action buttons */}
          <div className="px-3 py-2 border-b border-white/10 flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs px-2 py-1 bg-purple-500/30 text-purple-200 border border-purple-500/50 rounded hover:bg-purple-500/50 hover:border-purple-500/70 transition-all font-bold cursor-pointer"
            >
              Select All
            </button>
            <button
              onClick={handleClearAll}
              className="text-xs px-2 py-1 bg-white/15 text-slate-200 border border-white/30 rounded hover:bg-white/25 hover:border-white/50 transition-all font-bold cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-300 text-center">No options available</div>
            ) : (
              options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center px-3 py-2 hover:bg-white/15 cursor-pointer transition-all border-b border-white/5 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                  <span className="ml-3 text-sm text-slate-100 font-medium">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
