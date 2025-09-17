import React, {
  Children,
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
  useId,
} from 'react';
import { cn } from '../../lib/cn';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  inline?: boolean;
  required?: boolean;
  htmlFor?: string;
}

export function Field({
  label,
  description,
  error,
  inline = false,
  required = false,
  htmlFor,
  className,
  children,
  ...props
}: FieldProps) {
  const autoId = useId();
  const controlId = htmlFor ?? autoId;
  const labelId = `${controlId}-label`;

  const enhancedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    const extraProps: Record<string, unknown> = {};
    if (!child.props.id) {
      extraProps.id = controlId;
    }
    const existingLabelledBy = child.props['aria-labelledby'] as string | undefined;
    extraProps['aria-labelledby'] = existingLabelledBy ? `${existingLabelledBy} ${labelId}` : labelId;
    if (typeof label === 'string' && !child.props['aria-label']) {
      extraProps['aria-label'] = label;
    }
    return cloneElement(child, extraProps);
  });

  return (
    <div
      className={cn('flex flex-col gap-2 text-sm text-muted', inline ? 'md:flex-row md:items-center md:gap-4' : null, className)}
      {...props}
    >
      <label
        id={labelId}
        htmlFor={htmlFor ?? controlId}
        className="flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]"
      >
        <span>{label}</span>
        {required ? <span className="text-red-500" aria-hidden="true">*</span> : null}
      </label>
      <div className="flex flex-col gap-1">
        {enhancedChildren}
        {description ? <p className="text-xs text-muted">{description}</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
