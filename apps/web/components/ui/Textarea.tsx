'use client';

import React, { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const baseTextareaStyles =
  'w-full rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] transition-base placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, rows = 3, ...props }, ref) => {
  return <textarea ref={ref} rows={rows} className={cn(baseTextareaStyles, className)} {...props} />;
});

Textarea.displayName = 'Textarea';
