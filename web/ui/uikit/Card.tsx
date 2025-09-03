import React from 'react';

type Props = {
  children: React.ReactNode;
};

export const Card: React.FC<Props> = ({ children }) => (
  <div className="ui-card">{children}</div>
);
