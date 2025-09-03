import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const FormField: React.FC<Props> = ({ label, ...rest }) => (
  <label className="ui-field">
    <span>{label}</span>
    <input {...rest} />
  </label>
);
