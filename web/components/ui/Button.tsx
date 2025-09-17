'use client';

import React, { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)] hover:opacity-90',
  secondary:
    'bg-surface-soft text-[var(--text-primary)] border border-subtle focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)] hover:bg-[var(--surface-0)]',
  ghost:
    'bg-transparent text-[var(--text-primary)] hover:bg-surface-soft focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)]',
  outline:
    'border border-subtle text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)]',
  subtle:
    'bg-[color-mix(in srgb, var(--accent-primary) 8%, transparent)] text-[var(--text-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)]',
  danger:
    'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 focus-visible:ring-offset-[var(--surface-0)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4',
  lg: 'h-11 px-5 text-base',
  icon: 'h-10 w-10 text-base',
};

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'subtle' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], fullWidth && 'w-full', className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
