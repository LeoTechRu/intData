'use client';

import React, { createContext, useContext } from 'react';

const TimezoneContext = createContext<string>('UTC');

interface TimezoneProviderProps {
  value: string;
  children: React.ReactNode;
}

export function TimezoneProvider({ value, children }: TimezoneProviderProps): JSX.Element {
  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
