import React from 'react';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  onChange: (value: string) => void;
};

export const Dropdown: React.FC<Props> = ({ options, onChange }) => (
  <select className="ui-select" onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);
