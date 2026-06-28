import React, { useState, useRef, useEffect } from "react";

export interface Option {
  value: string | number | "";
  label: string;
}

interface SelectDropdownProps {
  value: string | number | null | "";
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
}

export default function SelectDropdown({ value, onChange, options, placeholder = "Select..." }: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Consider null and "" as equivalent for the placeholder state
  const normalizedValue = value === null ? "" : value;
  const selectedOption = options.find((o) => o.value === normalizedValue);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full glass-card rounded-xl px-4 py-3 text-left text-surface-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 flex items-center justify-between transition-colors"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <svg
          className={`w-5 h-5 flex-shrink-0 ml-3 text-surface-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[60] w-full mt-2 glass-card rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option) => {
            const isSelected = normalizedValue === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value === "" ? null : option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex justify-between items-center ${
                  isSelected 
                    ? "bg-primary-500/10 text-primary-500 font-medium" 
                    : "text-surface-200 hover:bg-surface-700"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
