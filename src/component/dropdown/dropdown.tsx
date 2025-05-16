import React, { useState } from "react";

interface DropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ options, value, onChange }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className="w-full text-white rounded px-2 py-1 flex items-center justify-between focus:outline-none"
        onClick={() => setDropdownOpen((open) => !open)}
      >
        <span>{value}</span>
        <svg className={`w-3 h-3 ml-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[#181C20] border border-[#2A2E33] rounded shadow-lg">
          {options.map((g) => (
            <div
              key={g}
              className={`px-4 py-2 cursor-pointer hover:bg-[#23272B] ${value === g ? 'bg-[#23272B] text-white' : 'text-gray-300'}`}
              onClick={() => {
                onChange(g);
                setDropdownOpen(false);
              }}
            >
              {g}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
