'use client';

import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const baseInputStyles =
  'w-full rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] transition-base placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn(baseInputStyles, className)} {...props} />;
});

Input.displayName = 'Input';
