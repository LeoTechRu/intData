import React from 'react';

type Props = {
  message: string;
};

export const Toast: React.FC<Props> = ({ message }) => (
  <div role="status" className="ui-toast">
    {message}
  </div>
);
