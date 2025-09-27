import React from 'react';

type Props = {
  color?: string;
  children: React.ReactNode;
};

export const Badge: React.FC<Props> = ({ color = '#64748b', children }) => (
  <span className="ui-badge" style={{ backgroundColor: color }}>
    {children}
  </span>
);
