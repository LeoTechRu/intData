import React, { FC } from 'react';

interface HelloProps {
  name: string;
}

export const Hello: FC<HelloProps> = ({ name }) => {
  return <div>Привет, {name}!</div>;
};

export default Hello;
