import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export const Button: React.FC<Props> = ({ variant = 'primary', ...rest }) => {
  const cls = variant === 'primary' ? 'ui-btn-primary' : 'ui-btn-secondary';
  return <button className={cls} {...rest} />;
};
