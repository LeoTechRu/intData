import React, { FC } from 'react';
import { Button } from '../ui/uikit/Button';

interface HelloProps {
  name: string;
}

export const Hello: FC<HelloProps> = ({ name }) => {
  return (
    <div>
      Привет, {name}!<Button style={{ marginLeft: '0.5rem' }}>OK</Button>
    </div>
  );
};

export default Hello;
