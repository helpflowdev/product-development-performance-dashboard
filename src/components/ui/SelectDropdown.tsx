'use client';

import { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SelectDropdown({
  label,
  options,
  value,
  onChange,
  disabled = false,
  placeholder = '-- Choose --',
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="glass-input w-full px-3 py-3 rounded-lg text-left flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/20 hover:border-white/40 cursor-pointer"
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
        <div className="absolute z-50 w-full mt-1 glass-card rounded-lg border border-white/30 shadow-2xl max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-300 text-center">No options available</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-3 transition-all border-b border-white/5 last:border-b-0 hover:bg-white/15 ${
                  value === option.value ? 'bg-purple-500/30 border-l-2 border-l-cyan-400' : ''
                }`}
              >
                <span className={`text-sm font-medium ${value === option.value ? 'text-cyan-300' : 'text-slate-100'}`}>
                  {option.label}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
